import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchPlayer } from "@/lib/brawlstars";
import { isValidTag, normalizeTag } from "@/lib/tag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  tags: z.array(z.string().min(2).max(20)).min(1).max(12),
});

/** Live ranked standings for the participants in one match preview. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success || parsed.data.tags.some((tag) => !isValidTag(tag))) {
    return NextResponse.json({ error: "Invalid player tags" }, { status: 400 });
  }

  const tags = [...new Set(parsed.data.tags.map(normalizeTag))];
  const results = await Promise.allSettled(tags.map((tag) => fetchPlayer(tag)));
  const ranks = Object.fromEntries(
    tags.map((tag, index) => {
      const result = results[index];
      if (result?.status !== "fulfilled") return [tag, null];
      const player = result.value;
      return [
        tag,
        {
          rankedRank: player.rankedRank ?? null,
          rankedRankName: player.rankedRankName ?? null,
          rankedElo: player.rankedElo ?? null,
        },
      ];
    }),
  );

  return NextResponse.json({ ranks });
}
