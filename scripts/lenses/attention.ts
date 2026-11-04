// Readers by language: how many people read a story's article in each Wikipedia language
// edition on the day. The first piece of the "curiosity map" (PLAN.md Phase 15). A language
// is not a country (Spanish readers are in Spain, Mexico, Argentina…), and the UI says so.
// Verified 2026-11-04: prop=langlinks lists the article's other editions; the per-article
// pageviews API takes <lang>.wikipedia as its project (CC0).
import { z } from "zod";
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
