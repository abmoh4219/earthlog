// One story told by several outlets: headlines grouped by what they say. Pure.
// Two headlines join when their IDF-weighted word overlap passes a threshold and they were
// published within a day and a half of each other; groups form by linking (union-find).
// Places named in a headline count as shared words too, so "Polish police" and "Krakow gunman"
// can meet. Thresholds were tuned on recorded feeds (test/cluster.test.ts).
import type { Headline } from "../../src/scene/headlines.ts";
import type { Placer } from "./place.ts";
import { idfOf, similarity, words } from "./text.ts";

export const LINK_THRESHOLD = 0.34;
const MAX_GAP_MS = 36 * 3_600_000;
/** A group bigger than this is re-split with a stricter threshold (chains of loose links). */
const MAX_GROUP = 30;

/**
 * A headline's tokens. A named place becomes one canonical token and its words are removed,
 * so "Yemen" counts once (not as "yemen", "@yemen" and "@ye"); a city also adds its country,
 * which is how "Krakow gunman" meets "Poland mourns".
 */
export function tokensOf(title: string, placer?: Placer): Set<string> {
  const set = new Set(words(title));
  for (const e of placer?.mentions(title) ?? []) {
    for (const w of words(e.name)) set.delete(w);
    if (e.kind === "country") set.add(`@${(e.country ?? e.name).toLowerCase()}`);
    else {
      set.add(`@${e.name.toLowerCase()}`);
      if (e.country) set.add(`@${e.country.toLowerCase()}`);
    }
  }
  return set;
}

const isPlace = (t: string) => t.startsWith("@");

function groups(
  items: Headline[],
  tokens: Set<string>[],
  idf: Map<string, number>,
  threshold: number,
): number[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] ?? r;
    return r;
  };
  // Only pairs that share at least one fairly rare token are compared (an inverted index).
  const index = new Map<string, number[]>();
  tokens.forEach((set, i) => {
    for (const t of set) if ((idf.get(t) ?? 0) > 1.2) index.set(t, [...(index.get(t) ?? []), i]);
  });
  const times = items.map((h) => Date.parse(h.t));
  const tried = new Set<number>();
  for (const list of index.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const i = list[x] ?? 0;
        const j = list[y] ?? 0;
        const key = i * 100_003 + j;
        if (tried.has(key)) continue;
        tried.add(key);
        if (Math.abs((times[i] ?? 0) - (times[j] ?? 0)) > MAX_GAP_MS) continue;
        const a = tokens[i];
        const b = tokens[j];
        if (!a || !b) continue;
        // At least two shared tokens, one of them a word: a place alone is not a story.
        let shared = 0;
        let sharedWords = 0;
        for (const t of a)
          if (b.has(t)) {
            shared++;
            if (!isPlace(t)) sharedWords++;
          }
        if (shared < 2 || sharedWords < 1) continue;
        if (similarity(a, b, idf) >= threshold) parent[find(i)] = find(j);
      }
    }
  }
  const byRoot = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    byRoot.set(r, [...(byRoot.get(r) ?? []), i]);
  });
  return [...byRoot.values()];
}

export interface HeadlineGroup {
  headlines: Headline[];
  /** The headline most like the others: the group's name. */
  title: string;
}

export function clusterHeadlines(items: Headline[], placer?: Placer): HeadlineGroup[] {
  const tokens = items.map((h) => tokensOf(h.title, placer));
  const idf = idfOf(tokens);
  const out: HeadlineGroup[] = [];
  const split = (idx: number[], threshold: number) => {
    const sub = groups(
      idx.map((i) => items[i] as Headline),
      idx.map((i) => tokens[i] as Set<string>),
      idf,
      threshold,
    ).map((g) => g.map((k) => idx[k] ?? 0));
    for (const g of sub) {
      if (g.length > MAX_GROUP && threshold < 0.8) split(g, threshold + 0.1);
      else out.push(group(g));
    }
  };
  const group = (idx: number[]): HeadlineGroup => {
    let best = idx[0] ?? 0;
    let bestScore = -1;
    for (const i of idx) {
      let s = 0;
      for (const j of idx)
        if (i !== j) s += similarity(tokens[i] as Set<string>, tokens[j] as Set<string>, idf);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    const headlines = idx.map((i) => items[i] as Headline).sort((a, b) => b.t.localeCompare(a.t));
    return { headlines, title: (items[best] as Headline).title };
  };
  split(
    items.map((_, i) => i),
    LINK_THRESHOLD,
  );
  return mergeByPlace(out, placer, idf);
}

/**
 * Second pass: groups that name the same city or region (not just a country), overlap in
 * time and share a telling word are one story told in different words ("Krakow gun attack",
 * "Poland mourns… Kraków shooting", "officers confronted Kraków gunman").
 */
function mergeByPlace(
  groups: HeadlineGroup[],
  placer: Placer | undefined,
  idf: Map<string, number>,
) {
  if (!placer) return groups;
  const info = groups.map((g) => {
    const placeTokens = new Set<string>();
    const wordTokens = new Set<string>();
    for (const h of g.headlines) {
      for (const e of placer.mentions(h.title)) if (e.kind !== "country") placeTokens.add(e.name);
      for (const t of tokensOf(h.title, placer)) if (!isPlace(t)) wordTokens.add(t);
    }
    const times = g.headlines.map((h) => Date.parse(h.t));
    return { placeTokens, wordTokens, first: Math.min(...times), last: Math.max(...times) };
  });
  const parent = groups.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] ?? r;
    return r;
  };
  for (let i = 0; i < groups.length; i++) {
    const a = info[i];
    if (!a?.placeTokens.size) continue;
    for (let j = i + 1; j < groups.length; j++) {
      const b = info[j];
      if (!b?.placeTokens.size) continue;
      if (a.first - b.last > MAX_GAP_MS || b.first - a.last > MAX_GAP_MS) continue;
      if (![...a.placeTokens].some((p) => b.placeTokens.has(p))) continue;
      // A telling word: rarer than most (IDF above 2), e.g. "gunman", "shooting", "eisenkot".
      if ([...a.wordTokens].some((w) => b.wordTokens.has(w) && (idf.get(w) ?? 0) > 2))
        parent[find(i)] = find(j);
    }
  }
  const merged = new Map<number, HeadlineGroup[]>();
  groups.forEach((g, i) => {
    merged.set(find(i), [...(merged.get(find(i)) ?? []), g]);
  });
  return [...merged.values()].map((gs) => {
    if (gs.length === 1) return gs[0] as HeadlineGroup;
    // Name the merged story after its largest part.
    const biggest = [...gs].sort(
      (x, y) => y.headlines.length - x.headlines.length,
    )[0] as HeadlineGroup;
    const headlines = gs.flatMap((g) => g.headlines).sort((x, y) => y.t.localeCompare(x.t));
    return { headlines, title: biggest.title };
  });
}
