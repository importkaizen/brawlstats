import { cn } from "@/lib/utils";

const COLORS: Record<"victory" | "defeat" | "draw", string> = {
  victory: "border-win/20 bg-win/10 text-win",
  defeat: "border-loss/20 bg-loss/10 text-loss",
  draw: "border-draw/20 bg-draw/10 text-draw",
};

const LABELS: Record<"victory" | "defeat" | "draw", string> = {
  victory: "W",
  defeat: "L",
  draw: "D",
};

export function RecentForm({
  results,
  className,
}: {
  results: Array<"victory" | "defeat" | "draw">;
  className?: string;
}) {
  if (results.length === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        No games yet
      </span>
    );
  }
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {results.map((r, i) => (
        <span
          key={`${i}-${r}`}
          className={cn(
            "grid h-5 w-5 place-items-center rounded border text-[10px] font-semibold",
            COLORS[r],
          )}
          title={r}
        >
          {LABELS[r]}
        </span>
      ))}
    </div>
  );
}
