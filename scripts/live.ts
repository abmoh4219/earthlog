// pnpm live: the living Earth beside the news (ADR-0022) → public/now/live.json.
// - Earthquakes of magnitude 4.5 and up in the last 24 hours, and the week's "significant"
//   ones (USGS summary feeds; verified 2026-11-09: GeoJSON with properties {mag, place, time,
//   url} and coordinates [lon, lat, depthKm]; public domain, U.S. Government work).
// - Open natural events of the last 10 days: severe storms, wildfires, volcanoes (NASA EONET
//   v3, verified 2026-11-09: /api/v3/events?status=open&days=10; NASA data, no copyright;
//   credited with the agency that reports each event).
// Runs in the hourly news workflow; a source that fails is listed as not reached, and the
// file still writes.
import { join } from "node:path";
import { z } from "zod";
import { LIVE_KINDS, type LiveEvent, LiveFile, type LiveQuake } from "../src/scene/live.ts";
import { fetchJson, ROOT, writeJson } from "./bake/lib.ts";

const QUAKE_FEEDS = [
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
];
const EONET = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=10";

const Feature = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable(),
    time: z.number(),
    url: z.url(),
  }),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]) }),
});
const Quakes = z.object({ features: z.array(Feature) });

const EonetEvent = z.object({
  id: z.string(),
  title: z.string(),
  link: z.url(),
  categories: z.array(z.object({ id: z.string() })),
  sources: z.array(z.object({ id: z.string() })),
  geometry: z.array(
    z.object({
      date: z.string(),
      type: z.string(),
      coordinates: z.unknown(),
      magnitudeValue: z.number().nullable().optional(),
      magnitudeUnit: z.string().nullable().optional(),
    }),
  ),
});
const Events = z.object({ events: z.array(EonetEvent) });
const Point = z.tuple([z.number(), z.number()]);

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const CATEGORY: Record<string, LiveEvent["kind"]> = {
  severeStorms: "storm",
  wildfires: "wildfire",
  volcanoes: "volcano",
};

/** USGS features → quakes, deduplicated across feeds, strongest first. Pure. */
export function parseLiveQuakes(feeds: unknown[]): LiveQuake[] {
  const byId = new Map<string, LiveQuake>();
  for (const json of feeds) {
    for (const f of Quakes.parse(json).features) {
      const { mag, place, time, url } = f.properties;
      if (mag === null) continue; // no magnitude, nothing honest to draw
      const [lon, lat, depthKm] = f.geometry.coordinates;
      byId.set(f.id, {
        id: f.id,
        t: iso(time),
        mag,
        place: place ?? "location not named by USGS",
        lon,
        lat,
        depthKm,
        url,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.mag - a.mag);
}

/** EONET open events → their latest fix, storms, wildfires and volcanoes only. Pure. */
export function parseLiveEvents(json: unknown): LiveEvent[] {
  const out: LiveEvent[] = [];
  for (const e of Events.parse(json).events) {
    const kind = e.categories.map((c) => CATEGORY[c.id]).find((k) => k !== undefined);
    if (!kind || !LIVE_KINDS.includes(kind)) continue;
    const fixes = e.geometry
      .filter((g) => g.type === "Point" && Point.safeParse(g.coordinates).success)
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = fixes.at(-1);
    const point = last ? Point.safeParse(last.coordinates) : undefined;
    if (!last || !point?.success) continue;
    const [lon, lat] = point.data;
    const size =
      typeof last.magnitudeValue === "number" && last.magnitudeUnit
        ? `${last.magnitudeValue.toLocaleString("en-GB")} ${last.magnitudeUnit}`
        : undefined;
    out.push({
      id: e.id,
      kind,
      title: e.title,
      t: iso(Date.parse(last.date)),
      lon,
      lat,
      ...(size ? { size } : {}),
      agency: e.sources.map((s) => s.id).join(", ") || "EONET",
      url: e.link,
    });
  }
  return out;
}

if (import.meta.main) {
  const generatedAt = iso(Date.now());
  let quakes: LiveQuake[] = [];
  let events: LiveEvent[] = [];
  let usgsOk = true;
  let eonetOk = true;
  try {
    quakes = parseLiveQuakes(await Promise.all(QUAKE_FEEDS.map((u) => fetchJson(u))));
  } catch (err) {
    usgsOk = false;
    console.error(`  USGS not reached: ${err instanceof Error ? err.message : err}`);
  }
  try {
    events = parseLiveEvents(await fetchJson(EONET));
  } catch (err) {
    eonetOk = false;
    console.error(`  EONET not reached: ${err instanceof Error ? err.message : err}`);
  }
  const file = LiveFile.parse({
    version: 1,
    generatedAt,
    quakes,
    events,
    sources: [
      {
        id: "usgs",
        name: "USGS Earthquake Hazards Program",
        url: "https://earthquake.usgs.gov/earthquakes/feed/",
        license: "Public domain (U.S. Government work)",
        ok: usgsOk,
      },
      {
        id: "eonet",
        name: "NASA EONET",
        url: "https://eonet.gsfc.nasa.gov/",
        license: "NASA data, no copyright restrictions; credited with the reporting agency",
        ok: eonetOk,
      },
    ],
  });
  const bytes = await writeJson(join(ROOT, "public", "now", "live.json"), file);
  console.log(
    `✓ ${quakes.length} earthquakes, ${events.length} natural events → public/now/live.json (${(bytes / 1024).toFixed(0)} KB)`,
  );
}
