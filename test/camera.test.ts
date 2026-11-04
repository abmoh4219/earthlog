import { describe, expect, it } from "vitest";
import {
  angleDelta,
  cameraAt,
  centralAngle,
  cinematicPose,
  easeInOutCubic,
  interpolatePose,
  slerpLonLat,
  tiltShift,
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

describe("glide segments", () => {
  const k = (t: string, lon: number, heading: number, move?: "glide" | "flight") => ({
    t: `2026-11-03T00:00:${t}Z`,
    lon,
    lat: 40,
    range: 1_000_000,
    heading,
    pitch: -40,
    ...(move ? { move } : {}),
  });
  const keys = [
    k("00", 0, 0),
    k("04", 1, 10, "glide"),
    k("08", 2, 20, "glide"),
    k("12", 3, 30, "glide"),
  ];
  const at = (s: number) => cameraAt(Date.parse("2026-11-03T00:00:00Z") + s * 1000, keys);

  it("passes exactly through each keyframe", () => {
    expect(at(8).lon).toBeCloseTo(2, 6);
    expect(at(8).heading).toBeCloseTo(20, 6);
  });

  it("keeps moving through a keyframe instead of stopping at it", () => {
    const before = at(7.9).lon;
    const after = at(8.1).lon;
    // Uniform motion of 0.25°/s means ~0.05° over 0.2 s; a stop would give ~0.
    expect(after - before).toBeGreaterThan(0.04);
  });

  it("unwraps longitude and heading across the antimeridian", () => {
    const wrap = [k("00", 179, 350), k("04", -179, 10, "glide")];
    const mid = cameraAt(Date.parse("2026-11-03T00:00:02Z"), wrap);
    expect(Math.abs(mid.lon)).toBeGreaterThan(179);
    expect(mid.heading === 0 || Math.abs(mid.heading) < 1 || Math.abs(mid.heading - 360) < 1).toBe(
      true,
    );
  });
});

describe("cinematicPose", () => {
  const keys: Keyframe[] = [
    { t: "2026-01-01T00:00:00Z", lon: 0, lat: 0, range: 1e6, heading: 0, pitch: -45 },
    {
      t: "2026-01-01T00:00:10Z",
      lon: 0,
      lat: 0,
      range: 1e6,
      heading: 40,
      pitch: -45,
      move: "glide",
    },
  ];
  const t0 = Date.parse("2026-01-01T00:00:05Z");
  it("banks into a turn and stays near the director's pose", () => {
    const p = cinematicPose(t0, keys, 0);
    const base = cameraAt(t0, keys);
    expect(p.heading).toBeCloseTo(base.heading, 6);
    expect(p.roll).toBeGreaterThan(0.5);
    expect(p.roll).toBeLessThanOrEqual(5);
  });
  it("drifts only a little", () => {
    const p = cinematicPose(t0, keys, 1);
    const base = cameraAt(t0, keys);
    expect(Math.abs(p.heading - base.heading)).toBeLessThan(0.5);
    expect(Math.abs(p.pitch - base.pitch)).toBeLessThan(0.35);
  });
  it("is still when nothing turns and drift is off", () => {
    const still: Keyframe[] = keys.map((k) => ({ ...k, heading: 0 }));
    expect(cinematicPose(t0, still, 0).roll).toBeCloseTo(0, 6);
  });
});

describe("tiltShift", () => {
  it("softens low oblique shots only", () => {
    expect(tiltShift(-30, 5e5)).toBe(1);
    expect(tiltShift(-80, 5e5)).toBe(0);
    expect(tiltShift(-30, 1.6e7)).toBe(0);
  });
});
