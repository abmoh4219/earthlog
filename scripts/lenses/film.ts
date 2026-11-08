// Story films in story time (ADR-0013): a lens describes chapters; this turns them into a
// scene with a synthetic timeline (1 scene second = 1 wall second, starting at the edition
// day's 00:00 UTC so day-precision evidence falls inside the window). Pure.
import { centralAngle } from "../../src/scene/camera.ts";
import { type EditionStory, LENS_INFO } from "../../src/scene/edition.ts";
import { outletById } from "../../src/scene/outlets.ts";
import type {
  Beat,
  Chapter,
  Keyframe,
  LayerData,
  LayerRef,
  Panel,
  Scene,
} from "../../src/scene/schema.ts";
import { editChapters } from "./editor.ts";

export interface Shot {
  lon: number;
  lat: number;
  range: number;
  pitch?: number;
  heading?: number;
  /** How the camera moves while the chapter holds: orbit (default) or almost still (maps). */
  motion?: "orbit" | "still";
}

const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

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
  return "name" in l && l.name ? `${l.kind}-${l.name}` : l.kind;
}

export interface FilmInput {
  date: string;
  story: EditionStory;
  chapters: ChapterDraft[];
  layers: LayerData[];
  at: string;
}

/**
 * "In the news": the outlets that reported the story that day (ADR-0017), each headline quoted
 * exactly and credited, with a panel linking to each article. Placed before the sources.
 */
export function withCoverage(chapters: ChapterDraft[], story: EditionStory): ChapterDraft[] {
  const coverage = story.coverage ?? [];
  if (!coverage.length) return chapters;
  const at = chapters.findIndex((c) => c.title === "Sources");
  const before = chapters[at > 0 ? at - 1 : chapters.length - 1];
  const shot = before?.shot ?? chapters[0]?.shot ?? { lon: 0, lat: 20, range: SPACE };
  const name = (id: string) => outletById(id)?.name ?? id;
  const quoted = coverage.slice(0, 3);
  const chapter: ChapterDraft = {
    title: "In the news",
    seconds: 6 + quoted.length * 5,
    shot: { ...shot, heading: (shot.heading ?? 0) - 12, motion: "still" },
    beats: quoted.map((c) => ({
      text: `${name(c.outlet)} headlined it: “${c.title}”`,
      cites: [c.evidence],
    })),
    panels: [
      {
        id: "coverage",
        kind: "facts",
        title: "In the news that day",
        note: "Each outlet's headline links to its own article.",
        items: coverage
          .slice(0, 6)
          .map((c) => ({ label: name(c.outlet), text: "Open", url: c.url, cites: [c.evidence] })),
      },
    ],
  };
  return at >= 0
    ? [...chapters.slice(0, at), chapter, ...chapters.slice(at)]
    : [...chapters, chapter];
}

const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
const SPACE = 2.2e7;

export function buildFilm({ date, story, chapters: drafts, layers, at }: FilmInput): Scene {
  // How the outlets reported it, then the writing rules (ADR-0019): repeats, orphan pronouns,
  // broken quotes, clean clipping.
  const chapters = editChapters(withCoverage(drafts, story), {
    lens: story.lens,
    title: story.title,
  });
  const start = Date.parse(`${date}T00:00:00Z`);
  const total = chapters.reduce((s, c) => s + c.seconds, 0);
  const end = start + total * 1000;

  const outChapters: Chapter[] = [];
  const beats: Beat[] = [];
  const panels: Panel[] = [];
  const firstShot = chapters[0]?.shot ?? { lon: 0, lat: 20, range: SPACE };
  // Opening: deep space, the globe a little turned away, so it spins into place as the
  // camera falls toward the story.
  const camera: Keyframe[] = [
    {
      t: iso(start),
      lon: wrap(firstShot.lon + 38),
      lat: Math.max(-50, Math.min(50, firstShot.lat * 0.6)),
      range: SPACE * 1.15,
      heading: 0,
      pitch: -90,
    },
  ];
  let prev: { lon: number; lat: number; range: number } = {
    lon: firstShot.lon + 38,
    lat: firstShot.lat,
    range: SPACE,
  };
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
      beats.push({ t: iso(chStart + 600 + k * step), text: b.text, cites: b.cites });
    });

    for (const p of c.panels ?? []) {
      panels.push({ ...p, t: iso(chStart + 1200), until: iso(chEnd) } as Panel);
    }
    for (const key of c.reveal ?? []) if (!revealAt.has(key)) revealAt.set(key, chStart);
    for (const key of c.hide ?? []) if (!hideAt.has(key)) hideAt.set(key, chStart);
    // The curiosity map takes the globe to itself: earlier maps (regions, columns) step aside.
    if (c.reveal?.includes("regions-curiosity"))
      for (const key of revealAt.keys())
        if (/^(regions|columns)/.test(key) && !key.endsWith("-curiosity") && !hideAt.has(key))
          hideAt.set(key, chStart);

    // Travel: a flight sized to the distance (far hops lift off and arc over the Earth),
    // or a glide when the new shot is close. Then the camera keeps moving through the hold:
    // a slow orbit (alternating direction), a push-in and a slight rise, never a freeze.
    const pose = {
      lon: c.shot.lon,
      lat: c.shot.lat,
      range: c.shot.range,
      heading: c.shot.heading ?? 0,
      pitch: c.shot.pitch ?? -45,
    };
    const km = (centralAngle(prev.lon, prev.lat, pose.lon, pose.lat) * 6371) | 0;
    const zoom = Math.abs(Math.log(pose.range / prev.range));
    const far = km > 300 || zoom > 0.9;
    const travel = i === 0 ? 4.6 : far ? Math.min(5, 2 + 1.1 * Math.log10(1 + km / 50)) : 2.2;
    const arrive = Math.min(chStart + travel * 1000, chStart + c.seconds * 450);
    camera.push({ t: iso(arrive), ...pose, move: far || i === 0 ? "flight" : "glide" });
    const motion = c.shot.motion ?? "orbit";
    const sweep =
      motion === "still" ? 4 : (i % 2 === 0 ? 1 : -1) * Math.min(28, 5 + c.seconds * 1.6);
    const push = motion === "still" ? 0.92 : 0.82;
    const rise = motion === "still" ? 0 : 5;
    // The last chapter keeps its final seconds for the pull-back to space.
    const holdEnd = i === chapters.length - 1 ? Math.max(arrive + 1500, chEnd - 3500) : chEnd - 60;
    const hold = holdEnd - arrive;
    camera.push({
      t: iso(arrive + hold * 0.5),
      ...pose,
      heading: pose.heading + sweep * 0.5,
      range: pose.range * Math.sqrt(push),
      pitch: Math.min(-8, pose.pitch + rise * 0.5),
      move: "glide",
    });
    camera.push({
      t: iso(holdEnd),
      ...pose,
      heading: pose.heading + sweep,
      range: pose.range * push,
      pitch: Math.min(-8, pose.pitch + rise),
      move: "glide",
    });
    prev = pose;
    t = chEnd;
  });
  // Ending: pull back out to space while the Earth keeps turning.
  const last = camera.at(-1);
  if (last) {
    camera.push({
      ...last,
      t: iso(end),
      lon: wrap(last.lon - 25),
      range: Math.max(last.range * 3, 1.4e7),
      pitch: -88,
      move: "flight",
    });
  }

  // The reticle names the spotlight place; a pin at the same spot keeps its dot, not its name.
  const spot = story.place;
  const quieted: LayerData[] = layers.map((l) =>
    l.kind === "places" && spot
      ? {
          ...l,
          places: l.places.map((p) =>
            Math.abs(p.lon - spot.lon) < 0.05 && Math.abs(p.lat - spot.lat) < 0.05
              ? { ...p, quiet: true }
              : p,
          ),
        }
      : l,
  );
  layers.splice(0, layers.length, ...quieted);
  const refs: LayerRef[] = layers.map((l) => {
    const key = layerKey(l);
    const from = revealAt.get(key) ?? revealAt.get(l.kind);
    const until = hideAt.get(key);
    return {
      kind: l.kind,
      file: `data/${key}.json`,
      ...("name" in l && l.name ? { name: l.name } : {}),
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
    subtitle: `${LENS_INFO[story.lens].label} · ${day}${story.update ? ` · Update, day ${story.update.day}` : ""}`,
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
    ...(story.place
      ? {
          spotlight: {
            ...(story.place.country ? { country: story.place.country } : {}),
            lon: story.place.lon,
            lat: story.place.lat,
            label: story.place.name,
          },
        }
      : {}),
    chapters: outChapters,
    panels,
    generatedBy: { method: "template", at },
  };
}

/** Keyframes must be strictly increasing; drop any that collide. */
function dedupeTimes(keys: Keyframe[]): Keyframe[] {
  return keys.filter((k, i) => i === 0 || Date.parse(k.t) > Date.parse(keys[i - 1]?.t ?? ""));
}
