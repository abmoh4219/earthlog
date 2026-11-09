import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseLiveEvents, parseLiveQuakes } from "../scripts/live";
import type { Cluster } from "../src/scene/headlines";
import type { LiveFile } from "../src/scene/live";
import type { NowStory } from "../src/scene/now";
import { countryPulse, pulseIsQuiet, surprise } from "../src/scene/pulse";
import { Country } from "../src/scene/schema";

const countries = z
  .array(Country)
  .parse(JSON.parse(readFileSync(join(__dirname, "..", "public/geo/countries.json"), "utf8")));
const byCode = (code: string) => {
  const c = countries.find((x) => x.code === code);
  if (!c) throw new Error(code);
  return c;
};

// Shapes as the feeds returned them on 9 November 2026 (trimmed).
const usgsDay = {
  features: [
    {
      id: "us7000tx1f",
      properties: {
        mag: 5.7,
        place: "106 km ENE of Hasaki, Japan",
        time: 1794199971000,
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000tx1f",
      },
      geometry: { coordinates: [141.8299, 36.2471, 24.173] },
    },
    {
      id: "nomag",
      properties: { mag: null, place: null, time: 1794199971000, url: "https://example.org/x" },
      geometry: { coordinates: [0, 0, 10] },
    },
  ],
};
const usgsWeek = {
  features: [
    {
      id: "us7000tx16",
      properties: {
        mag: 6.4,
        place: "30 km WSW of Lata, Solomon Islands",
        time: 1794195299000,
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000tx16",
      },
      geometry: { coordinates: [165.5616, -10.8669, 17] },
    },
    usgsDay.features[0],
  ],
};
const eonet = {
  events: [
    {
      id: "EONET_25728",
      title: "Super Typhoon In-fa",
      link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_25728",
      categories: [{ id: "severeStorms" }],
      sources: [{ id: "JTWC" }],
      geometry: [
        {
          date: "2026-11-04T18:00:00Z",
          type: "Point",
          coordinates: [140, 27],
          magnitudeValue: 90,
          magnitudeUnit: "kts",
        },
        {
          date: "2026-11-05T06:00:00Z",
          type: "Point",
          coordinates: [141.5, 29.4],
          magnitudeValue: 60,
          magnitudeUnit: "kts",
        },
      ],
    },
    {
      id: "EONET_ICE",
      title: "Iceberg A23A",
      link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_ICE",
      categories: [{ id: "seaLakeIce" }],
      sources: [],
      geometry: [{ date: "2026-11-01T00:00:00Z", type: "Point", coordinates: [-40, -60] }],
    },
  ],
};

describe("the living Earth feeds", () => {
  it("keeps quakes with a magnitude, once each, strongest first", () => {
    const q = parseLiveQuakes([usgsDay, usgsWeek]);
    expect(q.map((x) => x.id)).toEqual(["us7000tx16", "us7000tx1f"]);
    expect(q[1]).toMatchObject({ mag: 5.7, depthKm: 24.173, t: "2026-11-09T04:52:51Z" });
  });

  it("keeps storms, wildfires and volcanoes at their latest fix, with the agency's size", () => {
    const e = parseLiveEvents(eonet);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({
      kind: "storm",
      lon: 141.5,
      lat: 29.4,
      t: "2026-11-05T06:00:00Z",
      size: "60 kts",
      agency: "JTWC",
    });
  });
});

const story = (id: string, country?: string, nowFilm = false): NowStory => ({
  cluster: {
    id,
    title: `Story ${id}`,
    headlines: [id],
    outlets: ["bbc", "dw"],
    first: "2026-11-09T01:00:00Z",
    last: "2026-11-09T02:00:00Z",
    topic: "world",
    heat: 50,
    breaking: false,
    nowFilm,
    ...(country ? { place: { name: "x", lon: 0, lat: 0, country, basis: "country" } } : {}),
  } as Cluster,
  headlines: [],
  outlets: ["bbc", "dw"],
  heat: 50,
  breaking: false,
});

describe("a country's pulse", () => {
  const live: LiveFile = {
    version: 1,
    generatedAt: "2026-11-09T05:00:00Z",
    quakes: parseLiveQuakes([usgsWeek]),
    events: parseLiveEvents(eonet),
    sources: [],
  };

  it("gathers the country's news, its offshore earthquakes and its films", () => {
    const p = countryPulse(
      byCode("JP"),
      [story("a", "JP"), story("b", "FR")],
      live,
      [
        { date: "2026-11-08", slug: "quake", title: "Japan quake", country: "JP" },
        { date: "2026-11-08", slug: "other", title: "Elsewhere", country: "PL" },
      ],
      countries,
    );
    expect(p.news.map((s) => s.cluster.id)).toEqual(["a"]);
    // 106 km off Hasaki, at sea: named Japan by USGS.
    expect(p.quakes.map((q) => q.id)).toEqual(["us7000tx1f"]);
    expect(p.films.map((f) => f.slug)).toEqual(["quake"]);
    expect(pulseIsQuiet(p)).toBe(false);
  });

  it("says so when nothing is happening there", () => {
    expect(pulseIsQuiet(countryPulse(byCode("IS"), [], live, [], countries))).toBe(true);
  });
});

describe("surprise me", () => {
  const items = [
    { id: "a", heat: 0 },
    { id: "b", heat: 98 },
    { id: "c", heat: 0 },
  ];
  it("prefers hotter stories, never repeats the one shown", () => {
    expect(surprise(items, 0.5)?.id).toBe("b");
    expect(surprise(items, 0.5, "b")?.id).not.toBe("b");
    expect(surprise([], 0.3)).toBeUndefined();
  });
});
