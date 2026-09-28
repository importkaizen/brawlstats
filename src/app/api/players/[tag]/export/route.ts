import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = [
  "battleTime",
  "season",
  "mode",
  "map",
  "result",
  "brawlerName",
  "brawlerId",
  "trophyChange",
  "ratingBefore",
  "ratingAfter",
  "duration",
  "isRanked",
] as const;

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const tag = tagFromUrl(params.tag);
  const player = await prisma.player.findUnique({
    where: { tag },
    include: { battles: { orderBy: { battleTime: "asc" } } },
  });
  if (!player) {
    return new Response("Player not found", { status: 404 });
  }

  const rows: string[] = [COLUMNS.join(",")];
  for (const b of player.battles) {
    rows.push(
      COLUMNS.map((c) => {
        const v = (b as unknown as Record<string, unknown>)[c];
        if (v instanceof Date) return v.toISOString();
        return csvEscape(v);
      }).join(","),
    );
  }
  const body = rows.join("\n");
  const filename = `myrebrawl-${tag.replace("#", "")}-battles.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
