import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadDashboardPlayerWithBattlesDesc } from "@/lib/dashboardPlayerLoad";
import { tagForUrl } from "@/lib/tag";
import { guestPollCookieAllowsSlug } from "@/lib/guestRefreshPoll.server";
import { canMutateFromSession } from "@/lib/playerMutations";
import {
  accountTrophySeries,
  brawlerStats,
  filterTrophySeries,
  filterBySeason,
  mapStats,
  summarize,
} from "@/lib/stats";
import { rankedRoundRatedDeltaByBattleId } from "@/lib/rankedStats";
import { subTierProgress } from "@/lib/rankedTiers";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import {
  ownedBrawlerTrophyMap,
  parseOwnedBrawlersJson,
  rosterSortedByTrophies,
} from "@/lib/playerRoster";
import { mapBattlesToMatchRows } from "@/lib/mapBattlesToMatchRows";
import { matchHistoryPage } from "@/lib/matchHistory";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: { playerTag: string };
  searchParams: { historyPage?: string };
}) {
  const player = await loadDashboardPlayerWithBattlesDesc(params.playerTag);
  if (!player) return notFound();

  const session = await auth();
  const canManualPoll =
    canMutateFromSession(session, player.tag) ||
    guestPollCookieAllowsSlug(params.playerTag);

  const filtered = filterBySeason(player.battles, "all");
  // Pass `onlyRanked: false` so the Profile tab counts every captured
  // battle (trophy ladder, casual, showdown, plus ranked). The Ranked
  // tab handles the ranked-only view separately.
  const summary = summarize(filtered, { onlyRanked: false });
  const fullTrophyCurve = filterTrophySeries(
    accountTrophySeries(player.battles, player.trophies),
    filtered,
  );
  const trophyCurve =
    fullTrophyCurve.length <= 25
      ? fullTrophyCurve
      : fullTrophyCurve.slice(-25);
  const brawlers = brawlerStats(filtered, { playerTag: player.tag });
  const maps = mapStats(filtered);
  const history = matchHistoryPage(filtered.length, searchParams.historyPage);
  const recent = filtered.slice(history.offset, history.offset + history.pageSize);

  const rankedAscFull = filtered
    .filter((b) => b.isRanked)
    .sort((a, b) => a.battleTime.getTime() - b.battleTime.getTime());

  let priorRatedAfter: number | null = null;
  if (rankedAscFull[0]) {
    const row = await prisma.battle.findFirst({
      where: {
        playerId: player.id,
        isRanked: true,
        battleTime: { lt: rankedAscFull[0].battleTime },
      },
      orderBy: { battleTime: "desc" },
      select: { ratingAfter: true },
    });
    priorRatedAfter = row?.ratingAfter ?? null;
  }

  const rankedSeed = player.rankedElo ?? player.rankedBaseline ?? 0;
  const rankedDeltaMap = rankedRoundRatedDeltaByBattleId(rankedAscFull, {
    seedRating: rankedSeed,
    liveElo: player.rankedElo ?? null,
    priorRatedAfter,
    loggingStartRatedElo: player.rankedBaseline,
  });

  const ladderTrophiesByBrawlerId = ownedBrawlerTrophyMap(
    player.ownedBrawlersJson,
  );

  // Use the API's authoritative current ranked elo for the rank pill if
  // available; otherwise fall back to whatever rating the summary
  // surfaced so unranked players still see something.
  const ratingForRank =
    player.rankedElo ?? summary.currentRating ?? player.trophies;
  const { current, next, percent, pointsToNext } =
    subTierProgress(ratingForRank);
  const rank = { current, next, percent, pointsToNext };

  // For the all-time toggle, prefer the API-reported career peak; for
  // the seasonal toggle, prefer the API-reported season peak. Both fall
  // back to whatever we computed from stored battles.
  const peakRating =
    player.peakAllTimeRankedElo ?? summary.peakRating;

  const roster = rosterSortedByTrophies(
    parseOwnedBrawlersJson(player.ownedBrawlersJson),
  );

  return (
    <DashboardClient
      initial={{
        player: {
          id: player.id,
          tag: player.tag,
          name: player.name,
          icon: player.icon,
          trophies: player.trophies,
          highestTrophies: player.highestTrophies,
          lastPolled: player.lastPolled.toISOString(),
          trackOnlyRanked: player.trackOnlyRanked,
          rankedElo: player.rankedElo,
          rankedRankName: player.rankedRankName,
          rankedRank: player.rankedRank,
          peakAllTimeRankedElo: player.peakAllTimeRankedElo,
          peakAllTimeRankedRank: player.peakAllTimeRankedRank,
          peakAllTimeRankedRankName: player.peakAllTimeRankedRankName,
          peakSeasonRankedElo: player.peakRankedElo,
          peakSeasonRankedRankName: player.peakRankedRankName,
        },
        summary: { ...summary, peakRating },
        rank,
        trophyCurve,
        history,
        roster,
        matches: mapBattlesToMatchRows(recent, player.tag, rankedDeltaMap, {
          ladderTrophiesByBrawlerId,
        }),
        brawlers,
        maps,
        slug: tagForUrl(player.tag),
      }}
      canManualPoll={canManualPoll}
    />
  );
}
