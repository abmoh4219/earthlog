// Readers by language: how many people read a story's article in each Wikipedia language
// edition on the day. The first piece of the "curiosity map" (PLAN.md Phase 15). A language
// is not a country (Spanish readers are in Spain, Mexico, Argentina…), and the UI says so.
// Verified 2026-11-04: prop=langlinks lists the article's other editions; the per-article
// pageviews API takes <lang>.wikipedia as its project (CC0).
import { z } from "zod";
import type { Country, LayerData } from "../../src/scene/schema.ts";
import { fetchJson } from "../bake/lib.ts";

const LangLinks = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        langlinks: z.array(z.object({ lang: z.string(), title: z.string() })).optional(),
      }),
    ),
  }),
});

const Daily = z.object({ items: z.array(z.object({ views: z.number() })) });

/** Languages checked first: the largest Wikipedias by readership, then by speakers. */
const PRIORITY = [
  "es",
  "de",
  "ja",
  "fr",
  "ru",
  "it",
  "zh",
  "pt",
  "pl",
  "ar",
  "fa",
  "nl",
  "tr",
  "id",
  "ko",
  "uk",
  "hi",
  "vi",
  "he",
  "sv",
  "cs",
  "ta",
  "te",
  "bn",
  "th",
  "ms",
];

/** Language names in English for panels. */
export const LANGUAGE: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  ja: "Japanese",
  fr: "French",
  ru: "Russian",
  it: "Italian",
  zh: "Chinese",
  pt: "Portuguese",
  pl: "Polish",
  ar: "Arabic",
  fa: "Persian",
  nl: "Dutch",
  tr: "Turkish",
  id: "Indonesian",
  ko: "Korean",
  uk: "Ukrainian",
  hi: "Hindi",
  vi: "Vietnamese",
  he: "Hebrew",
  sv: "Swedish",
  cs: "Czech",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  th: "Thai",
  ms: "Malay",
};

export interface LanguageReaders {
  lang: string;
  title: string;
  views: number;
}

async function viewsOn(lang: string, title: string, date: string): Promise<number> {
  const d = date.replace(/-/g, "");
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, "_"))}/daily/${d}/${d}`;
  try {
    return Daily.parse(await fetchJson(url)).items[0]?.views ?? 0;
  } catch {
    return 0; // 404: no views that day
  }
}

/** Readers in English and up to `max` other languages, most read first. */
export async function fetchLanguageReaders(
  title: string,
  date: string,
  max = 10,
): Promise<LanguageReaders[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllimit=500&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const links = LangLinks.parse(await fetchJson(url)).query.pages[0]?.langlinks ?? [];
  const byLang = new Map(links.map((l) => [l.lang, l.title]));
  const langs = PRIORITY.filter((l) => byLang.has(l)).slice(0, max);
  const out: LanguageReaders[] = [{ lang: "en", title, views: await viewsOn("en", title, date) }];
  for (const lang of langs) {
    const t = byLang.get(lang) ?? "";
    out.push({ lang, title: t, views: await viewsOn(lang, t, date) });
  }
  return out.filter((r) => r.views > 0).sort((a, b) => b.views - a.views);
}

// ── The curiosity map ──────────────────────────────────────────────────────────
// Where each language is mainly spoken, so a language's readers can be drawn on the globe.
// Approximate on purpose and labelled as such: a language is not a country (Spanish readers
// are in Spain, Mexico, the US…), and each country is given to one language only. English is
// left off the map: it is read everywhere, and the globe would just light up the
// English-speaking world. Territories: ISO 3166-1 alpha-2, countries where the language is
// the main or official language (compiled from the Unicode CLDR territory data, simplified).
export const LANGUAGE_HOME: Record<string, string[]> = {
  es: [
    "ES",
    "MX",
    "AR",
    "CO",
    "PE",
    "VE",
    "CL",
    "EC",
    "GT",
    "CU",
    "BO",
    "DO",
    "HN",
    "PY",
    "SV",
    "NI",
    "CR",
    "PA",
    "UY",
  ],
  de: ["DE", "AT"],
  ja: ["JP"],
  fr: ["FR", "BE", "LU"],
  ru: ["RU", "BY"],
  it: ["IT"],
  zh: ["CN", "TW"],
  pt: ["BR", "PT", "AO", "MZ"],
  pl: ["PL"],
  ar: [
    "SA",
    "EG",
    "IQ",
    "SY",
    "JO",
    "AE",
    "KW",
    "QA",
    "BH",
    "OM",
    "YE",
    "LB",
    "LY",
    "TN",
    "DZ",
    "MA",
    "SD",
    "MR",
  ],
  fa: ["IR", "AF"],
  nl: ["NL", "SR"],
  tr: ["TR"],
  id: ["ID"],
  ko: ["KR"],
  uk: ["UA"],
  hi: ["IN"],
  vi: ["VN"],
  he: ["IL"],
  sv: ["SE"],
  cs: ["CZ"],
  ta: ["LK"],
  bn: ["BD"],
  th: ["TH"],
  ms: ["MY"],
};

export interface CuriosityRegion {
  lang: string;
  name: string;
  views: number;
  code: string;
}

/**
 * Countries to light for each language with readers (English excluded), the strongest
 * language first; a country already given to a stronger language is skipped.
 */
export function curiosityRegions(readers: LanguageReaders[]): CuriosityRegion[] {
  const out: CuriosityRegion[] = [];
  const taken = new Set<string>();
  for (const r of [...readers].sort((a, b) => b.views - a.views)) {
    if (r.lang === "en") continue;
    for (const code of LANGUAGE_HOME[r.lang] ?? []) {
      if (taken.has(code)) continue;
      taken.add(code);
      out.push({ lang: r.lang, name: LANGUAGE[r.lang] ?? r.lang, views: r.views, code });
    }
  }
  return out;
}

/** Cyan (fewer readers) to amber (most), on a log scale between the day's min and max. */
export function curiosityColor(views: number, min: number, max: number): string {
  const u = max > min ? (Math.log(views) - Math.log(min)) / (Math.log(max) - Math.log(min)) : 1;
  const a = [94, 242, 255];
  const b = [242, 182, 90];
  const t = Math.max(0, Math.min(1, u));
  return `#${a
    .map((v, i) =>
      Math.round(v + ((b[i] ?? v) - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * The curiosity map as globe layers: each language's countries glowing by its readers, and a
 * column of light per language at its main country, height = readers. Plus the places, for
 * framing the shot. Empty when fewer than two languages can be placed.
 */
export function curiosityLayers(
  readers: LanguageReaders[],
  countries: Country[],
): { layers: LayerData[]; points: { lon: number; lat: number }[] } {
  const regions = curiosityRegions(readers);
  const langs = [...new Set(regions.map((r) => r.lang))];
  if (langs.length < 2) return { layers: [], points: [] };
  const views = regions.map((r) => r.views);
  const min = Math.min(...views);
  const max = Math.max(...views);
  const byCode = new Map(countries.map((c) => [c.code, c]));
  const fills = regions.flatMap((r) => {
    const c = byCode.get(r.code);
    return c
      ? [
          {
            id: `${r.lang}-${r.code}`,
            name: `${r.name} (language)`,
            rings: c.rings,
            color: curiosityColor(r.views, min, max),
            opacity:
              0.22 +
              0.33 *
                (max > min
                  ? (Math.log(r.views) - Math.log(min)) / (Math.log(max) - Math.log(min))
                  : 1),
            pulse: r.views === max,
          },
        ]
      : [];
  });
  const columns = langs.flatMap((lang) => {
    // The first of its countries we have an outline for (not every code is in Natural Earth).
    const first = regions.find((r) => r.lang === lang && byCode.has(r.code));
    const c = first ? byCode.get(first.code) : undefined;
    return first && c
      ? [
          {
            id: lang,
            name: first.name,
            lon: c.label[0],
            lat: c.label[1],
            value: first.views,
            color: curiosityColor(first.views, min, max),
            label: true,
          },
        ]
      : [];
  });
  return {
    layers: [
      {
        kind: "regions",
        name: "curiosity",
        regions: fills,
        legend: [
          { label: "Most readers (language)", color: curiosityColor(max, min, max) },
          { label: "Fewer readers (language)", color: curiosityColor(min, min, max) },
          { label: "Where each language is mainly spoken; English not shown", color: "#e8f6ff" },
        ],
      },
      { kind: "columns", name: "curiosity", unit: "readers", maxHeight: 1_800_000, columns },
    ],
    points: columns.map((c) => ({ lon: c.lon, lat: c.lat })),
  };
}
