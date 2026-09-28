/** Row model for Recent matches list + Match detail drawer. */
export type MatchRow = {
  id: string;
  battleTime: string;
  mode: string;
  map: string;
  result: string;
  brawlerId: number;
  brawlerName: string;
  trophyChange: number;
  /**
   * Inferred ranked elo Δ for the **whole match** — only set on the final round row
   * of each ranked outing (Δ vs rating after previous match). Earlier rounds omit this.
   */
  rankedRatingDelta: number | null;
  /** Brawler's trophy count after this match (from battlelog). */
  brawlerTrophies: number | null;
  ratingAfter: number | null;
  isRanked: boolean;
  /** Full battlelog JSON from storage — powers roster breakdown in the modal. */
  raw: string | null;
  /** Synthetic demo — rows sharing `id` are one ranked queue session (visual grouping). */
  rankedSeries?: { id: string; round: number; total: number };
};
