import Link from "next/link";
import { auth } from "@/auth";
import { tagForUrl } from "@/lib/tag";
import { signOutAction } from "@/app/auth-actions";

export async function AuthNav({ compact = false }: { compact?: boolean }) {
  const session = await auth();
  if (!session?.user) {
    return (
      <Link
        href="/login"
        className={compact ? "nav-login" : "nav-link"}
      >
        Sign in
      </Link>
    );
  }

  const dashHref = session.user.linkedPlayerTag
    ? `/dashboard/${tagForUrl(session.user.linkedPlayerTag)}`
    : "/connect-tag";

  if (compact) {
    return (
      <details className="relative">
        <summary className="nav-login cursor-pointer list-none">Account</summary>
        <div className="absolute right-0 top-full z-30 mt-2 min-w-36 rounded-xl border border-border bg-card p-2 shadow-xl">
          <Link href={dashHref} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">
            My dashboard
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </details>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link
        href={dashHref}
        className="nav-link"
      >
        My dashboard
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          className="nav-link"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
