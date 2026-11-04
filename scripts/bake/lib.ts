// Shared helpers for bakers. Every download is cached in .cache/ (gitignored) so
// re-baking is instant, works offline and is polite to free public APIs.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ROOT = join(import.meta.dirname, "..", "..");
const CACHE = join(ROOT, ".cache");

/** Wikimedia and USGS ask for an identifying User-Agent; no personal contact details. */
export const USER_AGENT = "Earthlog/0.1 (+https://github.com/abmoh4219/earthlog)";

export async function fetchJson(url: string): Promise<unknown> {
  const key = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const file = join(CACHE, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // Not cached yet.
  }
  console.log(`  fetch ${url}`);
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, text);
  return JSON.parse(text);
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
  return iso.slice(0, 16) + "Z";
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
