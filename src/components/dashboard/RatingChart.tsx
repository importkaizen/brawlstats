"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RANK_TIERS, getRank } from "@/lib/ranks";
import { formatChartValue, matchAxis, valueAxis } from "@/lib/chartScale";
import { ChartFooter, ChartToolbar } from "@/components/charts/ChartChrome";

/** Supports Profile trophy curve (`value`) or legacy rated curve (`ratingAfter`). */
export type RatingChartPoint = {
  battleTime: string;
  value?: number;
  ratingAfter?: number;
  result: string;
  brawlerName: string;
  trophyChange: number;
};

function yAt(p: RatingChartPoint): number {
  if (p.value != null) return p.value;
  if (p.ratingAfter != null) return p.ratingAfter;
  return 0;
}

export function RatingChart({
  data,
  variant = "rankedElo",
}: {
  data: RatingChartPoint[];
  variant?: "rankedElo" | "trophyLadder";
}) {
  const [fromZero, setFromZero] = useState(false);
  const [width, setWidth] = useState(0);
  const instanceId = useId().replace(/:/g, "");
  const isTrophies = variant === "trophyLadder";
  data = data.filter((point) => Number.isFinite(yAt(point)));

  if (data.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-center text-muted-foreground">
        <p className="font-display text-base uppercase tracking-wide">
          {isTrophies
            ? "Not enough battles to plot account trophies yet"
            : "No rated battles yet this season"}
        </p>
        <p className="text-sm">
          {isTrophies
            ? "We rebuild your profile total from each match's trophy delta and your latest API snapshot."
            : "Play a few ranked games and check back soon."}
        </p>
      </div>
    );
  }

  const ys = data.map(yAt);
  const scale = valueAxis(ys, {
    minimumSpan: isTrophies ? 200 : 500,
    fromZero,
    fullScaleMinimum: isTrophies ? 0 : 12000,
  });
  const [yMin, yMax] = scale.domain;

  const points = data.map((d, i) => ({
    ...d,
    y: yAt(d),
    ts: new Date(d.battleTime).getTime(),
    gameNumber: i + 1,
  }));

  const fillId = `chartFill-${instanceId}`;
  const strokeColor = isTrophies ? "#E8C86A" : "#ECEBE7";
  const xScale = matchAxis(1, points.length, width < 480 ? 3 : 5);

  return (
    <div className="min-w-0 w-full">
      <ChartToolbar
        min={scale.min}
        max={scale.max}
        unit={isTrophies ? "Trophies" : "Ranked rating"}
        fromZero={fromZero}
        onScaleChange={setFromZero}
      />
      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer
          width="100%"
          height="100%"
          debounce={50}
          onResize={setWidth}
        >
          <AreaChart
            data={points}
            margin={{ top: 18, right: 16, left: 0, bottom: 8 }}
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              strokeDasharray="3 5"
              stroke="rgba(255,255,255,0.09)"
            />
            <XAxis
              dataKey="gameNumber"
              type="number"
              domain={xScale.domain}
              ticks={xScale.ticks}
              allowDecimals={false}
              padding={{ left: 8, right: 8 }}
              stroke="#8f9299"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={18}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={scale.domain}
              ticks={scale.ticks}
              allowDecimals={false}
              tickFormatter={formatChartValue}
              stroke="#8f9299"
              fontSize={11}
              width={64}
              tickMargin={10}
              tickLine={false}
              axisLine={false}
              interval={0}
            />

            {!isTrophies &&
              RANK_TIERS.map((t) =>
                t.threshold > yMin &&
                t.threshold < yMax &&
                (!fromZero || t.threshold >= 1500) ? (
                  <ReferenceLine
                    key={t.name}
                    y={t.threshold}
                    stroke={t.color}
                    strokeDasharray="4 4"
                    strokeOpacity={0.45}
                    label={{
                      value: t.short,
                      position: "insideTopRight",
                      fill: t.color,
                      fontSize: 10,
                      fontFamily: "var(--font-display)",
                    }}
                  />
                ) : null,
              )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as RatingChartPoint & {
                  ts: number;
                  y: number;
                  gameNumber: number;
                };
                if (isTrophies) {
                  return (
                    <div className="rounded-xl border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
                      <div className="text-xs font-medium text-gold">
                        Game {p.gameNumber}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(p.battleTime).toLocaleString()}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {p.brawlerName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gold">
                          {formatChartValue(p.y)} total trophies
                        </span>
                        <span
                          className={
                            p.trophyChange > 0
                              ? "text-win"
                              : p.trophyChange < 0
                                ? "text-loss"
                                : "text-draw"
                          }
                        >
                          {p.trophyChange > 0 ? "+" : ""}
                          {p.trophyChange}
                        </span>
                      </div>
                    </div>
                  );
                }
                const rank = getRank(p.y);
                return (
                  <div className="rounded-xl border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
                    <div className="text-xs font-medium">
                      {new Date(p.battleTime).toLocaleString()}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {p.brawlerName}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span style={{ color: rank.color }}>{rank.name}</span>
                      <span className="font-semibold">
                        {formatChartValue(p.y)}
                      </span>
                      <span
                        className={
                          p.trophyChange > 0
                            ? "text-win"
                            : p.trophyChange < 0
                              ? "text-loss"
                              : "text-draw"
                        }
                      >
                        {p.trophyChange > 0 ? "+" : ""}
                        {p.trophyChange}
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="linear"
              dataKey="y"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill={`url(#${fillId})`}
              dot={
                points.length === 1
                  ? {
                      r: 4,
                      fill: strokeColor,
                      stroke: "#18191C",
                      strokeWidth: 2,
                    }
                  : false
              }
              activeDot={{
                r: 4,
                fill: strokeColor,
                stroke: "#000",
                strokeWidth: 1.5,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ChartFooter
        count={points.length}
        flat={scale.min === scale.max}
        unit={isTrophies ? "Trophy" : "Rating"}
      />
    </div>
  );
}
