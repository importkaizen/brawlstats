"use client";

import { useMemo, useState } from "react";
import { brawlerIconUrl, cn, formatRelative, prettyMode } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { MatchRow } from "@/components/dashboard/matchRow";
import { MatchDetailModal } from "@/components/dashboard/MatchDetailModal";
import { MatchMapThumbnail } from "@/components/dashboard/MatchMapThumbnail";

export type { MatchRow } from "@/components/dashboard/matchRow";

type SortKey =
  | "battleTime"
  | "trophyChange"
  | "ratingAfter"
  | "brawlerTrophies"
  | "brawlerName"
  | "map";
type SortDir = "asc" | "desc";

const HEADERS: { key: SortKey; label: string; align?: string }[] = [
  { key: "battleTime", label: "Time" },
  { key: "brawlerName", label: "Brawler" },
  { key: "map", label: "Map / Mode" },
  { key: "trophyChange", label: "Change", align: "text-right" },
  { key: "brawlerTrophies", label: "Brawler trophies", align: "text-right" },
  { key: "ratingAfter", label: "Ranked ELO", align: "text-right" },
];

export function RecentMatches({
  rows,
  viewerTag,
  viewerLadderTrophyMap,
}: {
  rows: MatchRow[];
  viewerTag: string;
  /** Latest `/players/{tag}` ladder trophies by brawler id (your roster). */
  viewerLadderTrophyMap?: Map<number, number> | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("battleTime");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [openFor, setOpenFor] = useState<MatchRow | null>(null);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "trophyChange") {
        const av = a.isRanked ? a.rankedRatingDelta : a.trophyChange;
        const bv = b.isRanked ? b.rankedRatingDelta : b.trophyChange;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else cmp = av - bv;
      } else {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = -1;
        else if (bv == null) cmp = 1;
        else if (typeof av === "number" && typeof bv === "number")
          cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "battleTime" ? "desc" : "desc");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No matches recorded yet. We&apos;ll fetch your battles automatically.
      </div>
    );
  }

  return (
    <>
      <MatchDetailModal
        match={openFor}
        viewerTag={viewerTag}
        viewerLadderTrophyMap={viewerLadderTrophyMap}
        open={openFor !== null}
        onClose={() => setOpenFor(null)}
      />

      <p className="mb-3 px-1 text-xs text-muted-foreground">
        Select a match for battle details, then select a player to see their
        stats.
      </p>

      <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
        <label className="text-xs text-muted-foreground" htmlFor="match-sort">
          Sort matches
        </label>
        <div className="flex items-center gap-2">
          <select
            id="match-sort"
            value={sortKey}
            onChange={(event) => {
              setSortKey(event.target.value as SortKey);
              setSortDir("desc");
            }}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          >
            {HEADERS.map((header) => (
              <option key={header.key} value={header.key}>
                {header.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            aria-label={
              sortDir === "asc" ? "Sort descending" : "Sort ascending"
            }
            className="rounded-md border border-border px-2.5 py-1.5 text-xs"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>
      <div className="divide-y divide-border md:hidden">
        {sorted.map((match) => {
          const delta = match.isRanked
            ? match.rankedRatingDelta
            : match.trophyChange;
          const tone =
            match.result === "victory"
              ? "win"
              : match.result === "defeat"
                ? "loss"
                : "draw";
          return (
            <button
              key={match.id}
              type="button"
              onClick={() => setOpenFor(match)}
              className="flex w-full items-center gap-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brawlerIconUrl(match.brawlerId)}
                alt=""
                className="h-10 w-10 shrink-0 rounded-md bg-muted object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {match.brawlerName}{" "}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    {formatRelative(match.battleTime)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {match.map} · {prettyMode(match.mode)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {match.isRanked ? "Ranked" : "Ladder"}
                  {match.isRanked &&
                    match.ratingAfter != null &&
                    ` · ${match.ratingAfter.toLocaleString()} ELO`}
                  {match.brawlerTrophies != null &&
                    ` · ${match.brawlerTrophies.toLocaleString()} brawler trophies`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge tone={tone}>
                  {match.result === "victory"
                    ? "Win"
                    : match.result === "defeat"
                      ? "Loss"
                      : "Draw"}
                </Badge>
                <p
                  className={`mt-1.5 text-xs font-medium tabular-nums ${delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-win" : "text-loss"}`}
                >
                  {delta == null || delta === 0
                    ? "—"
                    : `${delta > 0 ? "+" : ""}${delta}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  className={cn(
                    "cursor-pointer select-none px-3 py-3 font-medium hover:text-foreground",
                    h.align,
                  )}
                  onClick={() => toggleSort(h.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    {sortKey === h.key && (
                      <span className="text-gold">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, idx) => {
              const prev = sorted[idx - 1];
              const tone =
                m.result === "victory"
                  ? "win"
                  : m.result === "defeat"
                    ? "loss"
                    : "draw";
              /** Ranked: only terminal FT2 rounds carry a rated Δ; never fall back to ladder trophies. */
              const deltaNum = m.isRanked
                ? m.rankedRatingDelta
                : m.trophyChange;
              const rankedHasDelta = m.isRanked && m.rankedRatingDelta != null;
              const trophyHasDelta = !m.isRanked && m.trophyChange !== 0;

              const deltaClass =
                deltaNum != null && typeof deltaNum === "number"
                  ? deltaNum > 0
                    ? "text-win"
                    : deltaNum < 0
                      ? "text-loss"
                      : "text-draw"
                  : "";

              const hasDeltaShown = rankedHasDelta || trophyHasDelta;
              const seriesHead =
                m.rankedSeries && prev?.rankedSeries?.id !== m.rankedSeries.id;
              return (
                <tr
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
                    seriesHead && "border-l-2 border-l-border bg-muted/20",
                    m.rankedSeries &&
                      !seriesHead &&
                      "border-l-2 border-l-border/50 bg-muted/10",
                  )}
                  onClick={() => setOpenFor(m)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenFor(m);
                    }
                  }}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatRelative(m.battleTime)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {m.brawlerId > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brawlerIconUrl(m.brawlerId)}
                          alt={m.brawlerName}
                          className="h-7 w-7 rounded-md bg-muted object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-md bg-muted" />
                      )}
                      <span className="font-medium">{m.brawlerName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-2.5">
                      <MatchMapThumbnail
                        mapName={m.map}
                        mode={m.mode}
                        raw={m.raw}
                        viewerTag={viewerTag}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{m.map}</span>
                          {m.isRanked && (
                            <Badge
                              tone="purple"
                              className="!px-1.5 !py-0 text-[10px]"
                            >
                              Ranked
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {prettyMode(m.mode)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-semibold",
                      hasDeltaShown && deltaClass,
                    )}
                  >
                    {!hasDeltaShown ? (
                      <span className="text-muted-foreground">—</span>
                    ) : rankedHasDelta ? (
                      <>
                        {(m.rankedRatingDelta ?? 0) > 0 ? "+" : ""}
                        {m.rankedRatingDelta}
                      </>
                    ) : (
                      <>
                        {m.trophyChange > 0 ? "+" : ""}
                        {m.trophyChange}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {m.brawlerTrophies != null ? (
                      <span className="text-foreground">
                        {m.brawlerTrophies.toLocaleString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.isRanked ? (m.ratingAfter ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Badge tone={tone}>
                      {m.result === "victory"
                        ? "Win"
                        : m.result === "defeat"
                          ? "Loss"
                          : "Draw"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
