// Small geographic helpers shared by scripts and the site. Pure.
import type { Country } from "./schema.ts";

/** Ray casting on a flat [lon, lat, …] ring; fine at 1:110m for "which country is this in". */
function inRing(lon: number, lat: number, ring: number[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i] ?? 0;
    const yi = ring[i + 1] ?? 0;
    const xj = ring[j] ?? 0;
    const yj = ring[j + 1] ?? 0;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The country containing a point, if any (points at sea return undefined). */
export function countryAt(lon: number, lat: number, countries: Country[]): Country | undefined {
  return countries.find((c) => c.rings.some((r) => inRing(lon, lat, r)));
}

/** Nearest country label point; a fallback for points at sea or on tiny islands. */
export function nearestCountry(
  lon: number,
  lat: number,
  countries: Country[],
): Country | undefined {
  let best: Country | undefined;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of countries) {
    const dLon = ((c.label[0] - lon + 540) % 360) - 180;
    const d = dLon * dLon * Math.cos((lat * Math.PI) / 180) ** 2 + (c.label[1] - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * How to write a country in a sentence: the shortest of its names that isn't abbreviated.
 * Natural Earth's NAME is "United States of America" or "Dem. Rep. Congo"; people write
 * "United States" and "Democratic Republic of the Congo".
 */
export function countryName(c: Pick<Country, "name" | "aliases">): string {
  const options = [c.name, ...(c.aliases ?? [])].filter((n) => !n.includes("."));
  return options.sort((a, b) => a.length - b.length)[0] ?? c.name;
}
