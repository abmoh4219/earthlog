import { describe, expect, it } from "vitest";
import type { Evidence, Scene, Source } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";

const source: Source = {
  id: "ioda",
  name: "IODA",
  url: "https://ioda.inetintel.cc.gatech.edu/",
  license: "Copyright Georgia Tech Research Corporation",
  attribution: "IODA, Georgia Tech",
  retrievedAt: "2026-11-04T12:00:00Z",
};

const first: Evidence = {
  id: "ioda:ES:ping:2025-04-28T10:40Z",
  kind: "sensor",
  source: "ioda",
  t: "2025-04-28T10:40:00Z",
  label: "Spain: 37% of baseline",
};
const evidence: Evidence[] = [
  first,
  {
    id: "ioda:ES:ping:2025-04-28T12:00Z",
    kind: "sensor",
    source: "ioda",
    t: "2025-04-28T12:00:00Z",
    label: "Spain: 30% of baseline",
  },
];

function scene(over: Partial<Scene> = {}): Scene {
  return {
    version: 1,
    id: "t",
    title: "T",
    subtitle: "",
    category: "infrastructure",
    window: { start: "2025-04-28T10:00:00Z", end: "2025-04-28T14:00:00Z" },
    focus: "2025-04-28T10:33:00Z",
    timezone: "Europe/Madrid",
    region: { west: -10, south: 35, east: 5, north: 44 },
    imagery: { day: "2025-04-28", nights: [] },
    layers: [],
    camera: [
      { t: "2025-04-28T10:00:00Z", lon: 0, lat: 40, range: 1e6, heading: 0, pitch: -60 },
      { t: "2025-04-28T12:00:00Z", lon: 0, lat: 40, range: 1e6, heading: 0, pitch: -60 },
    ],
    pacing: [],
    beats: [{ t: "2025-04-28T10:40:00Z", text: "ok", cites: ["ioda:ES:ping:2025-04-28T10:40Z"] }],
    time: "real",
    chapters: [],
    panels: [],
    generatedBy: { method: "template", at: "2026-11-04T12:00:00Z" },
    ...over,
  };
}

const check = (s: Scene, ev = evidence, src = [source]) =>
  validateBundle({ scene: s, evidence: ev, sources: src });

describe("validateBundle", () => {
  it("accepts a well-formed bundle", () => {
    expect(check(scene())).toEqual([]);
  });

  it("rejects a beat that cites nothing", () => {
    const s = scene({ beats: [{ t: "2025-04-28T10:40:00Z", text: "x", cites: [] }] });
    expect(check(s).join()).toMatch(/cites nothing/);
  });

  it("rejects a beat citing an unknown evidence id", () => {
    const s = scene({ beats: [{ t: "2025-04-28T10:40:00Z", text: "x", cites: ["ioda:XX:nope"] }] });
    expect(check(s).join()).toMatch(/unknown evidence/);
  });

  it("rejects a beat outside the window", () => {
    const s = scene({
      beats: [{ t: "2025-04-28T15:00:00Z", text: "x", cites: ["ioda:ES:ping:2025-04-28T10:40Z"] }],
    });
    expect(check(s).join()).toMatch(/outside the scene window/);
  });

  it("rejects citing evidence from outside the window", () => {
    const old: Evidence = { ...first, id: "ioda:ES:old", t: "2025-04-27T10:00:00Z" };
    const s = scene({ beats: [{ t: "2025-04-28T10:40:00Z", text: "x", cites: ["ioda:ES:old"] }] });
    expect(check(s, [...evidence, old]).join()).toMatch(/outside the window/);
  });

  it("rejects beats out of order", () => {
    const s = scene({
      beats: [
        { t: "2025-04-28T12:00:00Z", text: "b", cites: ["ioda:ES:ping:2025-04-28T12:00Z"] },
        { t: "2025-04-28T10:40:00Z", text: "a", cites: ["ioda:ES:ping:2025-04-28T10:40Z"] },
      ],
    });
    expect(check(s).join()).toMatch(/out of order/);
  });

  it("rejects a source without a licence", () => {
    expect(check(scene(), evidence, [{ ...source, license: " " }]).join()).toMatch(
      /missing licence/,
    );
  });

  it("rejects evidence from an unknown source", () => {
    const stray: Evidence = { ...first, id: "x:1", source: "nobody" };
    expect(check(scene(), [...evidence, stray]).join()).toMatch(/unknown source/);
  });

  it("rejects a report without a quote", () => {
    const report: Evidence = {
      id: "report:x",
      kind: "report",
      source: "ioda",
      t: "2025-04-28T11:00:00Z",
      label: "A report",
      url: "https://example.org/a",
    };
    expect(check(scene(), [...evidence, report]).join()).toMatch(/exact quote/);
  });

  it("rejects duplicate evidence ids", () => {
    expect(check(scene(), [...evidence, first]).join()).toMatch(/duplicate id/);
  });

  it("rejects a focus outside the window and camera keyframes out of order", () => {
    const s = scene({
      focus: "2025-04-29T00:00:00Z",
      camera: [...scene().camera].reverse(),
    });
    const errors = check(s).join();
    expect(errors).toMatch(/focus/);
    expect(errors).toMatch(/camera 2: out of order/);
  });
});
