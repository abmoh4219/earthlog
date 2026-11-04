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

export const LayerKind = z.enum(["outages", "quakes"]);

export const LayerRef = z.object({
  kind: LayerKind,
  /** Path inside the bundle folder, e.g. "data/outages.json". */
  file: z.string().regex(/^data\/[a-z0-9-]+\.json$/),
});

export const Scene = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9_][a-z0-9-]*$/),
  title: z.string().min(1),
  subtitle: z.string(),
  category: z.enum(["nature", "infrastructure", "conflict", "politics", "sports", "sample"]),
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
  /** Exact quote, required for kind "report". */
  quote: z.string().optional(),
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

export const LayerData = z.discriminatedUnion("kind", [SignalLayer, QuakeLayer]);

/** Natural Earth outlines, shared by all scenes (public/geo/countries.json). */
export const Country = z.object({
  code: z.string().length(2),
  name: z.string().min(1),
  /** Label anchor [lon, lat] chosen by Natural Earth (inside the country, unlike a centroid). */
  label: z.tuple([z.number(), z.number()]),
  /** Outer rings as flat [lon, lat, lon, lat, …] arrays (holes dropped at 1:110m). */
  rings: z.array(z.array(z.number())),
});

export type Keyframe = z.infer<typeof Keyframe>;
export type SignalSeries = z.infer<typeof SignalSeries>;
export type SignalLayer = z.infer<typeof SignalLayer>;
export type Quake = z.infer<typeof Quake>;
export type QuakeLayer = z.infer<typeof QuakeLayer>;
export type LayerData = z.infer<typeof LayerData>;
export type Country = z.infer<typeof Country>;
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
