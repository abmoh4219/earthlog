import { describe, expect, it } from "vitest";
import {
  angleDelta,
  cameraAt,
  centralAngle,
  easeInOutCubic,
  interpolatePose,
  slerpLonLat,
} from "../src/scene/camera.ts";
import type { Keyframe } from "../src/scene/schema.ts";

const madrid: Keyframe = {
  t: "2025-04-28T10:00:00Z",
  lon: -3.7,
  lat: 40.4,
  range: 2_000_000,
  heading: 350,
  pitch: -60,
};
const lisbon: Keyframe = {
  t: "2025-04-28T11:00:00Z",
  lon: -9.14,
  lat: 38.72,
  range: 200_000,
  heading: 10,
  pitch: -40,
};
const yangon: Keyframe = {
  t: "2025-04-28T12:00:00Z",
  lon: 96.16,
  lat: 16.84,
  range: 500_000,
  heading: 0,
  pitch: -50,
};

describe("easing and angles", () => {
  it("eases from 0 to 1 symmetrically", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1);
  });

  it("takes the short way round for headings", () => {
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
    expect(angleDelta(0, 180)).toBe(180);
  });
});

describe("great-circle interpolation", () => {
  it("hits both endpoints", () => {
    const a = slerpLonLat(-3.7, 40.4, 96.16, 16.84, 0);
    const b = slerpLonLat(-3.7, 40.4, 96.16, 16.84, 1);
    expect(a.lon).toBeCloseTo(-3.7);
    expect(a.lat).toBeCloseTo(40.4);
    expect(b.lon).toBeCloseTo(96.16);
    expect(b.lat).toBeCloseTo(16.84);
  });

  it("midpoint is equidistant from both ends", () => {
    const m = slerpLonLat(-3.7, 40.4, 96.16, 16.84, 0.5);
    const d1 = centralAngle(-3.7, 40.4, m.lon, m.lat);
    const d2 = centralAngle(m.lon, m.lat, 96.16, 16.84);
    expect(d1).toBeCloseTo(d2, 6);
  });
});

describe("cameraAt", () => {
  const keys = [madrid, lisbon, yangon];

  it("holds the first and last keyframes outside the range", () => {
    expect(cameraAt(Date.parse("2025-04-28T09:00:00Z"), keys)).toMatchObject({ lon: -3.7 });
    expect(cameraAt(Date.parse("2025-04-28T13:00:00Z"), keys)).toMatchObject({ lon: 96.16 });
  });

  it("is exactly on a keyframe at its time", () => {
    const p = cameraAt(Date.parse("2025-04-28T11:00:00Z"), keys);
    expect(p.lon).toBeCloseTo(-9.14);
    expect(p.range).toBeCloseTo(200_000);
  });

  it("zooms geometrically: halfway between 2,000 km and 200 km is about 632 km", () => {
    const p = interpolatePose(madrid, lisbon, 0.5);
    expect(p.range).toBeCloseTo(Math.sqrt(2_000_000 * 200_000), -3);
  });

  it("interpolates heading across north", () => {
    const p = interpolatePose(madrid, lisbon, 0.5);
    expect(p.heading).toBeCloseTo(360);
  });

  it("rises in an arc on long hops", () => {
    const mid = interpolatePose(lisbon, yangon, 0.5);
    expect(mid.range).toBeGreaterThan(2_000_000);
  });

  it("throws without keyframes", () => {
    expect(() => cameraAt(0, [])).toThrow();
  });
});
