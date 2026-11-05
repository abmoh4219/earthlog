// "How it unfolded": a story's thread through the previous days of
// Wikipedia's Current events. An earlier item belongs to the thread when it sits under the
// same running topic ("2026 Strait of Hormuz crisis"), links that topic, or links the story's
// own article. Nothing fuzzier: a thread is only drawn when the portal itself ties the items.
import type { Country, Evidence, Source } from "../../src/scene/schema.ts";
import {
  fetchCoordinates,
  fetchPortal,
  locate,
  parsePortal,
  portalTitle,
  type RawStory,
} from "../bake/wikinews.ts";

export interface Anchor {
  /** The running topic heading of the story's own Current events item. */
  topic?: string;
  /** The story's Wikipedia article. */
  title?: string;
}

export function inThread(anchor: Anchor, item: RawStory): boolean {
  const keys = [anchor.topic, anchor.title].filter((k): k is string => !!k);
  return keys.some((k) => item.topic === k || item.links.includes(k));
}

export interface ThreadItem {
  date: string;
  id: string;
  text: string;
  place?: { name: string; lon: number; lat: number };
}

const DAY = 86_400_000;

/** Today's reports in red, a week ago in amber: the colour of a place says how recent it is. */
export function recencyColor(daysAgo: number): string {
  const u = Math.max(0, Math.min(1, daysAgo / 7));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * u);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(mix(0xff, 0xff))}${hex(mix(0x4d, 0xc8))}${hex(mix(0x5e, 0x6a))}`;
}

/** The first sentence of an item, at most `limit` characters (or undefined). */
export function firstSentence(text: string, limit = 200): string | undefined {
  const s = /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
  return s.length <= limit ? s : undefined;
}

/**
 * The thread over the `days` before `date`: oldest first, at most `max` items (the latest
 * ones), each with an evidence item and, where the portal names one, a place.
 */
export async function fetchThread(
  date: string,
  anchor: Anchor,
  countries: Country[],
  at: string,
  days = 7,
  max = 5,
): Promise<{ items: ThreadItem[]; evidence: Evidence[]; sources: Source[] }> {
  if (!anchor.topic && !anchor.title) return { items: [], evidence: [], sources: [] };
  const day = Date.parse(`${date}T00:00:00Z`);
  const found: { date: string; n: number; raw: RawStory; revid: number }[] = [];
  for (let k = days; k >= 1; k--) {
    const d = new Date(day - k * DAY).toISOString().slice(0, 10);
    try {
      const page = await fetchPortal(d);
      parsePortal(page.wikitext).forEach((raw, i) => {
        if (inThread(anchor, raw)) found.push({ date: d, n: i + 1, raw, revid: page.revid });
      });
    } catch {
      // A missing day page is a gap in the thread, not an error.
    }
  }
  // One item a day (the first under the topic), the latest `max` days.
  const perDay = found
    .filter((f, i) => found.findIndex((g) => g.date === f.date) === i)
    .slice(-max);
  const coords = await fetchCoordinates(perDay.flatMap((f) => f.raw.links));
  const evidence: Evidence[] = [];
  const sources = new Map<string, Source>();
  const items = perDay.flatMap((f) => {
    const text = firstSentence(f.raw.text);
    if (!text) return [];
    const url = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(portalTitle(f.date))}&oldid=${f.revid}`;
    const sourceId = `wikipedia-ce-${f.date}`;
    sources.set(sourceId, {
      id: sourceId,
      name: `Wikipedia, ${portalTitle(f.date).replace(/_/g, " ")}`,
      url,
      license:
        "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Story text adapted; adaptations shared under the same licence.",
      attribution: "Wikipedia contributors, Current events",
      retrievedAt: at,
    });
    const id = `wiki:${f.date}:${f.n}`;
    evidence.push({
      id,
      kind: "report",
      source: sourceId,
      // Story-time films start on the edition day: earlier days are cited at its start,
      // with their own date in the label and the link.
      t: `${date}T00:00:00Z`,
      precision: "day",
      label: `Wikipedia, Current events, ${f.date}: ${f.raw.text}`,
      quote: text,
      url,
    });
    const place = locate(f.raw, coords, countries);
    return [
      {
        date: f.date,
        id,
        text,
        ...(place ? { place: { name: place.name, lon: place.lon, lat: place.lat } } : {}),
      },
    ];
  });
  return { items, evidence, sources: [...sources.values()] };
}
