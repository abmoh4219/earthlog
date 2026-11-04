// Pure layer maths: what a data layer looks like at scene time t.
// The globe adapter and the UI both call these, so the picture and the numbers agree.
import { ms, type Quake, type SignalSeries, type Storm } from "./schema.ts";

export interface Sample {
  /** Time of the recorded sample, ms since epoch. */
  t: number;
  ratio: number;
}

/**
 * The most recent recorded sample at or before t ("sample and hold"). This is
 * what the numbers show: a value that was actually measured, with its time.
 * Returns null before the series starts, after it ends, or inside a data gap.
 */
export function heldSample(series: SignalSeries, t: number): Sample | null {
  const start = ms(series.start);
  const stepMs = series.step * 1000;
  const i = Math.floor((t - start) / stepMs);
  if (i < 0 || i >= series.ratio.length) return null;
  const ratio = series.ratio[i];
  if (ratio === null || ratio === undefined) return null;
  return { t: start + i * stepMs, ratio };
}

/**
 * Ratio at t, linearly interpolated between neighbouring samples. Used only to
 * fade colours smoothly; a gap on either side returns null (gaps stay visible).
 */
export function smoothRatio(series: SignalSeries, t: number): number | null {
  const start = ms(series.start);
  const stepMs = series.step * 1000;
  const x = (t - start) / stepMs;
  const i = Math.floor(x);
  if (i < 0 || i >= series.ratio.length) return null;
  const a = series.ratio[i];
  if (a === null || a === undefined) return null;
  const b = series.ratio[i + 1];
  if (b === undefined) return a;
  if (b === null) return null;
  return a + (b - a) * (x - i);
}

/** Below this drop we draw nothing: normal day-to-day noise is a few percent. */
export const TINT_THRESHOLD = 0.05;

/** Fill opacity for a country whose signal sits at `ratio` of baseline. */
export function tintAlpha(ratio: number | null): number {
  if (ratio === null) return 0;
  const drop = Math.min(1, Math.max(0, 1 - ratio));
  if (drop < TINT_THRESHOLD) return 0;
  // Translucent on purpose: the satellite image underneath is evidence too.
  return 0.1 + 0.32 * drop;
}

/** How long a quake's shock ring takes to expand and fade, in scene seconds. */
export const RING_SECONDS = 15 * 60;

export interface QuakeLook {
  /** Solid dot, pixels; grows with magnitude, never fades (the quake happened). */
  core: number;
  /** Expanding ring, pixels, or 0 once it has faded. */
  ring: number;
  /** Ring opacity, 1 → 0. */
  ringAlpha: number;
}

/** How a quake looks at time t; null before it happens. */
export function quakeLook(quake: Quake, t: number): QuakeLook | null {
  const age = (t - ms(quake.t)) / 1000;
  if (age < 0) return null;
  const core = Math.max(4, 4 + (quake.mag - 4) * 3);
  const life = age / RING_SECONDS;
  if (life >= 1) return { core, ring: 0, ringAlpha: 0 };
  // Ease-out so the ring bursts fast and settles, like a wave front.
  const grow = 1 - (1 - life) ** 3;
  const maxRing = 24 + Math.max(0, quake.mag - 4) * 28;
  return { core, ring: core + grow * maxRing, ringAlpha: 1 - life };
}

export interface StormPosition {
  lon: number;
  lat: number;
  /** Index of the last fix at or before t. */
  passed: number;
  /** True between fixes, where the position is a straight-line estimate. */
  interpolated: boolean;
  windKt?: number;
}

/** Where a storm is at t, between its first and last fix; null outside that span. */
export function stormAt(storm: Storm, t: number): StormPosition | null {
  const { track } = storm;
  const first = track[0];
  const last = track.at(-1);
  if (!first || !last || t < ms(first.t) || t > ms(last.t)) return null;
  for (let i = 0; i < track.length; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (!a) break;
    if (!b || t < ms(b.t)) {
      if (!b || t === ms(a.t)) {
        return {
          lon: a.lon,
          lat: a.lat,
          passed: i,
          interpolated: false,
          ...(a.windKt ? { windKt: a.windKt } : {}),
        };
      }
      const f = (t - ms(a.t)) / (ms(b.t) - ms(a.t));
      // Longitude across the antimeridian: take the short way round.
      let dLon = b.lon - a.lon;
      if (dLon > 180) dLon -= 360;
      if (dLon < -180) dLon += 360;
      let lon = a.lon + dLon * f;
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      return {
        lon,
        lat: a.lat + (b.lat - a.lat) * f,
        passed: i,
        interpolated: true,
        ...(a.windKt ? { windKt: a.windKt } : {}),
      };
    }
  }
  return null;
}
