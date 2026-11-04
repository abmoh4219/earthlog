// pnpm validate:scenes: every committed bundle must parse and pass the validator (CI runs this).
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Edition } from "../src/scene/edition.ts";
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
// Editions: every story's evidence exists and comes from a credited source.
const EDITIONS = join(import.meta.dirname, "..", "public", "editions");
const days = await readdir(EDITIONS).catch(() => [] as string[]);
for (const day of days.sort()) {
  const dir = join(EDITIONS, day);
  try {
    const edition = Edition.parse(await read(join(dir, "edition.json")));
    const evidence = z.array(Evidence).parse(await read(join(dir, "evidence.json")));
    const sources = z.array(Source).parse(await read(join(dir, "sources.json")));
    const ids = new Set(evidence.map((e) => e.id));
    const sourceIds = new Set(sources.map((s) => s.id));
    const errors = [
      ...edition.stories.flatMap((s) =>
        s.evidence.filter((id) => !ids.has(id)).map((id) => `${s.slug}: unknown evidence ${id}`),
      ),
      ...evidence
        .filter((e) => !sourceIds.has(e.source))
        .map((e) => `${e.id}: unknown source ${e.source}`),
      ...sources.filter((s) => !s.license.trim()).map((s) => `source ${s.id}: missing licence`),
    ];
    if (edition.date !== day) errors.push(`edition date ${edition.date} ≠ folder ${day}`);
    // Story films: each one is a full bundle and passes the same validator as classics.
    const films = await readdir(join(dir, "stories")).catch(() => [] as string[]);
    for (const slug of films) {
      const f = join(dir, "stories", slug);
      const scene = Scene.parse(await read(join(f, "scene.json")));
      const ev = z.array(Evidence).parse(await read(join(f, "evidence.json")));
      const src = z.array(Source).parse(await read(join(f, "sources.json")));
      for (const e of validateBundle({ scene, evidence: ev, sources: src }))
        errors.push(`${slug}: ${e}`);
      for (const layer of scene.layers) {
        const data = LayerData.safeParse(await read(join(f, layer.file)).catch(() => null));
        if (!data.success) errors.push(`${slug}: layer ${layer.file} invalid or missing`);
      }
      if (!edition.stories.some((s) => s.slug === slug)) errors.push(`${slug}: not in the edition`);
    }
    if (errors.length) {
      failed++;
      console.error(`✗ edition ${day}\n  ${errors.join("\n  ")}`);
    } else {
      console.log(
        `✓ edition ${day}: ${edition.stories.length} stories, ${films.length} films, all cited`,
      );
    }
  } catch (err) {
    failed++;
    console.error(`✗ edition ${day}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failed) process.exit(1);
