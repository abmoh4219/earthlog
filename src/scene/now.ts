// The "Now" view's logic, shared by the page (server render) and its live client. Pure.
// Stories are re-ranked at the moment of viewing, not when the headlines were collected: a
// story that was breaking three hours ago is not breaking any more.
import type { Cluster, Headline, NowFile } from "./headlines.ts";
import { heatOf, normalise } from "./hot.ts";
import { outletById, type Region } from "./outlets.ts";
import type { Topic } from "./topics.ts";

export const WINDOWS = ["1h", "3h", "24h"] as const;
export type NowWindow = (typeof WINDOWS)[number];
const HOURS: Record<NowWindow, number> = { "1h": 1, "3h": 3, "24h": 24 };
const HOUR = 3_600_000;

export interface NowStory {
  cluster: Cluster;
  /** The story's headlines inside the window, newest first. */
  headlines: Headline[];
  /** Distinct outlets inside the window, in order of first report. */
  outlets: string[];
  /** 0–100 within the window, at the moment of viewing. */
  heat: number;
  breaking: boolean;
}

/** Stories with at least one headline in the window, hottest first; optionally one topic. */
export function storiesIn(
  file: NowFile,
  window: NowWindow,
  now: number,
  topic?: Topic,
): NowStory[] {
  const byId = new Map(file.headlines.map((h) => [h.id, h]));
  const since = now - HOURS[window] * HOUR;
  const picked = file.clusters.flatMap((cluster) => {
    if (topic && cluster.topic !== topic) return [];
    const all = cluster.headlines.flatMap((id) => byId.get(id) ?? []);
    const inside = all.filter((h) => Date.parse(h.t) >= since && Date.parse(h.t) <= now);
    if (!inside.length) return [];
    const outlets = [
      ...new Set([...inside].sort((a, b) => a.t.localeCompare(b.t)).map((h) => h.outlet)),
    ];
    return [
      {
        cluster,
        headlines: inside,
        outlets,
        raw: heatOf(inside, now).raw,
        breaking: heatOf(all, now).breaking,
      },
    ];
  });
  const heats = normalise(picked.map((p) => p.raw));
  return picked
    .map(({ raw: _raw, ...p }, i) => ({ ...p, heat: heats[i] ?? 0 }))
    .sort(
      (a, b) =>
        Number(b.breaking) - Number(a.breaking) ||
        b.heat - a.heat ||
        (b.headlines[0]?.t ?? "").localeCompare(a.headlines[0]?.t ?? ""),
    );
}

/** How many stories each window holds (for the tabs). */
export function windowCounts(file: NowFile, now: number, topic?: Topic): Record<NowWindow, number> {
  return Object.fromEntries(
    WINDOWS.map((w) => [w, storiesIn(file, w, now, topic).length]),
  ) as Record<NowWindow, number>;
}

/**
 * A blind spot: several outlets reported it, all from one part of the world. Returns that
 * region, to say "Only outlets based in Europe reported this".
 */
export function blindSpot(outlets: string[]): Region | undefined {
  if (outlets.length < 2) return undefined;
  const regions = new Set(outlets.map((o) => outletById(o)?.region));
  const [only] = [...regions];
  return regions.size === 1 && only ? only : undefined;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/**
 * When the next collection is due: the news job runs at minute 15 of every third hour, UTC
 * (.github/workflows/news.yml). GitHub may start scheduled jobs late; this is the plan, not a promise.
 */
export function nextCollection(generatedAt: string): string {
  const d = new Date(generatedAt);
  d.setUTCMinutes(15, 0, 0);
  while (d.getTime() <= Date.parse(generatedAt) || d.getUTCHours() % 3 !== 0)
    d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
