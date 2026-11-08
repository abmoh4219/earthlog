// A short film for a "Now" story (ADR-0020): what the outlets reported, where, and the
// background, every caption cited, no AI. Pure. Built in story time like edition films; the
// film's day is the day of its latest headline, and only that day's headlines are quoted
// (cited at day precision, the exact time kept in the label), so every citation falls in the
// film's window.
import type { EditionStory } from "../../src/scene/edition.ts";
import type { Cluster, Headline } from "../../src/scene/headlines.ts";
import { outletById } from "../../src/scene/outlets.ts";
import type { Evidence, Scene, Source } from "../../src/scene/schema.ts";
import { TOPIC_LABEL } from "../../src/scene/topics.ts";
import { buildFilm, type ChapterDraft } from "../lenses/film.ts";

export interface NowFilm {
  scene: Scene;
  evidence: Evidence[];
  sources: Source[];
}

const name = (id: string) => outletById(id)?.name ?? id;
const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

export function buildNowFilm(
  cluster: Cluster,
  byId: Map<string, Headline>,
  at: string,
): NowFilm | undefined {
  const all = cluster.headlines.flatMap((id) => byId.get(id) ?? []);
  const date = cluster.last.slice(0, 10);
  const dayStart = `${date}T00:00:00Z`;
  // That day's headlines, the first of each outlet.
  const firstOf = new Map<string, Headline>();
  for (const h of [...all]
    .filter((x) => x.t.startsWith(date))
    .sort((a, b) => a.t.localeCompare(b.t)))
    if (!firstOf.has(h.outlet)) firstOf.set(h.outlet, h);
  const day = [...firstOf.values()];
  if (day.length < 2) return undefined;

  const evidence: Evidence[] = day.map((h) => ({
    id: `news:${h.outlet}:${h.id}`,
    kind: "report",
    source: `outlet:${h.outlet}`,
    t: dayStart,
    precision: "day",
    label: `${name(h.outlet)}: ${h.title} (${h.t.slice(11, 16)} UTC)`,
    url: h.url,
    quote: h.title,
  }));
  const ids = evidence.map((e) => e.id);
  const sources: Source[] = day.map((h) => ({
    id: `outlet:${h.outlet}`,
    name: name(h.outlet),
    url: outletById(h.outlet)?.homepage ?? h.url,
    license: "Headline and link only, quoted with attribution; © the outlet",
    attribution: name(h.outlet),
    retrievedAt: at,
  }));

  const context = cluster.context;
  const contextId = context ? `wiki:context:${cluster.id}` : undefined;
  if (context && contextId) {
    evidence.push({
      id: contextId,
      kind: "report",
      source: "wikipedia-article",
      t: dayStart,
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
  const outlets = day.map((h) => name(h.outlet));
  const chapters: ChapterDraft[] = [
    {
      title: "What was reported",
      seconds: 10,
      shot: { ...home, range: home.range * 1.4, pitch: -60 },
      beats: [
        {
          text: `${day.length} outlets reported this on ${new Date(dayStart).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}: ${list(outlets)}.`,
          cites: ids,
        },
      ],
    },
  ];
  if (place) {
    const naming = day.filter((h) => h.title.includes(place.name.split(",")[0] ?? place.name));
    chapters.push({
      title: "Where",
      seconds: 8,
      shot: { ...home, pitch: -48, heading: -14 },
      beats: [
        {
          text: `On the map: ${place.name}, ${place.basis === "country" ? "the country" : "the place"} the headlines name.`,
          cites: (naming.length ? naming : day).map((h) => `news:${h.outlet}:${h.id}`),
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
        text: `Sources: ${list([...outlets, ...(context ? ["Wikipedia"] : [])])}. Every caption links to the evidence it rests on.`,
        cites: [...ids, ...(contextId ? [contextId] : [])],
      },
    ],
  });

  // The film reads its story like an edition story; "In the news" quotes each outlet.
  const story = {
    slug: cluster.id,
    lens: "general",
    title: context?.title ?? cluster.title,
    summary: cluster.title,
    heat: cluster.heat,
    sources: day.length,
    related: [],
    evidence: ids,
    ...(place ? { place: { name: place.name, lon: place.lon, lat: place.lat } } : {}),
    coverage: day.map((h) => ({
      outlet: h.outlet,
      title: h.title,
      url: h.url,
      t: h.t,
      evidence: `news:${h.outlet}:${h.id}`,
    })),
  } satisfies EditionStory;
  const scene = buildFilm({ date, story, chapters, layers: [], at });
  // A title that is one outlet's headline says whose it is.
  const lead = context ? undefined : all.find((h) => h.title === cluster.title);
  const dayLabel = scene.subtitle.split(" · ").at(-1) ?? date;
  return {
    scene: {
      ...scene,
      id: `now-${cluster.id}`,
      subtitle: `${TOPIC_LABEL[cluster.topic]} · Now · ${dayLabel}${lead ? ` · headline from ${name(lead.outlet)}` : ""}`,
    },
    evidence,
    sources,
  };
}
