// Which outlets reported an edition story that day (ADR-0017). Pure.
// A headline matches a story when most of what the headline says is in the story's own text
// (its title, the news items, the article) and they share at least two telling words. The
// test is asymmetric on purpose: a headline is short, a story's text is long.
// Only headlines published on the edition's day count: evidence must fall in its window.
import type { Headline } from "../../src/scene/headlines.ts";
import { tokensOf } from "../news/cluster.ts";
import type { Placer } from "../news/place.ts";
import { idfOf } from "../news/text.ts";

export const MATCH_SHARE = 0.55;

export interface Coverage {
  /** One headline per outlet (its first that day), oldest first. */
  match: (texts: string[]) => Headline[];
  /** Every matching headline of the day, follow-ups included (for the story's signals). */
  matchAll: (texts: string[]) => Headline[];
}

export function makeCoverage(headlines: Headline[], date: string, placer?: Placer): Coverage {
  const day = headlines.filter((h) => h.t.startsWith(date));
  const tokens = day.map((h) => tokensOf(h.title, placer));
  const idf = idfOf(tokens);
  const weight = (t: string) => idf.get(t) ?? 1;
  const matchAll = (texts: string[]): Headline[] => {
    const story = new Set(texts.flatMap((t) => [...tokensOf(t, placer)]));
    const hits: Headline[] = [];
    day.forEach((h, i) => {
      const own = tokens[i];
      if (!own?.size) return;
      let shared = 0;
      let total = 0;
      let telling = 0;
      for (const t of own) {
        total += weight(t);
        if (story.has(t)) {
          shared += weight(t);
          if (!t.startsWith("@") && weight(t) > 2) telling++;
        }
      }
      if (telling >= 2 && shared / total >= MATCH_SHARE) hits.push(h);
    });
    return hits.sort((a, b) => a.t.localeCompare(b.t));
  };
  return {
    matchAll,
    match(texts) {
      const first = new Map<string, Headline>();
      for (const h of matchAll(texts)) if (!first.has(h.outlet)) first.set(h.outlet, h);
      return [...first.values()];
    },
  };
}
