import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clusterHeadlines, tokensOf } from "../scripts/news/cluster";
import { type Gazetteer, makePlacer } from "../scripts/news/place";
import { stem, words } from "../scripts/news/text";
import { topicOf } from "../scripts/news/topic";
import { Headline } from "../src/scene/headlines";
import { BREAKING_OUTLETS, heatOf, normalise } from "../src/scene/hot";
import { Country } from "../src/scene/schema";

const root = join(__dirname, "..");
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));
const gazetteer = read("scripts/news/places.json") as Gazetteer;
const countries = z.array(Country).parse(read("public/geo/countries.json"));
const placer = makePlacer(gazetteer, countries);
// 196 real headlines from eight outlets' feeds, recorded on 8 November 2026.
const recorded = z
  .object({ generatedAt: z.string(), headlines: z.array(Headline) })
  .parse(read("test/fixtures/headlines-2026-11-08.json"));
const groups = clusterHeadlines(recorded.headlines, placer);
const groupWith = (fragment: string) =>
  groups.find((g) => g.headlines.some((h) => h.title.includes(fragment)));
const outletsOf = (g: { headlines: Headline[] } | undefined) =>
  new Set(g?.headlines.map((h) => h.outlet));

describe("text", () => {
  it("folds the forms headlines use", () => {
    expect(["mourns", "mourning", "mourned"].map(stem)).toEqual(["mourn", "mourn", "mourn"]);
    expect(stem("launches")).toBe("launch");
    expect(stem("bodies")).toBe("body");
    expect(stem("focus")).toBe("focus");
    expect(words("Krakow's gunman kills six, police say")).toEqual([
      "krakow",
      "gunman",
      "kill",
      "six",
      "polic",
    ]);
    expect(stem("sentenced")).toBe(stem("sentence"));
  });
});

describe("placing headlines", () => {
  const where = (t: string) => placer.place([t]);

  it("finds cities, with or without accents, and possessives", () => {
    expect(where("Gunman kills six in Krakow's main square")).toMatchObject({
      name: "Kraków",
      country: "PL",
      basis: "city",
    });
    expect(where("Train crash near Cairo")).toMatchObject({ name: "Cairo", basis: "city" });
  });

  it("prefers the longest name: South Sudan is not Sudan", () => {
    expect(where("Floods hit South Sudan")?.country).toBe("SS");
  });

  it("reads demonyms, but a named country beats one", () => {
    expect(where("Israeli president tasks Eisenkot")?.country).toBe("IL");
    expect(where("American tourist dies in Thailand")?.country).toBe("TH");
  });

  it("is case-sensitive: the bird is not the country", () => {
    expect(where("Farmers fear a turkey shortage")).toBeUndefined();
  });

  it("gives disputed places no country", () => {
    const gaza = where("Floods in Gaza leave thousands without shelter");
    expect(gaza).toMatchObject({ name: "Gaza Strip", basis: "region" });
    expect(gaza?.country).toBeUndefined();
    expect(where("Drone attack in Crimea")?.country).toBeUndefined();
  });

  it("keeps a city only when the headlines agree with it", () => {
    // Paris named once, Brazil named twice: the story is in Brazil.
    expect(
      placer.place(["Brazil floods: Paris pledges aid", "Brazil counts the dead"])?.country,
    ).toBe("BR");
  });

  it("returns nothing when no place is named", () => {
    expect(where("Trump offers press secretary role to Dana White")).toBeUndefined();
  });
});

describe("topics", () => {
  it("classifies by keywords, at word starts only", () => {
    expect(topicOf([{ title: "Four killed, 88 injured in train collision in Egypt" }])).toBe(
      "disaster",
    );
    expect(topicOf([{ title: "Met Office issues weather warning" }])).not.toBe("conflict");
    expect(topicOf([{ title: "Houthis say 33 killed in Saudi air strike" }])).toBe("conflict");
    expect(topicOf([{ title: "Trump offers press secretary role to Dana White" }])).toBe(
      "politics",
    );
  });

  it("lets a feed's section settle it", () => {
    expect(topicOf([{ title: "Tenerife honour teammate with tribute", section: "Sport" }])).toBe(
      "sports",
    );
  });

  it("falls back to world", () => {
    expect(topicOf([{ title: "A quiet day" }])).toBe("world");
  });
});

describe("clustering recorded headlines", () => {
  it("tells the Krakow shooting as one story from six outlets, placed in Kraków", () => {
    const g = groupWith("Krakow gun attack");
    expect(outletsOf(g)).toEqual(
      new Set(["bbc", "guardian", "france24", "aljazeera", "dw", "sky"]),
    );
    // Al Jazeera's headline never names Krakow; it joins through its words.
    expect(g?.headlines.some((h) => h.title.startsWith("Poland mourns six killed"))).toBe(true);
    expect(placer.place(g?.headlines.map((h) => h.title) ?? [])?.name).toBe("Kraków");
  });

  it("groups the Egypt train crash despite different tolls in each headline", () => {
    expect(outletsOf(groupWith("train crash near Cairo")).size).toBe(4);
  });

  it("matches words across outlets' phrasing (sect / cult)", () => {
    expect(outletsOf(groupWith("Kenyan doomsday sect leader")).has("bbc")).toBe(true);
  });

  it("does not join stories that only share a place or a theme", () => {
    const riyadh = groupWith("Aramco skyscraper in Riyadh");
    expect(riyadh?.headlines.some((h) => h.title.includes("humanitarian crisis"))).toBe(false);
    const democrats = groupWith("Democrats’ congressional win");
    expect(democrats?.headlines.some((h) => h.title.includes("power network"))).toBe(false);
  });

  it("keeps every headline exactly once and no group runs away", () => {
    const all = groups.flatMap((g) => g.headlines.map((h) => h.id));
    expect(new Set(all).size).toBe(recorded.headlines.length);
    expect(all).toHaveLength(recorded.headlines.length);
    expect(Math.max(...groups.map((g) => g.headlines.length))).toBeLessThanOrEqual(30);
  });

  it("canonical place tokens replace the words they came from", () => {
    const t = tokensOf("Floods hit Yemen's capital", placer);
    expect(t.has("@ye")).toBe(true);
    expect(t.has("yemen")).toBe(false);
  });
});

describe("heat", () => {
  const h = (outlet: string, minutesAgo: number, now: number): Headline => ({
    id: `${outlet}${minutesAgo}`
      .padEnd(12, "0")
      .slice(0, 12)
      .replace(/[^a-f0-9]/g, "a"),
    outlet,
    title: "x",
    url: "https://x.org",
    t: new Date(now - minutesAgo * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    seen: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
  });
  const now = Date.parse("2026-11-08T12:00:00Z");

  it("is breaking only when several outlets report a new story within two hours", () => {
    const fresh = ["bbc", "dw", "npr"].map((o, i) => h(o, 30 + i * 10, now));
    expect(fresh.length).toBe(BREAKING_OUTLETS);
    expect(heatOf(fresh, now).breaking).toBe(true);
    expect(heatOf(fresh.slice(0, 2), now).breaking).toBe(false);
    const old = ["bbc", "dw", "npr"].map((o) => h(o, 300, now));
    expect(heatOf(old, now).breaking).toBe(false);
  });

  it("rewards breadth and freshness, and fades", () => {
    const wide = heatOf(
      ["bbc", "dw", "npr", "sky"].map((o) => h(o, 60, now)),
      now,
    ).raw;
    const narrow = heatOf([h("bbc", 60, now)], now).raw;
    const stale = heatOf(
      ["bbc", "dw", "npr", "sky"].map((o) => h(o, 24 * 60, now)),
      now,
    ).raw;
    expect(wide).toBeGreaterThan(narrow);
    expect(wide).toBeGreaterThan(stale);
    expect(normalise([wide, narrow])).toEqual([100, Math.round((narrow / wide) * 100)]);
  });
});
