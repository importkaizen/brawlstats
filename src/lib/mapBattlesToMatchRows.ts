import type { Battle } from "@prisma/client";
import type { MatchRow } from "@/components/dashboard/matchRow";
import { brawlerTrophiesAfterBattle } from "@/lib/stats";

/** Build Recent matches / Ranked battle-log rows from stored battles. */
export function mapBattlesToMatchRows(
  battles: Battle[],
  playerTag: string,
  rankedDeltaMap: Map<string, number | null>,
  options?: {
    rankedSeries?: (raw: string | null) => MatchRow["rankedSeries"];
    /** Latest `/players/{tag}` ladder trophies — fills ranked rows where battlelog omits them. */
    ladderTrophiesByBrawlerId?: Map<number, number> | null;
  },
): MatchRow[] {
  const seriesFn = options?.rankedSeries;
  const ladder = options?.ladderTrophiesByBrawlerId ?? null;
  return battles.map((b) => {
    let brawlerTrophies = brawlerTrophiesAfterBattle(b, playerTag);
    if (brawlerTrophies == null && ladder) {
      brawlerTrophies = ladder.get(b.brawlerId) ?? null;
    }
    const row: MatchRow = {
      id: b.id,
      battleTime: b.battleTime.toISOString(),
      mode: b.mode,
      map: b.map,
      result: b.result,
      brawlerId: b.brawlerId,
      brawlerName: b.brawlerName,
      trophyChange: b.trophyChange,
      rankedRatingDelta: rankedDeltaMap.get(b.id) ?? null,
      brawlerTrophies,
      ratingAfter: b.ratingAfter,
      isRanked: b.isRanked,
      raw: b.raw,
    };
    if (!seriesFn) return row;
    const s = seriesFn(b.raw);
    return s != null ? { ...row, rankedSeries: s } : row;
  });
}
