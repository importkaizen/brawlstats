import { cn } from "@/lib/utils";
import type { SeasonSummary } from "@/lib/stats";
import { formatNumber, formatPercent } from "@/lib/utils";

function Tile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "win" | "loss" | "gold";
}) {
  const toneClass = {
    default: "text-foreground",
    win: "text-win",
    loss: "text-loss",
    gold: "gradient-gold",
  }[tone];
  return (
    <div className="stat-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-display text-3xl font-semibold leading-none",
          toneClass,
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

export function StatTiles({
  summary,
  allTimePeak,
  allTimePeakName,
  currentRating,
  currentRankName,
}: {
  summary: SeasonSummary;
  allTimePeak: number | null;
  allTimePeakName: string | null;
  currentRating: number | null;
  currentRankName: string | null;
}) {
  const winRate = summary.winRate;
  const winRateTone: "win" | "loss" | "default" =
    winRate >= 0.55 ? "win" : winRate < 0.45 && summary.totalGames > 0 ? "loss" : "default";
  const avgTone: "win" | "loss" | "default" =
    summary.avgTrophyChange > 0
      ? "win"
      : summary.avgTrophyChange < 0
        ? "loss"
        : "default";
  const streakLabel =
    summary.streak.type === "none"
      ? "—"
      : summary.streak.type === "win"
        ? `${summary.streak.length}W`
        : `${summary.streak.length}L`;

  const peakLabel = "All-Time Rank Peak";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile
        label="Games"
        value={formatNumber(summary.totalGames)}
        hint={
          summary.totalGames > 0
            ? `${summary.wins}W / ${summary.losses}L${summary.draws ? ` / ${summary.draws}D` : ""}`
            : "No games yet"
        }
      />
      <Tile
        label="Win Rate"
        value={summary.totalGames === 0 ? "—" : formatPercent(winRate, 1)}
        tone={winRateTone}
        hint={summary.totalGames === 0 ? undefined : `${summary.wins} wins`}
      />
      <Tile
        label="Avg Δ / Game"
        value={
          summary.avgTrophyChange === 0
            ? "0"
            : (summary.avgTrophyChange > 0 ? "+" : "") +
              summary.avgTrophyChange.toFixed(1)
        }
        tone={avgTone}
        hint={`Net ${summary.netChange > 0 ? "+" : ""}${summary.netChange}`}
      />
      <Tile
        label="Current Rank Rating"
        value={
          currentRating != null
            ? formatNumber(currentRating)
            : summary.currentRating != null
              ? formatNumber(summary.currentRating)
              : "—"
        }
        tone="gold"
        hint={
          currentRankName ??
          (allTimePeak != null
            ? `${peakLabel} ${formatNumber(allTimePeak)}`
            : undefined)
        }
      />
      <Tile
        label={peakLabel}
        value={allTimePeak != null ? formatNumber(allTimePeak) : "—"}
        tone="gold"
        hint={allTimePeakName ?? streakLabel}
      />
    </div>
  );
}
