// Build-time loading of bundles and editions from public/ (server only).
// Every file is parsed with Zod: a malformed bundle fails the build, not the visitor.
import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { SceneBundle } from "@/player/store";
import { Edition } from "@/scene/edition";
import { NowFile } from "@/scene/headlines";
import { Evidence, LayerData, Scene, SceneIndexEntry, Source } from "@/scene/schema";

const PUBLIC = join(process.cwd(), "public");
const SCENES_DIR = join(PUBLIC, "scenes");
const EDITIONS_DIR = join(PUBLIC, "editions");

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadIndex(): Promise<SceneIndexEntry[]> {
  return z.array(SceneIndexEntry).parse(await readJson(join(SCENES_DIR, "index.json")));
}

/** A bundle folder: scene.json, evidence.json, sources.json and data/*.json. */
async function loadBundleAt(dir: string): Promise<SceneBundle> {
  const [scene, evidence, sources] = await Promise.all([
    readJson(join(dir, "scene.json")),
    readJson(join(dir, "evidence.json")),
    readJson(join(dir, "sources.json")),
  ]);
  const parsed = Scene.parse(scene);
  // Layer data is small (tens of KB) and baked into the static page with the scene.
  const layers = await Promise.all(
    parsed.layers.map(async (ref) => LayerData.parse(await readJson(join(dir, ref.file)))),
  );
  return {
    scene: parsed,
    evidence: z.array(Evidence).parse(evidence),
    sources: z.array(Source).parse(sources),
    layers,
  };
}

export function loadBundle(id: string): Promise<SceneBundle> {
  return loadBundleAt(join(SCENES_DIR, id));
}

/** Dates with an edition, newest first. */
export async function listEditions(): Promise<string[]> {
  const days = await readdir(EDITIONS_DIR).catch(() => [] as string[]);
  return days
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
}

export async function loadEdition(date: string): Promise<Edition> {
  return Edition.parse(await readJson(join(EDITIONS_DIR, date, "edition.json")));
}

/** Story slugs of an edition that have a film. */
export async function listStoryFilms(date: string): Promise<string[]> {
  const dirs = await readdir(join(EDITIONS_DIR, date, "stories")).catch(() => [] as string[]);
  return dirs.sort();
}

export function loadStoryBundle(date: string, slug: string): Promise<SceneBundle> {
  return loadBundleAt(join(EDITIONS_DIR, date, "stories", slug));
}

/** The outlets' headlines of the last 72 hours (pnpm news), if collected. */
export async function loadNow(): Promise<NowFile | undefined> {
  const parsed = NowFile.safeParse(
    await readJson(join(PUBLIC, "now", "now.json")).catch(() => null),
  );
  return parsed.success ? parsed.data : undefined;
}
