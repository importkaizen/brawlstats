/**
 * Ranked rating thresholds.
 *
 * Brawl Stars has tweaked these numbers across seasons; we use the most
 * commonly referenced thresholds for the post-Ranked rework era. Each tier
 * has an associated colour used throughout the UI.
 */

export type RankTier = {
  name: string;
  short: string;
  threshold: number;
  color: string;
  glowColor: string;
};

export const RANK_TIERS: RankTier[] = [
  // Match the rank badges in Supercell's Ranked artwork:
  // https://supercell.com/en/games/brawlstars/blog/news/ranked-is-dead-and-ranked-is-back/
  {
    name: "Bronze",
    short: "Bronze",
    threshold: 0,
    color: "#E9953B",
    glowColor: "rgba(233,149,59,0.45)",
  },
  {
    name: "Silver",
    short: "Silver",
    threshold: 750,
    color: "#B7BEE8",
    glowColor: "rgba(183,190,232,0.45)",
  },
  {
    name: "Gold",
    short: "Gold",
    threshold: 1500,
    color: "#FFD83D",
    glowColor: "rgba(255,216,61,0.5)",
  },
  {
    name: "Diamond",
    short: "Diamond",
    threshold: 3000,
    color: "#29D3F5",
    glowColor: "rgba(41,211,245,0.45)",
  },
  {
    name: "Mythic",
    short: "Mythic",
    threshold: 4500,
    color: "#B749FF",
    glowColor: "rgba(183,73,255,0.45)",
  },
  {
    name: "Legendary",
    short: "Legend",
    threshold: 6000,
    color: "#FF3B4B",
    glowColor: "rgba(255,59,75,0.45)",
  },
  {
    name: "Masters",
    short: "Masters",
    threshold: 8250,
    color: "#FFA62B",
    glowColor: "rgba(255,166,43,0.45)",
  },
  {
    name: "Pro",
    short: "Pro",
    threshold: 11250,
    color: "#69E329",
    glowColor: "rgba(105,227,41,0.45)",
  },
];

export function getRank(rating: number): RankTier {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (rating >= t.threshold) tier = t;
  }
  return tier;
}

export function nextRank(rating: number): RankTier | null {
  for (const t of RANK_TIERS) {
    if (rating < t.threshold) return t;
  }
  return null;
}

export function rankProgress(rating: number): {
  current: RankTier;
  next: RankTier | null;
  percent: number;
  pointsToNext: number;
} {
  const current = getRank(rating);
  const next = nextRank(rating);
  if (!next) return { current, next: null, percent: 100, pointsToNext: 0 };
  const span = next.threshold - current.threshold;
  const into = rating - current.threshold;
  const percent = span > 0 ? Math.max(0, Math.min(100, (into / span) * 100)) : 0;
  return { current, next, percent, pointsToNext: next.threshold - rating };
}
