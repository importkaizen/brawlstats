import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { loadDashboardPlayerWithBattlesDesc } from "@/lib/dashboardPlayerLoad";
import { tagForUrl } from "@/lib/tag";
import {
  buildRanked,
  buildRankedMatchLogRows,
  extractStarPlayerTags,
  ratedAnchorBeforePool,
  priorRatedAfterInWindow,
  rankedBattlesPoolAsc,
} from "@/lib/rankedStats";
import { currentSeason, formatSeasonHeading } from "@/lib/seasons";
import { RankedClient } from "@/components/ranked/RankedClient";
import { fetchBattlelog, hasApiKey } from "@/lib/brawlstars";
import {
  mergeAllBattlesForRankedView,
  previewRankedBattlesFromLog,
} from "@/lib/rankedPreview";
import { filterBattlesForRankedHistory } from "@/lib/rankedAccess";
import {
  clusterRankedIntoMatches,
  isRankedFt2Complete,
  sortBattlesAsc,
} from "@/lib/rankedSessions";
import { guestPollCookieAllowsSlug } from "@/lib/guestRefreshPoll.server";
import { canMutateFromSession } from "@/lib/playerMutations";

export const dynamic = "force-dynamic";

export default async function RankedPage({
  params,
  searchParams,
}: {
  params: { playerTag: string };
  searchParams: { season?: string };
}) {
  const player = await loadDashboardPlayerWithBattlesDesc(params.playerTag);
  if (!player) return notFound();

  const battlesAsc = [...player.battles].reverse();
  const tag = player.tag;

  const session = await auth();
  const canMutate = canMutateFromSession(session, player.tag);
  const canManualPoll =
    canMutate || guestPollCookieAllowsSlug(params.playerTag);

  let battlelogItems: Awaited<ReturnType<typeof fetchBattlelog>>["items"] = [];

  const canUseLiveRankedLog =
    hasApiKey() &&
    !player.isDemo &&
    player.rankedLoggingStartedAt != null;

  if (canUseLiveRankedLog) {
    try {
      const log = await fetchBattlelog(tag);
      battlelogItems = log.items;
    } catch {
      // Fall back to DB-only ranked rows.
    }
  }

  const previewRanked = canUseLiveRankedLog
    ? previewRankedBattlesFromLog(battlelogItems, tag, player.id)
    : [];

  const season = searchParams.season ?? "current";

  const mergedBattles = mergeAllBattlesForRankedView(
    battlesAsc,
    previewRanked,
  );
  const battlesForRanked = filterBattlesForRankedHistory(
    player,
    mergedBattles,
  );

  const baselineAt = player.rankedBaselineAt ?? player.rankedLoggingStartedAt;
  const rankedPoolAsc = rankedBattlesPoolAsc({
    battles: battlesForRanked,
    liveElo: player.rankedElo,
    baselineAt,
    season,
  });

  const priorRatedAfter = priorRatedAfterInWindow(
    battlesForRanked,
    rankedPoolAsc[0]?.battleTime,
  );

  const rankedRatedOpts = {
    seedRating: player.rankedElo ?? player.rankedBaseline ?? 0,
    liveElo: player.rankedElo ?? null,
    priorRatedAfter,
    loggingStartRatedElo: player.rankedBaseline,
  };
  const anchorBeforePool = ratedAnchorBeforePool(rankedRatedOpts);

  const rankedMatchLog = buildRankedMatchLogRows(
    rankedPoolAsc,
    rankedRatedOpts,
  )
    .slice(-25)
    .reverse();

  const starMap = extractStarPlayerTags(battlesForRanked);
  const ranked = buildRanked({
    battles: battlesForRanked,
    liveElo: player.rankedElo,
    baseline: player.rankedBaseline,
    baselineAt,
    season,
    starPlayerTagByBattleId: starMap,
    playerTag: player.tag,
    ratedAnchorBeforePool: anchorBeforePool,
    prependRatedStartPoint:
      priorRatedAfter != null
        ? false
        : player.rankedBaseline != null && baselineAt != null,
  });

  const loggingAt = player.rankedLoggingStartedAt;
  const allRankedStored = player.battles.filter(
    (b) =>
      b.isRanked &&
      (player.isDemo ||
        (loggingAt != null && b.battleTime >= loggingAt)),
  );
  const totalRankedCaptured = allRankedStored.length;
  const rankedClustersStored = clusterRankedIntoMatches(
    sortBattlesAsc(allRankedStored),
  );
  const completedRankedMatchesCaptured = rankedClustersStored.filter((c) =>
    isRankedFt2Complete(c),
  ).length;

  const allowRankedPresentation = player.isDemo || loggingAt != null;
  if (
    allowRankedPresentation &&
    player.peakRankedElo != null &&
    player.peakRankedElo > ranked.summary.peakRating
  ) {
    ranked.summary.peakRating = player.peakRankedElo;
  }

  const seasonHeading = formatSeasonHeading(currentSeason());

  return (
    <RankedClient
      data={{
        player: {
          tag: player.tag,
          name: player.name,
          icon: player.icon,
          slug: tagForUrl(player.tag),
          rankedBaseline: player.rankedBaseline,
          rankedBaselineAt: player.rankedBaselineAt?.toISOString() ?? null,
          lastPolled: player.lastPolled.toISOString(),
          apiRankName: player.rankedRankName,
          apiRankedElo: player.rankedElo,
          apiRankedRank: player.rankedRank,
          allTimePeakElo: player.peakAllTimeRankedElo,
          allTimePeakRank: player.peakAllTimeRankedRank,
          allTimePeakRankName: player.peakAllTimeRankedRankName,
          rankedLoggingStartedAt:
            player.rankedLoggingStartedAt?.toISOString() ?? null,
          accountTrophies: player.trophies,
        },
        hasBaseline: ranked.hasBaseline,
        baseline: ranked.baseline,
        summary: ranked.summary,
        rating: ranked.rating,
        brawlers: ranked.brawlers,
        seasonHeading,
        totalRankedCaptured,
        completedRankedMatchesCaptured,
        isDemo: player.isDemo,
        rankedMatchLog,
      }}
      canMutate={canMutate}
      canManualPoll={canManualPoll}
    />
  );
}
