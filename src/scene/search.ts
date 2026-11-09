// Search across Earthlog (ADR-0023): every edition story, the classics, and the stories of Now.
// Pure; the index is built at build time (src/app/search.json/route.ts) and Now's stories are
// added in the browser from the hourly file. No search service: it all runs in the page.

export interface SearchItem {
  kind: "now" | "story" | "classic";
  title: string;
  /** A line under the title: the summary, the place, the day. */
  detail: string;
  href: string;
  /** For ordering ties: newer first (ISO date or time). */
  date: string;
  /** Words to match besides the title: lens, topic, place, region, article. */
  keys: string;
  /** What it is about, for following (src/scene/follow.ts). */
  key?: string;
  /** Earlier films of the same story this one updates (an edition's "Update, day n"). */
  prev?: string[];
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (s: string) =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Items matching every word of the query (a word matches the start of a word, so "kra" finds
 * Kraków), best first: title matches over other matches, then newer first.
 */
export function search(items: SearchItem[], query: string, limit = 12): SearchItem[] {
  const q = tokens(query);
  if (!q.length) return [];
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const title = tokens(item.title);
    const rest = tokens(`${item.detail} ${item.keys}`);
    let score = 0;
    let all = true;
    for (const w of q) {
      if (title.some((t) => t === w)) score += 3;
      else if (title.some((t) => t.startsWith(w))) score += 2;
      else if (rest.some((t) => t.startsWith(w))) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ item, score: score + (item.kind === "now" ? 0.5 : 0) });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date))
    .slice(0, limit)
    .map((s) => s.item);
}
