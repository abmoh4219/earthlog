// The organization and tech lens (PLAN.md Phase 8): companies, websites, apps, institutions.
// Headquarters (P159; for a website, its operator's P137 → P159) → what's on record (founded
// P571, founders P112, CEO P169, chair P488, industry P452, owner P127, parent P749, stock
// exchange P414, website P856) → the numbers (revenue P2139, net income P2295, staff P1128,
// each dated by P585, money in the claim's currency) → its footprint (subsidiaries P355 and
// holdings P1830, arcing out from headquarters) → tech talk (Hacker News stories mentioning
// it). Verified 2026-11-04 on Nvidia (19 years of revenue), OpenAI (revenue values that are
// inconsistent in Wikidata, so flagged, not charted) and Archive of Our Own (operator only).
import { z } from "zod";
import { LENS_INFO } from "../../src/scene/edition.ts";
import { countryName } from "../../src/scene/geo.ts";
import type { Evidence, LayerData, Panel, Source } from "../../src/scene/schema.ts";
import { fetchJson } from "../bake/lib.ts";
import { fetchEntities, type WdEntity } from "../edition/sources.ts";
import type { ChapterDraft, PanelDraft } from "./film.ts";
import {
  generalLens,
  type LensContext,
  type LensResult,
  sharedLayer,
  wideShot,
} from "./general.ts";

// ── Pure helpers ───────────────────────────────────────────────────────────────

export interface Point {
  year: string;
  value: number;
}

/**
 * One value per year (the last recorded), oldest first, with values wildly off the series'
 * median (beyond 50× either way: a wrong unit or a typo in Wikidata) removed and counted.
 */
export function cleanSeries(raw: { value: number; at?: string }[]): {
  points: Point[];
  dropped: number;
} {
  const byYear = new Map<string, number>();
  for (const r of raw) {
    const year = r.at?.slice(0, 4);
    if (year && /^\d{4}$/.test(year)) byYear.set(year, r.value);
  }
  const points = [...byYear]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year.localeCompare(b.year));
  const sorted = points.map((p) => Math.abs(p.value)).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (median === 0) return { points, dropped: 0 };
  const kept = points.filter(
    (p) =>
      Math.abs(p.value) === 0 ||
      (Math.abs(p.value) <= median * 50 && Math.abs(p.value) >= median / 50),
  );
  return { points: kept, dropped: points.length - kept.length };
}

const SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
};

/** "$4.1 billion", "€930 million", "1.2 trillion KRW"; plain counts get thousands separators. */
export function money(value: number, iso?: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const scaled =
    abs >= 1e12
      ? `${+(abs / 1e12).toFixed(1)} trillion`
      : abs >= 1e9
        ? `${+(abs / 1e9).toFixed(1)} billion`
        : abs >= 1e6
          ? `${+(abs / 1e6).toFixed(1)} million`
          : abs.toLocaleString("en-GB");
  if (!iso) return `${sign}${scaled}`;
  const symbol = SYMBOL[iso];
  return symbol ? `${sign}${symbol}${scaled}` : `${sign}${scaled} ${iso}`;
}

// ── Hacker News (Algolia search API) ─────────────────────────────────────────────
// Verified 2026-11-04: GET https://hn.algolia.com/api/v1/search_by_date?query=…&tags=story
// &numericFilters=created_at_i>…,created_at_i<…&restrictSearchableAttributes=title
// &typoTolerance=false → { hits: [{ title, url, points, num_comments, created_at, objectID }] }.
// No licence is stated, so we show counts, and the top story's title only as a link.

const HnHits = z.object({
  nbHits: z.number(),
  hits: z.array(
    z.object({
      objectID: z.string(),
      title: z.string().nullable().optional(),
      points: z.number().nullable().optional(),
      num_comments: z.number().nullable().optional(),
      created_at: z.string(),
    }),
  ),
});

export interface TechTalk {
  perDay: { day: string; stories: number }[];
  total: number;
  top?: { title: string; points: number; comments: number; url: string };
}

/** Tech talk under any of an organisation's names ("Archive of Our Own", "AO3"), merged. */
export async function fetchTechTalkAny(names: string[], date: string): Promise<TechTalk> {
  const runs: TechTalk[] = [];
  for (const n of [...new Set(names)].slice(0, 3)) runs.push(await fetchTechTalk(n, date));
  const perDay =
    runs[0]?.perDay.map((d, i) => ({
      day: d.day,
      stories: runs.reduce((s, r) => s + (r.perDay[i]?.stories ?? 0), 0),
    })) ?? [];
  const top = runs.flatMap((r) => (r.top ? [r.top] : [])).sort((a, b) => b.points - a.points)[0];
  return { perDay, total: runs.reduce((s, r) => s + r.total, 0), ...(top ? { top } : {}) };
}

export async function fetchTechTalk(name: string, date: string): Promise<TechTalk> {
  const end = Date.parse(`${date}T00:00:00Z`) / 1000 + 86_400;
  const start = end - 14 * 86_400;
  const p = new URLSearchParams({
    query: name,
    tags: "story",
    numericFilters: `created_at_i>${start},created_at_i<${end}`,
    restrictSearchableAttributes: "title",
    typoTolerance: "false",
    hitsPerPage: "200",
  });
  const json = HnHits.parse(await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?${p}`));
  // Titles must contain the name as a whole word: the search itself is forgiving.
  const word = new RegExp(
    `(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`,
    "iu",
  );
  const hits = json.hits.filter((h) => h.title && word.test(h.title));
  const days = new Map<string, number>();
  for (let t = start; t < end; t += 86_400)
    days.set(new Date(t * 1000).toISOString().slice(0, 10), 0);
  for (const h of hits) {
    const day = h.created_at.slice(0, 10);
    if (days.has(day)) days.set(day, (days.get(day) ?? 0) + 1);
  }
  const best = [...hits].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
  return {
    perDay: [...days].map(([day, stories]) => ({ day, stories })),
    total: hits.length,
    ...(best?.title
      ? {
          top: {
            title: best.title,
            points: best.points ?? 0,
            comments: best.num_comments ?? 0,
            url: `https://news.ycombinator.com/item?id=${best.objectID}`,
          },
        }
      : {}),
  };
}

// ── The lens ───────────────────────────────────────────────────────────────────

const year = (d?: string) => d?.slice(0, 4);

function dateText(d: string): string {
  if (/^\d{4}(-00)*$/.test(d) || /^\d{4}-\d{2}-00$/.test(d)) return d.slice(0, 4);
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : d.slice(0, 4);
}

function listOf(xs: string[]): string {
  const u = [...new Set(xs)];
  if (u.length <= 1) return u[0] ?? "";
  if (u.length > 3) return `${u.slice(0, 2).join(", ")} and ${u.length - 2} others`;
  return `${u.slice(0, -1).join(", ")} and ${u.at(-1)}`;
}

const hn: Source = {
  id: "hackernews",
  name: "Hacker News (via the Algolia search API)",
  url: "https://news.ycombinator.com/",
  license: "No licence stated: story counts and links only",
  attribution: "Hacker News",
  retrievedAt: "",
};

export async function organizationLens(ctx: LensContext): Promise<LensResult> {
  const qid = ctx.story.article?.qid;
  const first = qid ? await fetchEntities([qid]) : new Map<string, WdEntity>();
  const org = qid ? first.get(qid) : undefined;
  if (!qid || !org) return generalLens(ctx);

  const entities = new Map(first);
  const want = (e: WdEntity | undefined, props: string[]) =>
    props.flatMap((p) => e?.items[p]?.slice(0, 6) ?? []);
  const units = ["P2139", "P2295"]
    .flatMap((p) => org.series?.[p]?.map((s) => s.unit ?? "") ?? [])
    .filter((u) => /^Q\d+$/.test(u));
  for (const [k, v] of await fetchEntities([
    ...want(org, [
      "P31",
      "P159",
      "P112",
      "P169",
      "P488",
      "P452",
      "P749",
      "P137",
      "P127",
      "P414",
      "P17",
      "P355",
      "P1830",
    ]),
    ...units,
  ])) {
    entities.set(k, v);
  }
  // Second hop: the operator's or parent's headquarters, subsidiaries' headquarters, countries.
  const hop = [...entities.values()]
    .flatMap((e) => want(e, ["P159", "P17", "P131"]))
    .filter((id) => !entities.has(id));
  for (const [k, v] of await fetchEntities(hop)) entities.set(k, v);

  const label = (id?: string) => (id ? entities.get(id)?.label : undefined);
  const coordOf = (id?: string): { lon: number; lat: number } | undefined => {
    const e = id ? entities.get(id) : undefined;
    if (!e) return undefined;
    return (
      e.coord ??
      entities.get(e.items.P159?.[0] ?? "")?.coord ??
      entities.get(e.items.P131?.[0] ?? "")?.coord
    );
  };
  const name = org.label ?? ctx.story.title;
  const dayStart = `${ctx.date}T00:00:00Z`;
  const evidence: Evidence[] = [];
  const cite = (prop: string, text: string, key?: string) => {
    const id = `wd:${qid}:${prop}${key ? `:${key}` : ""}`;
    if (!evidence.some((e) => e.id === id)) {
      evidence.push({
        id,
        kind: "sensor",
        source: "wikidata",
        t: dayStart,
        precision: "day",
        label: `Wikidata, "${name}": ${text}`,
        url: `https://www.wikidata.org/wiki/${qid}#${prop}`,
      });
    }
    return id;
  };

  // Headquarters, or (for a website or project) its operator's.
  const hqItem = org.items.P159?.[0];
  const operator = org.items.P137?.[0] ?? org.items.P749?.[0];
  const hqVia = hqItem ? undefined : operator;
  const hqCity = hqItem ?? (operator ? entities.get(operator)?.items.P159?.[0] : undefined);
  const hq = coordOf(hqCity);
  const countryIso = entities.get(entities.get(hqCity ?? "")?.items.P17?.[0] ?? "")?.iso2;
  const country = countryIso ? ctx.countries.find((c) => c.code === countryIso) : undefined;

  // The numbers.
  const isoOf = (unit?: string) => (unit ? entities.get(unit)?.strings?.P498?.[0] : undefined);
  const revenue = cleanSeries(org.series?.P2139 ?? []);
  const income = cleanSeries(org.series?.P2295 ?? []);
  const staff = cleanSeries(org.series?.P1128 ?? []);
  const revUnit = isoOf(org.series?.P2139?.[0]?.unit);

  // Footprint: subsidiaries and holdings with a location.
  const holdings = [...(org.items.P355 ?? []), ...(org.items.P1830 ?? [])]
    .slice(0, 10)
    .flatMap((id) => {
      const c = coordOf(id);
      const n = label(id);
      return c && n ? [{ id, name: n, ...c }] : [];
    });

  // A short name in the article's opening ("Archive of Our Own (AO3) is …") is how people
  // usually write it in titles.
  const shortName = /\(([A-Z][A-Za-z0-9.&-]{1,11})\)/.exec(ctx.story.about ?? "")?.[1];
  const talk = await fetchTechTalkAny([name, ...(shortName ? [shortName] : [])], ctx.date).catch(
    () => undefined,
  );
  const color = LENS_INFO.organization.color;

  return generalLens(ctx, {
    ...(talk && talk.total >= 3 ? { sources: [{ ...hn, retrievedAt: ctx.at }] } : {}),
    shape: ({ chapters, layers, add }) => {
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      for (let i = layers.length - 1; i >= 0; i--) {
        const kind = layers[i]?.kind;
        if ((kind === "places" || kind === "arcs" || kind === "regions") && !sharedLayer(layers[i]))
          layers.splice(i, 1);
      }
      const inserts: ChapterDraft[] = [];

      // 1. Headquarters.
      if (hq && hqCity) {
        const hqId = hqVia
          ? cite("P137", `operated by ${label(hqVia)}, headquartered in ${label(hqCity)}`)
          : cite("P159", `headquarters: ${label(hqCity)}`);
        layers.push({
          kind: "places",
          places: [
            { name: `${name} · ${label(hqCity)}`, lon: hq.lon, lat: hq.lat, color, primary: true },
            ...holdings.slice(0, 7).map((h) => ({ name: h.name, lon: h.lon, lat: h.lat, color })),
          ],
        } satisfies LayerData);
        if (country) {
          layers.push({
            kind: "regions",
            regions: [
              { id: country.code, name: country.name, rings: country.rings, color, opacity: 0.14 },
            ],
            legend: [],
          });
        }
        const where = `${label(hqCity)}${country ? `, ${countryName(country)}` : ""}`;
        inserts.push({
          title: "Headquarters",
          seconds: 8,
          shot: { lon: hq.lon, lat: hq.lat - 0.8, range: 8e5, pitch: -36, heading: 18 },
          beats: [
            {
              text: hqVia
                ? `${name} is run by ${label(hqVia)}, based in ${where}.`
                : `${name} is headquartered in ${where}.`,
              cites: [hqId],
            },
          ],
          reveal: ["places", "regions"],
        });
      }

      // 2. On record.
      const items: Extract<Panel, { kind: "facts" }>["items"] = [];
      const fact = (prop: string, lbl: string, text: string | undefined, key?: string) => {
        if (!text) return undefined;
        const id = cite(prop, `${lbl.toLowerCase()}: ${text}`, key);
        items.push({ label: lbl, text, cites: [id] });
        return id;
      };
      const founded = org.times?.P571?.[0];
      const foundedId = fact("P571", "Founded", founded ? dateText(founded) : undefined);
      const founders = (org.items.P112 ?? []).flatMap((id) => label(id) ?? []);
      const foundersId = fact("P112", "Founded by", founders.length ? listOf(founders) : undefined);
      const ceo = label(org.items.P169?.at(-1));
      const ceoId = fact("P169", "Chief executive", ceo);
      fact("P488", "Chair", label(org.items.P488?.at(-1)));
      fact(
        "P452",
        "Industry",
        (org.items.P452 ?? [])
          .slice(0, 2)
          .flatMap((id) => label(id) ?? [])
          .join(", ") || undefined,
      );
      fact("P137", "Operator", label(org.items.P137?.[0]));
      fact("P749", "Parent", label(org.items.P749?.[0]));
      fact("P127", "Owned by", label(org.items.P127?.at(-1)));
      fact("P414", "Listed on", label(org.items.P414?.[0]));
      const lastStaff = staff.points.at(-1);
      fact(
        "P1128",
        "Employees",
        lastStaff ? `${lastStaff.value.toLocaleString("en-GB")} (${lastStaff.year})` : undefined,
        "latest",
      );
      const site = org.strings?.P856?.[0];
      if (site && /^https?:\/\//.test(site)) {
        const id = cite("P856", `official website ${site}`);
        items.push({
          label: "Website",
          text: site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
          url: site,
          cites: [id],
        });
      }
      if (items.length >= 2) {
        const parts: string[] = [];
        const cites: string[] = [];
        if (founded) {
          parts.push(
            `Founded in ${year(founded)}${founders.length ? ` by ${listOf(founders)}` : ""}`,
          );
          cites.push(...[foundedId, foundersId].filter((x): x is string => !!x));
        }
        if (ceo && ceoId) {
          parts.push(`led by ${ceo}`);
          cites.push(ceoId);
        }
        inserts.push({
          title: "On record",
          seconds: 10,
          shot: hq
            ? { lon: hq.lon, lat: hq.lat - 2, range: 2.6e6, pitch: -46, heading: -10 }
            : { lon: 0, lat: 20, range: 1.6e7 },
          beats: parts.length
            ? [{ text: `${parts.join(", ")}.`, cites }]
            : [{ text: `What's on record about ${name}.`, cites: items[0]?.cites ?? [] }],
          panels: [
            {
              id: "record",
              kind: "facts",
              title: `On record: ${name}`,
              note: "As recorded in Wikidata (CC0).",
              items,
            },
          ],
        });
      }

      // 3. The numbers.
      const panels: PanelDraft[] = [];
      const beats: ChapterDraft["beats"] = [];
      if (revenue.points.length >= 3) {
        const a = revenue.points[0];
        const b = revenue.points.at(-1);
        const revId = cite(
          "P2139",
          `revenue ${revenue.points.map((p) => `${p.year}: ${money(p.value, revUnit)}`).join("; ")}`,
          "series",
        );
        const series: Extract<Panel, { kind: "line" }>["series"] = [
          {
            label: "Revenue",
            color,
            points: revenue.points.map((p) => ({ x: p.year, y: p.value })),
            cites: [revId],
          },
        ];
        // Net income is drawn on the same axis only when it shares the revenue's years.
        if (income.points.length >= 3 && income.points.every((p) => p.value >= 0)) {
          const incId = cite(
            "P2295",
            `net income ${income.points.map((p) => `${p.year}: ${money(p.value, revUnit)}`).join("; ")}`,
            "series",
          );
          series.push({
            label: "Net income",
            color: "#e8f6ff",
            points: income.points.map((p) => ({ x: p.year, y: p.value })),
            cites: [incId],
          });
        }
        if (a && b) {
          beats.push({
            text: `Revenue on record: ${money(a.value, revUnit)} in ${a.year}, ${money(b.value, revUnit)} in ${b.year}.`,
            cites: [revId],
          });
        }
        panels.push({
          id: "revenue",
          kind: "line",
          title: `Revenue${revUnit ? ` (${revUnit})` : ""}`,
          unit: "per year",
          note: `As recorded in Wikidata.${revenue.dropped ? ` ${revenue.dropped} value${revenue.dropped > 1 ? "s" : ""} inconsistent with the rest (likely a unit error) not shown.` : ""}`,
          series,
        });
      }
      if (staff.points.length >= 3) {
        const a = staff.points[0];
        const b = staff.points.at(-1);
        const staffId = cite(
          "P1128",
          `employees ${staff.points.map((p) => `${p.year}: ${p.value.toLocaleString("en-GB")}`).join("; ")}`,
          "series",
        );
        if (a && b)
          beats.push({
            text: `Staff grew from ${a.value.toLocaleString("en-GB")} in ${a.year} to ${b.value.toLocaleString("en-GB")} in ${b.year}.`,
            cites: [staffId],
          });
        panels.push({
          id: "staff",
          kind: "line",
          title: "Employees",
          unit: "people",
          note: "As recorded in Wikidata.",
          series: [
            {
              label: "Employees",
              color: "#9ad9ff",
              points: staff.points.map((p) => ({ x: p.year, y: p.value })),
              cites: [staffId],
            },
          ],
        });
      }
      if (panels.length) {
        inserts.push({
          title: "The numbers",
          seconds: 6 + beats.length * 5,
          shot: hq
            ? { lon: hq.lon, lat: hq.lat - 3, range: 4e6, pitch: -52, heading: 8 }
            : { lon: 0, lat: 20, range: 1.6e7 },
          beats,
          panels,
        });
      }

      // 4. Footprint.
      if (hq && holdings.length >= 2) {
        const ids = holdings.map((h) =>
          cite(
            org.items.P355?.includes(h.id) ? "P355" : "P1830",
            `${org.items.P355?.includes(h.id) ? "subsidiary" : "owns"} ${h.name}`,
            h.id,
          ),
        );
        layers.push({
          kind: "arcs",
          arcs: holdings.map((h) => ({ from: [hq.lon, hq.lat], to: [h.lon, h.lat], color })),
        });
        inserts.push({
          title: "Footprint",
          seconds: 9,
          shot: wideShot([hq, ...holdings]) ?? { lon: hq.lon, lat: hq.lat, range: 8e6 },
          beats: [
            {
              text: `Companies it owns on record include ${listOf(holdings.map((h) => h.name))}.`,
              cites: ids,
            },
          ],
          reveal: ["arcs"],
        });
      }

      // 5. Tech talk.
      if (talk && talk.total >= 3) {
        const id = add({
          id: `hn:${ctx.date}:${qid}`,
          kind: "sensor",
          source: "hackernews",
          t: dayStart,
          precision: "day",
          label: `Hacker News: ${talk.total} stories with "${name}" in the title in the 14 days to ${dateText(ctx.date)}`,
          value: talk.total,
          unit: "stories",
          url: `https://hn.algolia.com/?q=${encodeURIComponent(name)}&type=story&dateRange=pastMonth`,
        });
        const panels: PanelDraft[] = [
          {
            id: "hn",
            kind: "line",
            title: "Hacker News stories a day",
            unit: "stories",
            note: `Stories with "${name}" in the title, over 14 days.`,
            series: [
              {
                label: name,
                color,
                points: talk.perDay.map((d) => ({ x: d.day.slice(5), y: d.stories })),
                cites: [id],
              },
            ],
            mark: talk.perDay.length - 1,
          },
        ];
        if (talk.top) {
          panels.push({
            id: "hn-top",
            kind: "facts",
            title: "Most discussed",
            items: [
              {
                label: `${talk.top.points} points`,
                text: talk.top.title,
                url: talk.top.url,
                cites: [id],
              },
            ],
          });
        }
        inserts.push({
          title: "Tech talk",
          seconds: 9,
          shot: hq
            ? { lon: hq.lon, lat: hq.lat - 4, range: 5.5e6, pitch: -56 }
            : { lon: 0, lat: 20, range: 1.6e7 },
          beats: [
            {
              text: `${talk.total} Hacker News stories mentioned ${name} in the two weeks to ${dateText(ctx.date)}.`,
              cites: [id],
            },
          ],
          panels,
        });
      }

      for (const e of evidence) add(e);
      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}
