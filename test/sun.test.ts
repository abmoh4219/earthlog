import { describe, expect, it } from "vitest";
import { subsolarPoint } from "../src/globe/sun";

describe("subsolarPoint", () => {
  it("puts the sun over the Tropic of Cancer at the June solstice", () => {
    const p = subsolarPoint(new Date("2026-06-21T12:00:00Z"));
    expect(p.lat).toBeCloseTo(23.44, 0);
  });
  it("puts the sun over the equator at the March equinox", () => {
    expect(Math.abs(subsolarPoint(new Date("2026-03-20T12:00:00Z")).lat)).toBeLessThan(0.5);
  });
  it("puts the sun near Greenwich at noon UTC (within the equation of time)", () => {
    // Early November the sun runs about 16 minutes fast: solar noon at Greenwich is near
    // 11:44 UTC, so at 12:00 UTC the sun is already about 4° west.
    const p = subsolarPoint(new Date("2026-11-08T12:00:00Z"));
    expect(p.lon).toBeGreaterThan(-6);
    expect(p.lon).toBeLessThan(-2);
    expect(p.lat).toBeCloseTo(-16.6, 0);
  });
  it("moves 15° west per hour", () => {
    const a = subsolarPoint(new Date("2026-11-08T00:00:00Z")).lon;
    const b = subsolarPoint(new Date("2026-11-08T01:00:00Z")).lon;
    expect(((a - b + 540) % 360) - 180).toBeCloseTo(15, 0);
  });
});
