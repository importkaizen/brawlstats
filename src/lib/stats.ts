/**
 * Aggregation helpers built on top of the Battle table.
 *
 * Everything here is pure function over an already-fetched battle list,
 * so callers can compose filters (current season, etc.) before slicing.
 */

import type { Battle } from "@prisma/client";
import type { ApiBattleEntry } from "./brawlstars";
import { findPlayerInBattle, brawlerIdentityFromStoredBattle } from "./brawlstars";
import { normalizeTag } from "./tag";
import { currentSeason } from "./seasons";
export type Streak = { type: "win" | "loss" | "none"; length: number };

export type SeasonSummary = {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0..1
  avgTrophyChange: number;
  currentRating: number | null;
  peakRating: number | null;
  startRating: number | null;
  netChange: number;
  streak: Streak;
};

export type BrawlerStat = {
  brawlerId: number;
  brawlerName: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgTrophyChange: number;
  netChange: number;
  /** Newest battlelog snapshot for this brawler (when present). */
  latestTrophies?: number | null;
};

export type MapStat = {
  map: string;
  mode: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgTrophyChange: number;
};

export type ModeStat = {
  mode: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgTrophyChange: number;
};

/** Trophy / elo delta to attribute when aggregating brawler or map stats. */
function statDelta(b: Battle, rankedOnly: boolean): number {
  if (rankedOnly) return b.trophyChange ?? 0;
  return b.isRanked ? 0 : (b.trophyChange ?? 0);
}

function isWin(b: Pick<Battle, "result">) {
  return b.result === "victory";
}

function isLoss(b: Pick<Battle, "result">) {
  return b.result === "defeat";
}

export function summarize(
  battles: Battle[],
  opts: { onlyRanked?: boolean } = {},
): SeasonSummary {
  const filtered = opts.onlyRanked === false ? battles : battles.filter((b) => b.isRanked);
  const sortedAsc = [...filtered].sort(
    (a, b) => a.battleTime.getTime() - b.battleTime.getTime(),
  );

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let trophyTotal = 0;
  let peak: number | null = null;
  let startRating: number | null = null;
  let currentRating: number | null = null;

  for (const b of sortedAsc) {
    if (isWin(b)) wins++;
    else if (isLoss(b)) losses++;
    else draws++;
    const delta =
      opts.onlyRanked === false && b.isRanked
        ? 0
        : (b.trophyChange ?? 0);
    trophyTotal += delta;
    if (b.ratingAfter != null) {
      peak = peak == null ? b.ratingAfter : Math.max(peak, b.ratingAfter);
      currentRating = b.ratingAfter;
    }
    if (startRating == null && b.ratingBefore != null) {
      startRating = b.ratingBefore;
    }
  }

  // Streak from most-recent backwards
  const sortedDesc = [...sortedAsc].reverse();
  let streak: Streak = { type: "none", length: 0 };
  if (sortedDesc[0]) {
    const first = sortedDesc[0];
    if (isWin(first) || isLoss(first)) {
      const type: "win" | "loss" = isWin(first) ? "win" : "loss";
      let length = 0;
      for (const b of sortedDesc) {
        const matches = type === "win" ? isWin(b) : isLoss(b);
        if (matches) length++;
        else break;
      }
      streak = { type, length };
    }
  }

  const totalGames = wins + losses + draws;
  const decided = wins + losses;
  return {
    totalGames,
    wins,
    losses,
    draws,
    winRate: decided === 0 ? 0 : wins / decided,
    avgTrophyChange: totalGames === 0 ? 0 : trophyTotal / totalGames,
    netChange: trophyTotal,
    currentRating,
    peakRating: peak,
    startRating,
    streak,
  };
}

/**
 * Per-brawler record. Defaults to Ranked queue only; pass `{ rankedOnly: false }`
 * for every captured game mode (ladder, Showdown, Ranked, etc.).
 */
export function brawlerStats(
  battles: Battle[],
  opts: { rankedOnly?: boolean; playerTag?: string } = {},
): BrawlerStat[] {
  const rankedOnly = opts.rankedOnly ?? true;
  const playerTag = opts.playerTag;
  const map = new Map<number, BrawlerStat>();
  // Walk oldest → newest so `brawlerName` ends on the latest battlelog
  // string for each id (DB order is typically newest-first).
  const chron = [...battles].sort(
    (a, b) => a.battleTime.getTime() - b.battleTime.getTime(),
  );
  for (const b of chron) {
    if (rankedOnly && !b.isRanked) continue;
    const { brawlerId: id, brawlerName } = brawlerIdentityFromStoredBattle(
      b,
      playerTag,
    );
    const cur =
      map.get(id) ??
      ({
        brawlerId: id,
        brawlerName,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        avgTrophyChange: 0,
        netChange: 0,
      } as BrawlerStat);
    cur.games++;
    if (isWin(b)) cur.wins++;
    else if (isLoss(b)) cur.losses++;
    else cur.draws++;
    cur.netChange += statDelta(b, rankedOnly);
    cur.brawlerName = brawlerName || cur.brawlerName;
    map.set(id, cur);
  }
  const out = Array.from(map.values());
  for (const s of out) {
    const decided = s.wins + s.losses;
    s.winRate = decided === 0 ? 0 : s.wins / decided;
    s.avgTrophyChange = s.games === 0 ? 0 : s.netChange / s.games;
  }
  return out;
}

export function mapStats(
  battles: Battle[],
  opts: { rankedOnly?: boolean } = {},
): MapStat[] {
  const rankedOnly = opts.rankedOnly ?? true;
  const map = new Map<string, MapStat>();
  for (const b of battles) {
    if (rankedOnly && !b.isRanked) continue;
    const key = `${b.map}__${b.mode}`;
    const cur =
      map.get(key) ??
      ({
        map: b.map,
        mode: b.mode,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        avgTrophyChange: 0,
      } as MapStat);
    cur.games++;
    if (isWin(b)) cur.wins++;
    else if (isLoss(b)) cur.losses++;
    else cur.draws++;
    cur.avgTrophyChange += statDelta(b, rankedOnly);
    map.set(key, cur);
  }
  const out = Array.from(map.values());
  for (const s of out) {
    const decided = s.wins + s.losses;
    s.winRate = decided === 0 ? 0 : s.wins / decided;
    s.avgTrophyChange = s.games === 0 ? 0 : s.avgTrophyChange / s.games;
  }
  return out;
}

/** Win rates and trophy deltas grouped by game mode only. */
export function modeStats(
  battles: Battle[],
  opts: { rankedOnly?: boolean } = {},
): ModeStat[] {
  const rankedOnly = opts.rankedOnly ?? true;
  const map = new Map<string, ModeStat>();
  for (const b of battles) {
    if (rankedOnly && !b.isRanked) continue;
    const mode = b.mode || "unknown";
    const cur =
      map.get(mode) ??
      ({
        mode,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        avgTrophyChange: 0,
      } as ModeStat);
    cur.games++;
    if (isWin(b)) cur.wins++;
    else if (isLoss(b)) cur.losses++;
    else cur.draws++;
    cur.avgTrophyChange += statDelta(b, rankedOnly);
    map.set(mode, cur);
  }
  const out = Array.from(map.values());
  for (const s of out) {
    const decided = s.wins + s.losses;
    s.winRate = decided === 0 ? 0 : s.wins / decided;
    s.avgTrophyChange = s.games === 0 ? 0 : s.avgTrophyChange / s.games;
  }
  return out;
}

export type SeasonFilter = "current" | "all" | (string & {});

export function filterBySeason(battles: Battle[], season: SeasonFilter): Battle[] {
  if (season === "all") return battles;
  if (season === "current") {
    const s = currentSeason();
    return battles.filter((b) => b.season === s.id);
  }
  return battles.filter((b) => b.season === season);
}

export function ratingHistory(battles: Battle[]): Array<{
  battleTime: string;
  ratingAfter: number;
  result: string;
  brawlerName: string;
  trophyChange: number;
}> {
  return battles
    .filter((b) => b.isRanked && b.ratingAfter != null)
    .sort((a, b) => a.battleTime.getTime() - b.battleTime.getTime())
    .map((b) => ({
      battleTime: b.battleTime.toISOString(),
      ratingAfter: b.ratingAfter as number,
      result: b.result,
      brawlerName: b.brawlerName,
      trophyChange: b.trophyChange ?? 0,
    }));
}

/** Point series for the Profile tab trophy chart (Y = account-wide trophies). */
export type TrophyChartPoint = {
  battleId: string;
  battleTime: string;
  /** Total account trophies after this battle (reconstructed from deltas + API snapshot). */
  value: number;
  result: string;
  brawlerName: string;
  trophyChange: number;
};

/**
 * Read the player's brawler trophy count as reported in the battlelog
 * payload (after that match).
 */
export function brawlerTrophiesAfterBattle(
  battle: Battle,
  playerTag: string,
): number | null {
  // Ranked-queue logs attach a dummy low trophy count per brawler (often 16),
  // not ladder trophies — hide instead of showing misleading numbers.
  if (battle.isRanked) return null;
  if (!battle.raw) return null;
  const tag = normalizeTag(playerTag);
  try {
    const entry = JSON.parse(battle.raw) as ApiBattleEntry;
    const found = findPlayerInBattle(entry, tag);
    return found?.brawler.trophies ?? null;
  } catch {
    return null;
  }
}

/**
 * Newest **ladder** battlelog trophy count per brawler (walks battles newest-first).
 * Ranked rounds omit real trophies in the payload — those rows are skipped until an
 * older ladder match supplies `brawler.trophies`, so Analytics isn’t stuck on “—”.
 */
export function latestBrawlerTrophies(
  battles: Battle[],
  playerTag: string,
): Map<number, { trophies: number | null; name: string }> {
  const sorted = [...battles].sort(
    (a, b) => b.battleTime.getTime() - a.battleTime.getTime(),
  );
  const out = new Map<number, { trophies: number | null; name: string }>();
  for (const b of sorted) {
    const { brawlerId, brawlerName } = brawlerIdentityFromStoredBattle(
      b,
      playerTag,
    );
    if (out.has(brawlerId)) continue;
    const trophies = brawlerTrophiesAfterBattle(b, playerTag);
    if (trophies == null) continue;
    out.set(brawlerId, { trophies, name: brawlerName });
  }
  return out;
}

/**
 * Reconstruct account-wide trophy total after each battle. Only one
 * brawler's trophies change per match, so the account sum moves by exactly
 * `trophyChange` (0 when the API omits it, e.g. some friendlies / ranked).
 *
 * `trophiesAfterNewestBattle` should match `Player.trophies` from the API —
 * the snapshot after the chronologically newest row in `allBattles` (or as
 * close as the last poll allows). We walk newest → oldest subtracting each
 * delta, then return points in chronological order.
 */
export function accountTrophySeries(
  allBattles: Battle[],
  trophiesAfterNewestBattle: number,
): TrophyChartPoint[] {
  const sorted = [...allBattles].sort(
    (a, b) => a.battleTime.getTime() - b.battleTime.getTime(),
  );
  if (sorted.length === 0) return [];

  const n = sorted.length;
  const rev: TrophyChartPoint[] = [];
  let v = trophiesAfterNewestBattle;

  for (let i = n - 1; i >= 0; i--) {
    const b = sorted[i];
    const ladderDelta = b.isRanked ? 0 : (b.trophyChange ?? 0);
    rev.push({
      battleId: b.id,
      battleTime: b.battleTime.toISOString(),
      value: Math.max(0, v),
      result: b.result,
      brawlerName: b.brawlerName,
      trophyChange: ladderDelta,
    });
    v -= ladderDelta;
  }
  return rev.reverse();
}

/**
 * Filter a precomputed {@link accountTrophySeries} to a battle subset
 * (e.g. season slice) while keeping correct Y values from the full run.
 */
export function filterTrophySeries(
  series: TrophyChartPoint[],
  battles: Battle[],
): TrophyChartPoint[] {
  const id = new Set(battles.map((b) => b.id));
  return series.filter((p) => id.has(p.battleId));
}
