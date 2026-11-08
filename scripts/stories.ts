// pnpm stories [YYYY-MM-DD] [slug]   (default: yesterday, every story)
// Films each story of an edition with its lens → public/editions/<date>/stories/<slug>/.
// Run `pnpm edition <date>` first. Every film passes the validator before it is written.
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Edition } from "../src/scene/edition.ts";
import { Country, Evidence, LayerData, Scene, Source } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";
import { ROOT, readJson, writeJson } from "./bake/lib.ts";
import {
  editionPortalRevision,
  fetchPortal,
  newsMismatches,
  parsePortal,
} from "./bake/wikinews.ts";
import { captionIssues } from "./lenses/editor.ts";
import { layerKey } from "./lenses/film.ts";
import { LENS_FILMS } from "./lenses/index.ts";
import { revisionCutoff, setRevisionCutoff } from "./lenses/news-context.ts";
import { report } from "./report.ts";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const date = args[0] ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const only = args[1];
const dir = join(ROOT, "public", "editions", date);
// Fresh for three days, then frozen at the articles as of the end of day 3 (ADR-0014).
const cutoff = revisionCutoff(date);
// "Data as of": now while the edition is fresh, the freeze moment once it is frozen.
const at = cutoff ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
setRevisionCutoff(cutoff);
console.log(
  cutoff
    ? `Articles as of ${cutoff} (frozen edition)`
    : "Articles: latest revisions (fresh edition)",
);

const edition = Edition.parse(await readJson(join(dir, "edition.json")));
const evidence = z.array(Evidence).parse(await readJson(join(dir, "evidence.json")));
const editionSources = z
  .array(Source)
  .parse(await readJson(join(dir, "sources.json")).catch(() => []));
const countries = z
  .array(Country)
  .parse(await readJson(join(ROOT, "public", "geo", "countries.json")));
// The exact Current events revision the edition was built from: its item numbers are the ids
// of the edition's news evidence. Each item must still read as the edition quoted it.
const portalRevision = editionPortalRevision(date, evidence);
const news = parsePortal((await fetchPortal(date, portalRevision)).wikitext);
const mismatched = newsMismatches(date, evidence, news);
if (mismatched.length) {
  console.error(
    `✗ Current events items no longer match the edition's quotes (${mismatched.join(", ")}): films not made`,
  );
  process.exit(1);
}

let failed = 0;
let issues = 0;
const headlines = new Map<string, string>();
for (const story of edition.stories) {
  if (only && story.slug !== only) continue;
  try {
    const film = await LENS_FILMS[story.lens]({ date, story, evidence, news, countries, at });
    // The "In the news" chapter cites the outlets' headlines: bring their evidence and the
    // outlets' credits over from the edition (ADR-0017).
    for (const c of story.coverage ?? []) {
      const e = evidence.find((x) => x.id === c.evidence);
      // A film's window is its day in story time: the headline is cited as reported that day,
      // its exact time kept in the label.
      if (e && !film.evidence.some((x) => x.id === e.id))
        film.evidence.push({
          ...e,
          t: `${date}T00:00:00Z`,
          precision: "day",
          label: `${e.label} (${e.t.slice(11, 16)} UTC)`,
        });
      const src = editionSources.find((x) => x.id === e?.source);
      if (src && !film.sources.some((x) => x.id === src.id)) film.sources.push(src);
    }
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
    // The quality check: what a reader would trip on (ADR-0019). Reported, never hidden.
    const found = captionIssues(
      film.scene.beats.map((b) => b.text),
      story.title,
    );
    issues += found.length;
    for (const f of found)
      console.log(`    caption ${f.index + 1} (${f.kind}): ${f.text.slice(0, 90)}`);
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

report(
  `- Films ${date}: ${headlines.size} made${failed ? `, **${failed} failed** (those stories show as text only)` : ""}; ${issues} caption issues`,
);
if (failed) process.exit(1);
