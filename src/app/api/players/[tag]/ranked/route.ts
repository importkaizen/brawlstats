import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";
import {
  buildRanked,
  extractStarPlayerTags,
  ratedAnchorBeforePool,
  priorRatedAfterInWindow,
  rankedBattlesPoolAsc,
} from "@/lib/rankedStats";
import { filterBattlesForRankedHistory } from "@/lib/rankedAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const tag = tagFromUrl(params.tag);
  const season = req.nextUrl.searchParams.get("season") ?? "current";

  const player = await prisma.player.findUnique({
    where: { tag },
    include: { battles: { orderBy: { battleTime: "asc" } } },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const battlesForRanked = filterBattlesForRankedHistory(
    player,
    player.battles,
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
    liveElo: player.rankedElo,
    priorRatedAfter,
    loggingStartRatedElo: player.rankedBaseline,
  };

  const starMap = extractStarPlayerTags(battlesForRanked);
  const ranked = buildRanked({
    battles: battlesForRanked,
    liveElo: player.rankedElo,
    baseline: player.rankedBaseline,
    baselineAt,
    season,
    starPlayerTagByBattleId: starMap,
    playerTag: player.tag,
    ratedAnchorBeforePool: ratedAnchorBeforePool(rankedRatedOpts),
    prependRatedStartPoint:
      priorRatedAfter != null
        ? false
        : player.rankedBaseline != null && baselineAt != null,
  });

  return NextResponse.json({
    player: {
      tag: player.tag,
      name: player.name,
      icon: player.icon,
      rankedElo: player.rankedElo,
      rankedRankName: player.rankedRankName,
      peakRankedElo: player.peakRankedElo,
      peakRankedRankName: player.peakRankedRankName,
      rankedBaseline: player.rankedBaseline,
      rankedBaselineAt: player.rankedBaselineAt?.toISOString() ?? null,
    },
    ranked: {
      hasBaseline: ranked.hasBaseline,
      baseline: ranked.baseline,
      baselineAt: ranked.baselineAt,
      summary: ranked.summary,
      rating: ranked.rating,
      brawlers: ranked.brawlers,
    },
    season,
  });
}
