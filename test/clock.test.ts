import { describe, expect, it } from "vitest";
import {
  advance,
  effectiveSpeed,
  initialClock,
  pacedSpeed,
  pause,
  play,
  progress,
  seek,
  setAuto,
  setSpeed,
} from "../src/scene/clock.ts";
import type { PaceMark } from "../src/scene/schema.ts";

const start = Date.parse("2025-04-28T10:00:00Z");
const end = Date.parse("2025-04-28T12:00:00Z");
const window = { start, end };
const pacing: PaceMark[] = [
  { t: "2025-04-28T10:00:00Z", speed: 600 },
  { t: "2025-04-28T10:30:00Z", speed: 30 },
  { t: "2025-04-28T11:00:00Z", speed: 1200 },
];

describe("clock", () => {
  it("starts paused at the window start in auto mode", () => {
    const c = initialClock(window);
    expect(c).toMatchObject({ t: start, playing: false, auto: true });
  });

  it("does not move while paused", () => {
    expect(advance(initialClock(window), 16, window, pacing).t).toBe(start);
  });

  it("advances by wall time × manual speed", () => {
    const c = setSpeed(play(initialClock(window), window), 60);
    expect(advance(c, 50, window, pacing).t).toBe(start + 50 * 60);
  });

  it("follows director pacing in auto mode", () => {
    const c = play(seek(initialClock(window), Date.parse("2025-04-28T10:40:00Z"), window), window);
    expect(effectiveSpeed(c, pacing)).toBe(30);
    expect(advance(c, 10, window, pacing).t - c.t).toBe(300);
  });

  it("uses the last pace mark at or before t", () => {
    expect(pacedSpeed(Date.parse("2025-04-28T09:00:00Z"), pacing, 7)).toBe(7);
    expect(pacedSpeed(Date.parse("2025-04-28T10:30:00Z"), pacing, 7)).toBe(30);
    expect(pacedSpeed(Date.parse("2025-04-28T11:59:00Z"), pacing, 7)).toBe(1200);
  });

  it("caps a huge frame delta so a background tab cannot teleport the story", () => {
    const c = setSpeed(play(initialClock(window), window), 1);
    expect(advance(c, 5000, window, pacing).t).toBe(start + 100);
  });

  it("stops and clamps at the end", () => {
    const c = setSpeed(play(seek(initialClock(window), end - 10, window), window), 1000);
    const next = advance(c, 50, window, pacing);
    expect(next).toMatchObject({ t: end, playing: false });
  });

  it("restarts from the beginning when played at the end", () => {
    const atEnd = seek(initialClock(window), end, window);
    expect(play(atEnd, window).t).toBe(start);
  });

  it("clamps seeks to the window", () => {
    expect(seek(initialClock(window), start - 1e9, window).t).toBe(start);
    expect(seek(initialClock(window), end + 1e9, window).t).toBe(end);
  });

  it("manual speed leaves auto mode; setAuto returns to it", () => {
    const manual = setSpeed(initialClock(window), 5);
    expect(manual.auto).toBe(false);
    expect(setAuto(manual).auto).toBe(true);
    expect(pause(play(manual, window)).playing).toBe(false);
  });

  it("reports progress in 0..1", () => {
    expect(progress(start, window)).toBe(0);
    expect(progress(end, window)).toBe(1);
    expect(progress((start + end) / 2, window)).toBeCloseTo(0.5);
    expect(progress(end + 1, window)).toBe(1);
  });
});
