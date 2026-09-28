"use client";

import { useMemo, useState } from "react";
import type { ModeStat } from "@/lib/stats";
import { cn, formatPercent, prettyMode } from "@/lib/utils";

type Sort = "games" | "winRate" | "avg";

export function ModeBreakdown({ items }: { items: ModeStat[] }) {
  const [sort, setSort] = useState<Sort>("games");

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      if (sort === "games") return b.games - a.games;
      if (sort === "winRate") return b.winRate - a.winRate;
      return b.avgTrophyChange - a.avgTrophyChange;
    });
    return copy;
  }, [items, sort]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No mode data yet.
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
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-3 font-medium">Mode</th>
              <th className="px-3 py-3 text-right font-medium">Games</th>
              <th className="px-3 py-3 text-right font-medium">Record</th>
              <th className="px-3 py-3 text-right font-medium">Win rate</th>
              <th className="px-3 py-3 text-right font-medium">Avg Δ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const wrColor =
                m.winRate >= 0.6
                  ? "text-win"
                  : m.winRate >= 0.5
                    ? "text-gold"
                    : "text-loss";
              const avgColor =
                m.avgTrophyChange > 0
                  ? "text-win"
                  : m.avgTrophyChange < 0
                    ? "text-loss"
                    : "text-muted-foreground";
              return (
                <tr
                  key={m.mode}
                  className="border-b border-border/60 transition-colors hover:bg-muted/40"
                >
                  <td className="px-3 py-2.5 font-medium">
                    {prettyMode(m.mode)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.games}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {m.wins}-{m.losses}
                    {m.draws > 0 ? ` (${m.draws} draws)` : ""}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-semibold",
                      wrColor,
                    )}
                  >
                    {m.wins + m.losses === 0
                      ? "—"
                      : formatPercent(m.winRate, 0)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-semibold tabular-nums",
                      avgColor,
                    )}
                  >
                    {m.avgTrophyChange > 0 ? "+" : ""}
                    {m.avgTrophyChange.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
