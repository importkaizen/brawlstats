import type { Battle } from "@prisma/client";

/**
 * If rounds haven’t finished first‑to‑two yet, only merge consecutive battles
 * within this gap (handles slow round turnovers / queue gaps). Once FT2
 * completes we close the cluster immediately — round spacing inside one match
 * can exceed this window without splitting.
 */
export const RANKED_SESSION_MAX_GAP_MS = 45 * 60 * 1000;

export function sortBattlesAsc(battles: Battle[]): Battle[] {
  return [...battles].sort(
    (a, b) => a.battleTime.getTime() - b.battleTime.getTime(),
  );
}

/** True once someone reaches two round wins in this slice (ranked FT2 rules). */
export function isRankedFt2Complete(roundsSortedAsc: Battle[]): boolean {
  let w = 0;
  let l = 0;
  for (const r of roundsSortedAsc) {
    if (r.result === "victory") w++;
    else if (r.result === "defeat") l++;
    if (w >= 2 || l >= 2) return true;
  }
  return false;
}

/**
 * Pool sorted ascending by `battleTime`.
 *
 * Groups rounds into **ranked matches** (first‑to‑two queue outings):
 * - Extend cluster until FT2 completes, then flush.
 * - If FT2 never completes but idle gap exceeds {@link RANKED_SESSION_MAX_GAP_MS},
 *   flush as an incomplete outing before starting the next cluster (missing API
 *   rows / separate queue sessions).
 */
export function clusterRankedIntoMatches(poolSortedAsc: Battle[]): Battle[][] {
  if (poolSortedAsc.length === 0) return [];
  const out: Battle[][] = [];
  let cur: Battle[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    out.push(cur);
    cur = [];
  };

  for (const b of poolSortedAsc) {
    if (cur.length > 0) {
      const prev = cur[cur.length - 1]!;
      const gap = b.battleTime.getTime() - prev.battleTime.getTime();
      if (
        gap > RANKED_SESSION_MAX_GAP_MS &&
        !isRankedFt2Complete(cur)
      ) {
        flush();
      }
    }
    cur.push(b);
    if (isRankedFt2Complete(cur)) flush();
  }
  flush();
  return out;
}

/** Match outcome after applying ranked FT2 stopping rule on round sequence. */
export function inferSeriesOutcome(
  roundsSortedAsc: Battle[],
): "victory" | "defeat" | "draw" {
  let w = 0;
  let l = 0;
  for (const r of roundsSortedAsc) {
    if (r.result === "victory") w++;
    else if (r.result === "defeat") l++;
    if (w >= 2 || l >= 2) break;
  }
  if (w >= 2) return "victory";
  if (l >= 2) return "defeat";
  if (w === 0 && l === 0) return "draw";
  if (w > l) return "victory";
  if (l > w) return "defeat";
  return "draw";
}
