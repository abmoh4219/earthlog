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
  type Scene,
  SceneIndexEntry,
  type SignalLayer,
  type Source,
} from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";
import { NATURAL_EARTH_URL, reduceCountries } from "./bake/countries.ts";
import { eonetSource, fetchStorms } from "./bake/eonet.ts";
import {
  BASELINE_WEEKS,
  baselined,
  fetchIoda,
  fetchOutageCandidates,
  iodaSource,
  SIGNAL_INFO,
  signalEvidence,
  toSeries,
} from "./bake/ioda.ts";
import { fetchJson, ROOT, readJson, writeJson } from "./bake/lib.ts";
import { fetchQuakes, usgsSource } from "./bake/usgs.ts";
import {
  fetchCoordinates,
  fetchPortal,
  parsePortal,
  toStories,
  wikinewsSource,
} from "./bake/wikinews.ts";
import { dailyScene } from "./director/daily.ts";
import { templateScene } from "./director/template.ts";

const SCENES = join(ROOT, "public", "scenes");
const BUDGET_BYTES = 5 * 1024 * 1024;

async function bakeCountries() {
  const countries = reduceCountries(await fetchJson(NATURAL_EARTH_URL));
  const bytes = await writeJson(join(ROOT, "public", "geo", "countries.json"), countries, false);
  console.log(`countries: ${countries.length} → public/geo/countries.json (${kb(bytes)})`);
}

async function loadCountries(): Promise<Country[]> {
  return z.array(Country).parse(await readJson(join(ROOT, "public", "geo", "countries.json")));
}

async function countryNames(): Promise<Map<string, string>> {
  return new Map((await loadCountries()).map((c) => [c.code, c.name]));
}

/** Countries whose outage signal must drop at least this far to make the daily replay. */
const DAILY_OUTAGE_DROP = 0.85;
const DAILY_OUTAGE_MAX = 4;

async function bakeDaily(date: string) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const id = `daily-${date}`;
  const dir = join(SCENES, id);
  const start = `${date}T00:00:00Z`;
  const end = new Date(Date.parse(start) + 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const startS = Date.parse(start) / 1000;
  const endS = Date.parse(end) / 1000;
  const evidence: Evidence[] = [];
  const sources: Source[] = [];
  const layers: LayerData[] = [];
  const countries = await loadCountries();

  // News: the day's stories, placed and categorised.
  const portal = await fetchPortal(date);
  const raw = parsePortal(portal.wikitext);
  const coords = await fetchCoordinates(raw.flatMap((r) => r.links));
  const news = toStories(date, raw, coords, countries, portal.revid);
  layers.push({ kind: "news", date, stories: news.stories });
  evidence.push(...news.evidence);
  sources.push(wikinewsSource(date, portal.revid, now));
  const placed = news.stories.filter((s) => s.place).length;
  console.log(`  news: ${news.stories.length} stories, ${placed} placed on the map`);

  // Earthquakes worldwide.
  const q = await fetchQuakes({
    start: start.replace("Z", ""),
    end: end.replace("Z", ""),
    region: { west: -180, south: -90, east: 180, north: 90 },
    minMagnitude: 4.5,
  });
  if (q.quakes.length) {
    layers.push({ kind: "quakes", quakes: q.quakes });
    evidence.push(...q.evidence);
    sources.push(usgsSource(now));
  }
  console.log(`  usgs: ${q.quakes.length} quakes ≥ M4.5`);

  // Storms.
  const st = await fetchStorms(date, start, end);
  if (st.storms.length) {
    layers.push({ kind: "storms", storms: st.storms });
    evidence.push(...st.evidence);
    sources.push(eonetSource(now));
  }
  console.log(`  eonet: ${st.storms.length} storms`);

  // Internet outages: IODA's flagged countries, kept only if their own signal really fell.
  const candidates = await fetchOutageCandidates(startS, endS);
  const series: SignalLayer["series"] = [];
  let copyright = "";
  for (const c of candidates.slice(0, 8)) {
    if (series.length >= DAILY_OUTAGE_MAX) break;
    try {
      const res = await fetchIoda(c.code, "ping-slash24", startS, endS);
      const b = baselined(res.signal, startS, endS);
      const known = b.ratio.filter((r): r is number => r !== null);
      if (known.length < b.ratio.length / 2 || Math.min(...known) >= DAILY_OUTAGE_DROP) continue;
      const name = countries.find((x) => x.code === c.code)?.name ?? c.name;
      copyright = res.copyright;
      series.push(toSeries(c.code, name, b));
      evidence.push(...signalEvidence(c.code, name, "ping-slash24", b, start));
    } catch (err) {
      console.log(
        `  ioda ${c.code}: skipped (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }
  if (series.length) {
    layers.push({
      kind: "outages",
      signal: "ping-slash24",
      label: SIGNAL_INFO["ping-slash24"].label,
      tone: "loss",
      baseline: `"Normal" is the median of the same 10-minute slot on the same weekday over the ${BASELINE_WEEKS} previous weeks.`,
      series,
    });
    sources.push(iodaSource(copyright, now));
  }
  console.log(`  ioda: ${candidates.length} flagged countries, ${series.length} with a real drop`);

  const scene = dailyScene(date, evidence, layers, now);
  await writeBundle(dir, scene, evidence, sources, layers, {
    id,
    title: scene.title,
    subtitle: scene.subtitle,
    category: "daily",
    date,
    listed: true,
  });
}

async function writeBundle(
  dir: string,
  scene: Scene,
  evidence: Evidence[],
  sources: Source[],
  layers: LayerData[],
  entry: SceneIndexEntry,
) {
  const errors = validateBundle({ scene, evidence, sources });
  if (errors.length) {
    console.error(`✗ ${scene.id} failed validation:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  let bytes = 0;
  for (const layer of layers)
    bytes += await writeJson(join(dir, "data", `${layer.kind}.json`), layer, false);
  bytes += await writeJson(join(dir, "evidence.json"), evidence);
  bytes += await writeJson(join(dir, "sources.json"), sources);
  bytes += await writeJson(join(dir, "scene.json"), scene);
  await updateIndex(entry);
  console.log(
    `✓ ${scene.id}: ${scene.beats.length} beats, ${evidence.length} evidence items, ${kb(bytes)}`,
  );
  if (bytes > BUDGET_BYTES) {
    console.error("✗ bundle is over the 5 MB budget (CLAUDE.md §5)");
    process.exit(1);
  }
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
  await writeBundle(dir, scene, evidence, sources, layers, {
    id: def.id,
    title: def.title,
    subtitle: def.subtitle,
    category: def.category,
    date: def.window.start.slice(0, 10),
    listed: def.listed,
  });
}

async function updateIndex(entry: SceneIndexEntry) {
  const file = join(SCENES, "index.json");
  const index = z.array(SceneIndexEntry).parse(await readJson(file));
  const next = [...index.filter((e) => e.id !== entry.id), entry].sort((a, b) =>
    a.id === "sample"
      ? 1
      : b.id === "sample"
        ? -1
        : b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  await writeJson(file, next);
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

const target = process.argv[2];
if (!target) {
  console.error("usage: pnpm bake <event-id> | all | countries | daily [YYYY-MM-DD]");
  process.exit(1);
}
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
if (target === "countries") await bakeCountries();
else if (target === "daily") await bakeDaily(process.argv[3] ?? yesterday());
else if (target === "all") {
  for (const id of ["iberia-2025", "worldcup-2022", "iran-2025", "myanmar-2025"]) {
    console.log(id);
    await bakeEvent(id);
  }
} else await bakeEvent(target);
