import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectErrorResponse } from "@/lib/connectResponses";
import { isValidTag, normalizeTag, tagForUrl } from "@/lib/tag";
import { pollPlayer } from "@/lib/poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ tag: z.string().min(2).max(20) });

/** Load a match participant without changing the visitor's connected tag. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success || !isValidTag(parsed.data.tag)) {
    return NextResponse.json({ error: "Invalid player tag" }, { status: 400 });
  }

  const tag = normalizeTag(parsed.data.tag);
  try {
    await pollPlayer(tag);
    return NextResponse.json({ player: { slug: tagForUrl(tag) } });
  } catch (error) {
    return connectErrorResponse(error, tag);
  }
}
