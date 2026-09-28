import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const lib = fileURLToPath(new URL("../src/lib/", import.meta.url));

// Load the real TypeScript functions without adding a test runtime dependency.
function loader(overrides = {}) {
  const cache = new Map();
  function load(path) {
    if (overrides[path]) return overrides[path];
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const localRequire = (id) => id.startsWith(".")
      ? load(resolve(dirname(path), `${id}.ts`))
      : require(id);
    new Function("require", "module", "exports", outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  return (name) => load(resolve(lib, `${name}.ts`));
}

const load = loader();
const { seasonForDate } = load("seasons");
const { filterBattlesForRankedHistory } = load("rankedAccess");
const { buildRanked, buildRankedMatchLogRows, priorRatedAfterInWindow, ratedAnchorBeforePool } = load("rankedStats");
const baselineAt = new Date("2026-09-28T00:00:00Z");
const tag = "#2YYYGQQY02";
function entry(minute, result) {
  return {
    battleTime: new Date(baselineAt.getTime() + minute * 60_000).toISOString(),
    event: { id: 1, mode: "brawlBall", map: "Triple Dribble" },
    battle: {
      type: "soloRanked", result, duration: 120,
      teams: [[{ tag, name: "Player", brawler: { id: 16000000, name: "SHELLY", power: 11, trophies: 0 } }]],
    },
  };
}
function stored(minute, result, ratingAfter) {
  const raw = entry(minute, result);
  const battleTime = new Date(raw.battleTime);
  return {
    id: `round-${minute}`, playerId: "player", battleTime,
    mode: raw.event.mode, map: raw.event.map, result,
    brawlerId: 16000000, brawlerName: "SHELLY", trophyChange: 0,
    ratingBefore: null, ratingAfter, isRanked: true, duration: 120,
    season: seasonForDate(battleTime).id, raw: JSON.stringify(raw), createdAt: battleTime,
  };
}
const args = { baseline: 6000, baselineAt, liveElo: 6100, season: "all", playerTag: tag };
const rounds = [
  stored(1, "defeat", 6000), stored(3, "defeat", 5900),
  stored(5, "victory", 5900), stored(7, "victory", 6020),
];
const ratedOpts = { seedRating: 6100, liveElo: 6100, priorRatedAfter: null, loggingStartRatedElo: 6000 };

const empty = buildRanked({ ...args, battles: [] });
assert.deepEqual(empty.rating.map((p) => p.ratingAfter), [6000], "Show the start rating before the first completed game");
assert.equal(empty.summary.totalGames, 0);
const complete = buildRanked({ ...args, battles: rounds });
assert.deepEqual(complete.rating.map((p) => p.ratingAfter), [6000, 5900, 6020], "Live ELO must not replace a known terminal snapshot");
assert.deepEqual(complete.rating.slice(1).map((p) => p.trophyChange), [-100, 120]);
assert.equal(complete.summary.currentRating, 6100, "The current-rank card still uses the live profile");
assert.deepEqual(buildRankedMatchLogRows(rounds, ratedOpts).map((p) => p.eloAfter), [5900, 6020]);
const partial = buildRanked({ ...args, battles: [...rounds, stored(9, "victory", 6100)] });
assert.deepEqual(partial.rating.map((p) => p.ratingAfter), [6000, 5900, 6020], "One round cannot create a finished FT2 game");
const finished = buildRanked({ ...args, battles: [...rounds, stored(9, "victory", 6100), stored(11, "victory", 6120)], liveElo: 6120 });
assert.deepEqual(finished.rating.map((p) => p.ratingAfter), [6000, 5900, 6020, 6120], "Finishing the next game appends its rating");
const filtered = filterBattlesForRankedHistory({ isDemo: false, rankedLoggingStartedAt: baselineAt }, [stored(-10, "victory", 6400), ...rounds]);
assert.equal(priorRatedAfterInWindow(filtered, rounds[0].battleTime), null, "Pre-opt-in history must not hide the logging baseline");
assert.equal(priorRatedAfterInWindow(filtered, rounds[2].battleTime), 5900, "Use the closest saved predecessor inside the logging window");
assert.equal(ratedAnchorBeforePool({ ...ratedOpts, priorRatedAfter: 6100 }), 6100);
assert.equal(buildRanked({ ...args, battles: [], season: "unrelated-season" }).rating.length, 0, "Do not put a baseline in a different season");

// Exercise pollPlayer through two captures and a repeat, using an isolated in-memory DB.
const rows = [stored(1, "defeat", 6000), stored(3, "defeat", 5900)];
const player = { id: "player", tag, name: "Player", icon: 0, trophies: 10000, rankedElo: 5900,
  trackOnlyRanked: false, rankedBaseline: 6000, rankedBaselineAt: baselineAt,
  rankedLoggingStartedAt: baselineAt, lastPolled: baselineAt };
let liveElo = 6020;
let log = [entry(5, "victory"), entry(7, "victory")];
function matching(where = {}) {
  return rows.filter((r) => (!where.playerId || r.playerId === where.playerId)
    && (where.isRanked === undefined || r.isRanked === where.isRanked)
    && (!where.battleTime?.in || where.battleTime.in.some((d) => d.getTime() === r.battleTime.getTime()))
    && (!where.battleTime?.gte || r.battleTime >= where.battleTime.gte));
}
const db = {
  player: {
    upsert: async ({ update }) => Object.assign(player, update),
    update: async ({ data }) => Object.assign(player, data),
    findUniqueOrThrow: async () => ({ ...player }),
    findUnique: async () => ({ ...player }),
  },
  battle: {
    findMany: async ({ where, orderBy }) => {
      const result = matching(where).map((r) => ({ ...r }));
      return orderBy ? result.sort((a, b) => a.battleTime - b.battleTime) : result;
    },
    count: async ({ where }) => matching(where).length,
    create: async ({ data }) => {
      const row = { id: `captured-${rows.length}`, ratingBefore: null, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id), data),
  },
  $transaction: async (operations) => Promise.all(operations),
};
const api = load("brawlstars");
const mockedLoad = loader({
  [resolve(lib, "prisma.ts")]: { prisma: db },
  [resolve(lib, "brawlstars.ts")]: {
    ...api,
    fetchPlayer: async () => ({ tag, name: "Player", icon: { id: 0 }, trophies: 10000, brawlers: [], rankedElo: liveElo }),
    fetchBattlelog: async () => ({ items: log }),
  },
});
const { pollPlayer } = mockedLoad("poll");
assert.equal((await pollPlayer(tag)).inserted, 2);
assert.deepEqual(rows.map((r) => r.ratingAfter), [6000, 5900, 6020, 6020], "Capturing new rounds must preserve all older ratings");
liveElo = 6150;
log = [...log, entry(9, "victory"), entry(11, "victory")];
assert.equal((await pollPlayer(tag)).inserted, 2);
assert.deepEqual(rows.map((r) => r.ratingAfter), [6000, 5900, 6020, 6020, 6150, 6150]);
liveElo = 6200;
assert.equal((await pollPlayer(tag)).inserted, 0);
assert.deepEqual(rows.map((r) => r.ratingAfter), [6000, 5900, 6020, 6020, 6150, 6150], "A repeat poll with newer profile ELO cannot rewrite history");
assert.equal(player.rankedElo, 6200);
assert.ok(player.lastPolled > baselineAt);
assert.deepEqual(buildRanked({ ...args, battles: rows, liveElo }).rating.map((p) => p.ratingAfter), [6000, 5900, 6020, 6150]);

// API history is a rolling window. Losing a battle from that window must
// never remove it from the archive, even with Ranked logging switched off.
const originalRows = structuredClone(rows);
player.rankedLoggingStartedAt = null;
player.rankedBaseline = null;
player.rankedBaselineAt = null;
function mixedEntry(minute) {
  const battle = entry(minute, minute % 2 ? "victory" : "defeat");
  if (minute % 3 === 0) {
    battle.battle.type = "ranked";
    battle.battle.trophyChange = 8;
  }
  return battle;
}
log = Array.from({ length: 20 }, (_, i) => mixedEntry(20 + i)).reverse();
assert.equal((await pollPlayer(tag)).inserted, 20, "Archive all queues before Ranked session opt-in");
assert.ok(rows.some((r) => r.battleTime.getTime() === new Date(entry(22, "defeat").battleTime).getTime() && r.isRanked));
const firstWindowRows = structuredClone(rows);
log = Array.from({ length: 20 }, (_, i) => mixedEntry(30 + i)).reverse();
const rolling = await pollPlayer(tag);
assert.equal(rolling.inserted, 10, "Overlapping windows must deduplicate old battles");
assert.equal(rolling.total, originalRows.length + 30);
assert.deepEqual(rows.slice(0, firstWindowRows.length), firstWindowRows, "Expired API entries and their raw payloads remain unchanged");
log = Array.from({ length: 20 }, (_, i) => mixedEntry(100 + i)).reverse();
assert.equal((await pollPlayer(tag)).inserted, 20, "A completely replaced API window only appends battles");
assert.equal(rows.length, originalRows.length + 50);
const allCaptured = structuredClone(rows);
log = [];
assert.equal((await pollPlayer(tag)).inserted, 0);
assert.deepEqual(rows, allCaptured, "An empty API history must not wipe the archive");
log = [mixedEntry(60 * 24 * 31)];
assert.equal((await pollPlayer(tag)).inserted, 1);
assert.deepEqual(rows.slice(0, allCaptured.length), allCaptured, "A season rollover must keep past seasons intact");
assert.notEqual(rows.at(-1).season, rows[0].season);
assert.deepEqual(rows.slice(0, originalRows.length), originalRows, "Resetting a Ranked session preserves all earlier ratings and battles");

const newSessionMinute = 60 * 24 * 31 + 10;
player.rankedLoggingStartedAt = new Date(entry(newSessionMinute, "victory").battleTime);
log = [entry(newSessionMinute + 1, "victory")];
assert.equal((await pollPlayer(tag)).inserted, 1);
assert.equal(player.rankedBaseline, liveElo, "Older archived Ranked games must not prevent a fresh session baseline");
assert.equal(player.rankedBaselineAt.getTime(), player.rankedLoggingStartedAt.getTime());

const { matchHistoryPage } = load("matchHistory");
const viewedIds = [];
const total = rows.length;
for (let page = 1; page <= Math.ceil(total / 25); page++) {
  const pagination = matchHistoryPage(total, String(page));
  viewedIds.push(...rows.slice(pagination.offset, pagination.offset + pagination.pageSize).map((r) => r.id));
}
assert.equal(viewedIds.length, total, "Every archived battle is reachable through pagination");
assert.equal(new Set(viewedIds).size, total, "History pages must neither skip nor duplicate battles");
assert.equal(matchHistoryPage(total, "99999").page, Math.ceil(total / 25));
assert.equal(matchHistoryPage(total, "-1").page, 1);
assert.equal(matchHistoryPage(total, "oops").page, 1);
assert.equal(matchHistoryPage(0).from, 0);
assert.equal(matchHistoryPage(0).to, 0);
console.log("History checks passed: rolling/empty API windows, deduplication, pre-session Ranked capture, season rollover, preserved snapshots, and all archive pages.");
