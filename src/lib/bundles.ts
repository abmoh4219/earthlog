// Build-time loading of scene bundles from public/scenes (server only).
// Every file is parsed with Zod: a malformed bundle fails the build, not the visitor.
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { SceneBundle } from "@/player/store";
import { Evidence, LayerData, Scene, SceneIndexEntry, Source } from "@/scene/schema";

const SCENES_DIR = join(process.cwd(), "public", "scenes");

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadIndex(): Promise<SceneIndexEntry[]> {
  return z.array(SceneIndexEntry).parse(await readJson(join(SCENES_DIR, "index.json")));
}

export async function loadBundle(id: string): Promise<SceneBundle> {
  const dir = join(SCENES_DIR, id);
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
