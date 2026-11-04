// World Bank Open Data (CC BY 4.0): country indicators for every country in one request.
// Verified 2026-11-04:
//   GET https://api.worldbank.org/v2/country?format=json&per_page=400
//       → [meta, [{ iso2Code, name, region: { value } }]] (aggregates have region "Aggregates";
//         some region names carry a trailing space, e.g. "Sub-Saharan Africa ")
//   GET https://api.worldbank.org/v2/country/all/indicator/<id>?format=json&date=2010:2026&per_page=20000
//       → [meta, [{ country: { id: ISO2, value }, date: "2025", value: number|null }]]
import { z } from "zod";
import type { Source } from "../../src/scene/schema.ts";
import { fetchJson } from "./lib.ts";

export const INDICATORS = {
  inflation: { id: "FP.CPI.TOTL.ZG", label: "Inflation, consumer prices", unit: "% a year" },
  growth: { id: "NY.GDP.MKTP.KD.ZG", label: "GDP growth", unit: "% a year" },
  unemployment: { id: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "% of the labour force" },
} as const;

export type IndicatorKey = keyof typeof INDICATORS;

const Countries = z.tuple([
  z.unknown(),
  z.array(
    z.object({ iso2Code: z.string(), name: z.string(), region: z.object({ value: z.string() }) }),
  ),
]);

const Values = z.tuple([
  z.object({ lastupdated: z.string().optional() }).passthrough(),
  z
    .array(
      z.object({
        country: z.object({ id: z.string(), value: z.string() }),
        date: z.string(),
        value: z.number().nullable(),
      }),
    )
    .nullable(),
]);

export interface WbCountry {
  iso2: string;
  name: string;
  region: string;
}

export function parseCountries(json: unknown): WbCountry[] {
  return Countries.parse(json)[1]
    .map((c) => ({ iso2: c.iso2Code, name: c.name, region: c.region.value.trim() }))
    .filter((c) => c.region !== "Aggregates" && /^[A-Z]{2}$/.test(c.iso2));
}

export interface Series {
  updated?: string;
  /** ISO2 → [{ year, value }], oldest first, nulls dropped. */
  byCountry: Map<string, { year: string; value: number }[]>;
}

export function parseValues(json: unknown): Series {
  const [meta, rows] = Values.parse(json);
  const byCountry = new Map<string, { year: string; value: number }[]>();
  for (const r of rows ?? []) {
    if (r.value === null) continue;
    byCountry.set(r.country.id, [
      ...(byCountry.get(r.country.id) ?? []),
      { year: r.date, value: r.value },
    ]);
  }
  for (const v of byCountry.values()) v.sort((a, b) => a.year.localeCompare(b.year));
  return { ...(meta.lastupdated ? { updated: meta.lastupdated } : {}), byCountry };
}

export async function fetchCountries(): Promise<WbCountry[]> {
  return parseCountries(
    await fetchJson("https://api.worldbank.org/v2/country?format=json&per_page=400"),
  );
}

export async function fetchIndicator(key: IndicatorKey, from = 2010, to = 2026): Promise<Series> {
  const id = INDICATORS[key].id;
  return parseValues(
    await fetchJson(
      `https://api.worldbank.org/v2/country/all/indicator/${id}?format=json&date=${from}:${to}&per_page=20000`,
    ),
  );
}

export function worldBankSource(retrievedAt: string): Source {
  return {
    id: "worldbank",
    name: "World Bank Open Data (World Development Indicators)",
    url: "https://data.worldbank.org/",
    license: "CC BY 4.0 (https://datacatalog.worldbank.org/public-licenses)",
    attribution: "World Bank",
    retrievedAt,
  };
}
