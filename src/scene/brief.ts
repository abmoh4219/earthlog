// The morning brief and the weekly recap (ADR-0025). Pure: built from the editions at build
// time. Every line shown is a story's title or its film's first caption (itself cited), so
// the brief says nothing the films don't.
import { type Edition, type EditionStory, LENS_INFO } from "./edition.ts";
import { type Region, regionOf } from "./regions.ts";

export interface BriefStory {
  date: string;
  slug: string;
  title: string;
  /** The film's first caption, else the story's summary. */
  line: string;
  kind: string;
  color: string;
  place?: string;
  region?: Region;
  why: string[];
  film: boolean;
  /** Days the story has run, when it is an update (2 = the day after it first appeared). */
  day?: number;
}

const fold = (t: string) =>
  t
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .toLowerCase()
    .trim();

/** The opening sentence, unless it only repeats the title (then there is nothing to add). */
const lineOf = (title: string, line: string) => (fold(line).startsWith(fold(title)) ? "" : line);

const toBrief = (date: string, s: EditionStory, films: Set<string>): BriefStory => {
  const region = regionOf(s.place?.country, s.continent);
  return {
    date,
    slug: s.slug,
    title: s.title,
    line: lineOf(s.title, s.headline ?? s.summary),
    kind: LENS_INFO[s.lens].label,
    color: LENS_INFO[s.lens].color,
    ...(s.place ? { place: s.place.name } : {}),
    ...(region ? { region } : {}),
    why: s.why ?? [],
    film: films.has(s.slug),
    ...(s.update ? { day: s.update.day } : {}),
  };
};

/** The day in brief: the five that matter most, then the rest by name. */
export function briefOf(edition: Edition, films: Set<string>, top = 5) {
  const all = edition.stories.map((s) => toBrief(edition.date, s, films));
  return { date: edition.date, top: all.slice(0, top), more: all.slice(top) };
}

export interface Week {
  from: string;
  to: string;
  days: { date: string; top: BriefStory[] }[];
  /** Stories that ran three days or more, longest-running first (their latest film). */
  running: BriefStory[];
  stories: number;
  regions: [Region, number][];
}

/** The week: each day's three biggest stories, what kept running, where it happened. */
export function weekOf(editions: { edition: Edition; films: Set<string> }[]): Week | undefined {
  const sorted = [...editions].sort((a, b) => b.edition.date.localeCompare(a.edition.date));
  const first = sorted.at(-1);
  const last = sorted[0];
  if (!first || !last) return undefined;
  const all = sorted.flatMap(({ edition, films }) =>
    edition.stories.map((s) => toBrief(edition.date, s, films)),
  );
  // The newest film of each running story: an update supersedes the days before it.
  const seen = new Set<string>();
  const running = all
    .filter((s) => (s.day ?? 1) >= 3)
    .sort((a, b) => (b.day ?? 0) - (a.day ?? 0) || b.date.localeCompare(a.date))
    .filter((s) => {
      const k = s.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
  const count = new Map<Region, number>();
  for (const s of all) if (s.region) count.set(s.region, (count.get(s.region) ?? 0) + 1);
  return {
    from: first.edition.date,
    to: last.edition.date,
    days: sorted.map(({ edition, films }) => ({
      date: edition.date,
      top: edition.stories.slice(0, 3).map((s) => toBrief(edition.date, s, films)),
    })),
    running,
    stories: all.length,
    regions: [...count.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** What listen mode says: the date, then each story's title and line, plainly. */
export function spokenBrief(dayLabel: string, stories: BriefStory[]): string[] {
  return [
    `Earthlog. The world on ${dayLabel}.`,
    ...stories.map((s, i) => `${i + 1}. ${s.title}.${s.line ? ` ${s.line}` : ""}`),
    "That was yesterday. Every film, and every source, is on Earthlog.",
  ];
}
