// Template director for "the world, yesterday": a world tour of the day's stories, with
// sensor events (quakes, storms, outages) at their real times. Free and deterministic;
// Claude mode (Phase 4) can rewrite the prose but must keep the same citations.
//
// Honesty about time: news digests give a date, not a time of day. News beats are spread
// across the day in story order, their captions carry no clock time, and the story card
// says "time of day not recorded". Sensor beats state their exact UTC time.
import { categoryByKey } from "../../src/scene/news.ts";
import type {
  Beat,
  Evidence,
  Keyframe,
  LayerData,
  NewsLayer,
  NewsStory,
  QuakeLayer,
  Scene,
  SignalLayer,
  StormLayer,
} from "../../src/scene/schema.ts";
import { ms } from "../../src/scene/schema.ts";
import { baselineId, evidenceId, pct, SIGNAL_INFO } from "../bake/ioda.ts";

const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
const utc = (t: number) => `${new Date(t).toISOString().slice(11, 16)} UTC`;

/** How many news stories make the replay; the rest stay on the map as pins. */
export const MAX_NEWS = 10;
const WALL_SECONDS_PER_BEAT = 9;
/** Two lines on a laptop screen; the story card carries the full text. */
const CAPTION_CHARS = 140;
const READ_SECONDS = 8;

interface Shot {
  lon: number;
  lat: number;
  range: number;
}

interface Draft {
  /** Earliest allowed time (the event's own time for sensors, the day start for news). */
  t: number;
  /** Preferred time; news is spread evenly across the day. */
  want: number;
  text: string;
  cites: string[];
  shot?: Shot;
  /** Lower is more important; used to drop news if the day is too crowded. */
  priority: number;
  news: boolean;
}

/** Trim to a clause boundary and mark the cut with "…"; the full text is in the story card. */
export function shorten(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(" — "));
  const at = cut > limit * 0.5 ? cut : head.lastIndexOf(" ");
  return `${head.slice(0, at).replace(/[,;:\s]+$/, "")}…`;
}

/** Round-robin by category rank, so every kind of news gets a turn before any gets two. */
export function pickStories(stories: NewsStory[], max: number): NewsStory[] {
  const byCat = new Map<string, NewsStory[]>();
  for (const s of stories) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);
  const order = [...byCat.keys()].sort((a, b) => categoryByKey(a).rank - categoryByKey(b).rank);
  const picked: NewsStory[] = [];
  for (let round = 0; picked.length < max; round++) {
    let added = false;
    for (const key of order) {
      const s = byCat.get(key)?.[round];
      if (s && picked.length < max) {
        picked.push(s);
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
}

export function dailyScene(
  date: string,
  evidence: Evidence[],
  layers: LayerData[],
  at: string,
): Scene {
  const start = ms(`${date}T00:00:00Z`);
  const end = start + 86_400_000;
  const known = new Set(evidence.map((e) => e.id));
  const drafts: Draft[] = [];

  const news = layers.find((l): l is NewsLayer => l.kind === "news");
  const picked = news ? pickStories(news.stories, MAX_NEWS) : [];
  picked.forEach((s, i) => {
    const cat = categoryByKey(s.category);
    // The place is on the map and in the story card, so the caption stays short.
    const prefix = `${cat.label}: `;
    drafts.push({
      t: start,
      want: start + ((i + 0.5) / picked.length) * (end - start),
      text: prefix + shorten(s.text, CAPTION_CHARS),
      cites: [s.evidence],
      ...(s.place
        ? { shot: { lon: s.place.lon, lat: s.place.lat, range: s.place.country ? 3.2e6 : 1.6e6 } }
        : {}),
      priority: 10 + i,
      news: true,
    });
  });

  const quakes = layers.find((l): l is QuakeLayer => l.kind === "quakes");
  const biggest = quakes?.quakes.reduce<QuakeLayer["quakes"][number] | undefined>(
    (m, q) => (!m || q.mag > m.mag ? q : m),
    undefined,
  );
  if (biggest && biggest.mag >= 5 && known.has(biggest.evidence)) {
    const t = ms(biggest.t);
    drafts.push({
      t,
      want: t,
      text: `${utc(t)}. The day's strongest earthquake: magnitude ${biggest.mag.toFixed(1)}, ${Math.round(biggest.depthKm)} km deep, ${biggest.place}.`,
      cites: [biggest.evidence],
      shot: { lon: biggest.lon, lat: biggest.lat, range: 2.2e6 },
      priority: 1,
      news: false,
    });
  }

  const storms = layers.find((l): l is StormLayer => l.kind === "storms");
  for (const storm of storms?.storms ?? []) {
    const fix = storm.track.find((f) => ms(f.t) >= start && ms(f.t) < end);
    if (!fix) continue;
    const t = ms(fix.t);
    drafts.push({
      t,
      want: t,
      text: `${utc(t)}. ${storm.name} at ${Math.abs(fix.lat).toFixed(1)}°${fix.lat >= 0 ? "N" : "S"}, ${Math.abs(fix.lon).toFixed(1)}°${fix.lon >= 0 ? "E" : "W"}${fix.windKt ? `, sustained winds of ${fix.windKt} knots` : ""}.`,
      cites: [fix.evidence],
      shot: { lon: fix.lon, lat: fix.lat, range: 3e6 },
      priority: 2,
      news: false,
    });
  }

  const signal = layers.find((l): l is SignalLayer => l.kind === "outages");
  for (const s of signal?.series ?? []) {
    const { noun } = SIGNAL_INFO[signal?.signal ?? "ping-slash24"];
    let low: { t: number; r: number } | undefined;
    s.ratio.forEach((r, i) => {
      if (r === null) return;
      const t = ms(s.start) + i * s.step * 1000;
      if (!low || r < low.r) low = { t, r };
    });
    if (!low || !signal) continue;
    const id = evidenceId(s.code, signal.signal, iso(low.t));
    if (!known.has(id)) continue;
    drafts.push({
      t: low.t,
      want: low.t,
      text: `${utc(low.t)}. Internet outage signal in ${s.name}: ${noun} down to ${pct(low.r)}% of normal.`,
      cites: [id, baselineId(s.code, signal.signal)],
      priority: 3,
      news: false,
    });
  }

  // Schedule: one reading time apart, never before the event, never past the day's end.
  // If the day is too crowded, drop the least important news story and try again.
  let pending = drafts;
  let beats: (Beat & { shot?: Shot })[] = [];
  let speed = 600;
  for (;;) {
    speed = Math.min(
      1800,
      Math.max(240, Math.round(86_400 / (pending.length * WALL_SECONDS_PER_BEAT))),
    );
    const gap = READ_SECONDS * speed * 1000;
    const sorted = [...pending].sort((a, b) => a.want - b.want);
    beats = [];
    let last = Number.NEGATIVE_INFINITY;
    let fits = true;
    for (const d of sorted) {
      const t = Math.max(d.t, d.want, last + gap);
      if (t > end - gap / 2) {
        fits = false;
        break;
      }
      beats.push({ t: iso(t), text: d.text, cites: d.cites, ...(d.shot ? { shot: d.shot } : {}) });
      last = t;
    }
    const newsLeft = pending.filter((d) => d.news);
    if (fits || newsLeft.length === 0) break;
    const drop = newsLeft.reduce((m, d) => (d.priority > m.priority ? d : m));
    pending = pending.filter((d) => d !== drop);
  }

  return {
    version: 1,
    id: `daily-${date}`,
    title: `The world on ${new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`,
    subtitle: "One day on Earth: the news, the quakes, the storms and the outages",
    category: "daily",
    window: { start: iso(start), end: iso(end) },
    focus: beats[0]?.t ?? iso(start),
    timezone: "UTC",
    region: { west: -180, south: -60, east: 180, north: 75 },
    imagery: { day: date, nights: [] },
    layers: layers.map((l) => ({ kind: l.kind, file: `data/${l.kind}.json` })),
    camera: tour(start, end, beats),
    pacing: [{ t: iso(start), speed }],
    beats: beats.map(({ shot: _, ...b }) => b),
    generatedBy: { method: "template", at },
  };
}

/** Fly to each beat's place, hold while it's read, travel on; pull out to space between. */
function tour(start: number, end: number, beats: (Beat & { shot?: Shot })[]): Keyframe[] {
  const space = (lon: number, t: number): Keyframe => ({
    t: iso(t),
    lon,
    lat: 15,
    range: 2.2e7,
    heading: 0,
    pitch: -90,
  });
  const firstLon = beats.find((b) => b.shot)?.shot?.lon ?? 0;
  const keys: Keyframe[] = [space(firstLon, start)];
  let lon = firstLon;
  beats.forEach((b, i) => {
    const t = ms(b.t);
    const next = beats[i + 1];
    const hold = ((next ? ms(next.t) : end) - t) * 0.55;
    if (b.shot) {
      lon = b.shot.lon;
      // Aim a little south of the place so it sits just above the caption, not under it.
      const pose = {
        lon: b.shot.lon,
        lat: b.shot.lat - b.shot.range / 2.5e6,
        range: b.shot.range,
        pitch: -58,
      };
      keys.push({ t: b.t, ...pose, heading: 0 });
      keys.push({ t: iso(t + hold), ...pose, range: pose.range * 1.08, heading: 8 });
    } else {
      keys.push({ ...space(lon, t), t: b.t });
    }
  });
  keys.push(space(lon, end));
  // Keyframes must be strictly increasing in time.
  return keys.filter((k, i) => i === 0 || ms(k.t) > ms(keys[i - 1]?.t ?? ""));
}
