import type { ApiBattleEntry, BattlePlayer } from "./brawlstars";
import { findPlayerInBattle, isRankedBattle } from "./brawlstars";
import { normalizeTag } from "./tag";

/** One slot in the lobby roster (battlelog mirrors brawlers' ladder trophies when present). */
export type DetailRosterPlayer = {
  tag: string;
  name: string;
  brawlerId: number;
  brawlerName: string;
  /** Null when the API omits ladder trophies (ranked-queue placeholders hidden). */
  trophies: number | null;
  power: number;
  isViewer: boolean;
  isStarPlayer: boolean;
};

export type DetailTeamSection = {
  index: number;
  /** Heading like "Your team" or "Team A". */
  label: string;
  players: DetailRosterPlayer[];
  /** Sum of ladder trophies when meaningful; null for ranked-queue snapshots. */
  trophySum: number | null;
};

/** Populated when the API returns structured `battle.teams`. */
export type TeamLayoutDetail = {
  layout: "teams";
  map: string;
  mode: string;
  /** Brawl Stars `event.id`; used for CDN map imagery when name slugs miss. */
  eventId: number | null;
  battleType: string | null;
  durationSec: number;
  trophyChange: number | null;
  viewerResult: string | null;
  viewerTeamIndex: number | null;
  starPlayerTag: string | null;
  teams: DetailTeamSection[];
};

/** Fallback when only `battle.players` exists (solo modes, some events). */
export type SoloListDetail = {
  layout: "solo-list";
  map: string;
  mode: string;
  eventId: number | null;
  battleType: string | null;
  durationSec: number;
  trophyChange: number | null;
  viewerResult: string | null;
  starPlayerTag: string | null;
  players: DetailRosterPlayer[];
};

export type StoredBattleDetail = TeamLayoutDetail | SoloListDetail;

export type ParseStoredBattleDetailOpts = {
  /** Your ladder trophies by brawler id (profile snapshot) — fills your ranked row only. */
  viewerLadderTrophiesByBrawlerId?: Map<number, number> | null;
};

function mapParticipant(
  p: BattlePlayer,
  viewerNorm: string,
  starNorm: string | null,
  rankedQueue: boolean,
  viewerLadderById?: Map<number, number> | null,
): DetailRosterPlayer {
  const tag = normalizeTag(p.tag);
  let ladder =
    rankedQueue ? null : (p.brawler.trophies ?? null);
  if (
    ladder == null &&
    rankedQueue &&
    viewerLadderById &&
    tag === viewerNorm
  ) {
    ladder = viewerLadderById.get(p.brawler.id) ?? null;
  }
  return {
    tag: p.tag,
    name: p.name,
    brawlerId: p.brawler.id,
    brawlerName: p.brawler.name,
    trophies: ladder,
    power: p.brawler.power ?? 0,
    isViewer: tag === viewerNorm,
    isStarPlayer: Boolean(starNorm && tag === starNorm),
  };
}

export function parseStoredBattleDetail(
  raw: string | null | undefined,
  viewerTag: string,
  opts?: ParseStoredBattleDetailOpts,
): StoredBattleDetail | null {
  if (!raw?.trim()) return null;
  let entry: ApiBattleEntry;
  try {
    entry = JSON.parse(raw) as ApiBattleEntry;
  } catch {
    return null;
  }

  const viewerNorm = normalizeTag(viewerTag);
  const viewerLadder = opts?.viewerLadderTrophiesByBrawlerId ?? null;
  const starTagRaw = entry.battle?.starPlayer?.tag;
  const starNorm = starTagRaw ? normalizeTag(starTagRaw) : null;
  const rankedQueue = isRankedBattle(entry);

  const map = entry.event?.map ?? "Unknown map";
  const mode = entry.event?.mode ?? entry.battle?.mode ?? "unknown";
  const eventId =
    typeof entry.event?.id === "number" && Number.isFinite(entry.event.id)
      ? entry.event.id
      : null;
  const battleType = entry.battle?.type ?? null;
  const durationSec = entry.battle?.duration ?? 0;
  const trophyChange =
    entry.battle?.trophyChange != null ? entry.battle.trophyChange : null;
  const viewerResult = entry.battle?.result ?? null;

  const teams = entry.battle?.teams;
  if (teams && teams.length > 0) {
    const found = findPlayerInBattle(entry, viewerTag);
    const viewerTeamIndex = found?.teamIndex ?? null;

    const sections: DetailTeamSection[] = teams.map((roster, index) => {
      const players = roster.map((p) =>
        mapParticipant(p, viewerNorm, starNorm, rankedQueue, viewerLadder),
      );
      const trophySum = rankedQueue
        ? null
        : players.reduce((a, p) => a + (p.trophies ?? 0), 0);
      let label: string;
      if (teams.length === 2) {
        if (viewerTeamIndex != null) {
          label = index === viewerTeamIndex ? "Your team" : "Opponents";
        } else {
          label = index === 0 ? "Team A" : "Team B";
        }
      } else {
        label =
          viewerTeamIndex === index ? `Team ${index + 1} (you)` : `Team ${index + 1}`;
      }

      return { index, label, players, trophySum };
    });

    return {
      layout: "teams",
      map,
      mode,
      eventId,
      battleType,
      durationSec,
      trophyChange,
      viewerResult,
      viewerTeamIndex,
      starPlayerTag: starTagRaw ?? null,
      teams: sections,
    };
  }

  const flat = entry.battle?.players;
  if (!flat || flat.length === 0) {
    return null;
  }

  const players = flat
    .map((p) =>
      mapParticipant(p, viewerNorm, starNorm, rankedQueue, viewerLadder),
    )
    .sort((a, b) => {
      if (a.isViewer !== b.isViewer) return a.isViewer ? -1 : 1;
      const ta = a.trophies ?? -1;
      const tb = b.trophies ?? -1;
      return tb - ta;
    });

  return {
    layout: "solo-list",
    map,
    mode,
    eventId,
    battleType,
    durationSec,
    trophyChange,
    viewerResult,
    starPlayerTag: starTagRaw ?? null,
    players,
  };
}
