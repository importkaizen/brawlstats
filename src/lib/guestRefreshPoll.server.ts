import { cookies } from "next/headers";
import {
  GUEST_REFRESH_TAG_COOKIE,
  guestCookieMatchesDashboardSlug,
} from "@/lib/guestRefreshCookie";

/** Dashboard Server Components: guest connect cookie matches this URL slug. */
export function guestPollCookieAllowsSlug(encodedSlug: string): boolean {
  const raw = cookies().get(GUEST_REFRESH_TAG_COOKIE)?.value;
  return guestCookieMatchesDashboardSlug(raw, encodedSlug);
}
