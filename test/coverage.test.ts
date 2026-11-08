import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildEdition } from "../scripts/edition/build";
import { makeCoverage } from "../scripts/edition/coverage";
import { type Gazetteer, makePlacer } from "../scripts/news/place";
import { Headline } from "../src/scene/headlines";
import { Country, type Evidence, type NewsStory } from "../src/scene/schema";
import { validateBundle } from "../src/scene/validate";

const root = join(__dirname, "..");
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));
const countries = z.array(Country).parse(read("public/geo/countries.json"));
const placer = makePlacer(read("scripts/news/places.json") as Gazetteer, countries);
const headlines = z
  .object({ headlines: z.array(Headline) })
  .parse(read("test/fixtures/headlines-2026-11-08.json")).headlines;
const coverage = makeCoverage(headlines, "2026-11-06", placer);

describe("matching edition stories to outlets' headlines", () => {
  it("finds every outlet that reported a story that day, one headline each", () => {
    const hits = coverage.match([
      "Kenyan cult leader Paul Mackenzie is sentenced to 200 years in prison for the murder of 191 people in the Shakahola Forest.",
    ]);
    const outlets = hits.map((h) => h.outlet);
    expect(outlets).toEqual(expect.arrayContaining(["bbc", "allafrica"]));
    expect(new Set(outlets).size).toBe(outlets.length);
  });

  it("ignores headlines that only share a theme or a country", () => {
    expect(coverage.match(["Kenya opens a new railway line to Uganda."])).toEqual([]);
    expect(coverage.match(["A quiet day in Tanzania's parliament."])).toEqual([]);
  });

  it("only uses headlines published on the edition's day", () => {
    const krakow = ["A gunman kills six people in Krakow's main square, Poland."];
    // Reported on 7 November (DW); not on the 6th.
    expect(coverage.match(krakow)).toEqual([]);
    const seventh = makeCoverage(headlines, "2026-11-07", placer).match(krakow);
    expect(seventh.map((h) => h.outlet)).toContain("dw");
    expect(seventh.every((h) => h.t.startsWith("2026-11-07"))).toBe(true);
  });
});

describe("the edition builder with coverage", () => {
  // A news-only story from 6 Nov, with the outlets' headlines of that day.
  const story: NewsStory = {
    id: "wiki:2026-11-06:1",
    text: "Kenyan cult leader Paul Mackenzie is sentenced to 200 years in prison for the murder of 191 people.",
    category: "law",
    evidence: "wiki:2026-11-06:1",
    lon: 39.8,
    lat: -3.5,
  } as NewsStory;
  const evidence: Evidence = {
    id: "wiki:2026-11-06:1",
    kind: "report",
    source: "wikipedia",
    t: "2026-11-06T00:00:00Z",
    precision: "day",
    label: "Law and crime: Kenyan cult leader sentenced",
    url: "https://en.wikipedia.org/wiki/Portal:Current_events/2026_November_6",
    quote: story.text,
  };
  const built = buildEdition({
    date: "2026-11-06",
    generatedAt: "2026-11-07T11:00:00Z",
    mostRead: [],
    news: {
      raw: [{ heading: "Law and crime", text: story.text, links: [], sources: [] }],
      stories: [story],
      evidence: [evidence],
    } as never,
    qids: new Map(),
    entities: new Map(),
    links: new Map(),
    countries,
    coverage,
  });
  const s = built.edition.stories[0];

  it("lists the outlets and cites each headline as report evidence", () => {
    expect(s?.coverage?.map((c) => c.outlet)).toEqual(expect.arrayContaining(["bbc", "allafrica"]));
    for (const c of s?.coverage ?? []) {
      expect(s?.evidence).toContain(c.evidence);
      const e = built.evidence.find((x) => x.id === c.evidence);
      expect(e).toMatchObject({ kind: "report", quote: c.title, url: c.url });
    }
  });

  it("credits each outlet as a source, and the bundle validates", () => {
    expect(built.sources.map((x) => x.id)).toEqual(
      expect.arrayContaining(["outlet:bbc", "outlet:allafrica"]),
    );
    const errors = validateBundle({
      scene: {
        version: 1,
        id: "edition-2026-11-06",
        title: "2026-11-06",
        subtitle: "",
        category: "daily",
        window: { start: "2026-11-06T00:00:00Z", end: "2026-11-06T23:59:59Z" },
        focus: "2026-11-06T12:00:00Z",
        timezone: "UTC",
        region: { west: -180, south: -90, east: 180, north: 90 },
        imagery: { day: "2026-11-06", nights: [] },
        layers: [],
        camera: [{ t: "2026-11-06T00:00:00Z", lon: 0, lat: 0, range: 2e7, heading: 0, pitch: -90 }],
        pacing: [],
        beats: built.edition.stories.map((x) => ({
          t: "2026-11-06T00:00:00Z",
          text: x.title,
          cites: x.evidence,
        })),
        time: "real",
        chapters: [],
        panels: [],
        generatedBy: { method: "template", at: "2026-11-07T11:00:00Z" },
      },
      evidence: built.evidence,
      sources: built.sources,
    });
    expect(errors).toEqual([]);
  });
});
