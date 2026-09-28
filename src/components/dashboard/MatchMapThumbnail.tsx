"use client";

import { useEffect, useMemo, useState } from "react";
import { parseStoredBattleDetail } from "@/lib/battleDetail";
import {
  cn,
  mapBackdropImageCandidates,
  modeImageUrl,
} from "@/lib/utils";

/**
 * Small map preview using Brawlify CDN (battle `event.id` when present, then name slug fallbacks).
 */
export function MatchMapThumbnail({
  mapName,
  mode,
  raw,
  viewerTag,
  className,
}: {
  mapName: string;
  mode: string;
  raw: string | null;
  viewerTag: string;
  className?: string;
}) {
  const eventId = useMemo(() => {
    const d = parseStoredBattleDetail(raw, viewerTag);
    return d?.eventId ?? null;
  }, [raw, viewerTag]);

  const chain = useMemo(() => {
    const c = mapBackdropImageCandidates(mapName, eventId);
    const mUrl = modeImageUrl(mode);
    if (!c.includes(mUrl)) c.push(mUrl);
    return c;
  }, [mapName, eventId, mode]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [mapName, eventId, mode]);

  const frameCn = cn(
    "flex h-[3.25rem] w-[5.5rem] shrink-0 items-center justify-center rounded-md bg-muted ring-1 ring-border/70 sm:h-[3.5rem] sm:w-[5.875rem]",
    className,
  );

  if (idx >= chain.length) {
    return <div className={frameCn} aria-hidden />;
  }

  return (
    <div className={frameCn}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={chain[idx]!}
        alt=""
        className="max-h-full max-w-full object-contain object-center"
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  );
}
