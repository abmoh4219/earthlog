// USGS earthquake detail: the event, its ShakeMap (intensity contours, rupture) and PAGER
// (people exposed by intensity, estimated intensity in nearby cities, alert level).
// Verified 2026-11-05 on us6000u18k (M7.7, Panama):
//   GET https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=<id>&format=geojson
//     → properties { mag, place, time (ms), felt (DYFI responses), alert, tsunami, url,
//       products: { shakemap: [{ contents: { "download/cont_mmi.json": { url } … } }],
//                   losspager: [{ contents: { "json/exposures.json", "json/cities.json" } }] } }
//   cont_mmi.json → FeatureCollection of MultiLineString, properties { value (MMI), color }
//   rupture.json  → FeatureCollection, geometry MultiPolygon [[[lon, lat, depthKm]…]]
//   exposures.json → { population_exposure: { mmi: [1..10], aggregated_exposure: [...] } }
//   cities.json → { all_cities: [{ name, lat, lon, pop, mmi }] }
// USGS data is a U.S. Government work (public domain); credit "USGS Earthquake Hazards Program".
import { z } from "zod";
import { fetchJson } from "./lib.ts";

const Url = z.object({ url: z.url() });
export const Detail = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number(),
    place: z.string(),
    time: z.number(),
    felt: z.number().nullable().optional(),
    alert: z.string().nullable().optional(),
    tsunami: z.number().optional(),
    url: z.url(),
    products: z.object({
      shakemap: z.array(z.object({ contents: z.record(z.string(), Url) })).optional(),
      losspager: z.array(z.object({ contents: z.record(z.string(), Url) })).optional(),
    }),
  }),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]) }),
});
export type Detail = z.infer<typeof Detail>;

const Contours = z.object({
  features: z.array(
    z.object({
      properties: z.object({ value: z.number(), color: z.string() }),
      geometry: z.object({ coordinates: z.array(z.array(z.array(z.number()))) }),
    }),
  ),
});

const Rupture = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ type: z.string(), coordinates: z.unknown() }).nullable(),
    }),
  ),
});

const Exposures = z.object({
  population_exposure: z.object({
    mmi: z.array(z.number()),
    aggregated_exposure: z.array(z.number()),
  }),
});

const Cities = z.object({
  all_cities: z.array(
    z.object({
      name: z.string(),
      lat: z.number(),
      lon: z.number(),
      pop: z.number(),
      mmi: z.number(),
    }),
  ),
});

export interface Contour {
  mmi: number;
  color: string;
  /** Each a flat [lon, lat, …] line. */
  lines: number[][];
}

export function parseContours(json: unknown): Contour[] {
  return Contours.parse(json)
    .features.map((f) => ({
      mmi: f.properties.value,
      color: f.properties.color,
      lines: f.geometry.coordinates
        .map((line) => line.flatMap((p) => [p[0] ?? 0, p[1] ?? 0]))
        .filter((l) => l.length >= 4),
    }))
    .sort((a, b) => b.mmi - a.mmi);
}

/** Rupture faces as flat [lon, lat, …] rings (the surface trace of the fault model). */
export function parseRupture(json: unknown): number[][] {
  const rings: number[][] = [];
  for (const f of Rupture.parse(json).features) {
    if (f.geometry?.type !== "MultiPolygon") continue;
    const polys = z.array(z.array(z.array(z.array(z.number())))).safeParse(f.geometry.coordinates);
    if (!polys.success) continue;
    for (const poly of polys.data)
      for (const ring of poly) rings.push(ring.flatMap((p) => [p[0] ?? 0, p[1] ?? 0]));
  }
  return rings;
}

/** People exposed at each whole intensity, from PAGER: [{ mmi, people }]. */
export function parseExposure(json: unknown): { mmi: number; people: number }[] {
  const e = Exposures.parse(json).population_exposure;
  return e.mmi.map((mmi, i) => ({ mmi, people: Math.round(e.aggregated_exposure[i] ?? 0) }));
}

export function parseCities(json: unknown) {
  return Cities.parse(json).all_cities;
}

/** USGS Modified Mercalli roman numerals, words and colours (the ShakeMap legend). */
export const MMI = [
  { roman: "I", word: "not felt", color: "#ffffff" },
  { roman: "II", word: "weak", color: "#bfccff" },
  { roman: "III", word: "weak", color: "#a0e6ff" },
  { roman: "IV", word: "light", color: "#80ffff" },
  { roman: "V", word: "moderate", color: "#7aff93" },
  { roman: "VI", word: "strong", color: "#ffff00" },
  { roman: "VII", word: "very strong", color: "#ffc800" },
  { roman: "VIII", word: "severe", color: "#ff9100" },
  { roman: "IX", word: "violent", color: "#ff0000" },
  { roman: "X", word: "extreme", color: "#c80000" },
] as const;

export function mmiInfo(value: number) {
  return MMI[Math.max(0, Math.min(9, Math.round(value) - 1))] ?? MMI[0];
}

/** The largest quake within `radiusKm` of a point, from `start` to `end` (ISO dates). */
export async function findQuake(
  lon: number,
  lat: number,
  start: string,
  end: string,
  radiusKm = 600,
): Promise<string | undefined> {
  const p = new URLSearchParams({
    format: "geojson",
    starttime: start,
    endtime: end,
    latitude: String(lat),
    longitude: String(lon),
    maxradiuskm: String(radiusKm),
    minmagnitude: "4.5",
    orderby: "magnitude",
    limit: "1",
  });
  const json = z
    .object({ features: z.array(z.object({ id: z.string() })) })
    .parse(await fetchJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?${p}`));
  return json.features[0]?.id;
}

export async function fetchDetail(id: string): Promise<Detail> {
  return Detail.parse(
    await fetchJson(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${id}&format=geojson`,
    ),
  );
}

/** A product file's JSON, or undefined when the event has no such product. */
export async function fetchProduct(
  detail: Detail,
  product: "shakemap" | "losspager",
  file: string,
): Promise<unknown> {
  const url = detail.properties.products[product]?.[0]?.contents[file]?.url;
  return url ? fetchJson(url) : undefined;
}
