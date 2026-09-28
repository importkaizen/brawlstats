"use client";

import type { RankedMatchLogRow } from "@/lib/rankedStats";
import { Badge } from "@/components/ui/Badge";
import { formatRelative } from "@/lib/utils";

function outcomeLabel(o: RankedMatchLogRow["outcome"]) {
  switch (o) {
    case "victory":
      return "Win";
    case "defeat":
      return "Loss";
    default:
      return "Draw";
  }
}

export function RankedMatchLog({ rows }: { rows: RankedMatchLogRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No finished ranked games in this season yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[280px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-3 font-medium">Time</th>
            <th className="px-3 py-3 font-medium">Result</th>
            <th className="px-3 py-3 text-right font-medium">ELO change</th>
            <th className="px-3 py-3 text-right font-medium">ELO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60">
              <td
                className="px-3 py-2.5 text-muted-foreground"
                title={new Date(r.battleTime).toLocaleString()}
              >
                {formatRelative(r.battleTime)}
              </td>
              <td className="px-3 py-2.5">
                <Badge
                  tone={
                    r.outcome === "victory"
                      ? "win"
                      : r.outcome === "defeat"
                        ? "loss"
                        : "default"
                  }
                >
                  {outcomeLabel(r.outcome)}
                </Badge>
              </td>
              <td
                className={
                  r.eloDelta > 0
                    ? "px-3 py-2.5 text-right font-medium tabular-nums text-win"
                    : r.eloDelta < 0
                      ? "px-3 py-2.5 text-right font-medium tabular-nums text-loss"
                      : "px-3 py-2.5 text-right font-medium tabular-nums text-muted-foreground"
                }
              >
                {r.eloDelta > 0 ? "+" : ""}
                {r.eloDelta}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">
                {r.eloAfter}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
