import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";
import { filterBySeason, mapStats, type SeasonFilter } from "@/lib/stats";

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
    include: { battles: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const battles = filterBySeason(player.battles, season);
  return NextResponse.json({ items: mapStats(battles) });
}
