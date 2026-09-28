import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { loadDashboardPlayerWithBattlesDesc } from "@/lib/dashboardPlayerLoad";
import { tagForUrl } from "@/lib/tag";
import {
  brawlerStats,
  filterBySeason,
  latestBrawlerTrophies,
  mapStats,
  modeStats,
  summarize,
  type SeasonFilter,
} from "@/lib/stats";
import { AnalyticsClient } from "@/components/dashboard/AnalyticsClient";
import { guestPollCookieAllowsSlug } from "@/lib/guestRefreshPoll.server";
import { canMutateFromSession } from "@/lib/playerMutations";
import { ownedBrawlerTrophyMap } from "@/lib/playerRoster";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: { playerTag: string };
  searchParams: { season?: string };
}) {
  const player = await loadDashboardPlayerWithBattlesDesc(params.playerTag);
  if (!player) return notFound();

  const session = await auth();
  const canManualPoll =
    canMutateFromSession(session, player.tag) ||
    guestPollCookieAllowsSlug(params.playerTag);

  const season = (searchParams.season ?? "all") as SeasonFilter;
  const filtered = filterBySeason(player.battles, season);
  const overview = summarize(filtered, { onlyRanked: false });

  const brawlersRaw = brawlerStats(filtered, {
    rankedOnly: false,
    playerTag: player.tag,
  });
  const trophySnap = latestBrawlerTrophies(filtered, player.tag);
  const rosterTrophies = ownedBrawlerTrophyMap(player.ownedBrawlersJson);
  const brawlers = brawlersRaw.map((b) => ({
    ...b,
    latestTrophies:
      trophySnap.get(b.brawlerId)?.trophies ??
      rosterTrophies.get(b.brawlerId) ??
      null,
  }));

  const maps = mapStats(filtered, { rankedOnly: false });
  const modes = modeStats(filtered, { rankedOnly: false });

  return (
    <AnalyticsClient
      initial={{
        player: {
          tag: player.tag,
          name: player.name,
          icon: player.icon,
          trophies: player.trophies,
          lastPolled: player.lastPolled.toISOString(),
          rankedElo: player.rankedElo,
          rankedRankName: player.rankedRankName,
        },
        overview,
        brawlers,
        maps,
        modes,
        season: typeof season === "string" ? season : "all",
        slug: tagForUrl(player.tag),
      }}
      canManualPoll={canManualPoll}
    />
  );
}
