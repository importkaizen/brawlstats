"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { parseStoredBattleDetail } from "@/lib/battleDetail";
import type { DetailRosterPlayer } from "@/lib/battleDetail";
import { battleQueueDisplayLabel } from "@/lib/brawlstars";
import { RANKED_SUB_TIERS, getSubTier } from "@/lib/rankedTiers";
import { RANK_TIERS } from "@/lib/ranks";
import { isValidTag, normalizeTag } from "@/lib/tag";
import {
  brawlerIconUrl,
  cn,
  formatNumber,
  formatRelative,
  mapBackdropImageCandidates,
  modeImageUrl,
  prettyMode,
  rankedMainIconUrl,
  rankedTierIconUrl,
} from "@/lib/utils";
import type { MatchRow } from "@/components/dashboard/matchRow";

function formatDur(sec: number): string {
  if (sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type RankPreview = {
  rankedRank: number | null;
  rankedRankName: string | null;
  rankedElo: number | null;
};

function CurrentRank({ rank }: { rank: RankPreview | null | undefined }) {
  const heading = (
    <span className="block text-[10px] text-muted-foreground">
      Current rank
    </span>
  );
  if (rank === undefined) {
    return (
      <>
        {heading}
        <span className="text-muted-foreground">Loading…</span>
      </>
    );
  }
  if (rank === null) {
    return (
      <>
        {heading}
        <span className="text-muted-foreground">Unavailable</span>
      </>
    );
  }

  const rankName =
    rank.rankedRankName ??
    (rank.rankedRank != null
      ? RANKED_SUB_TIERS[rank.rankedRank - 1]?.name
      : null) ??
    (rank.rankedElo != null && rank.rankedElo > 0
      ? getSubTier(rank.rankedElo).name
      : null);
  if (!rankName) {
    return (
      <>
        {heading}
        <span className="text-muted-foreground">Unranked</span>
      </>
    );
  }

  const color =
    RANK_TIERS.find((tier) =>
      rankName.toLowerCase().startsWith(tier.name.toLowerCase()),
    )?.color ?? "#B7BEE8";
  const iconUrl =
    rankedTierIconUrl(rank.rankedRank) ?? rankedMainIconUrl(rankName);

  return (
    <>
      {heading}
      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px]">
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            className="h-4 w-4 shrink-0 object-contain"
          />
        )}
        <span className="whitespace-nowrap font-semibold" style={{ color }}>
          {rankName}
        </span>
        {rank.rankedElo != null && rank.rankedElo > 0 && (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatNumber(rank.rankedElo)}
          </span>
        )}
      </span>
    </>
  );
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

function RosterRows({
  players,
  onViewPlayer,
  openingTag,
  showCurrentRank,
  ranksByTag,
}: {
  players: DetailRosterPlayer[];
  onViewPlayer: (player: DetailRosterPlayer) => void;
  openingTag: string | null;
  showCurrentRank: boolean;
  ranksByTag: Record<string, RankPreview | null>;
}) {
  return (
    <div className="divide-y divide-border/60 rounded-lg border border-border bg-card">
      {players.map((p, index) => {
        const canView = isValidTag(p.tag);
        const content = (
          <>
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
              {showCurrentRank && (
                <div className="mt-1.5 min-w-0 text-xs">
                  <CurrentRank
                    rank={canView ? ranksByTag[normalizeTag(p.tag)] : null}
                  />
                </div>
              )}
            </div>
            {!showCurrentRank && (
              <div className="shrink-0 text-right">
                <div className="text-[10px] text-muted-foreground">
                  Trophies
                </div>
                <div className="font-semibold tabular-nums text-foreground">
                  {p.trophies != null ? formatNumber(p.trophies) : "—"}
                </div>
              </div>
            )}
            {canView &&
              (openingTag === p.tag ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold" />
              ) : (
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              ))}
          </>
        );
        const rowClass = cn(
          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors sm:px-4",
          p.isViewer && "bg-gold/[0.06]",
        );
        return canView ? (
          <button
            key={`${p.tag}-${p.brawlerId}-${index}`}
            type="button"
            className={cn(
              rowClass,
              "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold",
            )}
            aria-label={`View ${p.name}'s stats`}
            aria-busy={openingTag === p.tag}
            disabled={openingTag !== null}
            onClick={() => onViewPlayer(p)}
          >
            {content}
          </button>
        ) : (
          <div key={`${p.tag}-${p.brawlerId}-${index}`} className={rowClass}>
            {content}
          </div>
        );
      })}
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
  const router = useRouter();
  const [openingTag, setOpeningTag] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [ranksByTag, setRanksByTag] = useState<
    Record<string, RankPreview | null>
  >({});
  const rankCache = useRef(
    new Map<string, { rank: RankPreview; fetchedAt: number }>(),
  );

  useEffect(() => {
    setPlayerError(null);
  }, [match?.id]);

  useEffect(() => {
    if (!open || !match?.isRanked) return;
    const detail = parseStoredBattleDetail(match.raw, viewerTag);
    if (!detail) return;

    const players =
      detail.layout === "teams"
        ? detail.teams.flatMap((team) => team.players)
        : detail.players;
    const tags = [
      ...new Set(
        players
          .map((player) => player.tag)
          .filter(isValidTag)
          .map(normalizeTag),
      ),
    ];
    const now = Date.now();
    const cached: Record<string, RankPreview> = {};
    const missing: string[] = [];
    for (const tag of tags) {
      const entry = rankCache.current.get(tag);
      if (entry && now - entry.fetchedAt < 120_000) cached[tag] = entry.rank;
      else missing.push(tag);
    }
    setRanksByTag(cached);
    if (missing.length === 0) return;

    const controller = new AbortController();
    void (async () => {
      let fetched: Record<string, RankPreview | null> = {};
      try {
        const response = await fetch("/api/players/ranks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: missing }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load ranks");
        const result = (await response.json()) as {
          ranks?: Record<string, RankPreview | null>;
        };
        fetched = result.ranks ?? {};
      } catch {
        if (controller.signal.aborted) return;
      }
      if (controller.signal.aborted) return;
      const resolved = Object.fromEntries(
        missing.map((tag) => [tag, fetched[tag] ?? null]),
      ) as Record<string, RankPreview | null>;
      const fetchedAt = Date.now();
      for (const [tag, rank] of Object.entries(resolved)) {
        if (rank) rankCache.current.set(tag, { rank, fetchedAt });
      }
      setRanksByTag({ ...cached, ...resolved });
    })();

    return () => controller.abort();
  }, [open, match?.id, match?.isRanked, match?.raw, viewerTag]);

  const viewPlayer = useCallback(
    async (player: DetailRosterPlayer) => {
      if (!isValidTag(player.tag) || openingTag) return;
      setOpeningTag(player.tag);
      setPlayerError(null);
      try {
        const response = await fetch("/api/players/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ tag: player.tag }),
        });
        const result = (await response.json().catch(() => null)) as {
          error?: string;
          player?: { slug: string };
        } | null;
        if (!response.ok || !result?.player?.slug) {
          throw new Error(
            result?.error ?? "Could not load this player's stats.",
          );
        }
        onClose();
        router.push(`/dashboard/${result.player.slug}`);
      } catch (error) {
        setPlayerError(
          error instanceof Error
            ? error.message
            : "Could not load this player's stats.",
        );
      } finally {
        setOpeningTag(null);
      }
    },
    [onClose, openingTag, router],
  );

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
          {playerError && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-loss/40 bg-loss/10 p-3 text-xs text-loss"
            >
              {playerError}
            </p>
          )}
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
                    {!match.isRanked && (
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
                    )}
                  </header>
                  <RosterRows
                    players={team.players}
                    onViewPlayer={viewPlayer}
                    openingTag={openingTag}
                    showCurrentRank={match.isRanked}
                    ranksByTag={ranksByTag}
                  />
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
                    ? "Current ranks are live and may differ from each player’s rank when this match was played."
                    : "Team totals add up each player’s brawler trophies at the time of the match."}
                </p>
              )}
            </div>
          ) : (
            <>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Participants
              </h3>
              <RosterRows
                players={parsed.players}
                onViewPlayer={viewPlayer}
                openingTag={openingTag}
                showCurrentRank={match.isRanked}
                ranksByTag={ranksByTag}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {match.isRanked
                  ? "Current ranks are live and may differ from each player’s rank when this match was played."
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
