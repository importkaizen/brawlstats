"use client";

import { useMemo, useState } from "react";
import type { RankedBrawlerRow } from "@/lib/rankedStats";
import { brawlerIconUrl, cn, formatPercent } from "@/lib/utils";

type Sort = "games" | "wins" | "winRate" | "avgChange";

const COLS: { key: Sort; label: string; align?: string }[] = [
  { key: "games", label: "Games", align: "text-right" },
  { key: "wins", label: "Record", align: "text-right" },
  { key: "winRate", label: "Win %", align: "text-right" },
];

export function BrawlerBreakdown({ rows }: { rows: RankedBrawlerRow[] }) {
  const [sort, setSort] = useState<Sort>("games");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => b[sort] - a[sort]);
    return copy;
  }, [rows, sort]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No ranked games logged yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[280px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2.5 font-medium">Brawler</th>
            {COLS.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "cursor-pointer select-none px-3 py-2.5 font-medium hover:text-foreground",
                  c.align,
                )}
                onClick={() => setSort(c.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sort === c.key && <span className="text-gold">▾</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const wrTone =
              b.winRate >= 0.65
                ? "bg-win/15 text-win border-win/40"
                : b.winRate >= 0.5
                  ? "bg-gold/15 text-gold border-gold/40"
                  : "bg-loss/15 text-loss border-loss/40";
            return (
              <tr
                key={b.brawlerId}
                className="border-b border-border/60 transition-colors hover:bg-muted/30"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {b.brawlerId > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brawlerIconUrl(b.brawlerId)}
                        alt={b.brawlerName}
                        className="h-6 w-6 rounded-md bg-muted object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-md bg-muted" />
                    )}
                    <span>{b.brawlerName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {b.games}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">
                  {b.wins}W - {b.losses}L
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className={cn(
                      "inline-flex min-w-[44px] justify-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
                      wrTone,
                    )}
                  >
                    {b.wins + b.losses === 0
                      ? "—"
                      : formatPercent(b.winRate, 0)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
