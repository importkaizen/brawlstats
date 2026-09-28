import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";
import { filterBySeason, summarize, type SeasonFilter } from "@/lib/stats";
import { subTierProgress } from "@/lib/rankedTiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const tag = tagFromUrl(params.tag);
  const season = (req.nextUrl.searchParams.get("season") ?? "current") as SeasonFilter;

  const player = await prisma.player.findUnique({
    where: { tag },
    include: {
      battles: {
        orderBy: { battleTime: "desc" },
      },
    },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const battles = filterBySeason(player.battles, season);
  const summary = summarize(battles, { onlyRanked: false });
  const { current, next, percent, pointsToNext } = subTierProgress(
    player.rankedElo ?? summary.currentRating ?? player.trophies,
  );
  const rank = { current, next, percent, pointsToNext };

  return NextResponse.json({
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
      rankedRank: player.rankedRank,
      rankedRankName: player.rankedRankName,
      peakRankedElo: player.peakRankedElo,
      peakAllTimeRankedElo: player.peakAllTimeRankedElo,
      peakAllTimeRankedRankName: player.peakAllTimeRankedRankName,
    },
    summary,
    rank,
    season,
  });
}
