// pnpm stories [YYYY-MM-DD] [slug]   (default: yesterday, every story)
// Films each story of an edition with its lens → public/editions/<date>/stories/<slug>/.
// Run `pnpm edition <date>` first. Every film passes the validator before it is written.
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Edition, type Lens } from "../src/scene/edition.ts";
import { Country, Evidence, LayerData, Scene, Source } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";
import { ROOT, readJson, writeJson } from "./bake/lib.ts";
import { fetchPortal, parsePortal } from "./bake/wikinews.ts";
import { economyLens } from "./lenses/economy.ts";
import { electionLens } from "./lenses/election/index.ts";
import { layerKey } from "./lenses/film.ts";
import { generalLens, type LensContext, type LensResult } from "./lenses/general.ts";
import { organizationLens } from "./lenses/organization.ts";
import { personLens } from "./lenses/person.ts";

/** Which lens films which kind of story. Specialised lenses replace `general` phase by phase. */
const LENS_FILMS: Record<Lens, (ctx: LensContext) => Promise<LensResult>> = {
  election: electionLens,
  conflict: generalLens,
  accident: generalLens,
  disaster: generalLens,
  sports: generalLens,
  economy: economyLens,
  science: generalLens,
  culture: generalLens,
  organization: organizationLens,
  person: personLens,
  general: generalLens,
};

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const date = args[0] ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const only = args[1];
const dir = join(ROOT, "public", "editions", date);
const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const edition = Edition.parse(await readJson(join(dir, "edition.json")));
const evidence = z.array(Evidence).parse(await readJson(join(dir, "evidence.json")));
const countries = z
  .array(Country)
  .parse(await readJson(join(ROOT, "public", "geo", "countries.json")));
const news = parsePortal((await fetchPortal(date)).wikitext);

let failed = 0;
const headlines = new Map<string, string>();
for (const story of edition.stories) {
  if (only && story.slug !== only) continue;
  try {
    const film = await LENS_FILMS[story.lens]({ date, story, evidence, news, countries, at });
    // Schema first (ids, formats), then the cross-file rules: what the site will load must parse.
    Scene.parse(film.scene);
    z.array(Evidence).parse(film.evidence);
    z.array(Source).parse(film.sources);
    for (const layer of film.layers) LayerData.parse(layer);
    const errors = validateBundle({
      scene: film.scene,
      evidence: film.evidence,
      sources: film.sources,
    });
    if (errors.length) throw new Error(errors.join("; "));
    const out = join(dir, "stories", story.slug);
    await rm(out, { recursive: true, force: true }); // no stale layer files from older films
    let bytes = 0;
    for (const layer of film.layers)
      bytes += await writeJson(join(out, "data", `${layerKey(layer)}.json`), layer, false);
    bytes += await writeJson(join(out, "scene.json"), film.scene);
    bytes += await writeJson(join(out, "evidence.json"), film.evidence);
    bytes += await writeJson(join(out, "sources.json"), film.sources);
    const first = film.scene.beats[0]?.text;
    if (first) headlines.set(story.slug, first);
    const secs = (Date.parse(film.scene.window.end) - Date.parse(film.scene.window.start)) / 1000;
    console.log(
      `✓ ${story.slug.padEnd(44)} ${story.lens.padEnd(12)} ${film.scene.chapters.length} chapters, ${film.scene.panels.length} panels, ${secs}s, ${(bytes / 1024).toFixed(0)} KB`,
    );
  } catch (err) {
    failed++;
    console.error(`✗ ${story.slug}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
// The edition page shows each story's headline: the first sentence of its film.
await writeJson(join(dir, "edition.json"), {
  ...edition,
  stories: edition.stories.map((s) =>
    headlines.has(s.slug) ? { ...s, headline: headlines.get(s.slug) } : s,
  ),
});

if (failed) process.exit(1);
