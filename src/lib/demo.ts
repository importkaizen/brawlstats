/**
 * Synthetic data for the landing-page preview and the standalone /demo
 * dashboard. Generated deterministically so the chart looks the same on
 * every render and across SSR.
 *
 * Brawler IDs MUST match Supercell's `/v1/brawlers` IDs — names alone are not
 * sequential (see docs). Wrong IDs produce correct labels but wrong CDN
 * portraits from Brawlify.
 */

import type { Battle } from "@prisma/client";
import type { OwnedBrawlerSnap } from "./playerRoster";
import type { ApiBattleEntry, BattlePlayer } from "./brawlstars";
import { normalizeTag } from "./tag";
import { seasonForDate } from "./seasons";

const DEMO_PLAYER_TAG = "#DEMO";

/** Canonical IDs from GET https://api.brawlstars.com/v1/brawlers */
const BRAWLERS = [
  { id: 16000000, name: "Shelly" },
  { id: 16000001, name: "Colt" },
  { id: 16000002, name: "Bull" },
  { id: 16000014, name: "Bo" },
  { id: 16000011, name: "Mortis" },
  { id: 16000028, name: "Sandy" },
  { id: 16000024, name: "Rosa" },
  { id: 16000061, name: "Gus" },
];

/** Demo-only roster ordering for the Profile tab (owns × shelly…gus subset). */
export function demoOwnedBrawlers(): OwnedBrawlerSnap[] {
  return BRAWLERS.map((b, i) => {
    const trophies = Math.max(
      0,
      Math.round(1_180 - i * 97 + (i === 3 ? 220 : 0)),
    );
    const highest = Math.max(trophies, trophies + Math.round(10 + i * 3));
    return {
      id: b.id,
      name: b.name,
      power: 11,
      rank: 40 + i * 7,
      trophies,
      highestTrophies: highest,
    };
  }).sort((a, b) => b.trophies - a.trophies);
}

const MAPS = [
  { map: "Hard Rock Mine", mode: "gemGrab" },
  { map: "Triple Dribble", mode: "brawlBall" },
  { map: "Center Stage", mode: "knockout" },
  { map: "Layer Cake", mode: "heist" },
  { map: "Out in the Open", mode: "bounty" },
];

/** Parsed from synthetic battle JSON for Recent Matches UI on /demo only. */
export type DemoRankedSeriesMeta = {
  id: string;
  round: number;
  total: number;
};

export function demoRankedSeriesFromRaw(
  raw: string | null | undefined,
): DemoRankedSeriesMeta | undefined {
  if (!raw) return undefined;
  try {
    const j = JSON.parse(raw) as { _demoRankedSeries?: DemoRankedSeriesMeta };
    const m = j._demoRankedSeries;
    if (
      m &&
      typeof m.id === "string" &&
      typeof m.round === "number" &&
      typeof m.total === "number"
    ) {
      return m;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function pseudoRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Competitive ranked elo swing per game (typical ~60–150, mean ~100). */
function rankedEloDelta(
  rand: () => number,
  result: "victory" | "defeat" | "draw",
): number {
  if (result === "draw") return 0;
  const mag = 60 + Math.floor(rand() * 91);
  return result === "victory" ? mag : -mag;
}

/**
 * First-to-two (race to 2 wins): series is exactly 2 or 3 rounds; never stops at 1–1.
 * `cap` is max rounds we may consume (caller ensures cap >= 2 or gets []).
 */
function ft2RoundResults(
  rand: () => number,
  remainingSlots: number,
): ("victory" | "defeat")[] {
  if (remainingSlots < 2) return [];

  let len: 2 | 3;
  if (remainingSlots === 2) len = 2;
  else if (remainingSlots === 3) len = 3;
  else {
    const canThree = remainingSlots - 3 !== 1;
    const canTwo = remainingSlots - 2 !== 1;
    const options: Array<2 | 3> = [];
    if (canTwo) options.push(2);
    if (canThree) options.push(3);
    len = options[Math.floor(rand() * options.length)]!;
  }

  const playerWinsSeries = rand() < 0.52;

  if (len === 2) {
    return playerWinsSeries
      ? ["victory", "victory"]
      : ["defeat", "defeat"];
  }

  if (playerWinsSeries) {
    return rand() < 0.5
      ? ["victory", "defeat", "victory"]
      : ["defeat", "victory", "victory"];
  }
  return rand() < 0.5
    ? ["victory", "defeat", "defeat"]
    : ["defeat", "victory", "defeat"];
}

function playerWonFt2Series(results: ("victory" | "defeat")[]): boolean {
  let w = 0;
  let l = 0;
  for (const r of results) {
    if (r === "victory") w++;
    else l++;
    if (w >= 2 || l >= 2) break;
  }
  return w >= 2;
}

/** Ladder / trophy-row deltas (small, unrelated to ranked elo). */
function ladderTrophyDelta(rand: () => number, result: string): number {
  if (result === "draw") return 0;
  const win = result === "victory";
  return win
    ? Math.round(4 + rand() * 6)
    : -Math.round(3 + rand() * 7);
}

function demoBattleRaw(opts: {
  mode: string;
  map: string;
  battleType: string;
  result: string;
  duration: number;
  brawler: { id: number; name: string; trophies: number };
  rankedSeries?: DemoRankedSeriesMeta;
}): string {
  const tag = normalizeTag(DEMO_PLAYER_TAG);
  const seed =
    opts.brawler.id * 131 + opts.mode.length * 17 + opts.map.length * 31;
  const ladderTrophy = (slot: number) =>
    180 + ((seed + slot * 499) % 820);

  const allies = BRAWLERS.filter((b) => b.id !== opts.brawler.id);
  const ally1 = allies[0]!;
  const ally2 = allies[Math.min(1, allies.length - 1)]!;

  const exclude = new Set([opts.brawler.id, ally1.id, ally2.id]);
  const pickOpp = (shift: number): (typeof BRAWLERS)[number] => {
    for (let i = 0; i < BRAWLERS.length; i++) {
      const b = BRAWLERS[(i + shift) % BRAWLERS.length]!;
      if (!exclude.has(b.id)) {
        exclude.add(b.id);
        return b;
      }
    }
    const b = BRAWLERS[shift % BRAWLERS.length]!;
    exclude.add(b.id);
    return b;
  };
  const o1 = pickOpp(2);
  const o2 = pickOpp(4);
  const o3 = pickOpp(6);

  const slot = (
    t: string,
    display: string,
    br: (typeof BRAWLERS)[number],
    trophies: number,
  ): BattlePlayer => ({
    tag: t,
    name: display,
    brawler: { id: br.id, name: br.name, power: 11, trophies },
  });

  const team0: BattlePlayer[] = [
    slot(tag, "Demo Account", opts.brawler, opts.brawler.trophies),
    slot("#PLY8Q2", "Canyon Ace", ally1, ladderTrophy(1)),
    slot("#RJ9GCP", "Skye Main", ally2, ladderTrophy(2)),
  ];

  const team1: BattlePlayer[] = [
    slot("#BOTN1", "Opponent Ace", o1, ladderTrophy(3)),
    slot("#BOTN2", "Rivals Co", o2, ladderTrophy(4)),
    slot("#BOTN3", "Lane Hold", o3, ladderTrophy(5)),
  ];

  const r = opts.result;
  const apiResult =
    r === "victory" || r === "defeat" || r === "draw" ? r : "draw";

  const starWhoWon = apiResult === "victory";
  const starPlayer = starWhoWon
    ? {
        tag,
        name: "Demo Account",
        brawler: { id: opts.brawler.id, name: opts.brawler.name },
      }
    : {
        tag: team1[0]!.tag,
        name: team1[0]!.name,
        brawler: { id: o1.id, name: o1.name },
      };

  const entry = {
    battleTime: "20260101T000000.000Z",
    event: { id: 0, mode: opts.mode, map: opts.map },
    battle: {
      mode: opts.mode,
      type: opts.battleType,
      result: apiResult,
      duration: opts.duration,
      starPlayer,
      teams: [team0, team1],
    },
    ...(opts.rankedSeries ? { _demoRankedSeries: opts.rankedSeries } : {}),
  } as ApiBattleEntry & { _demoRankedSeries?: DemoRankedSeriesMeta };
  return JSON.stringify(entry);
}

export type DemoPoint = {
  battleTime: string;
  ratingAfter: number;
  trophyChange: number;
  result: string;
  brawlerName: string;
  brawlerId: number;
};

const DEMO_RANKED_ANCHOR = 6042;

export function buildDemoData(seed = 42, count = 18) {
  const rand = pseudoRand(seed);
  const now = Date.now();
  type Step = {
    result: "victory" | "defeat";
    delta: number;
    brawler: (typeof BRAWLERS)[number];
    map: (typeof MAPS)[number];
    roundInSeries: number;
    seriesLen: number;
    seriesId: string;
  };
  const steps: Step[] = [];
  let previewSeriesSeq = 0;
  while (steps.length < count) {
    const remaining = count - steps.length;
    if (remaining < 2) break;
    const seriesResults = ft2RoundResults(rand, remaining);
    if (seriesResults.length === 0) break;
    const seriesWin = playerWonFt2Series(seriesResults);
    const finalDelta = rankedEloDelta(
      rand,
      seriesWin ? "victory" : "defeat",
    );
    const brawler = BRAWLERS[Math.floor(rand() * BRAWLERS.length)];
    const map = MAPS[Math.floor(rand() * MAPS.length)];
    const n = seriesResults.length;
    const seriesId = `preview-${previewSeriesSeq++}`;
    for (let i = 0; i < n; i++) {
      const isFinal = i === n - 1;
      steps.push({
        result: seriesResults[i],
        delta: isFinal ? finalDelta : 0,
        brawler,
        map,
        roundInSeries: i + 1,
        seriesLen: n,
        seriesId,
      });
    }
  }

  const sumD = steps.reduce((a, s) => a + s.delta, 0);
  let rating = Math.max(0, DEMO_RANKED_ANCHOR - sumD);

  const points: DemoPoint[] = [];
  const matches: Array<{
    id: string;
    battleTime: string;
    mode: string;
    map: string;
    result: string;
    brawlerId: number;
    brawlerName: string;
    trophyChange: number;
    ratingAfter: number | null;
    rankedSeries?: DemoRankedSeriesMeta;
  }> = [];

  for (let k = 0; k < steps.length; k++) {
    const s = steps[k];
    rating += s.delta;
    const battleTime = new Date(
      now - (steps.length - 1 - k) * 1000 * 60 * 32,
    ).toISOString();
    const seriesMeta: DemoRankedSeriesMeta = {
      id: s.seriesId,
      round: s.roundInSeries,
      total: s.seriesLen,
    };
    points.push({
      battleTime,
      ratingAfter: rating,
      trophyChange: s.delta,
      result: s.result,
      brawlerName: s.brawler.name,
      brawlerId: s.brawler.id,
    });
    matches.push({
      id: `demo-${k}`,
      battleTime,
      mode: s.map.mode,
      map: s.map.map,
      result: s.result,
      brawlerId: s.brawler.id,
      brawlerName: s.brawler.name,
      trophyChange: s.delta,
      ratingAfter: s.delta !== 0 ? rating : null,
      rankedSeries: seriesMeta,
    });
  }
  return {
    chart: points,
    matches: [...matches].reverse(),
    summary: {
      games: steps.length,
      wins: points.filter((p) => p.result === "victory").length,
      losses: points.filter((p) => p.result === "defeat").length,
      currentRating: rating,
      peakRating: Math.max(...points.map((p) => p.ratingAfter)),
    },
  };
}

type RowDraft = {
  battleTime: Date;
  isRanked: boolean;
  result: string;
  trophyChange: number;
  rankedDelta: number;
  brawler: (typeof BRAWLERS)[number];
  map: (typeof MAPS)[number];
  rankedSeries?: DemoRankedSeriesMeta;
};

const SLOT_MS = 35 * 60 * 1000;
/** Spread rounds within one ranked queue session so later games sort as more recent. */
const RANKED_ROUND_MS = 12_000;

/**
 * Build full Battle-shaped rows for /demo dashboard.
 *
 * Competitive Ranked rows are emitted in FT2-sized bursts (2–3 games per
 * ranked queue session). `_demoRankedSeries` is embedded in `raw` JSON for UI.
 */
export function buildDemoBattles(
  seed = 42,
  count = 60,
  opts?: { anchorRankedElo?: number },
): Battle[] {
  const rand = pseudoRand(seed);
  const now = Date.now();
  const anchorRankedElo = opts?.anchorRankedElo ?? DEMO_RANKED_ANCHOR;

  const drafts: RowDraft[] = [];
  let seq = 0;

  while (drafts.length < count) {
    const remaining = count - drafts.length;
    const spawnRankedSeries =
      remaining >= 2 && seq % 8 === 0 && drafts.length > 0;

    if (!spawnRankedSeries && drafts.length < count) {
      const winChance = 0.56;
      const isWin = rand() < winChance;
      const draw = !isWin && rand() < 0.04;
      const result = draw ? "draw" : isWin ? "victory" : "defeat";
      const trophyChange = ladderTrophyDelta(rand, result);
      const brawler = BRAWLERS[Math.floor(rand() * BRAWLERS.length)];
      const map = MAPS[Math.floor(rand() * MAPS.length)];
      drafts.push({
        battleTime: new Date(now - seq * SLOT_MS),
        isRanked: false,
        result,
        trophyChange,
        rankedDelta: 0,
        brawler,
        map,
      });
      seq++;
      continue;
    }

    const gap = count - drafts.length;
    const roundResults = ft2RoundResults(rand, gap);
    const rounds = roundResults.length;
    const seriesSeq = seq;
    const seriesId = `drs-${seriesSeq}-${Math.floor(rand() * 10_000)}`;
    const brawler = BRAWLERS[Math.floor(rand() * BRAWLERS.length)];
    const map = MAPS[Math.floor(rand() * MAPS.length)];
    const seriesWin = playerWonFt2Series(roundResults);
    const finalRankedDelta = rankedEloDelta(
      rand,
      seriesWin ? "victory" : "defeat",
    );

    for (let r = 0; r < rounds; r++) {
      const isFinal = r === rounds - 1;
      const rankedDelta = isFinal ? finalRankedDelta : 0;
      drafts.push({
        battleTime: new Date(
          now - seriesSeq * SLOT_MS + r * RANKED_ROUND_MS,
        ),
        isRanked: true,
        result: roundResults[r],
        trophyChange: rankedDelta,
        rankedDelta,
        brawler,
        map,
        rankedSeries: { id: seriesId, round: r + 1, total: rounds },
      });
    }
    seq += rounds;
  }

  drafts.sort((a, b) => a.battleTime.getTime() - b.battleTime.getTime());

  const rankedSum = drafts.reduce((a, r) => a + r.rankedDelta, 0);
  let eloSim = Math.max(0, anchorRankedElo - rankedSum);
  const trophiesByBrawler = new Map<number, number>();
  const battles: Battle[] = [];

  let battleSeq = 0;
  for (const row of drafts) {
    const { isRanked, result, trophyChange, brawler, map, battleTime } = row;

    let ratingBefore: number | null = null;
    let ratingAfter: number | null = null;
    if (isRanked && row.rankedDelta !== 0) {
      ratingBefore = eloSim;
      eloSim = Math.max(0, eloSim + row.rankedDelta);
      ratingAfter = eloSim;
    }

    const battleType = isRanked ? "soloRanked" : "ranked";
    let brawlerTrophies: number;
    if (isRanked) {
      brawlerTrophies = 16;
    } else {
      const prev =
        trophiesByBrawler.get(brawler.id) ?? 280 + Math.floor(rand() * 500);
      brawlerTrophies = Math.max(0, prev + trophyChange);
      trophiesByBrawler.set(brawler.id, brawlerTrophies);
    }

    const raw = demoBattleRaw({
      mode: map.mode,
      map: map.map,
      battleType,
      result,
      duration: 90 + Math.floor(rand() * 90),
      brawler: {
        id: brawler.id,
        name: brawler.name,
        trophies: brawlerTrophies,
      },
      rankedSeries: row.rankedSeries,
    });

    battles.push({
      id: `demo-${battleSeq}`,
      playerId: "demo",
      battleTime,
      mode: map.mode,
      map: map.map,
      result,
      brawlerName: brawler.name,
      brawlerId: brawler.id,
      trophyChange,
      ratingBefore,
      ratingAfter,
      duration: 90 + Math.floor(rand() * 90),
      isRanked,
      season: seasonForDate(battleTime).id,
      raw,
      createdAt: battleTime,
    });
    battleSeq++;
  }

  return battles.sort(
    (a, b) => b.battleTime.getTime() - a.battleTime.getTime(),
  );
}
