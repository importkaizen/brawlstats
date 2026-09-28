"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Card,
  CardHeader,
  CardSubtitle,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FlashBanner, type FlashPayload } from "@/components/ui/FlashBanner";
import { DashboardHeader } from "./DashboardHeader";
import { PlayerHeading } from "./PlayerHeading";
import { MapBreakdown } from "@/components/dashboard/MapBreakdown";
import { ModeBreakdown } from "@/components/dashboard/ModeBreakdown";
import { AnalyticsBrawlerGrid } from "@/components/dashboard/AnalyticsBrawlerGrid";
import { formatPercent, formatRelative } from "@/lib/utils";
import type {
  BrawlerStat,
  MapStat,
  ModeStat,
  SeasonSummary,
} from "@/lib/stats";
import { listRecentSeasons } from "@/lib/seasons";
import { MANUAL_POLL_DISABLED_HINT } from "@/lib/guestRefreshCookie";

export type AnalyticsClientData = {
  player: {
    tag: string;
    name: string;
    icon: number;
    trophies: number;
    lastPolled: string;
    rankedElo: number | null;
    rankedRankName: string | null;
  };
  /** All captured modes (same scope as tables below). */
  overview: SeasonSummary;
  brawlers: BrawlerStat[];
  maps: MapStat[];
  modes: ModeStat[];
  season: string;
  slug: string;
};

export function AnalyticsClient({
  initial,
  isDemo = false,
  canManualPoll = false,
}: {
  initial: AnalyticsClientData;
  isDemo?: boolean;
  canManualPoll?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [season, setSeason] = useState(initial.season);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState<FlashPayload | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setData(initial), [initial]);

  const dismissFlash = useCallback(() => setFlash(null), []);

  const refreshLocked = !isDemo && !canManualPoll;

  const seasons = useMemo(() => listRecentSeasons(6), []);

  const onRefresh = useCallback(async () => {
    if (refreshLocked) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/players/${data.slug}/refresh`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setFlash({
          variant: "error",
          message: err.error ?? "Refresh failed",
        });
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setRefreshing(false);
    }
  }, [data.slug, router, refreshLocked]);

  const onSeasonChange = useCallback(
    (newSeason: string) => {
      setSeason(newSeason);
      const url = new URL(window.location.href);
      if (newSeason === "all") url.searchParams.delete("season");
      else url.searchParams.set("season", newSeason);
      router.replace(url.pathname + url.search);
    },
    [router],
  );

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

  const isAllTime = season === "all";
  const isCurrentSeason = season === "current";
  const o = data.overview;
  const decided = o.wins + o.losses;

  return (
    <main className="dashboard-shell mx-auto flex min-h-screen flex-col gap-6 px-4 pb-8 pt-4 sm:gap-7 sm:px-8">
      <DashboardHeader
        slug={data.slug}
        active="analytics"
        isDemo={isDemo}
        onShare={onShare}
      />

      <FlashBanner flash={flash} onDismiss={dismissFlash} />

      {isDemo && (
        <p className="text-xs text-muted-foreground">
          <span className="mr-2 rounded border border-border px-2 py-1 text-foreground">
            Demo
          </span>
          Sample analytics. Connect your tag to see your own performance.
        </p>
      )}

      <PlayerHeading
        name={data.player.name}
        tag={data.player.tag}
        icon={data.player.icon}
        section="Analytics"
      >
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-muted-foreground sm:block">
            Updated {formatRelative(data.player.lastPolled)}
          </span>
          {!isDemo && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          {isAllTime
            ? "All-time"
            : isCurrentSeason
              ? "This season"
              : `Season ${season}`}
        </h2>
        <div className="flex items-center gap-1.5">
          <SegmentBtn active={isAllTime} onClick={() => onSeasonChange("all")}>
            All-time
          </SegmentBtn>
          <SegmentBtn
            active={isCurrentSeason}
            onClick={() => onSeasonChange("current")}
          >
            This season
          </SegmentBtn>
          <select
            value={isAllTime || isCurrentSeason ? "" : season}
            onChange={(e) => {
              if (e.target.value) onSeasonChange(e.target.value);
            }}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs focus-visible:outline-none focus-visible:border-gold"
            aria-label="Older season"
          >
            <option value="">Older seasons…</option>
            {seasons.slice(1).map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Explore your captured battles by mode, map, and brawler. Trophy averages
        use ladder games.
      </p>

      <div className="metric-strip metric-triple grid-cols-3">
        <StatChip label="Battles" value={o.totalGames.toString()} />
        <StatChip
          label="Record"
          value={
            `${o.wins}–${o.losses}` + (o.draws ? ` (${o.draws} draws)` : "")
          }
        />
        <StatChip
          label="Win rate"
          value={decided === 0 ? "—" : formatPercent(o.winRate, 1)}
          valueClass={
            decided === 0
              ? undefined
              : o.winRate >= 0.5
                ? "text-win"
                : "text-loss"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>By game mode</CardTitle>
            <CardSubtitle>
              Aggregated win rate and trophy performance
            </CardSubtitle>
          </div>
        </CardHeader>
        <ModeBreakdown items={data.modes} />
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>By map</CardTitle>
            <CardSubtitle>
              Each map + mode pair from your battle history
            </CardSubtitle>
          </div>
        </CardHeader>
        <MapBreakdown items={data.maps} avgColumnLabel="Avg trophy Δ" />
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Brawlers</CardTitle>
            <CardSubtitle>
              Win rates, battle counts, and latest known ladder trophies.
            </CardSubtitle>
          </div>
        </CardHeader>
        <AnalyticsBrawlerGrid items={data.brawlers} />
      </Card>

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          Stats reflect your saved battle history. Refresh to capture your
          latest games.
        </p>
      </footer>
    </main>
  );
}

function SegmentBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="sort-control"
    >
      {children}
    </button>
  );
}

function StatChip({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="stat-card !px-3 sm:!px-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-3 text-xl font-semibold tracking-tight sm:text-3xl tabular-nums text-foreground ${valueClass ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}
