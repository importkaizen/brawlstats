/**
 * Brawl Stars season helpers.
 *
 * Brawl Stars seasons last roughly two weeks. We anchor to a known season
 * start and derive a deterministic season identifier of the form
 * "YYYY-Snn" so battles can be grouped without remote calls. The Brawlify
 * seasons API can be used as an authoritative source if desired.
 */

const SEASON_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;
// Anchor: season 1 of the new ranked era roughly began 2023-12-05 UTC.
const SEASON_ANCHOR = new Date(Date.UTC(2023, 11, 5));

export type SeasonInfo = {
  id: string;
  number: number;
  start: Date;
  end: Date;
};

export function seasonForDate(date: Date | string): SeasonInfo {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - SEASON_ANCHOR.getTime();
  const number = Math.max(1, Math.floor(diff / SEASON_LENGTH_MS) + 1);
  const start = new Date(SEASON_ANCHOR.getTime() + (number - 1) * SEASON_LENGTH_MS);
  const end = new Date(start.getTime() + SEASON_LENGTH_MS);
  const id = `${start.getUTCFullYear()}-S${String(number).padStart(2, "0")}`;
  return { id, number, start, end };
}

export function currentSeason(): SeasonInfo {
  return seasonForDate(new Date());
}

export function previousSeason(): SeasonInfo {
  const now = new Date();
  const prevDate = new Date(now.getTime() - SEASON_LENGTH_MS);
  return seasonForDate(prevDate);
}

export function listRecentSeasons(count = 6): SeasonInfo[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) =>
    seasonForDate(new Date(now - i * SEASON_LENGTH_MS)),
  );
}

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * Render a season as a friendly month range: a season that spans Apr 14
 * → Apr 28 becomes "APR 2026"; one that crosses month boundaries becomes
 * "APR/MAY 2026". Used by the ranked dashboard header.
 */
export function formatSeasonHeading(s: SeasonInfo): string {
  const startMonth = MONTH_NAMES[s.start.getUTCMonth()];
  // The end timestamp is exclusive, so subtract one day for the human label.
  const endDate = new Date(s.end.getTime() - 24 * 60 * 60 * 1000);
  const endMonth = MONTH_NAMES[endDate.getUTCMonth()];
  const year = endDate.getUTCFullYear();
  if (startMonth === endMonth) return `${startMonth} ${year}`;
  return `${startMonth}/${endMonth} ${year}`;
}
