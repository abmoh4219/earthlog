// Following a story (ADR-0024). Pure; the page keeps the list in the reader's browser.
// A story is followed by its subject: the Wikipedia article it is about when it has one (so a
// later edition or a Now story about the same article is an update), else its own page.
import type { SearchItem } from "./search.ts";

export interface FollowTarget {
  key: string;
  title: string;
  href: string;
}

export interface Follow extends FollowTarget {
  /** When the reader started following (UTC ISO): updates are what came after. */
  at: string;
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The key of a story: its article ("a:2026 kraków shooting"), else its page. */
export function followKey(articleTitle: string | undefined, href: string): string {
  return articleTitle ? `a:${fold(articleTitle)}` : `p:${href}`;
}

/** When an item happened, comparable with a follow's time: an edition covers its whole day. */
const itemTime = (date: string) => (date.length === 10 ? `${date}T23:59:59Z` : date);

/** Newer stories about what the reader follows, newest first, per follow. */
export function updatesFor(follows: Follow[], items: SearchItem[]): Map<string, SearchItem[]> {
  const out = new Map<string, SearchItem[]>();
  for (const f of follows) {
    // The same subject (its article), or an edition's update that links back to it.
    const found = items
      .filter(
        (i) =>
          i.href !== f.href &&
          ((!f.key.startsWith("p:") && i.key === f.key && itemTime(i.date) > f.at) ||
            i.prev?.includes(f.href)),
      )
      .sort((a, b) => itemTime(b.date).localeCompare(itemTime(a.date)));
    if (found.length) out.set(f.key, found);
  }
  return out;
}
