import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { tagFromUrl } from "@/lib/tag";
import { pollPlayer } from "@/lib/poll";
import { BrawlApiError } from "@/lib/brawlstars";
import {
  GUEST_REFRESH_TAG_COOKIE,
  guestCookieMatchesDashboardSlug,
} from "@/lib/guestRefreshCookie";
import { assertLinkedOwnerForRouteTag } from "@/lib/playerMutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const gate = await assertLinkedOwnerForRouteTag(params.tag);
  if (!gate.ok) {
    const session = await auth();
    if (session?.user?.id) return gate.response;
    const cookieRaw = req.cookies.get(GUEST_REFRESH_TAG_COOKIE)?.value;
    if (!guestCookieMatchesDashboardSlug(cookieRaw, params.tag)) {
      return gate.response;
    }
  }

  const tag = tagFromUrl(params.tag);
  try {
    const result = await pollPlayer(tag);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BrawlApiError) {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status === 404 ? 404 : 502 },
      );
    }
    console.error("manual refresh failed", err);
    return NextResponse.json(
      { error: "Refresh failed. Try again in a minute." },
      { status: 500 },
    );
  }
}
