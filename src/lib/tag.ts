/**
 * Brawl Stars player/club tag utilities.
 *
 * Tags use a restricted alphabet (no 0/O confusion etc.) and are typed with a
 * leading "#". The API expects the "#" to be URL-encoded as "%23".
 */

const TAG_ALPHABET = /^[0289PYLQGRJCUV]+$/;

export function normalizeTag(input: string): string {
  if (!input) return "";
  let tag = input.trim().toUpperCase();
  // Replace common confusing chars with their visual equivalents
  tag = tag.replace(/O/g, "0").replace(/B/g, "8");
  if (!tag.startsWith("#")) tag = `#${tag}`;
  return tag;
}

export function isValidTag(input: string): boolean {
  const tag = normalizeTag(input);
  if (!tag.startsWith("#")) return false;
  const body = tag.slice(1);
  if (body.length < 3 || body.length > 14) return false;
  return TAG_ALPHABET.test(body);
}

export function encodeTag(tag: string): string {
  const t = normalizeTag(tag);
  return encodeURIComponent(t); // "#" -> "%23"
}

export function tagForUrl(tag: string): string {
  // For use in dashboard URL paths — strip the "#" so URLs stay clean.
  return normalizeTag(tag).replace(/^#/, "");
}

export function tagFromUrl(slug: string): string {
  return normalizeTag(decodeURIComponent(slug));
}
