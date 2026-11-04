// Natural Earth 1:110m admin-0 countries → public/geo/countries.json (shared by all scenes).
// Natural Earth is public domain (https://www.naturalearthdata.com/about/terms-of-use/).
// Quirk: ISO_A2 is "-99" for France and Norway; ISO_A2_EH holds the usable code.
import { z } from "zod";
import type { Country } from "../../src/scene/schema.ts";

export const NATURAL_EARTH_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const Ring = z.array(z.tuple([z.number(), z.number()]).rest(z.number()));

const Feature = z.object({
  properties: z.object({
    NAME: z.string(),
    ISO_A2_EH: z.string(),
    LABEL_X: z.number(),
    LABEL_Y: z.number(),
  }),
  geometry: z.discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring) }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(Ring)) }),
  ]),
});

const Collection = z.object({ features: z.array(Feature) });

/** 0.01° ≈ 1 km: far finer than 1:110m outlines, and halves the file size. */
const r2 = (x: number) => Math.round(x * 100) / 100;

export function reduceCountries(json: unknown): Country[] {
  const out: Country[] = [];
  for (const f of Collection.parse(json).features) {
    const code = f.properties.ISO_A2_EH;
    // Two disputed areas have no ISO code at all; skip rather than invent one.
    if (!/^[A-Z]{2}$/.test(code)) continue;
    const polygons =
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = polygons
      .map((poly) => poly[0])
      .filter((ring) => ring !== undefined)
      .map((ring) => ring.flatMap(([lon, lat]) => [r2(lon), r2(lat)]));
    out.push({
      code,
      name: f.properties.NAME,
      label: [r2(f.properties.LABEL_X), r2(f.properties.LABEL_Y)],
      rings,
    });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}
