"use client";

import { brawlerIconUrl } from "@/lib/utils";
import type { OwnedBrawlerSnap } from "@/lib/playerRoster";

export function OwnedBrawlersShelf({
  roster,
}: {
  roster: OwnedBrawlerSnap[];
}) {
  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Brawler roster appears after the next Refresh — we sync it from the
        Brawl Stars player API alongside your trophies.
      </div>
    );
  }

  return (
    <div className="max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
      <ul className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
        {roster.map((b) => (
          <li key={b.id} className="flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brawlerIconUrl(b.id)}
              alt=""
              className="mx-auto mb-1.5 aspect-square h-14 w-14 rounded-lg bg-muted object-cover ring-1 ring-border/70 sm:h-16 sm:w-16"
              loading="lazy"
            />
            <span className="line-clamp-2 max-w-[5.75rem] text-[11px] font-medium leading-snug text-foreground sm:text-xs">
              {b.name}
            </span>
            <span className="tabular-nums text-[10px] text-muted-foreground sm:text-[11px]">
              {b.trophies.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
