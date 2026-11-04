// The daily replay, against responses recorded on 2026-11-04 for 3 Nov 2026. No network.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseStorms } from "../scripts/bake/eonet.ts";
import { parseOutageEvents } from "../scripts/bake/ioda.ts";
import { parseCoordinates, parsePortal, portalTitle, toStories } from "../scripts/bake/wikinews.ts";
import { dailyScene, pickStories, shorten } from "../scripts/director/daily.ts";
import { stormAt } from "../src/scene/layers.ts";
import { Country, type NewsStory, type Source, type Storm } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";

const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const fixture = (name: string) => read(join(import.meta.dirname, "fixtures", name));
const countries = z
  .array(Country)
  .parse(read(join(import.meta.dirname, "..", "public", "geo", "countries.json")));

const DATE = "2026-11-03";
const wikitext = z
  .object({ parse: z.object({ wikitext: z.string() }) })
  .parse(fixture("wikipedia-current-events-2026-11-03.json")).parse.wikitext;
const raw = parsePortal(wikitext);
const coords = parseCoordinates(fixture("wikipedia-coordinates-2026-11-03.json"));
const { stories, evidence: newsEvidence } = toStories(DATE, raw, coords, countries, 1);

describe("Wikipedia Current events baker", () => {
  it("names the portal page for a date", () => {
    expect(portalTitle(DATE)).toBe("Portal:Current_events/2026_November_3");
  });

  it("parses every sourced item with its heading, topic and outlets", () => {
    expect(raw).toHaveLength(14);
    const projection = raw.find((r) => r.text.startsWith("U.S. news organizations project"));
    expect(projection?.heading).toBe("Politics and elections");
    expect(projection?.topic).toBe("2026 United States elections");
    expect(projection?.sources.map((s) => s.name)).toEqual(["Reuters", "The Guardian"]);
    expect(projection?.text).not.toMatch(/\[\[|''|https?:/);
  });

  it("places each story at its most specific linked place", () => {
    const place = (start: string) => stories.find((s) => s.text.startsWith(start))?.place?.name;
    expect(place("A commercial vessel")).toBe("Musandam Governorate");
    expect(place("Unidentified attackers")).toBe("Zamfara State");
    expect(place("Two helicopters")).toBe("Solukhumbu District");
  });

  it("matches country links through aliases and keeps the story's wording", () => {
    const art = stories.find((s) => s.text.startsWith("Spanish author"));
    expect(art?.place).toMatchObject({ name: "Spain", country: true });
  });

  it("lets a placeless story inherit its running topic's place", () => {
    const held = stories.find((s) => s.text.startsWith("The United States holds"));
    const projection = stories.find((s) => s.text.startsWith("U.S. news organizations"));
    expect(projection?.place).toEqual(held?.place);
  });

  it("emits report evidence with date precision, the quote and the outlets", () => {
    const e = newsEvidence[0];
    expect(e).toMatchObject({ kind: "report", precision: "day", t: "2026-11-03T00:00:00Z" });
    expect(e?.quote).toBe(stories[0]?.text);
    expect(e?.links?.[0]?.name).toBe("Reuters");
  });
});

describe("EONET baker", () => {
  const { storms, evidence } = parseStorms(
    fixture("eonet-2026-11-03.json"),
    "2026-11-03T00:00:00Z",
    "2026-11-04T00:00:00Z",
  );
  it("keeps storm fixes from a day before to six hours after the window", () => {
    const infa = storms.find((s) => s.name === "Super Typhoon In-fa");
    expect(infa?.track.length).toBeGreaterThan(4);
    expect(
      infa?.track.every((f) => f.t >= "2026-11-02T00:00:00Z" && f.t <= "2026-11-04T06:00:00Z"),
    ).toBe(true);
    expect(evidence.every((e) => e.source === "eonet" && e.kind === "sensor")).toBe(true);
  });
});

describe("stormAt", () => {
  const storm: Storm = {
    id: "s",
    name: "Test",
    track: [
      { t: "2026-11-03T00:00:00Z", lon: 179, lat: 10, windKt: 50, evidence: "eonet:s:0" },
      { t: "2026-11-03T06:00:00Z", lon: -179, lat: 12, windKt: 60, evidence: "eonet:s:6" },
    ],
  };
  it("interpolates between fixes, the short way across the antimeridian", () => {
    const at = stormAt(storm, Date.parse("2026-11-03T03:00:00Z"));
    expect(at?.interpolated).toBe(true);
    expect(Math.abs(at?.lon ?? 0)).toBeCloseTo(180, 5);
    expect(at?.lat).toBeCloseTo(11);
  });
  it("is null outside the track", () => {
    expect(stormAt(storm, Date.parse("2026-11-03T07:00:00Z"))).toBeNull();
  });
});

describe("IODA outage events", () => {
  it("keeps countries whose events start in the window, strongest first", () => {
    const from = Date.parse("2026-11-03T00:00:00Z") / 1000;
    const c = parseOutageEvents(fixture("ioda-outage-events-2026-11-03.json"), from, from + 86_400);
    expect(c.map((x) => x.code)).not.toContain("KW"); // a two-week event that began in October
    expect(c.every((x, i) => i === 0 || (c[i - 1]?.score ?? 0) >= x.score)).toBe(true);
  });
});

describe("daily director", () => {
  it("gives every category a turn before any gets two", () => {
    const s = (id: string, category: string): NewsStory => ({
      id,
      category,
      text: id,
      evidence: `wiki:x:${id}`,
    });
    const picked = pickStories(
      [s("a", "law"), s("b", "law"), s("c", "politics"), s("d", "sports")],
      3,
    );
    expect(picked.map((p) => p.id)).toEqual(["c", "d", "a"]);
  });

  it("shortens at a clause boundary and marks the cut", () => {
    const out = shorten("One, two three four five six, seven eight nine ten eleven", 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
  });

  it("writes a valid scene: news without clock times, sensors with them", () => {
    const sources: Source[] = [
      {
        id: "wikipedia",
        name: "Wikipedia",
        url: "https://en.wikipedia.org/",
        license: "CC BY-SA 4.0",
        attribution: "Wikipedia contributors",
        retrievedAt: "2026-11-04T00:00:00Z",
      },
      {
        id: "eonet",
        name: "EONET",
        url: "https://eonet.gsfc.nasa.gov/",
        license: "NASA",
        attribution: "NASA EONET",
        retrievedAt: "2026-11-04T00:00:00Z",
      },
    ];
    const storms = parseStorms(
      fixture("eonet-2026-11-03.json"),
      "2026-11-03T00:00:00Z",
      "2026-11-04T00:00:00Z",
    );
    const evidence = [...newsEvidence, ...storms.evidence];
    const scene = dailyScene(
      DATE,
      evidence,
      [
        { kind: "news", date: DATE, stories },
        { kind: "storms", storms: storms.storms },
      ],
      "2026-11-04T00:00:00Z",
    );
    expect(validateBundle({ scene, evidence, sources })).toEqual([]);
    const newsBeats = scene.beats.filter((b) => b.cites.some((c) => c.startsWith("wiki:")));
    const sensorBeats = scene.beats.filter((b) => b.cites.some((c) => c.startsWith("eonet:")));
    expect(newsBeats.length).toBeGreaterThanOrEqual(5);
    expect(newsBeats.every((b) => !/\d\d:\d\d UTC/.test(b.text))).toBe(true);
    expect(sensorBeats.every((b) => /^\d\d:\d\d UTC\./.test(b.text))).toBe(true);
    expect(new Set(newsBeats.map((b) => b.text.split(":")[0])).size).toBeGreaterThanOrEqual(5);
  });
});
