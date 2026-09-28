import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";
import { currentSeason } from "@/lib/seasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const tag = tagFromUrl(params.tag);
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 200);
  const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);
  const season = sp.get("season") ?? "current";

  const player = await prisma.player.findUnique({ where: { tag } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const where: {
    playerId: string;
    isRanked?: boolean;
    season?: string;
  } = { playerId: player.id };

  if (season === "current") where.season = currentSeason().id;
  else if (season !== "all") where.season = season;

  const [items, total] = await prisma.$transaction([
    prisma.battle.findMany({
      where,
      orderBy: { battleTime: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.battle.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((b) => ({
      id: b.id,
      battleTime: b.battleTime.toISOString(),
      mode: b.mode,
      map: b.map,
      result: b.result,
      brawlerId: b.brawlerId,
      brawlerName: b.brawlerName,
      trophyChange: b.trophyChange,
      ratingBefore: b.ratingBefore,
      ratingAfter: b.ratingAfter,
      duration: b.duration,
      isRanked: b.isRanked,
      season: b.season,
    })),
    total,
    limit,
    offset,
  });
}
