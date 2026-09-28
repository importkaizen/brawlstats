/**
 * Battle-log polling logic.
 *
 * `pollPlayer(tag)` snapshots `/players/{tag}.rankedElo` **before** and **after**
 * fetching the battlelog, inserts missing rows, then stamps ranked battles so the
 * rating curve isn’t flattened when several ranked rounds arrive in one poll.
 * Battle history is append-only: the API's rolling window never replaces or
 * trims stored rows. Ranked logging start/reset only controls the chart session.
 *
 * Ranked inserts are sorted chronologically; the newest row anchors to the
 * post-battlelog `rankedElo`. Earlier rows use either:
 * - a backward walk from `battle.trophyChange` when the summed deltas roughly match
 *   the elo drift between the two profile snapshots, or
 * - **linear interpolation** between pre- and post-log elo across those rounds
 *   (better than cloning the same snapshot everywhere).
 *
 * When `trophyChange` is absent/zero (common for ranked in API docs), interpolation
 * still spreads movement across the batch so graphs show distinct points.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  ApiBattleEntry,
  ApiPlayer,
  fetchBattlelog,
  fetchPlayer,
  findPlayerInBattle,
  isRankedBattle,
  parseBattleTime,
} from "./brawlstars";
import { normalizeTag } from "./tag";
import { seasonForDate } from "./seasons";

export type PollResult = {
  inserted: number;
  total: number;
  player: {
    id: string;
    tag: string;
    name: string;
    icon: number;
    trophies: number;
  };
};

/** New players — missing ranked JSON keys → null columns. */
function rankedFieldsForCreate(api: ApiPlayer) {
  return {
    rankedElo: api.rankedElo ?? null,
    rankedRank: api.rankedRank ?? null,
    rankedRankName: api.rankedRankName ?? null,
    rankedSeasonId: api.rankedSeasonId ?? null,
    peakRankedElo: api.highestSeasonRankedElo ?? null,
    peakRankedRankName: api.highestSeasonRankedRankName ?? null,
    peakAllTimeRankedElo: api.highestAllTimeRankedElo ?? null,
    peakAllTimeRankedRank: api.highestAllTimeRankedRank ?? null,
    peakAllTimeRankedRankName: api.highestAllTimeRankedRankName ?? null,
  };
}

/**
 * Existing rows — omit keys Supercell leaves out of `/players/{tag}` entirely
 * so we never accidentally freeze elo by re-writing stale nulls across polls.
 */
function rankedFieldsForUpdate(api: ApiPlayer): Prisma.PlayerUpdateInput {
  const d: Prisma.PlayerUpdateInput = {};
  if (api.rankedElo !== undefined) d.rankedElo = api.rankedElo;
  if (api.rankedRank !== undefined) d.rankedRank = api.rankedRank;
  if (api.rankedRankName !== undefined) d.rankedRankName = api.rankedRankName;
  if (api.rankedSeasonId !== undefined) d.rankedSeasonId = api.rankedSeasonId;
  if (api.highestSeasonRankedElo !== undefined) {
    d.peakRankedElo = api.highestSeasonRankedElo;
  }
  if (api.highestSeasonRankedRankName !== undefined) {
    d.peakRankedRankName = api.highestSeasonRankedRankName;
  }
  if (api.highestAllTimeRankedElo !== undefined) {
    d.peakAllTimeRankedElo = api.highestAllTimeRankedElo;
  }
  if (api.highestAllTimeRankedRank !== undefined) {
    d.peakAllTimeRankedRank = api.highestAllTimeRankedRank;
  }
  if (api.highestAllTimeRankedRankName !== undefined) {
    d.peakAllTimeRankedRankName = api.highestAllTimeRankedRankName;
  }
  return d;
}

function mutableProfileSlice(api: ApiPlayer) {
  return {
    name: api.name,
    icon: api.icon?.id ?? 0,
    trophies: api.trophies ?? 0,
    highestTrophies: api.highestTrophies ?? 0,
    expLevel: api.expLevel ?? 0,
    ownedBrawlersJson: JSON.stringify(api.brawlers ?? []),
  };
}

export async function ensurePlayer(tag: string): Promise<ApiPlayer> {
  const t = normalizeTag(tag);
  const apiPlayer = await fetchPlayer(t);

  await prisma.player.upsert({
    where: { tag: t },
    update: {
      ...mutableProfileSlice(apiPlayer),
      ...rankedFieldsForUpdate(apiPlayer),
    },
    create: {
      tag: t,
      ...mutableProfileSlice(apiPlayer),
      ...rankedFieldsForCreate(apiPlayer),
    },
  });

  return apiPlayer;
}

async function refreshPlayerSnapshotFromApi(tag: string, api: ApiPlayer) {
  const t = normalizeTag(tag);
  await prisma.player.update({
    where: { tag: t },
    data: {
      ...mutableProfileSlice(api),
      ...rankedFieldsForUpdate(api),
    },
  });
}

/**
 * Per-row rated snapshots for ranked battles inserted in **this** poll batch,
 * chronological order (oldest → newest). Last entry equals `eloAfter`.
 */
function rankedRatingStampsForBatch(
  rankedAscTrophyChanges: number[],
  eloBeforeBattlelog: number | null,
  eloAfter: number | null,
): number[] {
  const n = rankedAscTrophyChanges.length;
  if (n === 0) return [];
  if (eloAfter == null) return [];

  if (n === 1) return [eloAfter];

  const start = eloBeforeBattlelog ?? eloAfter;
  const totalDelta = eloAfter - start;

  const sumTc = rankedAscTrophyChanges.reduce((a, b) => a + b, 0);
  const tolerance = Math.max(35, Math.ceil(Math.abs(totalDelta) * 0.45));

  const useTrophyChain =
    sumTc !== 0 &&
    totalDelta !== 0 &&
    Math.sign(sumTc) === Math.sign(totalDelta) &&
    Math.abs(sumTc - totalDelta) <= tolerance;

  if (useTrophyChain) {
    let running = eloAfter;
    const stamps = new Array<number>(n);
    for (let i = n - 1; i >= 0; i--) {
      stamps[i] = Math.round(running);
      running -= rankedAscTrophyChanges[i]!;
    }
    stamps[n - 1] = eloAfter;
    return stamps;
  }

  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    out.push(Math.round(start + (totalDelta * (k + 1)) / n));
  }
  out[n - 1] = eloAfter;
  return out;
}

/**
 * Insert any battles from the supplied battlelog that are not yet in
 * the DB. Ranked rows receive distinct `ratingAfter` stamps using the
 * pre/post battlelog elo snapshots when multiple battles arrive together.
 */
async function insertNewBattles(
  playerId: string,
  playerTag: string,
  battles: ApiBattleEntry[],
  trackOnlyRanked: boolean,
  liveElo: number | null,
  rankedEloBeforeBattlelog: number | null,
): Promise<number> {
  if (battles.length === 0) return 0;

  // Filter and parse once.
  const candidates = battles
    .map((b) => {
      const battleTime = parseBattleTime(b.battleTime);
      const isRanked = isRankedBattle(b);
      if (trackOnlyRanked && !isRanked) return null;
      return { entry: b, battleTime, isRanked };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (candidates.length === 0) return 0;

  // One query to learn which timestamps we already have.
  const existing = await prisma.battle.findMany({
    where: {
      playerId,
      battleTime: { in: candidates.map((c) => c.battleTime) },
    },
    select: { battleTime: true },
  });
  const haveTime = new Set(existing.map((b) => b.battleTime.getTime()));

  type Pending = {
    entry: ApiBattleEntry;
    battleTime: Date;
    isRanked: boolean;
  };
  const pending: Pending[] = [];
  for (const c of candidates) {
    if (haveTime.has(c.battleTime.getTime())) continue;
    pending.push({ entry: c.entry, battleTime: c.battleTime, isRanked: c.isRanked });
  }

  const rankedAsc = pending
    .filter((p) => p.isRanked)
    .slice()
    .sort((a, b) => a.battleTime.getTime() - b.battleTime.getTime());

  const stampByTimeMs = new Map<number, number>();
  if (liveElo != null && rankedAsc.length > 0) {
    const tcSeries = rankedAsc.map((p) => p.entry.battle.trophyChange ?? 0);
    const stamps = rankedRatingStampsForBatch(
      tcSeries,
      rankedEloBeforeBattlelog,
      liveElo,
    );
    for (let i = 0; i < rankedAsc.length; i++) {
      stampByTimeMs.set(rankedAsc[i]!.battleTime.getTime(), stamps[i]!);
    }
  }

  let inserted = 0;
  for (const { entry: b, battleTime, isRanked } of pending) {
    const found = findPlayerInBattle(b, playerTag);
    const brawler = found?.brawler;
    const result = (b.battle.result ?? "draw") as string;
    const trophyChange = b.battle.trophyChange ?? 0;
    const mode = b.event?.mode ?? b.battle.mode ?? "unknown";
    const map = b.event?.map ?? "Unknown";

    const ratingAfter =
      isRanked && liveElo != null
        ? (stampByTimeMs.get(battleTime.getTime()) ?? liveElo)
        : null;

    try {
      await prisma.battle.create({
        data: {
          playerId,
          battleTime,
          mode,
          map,
          result,
          brawlerName: brawler?.name ?? "Unknown",
          brawlerId: brawler?.id ?? 0,
          trophyChange,
          ratingAfter,
          duration: b.battle.duration ?? 0,
          isRanked,
          season: seasonForDate(battleTime).id,
          raw: JSON.stringify(b),
        },
      });
      inserted++;
    } catch (err) {
      // Race-condition fallback: another concurrent poll may have
      // inserted the row between our pre-fetch and create. Swallow.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }
  return inserted;
}

/**
 * Re-classify every battle's `isRanked` flag and rating fields by
 * re-reading the saved `raw` payload. Used to migrate existing rows
 * after a fix to `isRankedBattle` (or to recover from a misclassified
 * batch). Cheap on every poll and idempotent.
 *
 * After re-classification:
 *   - Trophy-ladder rows (newly demoted from "ranked") have their
 *     rating fields cleared (those values were never meaningful).
 *   - Saved Ranked ratings are preserved. A later poll must never stamp
 *     today's rating onto an older game.
 */
async function reclassifyBattles(playerId: string): Promise<void> {
  const battles = await prisma.battle.findMany({
    where: { playerId },
    orderBy: { battleTime: "asc" },
    select: { id: true, raw: true, isRanked: true, ratingAfter: true, ratingBefore: true },
  });
  if (battles.length === 0) return;

  type Update = {
    id: string;
    isRanked: boolean;
    ratingAfter: number | null;
    ratingBefore: number | null;
  };
  const updates: Update[] = [];

  const reclassified: Array<{ id: string; isRanked: boolean }> = [];
  for (let i = 0; i < battles.length; i++) {
    let isRanked = battles[i].isRanked;
    try {
      const parsed = JSON.parse(battles[i].raw) as ApiBattleEntry;
      isRanked = isRankedBattle(parsed);
    } catch {
      // Malformed raw payload — keep whatever flag it had.
    }
    reclassified.push({ id: battles[i].id, isRanked });
  }

  for (let i = 0; i < battles.length; i++) {
    const stored = battles[i];
    const next = reclassified[i];
    if (!next.isRanked) {
      // Trophy / casual / showdown: clear any stale rating snapshot.
      if (
        stored.isRanked !== false ||
        stored.ratingAfter != null ||
        stored.ratingBefore != null
      ) {
        updates.push({
          id: next.id,
          isRanked: false,
          ratingAfter: null,
          ratingBefore: null,
        });
      }
      continue;
    }

    if (stored.isRanked !== true) {
      updates.push({
        id: next.id,
        isRanked: true,
        ratingAfter: stored.ratingAfter,
        ratingBefore: stored.ratingBefore,
      });
    }
  }

  if (updates.length === 0) return;
  await prisma.$transaction(
    updates.map((u) =>
      prisma.battle.update({
        where: { id: u.id },
        data: {
          isRanked: u.isRanked,
          ratingAfter: u.ratingAfter,
          ratingBefore: u.ratingBefore,
        },
      }),
    ),
  );
}

export async function pollPlayer(tag: string): Promise<PollResult> {
  const t = normalizeTag(tag);
  const apiBeforeBattlelog = await ensurePlayer(t);
  const player = await prisma.player.findUniqueOrThrow({ where: { tag: t } });

  const log = await fetchBattlelog(t);

  // Fresh profile AFTER battle log — rankedElo aligns with battles we just fetched.
  const apiLive = await fetchPlayer(t);
  await refreshPlayerSnapshotFromApi(t, apiLive);
  const liveElo = apiLive.rankedElo ?? null;
  const rankedEloBeforeBattlelog = apiBeforeBattlelog.rankedElo ?? null;

  const rankedSessionWhere = {
    playerId: player.id,
    isRanked: true,
    ...(player.rankedLoggingStartedAt ? { battleTime: { gte: player.rankedLoggingStartedAt } } : {}),
  };
  const rankedBeforeInsert = await prisma.battle.count({ where: rankedSessionWhere });

  // Re-classify before insert so that any historical drift (e.g. rows
  // saved before the soloRanked fix) gets corrected on the same poll.
  await reclassifyBattles(player.id);

  const inserted = await insertNewBattles(
    player.id,
    t,
    log.items,
    player.trackOnlyRanked,
    liveElo,
    rankedEloBeforeBattlelog,
  );

  const rankedAfterInsert = await prisma.battle.count({ where: rankedSessionWhere });

  const baselineAnchor = await prisma.player.findUnique({
    where: { id: player.id },
    select: { rankedBaseline: true, rankedLoggingStartedAt: true },
  });

  // Snapshot `/players/{tag}.rankedElo` from *before* we pulled this battlelog — that’s rated elo
  // entering any ranked rows discovered on this poll (e.g. 6000 before your first logged losses).
  if (
    baselineAnchor?.rankedLoggingStartedAt &&
    baselineAnchor.rankedBaseline == null &&
    rankedEloBeforeBattlelog != null &&
    rankedBeforeInsert === 0 &&
    rankedAfterInsert > 0
  ) {
    await prisma.player.update({
      where: { id: player.id },
      data: {
        rankedBaseline: rankedEloBeforeBattlelog,
        rankedBaselineAt: baselineAnchor.rankedLoggingStartedAt,
      },
    });
  }

  await reclassifyBattles(player.id);

  await prisma.player.update({
    where: { id: player.id },
    data: { lastPolled: new Date() },
  });

  const total = await prisma.battle.count({ where: { playerId: player.id } });
  return {
    inserted,
    total,
    player: {
      id: player.id,
      tag: player.tag,
      name: player.name,
      icon: player.icon,
      trophies: apiLive.trophies ?? 0,
    },
  };
}

/**
 * Poll every player whose lastPolled is older than `staleAfterMs`.
 */
export async function pollStalePlayers(
  staleAfterMs = 5 * 60 * 1000,
): Promise<{ scanned: number; results: PollResult[]; errors: string[] }> {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const players = await prisma.player.findMany({
    where: { lastPolled: { lt: cutoff } },
    select: { tag: true },
    take: 200,
  });

  const results: PollResult[] = [];
  const errors: string[] = [];

  for (const p of players) {
    try {
      const r = await pollPlayer(p.tag);
      results.push(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${p.tag}: ${msg}`);
    }
  }

  return { scanned: players.length, results, errors };
}
