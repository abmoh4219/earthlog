// IODA (Georgia Tech) internet-connectivity signals → ratio-to-baseline series + evidence.
// API verified 2026-11-04: GET /v2/signals/raw/country/<CC>?from&until&datasource=<signal>
// returns data[0][0] = { entityCode, entityName, datasource, from, step, values[] }.
// Licence: the response says "Copyright (c) Georgia Tech Research Corporation. All Rights
// Reserved." We bundle small normalised series with attribution (decision recorded in
// docs/DATA-SOURCES.md); if IODA objects, the player fetches their API live instead.
import { z } from "zod";
import type { Evidence, SignalLayer, SignalSeries, Source } from "../../src/scene/schema.ts";
import { fetchJson, idTime, isoFromUnix, median } from "./lib.ts";

const API = "https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country";

export type Signal = SignalLayer["signal"];

const IodaSignal = z.object({
  entityCode: z.string(),
  entityName: z.string(),
  datasource: z.string(),
  from: z.number(),
  step: z.number().positive(),
  values: z.array(z.number().nullable()),
});

const IodaResponse = z.object({
  data: z.array(z.array(IodaSignal)),
  copyright: z.string().optional(),
});

export type IodaSignal = z.infer<typeof IodaSignal>;

/** Plain-words names for each signal: what it counts, never "people offline". */
export const SIGNAL_INFO: Record<
  Signal,
  { label: string; noun: string; short: string; plural: boolean }
> = {
  "ping-slash24": {
    label: "Responsive address blocks (active probing)",
    noun: "responsive address blocks",
    short: "ping",
    plural: true,
  },
  "gtr-norm": {
    label: "Google traffic (normalised)",
    noun: "Google traffic",
    short: "gtr",
    plural: false,
  },
  bgp: {
    label: "Announced address blocks (BGP)",
    noun: "announced address blocks",
    short: "bgp",
    plural: true,
  },
  "merit-nt": {
    label: "Unsolicited traffic seen by a network telescope",
    noun: "telescope traffic",
    short: "telescope",
    plural: false,
  },
};

export function parseIoda(json: unknown, signal: Signal): IodaSignal {
  const parsed = IodaResponse.parse(json);
  const found = parsed.data.flat().find((s) => s.datasource === signal);
  if (!found) throw new Error(`IODA response has no "${signal}" series`);
  return found;
}

/** Weeks of history behind each baseline (same weekday, same time). */
export const BASELINE_WEEKS = 4;
const WEEK = 7 * 86_400;

export interface BaselinedSeries {
  start: number;
  step: number;
  raw: (number | null)[];
  baseline: (number | null)[];
  ratio: (number | null)[];
}

/**
 * Ratio of each sample in [windowStart, windowEnd) to its baseline: the median of the
 * same time on the same weekday over the previous BASELINE_WEEKS weeks. Same weekday,
 * because traffic has a weekly rhythm (a Sunday afternoon is not a Tuesday afternoon);
 * median, so one odd week (a holiday, a match) can't move it. Missing data stays null.
 */
export function baselined(s: IodaSignal, windowStart: number, windowEnd: number): BaselinedSeries {
  const value = (t: number): number | null => {
    const i = (t - s.from) / s.step;
    if (!Number.isInteger(i)) return null;
    return s.values[i] ?? null;
  };
  // Align the grid to the source's own sample times.
  const first = s.from + Math.ceil((windowStart - s.from) / s.step) * s.step;
  const raw: (number | null)[] = [];
  const baseline: (number | null)[] = [];
  const ratio: (number | null)[] = [];
  for (let t = first; t < windowEnd; t += s.step) {
    const v = value(t);
    const past: number[] = [];
    for (let w = 1; w <= BASELINE_WEEKS; w++) {
      const p = value(t - w * WEEK);
      if (p !== null) past.push(p);
    }
    // Require at least half the weeks, or the "normal" itself is a guess.
    const b = past.length >= Math.ceil(BASELINE_WEEKS / 2) ? median(past) : null;
    raw.push(v);
    baseline.push(b);
    ratio.push(v !== null && b !== null && b > 0 ? round(v / b, 4) : null);
  }
  return { start: first, step: s.step, raw, baseline, ratio };
}

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

const fmt = (x: number) =>
  Number.isInteger(x)
    ? x.toLocaleString("en-GB")
    : x.toLocaleString("en-GB", { maximumFractionDigits: 3 });

export const pct = (ratio: number) => Math.round(ratio * 100);

export function evidenceId(code: string, signal: Signal, iso: string): string {
  return `ioda:${code}:${SIGNAL_INFO[signal].short}:${idTime(iso)}`;
}

export function baselineId(code: string, signal: Signal): string {
  return `ioda:${code}:${SIGNAL_INFO[signal].short}:baseline`;
}

/** One sensor evidence item per recorded sample, plus one baseline item per country. */
export function signalEvidence(
  code: string,
  name: string,
  signal: Signal,
  b: BaselinedSeries,
  windowStartIso: string,
): Evidence[] {
  const info = SIGNAL_INFO[signal];
  const out: Evidence[] = [
    {
      id: baselineId(code, signal),
      kind: "baseline",
      source: "ioda",
      t: windowStartIso,
      label: `${name}: "normal" = median of the same time on the same weekday over the ${BASELINE_WEEKS} previous weeks`,
      url: "https://ioda.inetintel.cc.gatech.edu/",
    },
  ];
  b.ratio.forEach((r, i) => {
    const v = b.raw[i];
    const base = b.baseline[i];
    if (r === null || r === undefined || v == null || base == null) return;
    const t = isoFromUnix(b.start + i * b.step);
    out.push({
      id: evidenceId(code, signal, t),
      kind: "sensor",
      source: "ioda",
      t,
      label: `${name}: ${info.noun} ${fmt(v)} vs normal ${fmt(round(base, 3))} (${pct(r)}%)`,
      value: pct(r),
      unit: "% of normal",
      url: `https://ioda.inetintel.cc.gatech.edu/country/${code}?from=${b.start}&until=${b.start + b.ratio.length * b.step}`,
    });
  });
  return out;
}

export function toSeries(code: string, name: string, b: BaselinedSeries): SignalSeries {
  return { code, name, start: isoFromUnix(b.start), step: b.step, ratio: b.ratio };
}

export function iodaSource(copyright: string, retrievedAt: string): Source {
  return {
    id: "ioda",
    name: "IODA: Internet Outage Detection and Analysis (Georgia Tech)",
    url: "https://ioda.inetintel.cc.gatech.edu/",
    license: `${copyright} Bundled as small normalised series with attribution, for non-commercial use (docs/DATA-SOURCES.md).`,
    attribution: "IODA, Georgia Tech",
    retrievedAt,
  };
}

export const IODA_COPYRIGHT_FALLBACK =
  "Copyright (c) Georgia Tech Research Corporation. All Rights Reserved.";

/** Fetch BASELINE_WEEKS before the window through its end, for one country and signal. */
export async function fetchIoda(
  code: string,
  signal: Signal,
  windowStart: number,
  windowEnd: number,
): Promise<{ signal: IodaSignal; copyright: string }> {
  const from = windowStart - BASELINE_WEEKS * WEEK - 3600;
  const url = `${API}/${code}?from=${from}&until=${windowEnd}&datasource=${signal}`;
  const json = await fetchJson(url);
  const copyright = IodaResponse.parse(json).copyright ?? IODA_COPYRIGHT_FALLBACK;
  return { signal: parseIoda(json, signal), copyright };
}
