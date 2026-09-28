import { RankedClient } from "@/components/ranked/RankedClient";
import { buildDemoBattles } from "@/lib/demo";
import {
  buildRanked,
  buildRankedMatchLogRows,
  ratedAnchorBeforePool,
  rankedBattlesPoolAsc,
} from "@/lib/rankedStats";
import { currentSeason, formatSeasonHeading } from "@/lib/seasons";
import {
  clusterRankedIntoMatches,
  isRankedFt2Complete,
  sortBattlesAsc,
} from "@/lib/rankedSessions";

export const dynamic = "force-dynamic";

export default function DemoRankedPage() {
  const battles = buildDemoBattles(7, 32);
  // Pin the demo "current rating" so the curve lands inside Legendary I.
  const liveElo = 6042;

  const rankedPoolAsc = rankedBattlesPoolAsc({
    battles,
    liveElo,
    baselineAt: null,
    season: "all",
  });

  let priorRatedAfter: number | null = null;
  if (rankedPoolAsc[0]) {
    const older = [...battles]
      .filter(
        (b) =>
          b.isRanked &&
          b.battleTime.getTime() < rankedPoolAsc[0].battleTime.getTime(),
      )
      .sort((a, b) => b.battleTime.getTime() - a.battleTime.getTime())[0];
    priorRatedAfter = older?.ratingAfter ?? null;
  }

  const rankedRatedOpts = {
    seedRating: liveElo,
    liveElo,
    priorRatedAfter,
    loggingStartRatedElo: null,
  };

  const rankedMatchLog = buildRankedMatchLogRows(rankedPoolAsc, rankedRatedOpts)
    .slice(-25)
    .reverse();

  const ranked = buildRanked({
    battles,
    liveElo,
    season: "all",
    playerTag: "#DEMO",
    ratedAnchorBeforePool: ratedAnchorBeforePool(rankedRatedOpts),
    prependRatedStartPoint: priorRatedAfter != null ? false : undefined,
  });

  const rankedStoredDemo = battles.filter((b) => b.isRanked);
  const demoClusters = clusterRankedIntoMatches(
    sortBattlesAsc(rankedStoredDemo),
  );
  const completedRankedMatchesCaptured = demoClusters.filter((c) =>
    isRankedFt2Complete(c),
  ).length;

  return (
    <RankedClient
      data={{
        player: {
          tag: "#DEMO",
          name: "Demo Account",
          icon: 28000003,
          slug: "demo",
          rankedBaseline: null,
          rankedBaselineAt: null,
          apiRankName: "LEGENDARY I",
          apiRankedElo: liveElo,
          apiRankedRank: 16,
          allTimePeakElo: 8595,
          allTimePeakRank: 19,
          allTimePeakRankName: "MASTERS I",
          rankedLoggingStartedAt: new Date(
            Date.now() - 21 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          accountTrophies: 38_400,
        },
        hasBaseline: true,
        baseline: liveElo,
        summary: ranked.summary,
        rating: ranked.rating,
        brawlers: ranked.brawlers,
        seasonHeading: formatSeasonHeading(currentSeason()),
        isDemo: true,
        totalRankedCaptured: rankedStoredDemo.length,
        completedRankedMatchesCaptured,
        rankedMatchLog,
      }}
    />
  );
}
