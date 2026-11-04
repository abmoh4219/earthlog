// Bakers against recorded responses (test/fixtures, recorded 2026-11-04). No network.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EventDef } from "../events/types.ts";
import { reduceCountries } from "../scripts/bake/countries.ts";
import {
  baselined,
  baselineId,
  evidenceId,
  parseIoda,
  signalEvidence,
  toSeries,
} from "../scripts/bake/ioda.ts";
import { maxAgeMs } from "../scripts/bake/lib.ts";
import { parseQuakes } from "../scripts/bake/usgs.ts";
import { templateScene } from "../scripts/director/template.ts";
import type { SignalLayer, Source } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"));

const unix = (iso: string) => Date.parse(iso) / 1000;

describe("IODA baker", () => {
  const raw = fixture("ioda-es-ping-2025-04.json");
  const signal = parseIoda(raw, "ping-slash24");

  it("parses the recorded response", () => {
    expect(signal.entityCode).toBe("ES");
    expect(signal.step).toBe(600);
    expect(signal.values.length).toBeGreaterThan(2000);
  });

  it("refuses a signal the response doesn't contain", () => {
    expect(() => parseIoda(raw, "gtr-norm")).toThrow(/no "gtr-norm"/);
  });

  it("compares each sample with the same time on the same weekday in earlier weeks", () => {
    const start = unix("2025-04-28T10:00:00Z");
    const b = baselined(signal, start, unix("2025-04-28T11:00:00Z"));
    expect(b.ratio).toHaveLength(6);
    const at = (t: number) => signal.values[(t - signal.from) / signal.step] ?? NaN;
    const week = 7 * 86_400;
    // Only two earlier Mondays are in the fixture; the median of two is their mean.
    const expected = (at(start - week) + at(start - 2 * week)) / 2;
    expect(b.baseline[0]).toBeCloseTo(expected, 6);
    expect(b.ratio[0]).toBeGreaterThan(0.95); // 12:00 CEST, before the blackout
    expect(b.ratio[4]).toBeLessThan(0.45); // 12:40 CEST, after it
  });

  it("emits one baseline item and one sensor item per sample", () => {
    const b = baselined(signal, unix("2025-04-28T10:00:00Z"), unix("2025-04-28T11:00:00Z"));
    const ev = signalEvidence("ES", "Spain", "ping-slash24", b, "2025-04-28T10:00:00Z");
    expect(ev).toHaveLength(7);
    expect(ev[0]?.id).toBe(baselineId("ES", "ping-slash24"));
    expect(ev[1]?.id).toBe(evidenceId("ES", "ping-slash24", "2025-04-28T10:00:00Z"));
    expect(ev[1]?.label).toMatch(/^Spain: responsive address blocks [\d,]+ vs normal/);
    expect(ev.every((e) => e.kind !== "report")).toBe(true);
  });
});

describe("template director on recorded data", () => {
  it("writes a scene that passes the validator, every sentence cited", () => {
    const def: EventDef = {
      id: "test-es",
      title: "Test",
      subtitle: "",
      category: "infrastructure",
      listed: false,
      window: { start: "2025-04-28T09:30:00Z", end: "2025-04-28T12:00:00Z" },
      focus: "2025-04-28T10:30:00Z",
      timezone: "Europe/Madrid",
      region: { west: -12, south: 34, east: 6, north: 46 },
      focusPoint: { lon: -4, lat: 40 },
      imagery: { day: "2025-04-28", nights: [] },
    };
    const signal = parseIoda(fixture("ioda-es-ping-2025-04.json"), "ping-slash24");
    const b = baselined(signal, unix(def.window.start), unix(def.window.end));
    const evidence = signalEvidence("ES", "Spain", "ping-slash24", b, def.window.start);
    const layer: SignalLayer = {
      kind: "outages",
      signal: "ping-slash24",
      label: "Responsive address blocks",
      tone: "loss",
      baseline: "test",
      series: [toSeries("ES", "Spain", b)],
    };
    const source: Source = {
      id: "ioda",
      name: "IODA",
      url: "https://ioda.inetintel.cc.gatech.edu/",
      license: "test",
      attribution: "IODA",
      retrievedAt: "2026-11-04T00:00:00Z",
    };
    const scene = templateScene(def, evidence, [layer], "2026-11-04T00:00:00Z");
    expect(validateBundle({ scene, evidence, sources: [source] })).toEqual([]);
    expect(scene.beats.map((x) => x.text).join(" ")).toMatch(/fall from 100% to \d+% of normal/);
  });
});

describe("USGS baker", () => {
  it("turns features into quakes and evidence", () => {
    const { quakes, evidence } = parseQuakes(fixture("usgs-myanmar-2025-03-28.json"));
    expect(quakes).toHaveLength(3);
    expect(quakes[0]).toMatchObject({ id: "us7000pn9s", mag: 7.7, t: "2025-03-28T06:20:52Z" });
    expect(evidence[0]).toMatchObject({ id: "usgs:us7000pn9s", kind: "sensor", value: 7.7 });
  });
});

describe("Natural Earth baker", () => {
  const countries = reduceCountries(fixture("natural-earth-3.json"));
  it("uses ISO_A2_EH (France is -99 in ISO_A2) and skips areas without a code", () => {
    expect(countries.map((c) => c.code)).toEqual(["ES", "FR"]);
  });
  it("keeps outer rings as flat, rounded lon/lat pairs", () => {
    const spain = countries.find((c) => c.code === "ES");
    const ring = spain?.rings[0] ?? [];
    expect(ring.length % 2).toBe(0);
    expect(ring.every((x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9)).toBe(true);
  });
});

describe("cache freshness", () => {
  const now = Date.parse("2026-11-05T02:00:00Z");
  it("expires answers about now and keeps the rest", () => {
    expect(
      maxAgeMs(
        "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&titles=X",
        now,
      ),
    ).toBe(3 * 3_600_000);
    expect(
      maxAgeMs(
        "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvstart=2026-11-01&titles=X",
        now,
      ),
    ).toBe(Number.POSITIVE_INFINITY);
    expect(maxAgeMs("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1", now)).toBe(
      24 * 3_600_000,
    );
    const views = (d: string) =>
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/X/daily/${d}/${d}`;
    expect(maxAgeMs(views("20261104"), now)).toBe(6 * 3_600_000);
    expect(maxAgeMs(views("20261001"), now)).toBe(Number.POSITIVE_INFINITY);
    expect(maxAgeMs("https://tigerweb.geo.census.gov/arcgis/rest/services/x", now)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
