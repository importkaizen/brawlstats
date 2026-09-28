import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { buildDemoBattles, demoOwnedBrawlers, demoRankedSeriesFromRaw } from "@/lib/demo";
import { mapBattlesToMatchRows } from "@/lib/mapBattlesToMatchRows";
import { ladderTrophyMapFromOwnedRoster } from "@/lib/playerRoster";
import { subTierProgress } from "@/lib/rankedTiers";
import {
  accountTrophySeries,
  brawlerStats,
  filterTrophySeries,
  mapStats,
  summarize,
} from "@/lib/stats";
import { rankedRoundRatedDeltaByBattleId } from "@/lib/rankedStats";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  const all = buildDemoBattles(42, 48);
  const summary = summarize(all, { onlyRanked: false });
  const forward = [...all].sort(
    (a, b) => a.battleTime.getTime() - b.battleTime.getTime(),
  );
  let demoAccountTrophies = 38_000;
  for (const b of forward) {
    if (!b.isRanked) demoAccountTrophies += b.trophyChange ?? 0;
  }
  const fullTrophy = filterTrophySeries(
    accountTrophySeries(all, demoAccountTrophies),
    all,
  );
  const trophyCurve =
    fullTrophy.length <= 25 ? fullTrophy : fullTrophy.slice(-25);
  const brawlers = brawlerStats(all, { playerTag: "#DEMO" });
  const maps = mapStats(all);

  const demoRankedElo = summary.currentRating ?? 6042;
  const recent = all.slice(0, 25);

  const rankedAscFull = forward.filter((b) => b.isRanked);

  let priorRatedAfter: number | null = null;
  if (rankedAscFull[0]) {
    const older = [...forward]
      .filter(
        (b) =>
          b.isRanked &&
          b.battleTime.getTime() < rankedAscFull[0].battleTime.getTime(),
      )
      .sort((a, b) => b.battleTime.getTime() - a.battleTime.getTime())[0];
    priorRatedAfter = older?.ratingAfter ?? null;
  }

  const demoRankedDeltaMap = rankedRoundRatedDeltaByBattleId(rankedAscFull, {
    seedRating: demoRankedElo,
    liveElo: demoRankedElo,
    priorRatedAfter,
    loggingStartRatedElo: null,
  });

  const tierProg = subTierProgress(demoRankedElo);
  const rank = {
    current: tierProg.current,
    next: tierProg.next,
    percent: tierProg.percent,
    pointsToNext: tierProg.pointsToNext,
  };
  const demoRankLabel = tierProg.current.name.toUpperCase();

  const demoLadderMap = ladderTrophyMapFromOwnedRoster(demoOwnedBrawlers());

  return (
    <DashboardClient
      isDemo
      initial={{
        player: {
          id: "demo",
          tag: "#DEMO",
          name: "Demo Account",
          icon: 28000003,
          trophies: demoAccountTrophies,
          highestTrophies: demoAccountTrophies + 2_500,
          lastPolled: new Date().toISOString(),
          trackOnlyRanked: true,
          rankedElo: demoRankedElo,
          rankedRankName: demoRankLabel,
          rankedRank: null,
          peakAllTimeRankedElo: 8595,
          peakAllTimeRankedRank: 19,
          peakAllTimeRankedRankName: "MASTERS I",
          peakSeasonRankedElo: summary.peakRating ?? 6316,
          peakSeasonRankedRankName: "LEGENDARY I",
        },
        summary,
        rank,
        trophyCurve,
        roster: demoOwnedBrawlers(),
        matches: mapBattlesToMatchRows(recent, "#DEMO", demoRankedDeltaMap, {
          rankedSeries: demoRankedSeriesFromRaw,
          ladderTrophiesByBrawlerId: demoLadderMap,
        }),
        brawlers,
        maps,
        slug: "demo",
      }}
    />
  );
}
