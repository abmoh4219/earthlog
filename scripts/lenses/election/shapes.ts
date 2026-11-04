// US shapes from the Census Bureau's TIGERweb map service (public domain), simplified by the
// server. Verified 2026-11-04:
//   Legislative/MapServer/0 = "120th Congressional Districts" (the 2026 maps), GEOID "0629"
//   State_County/MapServer/0 = "States", GEOID = state FIPS
// Query: where=1=1, outFields=GEOID, maxAllowableOffset (degrees), f=geojson → lon/lat.
import { z } from "zod";
import { fetchJson } from "../../bake/lib.ts";

const Geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.array(z.number()))) }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(z.array(z.number())))),
  }),
]);

const Collection = z.object({
  features: z.array(
    z.object({
      properties: z.object({ GEOID: z.string() }),
      geometry: Geometry.nullable(),
    }),
  ),
});

const BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** GEOID → outer rings as flat [lon, lat, …] arrays. Tiny islands are dropped to save bytes. */
export function parseShapes(json: unknown, minPoints = 4): Map<string, number[][]> {
  const out = new Map<string, number[][]>();
  for (const f of Collection.parse(json).features) {
    if (!f.geometry) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = polys
      .map((p) => p[0] ?? [])
      .filter((ring) => ring.length >= minPoints)
      .map((ring) => ring.flatMap((pt) => [r3(pt[0] ?? 0), r3(pt[1] ?? 0)]));
    if (rings.length) out.set(f.properties.GEOID, rings);
  }
  return out;
}

async function query(path: string, offset: number): Promise<Map<string, number[][]>> {
  const p = new URLSearchParams({
    where: "1=1",
    outFields: "GEOID",
    returnGeometry: "true",
    maxAllowableOffset: String(offset),
    geometryPrecision: "3",
    f: "geojson",
  });
  return parseShapes(await fetchJson(`${BASE}/${path}/query?${p}`));
}

export const fetchStates = () => query("State_County/MapServer/0", 0.03);
export const fetchDistricts = () => query("Legislative/MapServer/0", 0.025);
