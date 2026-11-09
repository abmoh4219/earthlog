// Reading outlets' official feeds: RSS 2.0, RSS 1.0 (RDF) and Atom. Only four fields are
// needed (title, link, time, section), so a small pure parser is enough and adds no dependency.
// Only the headline, link and time are kept (ADR-0017): descriptions are read for nothing.
import { createHash } from "node:crypto";
import type { Headline } from "../../src/scene/headlines.ts";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

/** The text inside an element: CDATA unwrapped, tags stripped, entities decoded, spaces collapsed. */
export function textOf(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return (
    decode(unwrapped.replace(/<[^>]+>/g, " "))
      // Feeds that escape their markup ("&lt;a href=…&gt;") only show tags once decoded.
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decode(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code =
          e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m?.[1] === undefined ? undefined : textOf(m[1]);
}

/** Tracking parameters feeds add to links; the same article must get the same id. */
const TRACKING = /^(utm_|at_|traffic_source$|maca$|ocid$|cmpid$|ns_|ito$|CMP$)/i;

export function canonicalUrl(url: string): string {
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  u.hash = "";
  u.protocol = "https:";
  return u.toString();
}

export function headlineId(url: string): string {
  return createHash("sha256").update(canonicalUrl(url)).digest("hex").slice(0, 12);
}

function isoTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z") : undefined;
}

/**
 * One feed's items as headlines. Items without a title, a valid link or a time are skipped
 * (a headline we can't date or link can't be cited).
 */
export function parseFeed(xml: string, outlet: string, seen: string): Headline[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const out: Headline[] = [];
  const ids = new Set<string>();
  for (const block of blocks) {
    const title = tag(block, "title");
    // Atom: <link href="…"/>; RSS: <link>…</link>; RDF items also carry rdf:about.
    const link =
      tag(block, "link") ||
      /<link[^>]*href="([^"]+)"/i.exec(block)?.[1] ||
      /rdf:about="([^"]+)"/i.exec(block)?.[1];
    const t = isoTime(
      tag(block, "pubDate") ??
        tag(block, "dc:date") ??
        tag(block, "published") ??
        tag(block, "updated"),
    );
    if (!title || !link || !t) continue;
    let url: string;
    try {
      url = canonicalUrl(textOf(link));
    } catch {
      continue;
    }
    const id = headlineId(url);
    if (ids.has(id)) continue;
    ids.add(id);
    const section = tag(block, "category") || tag(block, "dc:subject");
    out.push({
      id,
      outlet,
      title,
      url,
      // A feed can date an item in the future (time zones gone wrong): never later than seen.
      t: t > seen ? seen : t,
      seen,
      ...(section ? { section } : {}),
    });
  }
  return out;
}
