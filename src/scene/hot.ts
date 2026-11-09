// How hot a story is right now, and whether it is breaking. Pure.
// Heat is the story's newsworthiness (src/scene/newsworthy.ts: outlets, regions, speed,
// follow-ups, magnitude; ADR-0021) plus freshness (outlets in the last three hours), fading
// with time since the last report. Breaking is strict on purpose: a story first seen in
// the last two hours that at least three outlets reported within that window.
import type { Headline } from "./headlines.ts";
import { headlineSignals, newsworthiness, reasonsOf } from "./newsworthy.ts";

const HOUR = 3_600_000;
export const BREAKING_WINDOW_H = 2;
export const BREAKING_OUTLETS = 3;

export interface Heat {
  /** Unnormalised: compare within one run only. */
  raw: number;
  breaking: boolean;
  /** Why it counts as news, in plain words. */
  why: string[];
}

export function heatOf(headlines: Headline[], now: number): Heat {
  if (!headlines.length) return { raw: 0, breaking: false, why: [] };
  const times = headlines.map((h) => Date.parse(h.t));
  const first = Math.min(...times);
  const last = Math.max(...times);
  const recent = new Set(
    headlines.filter((h) => now - Date.parse(h.t) <= 3 * HOUR).map((h) => h.outlet),
  );
  const fade = Math.exp(-Math.max(0, now - last) / (10 * HOUR));
  const signals = headlineSignals(headlines);
  const raw = (newsworthiness(signals) + 1.5 * recent.size) * fade;
  const early = new Set(
    headlines
      .filter((h) => Date.parse(h.t) - first <= BREAKING_WINDOW_H * HOUR)
      .map((h) => h.outlet),
  );
  const breaking = now - first <= BREAKING_WINDOW_H * HOUR && early.size >= BREAKING_OUTLETS;
  return { raw, breaking, why: reasonsOf(signals) };
}

/** Raw heats → 0–100 within the run (the hottest story is 100). */
export function normalise(raws: number[]): number[] {
  const max = Math.max(0, ...raws);
  return raws.map((r) => (max > 0 ? Math.round((r / max) * 100) : 0));
}
