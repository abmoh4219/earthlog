// Context for the hottest stories of "Now" (ADR-0019): a background card from Wikipedia and a
// link to Earthlog's film when one of the last editions already told the story.
// Matching is strict, because a wrong card is worse than none: every word of the article's
// title must appear in the story's headlines, and an article that is only a place (a country,
// a city) never qualifies.
import type { EditionStory } from "../../src/scene/edition.ts";
import type { Headline } from "../../src/scene/headlines.ts";
import { fetchJson } from "../bake/lib.ts";
import { makeCoverage } from "../edition/coverage.ts";
import type { Placer } from "./place.ts";
import { words } from "./text.ts";

const API = "https://en.wikipedia.org/w/api.php";
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Proper names and telling words a story's headlines repeat: the search for its article. */
export function searchTerms(titles: string[]): string {
  const count = new Map<string, number>();
  for (const t of titles) {
    const seen = new Set<string>();
    t.split(/\s+/).forEach((w, i) => {
      const clean = w.replace(/^[("'“‘]+|[)"'”’,.;:!?]+$/g, "").replace(/['’]s$/, "");
      // Names past the first word, and long words: the ones that identify a story.
      const keep = (i > 0 && /^\p{Lu}[\p{L}-]{2,}$/u.test(clean)) || clean.length >= 8;
      if (keep && !seen.has(fold(clean))) {
        seen.add(fold(clean));
        count.set(clean, (count.get(clean) ?? 0) + 1);
      }
    });
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 4)
    .map(([w]) => w)
    .join(" ");
}

/**
 * Whether an article can explain a story: every word of its title (numbers and the
 * parenthetical aside) appears in the headlines, it is not just a place, and not a list.
 */
export function acceptArticle(
  title: string,
  headlines: string[],
  placer: Placer,
  year = new Date().getUTCFullYear(),
): boolean {
  // Lists and year pages ("2026 in Kenya") explain nothing about one story.
  if (/^(List of|Index of|Outline of|Timeline of|\d{4} in )|disambiguation/i.test(title))
    return false;
  const aside = /\(([^)]*)\)\s*$/.exec(title)?.[1];
  const bare = title.replace(/\s*\([^)]*\)\s*$/, "");
  const place = placer.mentions(bare)[0];
  if (place && fold(place.name) === fold(bare)) return false;
  const text = fold(headlines.join(" "));
  const have = new Set(words(text));
  const needed = words(bare).filter((w) => !/^\d+$/.test(w));
  if (!needed.length || !needed.every((w) => have.has(w))) return false;
  // A disambiguation the headlines don't support ("Backlash (2024)", "Opposition (politics)").
  // Asides that only say what someone is ("politician", "footballer") are fine.
  const role =
    /^([\p{L}-]+ )?(politician|footballer|singer|actor|actress|musician|rapper|boxer|cricketer|tennis player|athlete|journalist|businessman|businesswoman|author|writer|director|judge|general|activist|presenter|band|company)$/iu;
  if (aside && !role.test(aside) && !words(aside).every((w) => have.has(w))) return false;
  // Years: this year or last, or one the headlines name ("2014–15 La Liga" is not tonight's).
  for (const y of bare.match(/\b(?:19|20)\d{2}\b/g) ?? [])
    if (Number(y) < year - 1 && !text.includes(y)) return false;
  // A one-word title must be a name in the headlines, not an everyday word ("Progress",
  // "Darkness"), and not capitalised only because it opens the headline.
  if (needed.length === 1) {
    const word = bare.split(/\s+/)[0] ?? "";
    const asName = headlines.some((h) =>
      h
        .split(/\s+/)
        .slice(1)
        .some((w) => fold(w.replace(/[^\p{L}\p{N}-]/gu, "")) === fold(word) && /^\p{Lu}/u.test(w)),
    );
    if (!asName) return false;
  }
  return true;
}

/** An article lead that only describes a region or a continent: not a story's background. */
export function isRegionLead(text: string): boolean {
  return /\b(is|are) (a|the|an) (\w+ ){0,3}(region|continent|subcontinent|subregion)\b/i.test(
    text.slice(0, 160),
  );
}

/**
 * An article lead made readable: pronunciation guides and other-language spellings in brackets
 * go ("Gadi Eisenkot (Hebrew: …; born 19 May 1960), is" → "Gadi Eisenkot is").
 */
export function cleanLead(text: string): string {
  return text
    .replace(/\s*\([^()]*(\[|:)[^()]*\)/g, "")
    .replace(/\s+,/g, ",")
    .replace(/^([^,(]{2,80}), (is|was|are|were) /, "$1 $2 ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Context {
  title: string;
  /** The exact revision read, for the citation. */
  url: string;
  text: string;
}

/** The first one or two sentences of an article's lead, if it explains the story. */
export async function findContext(
  headlines: string[],
  placer: Placer,
): Promise<Context | undefined> {
  const query = searchTerms(headlines);
  if (!query) return undefined;
  const search = (await fetchJson(
    `${API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&formatversion=2`,
  )) as { query?: { search?: { title: string }[] } };
  const title = (search.query?.search ?? [])
    .map((r) => r.title)
    .find((t) => acceptArticle(t, headlines, placer));
  if (!title) return undefined;
  const page = (await fetchJson(
    `${API}?action=query&prop=extracts%7Crevisions&exintro=1&explaintext=1&exsentences=2&rvprop=ids&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`,
  )) as {
    query?: { pages?: { title: string; extract?: string; revisions?: { revid: number }[] }[] };
  };
  const p = page.query?.pages?.[0];
  const text = p?.extract ? cleanLead(p.extract) : undefined;
  const revid = p?.revisions?.[0]?.revid;
  if (!p || !text || !revid || /may refer to/i.test(text) || isRegionLead(text)) return undefined;
  return {
    title: p.title,
    url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(p.title.replace(/ /g, "_"))}&oldid=${revid}`,
    text: text.length > 320 ? `${text.slice(0, text.lastIndexOf(" ", 317))}…` : text,
  };
}

export interface FilmRef {
  date: string;
  slug: string;
  title: string;
}

/**
 * Earthlog films that tell the same story as a cluster: the outlets' headlines matched to each
 * recent edition story the way editions credit coverage (scripts/edition/coverage.ts), newest
 * edition first. Returns cluster id → film.
 */
export function matchFilms(
  clusters: { id: string; headlines: string[] }[],
  headlines: Headline[],
  editions: { date: string; stories: EditionStory[]; films: Set<string> }[],
  placer: Placer,
): Map<string, FilmRef> {
  const coverage = makeCoverage(headlines, "", placer);
  const clusterOf = new Map<string, string>();
  for (const c of clusters) for (const id of c.headlines) clusterOf.set(id, c.id);
  const out = new Map<string, FilmRef>();
  for (const e of [...editions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const s of e.stories) {
      if (!e.films.has(s.slug)) continue;
      const texts = [s.title, s.summary, s.headline, s.article?.title].filter((t): t is string =>
        Boolean(t),
      );
      for (const h of coverage.match(texts)) {
        const c = clusterOf.get(h.id);
        if (c && !out.has(c)) out.set(c, { date: e.date, slug: s.slug, title: s.title });
      }
    }
  }
  return out;
}
