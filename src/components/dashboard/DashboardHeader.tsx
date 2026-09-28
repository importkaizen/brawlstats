import Link from "next/link";
import {
  BarChart3,
  LayoutGrid,
  Settings2,
  Share2,
  Swords,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, buttonVariants } from "@/components/ui/Button";

export function DashboardHeader({
  slug,
  active,
  isDemo,
  onShare,
}: {
  slug: string;
  active: "profile" | "ranked" | "analytics" | "settings";
  isDemo?: boolean;
  onShare?: () => void;
}) {
  return (
    <header className="app-header">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-5">
          <Logo />
          <span className="hidden border-l border-border pl-5 text-xs text-muted-foreground sm:block">
            Brawl Stars companion
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {isDemo ? (
            <Link
              href="/"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Connect your tag <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShare}
                  aria-label="Share dashboard"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              )}
              <Link
                href={`/dashboard/${slug}/settings`}
                aria-label="Settings"
                aria-current={active === "settings" ? "page" : undefined}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </>
          )}
        </div>
      </div>
      <DashboardTabs slug={slug} active={active} isDemo={isDemo} />
    </header>
  );
}

export function DashboardTabs({
  slug,
  active,
  isDemo,
}: {
  slug: string;
  active: "profile" | "ranked" | "analytics" | "settings";
  isDemo?: boolean;
}) {
  const base = isDemo ? "/demo" : `/dashboard/${slug}`;
  const tabs = [
    { id: "profile", label: "Profile", href: base, Icon: LayoutGrid },
    { id: "ranked", label: "Ranked", href: `${base}/ranked`, Icon: Swords },
    {
      id: "analytics",
      label: "Analytics",
      href: `${base}/analytics`,
      Icon: BarChart3,
    },
  ];
  return (
    <nav className="dashboard-tabs" aria-label="Dashboard sections">
      {tabs.map(({ id, label, href, Icon }) => (
        <Link
          key={id}
          href={href}
          prefetch={false}
          aria-current={active === id ? "page" : undefined}
          className="dashboard-tab outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
