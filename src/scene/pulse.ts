// A country's pulse (ADR-0022): what is happening there now, in one place. Pure; shared by the
// Now view and its tests. The news placed in the country, its earthquakes and natural events,
// and the stories recent editions filmed there.
import { countryAt } from "./geo.ts";
import type { LiveEvent, LiveFile, LiveQuake } from "./live.ts";
import type { NowStory } from "./now.ts";
import type { Country } from "./schema.ts";

export interface PulseStory {
  date: string;
  slug: string;
  title: string;
  country?: string;
}

export interface Pulse {
  country: Country;
  news: NowStory[];
  quakes: LiveQuake[];
  events: LiveEvent[];
  films: PulseStory[];
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Whether a point belongs to the country: inside its outline, or (offshore earthquakes, which
 * USGS names "106 km ENE of Hasaki, Japan") named so by the source.
 */
function inCountry(
  p: { lon: number; lat: number; place?: string; title?: string },
  c: Country,
  countries: Country[],
): boolean {
  if (countryAt(p.lon, p.lat, countries)?.code === c.code) return true;
  const named = fold(p.place ?? p.title ?? "");
  return [c.name, ...c.aliases].some((n) => n.length > 3 && named.endsWith(fold(n)));
}

export function countryPulse(
  country: Country,
  stories: NowStory[],
  live: LiveFile | undefined,
  films: PulseStory[],
  countries: Country[],
): Pulse {
  return {
    country,
    news: stories.filter((s) => s.cluster.place?.country === country.code),
    quakes: (live?.quakes ?? []).filter((q) => inCountry(q, country, countries)),
    events: (live?.events ?? []).filter((e) => inCountry(e, country, countries)),
    films: films.filter((f) => f.country === country.code).slice(0, 5),
  };
}

/** A pulse with nothing in it says so, rather than showing an empty card. */
export function pulseIsQuiet(p: Pulse): boolean {
  return !p.news.length && !p.quakes.length && !p.events.length && !p.films.length;
}

/**
 * A story to open at random ("Surprise me"): among those with a film, hotter ones more often,
 * never the one just shown. `r` in [0, 1) makes it testable.
 */
export function surprise<T extends { id: string; heat: number }>(
  items: T[],
  r: number,
  not?: string,
): T | undefined {
  const pool = items.filter((i) => i.id !== not);
  const total = pool.reduce((n, i) => n + 1 + i.heat, 0);
  let at = r * total;
  for (const i of pool) {
    at -= 1 + i.heat;
    if (at < 0) return i;
  }
  return pool.at(-1);
}
