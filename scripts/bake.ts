// pnpm bake <event-id>   → data, evidence, sources and a template scene in public/scenes/<id>/
// pnpm bake countries    → public/geo/countries.json (Natural Earth, shared by every scene)
// Downloads are cached in .cache/, so a re-bake is offline and instant.
import { join } from "node:path";
import { z } from "zod";
import { EventDef } from "../events/types.ts";
import {
  Country,
  type Evidence,
  type LayerData,
  SceneIndexEntry,
  type SignalLayer,
  type Source,
} from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";
import { NATURAL_EARTH_URL, reduceCountries } from "./bake/countries.ts";
import {
  BASELINE_WEEKS,
  baselined,
  fetchIoda,
  iodaSource,
  SIGNAL_INFO,
  signalEvidence,
  toSeries,
} from "./bake/ioda.ts";
import { fetchJson, ROOT, readJson, writeJson } from "./bake/lib.ts";
import { fetchQuakes, usgsSource } from "./bake/usgs.ts";
import { templateScene } from "./director/template.ts";

const SCENES = join(ROOT, "public", "scenes");
const BUDGET_BYTES = 5 * 1024 * 1024;

async function bakeCountries() {
  const countries = reduceCountries(await fetchJson(NATURAL_EARTH_URL));
  const bytes = await writeJson(join(ROOT, "public", "geo", "countries.json"), countries, false);
  console.log(`countries: ${countries.length} → public/geo/countries.json (${kb(bytes)})`);
}

async function countryNames(): Promise<Map<string, string>> {
  const file = join(ROOT, "public", "geo", "countries.json");
  const countries = z.array(Country).parse(await readJson(file));
  return new Map(countries.map((c) => [c.code, c.name]));
}

async function bakeEvent(id: string) {
  const mod: { default: unknown } = await import(join(ROOT, "events", `${id}.ts`));
  const def = EventDef.parse(mod.default);
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const dir = join(SCENES, def.id);
  const evidence: Evidence[] = [];
  const sources: Source[] = [];
  const layers: LayerData[] = [];
  const startS = Date.parse(def.window.start) / 1000;
  const endS = Date.parse(def.window.end) / 1000;

  if (def.signal) {
    const { kind, tone, countries } = def.signal;
    const series: SignalLayer["series"] = [];
    let copyright = "";
    // Plain names from Natural Earth ("Iran", not IODA's "Iran (Islamic Republic Of)").
    const names = await countryNames();
    for (const code of countries) {
      const res = await fetchIoda(code, kind, startS, endS);
      copyright = res.copyright;
      const b = baselined(res.signal, startS, endS);
      const name = names.get(code) ?? res.signal.entityName;
      series.push(toSeries(code, name, b));
      evidence.push(...signalEvidence(code, name, kind, b, def.window.start));
      const gaps = b.ratio.filter((r) => r === null).length;
      console.log(`  ioda ${code} ${kind}: ${b.ratio.length} samples, ${gaps} gaps`);
    }
    const stepMin = (series[0]?.step ?? 0) / 60;
    layers.push({
      kind: "outages",
      signal: kind,
      label: SIGNAL_INFO[kind].label,
      tone,
      baseline: `"Normal" is the median of the same ${stepMin}-minute slot on the same weekday over the ${BASELINE_WEEKS} previous weeks.`,
      series,
    });
    sources.push(iodaSource(copyright, now));
  }

  if (def.quakes) {
    const { quakes, evidence: ev } = await fetchQuakes({
      start: def.window.start.replace("Z", ""),
      end: def.window.end.replace("Z", ""),
      region: def.region,
      minMagnitude: def.quakes.minMagnitude,
    });
    console.log(`  usgs: ${quakes.length} quakes ≥ M${def.quakes.minMagnitude}`);
    layers.push({ kind: "quakes", quakes });
    evidence.push(...ev);
    sources.push(usgsSource(now));
  }

  const scene = templateScene(def, evidence, layers, now);
  const errors = validateBundle({ scene, evidence, sources });
  if (errors.length) {
    console.error(`✗ ${def.id} failed validation:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }

  let bytes = 0;
  for (const layer of layers)
    bytes += await writeJson(join(dir, "data", `${layer.kind}.json`), layer, false);
  bytes += await writeJson(join(dir, "evidence.json"), evidence);
  bytes += await writeJson(join(dir, "sources.json"), sources);
  bytes += await writeJson(join(dir, "scene.json"), scene);
  await updateIndex({
    id: def.id,
    title: def.title,
    subtitle: def.subtitle,
    category: def.category,
    date: def.window.start.slice(0, 10),
    listed: def.listed,
  });

  console.log(
    `✓ ${def.id}: ${scene.beats.length} beats, ${evidence.length} evidence items, ${kb(bytes)}`,
  );
  if (bytes > BUDGET_BYTES) {
    console.error(`✗ bundle is over the 5 MB budget (CLAUDE.md §5)`);
    process.exit(1);
  }
}

async function updateIndex(entry: SceneIndexEntry) {
  const file = join(SCENES, "index.json");
  const index = z.array(SceneIndexEntry).parse(await readJson(file));
  const next = [...index.filter((e) => e.id !== entry.id), entry].sort((a, b) =>
    a.id === "sample" ? 1 : b.id === "sample" ? -1 : b.date.localeCompare(a.date),
  );
  await writeJson(file, next);
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

const target = process.argv[2];
if (!target) {
  console.error("usage: pnpm bake <event-id> | countries | all");
  process.exit(1);
}
if (target === "countries") await bakeCountries();
else if (target === "all") {
  for (const id of ["iberia-2025", "worldcup-2022", "iran-2025", "myanmar-2025"]) {
    console.log(id);
    await bakeEvent(id);
  }
} else await bakeEvent(target);
