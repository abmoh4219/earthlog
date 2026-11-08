// pnpm edition [YYYY-MM-DD] [--dry]   (default: yesterday, UTC; --dry writes nothing)
// Finds the day's stories, types each into a lens and ranks them.
// Writes public/editions/<date>/{edition,evidence,sources}.json. Downloads are cached.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Edition } from "../src/scene/edition.ts";
import { NowFile } from "../src/scene/headlines.ts";
import { Country } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";
import { ROOT, readJson, writeJson } from "./bake/lib.ts";
import { fetchCoordinates, fetchPortal, parsePortal, toStories } from "./bake/wikinews.ts";
import { buildEdition, REPEAT_DAYS, secondRoundIds } from "./edition/build.ts";
import { makeCoverage } from "./edition/coverage.ts";
import {
  fetchEntities,
  fetchLinkGraph,
  fetchMostRead,
  fetchNormal,
  fetchQids,
} from "./edition/sources.ts";
import { type Gazetteer, makePlacer } from "./news/place.ts";
import { report } from "./report.ts";

const date =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ??
  new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("usage: pnpm edition [YYYY-MM-DD]");
  process.exit(1);
}
const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const countries = z
  .array(Country)
  .parse(await readJson(join(ROOT, "public", "geo", "countries.json")));

console.log(`edition ${date}`);
// Wikimedia publishes a day's most-read list with a delay that is usually hours and sometimes
// most of a day. Not yet published is not a failure: exit 2, and the next run tries again.
const mostRead = await fetchMostRead(date).catch((err: unknown) => {
  if (/\b404\b/.test(String(err))) {
    console.error(`  most-read list for ${date} not published yet by Wikimedia; try again later`);
    report(
      `- Edition ${date}: Wikimedia has not published the most-read list yet; the next run retries`,
    );
    process.exit(2);
  }
  throw err;
});
await fetchNormal(mostRead, date);
console.log(`  most read: ${mostRead.length} articles, with their normal readership`);

const portal = await fetchPortal(date);
const raw = parsePortal(portal.wikitext);
const coords = await fetchCoordinates(raw.flatMap((r) => r.links));
const news = { raw, ...toStories(date, raw, coords, countries, portal.revid) };
console.log(`  current events: ${raw.length} reported stories`);

const linkedTitles = raw.flatMap((r) => [...(r.topic ? [r.topic] : []), ...r.links]);
const qids = await fetchQids(linkedTitles);
const entities = await fetchEntities([
  ...mostRead.flatMap((m) => (m.qid ? [m.qid] : [])),
  ...qids.values(),
]);
// Types, places and their countries live one or two hops away.
for (let round = 0; round < 2; round++) {
  const more = secondRoundIds(entities);
  if (!more.length) break;
  for (const [k, v] of await fetchEntities(more)) entities.set(k, v);
}
console.log(`  wikidata: ${entities.size} entities`);

const topics = raw.flatMap((r) => (r.topic ? [r.topic] : []));
const links = await fetchLinkGraph([...mostRead.map((m) => m.title), ...topics]);

// --record: save the builder's exact inputs as a test fixture (no network in tests).
if (process.argv.includes("--record")) {
  const file = join(ROOT, "test", "fixtures", `edition-inputs-${date}.json`);
  const bytes = await writeJson(
    file,
    {
      date,
      mostRead,
      news,
      qids: [...qids],
      // Only what the builder reads: keeps the fixture small.
      entities: [...entities.values()].map(({ id, label, items, coord, iso2, died }) => ({
        id,
        ...(label ? { label } : {}),
        items,
        ...(coord ? { coord } : {}),
        ...(iso2 ? { iso2 } : {}),
        ...(died ? { died } : {}),
      })),
      links: [...links].map(([k, v]) => [k, [...v]]),
    },
    false,
  );
  console.log(
    `  recorded inputs → test/fixtures/edition-inputs-${date}.json (${(bytes / 1024).toFixed(0)} KB)`,
  );
}

// The editions of the last REPEAT_DAYS days, so stories already told don't come back unless
// the day's news reports something new about them (ADR-0015).
const editionsDir = join(ROOT, "public", "editions");
const history: { date: string; stories: Edition["stories"] }[] = [];
for (const d of await readdir(editionsDir).catch(() => [])) {
  const age = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000;
  if (!(age >= 1 && age <= REPEAT_DAYS)) continue;
  const past = Edition.safeParse(
    await readJson(join(editionsDir, d, "edition.json")).catch(() => null),
  );
  if (past.success) history.push({ date: d, stories: past.data.stories });
}

// The outlets' headlines collected by pnpm news (public/now/now.json, the last 72 hours): which
// outlets reported each story that day (ADR-0017). Without the file, no coverage; nothing breaks.
const now = NowFile.safeParse(
  await readJson(join(ROOT, "public", "now", "now.json")).catch(() => null),
);
const coverage = now.success
  ? makeCoverage(
      now.data.headlines,
      date,
      makePlacer(
        (await readJson(join(ROOT, "scripts", "news", "places.json"))) as Gazetteer,
        countries,
      ),
    )
  : undefined;
const dayHeadlines = now.success
  ? now.data.headlines.filter((h) => h.t.startsWith(date)).length
  : 0;
console.log(
  `  outlets: ${dayHeadlines} headlines from ${date}${now.success ? "" : " (no public/now/now.json)"}`,
);

const { edition, evidence, sources, repeats } = buildEdition({
  date,
  generatedAt,
  mostRead,
  news,
  qids,
  entities,
  links,
  countries,
  history,
  ...(coverage ? { coverage } : {}),
});
Edition.parse(edition);

// Every story's evidence must exist and come from a credited source: reuse the scene validator
// by checking the citations as if each story were a beat.
const errors = validateBundle({
  scene: {
    version: 1,
    id: `edition-${date}`,
    title: date,
    subtitle: "",
    category: "daily",
    window: { start: `${date}T00:00:00Z`, end: `${date}T23:59:59Z` },
    focus: `${date}T12:00:00Z`,
    timezone: "UTC",
    region: { west: -180, south: -90, east: 180, north: 90 },
    imagery: { day: date, nights: [] },
    layers: [],
    camera: [{ t: `${date}T00:00:00Z`, lon: 0, lat: 0, range: 2e7, heading: 0, pitch: -90 }],
    pacing: [],
    beats: edition.stories.map((s) => ({
      t: `${date}T00:00:00Z`,
      text: s.title,
      cites: s.evidence,
    })),
    time: "real",
    chapters: [],
    panels: [],
    generatedBy: { method: "template", at: generatedAt },
  },
  evidence,
  sources,
});
if (errors.length) {
  console.error(`✗ edition ${date}:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

// --dry: print the picks without writing (to check the rules on a day already published).
const dry = process.argv.includes("--dry");
const dir = join(ROOT, "public", "editions", date);
if (!dry) {
  await writeJson(join(dir, "edition.json"), edition);
  await writeJson(join(dir, "evidence.json"), evidence);
  await writeJson(join(dir, "sources.json"), sources);
} else console.log("  (dry run: nothing written)");

console.log(
  `✓ ${edition.stories.length} stories from ${edition.candidates} candidates → public/editions/${date}/`,
);
const updates = edition.stories.filter((s) => s.update);
if (repeats.length)
  console.log(
    `  left out (told in the last ${REPEAT_DAYS} days, nothing new): ${repeats.join("; ")}`,
  );
report(`### Edition ${date}`);
report(
  `- ${edition.stories.length} stories from ${edition.candidates} candidates; ${updates.length} updates; ${repeats.length} repeats left out`,
);
for (const s of updates) report(`- Update, day ${s.update?.day}: ${s.title}`);
const covered = edition.stories.filter((s) => s.coverage?.length).length;
report(
  `- ${covered}/${edition.stories.length} stories matched to outlets' headlines (${dayHeadlines} headlines that day)`,
);
if (repeats.length) report(`- Left out as repeats: ${repeats.join("; ")}`);
for (const s of edition.stories) {
  const where = s.place ? `${s.place.name}${s.continent ? `, ${s.continent}` : ""}` : "no place";
  const readers = s.readers ? `${(s.readers / 1000).toFixed(0)}k readers` : "news only";
  console.log(
    `  ${String(s.heat).padStart(3)}  ${s.lens.padEnd(12)} ${s.title.slice(0, 48).padEnd(48)} ${readers.padEnd(13)} ${where}${s.update ? `  [update, day ${s.update.day}]` : ""}${s.coverage ? `  [${s.coverage.map((c) => c.outlet).join(", ")}]` : ""}`,
  );
}
