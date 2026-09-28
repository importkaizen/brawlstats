"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RANKED_SUB_TIERS, getSubTier } from "@/lib/rankedTiers";
import { cn } from "@/lib/utils";
import { formatChartValue, matchAxis } from "@/lib/chartScale";
import { rankedValueAxis, visibleMatchRange } from "@/lib/rankedChartScale";
import { ChartToolbar } from "@/components/charts/ChartChrome";
import { useAnimatedChartDomain } from "@/components/charts/useAnimatedChartDomain";

type Point = {
  battleTime: string;
  /** Rated elo after this FT2 ends — drives the chart line so demotions show correctly. */
  ratingAfter: number;
  /** Peak elo reached on any round of this outing — tooltip only when it differs from {@link ratingAfter}. */
  peakRatingDuringMatch?: number;
  /** Resolved swing within this outing (peak − elo before first round). */
  ratedMatchSwing?: number;
  trophyChange: number;
  result: string;
  brawlerName: string;
};

function chartDisplayRating(p: Point): number {
  return p.ratingAfter;
}

const DIVISION_OPACITY = { 1: 0.14, 2: 0.23, 3: 0.32 };

export function RankedChart({ data }: { data: Point[] }) {
  const [fromZero, setFromZero] = useState(false);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [viewedMatches, setViewedMatches] = useState<[number, number] | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const gradientId = `ranked-fill-${useId().replace(/:/g, "")}`;
  data = useMemo(
    () => data.filter((point) => Number.isFinite(point.ratingAfter)),
    [data],
  );
  const firstMatch = data[0]?.brawlerName === "Ranked start" ? 0 : 1;
  const lastMatch = data.filter(
    (point) => point.brawlerName !== "Ranked start",
  ).length;

  const updateViewedMatches = useCallback(
    (viewport: HTMLDivElement) => {
      const range = visibleMatchRange([firstMatch, lastMatch], {
        scrollLeft: viewport.scrollLeft,
        viewportWidth: viewport.clientWidth,
        canvasWidth: viewport.scrollWidth,
      });
      setViewedMatches((previous) =>
        previous?.[0] === range[0] && previous[1] === range[1]
          ? previous
          : range,
      );
    },
    [firstMatch, lastMatch],
  );

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const updateViewport = () => {
      setCanScroll(viewport.scrollWidth > viewport.clientWidth + 1);
      if (followLatest.current)
        viewport.scrollLeft = viewport.scrollWidth - viewport.clientWidth;
      updateViewedMatches(viewport);
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(viewport);
    if (viewport.firstElementChild)
      observer.observe(viewport.firstElementChild);
    return () => observer.disconnect();
  }, [data.length, updateViewedMatches]);

  const ratings = useMemo(() => data.map(chartDisplayRating), [data]);
  const points = useMemo(() => {
    let gameNumber = 0;
    return data.map((d) => {
      const isRankedStart = d.brawlerName === "Ranked start";
      if (!isRankedStart) gameNumber++;
      return {
        ...d,
        chartY: chartDisplayRating(d),
        ts: new Date(d.battleTime).getTime(),
        idx: gameNumber,
        gameNumber: isRankedStart ? null : gameNumber,
        isRankedStart,
      };
    });
  }, [data]);
  const viewedRatings = useMemo(
    () =>
      viewedMatches
        ? points
            .filter(
              (point) =>
                point.idx >= viewedMatches[0] && point.idx <= viewedMatches[1],
            )
            .map((point) => point.chartY)
        : ratings,
    [viewedMatches, points, ratings],
  );
  const scale = useMemo(
    () => rankedValueAxis(ratings, fromZero, viewedRatings),
    [ratings, fromZero, viewedRatings],
  );
  const animatedDomain = useAnimatedChartDomain(scale.domain);
  const [yMin, yMax] = animatedDomain;
  const visibleTicks = scale.ticks.filter(
    (tick) => tick >= yMin && tick <= yMax,
  );

  if (data.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center text-center text-muted-foreground sm:h-[520px] lg:h-[600px]">
        <p className="font-display text-base uppercase tracking-wide">
          No finished ranked games in this window
        </p>
        <p className="text-sm">
          Finish a ranked FT2 game (first to two round wins); partial streaks
          don&apos;t appear on this curve.
        </p>
      </div>
    );
  }
  const rankBoundaries = RANKED_SUB_TIERS.filter(
    (tier) => tier.threshold >= yMin && tier.threshold <= yMax,
  );
  const rankBands = RANKED_SUB_TIERS.map((tier, index) => ({
    ...tier,
    lower: Math.max(yMin, tier.threshold),
    upper: Math.min(yMax, RANKED_SUB_TIERS[index + 1]?.threshold ?? yMax),
  })).filter((band) => band.upper > band.lower);
  const canvasMinWidth =
    points.length > 1
      ? Math.max(1800, Math.min(12000, lastMatch * 100 + 40))
      : 0;
  const xScale = matchAxis(
    points[0].idx,
    points[points.length - 1].idx,
    Math.max(5, Math.floor(width / 100)),
  );

  const moveTo = (latest: boolean) => {
    followLatest.current = latest;
    const viewport = scrollRef.current;
    if (viewport) {
      viewport.scrollTo({
        left: latest ? viewport.scrollWidth - viewport.clientWidth : 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  };

  return (
    <div className="min-w-0 w-full">
      <ChartToolbar
        min={scale.min}
        max={scale.max}
        unit="Ranked rating"
        fromZero={fromZero}
        onScaleChange={setFromZero}
      />
      {!fromZero && (
        <p className="mb-3 text-xs text-muted-foreground">
          {scale.focusTier && (
            <span style={{ color: scale.focusTier.color }}>
              {scale.focusTier.name} focus ·{" "}
            </span>
          )}
          ELO follows visible matches
        </p>
      )}
      {canScroll && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Scroll sideways to explore match order</span>
          <div className="flex items-center gap-2">
            {[
              { label: "First match", latest: false },
              { label: "Latest match", latest: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => moveTo(option.latest)}
                className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex h-[420px] w-full sm:h-[520px] lg:h-[600px]">
        <div
          className="relative w-16 shrink-0 text-xs text-[#8f9299]"
          aria-label="ELO axis"
        >
          <div
            className="absolute inset-x-0 top-6"
            style={{ height: Math.max(0, height - 64) }}
          >
            {visibleTicks.map((tick) => (
              <span
                key={tick}
                className="absolute right-2 -translate-y-1/2 tabular-nums"
                style={{
                  top: `${((yMax - tick) / (yMax - yMin)) * 100}%`,
                  color: getSubTier(tick).color,
                  fontWeight: rankBoundaries.some(
                    (tier) => tier.threshold === tick,
                  )
                    ? 700
                    : 400,
                }}
              >
                {formatChartValue(tick)}
              </span>
            ))}
          </div>
        </div>
        <div
          ref={scrollRef}
          className="ranked-chart-scroll min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          role="region"
          aria-label="Ranked match history, scroll horizontally"
          tabIndex={0}
          onScroll={(event) => {
            const viewport = event.currentTarget;
            followLatest.current =
              viewport.scrollWidth -
                viewport.clientWidth -
                viewport.scrollLeft <
              32;
            updateViewedMatches(viewport);
          }}
        >
          <div className="h-full w-full" style={{ minWidth: canvasMinWidth }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              debounce={50}
              onResize={(chartWidth, chartHeight) => {
                setWidth(chartWidth);
                setHeight(chartHeight);
              }}
            >
              <ComposedChart
                data={points}
                margin={{ top: 24, right: 20, left: 0, bottom: 10 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ECEBE7" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#ECEBE7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {rankBands.map((band) => (
                  <ReferenceArea
                    key={band.name}
                    y1={band.lower}
                    y2={band.upper}
                    fill={band.color}
                    fillOpacity={
                      band.division == null
                        ? 0.23
                        : DIVISION_OPACITY[band.division]
                    }
                    stroke="none"
                    zIndex={-200}
                    pointerEvents="none"
                  />
                ))}
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 6"
                  stroke="rgba(255,255,255,0.07)"
                />
                <XAxis
                  dataKey="idx"
                  type="number"
                  domain={xScale.domain}
                  ticks={xScale.ticks}
                  allowDecimals={false}
                  padding={{ left: 8, right: 8 }}
                  tickFormatter={(value: number) =>
                    value === 0 ? "Start" : String(value)
                  }
                  stroke="#8f9299"
                  fontSize={12}
                  tickMargin={12}
                  minTickGap={18}
                  interval="preserveStartEnd"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  hide
                  domain={animatedDomain}
                  allowDataOverflow
                  ticks={visibleTicks}
                  allowDecimals={false}
                  tickFormatter={formatChartValue}
                  stroke="#8f9299"
                  fontSize={12}
                  width={0}
                  tickMargin={10}
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                />

                {rankBoundaries.map((t) => (
                  <ReferenceLine
                    key={t.name}
                    y={t.threshold}
                    stroke={t.color}
                    strokeWidth={
                      t.division === 1 || t.division === null ? 2.5 : 1.5
                    }
                    strokeDasharray={
                      t.division === 1 || t.division === null
                        ? undefined
                        : "3 6"
                    }
                    strokeOpacity={
                      t.division === 1 || t.division === null ? 0.95 : 0.55
                    }
                  />
                ))}

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as Point & {
                      idx: number;
                      chartY: number;
                      gameNumber: number | null;
                      isRankedStart: boolean;
                    };
                    const display = p.chartY;
                    const tier = getSubTier(display);
                    const peakDiff =
                      p.peakRatingDuringMatch != null &&
                      p.peakRatingDuringMatch !== p.ratingAfter;
                    const deltaTone =
                      p.trophyChange > 0
                        ? "text-win"
                        : p.trophyChange < 0
                          ? "text-loss"
                          : "text-draw";
                    const deltaDisplay = p.trophyChange;
                    const deltaShown = !p.isRankedStart;
                    return (
                      <div className="rounded-xl border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
                        <div className="text-xs font-medium">
                          {p.isRankedStart ? (
                            <>
                              Starting rating ·{" "}
                              {new Date(p.battleTime).toLocaleDateString()}
                            </>
                          ) : (
                            <>
                              Game {p.gameNumber} ·{" "}
                              {new Date(p.battleTime).toLocaleDateString()}
                            </>
                          )}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {p.brawlerName}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span style={{ color: tier.color }}>{tier.name}</span>
                          <span className="font-semibold tabular-nums">
                            {formatChartValue(display)}
                          </span>
                          {peakDiff ? (
                            <span className="text-muted-foreground">
                              (match peak{" "}
                              {formatChartValue(p.peakRatingDuringMatch!)})
                            </span>
                          ) : null}
                          {!deltaShown ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={cn(deltaTone)}>
                              {deltaDisplay > 0 ? "+" : ""}
                              {deltaDisplay}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />

                <Area
                  type="linear"
                  dataKey="chartY"
                  baseValue={yMin}
                  stroke="none"
                  fill={`url(#${gradientId})`}
                  fillOpacity={1}
                  zIndex={-50}
                  tooltipType="none"
                  activeDot={false}
                  isAnimationActive={false}
                  pointerEvents="none"
                />
                <Line
                  type="linear"
                  dataKey="chartY"
                  stroke="#ECEBE7"
                  strokeWidth={3}
                  dot={(props) => {
                    const { cx, cy, payload, index } = props as {
                      cx: number;
                      cy: number;
                      payload: Point;
                      index: number;
                    };
                    const latest = index === points.length - 1;
                    if (
                      payload.ratingAfter < yMin ||
                      payload.ratingAfter > yMax
                    )
                      return <g key={index} />;
                    if (points.length > 40 && !latest) return <g key={index} />;
                    const fill =
                      payload.result === "victory"
                        ? "#22C55E"
                        : payload.result === "defeat"
                          ? "#EF4444"
                          : "#94A3B8";
                    return (
                      <g key={index}>
                        {latest && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={11}
                            fill="#ECEBE7"
                            fillOpacity={0.12}
                            stroke="#ECEBE7"
                            strokeOpacity={0.4}
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={latest ? 6 : 4}
                          fill={fill}
                          stroke="#18191C"
                          strokeWidth={1.5}
                        />
                      </g>
                    );
                  }}
                  activeDot={{
                    r: 7,
                    fill: "#ECEBE7",
                    stroke: "#18191C",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
