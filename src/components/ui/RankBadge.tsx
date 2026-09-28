import { getSubTier } from "@/lib/rankedTiers";
import { cn } from "@/lib/utils";

export function RankBadge({
  rating,
  size = "md",
  className,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const rank = getSubTier(rating);
  const sizes = {
    sm: "h-6 px-2 text-[10px]",
    md: "h-8 px-3 text-xs",
    lg: "h-10 px-4 text-sm",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-display font-semibold uppercase tracking-wider",
        sizes[size],
        className,
      )}
      style={{
        color: rank.color,
        borderColor: rank.color + "66",
        background: rank.color + "1a",
        boxShadow: `inset 0 0 0 1px ${rank.glowColor}`,
      }}
    >
      <span
        className="block h-2 w-2 rounded-full"
        style={{ background: rank.color, boxShadow: `0 0 10px ${rank.color}` }}
      />
      {rank.name}
    </span>
  );
}
