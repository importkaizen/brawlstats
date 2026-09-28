import type { Battle, Player } from "@prisma/client";

/**
 * Battles that may feed `buildRanked` / charts.
 *
 * - Demo: everything.
 * - Real player, not opted in: non-ranked rows only (no historical ranked).
 * - Opted in: non-ranked + ranked on or after `rankedLoggingStartedAt`.
 */
export function filterBattlesForRankedHistory(
  player: Pick<Player, "isDemo" | "rankedLoggingStartedAt">,
  battles: Battle[],
): Battle[] {
  if (player.isDemo) return battles;
  if (!player.rankedLoggingStartedAt) {
    return battles.filter((b) => !b.isRanked);
  }
  const start = player.rankedLoggingStartedAt;
  return battles.filter((b) => !b.isRanked || b.battleTime >= start);
}
