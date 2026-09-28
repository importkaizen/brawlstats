import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import mapCatalog from "@/data/brawlify-maps-index.json";

const MAP_NAME_TO_ID = mapCatalog.byName as Record<string, number>;

const CDN_MAP_REGULAR = "https://cdn.brawlify.com/maps/regular";

function normalizedMapCatalogKey(mapName: string): string {
  return mapName.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Brawlify catalogue id when the battlelog map string matches catalogue `name`. */
export function brawlifyCatalogMapId(mapName: string): number | null {
  const id = MAP_NAME_TO_ID[normalizedMapCatalogKey(mapName)];
  if (id != null && Number.isFinite(id) && id > 0) return id;
  return null;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function brawlerIconUrl(brawlerId: number): string {
  return `https://cdn.brawlify.com/brawlers/borderless/${brawlerId}.png`;
}

export function playerIconUrl(iconId: number): string {
  return `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`;
}

export function mapImageUrl(map: string): string {
  const id = brawlifyCatalogMapId(map);
  if (id != null) return `${CDN_MAP_REGULAR}/${id}.png`;
  const slug = map.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  return `https://cdn.brawlify.com/maps/borderless/${slug}.png`;
}

/** Ordered URLs: bundled `/public/maps/regular`, then CDN `maps/regular` by Supercell/Brawlify id; then legacy slug fallbacks. */
export function mapBackdropImageCandidates(
  mapName: string,
  eventId?: number | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };

  const pushIdVariants = (id: number | null | undefined) => {
    if (!Number.isFinite(id!) || !(id! > 0)) return;
    const n = id as number;
    push(`/maps/regular/${n}.png`);
    push(`${CDN_MAP_REGULAR}/${n}.png`);
  };

  const trim = mapName.trim();
  const byNameId = brawlifyCatalogMapId(trim);

  if (Number.isFinite(eventId) && (eventId as number) > 0) {
    pushIdVariants(eventId as number);
  }
  pushIdVariants(byNameId);

  if (trim) {
    const slug = trim.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    const slugLc = trim
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (slug)
      push(`https://cdn.brawlify.com/maps/borderless/${slug}.png`);
    if (slugLc && slugLc !== slug.toLowerCase()) {
      push(`https://cdn.brawlify.com/maps/borderless/${slugLc}.png`);
    }
  }

  return out;
}

export function modeImageUrl(mode: string): string {
  return `https://cdn.brawlify.com/gamemodes/${mode}.png`;
}

/**
 * Brawl Stars in-game ranked-tier badge from the Brawlify CDN.
 *
 * The API's `rankedRank` is a 1-indexed sub-tier (1 = Bronze I,
 * 16 = Legendary I, 19 = Masters I, 22 = Pro). The Brawlify CDN files
 * are 0-indexed under `/ranked/tiered/`, so we offset by -1.
 *
 * Returns the URL only when `rank` is in range; pass `null`/0 and the
 * caller can skip rendering the image.
 */
export function rankedTierIconUrl(rank: number | null | undefined): string | null {
  if (rank == null || rank < 1 || rank > 22) return null;
  const id = 58000000 + (rank - 1);
  return `https://cdn.brawlify.com/ranked/tiered/${id}.png`;
}

/**
 * Map a rank name like "LEGENDARY I" to a Brawlify "regular" main-tier
 * icon URL — same image regardless of division. Used as a graceful
 * fallback when we know the tier name but not the exact sub-tier index.
 */
export function rankedMainIconUrl(rankName: string | null | undefined): string | null {
  if (!rankName) return null;
  const base = rankName.trim().split(/\s+/)[0]?.toLowerCase();
  if (!base) return null;
  const map: Record<string, string> = {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
    diamond: "Diamond",
    mythic: "Mythic",
    legendary: "Legendary",
    masters: "Masters",
    pro: "Pro",
  };
  const file = map[base];
  if (!file) return null;
  return `https://cdn.brawlify.com/ranked/regular/${file}.png`;
}

export function prettyMode(mode: string): string {
  // "brawlBall" -> "Brawl Ball"
  return mode
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
