// Shared helpers for bakers. Every download is cached in .cache/ (gitignored) so
// re-baking is instant, works offline and is polite to free public APIs.
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ROOT = join(import.meta.dirname, "..", "..");
const CACHE = join(ROOT, ".cache");

/** Wikimedia and USGS ask for an identifying User-Agent; no personal contact details. */
export const USER_AGENT = "Earthlog/0.1 (+https://github.com/abmoh4219/earthlog)";

const HOUR = 3_600_000;

/**
 * How long a cached answer stays true. Most answers never change (a past day's pageviews, a
 * revision by id, a day's feed, map shapes) and are kept forever. Answers about "now" go
 * stale: an article's latest revision (election results fill in for days), Wikidata, World
 * Bank releases, Hacker News, and the last few days' pageviews (counted late).
 */
export function maxAgeMs(url: string, now = Date.now()): number {
  const u = new URL(url);
  if (u.hostname === "en.wikipedia.org" && u.searchParams.get("prop")?.includes("revisions"))
    return u.searchParams.has("rvstart") || u.searchParams.has("revids") ? Infinity : 3 * HOUR;
  if (u.hostname.endsWith("wikidata.org")) return 24 * HOUR;
  if (u.hostname === "hn.algolia.com") return 24 * HOUR;
  // USGS event queries and details are revised for days (ShakeMap, PAGER, DYFI); product
  // files carry a version in their URL and never change.
  if (u.hostname === "earthquake.usgs.gov" && u.pathname.startsWith("/fdsnws/")) return 6 * HOUR;
  if (u.hostname === "api.worldbank.org") return 30 * 24 * HOUR;
  const days = /\/daily\/\d{8,10}\/(\d{4})(\d{2})(\d{2})/.exec(u.pathname);
  if (u.hostname === "wikimedia.org" && days) {
    const end = Date.UTC(Number(days[1]), Number(days[2]) - 1, Number(days[3]));
    return now - end < 3 * 24 * HOUR ? 6 * HOUR : Infinity;
  }
  return Infinity;
}

/**
 * GET JSON through the cache. `complete` guards against caching a partial answer (some
 * APIs occasionally omit a section, e.g. the Wikimedia feed's `mostread`): an incomplete
 * response is retried, and never written to the cache.
 */
export async function fetchJson(
  url: string,
  complete: (json: unknown) => boolean = () => true,
): Promise<unknown> {
  const key = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const file = join(CACHE, `${key}.json`);
  try {
    const age = Date.now() - (await stat(file)).mtimeMs;
    const cached: unknown = JSON.parse(await readFile(file, "utf8"));
    if (complete(cached) && age < maxAgeMs(url)) return cached;
  } catch {
    // Not cached yet.
  }
  for (let attempt = 1; ; attempt++) {
    console.log(`  fetch ${url}`);
    let res: Response;
    try {
      res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    } catch (err) {
      // Network hiccups (reset, timeout) are retried a few times before giving up.
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const text = await res.text();
    const json: unknown = JSON.parse(text);
    if (complete(json)) {
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, text);
      return json;
    }
    if (attempt >= 4) throw new Error(`incomplete response after ${attempt} tries: ${url}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

/** GET bytes through the same cache (for images such as terrain tiles). Kept forever. */
export async function fetchBytes(url: string): Promise<Uint8Array> {
  const key = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const file = join(CACHE, `${key}.bin`);
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    // Not cached yet.
  }
  for (let attempt = 1; ; attempt++) {
    console.log(`  fetch ${url}`);
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, bytes);
      return bytes;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

export async function writeJson(path: string, data: unknown, pretty = true): Promise<number> {
  await mkdir(dirname(path), { recursive: true });
  const text = `${JSON.stringify(data, null, pretty ? 2 : undefined)}\n`;
  await writeFile(path, text);
  return text.length;
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

/** "2025-04-28T10:40:00Z" from Unix seconds. */
export function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Compact time key for evidence IDs: "2025-04-28T10:40Z". */
export function idTime(iso: string): string {
  return `${iso.slice(0, 16)}Z`;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid];
  const lo = sorted[mid - 1];
  if (hi === undefined) return null;
  return sorted.length % 2 === 1 || lo === undefined ? hi : (lo + hi) / 2;
}
