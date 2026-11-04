// Network access for the edition builder: the most-read feed, Wikidata entities and the
// link graph between candidate articles. Parsing is separate from fetching so tests can use
// recorded responses. All verified 2026-11-04.
import { z } from "zod";
import { fetchJson } from "../bake/lib.ts";

// ── Most read ────────────────────────────────────────────────────────────────
// GET https://api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD
// The feed for day D+1 carries `mostread` for day D: articles with views, rank,
// view_history (the previous ~5 days), wikibase_item and a short description.

const MostReadArticle = z.object({
  views: z.number(),
  title: z.string(),
  namespace: z.object({ id: z.number() }).optional(),
  wikibase_item: z.string().optional(),
  description: z.string().optional(),
  extract: z.string().optional(),
  view_history: z.array(z.object({ date: z.string(), views: z.number() })).optional(),
  titles: z.object({ normalized: z.string() }),
  content_urls: z.object({ desktop: z.object({ page: z.url() }) }),
});

const Feed = z.object({
  mostread: z.object({ date: z.string(), articles: z.array(MostReadArticle) }).optional(),
});

export interface MostRead {
  title: string;
  url: string;
  qid?: string;
  description?: string;
  /** The article's opening sentence(s), plain text (CC BY-SA). */
  extract?: string;
  views: number;
  /**
   * The article's normal level: median daily readers from 60 to 8 days before `date`
   * (skipping the last week, so a story that has trended for days still counts as hot).
   * 0 for an article that didn't exist then. Filled in by fetchNormal().
   */
  priorMedian?: number;
}

export function feedUrl(date: string): string {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000);
  const [y, m, d] = next.toISOString().slice(0, 10).split("-");
  return `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`;
}

export function parseMostRead(json: unknown, date: string): MostRead[] {
  const mr = Feed.parse(json).mostread;
  if (!mr?.date.startsWith(date)) {
    throw new Error(`most-read list is for ${mr?.date ?? "nothing"}, expected ${date}`);
  }
  return mr.articles
    .filter((a) => (a.namespace?.id ?? 0) === 0)
    .map((a) => {
      return {
        title: a.titles.normalized,
        url: a.content_urls.desktop.page,
        ...(a.wikibase_item ? { qid: a.wikibase_item } : {}),
        ...(a.description ? { description: a.description } : {}),
        ...(a.extract ? { extract: a.extract } : {}),
        views: a.views,
      };
    });
}

export async function fetchMostRead(date: string): Promise<MostRead[]> {
  // The feed sometimes comes back without `mostread`; don't cache that, retry.
  const hasList = (json: unknown) => Feed.safeParse(json).data?.mostread !== undefined;
  return parseMostRead(await fetchJson(feedUrl(date), hasList), date);
}

// ── Wikidata entities ──────────────────────────────────────────────────────────
// GET https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1|Q2&props=claims|labels
// &languages=en&format=json (at most 50 ids per request). CC0.

const Snak = z.object({
  datavalue: z.object({ value: z.unknown() }).optional(),
});
const Claim = z.object({ mainsnak: Snak });
const Entity = z.object({
  id: z.string(),
  labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
  claims: z.record(z.string(), z.array(Claim)).optional(),
  missing: z.string().optional(),
});
const Entities = z.object({ entities: z.record(z.string(), Entity) });

export interface WdEntity {
  id: string;
  label?: string;
  /** Item values per property, e.g. P31 → ["Q5"]. */
  items: Record<string, string[]>;
  coord?: { lat: number; lon: number };
  /** P297 ISO alpha-2, for country items. */
  iso2?: string;
  /** P570 date of death (YYYY-MM-DD), for people. */
  died?: string;
  /** Dates per property (YYYY-MM-DD, or YYYY when only the year is known), e.g. P569 → birth. */
  times?: Record<string, string[]>;
  /** Numbers per property, e.g. P1128 → employees. */
  quantities?: Record<string, number[]>;
}

const ItemValue = z.object({ id: z.string() });
const CoordValue = z.object({ latitude: z.number(), longitude: z.number() });
const TimeValue = z.object({ time: z.string(), precision: z.number().optional() });
const QuantityValue = z.object({ amount: z.string() });

/** Wikidata time → "YYYY-MM-DD", or "YYYY" at year precision (9) and coarser. */
function wdDate(time: string, precision?: number): string {
  const d = time.replace(/^\+/, "");
  return precision !== undefined && precision <= 9 ? d.slice(0, 4) : d.slice(0, 10);
}

export function parseEntities(json: unknown): Map<string, WdEntity> {
  const out = new Map<string, WdEntity>();
  for (const e of Object.values(Entities.parse(json).entities)) {
    if (e.missing !== undefined) continue;
    const items: Record<string, string[]> = {};
    let coord: WdEntity["coord"];
    let iso2: string | undefined;
    let died: string | undefined;
    const times: Record<string, string[]> = {};
    const quantities: Record<string, number[]> = {};
    for (const [prop, claims] of Object.entries(e.claims ?? {})) {
      for (const c of claims) {
        const v = c.mainsnak.datavalue?.value;
        const item = ItemValue.safeParse(v);
        if (item.success) items[prop] = [...(items[prop] ?? []), item.data.id];
        if (prop === "P625" && !coord) {
          const cv = CoordValue.safeParse(v);
          if (cv.success) coord = { lat: cv.data.latitude, lon: cv.data.longitude };
        }
        if (prop === "P297" && typeof v === "string") iso2 = v;
        const tv = TimeValue.safeParse(v);
        if (tv.success) {
          times[prop] = [...(times[prop] ?? []), wdDate(tv.data.time, tv.data.precision)];
          if (prop === "P570" && !died) died = tv.data.time.replace(/^\+/, "").slice(0, 10);
        }
        const qv = QuantityValue.safeParse(v);
        if (qv.success && Number.isFinite(Number(qv.data.amount))) {
          quantities[prop] = [...(quantities[prop] ?? []), Number(qv.data.amount)];
        }
      }
    }
    const label = e.labels?.en?.value;
    out.set(e.id, {
      id: e.id,
      ...(label ? { label } : {}),
      items,
      ...(coord ? { coord } : {}),
      ...(iso2 ? { iso2 } : {}),
      ...(died ? { died } : {}),
      ...(Object.keys(times).length ? { times } : {}),
      ...(Object.keys(quantities).length ? { quantities } : {}),
    });
  }
  return out;
}

export async function fetchEntities(ids: string[]): Promise<Map<string, WdEntity>> {
  const out = new Map<string, WdEntity>();
  const unique = [...new Set(ids)].filter((id) => /^Q\d+$/.test(id)).sort();
  for (let i = 0; i < unique.length; i += 50) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims%7Clabels&languages=en&format=json&ids=${unique.slice(i, i + 50).join("%7C")}`;
    for (const [k, v] of parseEntities(await fetchJson(url))) out.set(k, v);
  }
  return out;
}

// ── Wikipedia: page → Wikidata id, and links between candidates ──────────────────

const PagesResponse = z.object({
  query: z
    .object({
      normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      pages: z.array(
        z.object({
          title: z.string(),
          pageprops: z.object({ wikibase_item: z.string().optional() }).optional(),
          links: z.array(z.object({ title: z.string() })).optional(),
        }),
      ),
    })
    .optional(),
});

/** Wikidata ids for page titles, keyed by the title as asked (redirects resolved). */
export async function fetchQids(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(titles)].sort();
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(batch.join("|"))}`;
    const q = PagesResponse.parse(await fetchJson(url)).query;
    const alias = new Map<string, string>();
    for (const n of [...(q?.normalized ?? []), ...(q?.redirects ?? [])]) alias.set(n.from, n.to);
    const byTitle = new Map(
      (q?.pages ?? []).flatMap((p) =>
        p.pageprops?.wikibase_item ? [[p.title, p.pageprops.wikibase_item] as const] : [],
      ),
    );
    for (const t of batch) {
      let r = t;
      for (let k = 0; k < 3 && alias.has(r); k++) r = alias.get(r) ?? r;
      const qid = byTitle.get(r);
      if (qid) out.set(t, qid);
    }
  }
  return out;
}

/**
 * Which candidate articles link to which: prop=links with pltitles limits results to links
 * *between candidates*, so one or two requests cover the whole day.
 */
export async function fetchLinkGraph(titles: string[]): Promise<Map<string, Set<string>>> {
  const graph = new Map<string, Set<string>>();
  const unique = [...new Set(titles)].sort();
  for (let i = 0; i < unique.length; i += 50) {
    const pages = unique.slice(i, i + 50);
    for (let j = 0; j < unique.length; j += 50) {
      const targets = unique.slice(j, j + 50);
      let cont = "";
      for (let guard = 0; guard < 20; guard++) {
        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=links&pllimit=max&format=json&formatversion=2&titles=${encodeURIComponent(pages.join("|"))}&pltitles=${encodeURIComponent(targets.join("|"))}${cont}`;
        const json = await fetchJson(url);
        const q = PagesResponse.parse(json).query;
        for (const p of q?.pages ?? []) {
          for (const l of p.links ?? []) {
            if (l.title === p.title) continue;
            graph.set(p.title, (graph.get(p.title) ?? new Set()).add(l.title));
          }
        }
        const next = z
          .object({ continue: z.object({ plcontinue: z.string() }).optional() })
          .parse(json).continue;
        if (!next) break;
        cont = `&plcontinue=${encodeURIComponent(next.plcontinue)}`;
      }
    }
  }
  return graph;
}

// ── An article's normal readership ─────────────────────────────────────────────────
// GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/
//     user/<title>/daily/<YYYYMMDD>/<YYYYMMDD>  → {items: [{timestamp, views}]}; 404 when the
// article had no views in the range (e.g. it didn't exist yet). CC0.

const Daily = z.object({ items: z.array(z.object({ views: z.number() })) });

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");

export function normalUrl(title: string, date: string): string {
  const day = Date.parse(`${date}T00:00:00Z`);
  const from = ymd(day - 60 * 86_400_000);
  const to = ymd(day - 8 * 86_400_000);
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${t}/daily/${from}/${to}`;
}

export function medianViews(json: unknown): number {
  const v = Daily.parse(json)
    .items.map((i) => i.views)
    .sort((a, b) => a - b);
  return v.length ? (v[Math.floor(v.length / 2)] ?? 0) : 0;
}

/** Fill in each article's normal level (0 when it had no readers back then). */
export async function fetchNormal(articles: MostRead[], date: string): Promise<void> {
  for (const a of articles) {
    try {
      a.priorMedian = medianViews(await fetchJson(normalUrl(a.title, date)));
    } catch (err) {
      // 404: no views in the range, so the article is new.
      if (err instanceof Error && err.message.startsWith("404")) a.priorMedian = 0;
      else throw err;
    }
  }
}
