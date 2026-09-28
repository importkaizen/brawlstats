/**
 * Parses the player's owned-brawler roster from Prisma (`ownedBrawlersJson`).
 * Mirrors Supercell `/players/{tag}` `brawlers[]` payload fields.
 */

export type OwnedBrawlerSnap = {
  id: number;
  name: string;
  power: number;
  rank: number;
  trophies: number;
  highestTrophies: number;
};

export function parseOwnedBrawlersJson(
  raw: string | null | undefined,
): OwnedBrawlerSnap[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: OwnedBrawlerSnap[] = [];
    for (const row of j) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = Number(o.id);
      const name = typeof o.name === "string" ? o.name : null;
      if (!Number.isFinite(id) || !name?.trim()) continue;
      out.push({
        id,
        name: name.trim(),
        power: typeof o.power === "number" ? o.power : 0,
        rank: typeof o.rank === "number" ? o.rank : 0,
        trophies: typeof o.trophies === "number" ? o.trophies : 0,
        highestTrophies:
          typeof o.highestTrophies === "number" ? o.highestTrophies : 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function rosterSortedByTrophies(
  roster: OwnedBrawlerSnap[],
): OwnedBrawlerSnap[] {
  return [...roster].sort((a, b) => {
    const d = b.trophies - a.trophies;
    return d !== 0 ? d : b.highestTrophies - a.highestTrophies;
  });
}

/** Current ladder trophies per brawler id from the last `/players/{tag}` snapshot. */
export function ownedBrawlerTrophyMap(
  raw: string | null | undefined,
): Map<number, number> {
  const m = new Map<number, number>();
  for (const row of parseOwnedBrawlersJson(raw)) {
    m.set(row.id, row.trophies);
  }
  return m;
}

/** JSON-safe `id → trophies` for client components (e.g. Ranked tab). */
export function ladderTrophiesRecordFromMap(m: Map<number, number>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const [id, trophies] of m) {
    o[String(id)] = trophies;
  }
  return o;
}

export function ladderTrophyMapFromOwnedRoster(
  roster: OwnedBrawlerSnap[],
): Map<number, number> {
  return new Map(roster.map((r) => [r.id, r.trophies]));
}

/** Rebuild a trophy map from props serialized through RSC. */
export function ladderTrophyMapFromRecord(
  rec: Record<string, number> | undefined | null,
): Map<number, number> | null {
  if (!rec || typeof rec !== "object") return null;
  const m = new Map<number, number>();
  for (const [k, v] of Object.entries(rec)) {
    const id = Number(k);
    if (Number.isFinite(id) && typeof v === "number") m.set(id, v);
  }
  return m.size ? m : null;
}
