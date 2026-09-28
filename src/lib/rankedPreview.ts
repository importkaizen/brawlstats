/**
 * Merge Supercell battlelog-ranked rows with persisted DB rows so the
 * Ranked dashboard can show the last ~25 API games before the player
 * opts in to long-term logging — without writing preview rows to the DB.
 */

import type { Battle } from "@prisma/client";
import type { ApiBattleEntry } from "./brawlstars";
import {
  findPlayerInBattle,
  isRankedBattle,
  parseBattleTime,
} from "./brawlstars";
import { seasonForDate } from "./seasons";

/** Turn live ranked battlelog entries into Battle-shaped rows (in-memory only). */
export function previewRankedBattlesFromLog(
  items: ApiBattleEntry[],
  playerTag: string,
  playerId: string,
): Battle[] {
  const out: Battle[] = [];
  for (const entry of items) {
    if (!isRankedBattle(entry)) continue;
    const battleTime = parseBattleTime(entry.battleTime);
    const found = findPlayerInBattle(entry, playerTag);
    const brawler = found?.brawler;
    out.push({
      id: `api-preview-${battleTime.getTime()}`,
      playerId,
      battleTime,
      mode: entry.event?.mode ?? entry.battle.mode ?? "unknown",
      map: entry.event?.map ?? "Unknown",
      result: (entry.battle.result ?? "draw") as string,
      brawlerName: brawler?.name ?? "Unknown",
      brawlerId: brawler?.id ?? 0,
      trophyChange: entry.battle.trophyChange ?? 0,
      ratingAfter: null,
      ratingBefore: null,
      duration: entry.battle.duration ?? 0,
      isRanked: true,
      season: seasonForDate(battleTime).id,
      raw: JSON.stringify(entry),
      createdAt: battleTime,
    });
  }
  return out;
}

export function mergeRankedBattlesPreferDb(
  dbRanked: Battle[],
  previewRanked: Battle[],
): Battle[] {
  const byTime = new Map<number, Battle>();
  for (const b of previewRanked) {
    byTime.set(b.battleTime.getTime(), b);
  }
  for (const b of dbRanked) {
    byTime.set(b.battleTime.getTime(), b);
  }
  return [...byTime.values()].sort(
    (a, b) => a.battleTime.getTime() - b.battleTime.getTime(),
  );
}

/** Full battle list for `buildRanked`: non-ranked from DB + merged ranked. */
export function mergeAllBattlesForRankedView(
  allDbBattles: Battle[],
  previewRanked: Battle[],
): Battle[] {
  const nonRanked = allDbBattles.filter((b) => !b.isRanked);
  const dbRanked = allDbBattles.filter((b) => b.isRanked);
  const mergedRanked = mergeRankedBattlesPreferDb(dbRanked, previewRanked);
  return [...nonRanked, ...mergedRanked];
}

export function countRankedInBattlelog(items: ApiBattleEntry[]): number {
  return items.filter((e) => isRankedBattle(e)).length;
}
