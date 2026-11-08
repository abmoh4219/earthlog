// pnpm news   (run every few hours by .github/workflows/news.yml)
// Reads every outlet's official feed, keeps the last 72 hours of headlines (headline, link,
// time only; ADR-0017), groups them into stories, places and tags each, scores how hot it is,
// and writes public/now/now.json: the site's "Now" view and the edition's coverage source.
// A feed that fails is reported and skipped; its earlier headlines stay until they age out.
import { join } from "node:path";
import { z } from "zod";
import { type Cluster, type Headline, NowFile } from "../src/scene/headlines.ts";
import { OUTLETS } from "../src/scene/outlets.ts";
import { Country } from "../src/scene/schema.ts";
import { ROOT, readJson, USER_AGENT, writeJson } from "./bake/lib.ts";
import { clusterHeadlines } from "./news/cluster.ts";
import { parseFeed } from "./news/feeds.ts";
import { heatOf, normalise } from "./news/hot.ts";
import { type Gazetteer, makePlacer } from "./news/place.ts";
import { topicOf } from "./news/topic.ts";
import { report } from "./report.ts";

const KEEP_MS = 72 * 3_600_000;
const FILE = join(ROOT, "public", "now", "now.json");
const now = Date.now();
const seen = new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z");

const previous = NowFile.safeParse(await readJson(FILE).catch(() => null));
const known = new Map<string, Headline>(
  previous.success ? previous.data.headlines.map((h) => [h.id, h]) : [],
);

const status: NowFile["outlets"] = [];
for (const outlet of OUTLETS) {
  try {
    const res = await fetch(outlet.feed, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const items = parseFeed(await res.text(), outlet.id, seen);
    for (const h of items) {
      const before = known.get(h.id);
      // First sight wins: a re-dated item keeps the time we first saw it.
      known.set(h.id, before ? { ...h, seen: before.seen } : h);
    }
    status.push({ id: outlet.id, ok: true, items: items.length });
    console.log(`  ${outlet.name}: ${items.length} headlines`);
  } catch (err) {
    status.push({ id: outlet.id, ok: false, items: 0 });
    console.log(`  ${outlet.name}: failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

const headlines = [...known.values()]
  .filter((h) => now - Date.parse(h.t) <= KEEP_MS)
  .sort((a, b) => b.t.localeCompare(a.t));

const gazetteer = (await readJson(join(ROOT, "scripts", "news", "places.json"))) as Gazetteer;
const countries = z
  .array(Country)
  .parse(await readJson(join(ROOT, "public", "geo", "countries.json")));
const placer = makePlacer(gazetteer, countries);

const groups = clusterHeadlines(headlines, placer);
const heats = groups.map((g) => heatOf(g.headlines, now));
const heat = normalise(heats.map((h) => h.raw));
const clusters: Cluster[] = groups
  .map((g, i): Cluster => {
    const oldest = [...g.headlines].sort((a, b) => a.t.localeCompare(b.t));
    const outlets = [...new Set(oldest.map((h) => h.outlet))];
    const place = placer.place(g.headlines.map((h) => h.title));
    return {
      id: oldest[0]?.id ?? "",
      title: g.title,
      headlines: g.headlines.map((h) => h.id),
      outlets,
      first: oldest[0]?.t ?? seen,
      last: g.headlines[0]?.t ?? seen,
      topic: topicOf(g.headlines),
      ...(place ? { place } : {}),
      heat: heat[i] ?? 0,
      breaking: heats[i]?.breaking ?? false,
    };
  })
  .sort((a, b) => b.heat - a.heat || b.last.localeCompare(a.last));

const file = NowFile.parse({ version: 1, generatedAt: seen, outlets: status, headlines, clusters });
const bytes = await writeJson(FILE, file, false);

const multi = clusters.filter((c) => c.outlets.length > 1);
console.log(
  `✓ ${headlines.length} headlines, ${clusters.length} stories (${multi.length} told by 2+ outlets) → public/now/now.json (${(bytes / 1024).toFixed(0)} KB)`,
);
for (const c of clusters.slice(0, 12))
  console.log(
    `  ${String(c.heat).padStart(3)} ${c.breaking ? "BREAKING " : ""}${c.topic.padEnd(9)} ${String(c.outlets.length).padStart(2)} outlets  ${c.title.slice(0, 70)}  · ${c.place ? `${c.place.name} (${c.place.basis})` : "no place"}`,
  );

const failed = status.filter((s) => !s.ok).map((s) => s.id);
report(`### News ${seen}`);
report(
  `- ${headlines.length} headlines from ${status.length - failed.length}/${status.length} outlets; ${multi.length} stories told by 2+ outlets${failed.length ? `; **failed: ${failed.join(", ")}**` : ""}`,
);
