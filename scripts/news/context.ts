// Context for the hottest stories of "Now" (ADR-0019): a background card from Wikipedia and a
// link to Earthlog's film when one of the last editions already told the story.
// Matching is strict, because a wrong card is worse than none: every word of the article's
// title must appear in the story's headlines, and an article that is only a place (a country,
// a city) never qualifies.
import type { EditionStory } from "../../src/scene/edition.ts";
import type { Headline } from "../../src/scene/headlines.ts";
import { fetchJson } from "../bake/lib.ts";
import { makeCoverage } from "../edition/coverage.ts";
import { DEMONYMS } from "./demonyms.ts";
import type { Placer } from "./place.ts";
import { isTitleCase, words } from "./text.ts";

export { isTitleCase };

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

// Peoples ("Nigerians", "Israelis"): DEMONYMS keys are capitalised; folded once here.
const PEOPLES = new Set(Object.keys(DEMONYMS).map((d) => fold(d)));
const isPeople = (title: string) => {
  const f = fold(title);
  return PEOPLES.has(f) || PEOPLES.has(f.replace(/s$/, "")) || PEOPLES.has(f.replace(/es$/, ""));
};

// Continents and world regions: places, never a story's background.
const REGIONS = new Set(
  [
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "South America",
    "Latin America",
    "Oceania",
    "Antarctica",
    "Middle East",
    "West Africa",
    "East Africa",
    "Southern Africa",
    "North Africa",
    "Central Africa",
    "Horn of Africa",
    "Sahel",
    "Southeast Asia",
    "South Asia",
    "Central Asia",
    "East Asia",
    "Caribbean",
    "Balkans",
    "Scandinavia",
  ].map((r) => r.toLowerCase()),
);

const CALENDAR =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|(January|February|March|April|May|June|July|August|September|October|November|December)( \d{1,2})?|Christmas|Christmas Day|Christmas Eve|Easter|New Year|New Year's Eve|New Year's Day|Halloween|Thanksgiving|Weekend)$/i;

// Labels before a colon that say what kind of piece it is, not what it is about.
const KIND_LABEL =
  /^(live|watch|analysis|explainer|opinion|comment|exclusive|breaking|update|video|photos|podcast|q&a|interview|review|factbox|timeline|in pictures|week in review)$/i;
const OUTLET_NAMES =
  /^(BBC|BBC News|Al Jazeera|France 24|DW|Deutsche Welle|NPR|Sky News|Sky|Guardian|The Guardian|AllAfrica)$/i;
// Small words that may sit inside a name ("Bank of England", "Pope Leo XIV").
const NAME_GLUE = new Set([
  "of",
  "the",
  "de",
  "du",
  "des",
  "la",
  "le",
  "el",
  "da",
  "del",
  "di",
  "von",
  "van",
  "al",
  "bin",
  "and",
  "&",
]);

export interface Query {
  q: string;
  /** label: the subject named before a colon ("Diwali: …"); name: a proper name; words: the rest. */
  kind: "label" | "name" | "first" | "cop" | "words";
}

/**
 * What to search Wikipedia for, best first: the subject a headline names before its colon
 * ("Ebola: Why is there still no vaccine?"), the proper names the headlines repeat ("Lisa
 * Nandy", "Messi"), a COP climate summit by its number, then telling words and a headline.
 */
export function searchQueries(titles: string[]): Query[] {
  const out: Query[] = [];
  const add = (q: string, kind: Query["kind"]) => {
    if (q.length > 2 && !out.some((x) => fold(x.q) === fold(q))) out.push({ q, kind });
  };
  for (const t of titles) {
    const label = /^([^:]{2,40}):\s+\S/.exec(t)?.[1]?.trim();
    if (
      label &&
      label.split(/\s+/).length <= 3 &&
      /^\p{Lu}/u.test(label) &&
      !KIND_LABEL.test(label) &&
      !/\blive\b/i.test(label)
    )
      add(label, "label");
  }
  for (const t of titles) {
    const cop = /\bCOP ?(\d{2})\b/i.exec(t)?.[1];
    // COP1 met in 1995, one a year, none in 2020: COP25 was 2019, COP31 is 2026.
    const n = Number(cop);
    if (cop)
      add(`${n <= 25 ? 1994 + n : 1995 + n} United Nations Climate Change Conference`, "cop");
  }
  const count = new Map<string, number>();
  // A headline's first word alone may only open the sentence ("After the midterms…"), or be a
  // name ("Messi becomes…"): kept as a weaker "first" query, accepted only for a person.
  const firsts: string[] = [];
  for (const t of titles) {
    // In Title Case every word looks like a name: no names to read from it.
    if (isTitleCase(t)) continue;
    const tokens = t.replace(/^[^:]{2,40}:\s+/, "").split(/\s+/);
    const seen = new Set<string>();
    let run: string[] = [];
    let start = 0;
    const flush = () => {
      while (run.length && NAME_GLUE.has(run.at(-1)?.toLowerCase() ?? "")) run.pop();
      const name = run.join(" ");
      if (run.length && !OUTLET_NAMES.test(name)) {
        if (start === 0 && run.length === 1) firsts.push(name);
        else if (!seen.has(fold(name))) {
          count.set(name, (count.get(name) ?? 0) + 1);
          seen.add(fold(name));
        }
      }
      run = [];
    };
    tokens.forEach((raw, i) => {
      const w = raw.replace(/^[("'“‘]+|[)"'”’,.;:!?]+$/g, "").replace(/['’]s$/, "");
      const capital = /^\p{Lu}[\p{L}\p{N}-]*$/u.test(w);
      if (capital || (run.length && NAME_GLUE.has(w.toLowerCase()))) {
        if (!run.length) start = i;
        run.push(w);
      } else flush();
      if (/[,.;:!?]$/.test(raw)) flush();
    });
    flush();
  }
  for (const [name] of [...count.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 3))
    add(name, "name");
  // Everyday openers ("After", "Why", "Over") are not names.
  for (const f of firsts.filter((x) => words(x).length > 0).slice(0, 1)) add(f, "first");
  add(searchTerms(titles), "words");
  const plain = titles.find((h) => !/\?\s*$/.test(h))?.replace(/^[^:]{2,32}:\s+/, "");
  if (plain) add(plain, "words");
  return out;
}

/**
 * An article a name or label search found that the every-word rule would miss: a person's
 * full name from a surname the headlines use ("Messi" → "Lionel Messi"), the subject itself
 * from a label ("Ebola" → "Ebola disease"), the COP conference. Only the top result counts.
 */
export function acceptNamed(title: string, query: Query, rank: number, placer: Placer): boolean {
  if (rank > 0 || /^(List of|Index of|Outline of|Timeline of)|disambiguation/i.test(title))
    return false;
  const bare = title.replace(/\s*\([^)]*\)\s*$/, "");
  const place = placer.mentions(bare)[0];
  if (place && fold(place.name) === fold(bare)) return false;
  if (REGIONS.has(fold(bare)) || isPeople(bare)) return false;
  if (query.kind === "cop") return fold(title) === fold(query.q);
  const words = bare.split(/\s+/);
  if ((query.kind === "name" || query.kind === "first") && !query.q.includes(" "))
    return words.length >= 2 && words.length <= 3 && fold(words.at(-1) ?? "") === fold(query.q);
  if (query.kind === "label")
    return (
      fold(bare) === fold(query.q) ||
      (fold(bare).startsWith(`${fold(query.q)} `) && words.length <= 3)
    );
  return false;
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
  // A region, or its people ("Latin Americans" → Latin America).
  if (REGIONS.has(fold(bare)) || REGIONS.has(fold(bare).replace(/ns?$/, ""))) return false;
  // Places are where, not what: one word that names a place ("Gaza"), or "City, Country".
  if (!bare.includes(" ") && placer.mentions(bare).length) return false;
  if (bare.includes(", ") && bare.split(", ").every((part) => placer.mentions(part).length))
    return false;
  // Initials and numerals must be in the headlines too: "Pope Leo X" is not Pope Leo XIV.
  const shortTokens = bare
    .split(/\s+/)
    .filter((w) => /^[\p{Lu}\d]{1,3}$/u.test(w) && !/^\d{4}$/.test(w));
  const raw = ` ${headlines.join(" ")} `;
  if (shortTokens.some((w) => !new RegExp(`[^\\p{L}\\p{N}]${w}[^\\p{L}\\p{N}]`, "u").test(raw)))
    return false;
  // Dates in a headline ("…in for Christmas", "on Monday") are when, not what.
  if (CALENDAR.test(bare)) return false;
  // A people ("Nigerians") is not a story's subject.
  if (isPeople(bare)) return false;
  // A common-noun phrase ("Street children", "Police state", "Climate change"): Wikipedia
  // capitalises only its first word. A subject has a name in it, a year, or a dated aside.
  const rest = bare.split(/\s+/).slice(1);
  const named = rest.some((w) => /^\p{Lu}/u.test(w) || /\d/.test(w));
  if (rest.length && !named && !/\b(19|20)\d{2}\b/.test(title) && !/\d/.test(bare)) return false;
  const text = fold(headlines.join(" "));
  const have = new Set(words(text));
  const needed = words(bare).filter((w) => !/^\d+$/.test(w));
  // A title that repeats its word is a work's ("Europe, Europe", a book), not a news subject.
  if (new Set(needed).size < needed.length) return false;
  if (!needed.length || !needed.every((w) => have.has(w))) return false;
  // A disambiguation the headlines don't support ("Backlash (2024)", "Opposition (politics)").
  // Asides that only say what someone is ("politician", "footballer") are fine.
  const role =
    /^([\p{L}-]+ )?(politician|footballer|singer|actor|actress|musician|rapper|boxer|cricketer|tennis player|athlete|journalist|businessman|businesswoman|author|writer|director|judge|general|activist|presenter|band|company)$/iu;
  // An aside naming a country only says which one ("Republican Party (United States)").
  const asideIsCountry =
    !!aside && placer.mentions(aside).some((p) => p.kind === "country" && words(aside).length <= 3);
  if (aside && !role.test(aside) && !asideIsCountry && !words(aside).every((w) => have.has(w)))
    return false;
  // Years: this year or last, or one the headlines name ("2014–15 La Liga" is not tonight's).
  for (const y of bare.match(/\b(?:19|20)\d{2}\b/g) ?? [])
    if (Number(y) < year - 1 && !text.includes(y)) return false;
  // A one-word title must be a name in the headlines, not an everyday word ("Progress",
  // "Darkness"), and not capitalised only because it opens the headline.
  if (needed.length === 1) {
    const word = bare.split(/\s+/)[0] ?? "";
    const asName = headlines.some(
      (h) =>
        !isTitleCase(h) &&
        h
          // After a subject label ("Poland: Gunman kills…") the next word opens the sentence;
          // after a kind label ("Photos: Diwali celebrations…") it is the subject itself.
          .replace(/^([^:]{2,40}):\s+/, (m, label: string) =>
            KIND_LABEL.test(label.trim()) ? m : "",
          )
          .split(/\s+/)
          .some((w, i, all) => {
            if (i === 0) return false;
            if (fold(w.replace(/[^\p{L}\p{N}-]/gu, "")) !== fold(word) || !/^\p{Lu}/u.test(w))
              return false;
            // Part of a longer name ("60 Minutes", "Route du Rhum", "Rhum Festival"): that
            // name is the subject, not this word.
            const before = all[i - 1] ?? "";
            const beforeThat = all[i - 2] ?? "";
            const after = all[i + 1] ?? "";
            const capital = (x: string) => /^\p{Lu}/u.test(x) || /^\d/.test(x);
            const glued = NAME_GLUE.has(before.toLowerCase()) && capital(beforeThat);
            return !(
              (i > 1 && capital(before)) ||
              /^\d/.test(before) ||
              glued ||
              (capital(after) && !/[,.;:!?]$/.test(w))
            );
          }),
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
    .replace(/\s*\(\s*[;,]?\s*\)/g, "")
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
  // Searches, best first (searchQueries): the subject before a colon, the names the headlines
  // repeat, a COP summit, telling words, then a headline itself (Wikipedia's search reads a
  // sentence well, and finds event articles written within hours: "2026 … collision").
  for (const query of searchQueries(headlines).slice(0, 6)) {
    const search = (await fetchJson(
      `${API}?action=query&list=search&srsearch=${encodeURIComponent(query.q)}&srlimit=5&format=json&formatversion=2`,
    )) as { query?: { search?: { title: string }[] } };
    const found = (search.query?.search ?? []).map((r) => r.title);
    const titles = found.filter(
      (t, rank) => acceptArticle(t, headlines, placer) || acceptNamed(t, query, rank, placer),
    );
    for (const title of titles.slice(0, 2)) {
      const context = await leadOf(title);
      // A full name found from a single word must be a person's ("Messi" → "Lionel Messi").
      const byOneName = !acceptArticle(title, headlines, placer) && !query.q.includes(" ");
      if (context && (!byOneName || query.kind === "label" || isPersonLead(context.text)))
        return context;
    }
  }
  return undefined;
}

/** A lead that introduces a person: a birth date, or what they do. */
export function isPersonLead(text: string): boolean {
  return /\(born\b|\bborn \d|\b(is|was) an? ([\p{L}-]+ ){0,3}(footballer|player|politician|singer|actor|actress|rapper|musician|businessman|businesswoman|journalist|author|writer|athlete|boxer|cricketer|coach|manager|entrepreneur|activist|presenter|comedian|director|lawyer|judge|diplomat|official)\b/iu.test(
    text.slice(0, 240),
  );
}

/** The first one or two sentences of an article, cited by its exact revision. */
async function leadOf(title: string): Promise<Context | undefined> {
  const page = (await fetchJson(
    `${API}?action=query&prop=extracts%7Crevisions&exintro=1&explaintext=1&exsentences=2&rvprop=ids&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`,
  )) as {
    query?: { pages?: { title: string; extract?: string; revisions?: { revid: number }[] }[] };
  };
  const p = page.query?.pages?.[0];
  const text = p?.extract ? cleanLead(p.extract) : undefined;
  const revid = p?.revisions?.[0]?.revid;
  // Disambiguation in prose ("Republican Party is a name used by many political parties").
  const ambiguous = /may refer to|can refer to|is a name used by|is the name of (several|many)/i;
  if (!p || !text || !revid || ambiguous.test(text) || isRegionLead(text)) return undefined;
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
