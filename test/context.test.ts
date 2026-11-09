import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  acceptArticle,
  acceptNamed,
  cleanLead,
  isPersonLead,
  isRegionLead,
  isTitleCase,
  matchFilms,
  searchQueries,
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

describe("searching for a story's article by its names (real headlines, 8 November)", () => {
  const qs = (h: string) => searchQueries([h]).map((q) => `${q.kind}:${q.q}`);

  it("searches the subject a headline names before its colon, not kind labels", () => {
    expect(qs("Ebola: Why is there still no vaccine?")[0]).toBe("label:Ebola");
    expect(qs("Diwali: Over one billion people mark victory of light over darkness")[0]).toBe(
      "label:Diwali",
    );
    expect(qs("Middle East live: Israel strikes Gaza").some((q) => q.startsWith("label:"))).toBe(
      false,
    );
  });

  it("searches people and things by their names, never an outlet's", () => {
    expect(qs("Russell Brand case must be wake-up call, Lisa Nandy says").slice(0, 2)).toEqual([
      "name:Russell Brand",
      "name:Lisa Nandy",
    ]);
    expect(qs("Al Jazeera tries Baseball5 at Youth Olympics")).not.toContain("name:Al Jazeera");
    // An everyday opener is no name; a name that opens the headline is tried, last.
    expect(qs("After the midterms, where does the Republican Party stand?")).toContain(
      "name:Republican Party",
    );
    expect(qs("After the midterms, where does the Republican Party stand?")).not.toContain(
      "first:After",
    );
    expect(qs("Messi becomes first player to win back-to-back MLS Golden Boot awards")).toContain(
      "first:Messi",
    );
  });

  it("finds a COP climate summit by its number (none met in 2020)", () => {
    expect(qs("Cop31 must deliver climate progress, host says")[0]).toBe(
      "cop:2026 United Nations Climate Change Conference",
    );
    expect(qs("What COP25 left undone")[0]).toBe(
      "cop:2019 United Nations Climate Change Conference",
    );
  });

  it("accepts a full name from a surname, and the subject from a label, top result only", () => {
    expect(acceptNamed("Lionel Messi", { q: "Messi", kind: "first" }, 0, placer)).toBe(true);
    expect(acceptNamed("Lionel Messi", { q: "Messi", kind: "first" }, 1, placer)).toBe(false);
    expect(acceptNamed("Ebola disease", { q: "Ebola", kind: "label" }, 0, placer)).toBe(true);
    expect(acceptNamed("Poland", { q: "Poland", kind: "label" }, 0, placer)).toBe(false);
    expect(acceptNamed("Gaza Strip", { q: "Gaza", kind: "name" }, 0, placer)).toBe(false);
  });

  it("knows a person's lead, and a country aside", () => {
    expect(
      isPersonLead("Lionel Andrés Messi (born 24 June 1987) is an Argentine footballer."),
    ).toBe(true);
    expect(isPersonLead("The MLS Golden Boot is an annual award.")).toBe(false);
    expect(
      acceptArticle(
        "Republican Party (United States)",
        ["After the midterms, where does the Republican Party stand?"],
        placer,
      ),
    ).toBe(true);
    expect(
      acceptArticle(
        "Europe, Europe",
        ["G7 ministers meet as Europe seeks greater say in Ukraine peace talks"],
        placer,
      ),
    ).toBe(false);
    expect(cleanLead("Dipavali, commonly known as Diwali (), is the Hindu festival.")).toBe(
      "Dipavali, commonly known as Diwali, is the Hindu festival.",
    );
  });
});

describe("AllAfrica's Title Case headlines and common nouns (live data, 9 November)", () => {
  it("knows Title Case, where capitals say nothing", () => {
    expect(isTitleCase("Uganda: Mwesige Exits Parliament After Five Years As Clerk")).toBe(true);
    expect(isTitleCase("Lisa Nandy wary of circular arguments about rejoining EU")).toBe(false);
  });

  it("refuses everyday words, common-noun phrases, continents and peoples", () => {
    const cases: [string, string][] = [
      ["Clerk", "Uganda: Mwesige Exits Parliament After Five Years As Clerk"],
      ["Street children", "Uganda: KCCA Rescues 114 Street Children in Kampala Operation"],
      ["Police state", "Malawi: 'Malawi Is Not a Police State' - Kapito Warns Govt"],
      ["Family", "Nigeria: Bandits Burn 11 Family Members to Death in Zamfara"],
      ["Nigerians", "Nigeria: Doctors Raise the Alarm Over Hypertension Among Nigerians"],
      ["Africa", "Africa: Africa CDC Welcomes the Appointment of Dr Mark Dybul"],
      ["Christmas", "Burnham's homelessness pledge to 'get everyone in for Christmas'"],
    ];
    for (const [title, h] of cases) expect(acceptArticle(title, [h], placer), title).toBe(false);
    expect(acceptNamed("Africa", { q: "Africa", kind: "label" }, 0, placer)).toBe(false);
  });

  it("refuses part of a longer name, the wrong numeral, places and dates", () => {
    const cases: [string, string][] = [
      ["Minutes", "Trump tells 60 Minutes that deportation policy was 'too tough'"],
      ["Rhum", "French skipper wins Route du Rhum"],
      ["Pope Leo X", "After a successful trip to Uruguay, Pope Leo heads to Argentina"],
      ["Gaza", "Deadly sand cliff collapses on displaced families in Gaza"],
      ["Tripoli, Libya", "Egyptian embassy reopens in Tripoli, Libya after 12 years"],
      ["January 1", "Iran executes three men for 'armed unrest' after January protests"],
      ["Latin Americans", "Pope Leo urges men to respect wives amid Latin American protests"],
    ];
    for (const [title, h] of cases) expect(acceptArticle(title, [h], placer), title).toBe(false);
    expect(acceptArticle("Diwali", ["India's night lights up for Diwali"], placer)).toBe(true);
  });

  it("still accepts names and events", () => {
    expect(
      acceptArticle(
        "Bola Tinubu",
        ["Nigeria: Account for Subsidy Savings - Obi to Bola Tinubu"],
        placer,
      ),
    ).toBe(true);
    expect(
      acceptArticle("2026 Kraków shooting", ["2026 Kraków shooting: police name gunman"], placer),
    ).toBe(true);
    expect(qsOf("Uganda: KCCA Rescues 114 Street Children in Kampala Operation")).not.toContain(
      "name:KCCA Rescues",
    );
  });
});

function qsOf(h: string) {
  return searchQueries([h]).map((q) => `${q.kind}:${q.q}`);
}
