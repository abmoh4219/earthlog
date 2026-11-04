// The scene format: the contract between the bakers, the director and the player.
// Shared with Node scripts, so imports in src/scene/ use explicit .ts extensions
// and no "@/" alias (Node runs these files directly).
import { z } from "zod";

/** ISO 8601 timestamp in UTC, e.g. "2025-04-28T10:33:00Z". */
export const IsoUtc = z.iso.datetime({ offset: false });

export const EvidenceId = z
  .string()
  .min(3)
  .regex(/^[a-z0-9]+:[^\s]+$/, "evidence IDs look like 'source:detail'");

export const Keyframe = z.object({
  t: IsoUtc,
  /** Camera target: the point the camera looks at. */
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  /** Distance from target, metres. */
  range: z.number().positive(),
  /** Degrees, 0 = north. */
  heading: z.number(),
  /** Degrees, negative looks down; -90 is straight down. */
  pitch: z.number().min(-90).max(0),
  /**
   * How the camera reaches this keyframe from the previous one. "flight" (default): eased
   * take-off and landing along a lifted great circle. "glide": a smooth spline through the
   * neighbouring keyframes with no stop, for continuous orbits and push-ins.
   */
  move: z.enum(["flight", "glide"]).optional(),
});

export const Beat = z.object({
  t: IsoUtc,
  text: z.string().min(1).max(220),
  cites: z.array(EvidenceId).min(1, "every beat must cite at least one evidence item"),
});

/** Piecewise-constant playback speed (scene seconds per wall second) from time t on. */
export const PaceMark = z.object({
  t: IsoUtc,
  speed: z.number().positive(),
});

export const LayerKind = z.enum([
  "outages",
  "quakes",
  "news",
  "storms",
  "places",
  "arcs",
  "regions",
  "columns",
]);

export const LayerRef = z.object({
  kind: LayerKind,
  /** Path inside the bundle folder, e.g. "data/outages.json". */
  file: z.string().regex(/^data\/[a-z0-9-]+\.json$/),
  /** Distinguishes several layers of one kind (e.g. "senate" and "house" regions). */
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  /** Optional span in which the layer is shown (story films reveal layers chapter by chapter). */
  from: IsoUtc.optional(),
  until: IsoUtc.optional(),
});

/** A story film's chapter: everything from `t` until the next chapter. */
export const Chapter = z.object({
  t: IsoUtc,
  title: z.string().min(1).max(60),
});

/** One cited row of a panel. */
export const PanelItem = z.object({
  label: z.string().min(1),
  /** Display text, e.g. "4,500" or "San Francisco". */
  text: z.string().optional(),
  /** Numeric value, for bars. */
  value: z.number().optional(),
  color: z.string().optional(),
  url: z.url().optional(),
  cites: z.array(EvidenceId).min(1, "every panel value must cite evidence"),
});

const PanelBase = {
  id: z.string().min(1),
  /** Shown from t until `until` (default: the next panel in the same slot, or the end). */
  t: IsoUtc,
  until: IsoUtc.optional(),
  title: z.string().min(1),
  /** Small print under the panel: units, method, caveats. */
  note: z.string().optional(),
};

export const Panel = z.discriminatedUnion("kind", [
  z.object({ ...PanelBase, kind: z.literal("facts"), items: z.array(PanelItem).min(1) }),
  z.object({
    ...PanelBase,
    kind: z.literal("bars"),
    unit: z.string(),
    items: z.array(PanelItem.extend({ value: z.number() })).min(1),
    /** A reference line across the bars, e.g. the majority threshold. */
    marker: z.object({ value: z.number(), label: z.string() }).optional(),
  }),
  /** A parliament: one dot per seat in a half circle, coloured by party (left to right). */
  z.object({
    ...PanelBase,
    kind: z.literal("seats"),
    total: z.number().int().positive(),
    majority: z.number().int().positive().optional(),
    items: z.array(PanelItem.extend({ value: z.number().int().nonnegative() })).min(1),
  }),
  z.object({
    ...PanelBase,
    kind: z.literal("line"),
    unit: z.string(),
    series: z
      .array(
        z.object({
          label: z.string(),
          color: z.string().optional(),
          /** x is a label (e.g. a date), y the value; drawn in order. */
          points: z.array(z.object({ x: z.string(), y: z.number() })).min(2),
          cites: z.array(EvidenceId).min(1),
        }),
      )
      .min(1),
    /** Index of the point to highlight (e.g. the story's day). */
    mark: z.number().int().optional(),
  }),
]);

export const Scene = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9_][a-z0-9-]*$/),
  title: z.string().min(1),
  subtitle: z.string(),
  category: z.enum([
    "nature",
    "infrastructure",
    "conflict",
    "politics",
    "sports",
    "daily",
    "sample",
  ]),
  window: z.object({ start: IsoUtc, end: IsoUtc }),
  focus: IsoUtc,
  /** IANA zone for display only; all scene times are UTC. */
  timezone: z.string().min(1),
  region: z.object({
    west: z.number(),
    south: z.number(),
    east: z.number(),
    north: z.number(),
  }),
  imagery: z.object({
    /** YYYY-MM-DD of the event-day satellite image. */
    day: z.iso.date(),
    /** YYYY-MM-DD dates of night-lights passes to compare. */
    nights: z.array(z.iso.date()).default([]),
  }),
  layers: z.array(LayerRef).default([]),
  camera: z.array(Keyframe).min(1),
  pacing: z.array(PaceMark).default([]),
  beats: z.array(Beat).default([]),
  /**
   * "real": the clock is UTC (sensor replays). "story": the timeline is the film's chapters
   * and the HUD shows chapter titles instead of a clock (ADR-0013).
   */
  time: z.enum(["real", "story"]).default("real"),
  chapters: z.array(Chapter).default([]),
  panels: z.array(Panel).default([]),
  generatedBy: z.object({
    method: z.enum(["template", "claude", "hand"]),
    model: z.string().optional(),
    at: IsoUtc,
    costUsd: z.number().nonnegative().optional(),
  }),
});

export const EvidenceKind = z.enum(["sensor", "baseline", "report"]);

export const Evidence = z.object({
  id: EvidenceId,
  kind: EvidenceKind,
  /** Source ID in sources.json. */
  source: z.string().min(1),
  t: IsoUtc,
  lon: z.number().optional(),
  lat: z.number().optional(),
  /** Short human label, e.g. "Spain: Google traffic at 54% of baseline". */
  label: z.string().min(1),
  value: z.number().optional(),
  unit: z.string().optional(),
  url: z.url().optional(),
  /** Exact text the evidence rests on; required for kind "report". */
  quote: z.string().optional(),
  /**
   * "day": the source gives a date but no time of day (e.g. a daily news digest);
   * t is then the day's start and the UI says "time of day not recorded".
   */
  precision: z.enum(["exact", "day"]).optional(),
  /** Further sources behind a report, e.g. the outlets a news digest cites. */
  links: z.array(z.object({ name: z.string().min(1), url: z.url() })).optional(),
});

export const Source = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url(),
  license: z.string().min(1),
  attribution: z.string().min(1),
  retrievedAt: IsoUtc,
});

export const SceneIndexEntry = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  category: Scene.shape.category,
  date: z.iso.date(),
  listed: z.boolean(),
});

// ── Layer data files (public/scenes/<id>/data/*.json) ──────────────────────────

/** IODA signals we bake. Each measures connectivity, never people (DATA-SOURCES.md). */
export const SignalKind = z.enum(["ping-slash24", "gtr-norm", "bgp", "merit-nt"]);

/** One country's signal as a ratio to its own baseline, on a fixed time grid. */
export const SignalSeries = z.object({
  /** ISO 3166-1 alpha-2, matches public/geo/countries.json. */
  code: z.string().length(2),
  name: z.string().min(1),
  start: IsoUtc,
  /** Seconds between samples. */
  step: z.number().positive(),
  /** value ÷ baseline per sample; null where the source recorded nothing (a real gap). */
  ratio: z.array(z.number().nonnegative().nullable()),
});

export const SignalLayer = z.object({
  kind: z.literal("outages"),
  signal: SignalKind,
  /** What the number measures, in plain words, e.g. "Responsive address blocks". */
  label: z.string().min(1),
  /** "loss" paints drops red (outages); "attention" paints them cyan (people busy elsewhere). */
  tone: z.enum(["loss", "attention"]),
  /** How the baseline was computed, shown in the UI next to the numbers. */
  baseline: z.string().min(1),
  series: z.array(SignalSeries).min(1),
});

export const Quake = z.object({
  id: z.string().min(1),
  t: IsoUtc,
  lon: z.number(),
  lat: z.number(),
  mag: z.number(),
  depthKm: z.number(),
  place: z.string(),
  /** The evidence item this quake comes from. */
  evidence: EvidenceId,
});

export const QuakeLayer = z.object({
  kind: z.literal("quakes"),
  quakes: z.array(Quake),
});

/** A news story from a daily digest, placed on the map where it happened. */
export const NewsStory = z.object({
  id: z.string().min(1),
  /** Key into NEWS_CATEGORIES (src/scene/news.ts). */
  category: z.string().min(1),
  /** The running story it belongs to, e.g. "2026 United States elections". */
  topic: z.string().optional(),
  text: z.string().min(1),
  /** Most specific place we could locate; absent when the story has no single place. */
  place: z
    .object({ name: z.string().min(1), lon: z.number(), lat: z.number(), country: z.boolean() })
    .optional(),
  evidence: EvidenceId,
});

export const NewsLayer = z.object({
  kind: z.literal("news"),
  date: z.iso.date(),
  stories: z.array(NewsStory),
});

export const StormFix = z.object({
  t: IsoUtc,
  lon: z.number(),
  lat: z.number(),
  /** Sustained wind, knots, when the tracker reports it. */
  windKt: z.number().optional(),
  evidence: EvidenceId,
});

export const Storm = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Positions in time order; the player interpolates between fixes and says so. */
  track: z.array(StormFix).min(1),
});

export const StormLayer = z.object({
  kind: z.literal("storms"),
  storms: z.array(Storm),
});

/** Labelled places; the primary one gets a beacon. */
export const PlacesLayer = z.object({
  kind: z.literal("places"),
  places: z.array(
    z.object({
      name: z.string().min(1),
      lon: z.number(),
      lat: z.number(),
      color: z.string().optional(),
      primary: z.boolean().optional(),
      /** Dot without a name, for pins that would crowd a neighbour's label. */
      quiet: z.boolean().optional(),
    }),
  ),
});

/** Arcs between places, drawn as lifted great circles. */
export const ArcsLayer = z.object({
  kind: z.literal("arcs"),
  /** Draw the arcs one after another (a journey) instead of all at once. */
  sequence: z.boolean().optional(),
  arcs: z.array(
    z.object({
      from: z.tuple([z.number(), z.number()]),
      to: z.tuple([z.number(), z.number()]),
      color: z.string().optional(),
    }),
  ),
});

/**
 * Filled regions (countries, states, districts) with their own outlines, so any geometry
 * works. A legend explains the colours.
 */
export const RegionsLayer = z.object({
  kind: z.literal("regions"),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  regions: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      rings: z.array(z.array(z.number())),
      color: z.string(),
      /** 0–1 fill opacity. */
      opacity: z.number().min(0).max(1).default(0.45),
      /** Hatched (striped) fill, e.g. for "not yet called". */
      hatched: z.boolean().optional(),
      /** Gently pulse, to draw the eye (e.g. a seat that changed party). */
      pulse: z.boolean().optional(),
    }),
  ),
  legend: z.array(z.object({ label: z.string(), color: z.string() })).default([]),
});

/**
 * Values as glowing columns rising from the globe (a 3D bar chart on the map). Heights are
 * proportional to |value| (the tallest is `maxHeight` metres); they grow when revealed.
 */
export const ColumnsLayer = z.object({
  kind: z.literal("columns"),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  unit: z.string(),
  maxHeight: z.number().positive().default(900_000),
  columns: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      lon: z.number(),
      lat: z.number(),
      value: z.number(),
      color: z.string(),
      /** Show the label at the tip (the story's own country, the extremes). */
      label: z.boolean().optional(),
    }),
  ),
});

export const LayerData = z.discriminatedUnion("kind", [
  ColumnsLayer,
  SignalLayer,
  QuakeLayer,
  NewsLayer,
  StormLayer,
  PlacesLayer,
  ArcsLayer,
  RegionsLayer,
]);

/** Natural Earth outlines, shared by all scenes (public/geo/countries.json). */
export const Country = z.object({
  code: z.string().length(2),
  name: z.string().min(1),
  /** Label anchor [lon, lat] chosen by Natural Earth (inside the country, unlike a centroid). */
  label: z.tuple([z.number(), z.number()]),
  /** Outer rings as flat [lon, lat, lon, lat, …] arrays (holes dropped at 1:110m). */
  rings: z.array(z.array(z.number())),
  /** Other names for matching, e.g. "United States" for "United States of America". */
  aliases: z.array(z.string()).default([]),
  /** Natural Earth CONTINENT, used to balance editions geographically. */
  continent: z.string().optional(),
});

export type Keyframe = z.infer<typeof Keyframe>;
export type SignalSeries = z.infer<typeof SignalSeries>;
export type SignalLayer = z.infer<typeof SignalLayer>;
export type Quake = z.infer<typeof Quake>;
export type QuakeLayer = z.infer<typeof QuakeLayer>;
export type LayerData = z.infer<typeof LayerData>;
export type Country = z.infer<typeof Country>;
export type Chapter = z.infer<typeof Chapter>;
export type Panel = z.infer<typeof Panel>;
export type PanelItem = z.infer<typeof PanelItem>;
export type PlacesLayer = z.infer<typeof PlacesLayer>;
export type ArcsLayer = z.infer<typeof ArcsLayer>;
export type RegionsLayer = z.infer<typeof RegionsLayer>;
export type ColumnsLayer = z.infer<typeof ColumnsLayer>;
export type NewsStory = z.infer<typeof NewsStory>;
export type NewsLayer = z.infer<typeof NewsLayer>;
export type Storm = z.infer<typeof Storm>;
export type StormLayer = z.infer<typeof StormLayer>;
export type Beat = z.infer<typeof Beat>;
export type PaceMark = z.infer<typeof PaceMark>;
export type LayerRef = z.infer<typeof LayerRef>;
export type Scene = z.infer<typeof Scene>;
export type Evidence = z.infer<typeof Evidence>;
export type Source = z.infer<typeof Source>;
export type SceneIndexEntry = z.infer<typeof SceneIndexEntry>;

/** Milliseconds since epoch for an ISO UTC string. */
export function ms(iso: string): number {
  return Date.parse(iso);
}
