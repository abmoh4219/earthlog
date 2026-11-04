import { describe, expect, it } from "vitest";
import {
  heldSample,
  quakeLook,
  RING_SECONDS,
  smoothRatio,
  tintAlpha,
} from "../src/scene/layers.ts";
import type { Quake, SignalSeries } from "../src/scene/schema.ts";

const series: SignalSeries = {
  code: "ES",
  name: "Spain",
  start: "2025-04-28T10:00:00Z",
  step: 600,
  ratio: [1, 0.5, null, 0.3],
};
const at = (iso: string) => Date.parse(iso);

describe("heldSample", () => {
  it("returns the last recorded sample and its time", () => {
    expect(heldSample(series, at("2025-04-28T10:15:00Z"))).toEqual({
      t: at("2025-04-28T10:10:00Z"),
      ratio: 0.5,
    });
  });
  it("is null before the start, after the end and inside a gap", () => {
    expect(heldSample(series, at("2025-04-28T09:59:00Z"))).toBeNull();
    expect(heldSample(series, at("2025-04-28T10:40:00Z"))).toBeNull();
    expect(heldSample(series, at("2025-04-28T10:25:00Z"))).toBeNull();
  });
});

describe("smoothRatio", () => {
  it("interpolates between samples", () => {
    expect(smoothRatio(series, at("2025-04-28T10:05:00Z"))).toBeCloseTo(0.75);
  });
  it("keeps gaps visible instead of bridging them", () => {
    expect(smoothRatio(series, at("2025-04-28T10:15:00Z"))).toBeNull();
  });
  it("holds the last sample to the end of its step", () => {
    expect(smoothRatio(series, at("2025-04-28T10:35:00Z"))).toBe(0.3);
  });
});

describe("tintAlpha", () => {
  it("draws nothing for normal noise or missing data", () => {
    expect(tintAlpha(1)).toBe(0);
    expect(tintAlpha(0.97)).toBe(0);
    expect(tintAlpha(1.2)).toBe(0);
    expect(tintAlpha(null)).toBe(0);
  });
  it("grows with the drop", () => {
    expect(tintAlpha(0.3)).toBeGreaterThan(tintAlpha(0.7));
    expect(tintAlpha(0)).toBeCloseTo(0.42);
  });
});

describe("quakeLook", () => {
  const quake: Quake = {
    id: "us7000pn9s",
    t: "2025-03-28T06:20:52Z",
    lon: 95.9,
    lat: 22.0,
    mag: 7.7,
    depthKm: 10,
    place: "Myanmar",
    evidence: "usgs:us7000pn9s",
  };
  it("is invisible before the quake", () => {
    expect(quakeLook(quake, at("2025-03-28T06:20:00Z"))).toBeNull();
  });
  it("rings out and then leaves a dot", () => {
    const early = quakeLook(quake, at("2025-03-28T06:22:00Z"));
    const late = quakeLook(quake, at(quake.t) + RING_SECONDS * 1000 + 1);
    expect(early?.ring).toBeGreaterThan(early?.core ?? 0);
    expect(early?.ringAlpha).toBeGreaterThan(0.8);
    expect(late).toEqual({ core: expect.any(Number), ring: 0, ringAlpha: 0 });
  });
  it("draws bigger quakes bigger", () => {
    const small = quakeLook({ ...quake, mag: 4.6 }, at("2025-03-28T06:30:00Z"));
    const big = quakeLook(quake, at("2025-03-28T06:30:00Z"));
    expect(big?.core).toBeGreaterThan(small?.core ?? 0);
  });
});
