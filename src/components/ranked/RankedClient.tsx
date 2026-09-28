"use client";

import {
  useMemo,
  useState,
  useTransition,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import {
  Card,
  CardHeader,
  CardSubtitle,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FlashBanner, type FlashPayload } from "@/components/ui/FlashBanner";
import { Badge } from "@/components/ui/Badge";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PlayerHeading } from "@/components/dashboard/PlayerHeading";
import { RankInsignia } from "./RankInsignia";
import { RecentForm } from "./RecentForm";
import { RankedMatchLog } from "./RankedMatchLog";
import { RankedChart } from "@/components/charts/LazyCharts";
import { BrawlerBreakdown } from "./BrawlerBreakdown";
import { getSubTier, subTierProgress } from "@/lib/rankedTiers";
import { formatNumber, formatPercent } from "@/lib/utils";
import { MANUAL_POLL_DISABLED_HINT } from "@/lib/guestRefreshCookie";
import type {
  RankedBrawlerRow,
  RankedMatchLogRow,
  RankedRatingPoint,
  RankedSummary,
} from "@/lib/rankedStats";

export type RankedDashboardData = {
  player: {
    tag: string;
    name: string;
    icon: number;
    slug: string;
    rankedBaseline: number | null;
    rankedBaselineAt: string | null;
    lastPolled?: string;
    /** Canonical rank name from /players/{tag}, e.g. "LEGENDARY I". */
    apiRankName?: string | null;
    /** Canonical absolute ranked rating from /players/{tag}. */
    apiRankedElo?: number | null;
    /** Numeric API rank index (1 = Bronze I, 22 = Pro). */
    apiRankedRank?: number | null;
    /** Career-high ranked elo (across every season). */
    allTimePeakElo?: number | null;
    allTimePeakRank?: number | null;
    allTimePeakRankName?: string | null;
    /** Same source as Profile / Analytics headers (`Player.trophies` / API snapshot). */
    accountTrophies?: number | null;
    /** Set when the user opted in via "Start logging ranked". */
    rankedLoggingStartedAt?: string | null;
  };
  hasBaseline: boolean;
  baseline: number | null;
  summary: RankedSummary;
  rating: RankedRatingPoint[];
  brawlers: RankedBrawlerRow[];
  seasonHeading: string;
  isDemo?: boolean;
  /** Ranked **round** rows stored on or after `rankedLoggingStartedAt` (DB). */
  totalRankedCaptured?: number;
  /** Completed FT2 games among stored rounds (same clustering as summary). */
  completedRankedMatchesCaptured?: number;
  /** Recent finished ranked games (newest first): one row per FT2 with rated Δ and elo after. */
  rankedMatchLog: RankedMatchLogRow[];
};

function playerApiBase(slug: string): string {
  return `/api/players/${encodeURIComponent(slug)}`;
}

function rankedOptInStorageKey(slug: string): string {
  return `myrebrawl:rankedOptIn:${slug}`;
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Bad response (${res.status}): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`,
    );
  }
}

export function RankedClient({
  data,
  canMutate = false,
  canManualPoll = false,
}: {
  data: RankedDashboardData;
  canMutate?: boolean;
  canManualPoll?: boolean;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [startingLog, setStartingLog] = useState(false);
  const [resettingLog, setResettingLog] = useState(false);
  /** Set after the settings API confirms opt-in (and mirrored in sessionStorage). */
  const [localRankedLoggingStartedAt, setLocalRankedLoggingStartedAt] =
    useState<string | null>(null);
  const [rankedOptInError, setRankedOptInError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashPayload | null>(null);
  const captureInFlight = useRef(false);
  const [, startTransition] = useTransition();

  const refreshLocked = !data.isDemo && !canManualPoll;
  /** Ranked logging toggles: linked tag **or** same browser guest-connect cookie as Capture. */
  const rankSettingsLocked = !data.isDemo && !canMutate && !canManualPoll;

  const dismissFlash = useCallback(() => setFlash(null), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const slug = data.player.slug;
    const serverAt = data.player.rankedLoggingStartedAt;
    if (serverAt) {
      setLocalRankedLoggingStartedAt(null);
      sessionStorage.removeItem(rankedOptInStorageKey(slug));
      return;
    }
    const stored = sessionStorage.getItem(rankedOptInStorageKey(slug));
    if (stored) {
      setLocalRankedLoggingStartedAt(stored);
    } else {
      setLocalRankedLoggingStartedAt(null);
    }
  }, [data.player.rankedLoggingStartedAt, data.player.slug]);

  const captureRanked = useCallback(
    async (automatic: boolean) => {
      if (data.isDemo || refreshLocked || captureInFlight.current) return;
      captureInFlight.current = true;
      setRefreshing(true);
      try {
        const res = await fetch(`${playerApiBase(data.player.slug)}/refresh`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setFlash({
            variant: "error",
            message: err.error ?? "Refresh failed",
          });
          return;
        }
        const result = (await res.json()) as { inserted?: number };
        if (!automatic) {
          setFlash({
            variant: "success",
            message: result.inserted
              ? `Captured ${result.inserted} new battles. The graph includes finished Ranked games.`
              : "Up to date. Brawl Stars has no new battles available yet.",
          });
        }
        startTransition(() => router.refresh());
      } catch (err) {
        setFlash({
          variant: "error",
          message: err instanceof Error ? err.message : "Refresh failed",
        });
      } finally {
        captureInFlight.current = false;
        setRefreshing(false);
      }
    },
    [data.player.slug, data.isDemo, refreshLocked, router, startTransition],
  );

  const onRefresh = useCallback(() => captureRanked(false), [captureRanked]);

  const onStartLogging = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (data.isDemo || rankSettingsLocked) return;
      setRankedOptInError(null);
      setStartingLog(true);
      try {
        const res = await fetch(`${playerApiBase(data.player.slug)}/settings`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startRankedLogging: true }),
        });
        const payload = (await readJsonResponse(res)) as {
          error?: string;
          player?: { rankedLoggingStartedAt?: string | null };
        };
        if (!res.ok) {
          setRankedOptInError(
            payload.error ?? `Could not start logging (HTTP ${res.status})`,
          );
          return;
        }
        const startedAt =
          payload.player?.rankedLoggingStartedAt ?? new Date().toISOString();
        try {
          sessionStorage.setItem(
            rankedOptInStorageKey(data.player.slug),
            startedAt,
          );
        } catch {
          // private mode / quota
        }
        flushSync(() => {
          setLocalRankedLoggingStartedAt(startedAt);
        });

        void (async () => {
          try {
            const refreshRes = await fetch(
              `${playerApiBase(data.player.slug)}/refresh`,
              {
                method: "POST",
                credentials: "same-origin",
              },
            );
            if (!refreshRes.ok) {
              const errPayload = (await readJsonResponse(refreshRes)) as {
                error?: string;
              };
              setRankedOptInError(
                errPayload.error ??
                  "Saved opt-in, but refresh failed. Try Capture now.",
              );
            }
          } catch (refreshErr) {
            console.error(refreshErr);
            setRankedOptInError(
              "Saved opt-in, but refresh failed. Try Capture now.",
            );
          } finally {
            startTransition(() => router.refresh());
          }
        })();
      } catch (err) {
        console.error(err);
        setRankedOptInError(
          err instanceof Error ? err.message : "Could not start logging",
        );
      } finally {
        setStartingLog(false);
      }
    },
    [
      data.player.slug,
      data.isDemo,
      rankSettingsLocked,
      router,
      startTransition,
    ],
  );

  const onResetRankedLogging = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (data.isDemo || rankSettingsLocked) return;
      const ok = window.confirm(
        "Clear this ranked logging session? Your start time and baseline anchor are removed. Past ranked battles stay in your history but won’t appear on the Ranked tab until you opt in again.",
      );
      if (!ok) return;
      setRankedOptInError(null);
      setResettingLog(true);
      try {
        const res = await fetch(`${playerApiBase(data.player.slug)}/settings`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startRankedLogging: false }),
        });
        const payload = (await readJsonResponse(res)) as { error?: string };
        if (!res.ok) {
          setRankedOptInError(
            payload.error ?? `Could not reset logging (HTTP ${res.status})`,
          );
          return;
        }
        try {
          sessionStorage.removeItem(rankedOptInStorageKey(data.player.slug));
        } catch {
          // ignore
        }
        flushSync(() => {
          setLocalRankedLoggingStartedAt(null);
        });
        setFlash({
          variant: "success",
          message:
            "Ranked logging cleared. Use Start logging ranked when you want a fresh session.",
        });
        startTransition(() => router.refresh());
      } catch (err) {
        console.error(err);
        setRankedOptInError(
          err instanceof Error ? err.message : "Could not reset logging",
        );
      } finally {
        setResettingLog(false);
      }
    },
    [
      data.player.slug,
      data.isDemo,
      rankSettingsLocked,
      router,
      startTransition,
    ],
  );

  const onShare = useCallback(() => {
    if (data.isDemo) return;
    const url = `${window.location.origin}/card/${data.player.slug}`;
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
  }, [data.player.slug, data.isDemo]);

  const lastPt = data.rating[data.rating.length - 1];
  const lastDelta =
    data.rating.length === 0 || !lastPt ? 0 : lastPt.trophyChange;

  const tier = useMemo(
    () => subTierProgress(data.summary.currentRating),
    [data.summary.currentRating],
  );

  // The Brawl Stars API ships the canonical rank name (e.g. "LEGENDARY I").
  // Prefer it over our threshold lookup so the displayed rank exactly
  // matches what the player sees in-game, including any edge cases at
  // promotion / demotion thresholds.
  const displayRankName =
    data.player.apiRankName?.trim() || tier.current.name.toUpperCase();
  // Pick the matching sub-tier metadata for color/glow lookup. Fall back
  // to the threshold-based tier we already computed.
  const apiTier = data.player.apiRankName
    ? getSubTier(data.player.apiRankedElo ?? data.summary.currentRating)
    : tier.current;

  const rankedLoggingStartedAtEffective =
    data.player.rankedLoggingStartedAt ?? localRankedLoggingStartedAt;
  const hasOptedIntoLogging = !!rankedLoggingStartedAtEffective;
  const showRankedDashboard = data.isDemo || hasOptedIntoLogging;

  useEffect(() => {
    if (data.isDemo || refreshLocked) return;
    const captureIfVisible = () => {
      if (document.visibilityState === "visible") void captureRanked(true);
    };
    const timer = window.setInterval(captureIfVisible, 60_000);
    document.addEventListener("visibilitychange", captureIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", captureIfVisible);
    };
  }, [data.isDemo, refreshLocked, captureRanked]);

  return (
    <main className="dashboard-shell mx-auto flex min-h-screen !max-w-none flex-col gap-6 px-4 pb-8 pt-4 sm:gap-7 sm:px-8">
      <DashboardHeader
        slug={data.player.slug}
        active="ranked"
        isDemo={data.isDemo}
        onShare={onShare}
      />
      <FlashBanner flash={flash} onDismiss={dismissFlash} />
      {data.isDemo && (
        <p className="text-xs text-muted-foreground">
          <span className="mr-2 rounded border border-border px-2 py-1 text-foreground">
            Demo
          </span>
          Sample Ranked data. Connect your tag to track your own climb.
        </p>
      )}
      <PlayerHeading
        name={data.player.name}
        tag={data.player.tag}
        icon={data.player.icon}
        section="Ranked"
      >
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:block">
            {data.seasonHeading}
          </span>
          {!data.isDemo && (
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
              {refreshing ? "Capturing" : "Capture now"}
            </Button>
          )}
        </div>
      </PlayerHeading>

      {!data.isDemo && !hasOptedIntoLogging && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">
                Start your Ranked session
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Choose a starting point for your rating curve. Captured battles
                are already saved in your match history.
              </p>
              {rankSettingsLocked && (
                <p className="mt-2 text-xs text-gold">
                  Connect this tag from the home page or sign in to start
                  tracking.
                </p>
              )}
            </div>
            <Button
              onClick={onStartLogging}
              disabled={startingLog || rankSettingsLocked}
            >
              {startingLog && <Loader2 className="h-4 w-4 animate-spin" />}
              {startingLog ? "Starting…" : "Start logging ranked"}
            </Button>
          </div>
          {rankedOptInError && (
            <p className="mt-3 text-xs text-loss" role="alert">
              {rankedOptInError}
            </p>
          )}
        </Card>
      )}

      {!data.isDemo && hasOptedIntoLogging && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-win">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tracking active
            </span>
            <span>Since {formatLogStart(rankedLoggingStartedAtEffective)}</span>
            <span>
              {data.completedRankedMatchesCaptured ?? 0} finished games ·{" "}
              {data.totalRankedCaptured ?? 0} rounds
            </span>
            {!refreshLocked && <span>Auto capture every minute</span>}
            {data.player.lastPolled && (
              <span>
                Last capture{" "}
                {new Date(data.player.lastPolled).toLocaleTimeString()}
              </span>
            )}
          </div>
          <details className="relative">
            <summary className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">
              Session options
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-card p-4 shadow-xl">
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Start a fresh rating curve. Your saved battle history stays in
                your archive.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onResetRankedLogging}
                disabled={resettingLog || rankSettingsLocked}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resettingLog ? "Resetting…" : "Reset logging session"}
              </Button>
            </div>
          </details>
          {rankedOptInError && (
            <p className="w-full text-loss" role="alert">
              {rankedOptInError}
            </p>
          )}
        </div>
      )}

      {showRankedDashboard && (
        <>
          <Card className="!p-5 sm:!p-6">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <RankInsignia
                  tier={apiTier}
                  size="lg"
                  rankedRank={data.player.apiRankedRank ?? null}
                />
                <div className="min-w-0">
                  <p className="section-kicker">Current standing</p>
                  <h2
                    className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
                    style={{ color: apiTier.color }}
                  >
                    {displayRankName}
                  </h2>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-3xl font-semibold tracking-tight tabular-nums">
                      {formatNumber(data.summary.currentRating)}
                    </span>
                    <span className="text-xs text-muted-foreground">ELO</span>
                    {lastDelta !== 0 && (
                      <span
                        className={`text-xs font-medium ${lastDelta > 0 ? "text-win" : "text-loss"}`}
                      >
                        {lastDelta > 0 ? "+" : ""}
                        {lastDelta} last game
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full lg:max-w-sm">
                {tier.next ? (
                  <>
                    <div className="mb-2 flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Next:{" "}
                        <span style={{ color: tier.next.color }}>
                          {tier.next.name}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {formatNumber(tier.pointsToNext)} ELO away
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${tier.percent}%`,
                          background: tier.current.color,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Highest rank reached.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-muted-foreground">
                      Recent form
                    </span>
                    <RecentForm results={data.summary.recentForm} />
                  </div>
                  <Badge
                    tone={
                      data.summary.streak.type === "win"
                        ? "win"
                        : data.summary.streak.type === "loss"
                          ? "loss"
                          : "default"
                    }
                  >
                    {data.summary.streak.type === "none"
                      ? "No streak"
                      : `${data.summary.streak.length}${data.summary.streak.type === "win" ? "W" : "L"} streak`}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <section
            className="metric-strip sm:grid-cols-4"
            aria-label="Ranked stats"
          >
            <RankedMetric
              label="Season record"
              value={`${data.summary.wins} – ${data.summary.losses}`}
              hint={`${formatNumber(data.summary.totalGames)} finished games`}
            />
            <RankedMetric
              label="Win rate"
              value={
                data.summary.totalGames === 0
                  ? "—"
                  : formatPercent(data.summary.winRate, 1)
              }
              hint={`${data.summary.starPlayerCount} star player ${data.summary.starPlayerCount === 1 ? "award" : "awards"} · ${data.summary.totalGames === 0 ? "—" : formatPercent(data.summary.starPlayerRate, 0)}`}
            />
            <RankedMetric
              label="Season best"
              value={formatNumber(data.summary.peakRating)}
              hint={getSubTier(data.summary.peakRating).name}
            />
            <RankedMetric
              label="Career best"
              value={
                data.player.allTimePeakElo != null
                  ? formatNumber(data.player.allTimePeakElo)
                  : "—"
              }
              hint={
                data.player.allTimePeakRankName ?? "No career peak recorded"
              }
            />
          </section>

          <Card className="min-w-0">
            <CardHeader>
              <div>
                <CardTitle>Rating progression</CardTitle>
                <CardSubtitle>
                  {data.seasonHeading} · {data.summary.netChange > 0 ? "+" : ""}
                  {formatNumber(data.summary.netChange)} ELO since your starting
                  point
                </CardSubtitle>
              </div>
              <span className="hidden section-kicker sm:inline">Ranked</span>
            </CardHeader>
            <RankedChart data={data.rating} />
            <details className="mt-5 border-t border-border pt-4 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">
                How your rating is tracked
              </summary>
              <p className="mt-2 max-w-2xl leading-relaxed">
                Each point represents a finished Ranked game, after two round
                wins. Ratings are saved when captured. Games captured together
                may share a rating because Brawl Stars does not provide every
                historical ELO change. Games in progress appear once finished.
              </p>
            </details>
          </Card>

          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <div>
                  <CardTitle>Brawler performance</CardTitle>
                  <CardSubtitle>Your Ranked record this season</CardSubtitle>
                </div>
              </CardHeader>
              <BrawlerBreakdown rows={data.brawlers} />
            </Card>
            <Card className="min-w-0">
              <CardHeader>
                <div>
                  <CardTitle>Ranked game log</CardTitle>
                  <CardSubtitle>One entry per finished game</CardSubtitle>
                </div>
              </CardHeader>
              <RankedMatchLog rows={data.rankedMatchLog} />
            </Card>
          </div>
        </>
      )}
      <footer className="border-t border-border pt-5 text-[11px] text-muted-foreground">
        {showRankedDashboard
          ? "Ratings are captured from your live profile. Only Ranked games contribute to this curve."
          : "Start a Ranked session to build your rating curve."}
      </footer>
    </main>
  );
}

function formatLogStart(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RankedMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="stat-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
