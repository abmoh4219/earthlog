// USGS FDSN event service → quakes layer + evidence.
// Verified 2026-11-04: format=geojson returns features with properties {mag, place, time (ms),
// url} and geometry.coordinates [lon, lat, depthKm]. USGS data is a U.S. Government work
// (public domain); credit "USGS Earthquake Hazards Program".
import { z } from "zod";
import type { Evidence, Quake, Source } from "../../src/scene/schema.ts";
import { fetchJson } from "./lib.ts";

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

const Collection = z.object({ features: z.array(Feature) });

export interface QuakeQuery {
  start: string;
  end: string;
  region: { west: number; south: number; east: number; north: number };
  minMagnitude: number;
}

export function usgsUrl(q: QuakeQuery): string {
  const p = new URLSearchParams({
    format: "geojson",
    starttime: q.start,
    endtime: q.end,
    minlatitude: String(q.region.south),
    maxlatitude: String(q.region.north),
    minlongitude: String(q.region.west),
    maxlongitude: String(q.region.east),
    minmagnitude: String(q.minMagnitude),
    orderby: "time-asc",
  });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${p}`;
}

const iso = (msEpoch: number) => new Date(msEpoch).toISOString().replace(/\.\d{3}Z$/, "Z");

export function parseQuakes(json: unknown): { quakes: Quake[]; evidence: Evidence[] } {
  const quakes: Quake[] = [];
  const evidence: Evidence[] = [];
  for (const f of Collection.parse(json).features) {
    const { mag, place, time, url } = f.properties;
    if (mag === null) continue; // An event without a magnitude can't be drawn honestly.
    const [lon, lat, depthKm] = f.geometry.coordinates;
    const id = `usgs:${f.id}`;
    const t = iso(time);
    const where = place ?? "location not named by USGS";
    quakes.push({ id: f.id, t, lon, lat, mag, depthKm, place: where, evidence: id });
    evidence.push({
      id,
      kind: "sensor",
      source: "usgs",
      t,
      lon,
      lat,
      label: `M${mag.toFixed(1)} earthquake, ${Math.round(depthKm)} km deep: ${where}`,
      value: mag,
      unit: "magnitude",
      url,
    });
  }
  return { quakes, evidence };
}

export function usgsSource(retrievedAt: string): Source {
  return {
    id: "usgs",
    name: "USGS Earthquake Hazards Program (FDSN event service)",
    url: "https://earthquake.usgs.gov/",
    license: "Public domain (U.S. Government work)",
    attribution: "USGS",
    retrievedAt,
  };
}

export async function fetchQuakes(q: QuakeQuery) {
  return parseQuakes(await fetchJson(usgsUrl(q)));
}
