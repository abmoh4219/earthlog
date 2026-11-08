// The `general` lens: the first lens on the story-film engine, and every story's fallback.
// Chapters: the story → where → readers (30 days) → on record (Wikidata) → connected
// (related articles and places) → reported by (outlets). Specialised lenses (election,
// person, …) replace or extend these chapters in later phases.
import { z } from "zod";
import { centralAngle } from "../../src/scene/camera.ts";
import { type EditionStory, LENS_INFO } from "../../src/scene/edition.ts";
import { countryName } from "../../src/scene/geo.ts";
import type { Country, Evidence, LayerData, Panel, Scene, Source } from "../../src/scene/schema.ts";
import { fetchJson } from "../bake/lib.ts";
import { fetchCoordinates, type RawStory } from "../bake/wikinews.ts";
import { fetchEntities, type WdEntity } from "../edition/sources.ts";
import { curiosityLayers, fetchLanguageReaders, LANGUAGE } from "./attention.ts";
import { clip } from "./editor.ts";
import { buildFilm, type ChapterDraft, type PanelDraft, type Shot } from "./film.ts";
import { chronological, contextIsTheEvent, fetchNews } from "./news-context.ts";
import { fetchThread, recencyColor } from "./thread.ts";

export interface LensContext {
  date: string;
  story: EditionStory;
  /** The edition's evidence (news, readers, Wikidata types, places). */
  evidence: Evidence[];
  /** The day's Current events items, in portal order (their index matches wiki:<date>:<n>). */
  news: RawStory[];
  countries: Country[];
  at: string;
  /**
   * A first caption given by the caller: for a film of "Now", the news itself as an outlet
   * reported it ("…, Al Jazeera reports."), cited to that headline (ADR-0020).
   */
  lead?: { text: string; cites: string[] };
}

/**
 * How a specialised lens builds on `general`: it receives the general chapters and layers
 * and may splice in, replace or drop chapters (matched by title) before the film is built.
 */
export interface LensHooks {
  shape?: (parts: {
    chapters: ChapterDraft[];
    layers: LayerData[];
    /** Register new evidence; returns its id. */
    add: (e: Evidence) => string;
    /** Ship an edition evidence item; returns its id if it exists. */
    use: (id: string) => string | undefined;
    home: Shot;
  }) => void | Promise<void>;
  /** Sources credited by the lens's layers (e.g. map shapes), shipped even if uncited. */
  sources?: Source[];
}

/**
 * Layers the general lens shares with every film (the curiosity map, the story's thread):
 * a lens replacing the general places, arcs and regions keeps these.
 */
export function sharedLayer(l: LayerData | undefined): boolean {
  return l !== undefined && "name" in l && (l.name === "curiosity" || l.name === "thread");
}

export interface LensResult {
  scene: Scene;
  evidence: Evidence[];
  sources: Source[];
  layers: LayerData[];
}

const fmt = (n: number) => n.toLocaleString("en-GB");
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

// ── Data ─────────────────────────────────────────────────────────────────────────

const Daily = z.object({
  items: z.array(z.object({ timestamp: z.string(), views: z.number() })),
});

/** English Wikipedia daily readers for the 30 days ending on `date` (CC0). */
export async function fetchDailyViews(
  title: string,
  date: string,
): Promise<{ day: string; views: number }[]> {
  const end = Date.parse(`${date}T00:00:00Z`);
  const from = ymd(end - 29 * 86_400_000).replace(/-/g, "");
  const to = date.replace(/-/g, "");
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, "_"))}/daily/${from}/${to}`;
  try {
    const items = Daily.parse(await fetchJson(url)).items;
    return items.map((i) => ({
      day: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`,
      views: i.views,
    }));
  } catch {
    return []; // 404: no views in the range.
  }
}

/** Facts we show "on record", in order, with how to phrase them. */
const FACTS: { prop: string; label: string; kind: "item" | "time" | "quantity" }[] = [
  { prop: "P569", label: "Born", kind: "time" },
  { prop: "P19", label: "Birthplace", kind: "item" },
  { prop: "P570", label: "Died", kind: "time" },
  { prop: "P20", label: "Place of death", kind: "item" },
  { prop: "P106", label: "Occupation", kind: "item" },
  { prop: "P27", label: "Citizenship", kind: "item" },
  { prop: "P585", label: "Date", kind: "time" },
  { prop: "P580", label: "Began", kind: "time" },
  { prop: "P582", label: "Ended", kind: "time" },
  { prop: "P276", label: "Location", kind: "item" },
  { prop: "P571", label: "Founded", kind: "time" },
  { prop: "P159", label: "Headquarters", kind: "item" },
  { prop: "P452", label: "Industry", kind: "item" },
  { prop: "P1128", label: "Employees", kind: "quantity" },
  { prop: "P577", label: "Released", kind: "time" },
  { prop: "P57", label: "Director", kind: "item" },
  { prop: "P136", label: "Genre", kind: "item" },
  { prop: "P495", label: "Country of origin", kind: "item" },
  { prop: "P641", label: "Sport", kind: "item" },
  { prop: "P17", label: "Country", kind: "item" },
];

function dateText(d: string): string {
  if (/^\d{4}$/.test(d)) return d;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : d;
}

// ── The lens ─────────────────────────────────────────────────────────────────────

export async function generalLens(ctx: LensContext, hooks: LensHooks = {}): Promise<LensResult> {
  const { date, story, countries, at } = ctx;
  const dayStart = `${date}T00:00:00Z`;
  const dayLabel = dateText(date);
  const color = LENS_INFO[story.lens].color;
  const byId = new Map(ctx.evidence.map((e) => [e.id, e]));
  const evidence = new Map<string, Evidence>();
  const use = (id: string) => {
    const e = byId.get(id) ?? evidence.get(id);
    if (e) evidence.set(id, e);
    return e ? id : undefined;
  };
  const add = (e: Evidence) => {
    if (!evidence.has(e.id)) evidence.set(e.id, e);
    return e.id;
  };
  for (const id of story.evidence) use(id);

  const newsIds = story.evidence.filter((id) => id.startsWith("wiki:"));
  const newsItems = newsIds.flatMap((id) => {
    const n = Number(id.split(":").at(-1));
    const raw = ctx.news[n - 1];
    return raw ? [{ id, raw }] : [];
  });

  // Wikidata: the lead item and the items its facts point to.
  const qid = story.article?.qid;
  const entities = qid ? await fetchEntities([qid]) : new Map<string, WdEntity>();
  const lead = qid ? entities.get(qid) : undefined;
  if (lead) {
    const refs = FACTS.filter((f) => f.kind === "item").flatMap(
      (f) => lead.items[f.prop]?.slice(0, 2) ?? [],
    );
    for (const [k, v] of await fetchEntities(refs)) entities.set(k, v);
  }

  // ── Places: the story's place, places named by its news items, related articles. ──
  const places: { name: string; lon: number; lat: number; primary?: boolean }[] = [];
  const addPlace = (p: { name: string; lon: number; lat: number }, primary = false) => {
    const near = places.some((q) => Math.abs(q.lon - p.lon) < 0.3 && Math.abs(q.lat - p.lat) < 0.3);
    if (!near) places.push({ ...p, ...(primary ? { primary: true } : {}) });
  };
  if (story.place) addPlace(story.place, true);
  const newsLinks = newsItems.flatMap((n) => n.raw.links);
  const coords = await fetchCoordinates([...newsLinks, ...story.related]);
  const isCountry = (t: string) => countries.some((c) => c.name === t || c.aliases.includes(t));
  for (const t of [...newsLinks, ...story.related]) {
    const c = coords.get(t);
    if (c && c.type !== "country" && !isCountry(t) && c.dimMetres <= 1_500_000) {
      addPlace({ name: t.replace(/\s*\([^)]*\)$/, ""), lon: c.lon, lat: c.lat });
    }
  }
  for (const prop of ["P19", "P20", "P159", "P276"]) {
    const item = lead?.items[prop]?.[0];
    const e = item ? entities.get(item) : undefined;
    if (e?.coord && e.label) addPlace({ name: e.label, lon: e.coord.lon, lat: e.coord.lat });
  }
  const primary = places[0];

  // ── Layers ──
  const layers: LayerData[] = [];
  if (places.length) {
    layers.push({
      kind: "places",
      places: places.slice(0, 8).map((p) => ({ ...p, color })),
    });
  }
  const country = story.place?.country
    ? countries.find((c) => c.code === story.place?.country)
    : undefined;
  if (country) {
    layers.push({
      kind: "regions",
      regions: [
        { id: country.code, name: country.name, rings: country.rings, color, opacity: 0.16 },
      ],
      legend: [],
    });
  }
  if (primary && places.length > 1) {
    layers.push({
      kind: "arcs",
      arcs: places
        .slice(1, 8)
        .map((p) => ({ from: [primary.lon, primary.lat], to: [p.lon, p.lat], color })),
    });
  }

  const shotAt = (p: { lon: number; lat: number }, range: number): Shot => ({
    lon: p.lon,
    // Low, tilted shots look north across the place, so the target sits a little south.
    lat: p.lat - range / 1.6e6,
    range,
    pitch: -42,
    heading: 12,
  });
  const home: Shot = primary
    ? shotAt(
        primary,
        story.place && countries.some((c) => c.name === story.place?.name) ? 3.4e6 : 1.1e6,
      )
    : { lon: 0, lat: 20, range: 1.6e7, pitch: -85 };

  const chapters: ChapterDraft[] = [];

  // 1. What happened: the news first (a Current events item, else what the article says
  //    happened around the edition day), then who or what this is. Every sentence is quoted
  //    from, and cited to, the exact Wikipedia revision it was read from (news-context.ts).
  const newsFirst = newsItems[0];
  const found = story.article ? await fetchNews(story.article.title, date) : undefined;
  const fromArticle = (sentence: { text: string; index: number }) => {
    const rev = found?.revision;
    if (!rev) return undefined;
    return add({
      id: `wiki:rev:${rev.revid}:${sentence.index}`,
      kind: "report",
      source: "wikipedia-article",
      t: dayStart,
      precision: "day",
      label: `Wikipedia, "${rev.title}" (revision of ${rev.timestamp.slice(0, 16).replace("T", " ")} UTC)`,
      quote: sentence.text,
      url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(rev.title.replace(/ /g, "_"))}&oldid=${rev.revid}`,
    });
  };
  const opening: ChapterDraft["beats"] = ctx.lead ? [ctx.lead] : [];
  // An article about the event itself ("On November 1, 2026, a … jet crashed …") opens with
  // that event; later developments follow.
  const eventFirst =
    found && !newsFirst && contextIsTheEvent(found, date) ? found.context : undefined;
  if (eventFirst) {
    const id = fromArticle(eventFirst);
    if (id) opening.push({ text: clip(eventFirst.text), cites: [id] });
  }
  if (newsFirst) opening.push({ text: clip(newsFirst.raw.text), cites: [newsFirst.id] });
  const room = (eventFirst ? 3 : 2) - opening.length;
  for (const sentence of chronological((found?.news ?? []).slice(0, Math.max(0, room)), date)) {
    const id = fromArticle(sentence);
    if (id) opening.push({ text: clip(sentence.text), cites: [id] });
  }
  // Context last: who or what this is (unless the news already said it all).
  const context = eventFirst ? undefined : found?.context;
  if (context && opening.length < 3) {
    const id = fromArticle(context);
    if (id) opening.push({ text: clip(context.text), cites: [id] });
  }
  if (!opening.length && story.article && (story.about ?? story.summary)) {
    const id = add({
      id: `wiki:article:${story.article.title.replace(/ /g, "_")}`,
      kind: "report",
      source: "wikipedia-article",
      t: dayStart,
      precision: "day",
      label: `Wikipedia, "${story.article.title}"`,
      quote: story.about ?? story.summary,
      url: story.article.url,
    });
    opening.push({ text: clip(story.about ?? story.summary), cites: [id] });
  }
  if (opening.length) {
    chapters.push({
      title: "What happened",
      // About seven seconds per sentence: long enough to read, short enough to keep moving.
      seconds: 3 + opening.length * 7,
      shot: { ...home, range: home.range * 2.2, pitch: -56 },
      beats: opening,
    });
  }

  // 1b. How it unfolded: the story's thread through the past week of Current events.
  const thread = await fetchThread(
    date,
    {
      ...(newsItems[0]?.raw.topic ? { topic: newsItems[0].raw.topic } : {}),
      ...(story.article?.title ? { title: story.article.title } : {}),
    },
    countries,
    at,
  ).catch(() => ({ items: [], evidence: [], sources: [] }));
  if (thread.items.length >= 2) {
    for (const e of thread.evidence) add(e);
    const day = Date.parse(`${date}T00:00:00Z`);
    const daysAgo = (d: string) => (day - Date.parse(`${d}T00:00:00Z`)) / 86_400_000;
    const dayName = (d: string) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      });
    const placed = thread.items.filter((i) => i.place);
    if (placed.length) {
      layers.push({
        kind: "places",
        name: "thread",
        places: placed
          .filter((i, k) => placed.findIndex((j) => j.place?.name === i.place?.name) === k)
          .map((i) => ({
            name: i.place?.name ?? "",
            lon: i.place?.lon ?? 0,
            lat: i.place?.lat ?? 0,
            color: recencyColor(daysAgo(i.date)),
          })),
      });
      const legs = placed.slice(1).flatMap((b, k) => {
        const a = placed[k];
        return a?.place && b.place && a.place.name !== b.place.name
          ? [
              {
                from: [a.place.lon, a.place.lat] as [number, number],
                to: [b.place.lon, b.place.lat] as [number, number],
                color: recencyColor(daysAgo(b.date)),
              },
            ]
          : [];
      });
      if (legs.length) layers.push({ kind: "arcs", name: "thread", sequence: true, arcs: legs });
    }
    const shown = thread.items.slice(-4);
    chapters.push({
      title: "How it unfolded",
      seconds: 4 + shown.length * 6,
      shot: wideShot(placed.map((i) => i.place ?? { lon: 0, lat: 0 })) ?? {
        ...home,
        range: home.range * 2.4,
        pitch: -55,
      },
      beats: shown.map((i) => ({
        text: `${dayName(i.date)}: ${i.text}`.slice(0, 220),
        cites: [i.id],
      })),
      panels: [
        {
          id: "thread",
          kind: "facts",
          title: "The days before",
          note: "Earlier items under the same topic on Wikipedia's Current events.",
          items: thread.items.map((i) => ({
            label: dayName(i.date),
            text: clip(i.text, 90),
            cites: [i.id],
          })),
        } satisfies PanelDraft,
      ],
      reveal: ["places-thread", "arcs-thread"],
    });
  }

  // 2. Where.
  if (story.place) {
    const placeId = story.place.evidence ? use(story.place.evidence) : undefined;
    const placeCountry = story.place.country
      ? countries.find((k) => k.code === story.place?.country)
      : undefined;
    const inCountry = placeCountry ? countryName(placeCountry) : undefined;
    const where =
      inCountry && inCountry !== story.place.name && placeCountry?.name !== story.place.name
        ? `${story.place.name}, ${inCountry}`
        : story.place.name;
    const text =
      story.place.role && placeId && !placeId.startsWith("wiki:")
        ? `${story.place.role}: ${where}.`
        : `On the map: ${where}, where the reports place it.`;
    chapters.push({
      title: "Where",
      seconds: 8,
      shot: home,
      beats: placeId ? [{ text, cites: [placeId] }] : [],
      reveal: ["places", "regions"],
    });
  }

  // 3. Readers: a 30-day line for the lead article and up to two related ones.
  const titles = [story.article?.title, ...story.related]
    .filter((t): t is string => !!t)
    .slice(0, 3);
  const series: Extract<Panel, { kind: "line" }>["series"] = [];
  const seriesColors = [color, "#9ad9ff", "#e8f6ff"];
  for (const [i, title] of titles.entries()) {
    const days = await fetchDailyViews(title, date);
    if (days.length < 2) continue;
    const id = add({
      id: `views:en:${title.replace(/ /g, "_")}:30d`,
      kind: "sensor",
      source: "wikimedia",
      t: dayStart,
      precision: "day",
      label: `English Wikipedia daily readers of "${title}", ${dateText(days[0]?.day ?? date)} to ${dayLabel}`,
      unit: "readers",
      url: `https://pageviews.wmcloud.org/?project=en.wikipedia.org&pages=${encodeURIComponent(title.replace(/ /g, "_"))}&range=latest-30`,
    });
    series.push({
      label: title,
      color: seriesColors[i] ?? color,
      points: days.map((d) => ({ x: d.day.slice(5), y: d.views })),
      cites: [id],
    });
  }
  const leadViewsId = story.article
    ? `views:en:${story.article.title.replace(/ /g, "_")}:${date}`
    : undefined;
  const leadViews = leadViewsId ? byId.get(leadViewsId) : undefined;
  const priorId = story.article
    ? `views:en:${story.article.title.replace(/ /g, "_")}:prior`
    : undefined;
  const prior = priorId ? byId.get(priorId) : undefined;
  if (series.length && leadViews?.value !== undefined && leadViewsId) {
    const spike =
      prior?.value !== undefined && prior.value > 0
        ? Math.round(leadViews.value / prior.value)
        : undefined;
    const text =
      prior?.value === 0
        ? `${fmt(leadViews.value)} people read the article on ${dayLabel}. It hadn't existed weeks before.`
        : prior?.value !== undefined && prior.value < 50
          ? `${fmt(leadViews.value)} people read about it on ${dayLabel}. In the weeks before, almost nobody did: a median of ${fmt(prior.value)} a day.`
          : spike && spike >= 2
            ? `${fmt(leadViews.value)} people read about it on ${dayLabel}: about ${fmt(spike)}× the usual.`
            : `${fmt(leadViews.value)} people read about it on ${dayLabel}.`;
    // Beyond English: readers in each Wikipedia language that day (a language is not a country).
    const langs = story.article
      ? await fetchLanguageReaders(story.article.title, date).catch(() => [])
      : [];
    const others = langs.filter((l) => l.lang !== "en");
    const langIds = langs.map((r) =>
      add({
        id: `views:${r.lang}:${r.title.replace(/\s+/g, "_")}:${date}`,
        kind: "sensor",
        source: "wikimedia",
        t: dayStart,
        precision: "day",
        label: `${LANGUAGE[r.lang] ?? r.lang} Wikipedia: ${fmt(r.views)} readers of "${r.title}" on ${dayLabel}`,
        value: r.views,
        unit: "readers",
        url: `https://${r.lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
      }),
    );
    const beatsR: ChapterDraft["beats"] = [
      { text, cites: [leadViewsId, ...(prior && priorId ? [use(priorId) ?? priorId] : [])] },
    ];
    // Other languages only when they say something: "most in Turkish (14)" is noise.
    const topOther = others[0] && others[0].views >= 200 ? others[0] : undefined;
    if (langs.length >= 3 && topOther) {
      beatsR.push({
        text: `Read in ${langs.length} languages; after English, most in ${LANGUAGE[topOther.lang] ?? topOther.lang} (${fmt(topOther.views)}).`,
        cites: langIds.slice(0, 1).concat(langIds[langs.indexOf(topOther)] ?? []),
      });
    }
    // The curiosity map: each language's readers glowing where it is mainly spoken.
    const curiosity = curiosityLayers(langs, ctx.countries);
    layers.push(...curiosity.layers);
    const curiosityShot = curiosity.layers.length ? wideShot(curiosity.points) : undefined;
    if (curiosity.layers.length && topOther)
      beatsR.push({
        text: `Each language glows where it is mainly spoken, brighter for more readers. A language is not a country.`,
        cites: langIds.filter((_, i) => langs[i]?.lang !== "en").slice(0, 6),
      });
    chapters.push({
      title: "Readers",
      seconds: 6 + beatsR.length * 6,
      shot: curiosityShot
        ? { ...curiosityShot, range: Math.max(curiosityShot.range, 1.4e7), pitch: -60 }
        : { ...home, range: home.range * 1.6, pitch: -52, heading: -15 },
      ...(curiosity.layers.length ? { reveal: ["regions-curiosity", "columns-curiosity"] } : {}),
      beats: beatsR,
      panels: [
        {
          id: "readers",
          kind: "line",
          title: "Readers on English Wikipedia",
          unit: "readers a day",
          note: "Daily page views by people (bots excluded). Readers are curiosity, not support.",
          series,
          mark: (series[0]?.points.length ?? 1) - 1,
        } satisfies PanelDraft,
        ...(langs.length >= 3
          ? [
              {
                id: "languages",
                kind: "bars",
                title: "Readers by language",
                unit: "readers",
                note: "Wikipedia language editions that day. A language is not a country.",
                items: langs.slice(0, 7).map((r, i) => ({
                  label: LANGUAGE[r.lang] ?? r.lang,
                  value: r.views,
                  text: fmt(r.views),
                  color: i === 0 ? color : "#9ad9ff",
                  cites: [langIds[i] ?? leadViewsId],
                })),
              } satisfies PanelDraft,
            ]
          : []),
      ],
    });
    use(leadViewsId);
  }

  // 4. On record: Wikidata facts.
  if (lead && qid) {
    const items: Extract<Panel, { kind: "facts" }>["items"] = [];
    for (const f of FACTS) {
      let text: string | undefined;
      if (f.kind === "time") text = lead.times?.[f.prop]?.[0];
      if (text) text = dateText(text);
      if (f.kind === "quantity") {
        const q = lead.quantities?.[f.prop]?.[0];
        text = q !== undefined ? fmt(q) : undefined;
      }
      if (f.kind === "item") {
        const labels = (lead.items[f.prop] ?? [])
          .slice(0, 2)
          .flatMap((id) => entities.get(id)?.label ?? []);
        text = labels.length ? labels.join(", ") : undefined;
      }
      if (!text) continue;
      const id = add({
        id: `wd:${qid}:${f.prop}`,
        kind: "sensor",
        source: "wikidata",
        t: dayStart,
        precision: "day",
        label: `Wikidata, "${lead.label ?? qid}": ${f.label.toLowerCase()} ${text}`,
        url: `https://www.wikidata.org/wiki/${qid}#${f.prop}`,
      });
      items.push({ label: f.label, text, cites: [id] });
      if (items.length >= 6) break;
    }
    if (items.length >= 2) {
      const [a, b] = items;
      const line = [a, b]
        .filter((x) => x !== undefined)
        .map((x) => `${x.label}: ${x.text}`)
        .join(". ");
      chapters.push({
        title: "On record",
        seconds: 10,
        shot: { ...home, heading: 20 },
        beats: [{ text: `${line}.`, cites: [a, b].flatMap((x) => x?.cites ?? []) }],
        panels: [
          {
            id: "record",
            kind: "facts",
            title: `On record: ${lead.label ?? story.title}`,
            note: "As recorded in Wikidata (CC0).",
            items,
          },
        ],
      });
    }
  }

  // 5. Connected: related articles readers turned to, and the places that tie in.
  const related = story.related
    .map((t) => ({ t, e: byId.get(`views:en:${t.replace(/ /g, "_")}:${date}`) }))
    .filter((r): r is { t: string; e: Evidence } => r.e?.value !== undefined)
    .slice(0, 3);
  if (related.length || places.length > 1) {
    const text = related.length
      ? `Readers also turned to ${related.map((r) => `${r.t} (${fmt(r.e.value ?? 0)})`).join(", ")}.`
      : `Also named in the reports: ${places
          .slice(1, 4)
          .map((p) => p.name)
          .join(", ")}.`;
    const cites = related.length
      ? related.map((r) => use(r.e.id) ?? r.e.id)
      : newsFirst
        ? [newsFirst.id]
        : [];
    chapters.push({
      title: "Connected",
      seconds: 9,
      shot: wideShot(places) ?? { ...home, range: home.range * 2 },
      beats: cites.length ? [{ text, cites }] : [],
      reveal: ["arcs"],
    });
  }

  // 6. Reported by: the outlets behind the news items.
  const outlets = newsItems.flatMap((n) => n.raw.sources.map((s) => ({ ...s, id: n.id })));
  if (outlets.length) {
    const names = [...new Set(outlets.map((o) => o.name))];
    chapters.push({
      title: "Reported by",
      seconds: 8,
      shot: { ...home, range: home.range * 1.3, heading: -10 },
      beats: [
        { text: `Reported by ${list(names)}.`, cites: [...new Set(outlets.map((o) => o.id))] },
      ],
      panels: [
        {
          id: "sources",
          kind: "facts",
          title: "Sources",
          note: "Via Wikipedia's Current events, which cites each outlet.",
          items: outlets
            .slice(0, 6)
            .map((o) => ({ label: o.name, text: "Open", url: o.url, cites: [o.id] })),
        },
      ],
    });
  }

  // The story and its analysis first; how many people read about it is a side note near
  // the end, before the sources.
  const ORDER = [
    "What happened",
    "How it unfolded",
    "Where",
    "On record",
    "Connected",
    "Readers",
    "Reported by",
  ];
  chapters.sort((a, b) => ORDER.indexOf(a.title) - ORDER.indexOf(b.title));
  await hooks.shape?.({ chapters, layers, add, use, home });
  if (!chapters.length) throw new Error(`${story.slug}: nothing citable to film`);

  // The sources, known now that every chapter has added its evidence.
  const shipped = [...evidence.values()];
  const sourceIds = new Set(shipped.map((e) => e.source));
  const sources: Source[] = [
    {
      id: "wikipedia",
      name: "Wikipedia, Current events",
      url: "https://en.wikipedia.org/wiki/Portal:Current_events",
      license: "CC BY-SA 4.0",
      attribution: "Wikipedia contributors",
      retrievedAt: at,
    },
    {
      id: "wikipedia-article",
      name: "Wikipedia articles",
      url: "https://en.wikipedia.org/",
      license: "CC BY-SA 4.0; text quoted and adapted with attribution",
      attribution: "Wikipedia contributors",
      retrievedAt: at,
    },
    {
      id: "wikimedia",
      name: "Wikimedia pageviews",
      url: "https://wikimedia.org/api/rest_v1/",
      license: "CC0",
      attribution: "Wikimedia Foundation",
      retrievedAt: at,
    },
    {
      id: "wikidata",
      name: "Wikidata",
      url: "https://www.wikidata.org/",
      license: "CC0 1.0",
      attribution: "Wikidata contributors",
      retrievedAt: at,
    },
  ]
    .filter((s) => sourceIds.has(s.id))
    .concat(thread.sources.filter((s) => sourceIds.has(s.id)))
    .concat(hooks.sources ?? []);

  // Every film ends on its sources: each one that evidence in this film comes from, with its
  // licence and a link (map shapes and terrain, which no caption cites, stay in the credits).
  const cited = sources.flatMap((src) => {
    const first = shipped.find((e) => e.source === src.id);
    return first ? [{ src, id: first.id }] : [];
  });
  if (cited.length) {
    const names = [...new Set(cited.map((c) => c.src.name))];
    chapters.push({
      title: "Sources",
      seconds: 7,
      shot: { ...home, range: home.range * 2.6, pitch: -70, heading: 0 },
      beats: [
        {
          text: `Sources: ${list(names.slice(0, 5))}. Every caption links to the evidence it rests on.`,
          cites: cited.slice(0, 5).map((c) => c.id),
        },
      ],
      panels: [
        {
          id: "film-sources",
          kind: "facts",
          title: "Sources",
          note: "Licences per source. Map shapes and terrain are credited at the foot of the screen.",
          items: cited.slice(0, 8).map((c) => ({
            label: c.src.name.length > 48 ? `${c.src.name.slice(0, 46)}…` : c.src.name,
            text: c.src.license.split(/[;(]/)[0]?.trim().slice(0, 32) || "Open",
            url: c.src.url,
            cites: [c.id],
          })),
        },
      ],
    });
  }
  const scene = buildFilm({ date, story, chapters, layers, at });
  return { scene, evidence: shipped, sources, layers };
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** A shot that frames every place, or undefined for fewer than two. */
export function wideShot(places: { lon: number; lat: number }[]): Shot | undefined {
  if (places.length < 2) return undefined;
  // The spherical centroid (mean of unit vectors): right across the antimeridian, and a
  // world-wide spread centres where most of the places are, not on a lon/lat midpoint.
  const D = Math.PI / 180;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of places) {
    x += Math.cos(p.lat * D) * Math.cos(p.lon * D);
    y += Math.cos(p.lat * D) * Math.sin(p.lon * D);
    z += Math.sin(p.lat * D);
  }
  const lon = Math.atan2(y, x) / D;
  const lat = Math.atan2(z, Math.hypot(x, y)) / D;
  // Sized by the farthest place from the centre.
  const reach = Math.max(...places.map((p) => centralAngle(lon, lat, p.lon, p.lat))) / D;
  const range = Math.min(2.2e7, Math.max(1.5e6, reach * 2 * 111_000 * 2.4));
  // Centred on the places: a wide shot frames them all, above the captions.
  return { lon, lat: lat - range / 5e6, range, pitch: -55 };
}
