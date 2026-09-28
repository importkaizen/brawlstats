"use client";

import { useMemo } from "react";
import { RatingChart } from "@/components/charts/LazyCharts";
import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RankBadge } from "@/components/ui/RankBadge";
import { buildDemoData } from "@/lib/demo";
import { brawlerIconUrl, formatPercent, prettyMode } from "@/lib/utils";

export function DemoPreview() {
  const data = useMemo(() => buildDemoData(7), []);
  const winRate = data.summary.wins / (data.summary.wins + data.summary.losses);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Rating progression</CardTitle>
            <CardSubtitle>Last {data.summary.games} ranked battles · demo data</CardSubtitle>
          </div>
          <RankBadge rating={data.summary.currentRating} />
        </CardHeader>
        <RatingChart data={data.chart} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Season at a glance</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <Stat label="Games" value={data.summary.games.toString()} />
          <Stat
            label="Win rate"
            value={formatPercent(winRate)}
            tone={winRate >= 0.5 ? "win" : "loss"}
          />
          <Stat
            label="Current Rank Rating"
            value={data.summary.currentRating.toLocaleString()}
            tone="gold"
          />
          <Stat
            label="All-Time Rank Peak"
            value={data.summary.peakRating.toLocaleString()}
          />
        </div>
        <div className="mt-5 text-xs text-muted-foreground">
          <Badge tone="purple">Demo</Badge>
          <span className="ml-2">Connect a real tag to see your own grind.</span>
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Recent demo matches</CardTitle>
          <CardSubtitle>5 of {data.matches.length}</CardSubtitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.matches.slice(0, 5).map((m) => {
            const tone =
              m.result === "victory"
                ? "win"
                : m.result === "defeat"
                  ? "loss"
                  : "draw";
            const deltaClass =
              m.trophyChange > 0
                ? "text-win"
                : m.trophyChange < 0
                  ? "text-loss"
                  : "text-draw";
            return (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-muted/40 p-3"
              >
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brawlerIconUrl(m.brawlerId)}
                    alt={m.brawlerName}
                    className="h-9 w-9 rounded-md bg-muted object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {m.brawlerName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.map} · {prettyMode(m.mode)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge tone={tone}>{m.result}</Badge>
                  <span
                    className={`text-sm font-semibold ${
                      m.trophyChange === 0
                        ? "text-muted-foreground"
                        : deltaClass
                    }`}
                  >
                    {m.trophyChange === 0 ? (
                      "—"
                    ) : (
                      <>
                        {m.trophyChange > 0 ? "+" : ""}
                        {m.trophyChange}
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "win" | "loss" | "gold";
}) {
  const toneClass = {
    default: "text-foreground",
    win: "text-win",
    loss: "text-loss",
    gold: "gradient-gold",
  }[tone];
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`font-display text-xl font-semibold ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}
