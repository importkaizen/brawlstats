import type { NextResponse } from "next/server";
import { normalizeTag, tagFromUrl } from "@/lib/tag";

/** HttpOnly cookie: last tag successfully connected via POST /api/players/connect (guest flow). */
export const GUEST_REFRESH_TAG_COOKIE = "myrebrawl_connected_tag";

export function attachGuestRefreshCookie(res: NextResponse, tag: string) {
  const normalized = normalizeTag(tag);
  res.cookies.set({
    name: GUEST_REFRESH_TAG_COOKIE,
    value: encodeURIComponent(normalized),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export function guestCookieMatchesDashboardSlug(
  cookieValue: string | undefined,
  encodedSlug: string,
): boolean {
  if (!cookieValue?.trim()) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(cookieValue);
  } catch {
    return false;
  }
  return normalizeTag(decoded) === normalizeTag(tagFromUrl(encodedSlug));
}

/** Tooltip when refresh/capture is blocked for guests without the connect cookie. */
export const MANUAL_POLL_DISABLED_HINT =
  "Use Connect on the home page with this browser first, or sign in and link your tag.";
