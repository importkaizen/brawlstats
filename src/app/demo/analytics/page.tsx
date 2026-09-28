import { AnalyticsClient } from "@/components/dashboard/AnalyticsClient";
import { subTierProgress } from "@/lib/rankedTiers";
import {
  brawlerStats,
  filterBySeason,
  latestBrawlerTrophies,
  mapStats,
  modeStats,
  summarize,
  type SeasonFilter,
} from "@/lib/stats";
import { buildDemoBattles } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function DemoAnalyticsPage({
  searchParams,
}: {
  searchParams: { season?: string };
}) {
  const season = (searchParams.season ?? "all") as SeasonFilter;
  const all = buildDemoBattles(42, 48);
  const filtered = filterBySeason(all, season);
  const overview = summarize(filtered, { onlyRanked: false });

  const forward = [...all].sort(
    (a, b) => a.battleTime.getTime() - b.battleTime.getTime(),
  );
  let demoAccountTrophies = 38_000;
  for (const b of forward) {
    if (!b.isRanked) demoAccountTrophies += b.trophyChange ?? 0;
  }

  const demoRankedElo = overview.currentRating ?? 6042;
  const demoRankLabel = subTierProgress(demoRankedElo).current.name.toUpperCase();

  const brawlersRaw = brawlerStats(filtered, {
    rankedOnly: false,
    playerTag: "#DEMO",
  });
  const trophySnap = latestBrawlerTrophies(filtered, "#DEMO");
  const brawlers = brawlersRaw.map((b) => ({
    ...b,
    latestTrophies: trophySnap.get(b.brawlerId)?.trophies ?? null,
  }));

  const maps = mapStats(filtered, { rankedOnly: false });
  const modes = modeStats(filtered, { rankedOnly: false });

  return (
    <AnalyticsClient
      isDemo
      initial={{
        player: {
          tag: "#DEMO",
          name: "Demo Account",
          icon: 28000003,
          trophies: demoAccountTrophies,
          lastPolled: new Date().toISOString(),
          rankedElo: demoRankedElo,
          rankedRankName: demoRankLabel,
        },
        overview,
        brawlers,
        maps,
        modes,
        season: typeof season === "string" ? season : "all",
        slug: "demo",
      }}
    />
  );
}
