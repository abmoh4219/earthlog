// Films for the stories of "Now" (ADR-0020), every caption cited, no AI.
// - A story whose headlines name a Wikipedia article (ADR-0019) is filmed by the lens of that
//   article's kind, typed through Wikidata like an edition story: a person's life, a conflict's
//   week and figures, a company's numbers, an accident site; it opens on the news itself.
// - Otherwise a short film: the news as reported, where, each outlet's headline, the sources.
// Built in story time like edition films. The film's day is the day of its latest headline;
// only that day's headlines are quoted, cited at day precision with the exact time in the label.
import { type EditionStory, LENS_INFO, type Lens } from "../../src/scene/edition.ts";
import { countryName } from "../../src/scene/geo.ts";
import type { Cluster, ClusterPlace, Headline } from "../../src/scene/headlines.ts";
import { outletById } from "../../src/scene/outlets.ts";
import {
  type Country,
  type Evidence,
  type LayerData,
  Scene,
  type Source,
} from "../../src/scene/schema.ts";
import { LENS_TOPIC, TOPIC_LABEL, type Topic } from "../../src/scene/topics.ts";
import { validateBundle } from "../../src/scene/validate.ts";
import { fetchJson } from "../bake/lib.ts";
import { lensFromTypes } from "../edition/lens.ts";
import { fetchEntities, fetchQids } from "../edition/sources.ts";
import { buildFilm, type ChapterDraft } from "../lenses/film.ts";
import { LENS_FILMS } from "../lenses/index.ts";

export interface NowFilm {
  scene: Scene;
  evidence: Evidence[];
  sources: Source[];
  layers: LayerData[];
}

const name = (id: string) => outletById(id)?.name ?? id;
const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

/** The closing "Sources:" line with the outlets named first (a count when the names won't fit). */
function creditOutlets(beats: Scene["beats"], names: string[]): Scene["beats"] {
  return beats.map((b) => {
    if (!b.text.startsWith("Sources: ")) return b;
    const rest = b.text.slice("Sources: ".length);
    const named = `Sources: ${list(names)}, ${rest}`;
    return {
      ...b,
      text: named.length <= 220 ? named : `Sources: ${names.length} outlets, ${rest}`.slice(0, 220),
    };
  });
}

/** The day's headlines of a story (first per outlet), cited as evidence of that day. */
export function dayReports(cluster: Cluster, byId: Map<string, Headline>, at: string) {
  const all = cluster.headlines.flatMap((id) => byId.get(id) ?? []);
  const date = cluster.last.slice(0, 10);
  const dayStart = `${date}T00:00:00Z`;
  const firstOf = new Map<string, Headline>();
  for (const h of [...all]
    .filter((x) => x.t.startsWith(date))
    .sort((a, b) => a.t.localeCompare(b.t)))
    if (!firstOf.has(h.outlet)) firstOf.set(h.outlet, h);
  const day = [...firstOf.values()];
  const idOf = (h: Headline) => `news:${h.outlet}:${h.id}`;
  const evidence: Evidence[] = day.map((h) => ({
    id: idOf(h),
    kind: "report",
    source: `outlet:${h.outlet}`,
    t: dayStart,
    precision: "day",
    label: `${name(h.outlet)}: ${h.title} (${h.t.slice(11, 16)} UTC)`,
    url: h.url,
    quote: h.title,
  }));
  const sources: Source[] = day.map((h) => ({
    id: `outlet:${h.outlet}`,
    name: name(h.outlet),
    url: outletById(h.outlet)?.homepage ?? h.url,
    license: "Headline and link only, quoted with attribution; © the outlet",
    attribution: name(h.outlet),
    retrievedAt: at,
  }));
  const coverage = day.map((h) => ({
    outlet: h.outlet,
    title: h.title,
    url: h.url,
    t: h.t,
    evidence: idOf(h),
  }));
  return { all, date, dayStart, day, evidence, sources, coverage, idOf };
}

/**
 * The news itself as one outlet reported it: "Russian strikes on Ukraine leave hundreds of
 * thousands without electricity, Al Jazeera reports." Questions are never the lead, and a
 * short label before a colon ("Ukraine: …", "Middle East live: …") is dropped.
 */
export function leadLine(
  day: Headline[],
  preferred?: string,
): { text: string; headline: Headline } | undefined {
  const usable = day.filter((h) => !/\?\s*$/.test(h.title));
  const h = usable.find((x) => x.title === preferred) ?? usable[0];
  // Only questions ("After the midterms, where does the Republican Party stand?"): the news is
  // the question an outlet asks, quoted as asked.
  const asked = day[0];
  if (!h && asked) return { text: `${name(asked.outlet)} asks: “${asked.title}”`, headline: asked };
  if (!h) return undefined;
  const statement = h.title
    .replace(/^[^:]{2,32}:\s+(?=\S)/, (m) => (m.split(/\s+/).length <= 5 ? "" : m))
    .replace(/[.!…\s]+$/, "");
  return { text: `${statement}, ${name(h.outlet)} reports.`, headline: h };
}

/** The lens a topic implies when no article says more. */
const TOPIC_LENS: Partial<Record<Topic, Lens>> = { conflict: "conflict" };

/** A film by the lens of the article the headlines name; undefined if that can't be made. */
export async function buildLensFilm(
  cluster: Cluster,
  byId: Map<string, Headline>,
  countries: Country[],
  at: string,
  clusters: Cluster[] = [],
): Promise<NowFilm | undefined> {
  const context = cluster.context;
  if (!context) return undefined;
  const r = dayReports(cluster, byId, at);
  if (!r.day.length) return undefined;
  const qid = (await fetchQids([context.title])).get(context.title);
  const entities = qid ? await fetchEntities([qid]) : new Map();
  const typeIds: string[] = qid ? (entities.get(qid)?.items.P31 ?? []) : [];
  const typeEntities = typeIds.length ? await fetchEntities(typeIds) : new Map();
  const labels = typeIds.map((t) => typeEntities.get(t)?.label ?? t);
  const lens: Lens = lensFromTypes(labels) ?? TOPIC_LENS[cluster.topic] ?? "general";
  const lead = leadLine(r.day, cluster.title);
  const place = cluster.place;
  // Where it happened, lately: the other stories from the same country or region.
  const country = place?.country ? countries.find((c) => c.code === place.country) : undefined;
  const area = country ? countryName(country) : place?.basis === "region" ? place.name : undefined;
  const lately = area
    ? latelyIn(cluster, byId, clusters, country, area, r, at)
    : { lately: [], extraEvidence: [], extraSources: [], extraChapters: [] };
  const story = {
    slug: cluster.id,
    lens,
    title: context.title,
    summary: lead?.headline.title ?? cluster.title,
    about: context.text,
    article: {
      title: context.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(context.title.replace(/ /g, "_"))}`,
      ...(qid ? { qid } : {}),
    },
    ...(place
      ? {
          place: {
            name: place.name,
            lon: place.lon,
            lat: place.lat,
            ...(place.country ? { country: place.country } : {}),
          },
        }
      : {}),
    heat: cluster.heat,
    sources: r.day.length,
    related: [],
    evidence: r.evidence.map((e) => e.id),
    coverage: r.coverage,
  } satisfies EditionStory;
  const film = await LENS_FILMS[lens]({
    date: r.date,
    story,
    evidence: [...r.evidence, ...lately.extraEvidence],
    news: [],
    countries,
    at,
    ...(lead ? { lead: { text: lead.text, cites: [r.idOf(lead.headline)] } } : {}),
    extraChapters: lately.extraChapters,
  });
  // The outlets' headlines and credits travel with the film, as in edition films, and the
  // closing line names them with the rest.
  for (const e of [...r.evidence, ...lately.extraEvidence])
    if (!film.evidence.some((x) => x.id === e.id)) film.evidence.push(e);
  for (const s of [...r.sources, ...lately.extraSources])
    if (!film.sources.some((x) => x.id === s.id)) film.sources.push(s);
  film.scene.beats = creditOutlets(film.scene.beats, [
    ...new Set([...r.day, ...lately.lately].map((h) => name(h.outlet))),
  ]);
  const dayLabel = film.scene.subtitle.split(" · ").at(-1) ?? r.date;
  return {
    ...film,
    scene: {
      ...film.scene,
      id: `now-${cluster.id}`,
      subtitle: `${LENS_INFO[lens].label} · Now · ${dayLabel}`,
    },
  };
}

/** Wikipedia's own title for a name (following redirects: "United States of America" → "United States"). */
async function canonicalTitle(title: string): Promise<string | undefined> {
  const json = (await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&redirects=1&format=json&formatversion=2`,
  )) as { query?: { pages?: { title: string; missing?: boolean }[] } };
  const page = json.query?.pages?.[0];
  return page && !page.missing ? page.title : undefined;
}

/**
 * "Lately in <place>": the other stories placed in the same country (or region) over the last
 * three days, newest first, one headline each. Earlier days are cited on the film's day with
 * their own date and time in the label, as edition films cite earlier days.
 */
function latelyIn(
  cluster: Cluster,
  byId: Map<string, Headline>,
  clusters: Cluster[],
  country: Country | undefined,
  label: string,
  r: ReturnType<typeof dayReports>,
  at: string,
) {
  const place = cluster.place;
  const iso = place?.country;
  const sameArea = (c: Cluster) =>
    !!place &&
    c.id !== cluster.id &&
    (iso ? c.place?.country === iso : c.place?.name === place.name);
  const lately = clusters
    .filter(sameArea)
    .flatMap((c) => {
      const h = c.headlines
        .map((id) => byId.get(id))
        .filter((x): x is Headline => !!x && !/\?\s*$/.test(x.title))
        .sort((x, y) => y.t.localeCompare(x.t))[0];
      return h ? [h] : [];
    })
    .sort((x, y) => y.t.localeCompare(x.t))
    .slice(0, 4);
  const when = (h: Headline) =>
    new Date(h.t).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  const extraEvidence: Evidence[] = lately.map((h) => ({
    id: r.idOf(h),
    kind: "report",
    source: `outlet:${h.outlet}`,
    t: r.dayStart,
    precision: "day",
    label: `${name(h.outlet)}: ${h.title} (${h.t.slice(0, 10)} ${h.t.slice(11, 16)} UTC)`,
    url: h.url,
    quote: h.title,
  }));
  const extraSources: Source[] = lately.map((h) => ({
    id: `outlet:${h.outlet}`,
    name: name(h.outlet),
    url: outletById(h.outlet)?.homepage ?? h.url,
    license: "Headline and link only, quoted with attribution; © the outlet",
    attribution: name(h.outlet),
    retrievedAt: at,
  }));
  const extraChapters: ChapterDraft[] = lately.length
    ? [
        {
          title: `Lately in ${label}`,
          seconds: 4 + lately.length * 6,
          shot: country
            ? {
                lon: country.label[0],
                lat: country.label[1],
                range: 3.6e6,
                pitch: -58,
                heading: -8,
              }
            : { lon: place?.lon ?? 0, lat: place?.lat ?? 0, range: 2.4e6, pitch: -58, heading: -8 },
          beats: lately.flatMap((h) => {
            const line = leadLine([h]);
            if (!line) return [];
            const text = h.t.startsWith(r.date)
              ? line.text
              : `${when(h)}: ${line.text.replace(/ reports\.$/, " reported.")}`;
            return [{ text, cites: [r.idOf(h)] }];
          }),
        },
      ]
    : [];

  return { lately, extraEvidence, extraSources, extraChapters };
}

/** Topics where a country's economy is not the frame (their films use the general lens). */
const NO_ECONOMY_TOPICS: ReadonlySet<Topic> = new Set(["sports", "culture"]);

/**
 * The film of a story no article explains but whose place is known (ADR-0020): the news as
 * reported, the week's reported events in that country (Current events), the other stories
 * reported from there that day, what the country is (Wikipedia, Wikidata) and, for politics,
 * business and conflict, its economy in World Bank charts.
 */
export async function buildPlaceFilm(
  cluster: Cluster,
  byId: Map<string, Headline>,
  clusters: Cluster[],
  countries: Country[],
  at: string,
): Promise<NowFilm | undefined> {
  const place = cluster.place;
  const iso = place?.country;
  const country = iso ? countries.find((c) => c.code === iso) : undefined;
  // A country, or a region the news names without one (Strait of Hormuz, Gaza Strip).
  const region = !country && place?.basis === "region" ? place.name : undefined;
  if (!place || (!country && !region)) return undefined;
  const r = dayReports(cluster, byId, at);
  if (!r.day.length) return undefined;
  const label = country ? countryName(country) : (region ?? place.name);
  const title = (await canonicalTitle(label)) ?? label;
  const qid = (await fetchQids([title])).get(title);
  const lead = leadLine(r.day, cluster.title);
  const others = r.day.filter((h) => h !== lead?.headline);
  const alsoBeats = others.length
    ? [
        {
          text: `Also reported by ${list(others.map((h) => name(h.outlet)))}.`,
          cites: others.map(r.idOf),
        },
      ]
    : [];

  const { lately, extraEvidence, extraSources, extraChapters } = latelyIn(
    cluster,
    byId,
    clusters,
    country,
    label,
    r,
    at,
  );

  // The country's numbers frame most news (charts); sports, culture and regions without a
  // country get the general lens.
  const lens: Lens = country && !NO_ECONOMY_TOPICS.has(cluster.topic) ? "economy" : "general";
  const story = {
    slug: cluster.id,
    lens,
    title: cluster.title,
    summary: lead?.headline.title ?? cluster.title,
    article: {
      title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      ...(qid ? { qid } : {}),
    },
    place: { name: place.name, lon: place.lon, lat: place.lat, ...(iso ? { country: iso } : {}) },
    heat: cluster.heat,
    sources: r.day.length,
    related: [],
    evidence: r.evidence.map((e) => e.id),
    coverage: r.coverage,
  } satisfies EditionStory;
  const film = await LENS_FILMS[lens]({
    date: r.date,
    story,
    evidence: [...r.evidence, ...extraEvidence],
    news: [],
    countries,
    at,
    background: label,
    ...(lead ? { lead: { text: lead.text, cites: [r.idOf(lead.headline)] } } : {}),
    alsoBeats,
    extraChapters,
  });
  for (const e of [...r.evidence, ...extraEvidence])
    if (!film.evidence.some((x) => x.id === e.id)) film.evidence.push(e);
  for (const src of [...r.sources, ...extraSources])
    if (!film.sources.some((x) => x.id === src.id)) film.sources.push(src);
  film.scene.beats = creditOutlets(film.scene.beats, [
    ...new Set([...r.day, ...lately].map((h) => name(h.outlet))),
  ]);
  const titleFrom = r.all.find((h) => h.title === cluster.title);
  const dayLabel = film.scene.subtitle.split(" · ").at(-1) ?? r.date;
  return {
    ...film,
    scene: {
      ...film.scene,
      id: `now-${cluster.id}`,
      subtitle: `${TOPIC_LABEL[cluster.topic]} · Now · ${dayLabel}${titleFrom ? ` · headline from ${name(titleFrom.outlet)}` : ""}`,
    },
  };
}

/** The short film of a story no article explains (or when the lens can't film it). */
export function buildNowFilm(
  cluster: Cluster,
  byId: Map<string, Headline>,
  at: string,
): NowFilm | undefined {
  const r = dayReports(cluster, byId, at);
  if (r.day.length < 2) return undefined;
  const { evidence, sources } = r;
  const ids = evidence.map((e) => e.id);
  const context = cluster.context;
  const contextId = context ? `wiki:context:${cluster.id}` : undefined;
  if (context && contextId) {
    evidence.push({
      id: contextId,
      kind: "report",
      source: "wikipedia-article",
      t: r.dayStart,
      precision: "day",
      label: `Wikipedia: ${context.title}`,
      url: context.url,
      quote: context.text,
    });
    sources.push({
      id: "wikipedia-article",
      name: "Wikipedia articles",
      url: "https://en.wikipedia.org/",
      license: "CC BY-SA 4.0; text quoted and adapted with attribution",
      attribution: "Wikipedia contributors",
      retrievedAt: at,
    });
  }

  const place = cluster.place;
  const home = place
    ? { lon: place.lon, lat: place.lat, range: place.basis === "country" ? 4.5e6 : 1.6e6 }
    : { lon: 10, lat: 25, range: 2.2e7 };
  const lead = leadLine(r.day, cluster.title);
  const others = r.day.filter((h) => h !== lead?.headline).map((h) => name(h.outlet));
  const opening: ChapterDraft["beats"] = [];
  if (lead) opening.push({ text: lead.text, cites: [r.idOf(lead.headline)] });
  if (others.length)
    opening.push({
      text: `Also reported by ${list(others)}.`,
      cites: r.day.filter((h) => h !== lead?.headline).map(r.idOf),
    });
  const chapters: ChapterDraft[] = [
    {
      title: "What happened",
      seconds: 4 + opening.length * 6,
      shot: { ...home, range: home.range * 1.4, pitch: -60 },
      beats: opening,
    },
  ];
  if (place) {
    const naming = r.day.filter((h) => h.title.includes(place.name.split(",")[0] ?? place.name));
    chapters.push({
      title: "Where",
      seconds: 8,
      shot: { ...home, pitch: -48, heading: -14 },
      beats: [
        {
          text: `On the map: ${place.name}, ${place.basis === "country" ? "the country" : "the place"} the headlines name.`,
          cites: (naming.length ? naming : r.day).map(r.idOf),
        },
      ],
    });
  }
  if (context && contextId) {
    chapters.push({
      title: "Background",
      seconds: 12,
      shot: { ...home, range: home.range * 1.8, pitch: -55, heading: 12 },
      beats: [{ text: context.text, cites: [contextId] }],
    });
  }
  chapters.push({
    title: "Sources",
    seconds: 7,
    shot: { ...home, range: home.range * 2.4, pitch: -70 },
    beats: [
      {
        text: `Sources: ${list([...r.day.map((h) => name(h.outlet)), ...(context ? ["Wikipedia"] : [])])}. Every caption links to the evidence it rests on.`,
        cites: [...ids, ...(contextId ? [contextId] : [])],
      },
    ],
  });

  const story = {
    slug: cluster.id,
    lens: "general",
    title: context?.title ?? cluster.title,
    summary: cluster.title,
    heat: cluster.heat,
    sources: r.day.length,
    related: [],
    evidence: ids,
    ...(place ? { place: { name: place.name, lon: place.lon, lat: place.lat } } : {}),
    coverage: r.coverage,
  } satisfies EditionStory;
  const scene = buildFilm({ date: r.date, story, chapters, layers: [], at });
  // A title that is one outlet's headline says whose it is.
  const titleFrom = context ? undefined : r.all.find((h) => h.title === cluster.title);
  const dayLabel = scene.subtitle.split(" · ").at(-1) ?? r.date;
  return {
    scene: {
      ...scene,
      id: `now-${cluster.id}`,
      subtitle: `${TOPIC_LABEL[cluster.topic]} · Now · ${dayLabel}${titleFrom ? ` · headline from ${name(titleFrom.outlet)}` : ""}`,
    },
    evidence,
    sources,
    layers: [],
  };
}

/** A film that will load: schema, cross-file rules and at least three chapters. */
function playable(film: NowFilm | undefined): NowFilm | undefined {
  if (!film || film.scene.chapters.length < 3 || !Scene.safeParse(film.scene).success)
    return undefined;
  const errors = validateBundle({
    scene: film.scene,
    evidence: film.evidence,
    sources: film.sources,
  });
  return errors.length ? undefined : film;
}

/**
 * The film of an edition story found by the outlets alone (ADR-0021): made the way a Now story
 * is, from the outlets' headlines of that day stored in the edition (so a rebuild days later
 * needs nothing else): the article's lens when the headlines name one, else the place's film,
 * else the short film.
 */
export async function buildOutletStoryFilm(
  story: EditionStory,
  date: string,
  countries: Country[],
  at: string,
): Promise<NowFilm | undefined> {
  const hs: Headline[] = (story.coverage ?? []).flatMap((c) => {
    const id = c.evidence.split(":")[2];
    return id ? [{ id, outlet: c.outlet, title: c.title, url: c.url, t: c.t, seen: c.t }] : [];
  });
  if (!hs.length) return undefined;
  const byId = new Map(hs.map((h) => [h.id, h]));
  const newest = [...hs].sort((a, b) => b.t.localeCompare(a.t));
  const p = story.place;
  const country = p?.country ? countries.find((c) => c.code === p.country) : undefined;
  const basis: ClusterPlace["basis"] = !country
    ? "region"
    : country.name === p?.name || countryName(country) === p?.name
      ? "country"
      : "city";
  const cluster: Cluster = {
    id: story.slug,
    title: story.title,
    headlines: newest.map((h) => h.id),
    outlets: [...new Set(newest.map((h) => h.outlet).reverse())],
    first: newest.at(-1)?.t ?? `${date}T00:00:00Z`,
    last: newest[0]?.t ?? `${date}T00:00:00Z`,
    topic: story.topic ?? LENS_TOPIC[story.lens],
    ...(p
      ? {
          place: {
            name: p.name,
            lon: p.lon,
            lat: p.lat,
            ...(p.country ? { country: p.country } : {}),
            basis,
          },
        }
      : {}),
    heat: story.heat,
    breaking: false,
    ...(story.article && story.about
      ? { context: { title: story.article.title, url: story.article.url, text: story.about } }
      : {}),
  };
  const attempt = async (make: () => Promise<NowFilm | undefined>) =>
    playable(await make().catch(() => undefined));
  const film =
    (await attempt(() => buildLensFilm(cluster, byId, countries, at))) ??
    (await attempt(() => buildPlaceFilm(cluster, byId, [], countries, at))) ??
    (await attempt(async () => buildNowFilm(cluster, byId, at)));
  if (!film) return undefined;
  return {
    ...film,
    scene: {
      ...film.scene,
      id: `story-${date}-${story.slug}`,
      subtitle: film.scene.subtitle.replace(" · Now", ""),
    },
  };
}
