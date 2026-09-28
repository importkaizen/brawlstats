/**
 * Brawl Stars API client.
 *
 * The Brawl Stars API is IP-locked: every request must include
 * `Authorization: Bearer <key>` and the key is bound to the IP it was
 * created with. There is no public unauthenticated mirror for the
 * `/players/{tag}` and `/players/{tag}/battlelog` endpoints (Brawlify's
 * public API does *not* proxy these — it only exposes static catalogue
 * data like brawlers / events / icons), so a key is genuinely required
 * for live data.
 *
 * Set `BRAWLSTARS_API_KEY` in your `.env` after creating a key at
 * https://developer.brawlstars.com. Set `BRAWLSTARS_API_KEY_BACKUP` for
 * a second key (for example, another allowed outbound IP). Optionally set
 * `BRAWLSTARS_PROXY_URL` to route through a fixed-IP proxy you control
 * (useful when deploying to Vercel where outbound IPs are dynamic).
 */

import { encodeTag, normalizeTag } from "./tag";

/** Minimal battle shape — avoids coupling this module to Prisma. */
export type StoredBattleBrawlerFields = {
  raw: string | null;
  brawlerId: number;
  brawlerName: string;
};

const OFFICIAL_BASE = "https://api.brawlstars.com/v1";

const API_KEYS = Array.from(new Set([
  process.env.BRAWLSTARS_API_KEY,
  process.env.BRAWLSTARS_API_KEY_BACKUP,
].map((key) => key?.trim()).filter((key): key is string => Boolean(key))));
// Reuse the last successful key so an IP change only costs one rejected request.
let preferredKeyIndex = 0;
const PROXY_OVERRIDE = process.env.BRAWLSTARS_PROXY_URL;

function apiUserAgent(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const origin = new URL(raw).origin;
      return `MyreBrawl/1.0 (+${origin})`;
    } catch {
      /* ignore invalid URL */
    }
  }
  return "MyreBrawl/1.0";
}

function baseUrl(): string {
  if (PROXY_OVERRIDE) return PROXY_OVERRIDE.replace(/\/$/, "");
  return OFFICIAL_BASE;
}

export class BrawlApiError extends Error {
  constructor(
    public status: number,
    public reason: string,
    message: string,
  ) {
    super(message);
    this.name = "BrawlApiError";
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "BRAWLSTARS_API_KEY is not set. Get one at https://developer.brawlstars.com (whitelist your egress IP), then add it to your .env file.",
    );
    this.name = "MissingApiKeyError";
  }
}

export function isMissingApiKeyError(err: unknown): err is MissingApiKeyError {
  return err instanceof MissingApiKeyError;
}

export function hasApiKey(): boolean {
  return API_KEYS.length > 0;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!hasApiKey()) throw new MissingApiKeyError();

  const url = `${baseUrl()}${path}`;
  const keyOrder = [preferredKeyIndex, ...API_KEYS.map((_, i) => i).filter((i) => i !== preferredKeyIndex)];

  let lastError: BrawlApiError | undefined;
  for (const keyIndex of keyOrder) {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    headers.set("User-Agent", apiUserAgent());
    headers.set("Authorization", `Bearer ${API_KEYS[keyIndex]}`);
    headers.set("Cache-Control", "no-cache");
    headers.set("Pragma", "no-cache");

    let res: Response;
    try {
      res = await fetch(url, { ...init, headers, cache: "no-store" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BrawlApiError(0, "networkError", `Could not reach the Brawl Stars API: ${msg}`);
    }

    if (res.ok) {
      const data = (await res.json()) as T;
      preferredKeyIndex = keyIndex;
      return data;
    }

    let reason = res.statusText;
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { reason?: string; message?: string };
      reason = data.reason ?? reason;
      message = data.message ?? message;
    } catch {
      // Preserve HTTP status even when the API returns a non-JSON error.
    }
    lastError = new BrawlApiError(res.status, reason, message);
    // Only a credential rejection can be resolved by trying the other key.
    // Keep rate limits, missing players, and service failures intact.
    if (res.status !== 401 && res.status !== 403) throw lastError;
  }
  throw lastError!;
}

/* ------------------------------ Types ------------------------------ */

export type ApiPlayer = {
  tag: string;
  name: string;
  nameColor?: string;
  icon: { id: number };
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  expPoints: number;
  isQualifiedFromChampionshipChallenge?: boolean;
  "3vs3Victories"?: number;
  soloVictories?: number;
  duoVictories?: number;
  bestRoboRumbleTime?: number;
  bestTimeAsBigBrawler?: number;
  /* ─── Ranked fields (added in 2024+ API versions) ─────────────────── */
  rankedSeasonId?: number;
  /** Numeric tier index, e.g. 16 = "Legendary I". */
  rankedRank?: number;
  /** Human-readable tier, e.g. "LEGENDARY I". */
  rankedRankName?: string;
  /** Current absolute ranked rating. */
  rankedElo?: number;
  highestSeasonRankedRank?: number;
  highestSeasonRankedRankName?: string;
  highestSeasonRankedElo?: number;
  highestAllTimeRankedRank?: number;
  highestAllTimeRankedRankName?: string;
  highestAllTimeRankedElo?: number;
  brawlers: Array<{
    id: number;
    name: string;
    power: number;
    rank: number;
    trophies: number;
    highestTrophies: number;
  }>;
};

export type ApiBattleEntry = {
  battleTime: string; // "20240101T120000.000Z"
  event: {
    id: number;
    mode: string;
    map: string;
  };
  battle: {
    mode?: string;
    type?: string; // "ranked", "soloRanked", "teamRanked", "friendly"...
    result?: "victory" | "defeat" | "draw";
    duration?: number;
    trophyChange?: number;
    starPlayer?: { tag: string; name: string; brawler: { id: number; name: string } };
    teams?: Array<Array<BattlePlayer>>;
    players?: Array<BattlePlayer>;
  };
};

export type BattlePlayer = {
  tag: string;
  name: string;
  brawler: { id: number; name: string; power: number; trophies: number };
};

export type BattlelogResponse = { items: ApiBattleEntry[] };

/* ------------------------------ Endpoints ------------------------------ */

export async function fetchPlayer(tag: string): Promise<ApiPlayer> {
  const t = encodeTag(tag);
  return request<ApiPlayer>(`/players/${t}`);
}

export async function fetchBattlelog(tag: string): Promise<BattlelogResponse> {
  const t = encodeTag(tag);
  return request<BattlelogResponse>(`/players/${t}/battlelog`);
}

/* ------------------------------ Helpers ------------------------------ */

/**
 * Brawl Stars battleTime format: `20240101T120000.000Z`
 * Convert to a JS Date.
 */
export function parseBattleTime(s: string): Date {
  if (s.includes("-")) return new Date(s);
  const m = s.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d+))?Z$/,
  );
  if (!m) return new Date(s);
  const [, y, mo, d, h, mi, se, ms] = m;
  return new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se),
      ms ? Number(ms.padEnd(3, "0").slice(0, 3)) : 0,
    ),
  );
}

export function isRankedBattle(b: ApiBattleEntry): boolean {
  // The BS API confusingly uses `type: "ranked"` for the regular *trophy*
  // ladder (3v3 events you grind brawler trophies on). The real Ranked
  // competitive queue (the one with seasonal Bronze→Pro elo) shows up as:
  //   - "soloRanked"  → queued solo into Ranked
  //   - "teamRanked"  → queued duo / trio premade into Ranked
  // Trophy-ladder battles include a per-battle `trophyChange` and the
  // brawlers' real trophies; Ranked battles have no `trophyChange` (elo
  // is tracked separately on /players/{tag}.rankedElo) and brawler
  // trophies are clamped to 16.
  const type = b.battle?.type ?? "";
  return type === "soloRanked" || type === "teamRanked";
}

/**
 * Human-readable battle queue label from `battle.type`.
 * Important: `"ranked"` is the trophy ladder, not Ranked-mode — never show that as simply "ranked".
 */
export function battleQueueDisplayLabel(
  apiType: string | null | undefined,
): string | null {
  if (apiType == null || apiType.trim() === "") return null;
  const t = apiType.trim();
  switch (t) {
    case "soloRanked":
      return "Ranked (solo)";
    case "teamRanked":
      return "Ranked (team)";
    case "ranked":
      return "Trophy ladder";
    case "friendly":
      return "Friendly";
    default:
      return t
        .replace(/([A-Z])/g, " $1")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (ch) => ch.toUpperCase());
  }
}

/**
 * Find the supplied player tag inside a battle's roster and return the
 * brawler they used, plus their team-relative result if available.
 */
export function findPlayerInBattle(
  b: ApiBattleEntry,
  playerTag: string,
): { brawler: BattlePlayer["brawler"]; teamIndex: number | null } | null {
  const target = normalizeTag(playerTag);
  if (b.battle.teams) {
    for (let i = 0; i < b.battle.teams.length; i++) {
      const team = b.battle.teams[i];
      const p = team.find((pp) => normalizeTag(pp.tag) === target);
      if (p) return { brawler: p.brawler, teamIndex: i };
    }
  }
  if (b.battle.players) {
    const p = b.battle.players.find((pp) => normalizeTag(pp.tag) === target);
    if (p) return { brawler: p.brawler, teamIndex: null };
  }
  return null;
}

/**
 * Prefer id + name from the stored battlelog JSON so aggregations cannot drift
 * from denormalized DB columns if tag matching at ingest time differed from
 * how we resolve the roster today (e.g. "#" prefix / O↔0 normalization).
 */
export function brawlerIdentityFromStoredBattle(
  battle: StoredBattleBrawlerFields,
  playerTag?: string,
): { brawlerId: number; brawlerName: string } {
  if (!playerTag?.trim() || !battle.raw) {
    return { brawlerId: battle.brawlerId, brawlerName: battle.brawlerName };
  }
  try {
    const entry = JSON.parse(battle.raw) as ApiBattleEntry;
    const found = findPlayerInBattle(entry, playerTag);
    if (found) {
      return {
        brawlerId: found.brawler.id,
        brawlerName: found.brawler.name,
      };
    }
  } catch {
    /* malformed raw */
  }
  return { brawlerId: battle.brawlerId, brawlerName: battle.brawlerName };
}
