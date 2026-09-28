"use client";

import { formatChartValue } from "@/lib/chartScale";
import { cn } from "@/lib/utils";

export function ChartToolbar({
  min, max, unit, fromZero, onScaleChange,
}: {
  min: number;
  max: number;
  unit: string;
  fromZero: boolean;
  onScaleChange: (fromZero: boolean) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {min === max ? unit : "Recorded range"}{" "}
        <span className="font-medium tabular-nums text-foreground">
          {formatChartValue(min)}{min !== max && ` – ${formatChartValue(max)}`}
        </span>
      </p>
      <div className="inline-flex shrink-0 rounded-lg border border-border bg-background/40 p-1" role="group" aria-label={`${unit} chart scale`}>
        {[{ label: "Focused", value: false }, { label: "Full scale", value: true }].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={fromZero === option.value}
            onClick={() => onScaleChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
              fromZero === option.value ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >{option.label}</button>
        ))}
      </div>
    </div>
  );
}
