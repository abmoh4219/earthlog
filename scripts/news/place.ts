// Where a story happened, from the place names its headlines use. Pure, given the gazetteer
// (scripts/news/places.json) and the country shapes. Honest by construction: it only places
// a story where a headline names the place, and says whether that was a city or a country.
import type { ClusterPlace } from "../../src/scene/headlines.ts";
import type { Country } from "../../src/scene/schema.ts";
import { COUNTRY_NAMES, DEMONYMS } from "./demonyms.ts";

export interface Gazetteer {
  cities: (readonly [string, readonly string[], number, number, string | null, number])[];
  regions: (readonly [string, number, number, string | null])[];
}

/** Short names headlines use for regions in the gazetteer. */
const REGION_ALIASES: Record<string, string> = {
  Gaza: "Gaza Strip",
  "Occupied West Bank": "West Bank",
  Hormuz: "Strait of Hormuz",
  Donetsk: "Donetsk Oblast",
  Luhansk: "Luhansk Oblast",
  Zaporizhzhia: "Zaporizhzhia Oblast",
  Tigray: "Tigray Region",
  Amhara: "Amhara Region",
  Rakhine: "Rakhine State",
  Idlib: "Idlib Governorate",
  Balochistan: "Balochistan",
  "New York State": "New York",
  Kurdistan: "Kurdistan Region",
};

interface Entry {
  kind: "city" | "region" | "country";
  name: string;
  lon: number;
  lat: number;
  country?: string;
  pop: number;
  /** Demonyms count less than names ("American tourist dies in Thailand" is in Thailand). */
  weak?: boolean;
}

export interface Placer {
  /** Every place named in one headline (a name may appear once per headline). */
  mentions: (title: string) => Entry[];
  /**
   * The text with every place it names hidden ("A train derails near ▢▢▢, ▢▢▢, killing…"):
   * cities, regions, countries and demonyms, punctuation kept. For the daily game.
   */
  mask: (text: string, hidden?: string) => string;
  /** The place of a story told by these headlines, or undefined if none names one. */
  place: (titles: string[]) => ClusterPlace | undefined;
}

export function makePlacer(gaz: Gazetteer, countries: Country[]): Placer {
  const byName = new Map<string, Entry>();
  const add = (key: string, e: Entry) => {
    const prev = byName.get(key);
    // Two cities with one name (Valencia, Córdoba): the bigger one, as readers would assume.
    if (!prev || (prev.kind === e.kind && e.pop > prev.pop)) byName.set(key, e);
  };
  const countryPoint = new Map<string, Entry>();
  for (const c of countries) {
    const e: Entry = {
      kind: "country",
      name: c.name,
      lon: c.label[0],
      lat: c.label[1],
      country: c.code,
      pop: 0,
    };
    countryPoint.set(c.code, e);
    add(c.name, e);
    for (const a of c.aliases) if (!a.includes("Republic of") && a.length <= 24) add(a, e);
  }
  for (const [name, alts, lon, lat, iso, pop] of gaz.cities) {
    const e: Entry = { kind: "city", name, lon, lat, pop, ...(iso ? { country: iso } : {}) };
    for (const n of [name, ...alts])
      if (!byName.has(n) || byName.get(n)?.kind === "city") add(n, e);
    // Countries too small for the 110m shapes (Singapore, Bahrain): their biggest city.
    if (iso && !countryPoint.has(iso)) countryPoint.set(iso, { ...e, kind: "country" });
  }
  for (const [name, lon, lat, iso] of gaz.regions) {
    const e: Entry = { kind: "region", name, lon, lat, pop: 0, ...(iso ? { country: iso } : {}) };
    byName.set(name, e);
  }
  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    const e = byName.get(region);
    if (e) byName.set(alias, e);
  }
  const countryEntry = (code: string, weak: boolean): Entry | undefined => {
    const p = countryPoint.get(code);
    return p
      ? {
          ...p,
          kind: "country",
          name: countries.find((c) => c.code === code)?.name ?? p.name,
          ...(weak ? { weak } : {}),
        }
      : undefined;
  };
  for (const [n, code] of Object.entries(COUNTRY_NAMES)) {
    const e = countryEntry(code, false);
    if (e) byName.set(n, e);
  }
  for (const [n, code] of Object.entries(DEMONYMS)) {
    const e = countryEntry(code, true);
    if (e && !byName.has(n)) byName.set(n, e);
  }

  // Each headline is read as runs of 1 to 5 words, longest first, so "South Sudan" wins over
  // "Sudan" and "Port-au-Prince" stays one name. Case matters: "Turkey" the country, never
  // the bird in lower case. Possessives and edge punctuation are dropped ("Krakow's,").
  const maxWords = Math.min(5, Math.max(...[...byName.keys()].map((k) => k.split(" ").length)));
  const clean = (w: string) =>
    w
      .replace(/^[("'‘“[]+/, "")
      .replace(/['’]s$/, "")
      .replace(/[,:;!?"'’”)\]…]+$/, "");

  const mentions = (title: string): Entry[] => {
    const out: Entry[] = [];
    const seen = new Set<string>();
    const ws = title.split(/\s+/).map(clean);
    for (let i = 0; i < ws.length; ) {
      let step = 1;
      for (let n = Math.min(maxWords, ws.length - i); n >= 1; n--) {
        const phrase = ws.slice(i, i + n).join(" ");
        // "U.S." keeps its dots; a sentence-final "Poland." loses its own.
        const e = byName.get(phrase) ?? byName.get(phrase.replace(/\.$/, ""));
        if (e) {
          if (!seen.has(e.name + e.kind)) {
            seen.add(e.name + e.kind);
            out.push(e);
          }
          step = n;
          break;
        }
      }
      i += step;
    }
    return out;
  };

  const mask = (text: string, hidden = "▢▢▢"): string => {
    const raw = text.split(/\s+/);
    const ws = raw.map(clean);
    const out: string[] = [];
    for (let i = 0; i < ws.length; ) {
      let step = 1;
      let hit = false;
      for (let n = Math.min(maxWords, ws.length - i); n >= 1; n--) {
        const phrase = ws.slice(i, i + n).join(" ");
        if (byName.get(phrase) ?? byName.get(phrase.replace(/\.$/, ""))) {
          const first = raw[i] ?? "";
          const last = raw[i + n - 1] ?? "";
          const lead = /^[("'‘“[]+/.exec(first)?.[0] ?? "";
          const tail = /(['’]s)?[,.:;!?"'’”)\]…]*$/.exec(last)?.[0] ?? "";
          out.push(`${lead}${hidden}${tail}`);
          step = n;
          hit = true;
          break;
        }
      }
      if (!hit) out.push(raw[i] ?? "");
      i += step;
    }
    return out.join(" ");
  };

  const place = (titles: string[]): ClusterPlace | undefined => {
    const specific = new Map<string, { e: Entry; n: number }>();
    const nations = new Map<string, { e: Entry; score: number }>();
    for (const t of titles) {
      for (const e of mentions(t)) {
        if (e.kind === "country") {
          const k = e.country ?? e.name;
          const prev = nations.get(k);
          nations.set(k, {
            e: prev?.e && !prev.e.weak ? prev.e : e,
            score: (prev?.score ?? 0) + (e.weak ? 0.6 : 1),
          });
        } else {
          const k = `${e.kind}:${e.name}`;
          specific.set(k, { e, n: (specific.get(k)?.n ?? 0) + 1 });
        }
      }
    }
    const topNation = [...nations.values()].sort((a, b) => b.score - a.score)[0];
    const topSpecific = [...specific.values()].sort((a, b) => b.n - a.n || b.e.pop - a.e.pop)[0];
    // A city or region wins when the headlines agree with it: named more than once, or no
    // other country is named, or it lies in the country they name most.
    if (
      topSpecific &&
      (topSpecific.n > 1 ||
        !topNation ||
        !topSpecific.e.country ||
        topSpecific.e.country === topNation.e.country ||
        topSpecific.n >= topNation.score)
    ) {
      const e = topSpecific.e;
      return {
        name: e.name,
        lon: e.lon,
        lat: e.lat,
        ...(e.country ? { country: e.country } : {}),
        basis: e.kind === "region" ? "region" : "city",
      };
    }
    if (topNation) {
      const e = topNation.e;
      return {
        name: e.name,
        lon: e.lon,
        lat: e.lat,
        ...(e.country ? { country: e.country } : {}),
        basis: "country",
      };
    }
    return undefined;
  };

  return { mentions, mask, place };
}
