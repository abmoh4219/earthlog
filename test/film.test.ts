import { describe, expect, it } from "vitest";
import { buildFilm } from "../scripts/lenses/film.ts";
import type { EditionStory } from "../src/scene/edition.ts";
import type { Evidence, Source } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";

const story: EditionStory = {
  slug: "test-story",
  lens: "general",
  title: "A test story",
  summary: "Something happened.",
  place: { name: "Somewhere", lon: 10, lat: 20 },
  heat: 100,
  sources: 1,
  related: [],
  evidence: ["wiki:2026-11-03:1"],
};
const evidence: Evidence[] = [
  {
    id: "wiki:2026-11-03:1",
    kind: "report",
    source: "wikipedia",
    t: "2026-11-03T00:00:00Z",
    precision: "day",
    label: "News",
    quote: "Something happened.",
    url: "https://en.wikipedia.org/",
  },
  {
    id: "wd:Q1:P585",
    kind: "sensor",
    source: "wikipedia",
    t: "2026-11-03T00:00:00Z",
    label: "Date",
  },
];
const sources: Source[] = [
  {
    id: "wikipedia",
    name: "Wikipedia",
    url: "https://en.wikipedia.org/",
    license: "CC BY-SA 4.0",
    attribution: "Wikipedia contributors",
    retrievedAt: "2026-11-04T00:00:00Z",
  },
];
const shot = { lon: 10, lat: 20, range: 2e6 };

const film = buildFilm({
  date: "2026-11-03",
  story,
  at: "2026-11-04T00:00:00Z",
  layers: [{ kind: "places", places: [{ name: "Somewhere", lon: 10, lat: 20, primary: true }] }],
  chapters: [
    {
      title: "The story",
      seconds: 8,
      shot,
      beats: [{ text: "Something happened.", cites: ["wiki:2026-11-03:1"] }],
    },
    {
      title: "On record",
      seconds: 10,
      shot,
      beats: [
        { text: "Date: 3 November.", cites: ["wd:Q1:P585"] },
        { text: "A second caption.", cites: ["wd:Q1:P585"] },
      ],
      panels: [
        {
          id: "facts",
          kind: "facts",
          title: "Facts",
          items: [{ label: "Date", text: "3 November", cites: ["wd:Q1:P585"] }],
        },
      ],
      reveal: ["places"],
    },
  ],
});

describe("buildFilm", () => {
  it("lays chapters end to end in story time, one scene second per wall second", () => {
    expect(film.time).toBe("story");
    expect(film.window).toEqual({ start: "2026-11-03T00:00:00Z", end: "2026-11-03T00:00:18Z" });
    expect(film.chapters.map((c) => c.t)).toEqual(["2026-11-03T00:00:00Z", "2026-11-03T00:00:08Z"]);
    expect(film.pacing).toEqual([{ t: "2026-11-03T00:00:00Z", speed: 1 }]);
  });

  it("places captions inside their chapter and panels across it", () => {
    expect(film.beats.map((b) => b.t)).toEqual([
      "2026-11-03T00:00:00Z",
      "2026-11-03T00:00:08Z",
      "2026-11-03T00:00:13Z",
    ]);
    expect(film.panels[0]).toMatchObject({
      t: "2026-11-03T00:00:09Z",
      until: "2026-11-03T00:00:18Z",
    });
  });

  it("reveals layers from the chapter that asks for them", () => {
    expect(film.layers).toEqual([
      { kind: "places", file: "data/places.json", from: "2026-11-03T00:00:08Z" },
    ]);
  });

  it("keeps camera keyframes strictly increasing", () => {
    const times = film.camera.map((k) => Date.parse(k.t));
    expect(times.every((t, i) => i === 0 || t > (times[i - 1] ?? 0))).toBe(true);
  });

  it("passes the validator", () => {
    expect(validateBundle({ scene: film, evidence, sources })).toEqual([]);
  });

  it("is rejected when a panel cites unknown evidence", () => {
    const bad = {
      ...film,
      panels: [
        {
          id: "x",
          kind: "facts" as const,
          t: "2026-11-03T00:00:09Z",
          title: "X",
          items: [{ label: "Y", text: "Z", cites: ["wd:Q9:P1"] }],
        },
      ],
    };
    expect(validateBundle({ scene: bad, evidence, sources }).join()).toMatch(
      /panel "x": cites unknown evidence/,
    );
  });

  it("is rejected when chapters are out of order", () => {
    const bad = { ...film, chapters: [...film.chapters].reverse() };
    expect(validateBundle({ scene: bad, evidence, sources }).join()).toMatch(
      /chapter 2: out of order/,
    );
  });
});
