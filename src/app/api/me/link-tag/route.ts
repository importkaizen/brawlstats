import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { connectErrorResponse } from "@/lib/connectResponses";
import { isValidTag, normalizeTag, tagForUrl } from "@/lib/tag";
import { pollPlayer } from "@/lib/poll";
import { duplicateTagResponse, findUserIdBlockingTagLink } from "@/lib/userTagLink";
import { attachGuestRefreshCookie } from "@/lib/guestRefreshCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ tag: z.string().min(2).max(20) });

function jsonError(status: number, error: string, code: string) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "Sign in to link your Brawl Stars tag.", "UNAUTHORIZED");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body", "BAD_JSON");
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid body", "BAD_BODY");
  }

  const tag = normalizeTag(parsed.data.tag);
  if (!isValidTag(tag)) {
    return jsonError(
      400,
      "Tag must look like #2YPGV0Y9 — letters/digits only.",
      "BAD_TAG",
    );
  }

  const blocker = await findUserIdBlockingTagLink(
    prisma,
    tag,
    session.user.id,
  );
  if (blocker) {
    return duplicateTagResponse();
  }

  try {
    const result = await pollPlayer(tag);
    const player = await prisma.player.findUniqueOrThrow({
      where: { tag },
      include: { _count: { select: { battles: true } } },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        linkedPlayerTag: player.tag,
        linkedPlayerId: player.id,
      },
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
