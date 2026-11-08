import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  acceptArticle,
  cleanLead,
  isRegionLead,
  matchFilms,
  searchTerms,
} from "../scripts/news/context";
import { type Gazetteer, makePlacer } from "../scripts/news/place";
import type { EditionStory } from "../src/scene/edition";
import { Headline } from "../src/scene/headlines";
import { Country } from "../src/scene/schema";

const root = join(__dirname, "..");
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));
const placer = makePlacer(
  read("scripts/news/places.json") as Gazetteer,
  z.array(Country).parse(read("public/geo/countries.json")),
);
const eisenkot = [
  "Israel's president tasks opposition leader Eisenkot with forming government",
  "Israel’s president picks Yashar leader Gadi Eisenkot to form government",
  "Israeli president tasks Gadi Eisenkot with forming government",
];

describe("background from Wikipedia", () => {
  it("searches with the names the headlines repeat", () => {
    expect(searchTerms(eisenkot).split(" ")).toContain("Eisenkot");
  });

  it("accepts an article only when every word of its title is in the headlines", () => {
    expect(acceptArticle("Gadi Eisenkot", eisenkot, placer)).toBe(true);
    expect(acceptArticle("Gadi Eisenkot (politician)", eisenkot, placer)).toBe(true);
    expect(acceptArticle("Benny Gantz", eisenkot, placer)).toBe(false);
    expect(
      acceptArticle(
        "2026 Kraków shooting",
        ["Poland launches terrorism probe into mass shooting in Krakow"],
        placer,
      ),
    ).toBe(true);
  });

  it("rejects everyday words, unsupported disambiguations and stale years", () => {
    expect(
      acceptArticle("Progress", ["Cop31 must deliver climate progress, host says"], placer),
    ).toBe(false);
    expect(acceptArticle("Stimulant", ["Stimulant overdoses on the rise"], placer)).toBe(false);
    expect(acceptArticle("Diwali", ["Photos: Diwali celebrations light up India"], placer)).toBe(
      true,
    );
    expect(
      acceptArticle(
        "Backlash (2024)",
        ["US voters reject AI data centres: could the backlash spread?"],
        placer,
      ),
    ).toBe(false);
    expect(
      acceptArticle("Opposition (politics)", ["Israeli opposition leader warns of crisis"], placer),
    ).toBe(false);
    expect(
      acceptArticle(
        "2014–15 La Liga",
        ["LIVE: Atletico Madrid vs Barcelona – La Liga"],
        placer,
        2026,
      ),
    ).toBe(false);
    expect(
      acceptArticle("2026 WTA Finals", ["Rybakina withdraws from WTA Finals"], placer, 2026),
    ).toBe(true);
  });

  it("never takes a place, a list or a year page", () => {
    expect(acceptArticle("Israel", eisenkot, placer)).toBe(false);
    expect(acceptArticle("2026 in Kenya", ["Kenya: cult leader sentenced in 2026"], placer)).toBe(
      false,
    );
    expect(acceptArticle("List of Israeli governments", ["Israeli governments list"], placer)).toBe(
      false,
    );
  });

  it("rejects a lead that only describes a region", () => {
    expect(
      isRegionLead(
        "Latin America is the cultural region of the Americas where Romance languages are spoken.",
      ),
    ).toBe(true);
    expect(isRegionLead("Gadi Eisenkot is an Israeli general and politician.")).toBe(false);
  });

  it("drops pronunciation guides from the lead", () => {
    expect(
      cleanLead(
        "Gadi Eisenkot (Hebrew: גדי איזנקוט, [gaˈdi ˈajzenkot]; born 19 May 1960), is an Israeli general.",
      ),
    ).toBe("Gadi Eisenkot is an Israeli general.");
    expect(
      cleanLead("Jesús de Miguel Alameda (21 September 1996 – 3 November 2026) was a footballer."),
    ).toBe("Jesús de Miguel Alameda (21 September 1996 – 3 November 2026) was a footballer.");
  });
});

describe("links to Earthlog films", () => {
  const headlines = z
    .object({ headlines: z.array(Headline) })
    .parse(read("test/fixtures/headlines-2026-11-08.json")).headlines;
  const kenya = headlines.filter((h) => /doomsday|Mackenzie/.test(h.title));
  const story = {
    slug: "kenyan-cult-leader",
    lens: "general",
    title: "Kenyan cult leader Paul Mackenzie is sentenced",
    summary:
      "Kenyan cult leader Paul Mackenzie is sentenced to 200 years in prison for the murder of 191 people.",
    heat: 40,
    sources: 1,
    related: [],
    evidence: ["wiki:2026-11-06:1"],
  } as EditionStory;

  it("links a story to the film that told it", () => {
    const films = matchFilms(
      [{ id: "kenya", headlines: kenya.map((h) => h.id) }],
      headlines,
      [{ date: "2026-11-06", stories: [story], films: new Set(["kenyan-cult-leader"]) }],
      placer,
    );
    expect(films.get("kenya")).toEqual({
      date: "2026-11-06",
      slug: "kenyan-cult-leader",
      title: story.title,
    });
  });

  it("only links stories that have a film", () => {
    const films = matchFilms(
      [{ id: "kenya", headlines: kenya.map((h) => h.id) }],
      headlines,
      [{ date: "2026-11-06", stories: [story], films: new Set() }],
      placer,
    );
    expect(films.size).toBe(0);
  });
});
