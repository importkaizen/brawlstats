"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { parseStoredBattleDetail } from "@/lib/battleDetail";
import type { DetailRosterPlayer } from "@/lib/battleDetail";
import { battleQueueDisplayLabel } from "@/lib/brawlstars";
import {
  brawlerIconUrl,
  cn,
  formatNumber,
  formatRelative,
  mapBackdropImageCandidates,
  modeImageUrl,
  prettyMode,
} from "@/lib/utils";
import type { MatchRow } from "@/components/dashboard/matchRow";

function formatDur(sec: number): string {
  if (sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MapHeroBackdrop({
  mapName,
  eventId,
  mode,
}: {
  mapName: string;
  eventId: number | null;
  mode: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [mapName, eventId, mode]);

  const urls = (): string[] => {
    const c = mapBackdropImageCandidates(mapName, eventId);
    const mUrl = modeImageUrl(mode);
    if (!c.includes(mUrl)) c.push(mUrl);
    return c;
  };

  const chain = urls();
  if (idx >= chain.length) {
    return (
      <div className="flex min-h-[180px] w-full items-center justify-center bg-muted sm:min-h-[220px]" />
    );
  }

  return (
    <div className="flex w-full justify-center bg-muted/30 px-3 py-3 sm:px-5 sm:py-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={chain[idx]!}
        alt=""
        className="max-h-[min(28vh,240px)] sm:max-h-[min(36vh,320px)] w-full max-w-lg object-contain object-center opacity-98"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  );
}

function RosterRows({ players }: { players: DetailRosterPlayer[] }) {
  return (
    <div className="divide-y divide-border/60 rounded-lg border border-border bg-card">
      {players.map((p) => (
        <div
          key={`${p.tag}-${p.brawlerId}`}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 transition-colors sm:px-4",
            p.isViewer && "bg-gold/[0.06]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brawlerIconUrl(p.brawlerId)}
            alt={p.brawlerName}
            className="h-9 w-9 shrink-0 rounded-md bg-muted object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-medium">{p.name}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {p.tag}
              </span>
              {p.isStarPlayer && (
                <Badge tone="gold" className="!py-0 text-[10px]">
                  Star Player
                </Badge>
              )}
              {p.isViewer && (
                <Badge
                  tone="gold"
                  className="!border-gold/50 !bg-gold/10 !py-0 text-[10px] text-gold"
                >
                  You
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {p.brawlerName}{" "}
              <span className="tabular-nums">· Power {p.power}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-muted-foreground">Trophies</div>
            <div className="font-semibold tabular-nums text-foreground">
              {p.trophies != null ? formatNumber(p.trophies) : "—"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MatchDetailModal(props: {
  match: MatchRow | null;
  viewerTag: string;
  /** Profile roster ladder trophies — your ranked rows show real values instead of placeholders. */
  viewerLadderTrophyMap?: Map<number, number> | null;
  open: boolean;
  onClose: () => void;
}) {
  const { match, viewerTag, viewerLadderTrophyMap, open, onClose } = props;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => {
      panelRef.current?.focus();
    });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !match || typeof document === "undefined") return null;

  const parsed = parseStoredBattleDetail(match.raw, viewerTag, {
    viewerLadderTrophiesByBrawlerId: viewerLadderTrophyMap ?? null,
  });
  const headlineMap = parsed?.map ?? match.map;
  const headlineMode = parsed?.mode ?? match.mode;
  const resultTone =
    match.result === "victory"
      ? "win"
      : match.result === "defeat"
        ? "loss"
        : "draw";

  const queueLabel = parsed ? battleQueueDisplayLabel(parsed.battleType) : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-background/85 backdrop-blur-sm"
        aria-label="Close match details"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-xl sm:rounded-xl"
      >
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-3 top-3 z-10 !h-8 !w-8 !px-0 bg-card/95"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="relative shrink-0 border-b border-border">
          <MapHeroBackdrop
            mapName={headlineMap}
            eventId={parsed?.eventId ?? null}
            mode={headlineMode}
          />
          <div className="border-t border-border/60 bg-card px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h2
                id={titleId}
                className="min-w-0 text-xl font-semibold tracking-tight"
              >
                {headlineMap}
              </h2>
              <Badge tone={resultTone}>
                {match.result === "victory"
                  ? "Win"
                  : match.result === "defeat"
                    ? "Loss"
                    : "Draw"}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span>{formatRelative(match.battleTime)}</span>
              <span>{prettyMode(headlineMode)}</span>
              {queueLabel && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px]">
                  {queueLabel}
                </span>
              )}
              <span>{formatDur(parsed?.durationSec ?? 0)}</span>
              {match.isRanked && match.ratingAfter != null && (
                <span>
                  Ranked ELO{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatNumber(match.ratingAfter)}
                  </span>
                </span>
              )}
              {parsed?.trophyChange != null &&
                parsed.trophyChange !== 0 &&
                !match.isRanked && (
                  <span
                    className={`font-medium tabular-nums ${parsed.trophyChange > 0 ? "text-win" : "text-loss"}`}
                  >
                    {parsed.trophyChange > 0 ? "+" : ""}
                    {parsed.trophyChange} trophies
                  </span>
                )}
            </div>
          </div>
        </div>

        <div className="scrollbar-thin overflow-y-auto px-4 py-4 sm:px-6 sm:pb-6">
          {!parsed ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              Full roster data isn&apos;t available for this battle (stored
              before detailed logging was added, or payload was truncated). You
              can still see the summary columns in the match list above.
            </p>
          ) : parsed.layout === "teams" ? (
            <div
              className={cn(
                "grid gap-4",
                parsed.teams.length === 2 &&
                  "sm:grid-cols-2 sm:items-start sm:gap-5",
              )}
            >
              {parsed.teams.map((team) => (
                <section
                  key={team.index}
                  className={cn(
                    "rounded-xl border border-border p-3 sm:p-4",
                    parsed.viewerTeamIndex === team.index &&
                      "border-gold/40 bg-gold/[.02]",
                  )}
                >
                  <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <h3 className="text-sm font-semibold">{team.label}</h3>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">
                        Team trophies
                      </div>
                      <div className="text-lg font-bold tabular-nums text-gold">
                        {team.trophySum != null
                          ? formatNumber(team.trophySum)
                          : "—"}
                      </div>
                    </div>
                  </header>
                  <RosterRows players={team.players} />
                </section>
              ))}
              {parsed.teams.length >= 3 ? (
                <p className="col-span-full text-xs text-muted-foreground">
                  Team trophy totals add up each teammate&apos;s brawler
                  trophies as reported by the battlelog snapshot (typically
                  ladder values; ranked queues may show placeholder values).
                </p>
              ) : (
                <p className="col-span-full text-xs text-muted-foreground">
                  {match.isRanked
                    ? "Ranked games don’t include other players’ ladder trophies. Yours come from your latest profile."
                    : "Team totals add up each player’s brawler trophies at the time of the match."}
                </p>
              )}
            </div>
          ) : (
            <>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Participants
              </h3>
              <RosterRows players={parsed.players} />
              <p className="mt-3 text-xs text-muted-foreground">
                {match.isRanked
                  ? "Ranked battlelogs omit ladder trophies except via profile snapshot for your row; other players typically show —."
                  : "This mode was stored as a flat player list rather than grouped teams. Brawler trophies are per-contestant totals from the battlelog payload."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
