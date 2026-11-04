// Wikipedia "Current events" portal → news stories + report evidence.
// Verified 2026-11-04:
//   GET https://en.wikipedia.org/w/api.php?action=parse&page=Portal:Current_events/2026_November_3
//       &prop=wikitext|revid&format=json&formatversion=2
// The wikitext has '''Category''' headings, then bullet lists: "*" topic lines and deeper
// item lines; each item ends with its sources as [https://… (Outlet)] links.
// Licence: CC BY-SA 4.0. We bundle the item text with attribution and the revision link;
// text derived from it (our captions) is shared under the same licence (DATA-SOURCES.md).
// Geocoding: prop=coordinates&coprop=type|dim|country on the linked pages. Each result says
// what kind of place it is (adm1st, city, landmark, country…), so we can pick the most
// specific one. Companies and people have no coordinates and are skipped naturally.
// Quirk: prop=coordinates returns at most 10 results per request unless colimit=max.
import { z } from "zod";
import { categoryFromHeading } from "../../src/scene/news.ts";
import type { Country, Evidence, NewsStory, Source } from "../../src/scene/schema.ts";
import { fetchJson } from "./lib.ts";

const API = "https://en.wikipedia.org/w/api.php";

export interface RawStory {
  heading: string;
  topic?: string;
  /** Plain text, wiki markup removed, sources stripped. */
  text: string;
  /** Linked page titles, in reading order. */
  links: string[];
  sources: { name: string; url: string }[];
}

export function portalTitle(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const month = d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return `Portal:Current_events/${d.getUTCFullYear()}_${month}_${d.getUTCDate()}`;
}

const ParseResponse = z.object({
  parse: z.object({ revid: z.number(), wikitext: z.string() }),
});

export async function fetchPortal(date: string) {
  const url = `${API}?action=parse&page=${encodeURIComponent(portalTitle(date))}&prop=wikitext%7Crevid&format=json&formatversion=2`;
  return ParseResponse.parse(await fetchJson(url)).parse;
}

/** "[[A|B]]" → B, "[[A]]" → A, drop bold/italic quotes and templates. */
function plain(wikitext: string): { text: string; links: string[] } {
  const links: string[] = [];
  let text = wikitext.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target: string, label?: string) => {
      links.push(target.split("#")[0]?.trim() ?? target);
      return label ?? target;
    },
  );
  text = text
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { text, links: links.filter((l) => l.length > 0) };
}

const SOURCE = /\[(https?:\/\/[^\s\]]+)\s+\(([^)]+)\)\]/g;

export function parsePortal(wikitext: string): RawStory[] {
  const body = wikitext.replace(/<!--[\s\S]*?-->/g, "");
  const stories: RawStory[] = [];
  let heading = "";
  const topics: string[] = [];
  for (const line of body.split("\n")) {
    const h = /^'''(.+?)'''\s*$/.exec(line.trim());
    if (h?.[1]) {
      heading = h[1];
      topics.length = 0;
      continue;
    }
    const bullet = /^(\*+)\s*(.*)$/.exec(line);
    if (!bullet?.[1] || bullet[2] === undefined || !heading) continue;
    const depth = bullet[1].length;
    const content = bullet[2];
    const sources = [...content.matchAll(SOURCE)].flatMap((m) =>
      m[1] && m[2] ? [{ url: m[1], name: m[2].replace(/'{2,}/g, "").trim() }] : [],
    );
    if (sources.length === 0) {
      // A topic line, e.g. "*[[2026 United States elections]]": context for deeper items.
      topics.length = depth - 1;
      topics[depth - 1] = plain(content).text;
      continue;
    }
    const { text, links } = plain(content.replace(SOURCE, ""));
    const topic = topics
      .slice(0, depth - 1)
      .filter(Boolean)
      .at(-1);
    stories.push({ heading, ...(topic ? { topic } : {}), text, links, sources });
  }
  return stories;
}

const Coord = z.object({
  lat: z.number(),
  lon: z.number(),
  type: z.string().optional(),
  dim: z.union([z.string(), z.number()]).optional(),
});

const CoordResponse = z.object({
  query: z.object({
    redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    pages: z.array(
      z.object({
        title: z.string(),
        coordinates: z.array(Coord).optional(),
        missing: z.boolean().optional(),
      }),
    ),
  }),
});

export interface Located {
  lon: number;
  lat: number;
  type: string;
  dimMetres: number;
}

/** Coordinates for linked titles, keyed by the title as written in the wikitext. */
export function parseCoordinates(json: unknown): Map<string, Located> {
  const q = CoordResponse.parse(json).query;
  const alias = new Map<string, string>();
  for (const n of q.normalized ?? []) alias.set(n.from, n.to);
  for (const r of q.redirects ?? []) alias.set(r.from, r.to);
  const byTitle = new Map<string, Located>();
  for (const p of q.pages) {
    const c = p.coordinates?.[0];
    if (!c) continue;
    byTitle.set(p.title, {
      lon: c.lon,
      lat: c.lat,
      type: c.type ?? "",
      dimMetres: Number(c.dim ?? 10_000) || 10_000,
    });
  }
  const resolve = (t: string): string => {
    const next = alias.get(t);
    return next && next !== t ? resolve(next) : t;
  };
  const out = new Map<string, Located>();
  for (const t of [...alias.keys(), ...byTitle.keys()]) {
    const hit = byTitle.get(resolve(t));
    if (hit) out.set(t, hit);
  }
  return out;
}

export async function fetchCoordinates(titles: string[]): Promise<Map<string, Located>> {
  const out = new Map<string, Located>();
  const unique = [...new Set(titles)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50).join("|");
    const url = `${API}?action=query&prop=coordinates&colimit=max&coprop=type%7Cdim%7Ccountry&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(batch)}`;
    for (const [k, v] of parseCoordinates(await fetchJson(url))) out.set(k, v);
  }
  return out;
}

/**
 * The most specific place a story names: the first linked page with coordinates that
 * isn't a whole country or a huge area; else the first country it links (Natural Earth
 * label point, because some country pages carry no coordinates).
 */
export function locate(
  story: RawStory,
  coords: Map<string, Located>,
  countries: Country[],
): NewsStory["place"] {
  const country = (title: string) =>
    countries.find((c) => c.name === title || c.aliases.includes(title));
  for (const title of story.links) {
    const c = coords.get(title);
    if (!c || c.type === "country" || country(title)) continue;
    if (c.dimMetres > 1_500_000) continue; // continents, oceans: not a place on the map
    return { name: title.replace(/\s*\([^)]*\)$/, ""), lon: c.lon, lat: c.lat, country: false };
  }
  for (const title of story.links) {
    const nation = country(title);
    if (nation) {
      // Keep the story's own wording ("United States", not "United States of America").
      return { name: title, lon: nation.label[0], lat: nation.label[1], country: true };
    }
  }
  return undefined;
}

export function wikinewsSource(date: string, revid: number, retrievedAt: string): Source {
  const title = portalTitle(date);
  return {
    id: "wikipedia",
    name: `Wikipedia, ${title.replace(/_/g, " ")}`,
    url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&oldid=${revid}`,
    license:
      "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Story text adapted; adaptations shared under the same licence.",
    attribution: "Wikipedia contributors, Current events",
    retrievedAt,
  };
}

/** Stories + one report evidence item per story (date precision: no time of day). */
export function toStories(
  date: string,
  raw: RawStory[],
  coords: Map<string, Located>,
  countries: Country[],
  revid: number,
): { stories: NewsStory[]; evidence: Evidence[] } {
  const stories: NewsStory[] = [];
  const evidence: Evidence[] = [];
  const t = `${date}T00:00:00Z`;
  const pageUrl = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(portalTitle(date))}&oldid=${revid}`;
  const located = raw.map((r) => locate(r, coords, countries));
  raw.forEach((r, i) => {
    const id = `wiki:${date}:${i + 1}`;
    const category = categoryFromHeading(r.heading);
    // A story that names no place inherits one from a sibling in the same running topic
    // (e.g. a result projection under "2026 United States elections").
    const place =
      located[i] ??
      located.find((p, j) => p !== undefined && r.topic !== undefined && raw[j]?.topic === r.topic);
    stories.push({
      id,
      category: category.key,
      ...(r.topic ? { topic: r.topic } : {}),
      text: r.text,
      ...(place ? { place } : {}),
      evidence: id,
    });
    evidence.push({
      id,
      kind: "report",
      source: "wikipedia",
      t,
      precision: "day",
      ...(place ? { lon: place.lon, lat: place.lat } : {}),
      label: `${category.label}: ${r.text}`,
      quote: r.text,
      url: pageUrl,
      links: r.sources,
    });
  });
  return { stories, evidence };
}
