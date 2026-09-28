import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";
import {
  accountTrophySeries,
  filterBySeason,
  filterTrophySeries,
  ratingHistory,
  type SeasonFilter,
} from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const tag = tagFromUrl(params.tag);
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(sp.get("from") as string) : null;
  const to = sp.get("to") ? new Date(sp.get("to") as string) : null;
  const season = (sp.get("season") ?? "current") as SeasonFilter;

  const player = await prisma.player.findUnique({
    where: { tag },
    include: { battles: { orderBy: { battleTime: "asc" } } },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  let battles = filterBySeason(player.battles, season);
  if (from) battles = battles.filter((b) => b.battleTime >= from);
  if (to) battles = battles.filter((b) => b.battleTime <= to);

  const metric = sp.get("metric") ?? "ranked";
  if (metric === "trophies") {
    const items = filterTrophySeries(
      accountTrophySeries(player.battles, player.trophies),
      battles,
    );
    return NextResponse.json({ metric: "trophies", items });
  }

  return NextResponse.json({ metric: "ranked", items: ratingHistory(battles) });
}
