/**
 * Brawl Stars ranked sub-tiers.
 *
 * Each main tier (Bronze, Silver, …) is split into three roman-numeral
 * sub-tiers I/II/III. The official thresholds aren't published in a
 * machine-readable form, but the post-rework points-per-tier values
 * match the in-game UI (e.g. Legendary I → Legendary II is 750 points,
 * giving 6000 / 6750 / 7500 for the three Legendary divisions).
 *
 * We anchor each sub-tier to its main tier and split evenly across
 * three slices.
 */

import { RANK_TIERS, type RankTier } from "./ranks";

export type RankedSubTier = {
  /** "Bronze I", "Legendary II", … */
  name: string;
  /** "Bronze", "Silver", … (used for color and icon lookup) */
  baseName: string;
  /** Roman numeral 1-3, or null for Pro (which has no sub-divisions). */
  division: 1 | 2 | 3 | null;
  /** Lower-bound rating (inclusive). */
  threshold: number;
  /** Color of the parent main tier. */
  color: string;
  glowColor: string;
};

const ROMAN: Record<1 | 2 | 3, string> = { 1: "I", 2: "II", 3: "III" };

function buildSubTiers(): RankedSubTier[] {
  const out: RankedSubTier[] = [];
  for (let i = 0; i < RANK_TIERS.length; i++) {
    const tier = RANK_TIERS[i];
    const next = RANK_TIERS[i + 1];

    // Pro has no sub-tiers (continuous; final stop on the ladder).
    if (tier.name === "Pro") {
      out.push({
        name: tier.name,
        baseName: tier.name,
        division: null,
        threshold: tier.threshold,
        color: tier.color,
        glowColor: tier.glowColor,
      });
      continue;
    }

    const span = next ? next.threshold - tier.threshold : 0;
    const slice = Math.floor(span / 3);
    for (const div of [1, 2, 3] as const) {
      out.push({
        name: `${tier.name} ${ROMAN[div]}`,
        baseName: tier.name,
        division: div,
        threshold: tier.threshold + slice * (div - 1),
        color: tier.color,
        glowColor: tier.glowColor,
      });
    }
  }
  return out.sort((a, b) => a.threshold - b.threshold);
}

export const RANKED_SUB_TIERS: RankedSubTier[] = buildSubTiers();

export function getSubTier(rating: number): RankedSubTier {
  let cur = RANKED_SUB_TIERS[0];
  for (const t of RANKED_SUB_TIERS) {
    if (rating >= t.threshold) cur = t;
  }
  return cur;
}

export function nextSubTier(rating: number): RankedSubTier | null {
  for (const t of RANKED_SUB_TIERS) {
    if (rating < t.threshold) return t;
  }
  return null;
}

export function subTierProgress(rating: number): {
  current: RankedSubTier;
  next: RankedSubTier | null;
  /** 0..100 — how far through the *current sub-tier* the rating is. */
  percent: number;
  /** Points needed to reach the next sub-tier. 0 once Pro is reached. */
  pointsToNext: number;
  /** The main tier object (for icons / overall colors). */
  mainTier: RankTier;
} {
  const current = getSubTier(rating);
  const next = nextSubTier(rating);
  const mainTier =
    RANK_TIERS.find((t) => t.name === current.baseName) ?? RANK_TIERS[0];

  if (!next) {
    return { current, next: null, percent: 100, pointsToNext: 0, mainTier };
  }
  const span = next.threshold - current.threshold;
  const into = rating - current.threshold;
  const percent = span > 0 ? Math.max(0, Math.min(100, (into / span) * 100)) : 0;
  return {
    current,
    next,
    percent,
    pointsToNext: Math.max(0, next.threshold - rating),
    mainTier,
  };
}
