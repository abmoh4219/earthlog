// Story films in story time (ADR-0013): a lens describes chapters; this turns them into a
// scene with a synthetic timeline (1 scene second = 1 wall second, starting at the edition
// day's 00:00 UTC so day-precision evidence falls inside the window). Pure.
import { type EditionStory, LENS_INFO } from "../../src/scene/edition.ts";
import type {
  Beat,
  Chapter,
  Keyframe,
  LayerData,
  LayerRef,
  Panel,
  Scene,
} from "../../src/scene/schema.ts";

export interface Shot {
  lon: number;
  lat: number;
  range: number;
  pitch?: number;
  heading?: number;
}

/** A panel as a lens writes it; the builder sets its time span. */
export type PanelDraft = Panel extends infer P
  ? P extends Panel
    ? Omit<P, "t" | "until">
    : never
  : never;

export interface ChapterDraft {
  title: string;
  /** Wall seconds on screen. */
  seconds: number;
  shot: Shot;
  /** Captions, shown one after another within the chapter. */
  beats: { text: string; cites: string[] }[];
  panels?: PanelDraft[];
  /** Layers revealed from this chapter on, by key (`name`, or `kind` when unnamed). */
  reveal?: string[];
  /** Layers hidden from this chapter on, by key. */
  hide?: string[];
}

/** A layer's key and file: "regions-senate" → data/regions-senate.json. */
export function layerKey(l: LayerData): string {
  return l.kind === "regions" && l.name ? `${l.kind}-${l.name}` : l.kind;
}

export interface FilmInput {
  date: string;
  story: EditionStory;
  chapters: ChapterDraft[];
  layers: LayerData[];
  at: string;
}

const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
const SPACE = 2.2e7;
/** Seconds the camera takes to fly into a chapter's shot. */
const TRAVEL = 2.5;

export function buildFilm({ date, story, chapters, layers, at }: FilmInput): Scene {
  const start = Date.parse(`${date}T00:00:00Z`);
  const total = chapters.reduce((s, c) => s + c.seconds, 0);
  const end = start + total * 1000;

  const outChapters: Chapter[] = [];
  const beats: Beat[] = [];
  const panels: Panel[] = [];
  const firstShot = chapters[0]?.shot ?? { lon: 0, lat: 20, range: SPACE };
  const camera: Keyframe[] = [
    {
      t: iso(start),
      lon: firstShot.lon,
      lat: Math.max(-60, Math.min(60, firstShot.lat)),
      range: SPACE,
      heading: 0,
      pitch: -90,
    },
  ];
  const revealAt = new Map<string, number>();
  const hideAt = new Map<string, number>();

  let t = start;
  chapters.forEach((c, i) => {
    const chStart = t;
    const chEnd = t + c.seconds * 1000;
    outChapters.push({ t: iso(chStart), title: c.title });

    // Captions spread across the chapter, the first one shortly after it begins.
    const step = (c.seconds * 1000) / Math.max(1, c.beats.length);
    c.beats.forEach((b, k) => {
      // Captions are capped at 220 characters; a longer one is cut at a word and marked.
      const text =
        b.text.length <= 220 ? b.text : `${b.text.slice(0, b.text.lastIndexOf(" ", 217))}…`;
      beats.push({ t: iso(chStart + 600 + k * step), text, cites: b.cites });
    });

    for (const p of c.panels ?? []) {
      panels.push({ ...p, t: iso(chStart + 1200), until: iso(chEnd) } as Panel);
    }
    for (const key of c.reveal ?? []) if (!revealAt.has(key)) revealAt.set(key, chStart);
    for (const key of c.hide ?? []) if (!hideAt.has(key)) hideAt.set(key, chStart);

    // Arrive at the shot after a short flight, then drift slowly while it holds.
    const pose = {
      lon: c.shot.lon,
      lat: c.shot.lat,
      range: c.shot.range,
      heading: c.shot.heading ?? 0,
      pitch: c.shot.pitch ?? -55,
    };
    const arrive = Math.min(chEnd - 200, chStart + (i === 0 ? 4000 : TRAVEL * 1000));
    camera.push({ t: iso(arrive), ...pose });
    camera.push({
      t: iso(chEnd - 100),
      ...pose,
      range: pose.range * 1.07,
      heading: pose.heading + 6,
    });
    t = chEnd;
  });
  const last = camera.at(-1);
  if (last)
    camera.push({ ...last, t: iso(end), range: Math.max(last.range * 1.6, 6e6), pitch: -80 });

  const refs: LayerRef[] = layers.map((l) => {
    const key = layerKey(l);
    const from = revealAt.get(key) ?? revealAt.get(l.kind);
    const until = hideAt.get(key);
    return {
      kind: l.kind,
      file: `data/${key}.json`,
      ...(l.kind === "regions" && l.name ? { name: l.name } : {}),
      ...(from !== undefined ? { from: iso(from) } : {}),
      ...(until !== undefined ? { until: iso(until) } : {}),
    };
  });

  const day = new Date(start).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    version: 1,
    id: `story-${date}-${story.slug}`,
    title: story.title,
    subtitle: `${LENS_INFO[story.lens].label} · ${day}`,
    category: "daily",
    window: { start: iso(start), end: iso(end) },
    focus: iso(start),
    timezone: "UTC",
    region: story.place
      ? {
          west: story.place.lon - 10,
          south: story.place.lat - 8,
          east: story.place.lon + 10,
          north: story.place.lat + 8,
        }
      : { west: -180, south: -60, east: 180, north: 75 },
    imagery: { day: date, nights: [] },
    layers: refs,
    camera: dedupeTimes(camera),
    pacing: [{ t: iso(start), speed: 1 }],
    beats,
    time: "story",
    chapters: outChapters,
    panels,
    generatedBy: { method: "template", at },
  };
}

/** Keyframes must be strictly increasing; drop any that collide. */
function dedupeTimes(keys: Keyframe[]): Keyframe[] {
  return keys.filter((k, i) => i === 0 || Date.parse(k.t) > Date.parse(keys[i - 1]?.t ?? ""));
}
