// "What happened": the news behind a trending article, without AI. When something happens,
// Wikipedia editors add it to the article within hours, usually as a dated sentence ("On 2
// November 2026, …"). We take, in order of preference:
//   1. sentences dated within ten days of the edition day (closest first);
//   2. sentences added since three days before (revision diff), lead section first.
// Each is quoted exactly and cited to the revision it was read from (CC BY-SA). Verified
// 2026-11-04: de Miguel ("On 2 November 2026, de Miguel suffered…"), Archive of Our Own ("On
// 29 October 2026, following a security incident…"), Jeffery Simmons (added: "In his Bears
// debut, … Chicago won 34–17."), Jailer 2 (added: "…the highest-grossing Tamil film of all time").
import { z } from "zod";
import { fetchJson } from "../bake/lib.ts";

const Revisions = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        missing: z.boolean().optional(),
        revisions: z
          .array(
            z.object({
              revid: z.number(),
              timestamp: z.string(),
              slots: z.object({ main: z.object({ content: z.string() }) }),
            }),
          )
          .optional(),
      }),
    ),
  }),
});

export interface Revision {
  title: string;
  revid: number;
  timestamp: string;
  wikitext: string;
}

/** The article's latest revision, or the last one before `before` (ISO). */
export async function fetchRevision(title: string, before?: string): Promise<Revision | undefined> {
  const at = before ? `&rvstart=${encodeURIComponent(before)}&rvdir=older` : "";
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&rvlimit=1&redirects=1&format=json&formatversion=2${at}&titles=${encodeURIComponent(title)}`;
  const page = Revisions.parse(await fetchJson(url)).query.pages[0];
  const rev = page?.revisions?.[0];
  if (!page || page.missing || !rev) return undefined;
  return {
    title: page.title,
    revid: rev.revid,
    timestamp: rev.timestamp,
    wikitext: rev.slots.main.content,
  };
}

/** Sections that never carry the news: plots, casts, lists and apparatus. */
const SKIP =
  /^(plot|synopsis|premise|cast|characters|episodes|track listing|discography|filmography|bibliography|references|notes|citations|sources|external links|further reading|see also|gallery|statistics|career statistics|honours|honors|awards and nominations)$/i;

export interface Sentence {
  /** Section heading ("" for the lead). */
  section: string;
  text: string;
  /** Position in the article, for stable ordering. */
  index: number;
}

/** Wikitext → prose sentences with their section; tables, lists, templates and refs dropped. */
export function sentences(wikitext: string): Sentence[] {
  let w = wikitext
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    // Spacing templates and entities stand between words; keep the space when removing them.
    .replace(/\{\{\s*(?:nbsp|snd|spaced (?:en|em) dash|ndash|mdash)\s*\}\}/gi, " ")
    .replace(/&nbsp;|&#160;/g, " ");
  for (let i = 0; i < 4; i++) w = w.replace(/\{\{[^{}]*\}\}/g, "");
  w = w
    .replace(/\{\|[\s\S]*?\|\}/g, "")
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+ ([^\]]+)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "");
  const out: Sentence[] = [];
  let section = "";
  let index = 0;
  for (const raw of w.split("\n")) {
    const line = raw.trim();
    const h = /^=+\s*(.*?)\s*=+$/.exec(line);
    if (h) {
      section = h[1] ?? "";
      continue;
    }
    if (!line || /^[|{}!*#:;[]/.test(line) || SKIP.test(section)) continue;
    for (const s of line.split(/(?<=[.!?])\s+(?=[A-Z"“(])/)) {
      const text = s
        .replace(/\(\s*[;,]?\s*\)/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:])/g, "$1")
        .trim();
      if (text.length >= 40 && text.length <= 320 && /[.!?]$/.test(text))
        out.push({ section, text, index: index++ });
    }
  }
  return out;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH = MONTHS.join("|");
const MONTH_YEAR_RE = new RegExp(`\\b(${MONTH}) (\\d{4})\\b`, "gi");
const DATE_RE = new RegExp(
  `\\b(?:(\\d{1,2}) (${MONTH})(?:,? (\\d{4}))?|(${MONTH}) (\\d{1,2})(?:,? (\\d{4}))?)\\b`,
  "gi",
);

/**
 * Days between the closest date in a sentence and `date` (YYYY-MM-DD), if any, and whether
 * that date states its year. A year-less date ("on 29 October") is assumed to be in the
 * edition's year, which is often wrong for production histories, so it ranks lower.
 */
export function dateDistance(text: string, date: string): number | undefined {
  return dateMatch(text, date)?.days;
}

export function dateMatch(
  text: string,
  date: string,
): { days: number; withYear: boolean; month?: boolean } | undefined {
  const day = Date.parse(`${date}T00:00:00Z`);
  const year = Number(date.slice(0, 4));
  let best: { days: number; withYear: boolean; month?: boolean } | undefined;
  for (const m of text.matchAll(DATE_RE)) {
    const d = Number(m[1] ?? m[5]);
    const month = MONTHS.indexOf((m[2] ?? m[4] ?? "").toLowerCase());
    const y = Number(m[3] ?? m[6] ?? year);
    if (month < 0 || !d) continue;
    const t = Date.UTC(y, month, d);
    const dist = (t - day) / 86_400_000;
    const withYear = Boolean(m[3] ?? m[6]);
    if (best === undefined || Math.abs(dist) < Math.abs(best.days)) best = { days: dist, withYear };
  }
  if (best) return best;
  // A month and year only ("In October 2026"): the distance to that month's middle, so this
  // month and last month count as recent (capped inside the window); exact dates rank first.
  for (const m of text.matchAll(MONTH_YEAR_RE)) {
    const month = MONTHS.indexOf((m[1] ?? "").toLowerCase());
    const y = Number(m[2]);
    if (month < 0 || !y) continue;
    const dist = (Date.UTC(y, month, 15) - day) / 86_400_000;
    if (dist >= -40 && dist <= 15 && (!best || Math.abs(dist) < Math.abs(best.days))) {
      best = { days: Math.sign(dist) * Math.min(Math.abs(dist), 9), withYear: true, month: true };
    }
  }
  return best;
}

/** A biography's opening line ("Name (21 September 1996 – 3 November 2026) was …") is context, not news. */
const LIFESPAN = /^\S[^.]*\([^)]*\d{4}\s*[–-]\s*[^)]*\d{4}\)/;

export interface NewsSentences {
  /** Up to `n` sentences that say what happened, best first. */
  news: Sentence[];
  /** The article's first sentence: who or what this is. */
  context?: Sentence;
  revision: Revision;
}

/**
 * Pick what happened. Dated sentences between 10 days before and 3 days after the edition
 * day win (closest first; dates after the day are announcements). Then sentences added
 * since three days before, lead first. Lifespan openers and duplicates are skipped.
 */
export function pickNews(
  current: Revision,
  previous: Revision | undefined,
  date: string,
  n = 3,
): NewsSentences {
  const all = sentences(current.wikitext);
  const first = all.find((s) => s.section === "");
  // A lead whose subject sat inside a template reads "(born July 28, 1997) is an …": put
  // the article's title back in front.
  const context =
    first && /^[(a-z]/.test(first.text)
      ? { ...first, text: `${current.title} ${first.text}` }
      : first;
  const old = new Set(previous ? sentences(previous.wikitext).map((s) => s.text) : []);
  const near = all
    .map((s) => ({ s, m: dateMatch(s.text, date) }))
    .filter(
      (x): x is { s: Sentence; m: { days: number; withYear: boolean; month?: boolean } } =>
        x.m !== undefined && x.m.days >= -10 && x.m.days <= 3,
    )
    .filter(({ s }) => !LIFESPAN.test(s.text))
    .sort((a, b) => Math.abs(a.m.days) - Math.abs(b.m.days) || a.s.index - b.s.index);
  const isNew = (s: Sentence) => previous !== undefined && !old.has(s.text);
  // A year-less date in a sentence editors just added is recent news ("traded … on October 29").
  // Exact dates first, then month-only ones ("In October 2026").
  const dated = [
    ...near.filter((x) => (x.m.withYear || isNew(x.s)) && !x.m.month),
    ...near.filter((x) => x.m.month),
  ].map((x) => x.s);
  const yearless = near.filter((x) => !x.m.withYear && !isNew(x.s)).map((x) => x.s);
  const added = previous
    ? all
        .filter((s) => !old.has(s.text) && !LIFESPAN.test(s.text) && s.text !== context?.text)
        // Newly added but explicitly dated long before: older material being tidied in.
        .filter((s) => {
          const m = dateMatch(s.text, date);
          return !m?.withYear || (m.days >= -10 && m.days <= 3);
        })
        .sort((a, b) => Number(b.section === "") - Number(a.section === "") || a.index - b.index)
    : [];
  // Explicit dates first, then what editors added (lead first), then year-less dates.
  // Added sentences are capped at two: a diff also catches older material being tidied in.
  const seen = new Set<string>(context ? [context.text, first?.text ?? ""] : []);
  const news: Sentence[] = [];
  let fromDiff = 0;
  for (const s of [...dated, ...added, ...yearless]) {
    if (seen.has(s.text)) continue;
    const isAdded = !dated.includes(s) && !yearless.includes(s);
    if (isAdded && fromDiff >= 2) continue;
    seen.add(s.text);
    news.push(s);
    if (isAdded) fromDiff++;
    if (news.length >= n) break;
  }
  return { news, ...(context ? { context } : {}), revision: current };
}

/**
 * Tell chosen sentences in time order ("traded on October 29" before "his debut"). Choose
 * first (closest to the day), then sort: an undated sentence counts as the edition day.
 */
export function chronological<T extends { text: string }>(chosen: T[], date: string): T[] {
  const when = (x: T) => dateMatch(x.text, date)?.days ?? 0;
  return [...chosen].sort((a, b) => when(a) - when(b));
}

/** True when the article's opening sentence is itself the dated event (an accident, a vote). */
export function contextIsTheEvent(found: NewsSentences, date: string): boolean {
  const m = found.context ? dateMatch(found.context.text, date) : undefined;
  return (
    m !== undefined && m.days >= -10 && m.days <= 3 && !LIFESPAN.test(found.context?.text ?? "")
  );
}

/** Fetch the article now and three days before the edition day, then pick the news. */
export async function fetchNews(title: string, date: string): Promise<NewsSentences | undefined> {
  const current = await fetchRevision(title);
  if (!current) return undefined;
  const before = new Date(Date.parse(`${date}T00:00:00Z`) - 3 * 86_400_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const previous = await fetchRevision(title, before);
  return pickNews(current, previous, date);
}
