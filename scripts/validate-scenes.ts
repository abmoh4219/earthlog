// pnpm validate:scenes: every committed bundle must parse and pass the validator (CI runs this).
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Evidence, LayerData, Scene, SceneIndexEntry, Source } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";

const SCENES = join(import.meta.dirname, "..", "public", "scenes");
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

let failed = 0;
const index = z.array(SceneIndexEntry).parse(await read(join(SCENES, "index.json")));
for (const entry of index) {
  const dir = join(SCENES, entry.id);
  try {
    const scene = Scene.parse(await read(join(dir, "scene.json")));
    const evidence = z.array(Evidence).parse(await read(join(dir, "evidence.json")));
    const sources = z.array(Source).parse(await read(join(dir, "sources.json")));
    const errors = validateBundle({ scene, evidence, sources });
    for (const layer of scene.layers) {
      const file = join(dir, layer.file);
      await access(file).catch(() => errors.push(`layer file missing: ${layer.file}`));
      const data = LayerData.safeParse(await read(file).catch(() => null));
      if (!data.success) errors.push(`layer ${layer.file}: ${data.error.message}`);
      else if (data.data.kind !== layer.kind) errors.push(`layer ${layer.file}: kind mismatch`);
    }
    if (scene.id !== entry.id) errors.push(`scene id "${scene.id}" ≠ index id "${entry.id}"`);
    if (errors.length) {
      failed++;
      console.error(`✗ ${entry.id}\n  ${errors.join("\n  ")}`);
    } else {
      console.log(`✓ ${entry.id}: ${scene.beats.length} beats, all cited`);
    }
  } catch (err) {
    failed++;
    console.error(`✗ ${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
if (failed) process.exit(1);
