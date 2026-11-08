// Films for the stories of "Now" (ADR-0020), every caption cited, no AI.
// - A story whose headlines name a Wikipedia article (ADR-0019) is filmed by the lens of that
//   article's kind, typed through Wikidata like an edition story: a person's life, a conflict's
//   week and figures, a company's numbers, an accident site; it opens on the news itself.
// - Otherwise a short film: the news as reported, where, each outlet's headline, the sources.
// Built in story time like edition films. The film's day is the day of its latest headline;
// only that day's headlines are quoted, cited at day precision with the exact time in the label.
import { type EditionStory, LENS_INFO, type Lens } from "../../src/scene/edition.ts";
import type { Cluster, Headline } from "../../src/scene/headlines.ts";
import { outletById } from "../../src/scene/outlets.ts";
import type { Country, Evidence, LayerData, Scene, Source } from "../../src/scene/schema.ts";
import { TOPIC_LABEL, type Topic } from "../../src/scene/topics.ts";
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
    evidence: r.evidence,
    news: [],
    countries,
    at,
    ...(lead ? { lead: { text: lead.text, cites: [r.idOf(lead.headline)] } } : {}),
  });
  // The outlets' headlines and credits travel with the film, as in edition films, and the
  // closing line names them with the rest.
  for (const e of r.evidence) if (!film.evidence.some((x) => x.id === e.id)) film.evidence.push(e);
  for (const s of r.sources) if (!film.sources.some((x) => x.id === s.id)) film.sources.push(s);
  const outletNames = list(r.day.map((h) => name(h.outlet)));
  film.scene.beats = film.scene.beats.map((b) =>
    b.text.startsWith("Sources: ")
      ? { ...b, text: b.text.replace(/^Sources: /, `Sources: ${outletNames}, `) }
      : b,
  );
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
