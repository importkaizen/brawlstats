"use client";

import { useMemo, useState } from "react";
import { brawlerIconUrl, formatPercent } from "@/lib/utils";
import type { BrawlerStat } from "@/lib/stats";
import { cn } from "@/lib/utils";

type Sort = "winRate" | "games" | "avg";

export function BrawlerGrid({ items }: { items: BrawlerStat[] }) {
  const [sort, setSort] = useState<Sort>("games");
  const [minGames, setMinGames] = useState(3);

  const filtered = useMemo(() => {
    const copy = items.filter((b) => b.games >= minGames);
    copy.sort((a, b) => {
      if (sort === "games") return b.games - a.games;
      if (sort === "winRate") return b.winRate - a.winRate;
      return b.avgTrophyChange - a.avgTrophyChange;
    });
    return copy;
  }, [items, sort, minGames]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No brawler data yet.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SortPill active={sort === "games"} onClick={() => setSort("games")}>
          Most played
        </SortPill>
        <SortPill
          active={sort === "winRate"}
          onClick={() => setSort("winRate")}
        >
          Win rate
        </SortPill>
        <SortPill active={sort === "avg"} onClick={() => setSort("avg")}>
          Avg Δ
        </SortPill>

        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Min games
          <input
            type="number"
            min={1}
            max={50}
            value={minGames}
            onChange={(e) => setMinGames(parseInt(e.target.value || "1", 10))}
            className="h-8 w-16 rounded-md border border-border bg-card px-2 text-foreground focus-visible:outline-none focus-visible:border-gold"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {filtered.map((b) => {
          const win = b.winRate;
          const winColor =
            win >= 0.6 ? "text-win" : win >= 0.5 ? "text-gold" : "text-loss";
          const avgColor =
            b.avgTrophyChange > 0
              ? "text-win"
              : b.avgTrophyChange < 0
                ? "text-loss"
                : "text-muted-foreground";
          return (
            <div
              key={b.brawlerId}
              className="group flex min-w-0 items-center gap-3 border-b border-border/60 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brawlerIconUrl(b.brawlerId)}
                alt={b.brawlerName}
                className="h-10 w-10 rounded-md bg-muted object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {b.brawlerName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.games} games
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                  <span className={cn("font-semibold", winColor)}>
                    {b.wins + b.losses === 0
                      ? "—"
                      : formatPercent(b.winRate, 0)}
                  </span>
                  <span className={cn("font-semibold tabular-nums", avgColor)}>
                    {b.avgTrophyChange > 0 ? "+" : ""}
                    {b.avgTrophyChange.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No brawlers meet the {minGames}-game threshold yet.
        </div>
      )}
    </div>
  );
}

function SortPill({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button {...props} aria-pressed={Boolean(active)} className="sort-control">
      {children}
    </button>
  );
}
