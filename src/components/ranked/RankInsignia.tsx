import { cn, rankedMainIconUrl, rankedTierIconUrl } from "@/lib/utils";
import type { RankedSubTier } from "@/lib/rankedTiers";

/**
 * Brawl Stars rank insignia. Prefers the official-looking Brawlify CDN
 * icon (sub-tier exact when we know `rankedRank`, main-tier otherwise)
 * and falls back to a programmatic chevron-stack badge if neither is
 * available (e.g. unranked players or CDN outage).
 */
export function RankInsignia({
  tier,
  size = "md",
  className,
  rankedRank,
}: {
  tier: RankedSubTier;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /**
   * Numeric API rank (1 = Bronze I, 22 = Pro). When provided, we use
   * the exact tiered icon from Brawlify so the displayed badge matches
   * the in-game art.
   */
  rankedRank?: number | null;
}) {
  const dims = {
    sm: { box: "h-10 w-10", text: "text-[10px]" },
    md: { box: "h-16 w-16", text: "text-sm" },
    lg: { box: "h-24 w-24", text: "text-base" },
    xl: { box: "h-28 w-28", text: "text-lg" },
  }[size];

  const tieredUrl = rankedTierIconUrl(rankedRank);
  const mainUrl = rankedMainIconUrl(tier.baseName);
  const iconUrl = tieredUrl ?? mainUrl;

  if (iconUrl) {
    return (
      <div
        className={cn(
          "relative grid place-items-center rounded-2xl",
          dims.box,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt={tier.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback: programmatic chevron-stack glyph.
  const division =
    tier.division === 1
      ? "I"
      : tier.division === 2
        ? "II"
        : tier.division === 3
          ? "III"
          : "";

  return (
    <div
      className={cn(
        "relative grid place-items-center rounded-2xl border-2",
        dims.box,
        className,
      )}
      style={{
        borderColor: tier.color,
        background: `${tier.color}11`,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 m-auto h-2/3 w-2/3 opacity-80"
        fill="none"
        stroke={tier.color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden
      >
        <polygon points="12 2 22 7 22 17 12 22 2 17 2 7" />
        <polygon points="12 6 18 9 18 15 12 18 6 15 6 9" />
      </svg>
      <span
        className={cn(
          "relative z-10 font-display font-bold uppercase tracking-widest",
          dims.text,
        )}
        style={{ color: tier.color }}
      >
        {division || "PRO"}
      </span>
    </div>
  );
}
