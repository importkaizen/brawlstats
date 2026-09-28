import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { normalizeTag, tagFromUrl } from "@/lib/tag";

export async function assertLinkedOwnerForRouteTag(encodedSlugParam: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Open this dashboard from the browser used to connect the tag to refresh or change settings.",
          code: "UNAUTHORIZED",
        },
        { status: 401 },
      ),
    };
  }

  const routeTag = tagFromUrl(encodedSlugParam);
  const linked = session.user.linkedPlayerTag;
  if (!linked || normalizeTag(linked) !== normalizeTag(routeTag)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Your account isn’t linked to this player tag. Open settings while signed in to link the tag you’re viewing.",
          code: "FORBIDDEN",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, session, tag: routeTag };
}

/** Server components: derive from cached session payload. */
export function canMutateFromSession(session: Session | null, playerTag: string) {
  const linked = session?.user?.linkedPlayerTag;
  if (!linked) return false;
  return normalizeTag(linked) === normalizeTag(playerTag);
}
