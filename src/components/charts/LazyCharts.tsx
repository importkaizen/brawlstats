"use client";

import dynamic from "next/dynamic";

function chartFallback() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
      Loading chart…
    </div>
  );
}

/** Recharts must run only in the browser — avoids SSR/hydration blank pages. */
export const RatingChart = dynamic(
  () =>
    import("@/components/dashboard/RatingChart").then((m) => m.RatingChart),
  { ssr: false, loading: chartFallback },
);

export const RankedChart = dynamic(
  () => import("@/components/ranked/RankedChart").then((m) => m.RankedChart),
  { ssr: false, loading: () => (
    <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground sm:h-[520px] lg:h-[600px]">
      Loading chart…
    </div>
  ) },
);
