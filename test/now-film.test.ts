import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clusterHeadlines } from "../scripts/news/cluster";
import { buildNowFilm } from "../scripts/news/film";
import { type Gazetteer, makePlacer } from "../scripts/news/place";
import { type Cluster, Headline } from "../src/scene/headlines";
import { Country, Scene } from "../src/scene/schema";
import { validateBundle } from "../src/scene/validate";

const root = join(__dirname, "..");
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));
const placer = makePlacer(
  read("scripts/news/places.json") as Gazetteer,
  z.array(Country).parse(read("public/geo/countries.json")),
);
const headlines = z
  .object({ headlines: z.array(Headline) })
  .parse(read("test/fixtures/headlines-2026-11-08.json")).headlines;
const byId = new Map(headlines.map((h) => [h.id, h]));
const group = clusterHeadlines(headlines, placer).find((g) =>
  g.headlines.some((h) => h.title.includes("Krakow gun attack")),
);
const sorted = [...(group?.headlines ?? [])].sort((a, b) => a.t.localeCompare(b.t));
const cluster: Cluster = {
  id: sorted[0]?.id ?? "",
  title: group?.title ?? "",
  headlines: group?.headlines.map((h) => h.id) ?? [],
  outlets: [...new Set(sorted.map((h) => h.outlet))],
  first: sorted[0]?.t ?? "",
  last: sorted.at(-1)?.t ?? "",
  topic: "crime",
  place: { name: "Kraków", lon: 19.96, lat: 50.06, country: "PL", basis: "city" },
  heat: 100,
  breaking: false,
  context: {
    title: "2026 Kraków shooting",
    url: "https://en.wikipedia.org/w/index.php?title=2026_Krak%C3%B3w_shooting&oldid=1",
    text: "On 7 November 2026, a mass shooting occurred at the Main Square in Kraków, Poland.",
  },
};
const AT = "2026-11-08T17:18:30Z";

describe("a film for a Now story", () => {
  const film = buildNowFilm(cluster, byId, AT);

  it("passes the validator: every caption cited, every citation in the film's window", () => {
    expect(film).toBeDefined();
    if (!film) return;
    expect(Scene.safeParse(film.scene).success).toBe(true);
    expect(validateBundle(film)).toEqual([]);
  });

  it("tells what was reported, where, the background, the outlets' words and the sources", () => {
    expect(film?.scene.chapters.map((c) => c.title)).toEqual([
      "What was reported",
      "Where",
      "Background",
      "In the news",
      "Sources",
    ]);
    expect(film?.scene.title).toBe("2026 Kraków shooting");
  });

  it("quotes only the film's day, one headline per outlet, at day precision", () => {
    const news = film?.evidence.filter((e) => e.id.startsWith("news:")) ?? [];
    expect(news.length).toBeGreaterThanOrEqual(2);
    expect(new Set(news.map((e) => e.source)).size).toBe(news.length);
    for (const e of news) {
      expect(e.t).toBe("2026-11-08T00:00:00Z");
      expect(e.precision).toBe("day");
      expect(e.label).toMatch(/\(\d\d:\d\d UTC\)$/);
    }
  });

  it("credits a headline used as a title to its outlet", () => {
    const plain = buildNowFilm({ ...cluster, context: undefined }, byId, AT);
    expect(plain?.scene.title).toBe(cluster.title);
    expect(plain?.scene.subtitle).toMatch(/headline from /);
    expect(plain?.scene.chapters.map((c) => c.title)).not.toContain("Background");
  });

  it("makes no film when fewer than two outlets reported it that day", () => {
    const one = [...byId.values()].find((h) => h.t.startsWith("2026-11-08"));
    if (!one) throw new Error("fixture");
    expect(
      buildNowFilm(
        { ...cluster, headlines: [one.id], outlets: [one.outlet], last: one.t },
        byId,
        AT,
      ),
    ).toBeUndefined();
  });
});
