"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  ArrowUpRight,
  Trophy,
  Swords,
  Check,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardSubtitle,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FlashBanner, type FlashPayload } from "@/components/ui/FlashBanner";
import { RankInsignia } from "@/components/ranked/RankInsignia";
import { RatingChart } from "@/components/charts/LazyCharts";
import { RecentMatches } from "@/components/dashboard/RecentMatches";
import type { MatchRow } from "@/components/dashboard/matchRow";
import { BrawlerGrid } from "@/components/dashboard/BrawlerGrid";
import { MapBreakdown } from "@/components/dashboard/MapBreakdown";
import { OwnedBrawlersShelf } from "@/components/dashboard/OwnedBrawlersShelf";
import { DashboardHeader } from "./DashboardHeader";
import { PlayerHeading } from "./PlayerHeading";
import { MANUAL_POLL_DISABLED_HINT } from "@/lib/guestRefreshCookie";
import { formatNumber, formatPercent, formatRelative } from "@/lib/utils";
import type {
  BrawlerStat,
  MapStat,
  SeasonSummary,
  TrophyChartPoint,
} from "@/lib/stats";
import type { OwnedBrawlerSnap } from "@/lib/playerRoster";
import { ladderTrophyMapFromOwnedRoster } from "@/lib/playerRoster";
import type { RankedSubTier } from "@/lib/rankedTiers";
import type { MatchHistoryPage } from "@/lib/matchHistory";

type DashboardData = {
  player: {
    id: string;
    tag: string;
    name: string;
    icon: number;
    trophies: number;
    highestTrophies: number;
    lastPolled: string;
    trackOnlyRanked: boolean;
    rankedElo: number | null;
    rankedRankName: string | null;
    rankedRank: number | null;
    peakAllTimeRankedElo: number | null;
    peakAllTimeRankedRank: number | null;
    peakAllTimeRankedRankName: string | null;
    peakSeasonRankedElo: number | null;
    peakSeasonRankedRankName: string | null;
  };
  summary: SeasonSummary;
  rank: {
    current: RankedSubTier;
    next: RankedSubTier | null;
    percent: number;
    pointsToNext: number;
  };
  trophyCurve: TrophyChartPoint[];
  matches: MatchRow[];
  history?: MatchHistoryPage;
  roster: OwnedBrawlerSnap[];
  brawlers: BrawlerStat[];
  maps: MapStat[];
  slug: string;
};

export function DashboardClient({
  initial,
  isDemo = false,
  canManualPoll = false,
}: {
  initial: DashboardData;
  isDemo?: boolean;
  /** Guest connect cookie or linked owner — enables POST /refresh from this dashboard. */
  canManualPoll?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState<FlashPayload | null>(null);
  const [, startTransition] = useTransition();
  const captureInFlight = useRef(false);
  const lastCaptureAt = useRef(Date.parse(initial.player.lastPolled));

  const dismissFlash = useCallback(() => setFlash(null), []);

  // Sync if a route param / SSR change rolls fresh data through
  useEffect(() => setData(initial), [initial]);

  const refreshLocked = !isDemo && !canManualPoll;

  const onRefresh = useCallback(
    async (automatic = false) => {
      if (refreshLocked || isDemo || captureInFlight.current) return;
      captureInFlight.current = true;
      setRefreshing(true);
      try {
        const res = await fetch(`/api/players/${data.slug}/refresh`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!automatic)
            setFlash({
              variant: "error",
              message: err.error ?? "Refresh failed",
            });
          return;
        }
        lastCaptureAt.current = Date.now();
        startTransition(() => router.refresh());
      } catch {
        if (!automatic)
          setFlash({
            variant: "error",
            message: "Refresh failed. Try again in a minute.",
          });
      } finally {
        captureInFlight.current = false;
        setRefreshing(false);
      }
    },
    [data.slug, router, refreshLocked, isDemo],
  );

  useEffect(() => {
    if (isDemo || refreshLocked) return;
    const captureIfVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastCaptureAt.current >= 60_000
      ) {
        void onRefresh(true);
      }
    };
    captureIfVisible();
    const timer = window.setInterval(captureIfVisible, 60_000);
    document.addEventListener("visibilitychange", captureIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", captureIfVisible);
    };
  }, [isDemo, refreshLocked, onRefresh]);

  const onShare = useCallback(() => {
    const url = `${window.location.origin}/card/${data.slug}`;
    void (async () => {
      try {
        await navigator.clipboard.writeText(url);
        setFlash({
          variant: "success",
          message: "Share link copied to clipboard.",
        });
      } catch {
        setFlash({
          variant: "error",
          message: `Couldn't copy automatically. Link: ${url}`,
        });
      }
    })();
  }, [data.slug]);

  const viewerLadderTrophyMap = useMemo(
    () => ladderTrophyMapFromOwnedRoster(data.roster),
    [data.roster],
  );

  return (
    <main className="dashboard-shell mx-auto flex min-h-screen flex-col gap-6 px-4 pb-8 pt-4 sm:gap-7 sm:px-8">
      <DashboardHeader
        slug={data.slug}
        active="profile"
        isDemo={isDemo}
        onShare={onShare}
      />
      <FlashBanner flash={flash} onDismiss={dismissFlash} />
      {isDemo && (
        <p className="text-xs text-muted-foreground">
          <span className="mr-2 rounded border border-border px-2 py-1 text-foreground">
            Demo
          </span>
          Sample player data. Connect your tag to see your own stats.
        </p>
      )}

      <PlayerHeading
        name={data.player.name}
        tag={data.player.tag}
        icon={data.player.icon}
        section="Player overview"
      >
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-muted-foreground sm:block">
            Updated {formatRelative(data.player.lastPolled)}
          </span>
          {!isDemo && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onRefresh()}
              disabled={refreshing || refreshLocked}
              title={refreshLocked ? MANUAL_POLL_DISABLED_HINT : undefined}
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          )}
        </div>
      </PlayerHeading>

      <section
        className="metric-strip sm:grid-cols-4"
        aria-label="Player stats"
      >
        <OverviewMetric
          label="Account trophies"
          value={formatNumber(data.player.trophies)}
          hint={`Best ${formatNumber(data.player.highestTrophies)}`}
          icon={<Trophy className="h-3.5 w-3.5 text-gold" />}
        />
        <OverviewMetric
          label="Ranked rating"
          value={
            data.player.rankedElo != null
              ? formatNumber(data.player.rankedElo)
              : "—"
          }
          hint={data.player.rankedRankName ?? "Play Ranked to get started"}
          icon={<Swords className="h-3.5 w-3.5" />}
        />
        <OverviewMetric
          label="Win rate"
          value={
            data.summary.totalGames > 0
              ? formatPercent(data.summary.winRate, 1)
              : "—"
          }
          hint={`${data.summary.wins} wins / ${data.summary.losses} losses`}
        />
        <OverviewMetric
          label="Saved battles"
          value={formatNumber(data.history?.total ?? data.summary.totalGames)}
          hint="Your captured match archive"
        />
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>Trophy progression</CardTitle>
              <CardSubtitle>
                Your last {data.trophyCurve.length} captured matches
              </CardSubtitle>
            </div>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <RatingChart data={data.trophyCurve} variant="trophyLadder" />
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-[10px] text-muted-foreground">
              Across your saved history
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Net change</p>
                <p className="mt-1 font-medium tabular-nums">
                  {data.summary.netChange > 0 ? "+" : ""}
                  {formatNumber(data.summary.netChange)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg. trophy change</p>
                <p className="mt-1 font-medium tabular-nums">
                  {data.summary.avgTrophyChange > 0 ? "+" : ""}
                  {data.summary.avgTrophyChange.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Current streak</p>
                <p className="mt-1 font-medium">
                  {data.summary.streak.type === "none"
                    ? "—"
                    : `${data.summary.streak.length} ${data.summary.streak.type === "win" ? "wins" : "losses"}`}
                </p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Ranked standing</CardTitle>
            <Link
              className="text-link"
              href={isDemo ? "/demo/ranked" : `/dashboard/${data.slug}/ranked`}
              aria-label="View Ranked dashboard"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          {data.player.rankedElo != null ? (
            <>
              <div className="flex flex-1 flex-col items-center justify-center py-5">
                <RankInsignia
                  tier={data.rank.current}
                  rankedRank={data.player.rankedRank}
                  size="lg"
                />
                <h2
                  className="mt-3 text-xl font-semibold"
                  style={{ color: data.rank.current.color }}
                >
                  {data.player.rankedRankName ?? data.rank.current.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.rank.next
                    ? `${formatNumber(data.rank.pointsToNext)} ELO to ${data.rank.next.name}`
                    : "Highest rank reached"}
                </p>
              </div>
              {data.rank.next && (
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${data.rank.percent}%`,
                      background: data.rank.current.color,
                    }}
                  />
                </div>
              )}
              <dl className="space-y-3 border-t border-border pt-4 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Season best</dt>
                  <dd className="font-medium tabular-nums">
                    {data.player.peakSeasonRankedElo != null
                      ? formatNumber(data.player.peakSeasonRankedElo)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Career best</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {data.player.peakAllTimeRankedElo != null
                      ? formatNumber(data.player.peakAllTimeRankedElo)
                      : "—"}
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {data.player.peakAllTimeRankedRankName}
                    </span>
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="py-12 text-sm leading-relaxed text-muted-foreground">
              Play a Ranked game and refresh to see your standing here.
            </p>
          )}
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {isDemo ? "Recent matches" : "Saved match history"}
            </CardTitle>
            <CardSubtitle>
              {data.history
                ? `Showing ${formatNumber(data.history.from)}–${formatNumber(data.history.to)} of ${formatNumber(data.history.total)} saved battles`
                : `Last ${data.matches.length} battles`}
            </CardSubtitle>
          </div>
          {!isDemo && (
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
              <Check className="h-3.5 w-3.5 text-win" />
              History saved
            </span>
          )}
        </CardHeader>
        <RecentMatches
          rows={data.matches}
          viewerTag={data.player.tag}
          viewerLadderTrophyMap={viewerLadderTrophyMap}
        />
        {data.history && data.history.pageCount > 1 && (
          <nav
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm"
            aria-label="Match history pages"
          >
            <span className="text-xs text-muted-foreground">
              Page {data.history.page} of {data.history.pageCount}
            </span>
            <div className="flex gap-2">
              {data.history.page > 1 && (
                <Link
                  href={`/dashboard/${data.slug}?historyPage=${data.history.page - 1}`}
                  scroll={false}
                  className="rounded-md border border-border px-3 py-2 text-xs transition-colors hover:bg-muted"
                >
                  Newer games
                </Link>
              )}
              {data.history.page < data.history.pageCount && (
                <Link
                  href={`/dashboard/${data.slug}?historyPage=${data.history.page + 1}`}
                  scroll={false}
                  className="rounded-md border border-border px-3 py-2 text-xs transition-colors hover:bg-muted"
                >
                  Older games
                </Link>
              )}
            </div>
          </nav>
        )}
      </Card>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>Brawler performance</CardTitle>
              <CardSubtitle>Your captured Ranked games</CardSubtitle>
            </div>
          </CardHeader>
          <BrawlerGrid items={data.brawlers} />
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>Map performance</CardTitle>
              <CardSubtitle>Ranked maps and modes</CardSubtitle>
            </div>
          </CardHeader>
          <MapBreakdown items={data.maps} />
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Your brawlers</CardTitle>
            <CardSubtitle>
              {data.roster.length} owned · sorted by trophies
            </CardSubtitle>
          </div>
        </CardHeader>
        <OwnedBrawlersShelf roster={data.roster} />
      </Card>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-5 text-[11px] text-muted-foreground">
        <span>
          Captured games stay in your archive after leaving the Brawl Stars
          battle log.
        </span>
        {!isDemo && canManualPoll && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-win" />
            Auto capture every minute while open
          </span>
        )}
      </footer>
    </main>
  );
}

function OverviewMetric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
