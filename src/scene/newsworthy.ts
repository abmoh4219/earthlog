// What makes a story hot, for editions and for Now (ADR-0021). Pure; shared by the scripts
// and the site, so explicit .ts imports and no @/ alias.
//
// Hot is what newsrooms agree is news, not what people read. Each signal is a measurable
// stand-in for a news value journalism research names (Harcup & O'Neill, "What is news?",
// Journalism Studies 18(12), 2017; Galtung & Ruge, 1965), or for how aggregators rank a story
// cluster by "aggregate editorial interest" (Google News engineers, Nieman Lab, 2009):
//   - agreement: how many outlets told it (editorial interest across newsrooms);
//   - reach: outlets from how many regions (relevance beyond one country's press);
//   - speed: several outlets within hours of the first report (breaking);
//   - persistence: follow-ups, and coverage that lasted through the day ("follow-up",
//     and "media storms": Jurgens & Card, arXiv 2312.02118);
//   - magnitude: how many people the headlines say are involved ("magnitude", "bad news");
//   - notability: Wikipedia's editors listed it on Current events (an independent desk), or
//     wrote an article about the event itself;
//   - readers: a small bonus when Wikipedia's most-read list is in, never required.
import type { Headline } from "./headlines.ts";
import { outletById } from "./outlets.ts";

const HOUR = 3_600_000;

export interface Signals {
  /** Distinct outlets that reported it. */
  outlets: number;
  /** Distinct home regions of those outlets (src/scene/outlets.ts). */
  regions: number;
  /** All headlines, follow-ups included. */
  headlines: number;
  /** Hours from the first headline to the last. */
  hours: number;
  /** Outlets that reported it within three hours of the first report. */
  early: number;
  /** The largest number of people a headline says are involved (0 when none says). */
  people: number;
  /** That number counts the dead, injured, missing or displaced ("bad news"). */
  harm: boolean;
  /** The number as the headline wrote it ("hundreds of thousands", "114"). */
  peopleAs?: string;
  /** Listed on Wikipedia's Current events that day. */
  noted?: boolean;
  /** Sources cited by those Current events items. */
  notedSources?: number;
  /** It has its own Wikipedia article as an event (a crash, an election) that spiked that day. */
  eventArticle?: boolean;
  /** English Wikipedia readers that day, when the most-read list is published. */
  readers?: number;
  /** Readers ÷ the article's usual level. */
  spike?: number;
  /** The story's subject died in the past week. */
  died?: boolean;
}

/** The headline signals of a set of headlines (one story's, usually of one day). */
export function headlineSignals(headlines: Headline[]): Signals {
  const times = headlines.map((h) => Date.parse(h.t));
  const first = times.length ? Math.min(...times) : 0;
  const last = times.length ? Math.max(...times) : 0;
  const outlets = new Set(headlines.map((h) => h.outlet));
  const regions = new Set([...outlets].map((o) => outletById(o)?.region ?? o));
  const early = new Set(
    headlines.filter((h) => Date.parse(h.t) - first <= 3 * HOUR).map((h) => h.outlet),
  );
  return {
    outlets: outlets.size,
    regions: regions.size,
    headlines: headlines.length,
    hours: (last - first) / HOUR,
    early: early.size,
    ...largest(headlines.map((h) => peopleIn(h.title))),
  };
}

function largest(counts: PeopleCount[]): { people: number; harm: boolean; peopleAs?: string } {
  const top = counts.reduce((a, b) => (b.count > a.count ? b : a), { count: 0, harm: false });
  return { people: top.count, harm: top.harm, ...(top.as ? { peopleAs: top.as } : {}) };
}

/** How newsworthy a story is: unnormalised, compare within one edition or one run only. */
export function newsworthiness(s: Signals): number {
  const followUps = Math.max(0, s.headlines - s.outlets);
  const readers =
    s.readers && s.readers > 1000
      ? Math.min(3, Math.log10(s.readers) - 3) * ((s.spike ?? 1) >= 2.5 ? 1 : 0.5)
      : 0;
  return (
    3 * Math.log2(1 + s.outlets) +
    1.5 * Math.max(0, s.regions - 1) +
    0.8 * Math.log2(1 + followUps) +
    Math.min(1.5, s.hours / 8) +
    (s.early >= 3 ? 2 : 0) +
    // Deaths and injuries weigh more than a crowd: "7 dead" against "a billion celebrate".
    Math.min(4, Math.log10(1 + s.people)) * (s.harm ? 1.2 : 0.7) +
    (s.noted ? 3 + 0.3 * Math.min(10, s.notedSources ?? 0) : 0) +
    (s.eventArticle ? 3 : 0) +
    readers +
    (s.died ? 2 : 0)
  );
}

const fmt = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`
    : n >= 1e4
      ? `${Math.round(n / 1000)},000`
      : n.toLocaleString("en-GB");

/** Why a story counts as news, in plain words, strongest first (shown to readers). */
export function reasonsOf(s: Signals): string[] {
  const out: string[] = [];
  if (s.outlets >= 2)
    out.push(
      `Reported by ${s.outlets} outlets${s.regions >= 2 ? ` from ${s.regions} regions` : ""}`,
    );
  else if (s.outlets === 1) out.push("Reported by 1 outlet");
  if (s.early >= 3) out.push(`${s.early} outlets within 3 hours`);
  if (s.noted) out.push("Listed on Wikipedia's Current events");
  if (s.eventArticle) out.push("Has its own Wikipedia article as an event");
  // Quoted as the headline wrote it: "hundreds of thousands" is not a count of 200,000.
  if (s.people >= 5)
    out.push(
      /^\d/.test(s.peopleAs ?? "1")
        ? `${fmt(s.people)} people involved, per the headlines`
        : `People involved, per the headlines: ${s.peopleAs}`,
    );
  if (s.headlines - s.outlets >= 3 && s.hours >= 6)
    out.push(`${s.headlines} headlines over ${Math.round(s.hours)} hours`);
  if (s.died) out.push("Died this week");
  if (s.readers && s.readers >= 50_000) out.push(`Read by ${fmt(s.readers)} on Wikipedia that day`);
  return out;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
  dozen: 12,
  tens: 10,
  dozens: 24,
  scores: 40,
  hundreds: 200,
  thousands: 2000,
  millions: 2_000_000,
};
const SCALE: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1_000_000,
  billion: 1_000_000_000,
};
// Words that make a number a count of people (or of their homes): "191 people", "7 dead",
// "hundreds of thousands without power", "tens of thousands march".
const PEOPLE =
  /^(people|persons|dead|deaths?|killed|died|injured|wounded|hurt|missing|victims|casualties|civilians|children|migrants|refugees|passengers|residents|households|homes|families|workers|employees|jobs|soldiers|troops|fighters|patients|students|protesters|voters|hostages|prisoners|detainees|fans|lives|others|displaced|evacuated|stranded|affected|homeless|without|march|marched|rally|protest|flee|fled)$/;

const HARM =
  /^(dead|deaths?|killed|died|injured|wounded|hurt|missing|victims|casualties|displaced|homeless|kill(s|ed)?|toll|murder(ed|ing)?)$/;

export interface PeopleCount {
  count: number;
  harm: boolean;
  /** As written ("hundreds of thousands", "1.2 million", "114"). */
  as?: string;
}

/**
 * The largest number of people a headline names: "Seven dead and 114 injured" → 114,
 * "leave hundreds of thousands without power" → 200,000. Years, money and scores don't count:
 * the number must be followed (within three words) by people, or follow "kills"/"toll".
 */
export function peopleIn(title: string): PeopleCount {
  const tokens = title
    .toLowerCase()
    .replace(/(\d),(\d{3})/g, "$1$2")
    .split(/[^a-z0-9.%$£€-]+/)
    .filter(Boolean);
  let best: PeopleCount = { count: 0, harm: false };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] ?? "";
    let n = /^\d+(\.\d+)?$/.test(t) ? Number(t) : (NUMBER_WORDS[t] ?? 0);
    if (!n) continue;
    let j = i + 1;
    // "1.2 million", "hundreds of thousands", "tens of thousands"
    while (j < tokens.length) {
      const w = tokens[j] ?? "";
      const scale = SCALE[w] ?? SCALE[w.replace(/s$/, "")];
      if (scale) {
        n = Math.min(1e10, n * scale);
        j++;
      } else if (w === "of" && SCALE[(tokens[j + 1] ?? "").replace(/s$/, "")]) {
        j++;
      } else break;
    }
    // A year ("2026 elections") is a date, not a count.
    if (/^(19|20)\d{2}$/.test(t) && j === i + 1) continue;
    const next = tokens.slice(j, j + 3);
    const prev = tokens.slice(Math.max(0, i - 3), i);
    const counted =
      next.some((w) => PEOPLE.test(w)) || prev.some((w) => /^(kill(s|ed)?|toll)$/.test(w));
    if (counted && n > best.count)
      best = {
        count: n,
        harm: [...prev, ...next].some((w) => HARM.test(w)),
        as: tokens.slice(i, j).join(" "),
      };
  }
  return best;
}
