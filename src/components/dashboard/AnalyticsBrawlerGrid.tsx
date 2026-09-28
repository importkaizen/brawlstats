"use client";

import { useMemo, useState } from "react";
import { brawlerIconUrl, formatNumber, formatPercent, cn } from "@/lib/utils";
import type { BrawlerStat } from "@/lib/stats";

type Sort = "winRate" | "games" | "avg" | "trophies";

export function AnalyticsBrawlerGrid({ items }: { items: BrawlerStat[] }) {
  const [sort, setSort] = useState<Sort>("games");
  const [minGames, setMinGames] = useState(2);

  const filtered = useMemo(() => {
    const copy = items.filter((b) => b.games >= minGames);
    copy.sort((a, b) => {
      if (sort === "games") return b.games - a.games;
      if (sort === "winRate") return b.winRate - a.winRate;
      if (sort === "avg") return b.avgTrophyChange - a.avgTrophyChange;
      const ta = a.latestTrophies ?? -1;
      const tb = b.latestTrophies ?? -1;
      return tb - ta;
    });
    return copy;
  }, [items, sort, minGames]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No brawler data in this window yet.
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
          Avg trophy Δ
        </SortPill>
        <SortPill
          active={sort === "trophies"}
          onClick={() => setSort("trophies")}
        >
          Log trp.
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

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-3 font-medium">Brawler</th>
              <th className="px-3 py-3 text-right font-medium">Log trophies</th>
              <th className="px-3 py-3 text-right font-medium">Games</th>
              <th className="px-3 py-3 text-right font-medium">Win rate</th>
              <th className="px-3 py-3 text-right font-medium">Avg trophy Δ</th>
              <th className="px-3 py-3 text-right font-medium">Net Δ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const win = b.winRate;
              const winColor =
                win >= 0.6
                  ? "text-win"
                  : win >= 0.5
                    ? "text-gold"
                    : "text-loss";
              const avgColor =
                b.avgTrophyChange > 0
                  ? "text-win"
                  : b.avgTrophyChange < 0
                    ? "text-loss"
                    : "text-muted-foreground";
              const netColor =
                b.netChange > 0
                  ? "text-win"
                  : b.netChange < 0
                    ? "text-loss"
                    : "text-muted-foreground";
              return (
                <tr
                  key={b.brawlerId}
                  className="border-b border-border/60 transition-colors hover:bg-muted/40"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={brawlerIconUrl(b.brawlerId)}
                        alt={b.brawlerName}
                        className="h-10 w-10 rounded-lg bg-muted object-cover"
                        loading="lazy"
                      />
                      <span className="font-medium">{b.brawlerName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-display text-muted-foreground">
                    {b.latestTrophies != null ? (
                      formatNumber(b.latestTrophies)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {b.games}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-semibold",
                      winColor,
                    )}
                  >
                    {b.wins + b.losses === 0
                      ? "—"
                      : formatPercent(b.winRate, 0)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-semibold tabular-nums",
                      avgColor,
                    )}
                  >
                    {b.avgTrophyChange > 0 ? "+" : ""}
                    {b.avgTrophyChange.toFixed(1)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-semibold tabular-nums",
                      netColor,
                    )}
                  >
                    {b.netChange > 0 ? "+" : ""}
                    {b.netChange}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No brawlers meet the {minGames}-game threshold yet.
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Trophy Δ and net Δ count ladder games only; ranked queue matches still
        affect wins, losses, and games played.
      </p>
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
