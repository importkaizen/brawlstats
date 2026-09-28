import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { connectErrorResponse } from "@/lib/connectResponses";
import { attachGuestRefreshCookie } from "@/lib/guestRefreshCookie";
import { isValidTag, normalizeTag, tagForUrl } from "@/lib/tag";
import { pollPlayer } from "@/lib/poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ tag: z.string().min(2).max(20) });

type ErrorBody = {
  error: string;
  hint?: string;
  code?: string;
};

function fail(status: number, body: ErrorBody) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, { error: "Invalid JSON body", code: "BAD_JSON" });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail(400, { error: "Invalid body", code: "BAD_BODY" });
  }

  const tag = normalizeTag(parsed.data.tag);
  if (!isValidTag(tag)) {
    return fail(400, {
      error: "Tag must look like #2YPGV0Y9 — letters/digits only.",
      code: "BAD_TAG",
    });
  }

  try {
    const result = await pollPlayer(tag);
    const player = await prisma.player.findUniqueOrThrow({
      where: { tag },
      include: { _count: { select: { battles: true } } },
    });
    const res = NextResponse.json({
      player: {
        id: player.id,
        tag: player.tag,
        name: player.name,
        icon: player.icon,
        trophies: player.trophies,
        battles: player._count.battles,
        slug: tagForUrl(player.tag),
      },
      polled: { inserted: result.inserted, total: result.total },
    });
    attachGuestRefreshCookie(res, player.tag);
    return res;
  } catch (err) {
    return connectErrorResponse(err, tag);
  }
}
