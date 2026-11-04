// NASA EONET v3 → storm tracks + evidence.
// Verified 2026-11-04: GET https://eonet.gsfc.nasa.gov/api/v3/events?start=YYYY-MM-DD&end=YYYY-MM-DD
// &status=all returns events {id, title, categories[{id}], sources[{id,url}], geometry[{date,
// type:"Point", coordinates:[lon,lat], magnitudeValue, magnitudeUnit:"kts"}]}. Storm fixes come
// from the agencies listed in `sources` (e.g. JTWC), every 6 hours. NASA data: no copyright.
import { z } from "zod";
import type { Evidence, Source, Storm } from "../../src/scene/schema.ts";
import { fetchJson } from "./lib.ts";

const Geometry = z.object({
  date: z.string(),
  type: z.string(),
  coordinates: z.unknown(),
  magnitudeValue: z.number().nullable().optional(),
  magnitudeUnit: z.string().nullable().optional(),
});

const EonetEvent = z.object({
  id: z.string(),
  title: z.string(),
  link: z.url(),
  categories: z.array(z.object({ id: z.string() })),
  sources: z.array(z.object({ id: z.string(), url: z.string() })),
  geometry: z.array(Geometry),
});

const Response = z.object({ events: z.array(EonetEvent) });
const Point = z.tuple([z.number(), z.number()]);

export function eonetUrl(date: string): string {
  return `https://eonet.gsfc.nasa.gov/api/v3/events?start=${date}&end=${date}&status=all`;
}

const iso = (s: string) => new Date(s).toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * Storm tracks with fixes from a day before the window (to draw the trail) to six hours
 * after it (so the position can be interpolated to the very end). Every fix is evidence.
 */
export function parseStorms(
  json: unknown,
  windowStart: string,
  windowEnd: string,
): { storms: Storm[]; evidence: Evidence[] } {
  const from = Date.parse(windowStart) - 86_400_000;
  const to = Date.parse(windowEnd) + 6 * 3_600_000;
  const storms: Storm[] = [];
  const evidence: Evidence[] = [];
  for (const e of Response.parse(json).events) {
    if (!e.categories.some((c) => c.id === "severeStorms")) continue;
    const agency = e.sources.map((s) => s.id).join(", ") || "EONET";
    const track: Storm["track"] = [];
    for (const g of e.geometry) {
      const point = Point.safeParse(g.coordinates);
      const t = Date.parse(g.date);
      if (g.type !== "Point" || !point.success || t < from || t > to) continue;
      const [lon, lat] = point.data;
      const at = iso(g.date);
      const id = `eonet:${e.id}:${at.slice(0, 13)}Z`;
      const windKt =
        g.magnitudeUnit === "kts" && typeof g.magnitudeValue === "number"
          ? g.magnitudeValue
          : undefined;
      track.push({ t: at, lon, lat, ...(windKt !== undefined ? { windKt } : {}), evidence: id });
      evidence.push({
        id,
        kind: "sensor",
        source: "eonet",
        t: at,
        lon,
        lat,
        label: `${e.title}: ${lat.toFixed(1)}°, ${lon.toFixed(1)}°${windKt !== undefined ? `, winds ${windKt} knots` : ""} (${agency} via NASA EONET)`,
        ...(windKt !== undefined ? { value: windKt, unit: "knots" } : {}),
        url: e.link,
      });
    }
    if (track.length > 0) storms.push({ id: e.id, name: e.title, track });
  }
  return { storms, evidence };
}

export function eonetSource(retrievedAt: string): Source {
  return {
    id: "eonet",
    name: "NASA EONET (Earth Observatory Natural Event Tracker)",
    url: "https://eonet.gsfc.nasa.gov/",
    license: "NASA data: no copyright restrictions (credit NASA EONET and the originating agency)",
    attribution: "NASA EONET",
    retrievedAt,
  };
}

export async function fetchStorms(date: string, windowStart: string, windowEnd: string) {
  return parseStorms(await fetchJson(eonetUrl(date)), windowStart, windowEnd);
}
