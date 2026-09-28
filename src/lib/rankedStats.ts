/**
 * Aggregations specific to the Ranked dashboard.
 *
 * Uses saved absolute Ranked rating snapshots and the logging baseline.
 * The live profile rating must never replace an older saved match rating.
 * Per-battle Ranked rating changes are usually absent from the API.
 */

import type { Battle } from "@prisma/client";
import { brawlerIdentityFromStoredBattle } from "./brawlstars";
import { currentSeason, seasonForDate } from "./seasons";
import {
  clusterRankedIntoMatches,
  inferSeriesOutcome,
  isRankedFt2Complete,
  sortBattlesAsc,
} from "./rankedSessions";

/** Piecewise integer split that sums exactly to {@link totalDelta} (spread across clusters or rounds). */
function splitIntoIntegerChunks(totalDelta: number, chunks: number): number[] {
  if (chunks <= 0) return [];
  const out: number[] = [];
  let accumulated = 0;
  for (let i = 1; i < chunks; i++) {
    const nextRounded = Math.round((totalDelta * i) / chunks);
    const part = nextRounded - accumulated;
    out.push(part);
    accumulated += part;
  }
  out.push(totalDelta - accumulated);
  return out;
}

/**
 * Per-round elo after each battle — linear drift from elo before cluster to elo after FT2 terminal.
 */
function spreadEloAcrossRounds(
  chron: Battle[],
  eloEnteringCluster: number,
  eloAfterLastRoundOfCluster: number,
): number[] {
  const n = chron.length;
  if (n === 0) return [];
  const parts = splitIntoIntegerChunks(
    eloAfterLastRoundOfCluster - eloEnteringCluster,
    n,
  );
  let carry = eloEnteringCluster;
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    carry += parts[i]!;
    vals.push(carry);
  }
  return vals;
}

/** Apportion unrated pooled movement across FT2-complete outings — wins ↑, losses ↓, totals match `scaledTotal`. */
function allocateCompleteMatchNetDeltas(
  clusters: Battle[][],
  scaledTotal: number,
): Map<number, number> {
  const out = new Map<number, number>();
  const ordered: Array<{
    ci: number;
    oc: ReturnType<typeof inferSeriesOutcome>;
  }> = [];

  for (let ci = 0; ci < clusters.length; ci++) {
    const chron = sortBattlesAsc(clusters[ci]!);
    if (!isRankedFt2Complete(chron)) continue;
    ordered.push({ ci, oc: inferSeriesOutcome(chron) });
  }

  if (ordered.length === 0) return out;

  if (scaledTotal === 0) {
    ordered.forEach((o) => out.set(o.ci, 0));
    return out;
  }

  const wins = ordered.filter((x) => x.oc === "victory").length;
  const losses = ordered.filter((x) => x.oc === "defeat").length;
  const imb = wins - losses;

  if (imb !== 0) {
    const k = Math.trunc(scaledTotal / imb);
    let leftover = scaledTotal - k * imb;
    const deltas = ordered.map(({ oc }) =>
      oc === "victory" ? k : oc === "defeat" ? -k : 0,
    );

    while (leftover !== 0) {
      let moved = false;
      if (leftover > 0) {
        for (let i = 0; i < deltas.length && leftover > 0; i++) {
          const oc = ordered[i]!.oc;
          if (oc !== "draw") {
            deltas[i] += oc === "victory" ? 1 : 1;
            leftover--;
            moved = true;
          }
        }
      } else {
        for (let i = 0; i < deltas.length && leftover < 0; i++) {
          const oc = ordered[i]!.oc;
          if (oc !== "draw") {
            deltas[i] += oc === "victory" ? -1 : -1;
            leftover++;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    ordered.forEach((o, idx) => out.set(o.ci, deltas[idx]!));
    return out;
  }

  /** Win/loss counts cancel (Σ sign = 0) — chronological round-robin, not raw chunk indexing. */
  const deltas = new Map<number, number>();
  ordered.forEach((o) => deltas.set(o.ci, 0));

  let remainder = scaledTotal;

  /** One full pass over completions; allocates at most ±1 toward each decisive row when possible. */
  const sweepRemainderTowardOutcome = (): boolean => {
    let moved = false;
    const wantPositive = remainder > 0;
    const wantNegative = remainder < 0;

    if (wantPositive) {
      for (const { ci, oc } of ordered) {
        if (remainder === 0) break;
        if (oc !== "victory") continue;
        deltas.set(ci, (deltas.get(ci) ?? 0) + 1);
        remainder--;
        moved = true;
      }
    }
    if (wantNegative) {
      for (const { ci, oc } of ordered) {
        if (remainder === 0) break;
        if (oc !== "defeat") continue;
        deltas.set(ci, (deltas.get(ci) ?? 0) - 1);
        remainder++;
        moved = true;
      }
    }

    return moved;
  };

  /** After primary sweeps — opposite-sign rows so totals can still converge. */
  const sweepRemainderOpposite = (): boolean => {
    let moved = false;
    const wantPositive = remainder > 0;
    const wantNegative = remainder < 0;

    if (wantPositive) {
      for (const { ci, oc } of ordered) {
        if (remainder === 0) break;
        if (oc !== "defeat") continue;
        deltas.set(ci, (deltas.get(ci) ?? 0) + 1);
        remainder--;
        moved = true;
      }
    }
    if (wantNegative) {
      for (const { ci, oc } of ordered) {
        if (remainder === 0) break;
        if (oc !== "victory") continue;
        deltas.set(ci, (deltas.get(ci) ?? 0) - 1);
        remainder++;
        moved = true;
      }
    }

    return moved;
  };

  const sweepRemainderTowardDraw = (): boolean => {
    let moved = false;
    if (remainder > 0) {
      for (const { ci, oc } of ordered) {
        if (remainder === 0) break;
        if (oc !== "draw") continue;
        deltas.set(ci, (deltas.get(ci) ?? 0) + 1);
        remainder--;
        moved = true;
      }
    } else if (remainder < 0) {
      for (const { ci, oc } of ordered) {
        if (remainder === 0) break;
        if (oc !== "draw") continue;
        deltas.set(ci, (deltas.get(ci) ?? 0) - 1);
        remainder++;
        moved = true;
      }
    }

    return moved;
  };

  let guard = 0;
  while (remainder !== 0 && guard++ < 250_000) {
    const moved =
      sweepRemainderTowardOutcome() ||
      sweepRemainderOpposite() ||
      sweepRemainderTowardDraw();
    if (!moved) break;
  }

  if (remainder !== 0) {
    const parts = splitIntoIntegerChunks(remainder, ordered.length);
    ordered.forEach((o, idx) =>
      deltas.set(o.ci, (deltas.get(o.ci) ?? 0) + parts[idx]!),
    );
    remainder = 0;
  }

  ordered.forEach((o) => out.set(o.ci, deltas.get(o.ci) ?? 0));
  return out;
}

/** True when trophy deltas can reconstruct per-round elo (rare but valid for Ranked payloads). */
function clusterHasTrustedTrophyLadder(chain: Battle[]): boolean {
  return chain.some((r) => r.trophyChange !== 0);
}

function resolvedRatingsFromClusters(
  clusters: Battle[][],
  poolSortedAsc: Battle[],
  eloBeforeFirstBattleInPool: number,
  liveElo: number | null,
): Map<string, number> {
  const resolvedRatingByBattleId = new Map<string, number>();

  let matchDeltaByClusterIndex: Map<number, number> | null = null;

  const lastCi = clusters.length - 1;
  const tailCluster = lastCi >= 0 ? sortBattlesAsc(clusters[lastCi]!) : [];
  const tailIncomplete =
    tailCluster.length > 0 && !isRankedFt2Complete(tailCluster);

  if (liveElo != null) {
    let completeMatchCount = 0;
    for (const cluster of clusters) {
      const ch = sortBattlesAsc(cluster);
      if (isRankedFt2Complete(ch)) completeMatchCount++;
    }

    const totalDeltaPool = liveElo - eloBeforeFirstBattleInPool;

    let scaledTotal = totalDeltaPool;
    if (tailIncomplete && completeMatchCount > 0) {
      scaledTotal = Math.round(
        totalDeltaPool * (completeMatchCount / (completeMatchCount + 1)),
      );
    }

    matchDeltaByClusterIndex = allocateCompleteMatchNetDeltas(
      clusters,
      scaledTotal,
    );
  }

  for (let ci = 0; ci < clusters.length; ci++) {
    const chron = sortBattlesAsc(clusters[ci]!);
    const first = chron[0]!;
    const idx = poolSortedAsc.findIndex((b) => b.id === first.id);
    const seedBeforeCluster =
      idx > 0
        ? resolvedRatingByBattleId.get(poolSortedAsc[idx - 1]!.id)!
        : eloBeforeFirstBattleInPool;

    const unstampedRankedPreview =
      liveElo != null &&
      isRankedFt2Complete(chron) &&
      chron.every((r) => r.ratingAfter == null) &&
      !clusterHasTrustedTrophyLadder(chron);

    const eloOverride =
      unstampedRankedPreview && matchDeltaByClusterIndex !== null
        ? seedBeforeCluster + (matchDeltaByClusterIndex.get(ci) ?? 0)
        : null;

    const vals = resolveRankedClusterRoundRatings(
      chron,
      seedBeforeCluster,
      ci === clusters.length - 1,
      liveElo,
      eloOverride,
    );

    for (let j = 0; j < chron.length; j++) {
      resolvedRatingByBattleId.set(chron[j]!.id, vals[j]!);
    }
  }

  return resolvedRatingByBattleId;
}

/**
 * Per-round elo inside one FT2 cluster — no cross-match forward fill.
 * Uses `liveElo` for the newest round only when its saved snapshot is missing.
 *
 * `eloBeforeFirstRound` seeds forward-fill for unknown rows **before** the first snapshot in this cluster;
 * it must be the player’s rated elo immediately before {@link chron}[0], not their **current** profile elo.
 */
function resolveRankedClusterRoundRatings(
  chron: Battle[],
  eloBeforeFirstRound: number,
  anchorTerminalWithLiveElo: boolean,
  liveElo: number | null,
  /** When set (and no per-row anchors), interpolate each round toward this outing end elo. */
  eloAfterTerminalOverride: number | null,
): number[] {
  const n = chron.length;
  if (n === 0) return [];

  const vals = chron.map((r) =>
    r.ratingAfter != null ? r.ratingAfter : Number.NaN,
  );

  if (
    eloAfterTerminalOverride != null &&
    chron.every((r) => r.ratingAfter == null)
  ) {
    const end = eloAfterTerminalOverride;
    const start = eloBeforeFirstRound;
    return spreadEloAcrossRounds(chron, start, end);
  }

  if (anchorTerminalWithLiveElo && liveElo != null && Number.isNaN(vals[n - 1])) {
    vals[n - 1] = liveElo;
  }

  for (let i = n - 2; i >= 0; i--) {
    if (!Number.isNaN(vals[i])) continue;
    const tcNext = chron[i + 1]!.trophyChange ?? 0;
    const afterNext = vals[i + 1];
    if (!Number.isNaN(afterNext)) {
      vals[i] = afterNext - tcNext;
    }
  }

  let lk = eloBeforeFirstRound;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(vals[i])) lk = vals[i];
    else vals[i] = lk;
  }
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(vals[i])) vals[i] = eloBeforeFirstRound;
  }

  return vals;
}

/** Resolved rated elo immediately before `firstRoundOfCluster` begins (previous battle in pool or pool anchor). */
function eloImmediatelyBeforeCluster(
  poolSortedAsc: Battle[],
  resolvedRatingByBattleId: Map<string, number>,
  eloAnchor: number,
  firstRoundOfCluster: Battle,
): number {
  const idx = poolSortedAsc.findIndex((b) => b.id === firstRoundOfCluster.id);
  if (idx <= 0) return eloAnchor;
  return resolvedRatingByBattleId.get(poolSortedAsc[idx - 1]!.id)!;
}

export type RankedRoundRatedOpts = {
  seedRating: number;
  liveElo: number | null;
  priorRatedAfter: number | null;
  /**
   * `player.rankedBaseline` — rated elo when ranked logging began (before your first stored ranked row).
   * Required when there is no older ranked battle in DB so the first outing shows e.g. −74 vs 6000.
   */
  loggingStartRatedElo?: number | null;
};

export function ratedAnchorBeforePool(opts: RankedRoundRatedOpts): number {
  const prior = opts.priorRatedAfter;
  const baseline = opts.loggingStartRatedElo ?? null;
  const seed = opts.seedRating ?? 0;
  return prior ?? baseline ?? seed;
}

/** Only consider ratings from the already-filtered logging window. */
export function priorRatedAfterInWindow(battles: Battle[], before?: Date): number | null {
  if (!before) return null;
  return battles
    .filter((battle) => battle.isRanked && battle.ratingAfter != null && battle.battleTime < before)
    .sort((a, b) => b.battleTime.getTime() - a.battleTime.getTime())[0]?.ratingAfter ?? null;
}

/**
 * Rated elo Δ per ranked outing, keyed by the terminal battle id only.
 *
 * Δ = resolved elo after that outing’s last stored round minus resolved elo immediately before its **first**
 * round (previous battle in the pool or the rated anchor). Using “previous finished game” instead wrongly lumps
 * skipped / unfinished streaks into the next outing’s Δ.
 */
export function rankedRoundRatedDeltaByBattleId(
  rankedPoolAsc: Battle[],
  opts: RankedRoundRatedOpts,
): Map<string, number | null> {
  if (rankedPoolAsc.length === 0) return new Map();
  const clusters = clusterRankedIntoMatches(rankedPoolAsc);

  const anchorBeforePool = ratedAnchorBeforePool(opts);

  const resolved = resolvedRatingsFromClusters(
    clusters,
    rankedPoolAsc,
    anchorBeforePool,
    opts.liveElo,
  );

  const out = new Map<string, number | null>();

  for (const cluster of clusters) {
    const chron = sortBattlesAsc(cluster);
    const terminal = chron[chron.length - 1]!;
    const termR = resolved.get(terminal.id)!;
    const eloBefore = eloImmediatelyBeforeCluster(
      rankedPoolAsc,
      resolved,
      anchorBeforePool,
      chron[0]!,
    );
    out.set(terminal.id, termR - eloBefore);
  }

  return out;
}

/** One row per finished Ranked FT2 game for the log (not per round). */
export type RankedMatchLogRow = {
  id: string;
  battleTime: string;
  outcome: "victory" | "defeat" | "draw";
  eloDelta: number;
  eloAfter: number;
};

export function buildRankedMatchLogRows(
  rankedPoolAsc: Battle[],
  opts: RankedRoundRatedOpts,
): RankedMatchLogRow[] {
  if (rankedPoolAsc.length === 0) return [];
  const clusters = clusterRankedIntoMatches(rankedPoolAsc);
  const anchorBeforePool = ratedAnchorBeforePool(opts);
  const resolved = resolvedRatingsFromClusters(
    clusters,
    rankedPoolAsc,
    anchorBeforePool,
    opts.liveElo,
  );

  const rows: RankedMatchLogRow[] = [];

  for (const cluster of clusters) {
    const chron = sortBattlesAsc(cluster);
    if (!isRankedFt2Complete(chron)) continue;

    const firstRound = chron[0]!;
    const terminal = chron[chron.length - 1]!;
    const eloAfter = resolved.get(terminal.id)!;
    const eloBefore = eloImmediatelyBeforeCluster(
      rankedPoolAsc,
      resolved,
      anchorBeforePool,
      firstRound,
    );
    rows.push({
      id: terminal.id,
      battleTime: terminal.battleTime.toISOString(),
      outcome: inferSeriesOutcome(chron),
      eloDelta: eloAfter - eloBefore,
      eloAfter,
    });
  }

  return rows;
}

export type RankedRatingPoint = {
  battleTime: string;
  /** Rated elo after this FT2 ends (terminal round — profile alignment). */
  ratingAfter: number;
  /** Highest resolved elo reached on any round of this outing (tooltip vs {@link ratingAfter}). */
  peakRatingDuringMatch: number;
  /** Peak within outing minus elo immediately before this outing’s first round. */
  ratedMatchSwing: number;
  trophyChange: number;
  result: string;
  brawlerName: string;
  brawlerId: number;
};

export type RankedSummary = {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  netChange: number;
  /** Rating at the most recent ranked battle, or the baseline if none. */
  currentRating: number;
  /** Highest rating seen since baseline; falls back to the baseline. */
  peakRating: number;
  /** Last 10 **match** outcomes (oldest → newest). */
  recentForm: Array<"victory" | "defeat" | "draw">;
  /** Most recent winning or losing streak. */
  streak: { type: "win" | "loss" | "none"; length: number };
  /** Star-player outings / total outings (any star round in the match counts once). */
  starPlayerRate: number;
  /** Matches where star player fell on some round inside the outing. */
  starPlayerCount: number;
  /** Largest single ranked battle delta over the period (positive). */
  bestDelta: number;
  /** Largest single ranked battle delta over the period (negative). */
  worstDelta: number;
};

export type RankedBrawlerRow = {
  brawlerId: number;
  brawlerName: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  netChange: number;
  avgChange: number;
  starPlayerCount: number;
};

export type RankedDataset = {
  hasBaseline: boolean;
  baseline: number | null;
  baselineAt: string | null;
  summary: RankedSummary;
  rating: RankedRatingPoint[];
  brawlers: RankedBrawlerRow[];
  /** Source battles fed into the aggregation, post-filtering. */
  battles: Battle[];
};

/**
 * Ranked battles used by {@link buildRanked}, sorted ascending — **must** be the same input as
 * {@link buildRankedMatchLogRows} so the chart and battle log stay aligned (baseline trim when
 * `liveElo` is absent, season filter, etc.).
 */
export function rankedBattlesPoolAsc(args: {
  battles: Battle[];
  liveElo?: number | null;
  baselineAt?: Date | null;
  season?: string;
}): Battle[] {
  const { battles, liveElo, baselineAt, season } = args;
  let pool = battles
    .filter((b) => b.isRanked)
    .slice()
    .sort((a, b) => a.battleTime.getTime() - b.battleTime.getTime());

  if (liveElo == null && baselineAt) {
    pool = pool.filter((b) => b.battleTime >= baselineAt);
  }

  if (season && season !== "all") {
    if (season === "current") {
      const id = currentSeason().id;
      pool = pool.filter((b) => b.season === id);
    } else {
      pool = pool.filter((b) => b.season === season);
    }
  }

  return pool;
}

/**
 * Build the ranked dataset for a player.
 *
 * Each ranked battle row carries a `ratingAfter` snapshot stamped at
 * insertion time (the player's absolute `rankedElo` as of that poll —
 * see `src/lib/poll.ts`). We surface those snapshots directly: it's the
 * only authoritative ranked-rating source the API gives us, since
 * per-battle `trophyChange` is not populated for `soloRanked` /
 * `teamRanked` matches.
 *
 * Win rate and record use terminal rounds only. The rating chart plots **one point per completed ranked
 * game** (finished FT2 outing) at that game’s end time only — incomplete round streaks are omitted — plus an optional **Ranked start** dot when
 * `prependRatedStartPoint` is true (rated elo when logging began, e.g. 6000).
 * Pass `ratedAnchorBeforePool` so resolution matches the battle log (prior terminal, baseline, or seed).
 * {@link RankedRatingPoint.ratingAfter} is terminal resolved elo after each completed game.
 */
export function buildRanked(args: {
  battles: Battle[];
  /** Player's absolute current rating from the BS API, if known. */
  liveElo?: number | null;
  /** Ranked elo anchor: legacy baseline and/or the snapshot saved when ranked logging started. */
  baseline?: number | null;
  /** When ranked logging began (or legacy baseline moment) — enables the leading chart point. */
  baselineAt?: Date | null;
  /** "current" | "all" | "<seasonId>" */
  season?: string;
  starPlayerTagByBattleId?: Map<string, string | null>;
  playerTag?: string;
  /**
   * Rated elo immediately before the first battle in the filtered pool — same seed as
   * {@link rankedRoundRatedDeltaByBattleId} / {@link buildRankedMatchLogRows}. Defaults to `baseline ?? liveElo ?? 0`.
   */
  ratedAnchorBeforePool?: number | null;
  /**
   * Prepend the **Ranked start** chart point at `baseline`. Set `false` when older ranked rows exist
   * before the pool (`priorRatedAfter`). Default: `baseline != null && baselineAt != null`.
   */
  prependRatedStartPoint?: boolean | null;
}): RankedDataset {
  const { battles, liveElo, baseline, baselineAt, season } = args;
  const starMap = args.starPlayerTagByBattleId ?? new Map();
  const ownTag = (args.playerTag ?? "").toUpperCase();

  const pool = rankedBattlesPoolAsc({
    battles,
    liveElo,
    baselineAt,
    season,
  });

  const clusters = clusterRankedIntoMatches(pool);

  const completeClusters = clusters.filter((c) =>
    isRankedFt2Complete(sortBattlesAsc(c)),
  );

  const eloAnchor =
    typeof args.ratedAnchorBeforePool === "number"
      ? args.ratedAnchorBeforePool
      : baseline ?? liveElo ?? 0;

  const shouldPrependStart =
    args.prependRatedStartPoint !== undefined &&
    args.prependRatedStartPoint !== null
      ? args.prependRatedStartPoint
      : baseline != null && baselineAt != null;

  const resolvedRatingByBattleId = resolvedRatingsFromClusters(
    clusters,
    pool,
    eloAnchor,
    liveElo ?? null,
  );

  const rating: RankedRatingPoint[] = [];

  for (let ci = 0; ci < clusters.length; ci++) {
    const chron = sortBattlesAsc(clusters[ci]!);
    if (!isRankedFt2Complete(chron)) continue;

    const vals = chron.map((r) => resolvedRatingByBattleId.get(r.id)!);

    const lastRound = chron[chron.length - 1]!;
    const terminal = vals[vals.length - 1]!;
    const peakInMatch = vals.reduce((m, v) => Math.max(m, v), eloAnchor);

    const firstRound = chron[0]!;
    const eloBeforeMatch = eloImmediatelyBeforeCluster(
      pool,
      resolvedRatingByBattleId,
      eloAnchor,
      firstRound,
    );
    const ratedMatchSwing = peakInMatch - eloBeforeMatch;

    const ident = brawlerIdentityFromStoredBattle(lastRound, args.playerTag);
    rating.push({
      battleTime: lastRound.battleTime.toISOString(),
      ratingAfter: terminal,
      peakRatingDuringMatch: peakInMatch,
      ratedMatchSwing,
      trophyChange: terminal - eloBeforeMatch,
      result: inferSeriesOutcome(chron),
      brawlerName: ident.brawlerName,
      brawlerId: ident.brawlerId,
    });
  }

  if (
    shouldPrependStart &&
    baseline != null &&
    baselineAt != null &&
    (!season || season === "all" || seasonForDate(baselineAt).id === (season === "current" ? currentSeason().id : season))
  ) {
    const firstT = pool[0]?.battleTime.getTime();
    const anchorMs = firstT == null ? baselineAt.getTime() : Math.min(baselineAt.getTime(), firstT - 1000);
    rating.unshift({
      battleTime: new Date(anchorMs).toISOString(),
      ratingAfter: baseline,
      peakRatingDuringMatch: baseline,
      ratedMatchSwing: 0,
      trophyChange: 0,
      result: "draw",
      brawlerName: "Ranked start",
      brawlerId: 0,
    });
  }

  let netChangeFromSeries = 0;
  let bestDelta = 0;
  let worstDelta = 0;
  for (const pt of rating) {
    netChangeFromSeries += pt.trophyChange;
    if (pt.brawlerName === "Ranked start") continue;
    if (pt.trophyChange > bestDelta) bestDelta = pt.trophyChange;
    if (pt.trophyChange < worstDelta) worstDelta = pt.trophyChange;
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let starSeriesCount = 0;

  for (const cluster of completeClusters) {
    const chron = sortBattlesAsc(cluster);
    const o = inferSeriesOutcome(chron);
    if (o === "victory") wins++;
    else if (o === "defeat") losses++;
    else draws++;

    const anyStarRound = chron.some((round) => {
      const tag = starMap.get(round.id);
      return Boolean(ownTag && tag && tag.toUpperCase() === ownTag);
    });
    if (anyStarRound) starSeriesCount++;
  }

  let peak = eloAnchor;
  for (const pt of rating) {
    peak = Math.max(peak, pt.ratingAfter, pt.peakRatingDuringMatch);
  }

  const tailComplete = completeClusters.slice(-10);
  const recentForm = tailComplete.map((c) =>
    inferSeriesOutcome(sortBattlesAsc(c)),
  );

  let streak: RankedSummary["streak"] = { type: "none", length: 0 };
  if (completeClusters.length > 0) {
    const lastOutcome = inferSeriesOutcome(
      sortBattlesAsc(completeClusters[completeClusters.length - 1]!),
    );
    if (lastOutcome === "victory" || lastOutcome === "defeat") {
      const want = lastOutcome;
      let length = 0;
      for (let idx = completeClusters.length - 1; idx >= 0; idx--) {
        const oc = inferSeriesOutcome(sortBattlesAsc(completeClusters[idx]!));
        if (oc === want) length++;
        else break;
      }
      streak = {
        type: want === "victory" ? "win" : "loss",
        length,
      };
    }
  }

  const decided = wins + losses;
  let currentRating = liveElo ?? eloAnchor;
  if (liveElo == null && pool.length > 0) {
    const tailBattle = pool[pool.length - 1]!;
    currentRating = resolvedRatingByBattleId.get(tailBattle.id)!;
  }

  const summary: RankedSummary = {
    totalGames: completeClusters.length,
    wins,
    losses,
    draws,
    winRate: decided === 0 ? 0 : wins / decided,
    netChange: netChangeFromSeries,
    currentRating,
    peakRating: peak,
    recentForm,
    streak,
    starPlayerRate:
      completeClusters.length === 0
        ? 0
        : starSeriesCount / completeClusters.length,
    starPlayerCount: starSeriesCount,
    bestDelta,
    worstDelta,
  };

  // Per-brawler: one row per **finished** ranked game only; elo Δ for that FT2 vs elo before its first round.
  const brawlerMap = new Map<number, RankedBrawlerRow>();
  for (let i = 0; i < clusters.length; i++) {
    const chron = sortBattlesAsc(clusters[i]!);
    if (!isRankedFt2Complete(chron)) continue;

    const firstRound = chron[0]!;
    const lastRound = chron[chron.length - 1]!;
    const { brawlerId, brawlerName } = brawlerIdentityFromStoredBattle(
      lastRound,
      args.playerTag,
    );
    const outcome = inferSeriesOutcome(chron);

    const ra = resolvedRatingByBattleId.get(lastRound.id);
    if (ra === undefined) continue;

    const eloBeforeMatch = eloImmediatelyBeforeCluster(
      pool,
      resolvedRatingByBattleId,
      eloAnchor,
      firstRound,
    );
    const eloDelta = ra - eloBeforeMatch;

    const cur =
      brawlerMap.get(brawlerId) ??
      ({
        brawlerId,
        brawlerName,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        netChange: 0,
        avgChange: 0,
        starPlayerCount: 0,
      } as RankedBrawlerRow);

    cur.games++;
    if (outcome === "victory") cur.wins++;
    else if (outcome === "defeat") cur.losses++;
    else cur.draws++;

    cur.netChange += eloDelta;

    const anyStarRound = chron.some((round) => {
      const tag = starMap.get(round.id);
      return Boolean(ownTag && tag && tag.toUpperCase() === ownTag);
    });
    if (anyStarRound) cur.starPlayerCount++;

    cur.brawlerName = brawlerName || cur.brawlerName;
    brawlerMap.set(brawlerId, cur);
  }
  const brawlers = Array.from(brawlerMap.values());
  for (const row of brawlers) {
    const decidedB = row.wins + row.losses;
    row.winRate = decidedB === 0 ? 0 : row.wins / decidedB;
    row.avgChange = row.games === 0 ? 0 : row.netChange / row.games;
  }
  brawlers.sort((a, b) => b.games - a.games);

  return {
    hasBaseline: liveElo != null || baseline != null,
    baseline: liveElo ?? baseline ?? null,
    baselineAt: baselineAt?.toISOString() ?? null,
    summary,
    rating,
    brawlers,
    battles: pool,
  };
}

/**
 * Pull the star-player tag (if any) out of each battle's `raw` payload
 * so callers don't repeat the JSON.parse boilerplate.
 */
export function extractStarPlayerTags(
  battles: Battle[],
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const b of battles) {
    let tag: string | null = null;
    if (b.raw) {
      try {
        const parsed = JSON.parse(b.raw) as {
          battle?: { starPlayer?: { tag?: string } };
        };
        tag = parsed.battle?.starPlayer?.tag ?? null;
      } catch {
        // Non-JSON or malformed — skip.
      }
    }
    out.set(b.id, tag);
  }
  return out;
}

/**
 * Format a season key like "2026-S62" into a friendly month/year range
 * like "MAY 2026". Falls back to the raw id if parsing fails.
 */
export function formatSeasonRange(seasonId: string): string {
  // Use the season helper to convert id → start date and produce "MMM YYYY".
  // We avoid importing seasonForDate(date) here to keep this module
  // dependency-light; instead we just parse the year out and let the
  // caller's chart axis handle finer granularity.
  const m = seasonId.match(/^(\d{4})-S(\d+)$/);
  if (!m) return seasonId;
  const year = m[1];
  return `S${m[2]} ${year}`;
}
