#!/usr/bin/env node
/**
 * Fetch Brawlify map catalogue (https://api.brawlify.com/v1/maps),
 * write `src/data/brawlify-maps-index.json` for runtime name→id lookup,
 * and optionally download PNGs into `public/maps/regular/` (local assets
 * under the same `/maps/regular/{id}.png` paths the CDN uses).
 *
 * Usage:
 *   node scripts/sync-brawlify-maps.mjs           # index + download active (~370) maps
 *   node scripts/sync-brawlify-maps.mjs --all-maps # index + download every catalogue map
 */

import fs from "node:fs/promises";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public/maps/regular");
const INDEX_OUT = path.join(ROOT, "src/data/brawlify-maps-index.json");

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status >= 400 && res.status < 500) return res;
    await sleep(500 * (i + 1));
  }
  return fetch(url);
}

async function main() {
  const allMaps = process.argv.includes("--all-maps");
  const skipDownload = process.argv.includes("--index-only");

  const res = await fetchWithRetry("https://api.brawlify.com/v1/maps");
  if (!res.ok)
    throw new Error(`api.brawlify.com/v1/maps → ${res.status} ${res.statusText}`);

  /** @type {{ list?: Array<{ id: number; name: string; hash: string; disabled?: boolean; imageUrl: string }> }} */
  const data = await res.json();
  const list = data.list ?? [];
  if (!list.length) throw new Error("Empty map list from Brawlify");

  const normalizeNameKey = (s) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  /** @type {Record<string, number>} */
  const byName = {};
  /** @type {Record<string, number>} */
  const byHash = {};
  for (const m of list) {
    const id = Number(m.id);
    if (!Number.isFinite(id)) continue;
    if (normalizeNameKey(m.name)) byName[normalizeNameKey(m.name)] = id;
    const h = (m.hash || "").trim().toLowerCase();
    if (h) byHash[h] = id;
  }

  const indexPayload = {
    generatedAt: new Date().toISOString(),
    source: "https://api.brawlify.com/v1/maps",
    byName,
    byHash,
    maps: list.map((m) => ({
      id: m.id,
      name: m.name,
      hash: m.hash,
      disabled: Boolean(m.disabled),
      imageUrl: m.imageUrl,
    })),
  };

  await fs.mkdir(path.dirname(INDEX_OUT), { recursive: true });
  await fs.writeFile(
    INDEX_OUT,
    `${JSON.stringify(indexPayload, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${INDEX_OUT}`);

  if (skipDownload) {
    console.log("--index-only: skipped PNG downloads");
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  const toFetch = list.filter((m) => allMaps || !m.disabled);
  console.log(
    `Downloading ${toFetch.length} map images (${allMaps ? "full catalogue" : "active maps only"})`,
  );

  const concurrency = 8;
  let done = 0;

  async function downloadOne(m) {
    const id = m.id;
    const dest = path.join(OUT_DIR, `${id}.png`);
    try {
      await fs.access(dest);
      done++;
      return;
    } catch {
      /* missing — fetch */
    }
    const imgRes = await fetchWithRetry(m.imageUrl);
    if (!imgRes.ok) {
      console.warn(`${id}: ${imgRes.status} (${m.imageUrl})`);
      done++;
      return;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    await fs.writeFile(dest, buf);
    done++;
    if (done % 40 === 0) console.log(`  … ${done} / ${toFetch.length}`);
  }

  let cursor = 0;
  async function worker() {
    while (cursor < toFetch.length) {
      const i = cursor++;
      await downloadOne(toFetch[i]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`Done → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
