// The edition builder, against inputs recorded on 2026-11-04 for 3 Nov 2026. No network.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildEdition, headline, slugify } from "../scripts/edition/build.ts";
import { isNotAStory, lensFromHeading, lensFromTypes } from "../scripts/edition/lens.ts";
import {
  feedUrl,
  type MostRead,
  medianViews,
  normalUrl,
  parseEntities,
  parseMostRead,
  type WdEntity,
} from "../scripts/edition/sources.ts";
import { Edition } from "../src/scene/edition.ts";
import { Country, Evidence, NewsStory } from "../src/scene/schema.ts";

const read = (...p: string[]): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, ...p), "utf8"));

describe("lens from Wikidata types", () => {
  it.each([
    [["human"], "person"],
    [["legislative election", "public election"], "election"],
    [["events in a specific year or time period", "United States midterm election"], "election"],
    [["aviation accident"], "accident"],
    [["film"], "culture"],
    [["television series season"], "culture"],
    [["association football club"], "sports"],
    [["horse race", "recurring sporting event edition"], "sports"],
    [["central bank", "Australian Government body"], "economy"],
    [["armed conflict"], "conflict"],
    [["attempted coup d'état", "civil war"], "conflict"],
    [["blockade", "crisis situation"], "conflict"],
    [["sponsored top-level domain"], "organization"],
    [["service on Internet", "fiction repository"], "organization"],
    [["literary award"], "culture"],
  ])("%j → %s", (labels, lens) => {
    expect(lensFromTypes(labels)).toBe(lens);
  });

  it("matches whole words only", () => {
    expect(lensFromTypes(["award"])).toBe("culture"); // not "war"
    expect(lensFromTypes(["political party"])).toBeUndefined(); // not "art"
  });

  it("knows lists aren't stories", () => {
    expect(isNotAStory(["Wikimedia list article"])).toBe(true);
    expect(isNotAStory(["human"])).toBe(false);
  });

  it("maps news headings", () => {
    expect(lensFromHeading("Armed conflicts and attacks")).toBe("conflict");
    expect(lensFromHeading("Disasters and accidents")).toBe("accident");
    expect(lensFromHeading("Art and culture")).toBe("culture");
    expect(lensFromHeading("Law and crime")).toBe("general");
  });
});

describe("source parsers", () => {
  it("asks the next day's feed for a day's most-read list", () => {
    expect(feedUrl("2026-11-03")).toBe(
      "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/04",
    );
  });

  it("parses the most-read list and refuses another day's", () => {
    const fixture = read("..", "test", "fixtures", "edition-inputs-2026-11-03.json");
    const one = z.object({ mostRead: z.array(z.object({ title: z.string() })) }).parse(fixture);
    const feed = {
      mostread: {
        date: "2026-11-03Z",
        articles: [
          {
            views: 585060,
            title: "Jesús_de_Miguel",
            namespace: { id: 0 },
            wikibase_item: "Q116992476",
            description: "Spanish footballer (1996–2026)",
            titles: { normalized: "Jesús de Miguel" },
            content_urls: {
              desktop: { page: "https://en.wikipedia.org/wiki/Jes%C3%BAs_de_Miguel" },
            },
          },
          {
            views: 4,
            title: "Special:Search",
            namespace: { id: -1 },
            titles: { normalized: "Special:Search" },
            content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Special:Search" } },
          },
        ],
      },
    };
    expect(parseMostRead(feed, "2026-11-03")).toEqual([
      {
        title: "Jesús de Miguel",
        url: "https://en.wikipedia.org/wiki/Jes%C3%BAs_de_Miguel",
        qid: "Q116992476",
        description: "Spanish footballer (1996–2026)",
        views: 585060,
      },
    ]);
    expect(() => parseMostRead(feed, "2026-11-04")).toThrow(/expected 2026-11-04/);
    expect(one.mostRead.length).toBe(42);
  });

  it("measures an article's normal level 60 to 8 days back", () => {
    expect(normalUrl("Patrick Stewart", "2026-11-03")).toMatch(
      /Patrick_Stewart\/daily\/20260904\/20261026$/,
    );
    expect(medianViews({ items: [{ views: 5 }, { views: 1 }, { views: 9 }] })).toBe(5);
    expect(medianViews({ items: [] })).toBe(0);
  });

  it("reads Wikidata items, coordinates, ISO codes and death dates", () => {
    const e = parseEntities({
      entities: {
        Q16296: {
          id: "Q16296",
          labels: { en: { value: "Patrick Stewart" } },
          claims: {
            P31: [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }],
            P570: [{ mainsnak: { datavalue: { value: { time: "+2026-10-28T00:00:00Z" } } } }],
          },
        },
        Q30: {
          id: "Q30",
          claims: {
            P297: [{ mainsnak: { datavalue: { value: "US" } } }],
            P625: [{ mainsnak: { datavalue: { value: { latitude: 39.8, longitude: -98.6 } } } }],
          },
        },
      },
    });
    expect(e.get("Q16296")).toMatchObject({
      label: "Patrick Stewart",
      items: { P31: ["Q5"] },
      died: "2026-10-28",
    });
    expect(e.get("Q30")).toMatchObject({ iso2: "US", coord: { lat: 39.8, lon: -98.6 } });
  });

  it("makes short titles and stable slugs", () => {
    expect(
      headline(
        "A commercial vessel is hit by an unidentified object in the waters of Musandam Governorate, Oman, killing…",
      ),
    ).toBe("A commercial vessel is hit by an unidentified object in the waters of Musandam…");
    expect(slugify("Jesús de Miguel")).toBe("jesus-de-miguel");
    expect(slugify("2026 Palm Beach County Learjet 60 crash")).toBe(
      "2026-palm-beach-county-learjet-60-crash",
    );
  });
});

describe("the 3 Nov 2026 edition", () => {
  const Inputs = z.object({
    date: z.string(),
    mostRead: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        qid: z.string().optional(),
        description: z.string().optional(),
        views: z.number(),
        priorMedian: z.number().optional(),
      }),
    ),
    news: z.object({
      raw: z.array(
        z.object({
          heading: z.string(),
          topic: z.string().optional(),
          text: z.string(),
          links: z.array(z.string()),
          sources: z.array(z.object({ name: z.string(), url: z.string() })),
        }),
      ),
      stories: z.array(NewsStory),
      evidence: z.array(Evidence),
    }),
    qids: z.array(z.tuple([z.string(), z.string()])),
    entities: z.array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        items: z.record(z.string(), z.array(z.string())),
        coord: z.object({ lat: z.number(), lon: z.number() }).optional(),
        iso2: z.string().optional(),
        died: z.string().optional(),
      }),
    ),
    links: z.array(z.tuple([z.string(), z.array(z.string())])),
  });
  const input = Inputs.parse(read("fixtures", "edition-inputs-2026-11-03.json"));
  const countries = z.array(Country).parse(read("..", "public", "geo", "countries.json"));
  const mostRead: MostRead[] = input.mostRead.map((m) => ({
    title: m.title,
    url: m.url,
    views: m.views,
    ...(m.qid ? { qid: m.qid } : {}),
    ...(m.description ? { description: m.description } : {}),
    ...(m.priorMedian !== undefined ? { priorMedian: m.priorMedian } : {}),
  }));
  const entities = new Map<string, WdEntity>(
    input.entities.map((e) => [
      e.id,
      {
        id: e.id,
        items: e.items,
        ...(e.label ? { label: e.label } : {}),
        ...(e.coord ? { coord: e.coord } : {}),
        ...(e.iso2 ? { iso2: e.iso2 } : {}),
        ...(e.died ? { died: e.died } : {}),
      },
    ]),
  );
  const { edition, evidence, sources } = buildEdition({
    date: input.date,
    generatedAt: "2026-11-04T06:00:00Z",
    mostRead,
    news: {
      raw: input.news.raw.map(({ topic, ...r }) => ({ ...r, ...(topic ? { topic } : {}) })),
      stories: input.news.stories,
      evidence: input.news.evidence,
    },
    qids: new Map(input.qids),
    entities,
    links: new Map(input.links.map(([k, v]) => [k, new Set(v)])),
    countries,
  });
  const story = (title: string) => edition.stories.find((s) => s.title.startsWith(title));

  it("is a valid edition", () => {
    expect(() => Edition.parse(edition)).not.toThrow();
    expect(edition.stories.length).toBeGreaterThanOrEqual(10);
    expect(new Set(edition.stories.map((s) => s.slug)).size).toBe(edition.stories.length);
    expect(edition.stories[0]?.heat).toBe(100);
  });

  it("gives each hot story the right lens", () => {
    expect(story("2026 United States elections")?.lens).toBe("election");
    expect(story("Jesús de Miguel")?.lens).toBe("person");
    expect(story("Patrick Stewart")?.lens).toBe("person");
    expect(story("2026 Palm Beach County Learjet 60 crash")?.lens).toBe("accident");
    expect(story("Jailer 2")?.lens).toBe("culture");
    expect(story("The Reserve Bank of Australia")?.lens).toBe("economy");
    expect(story("Two helicopters")?.lens).toBe("accident");
  });

  it("folds related articles into their story", () => {
    expect(story("2026 Palm Beach County Learjet 60 crash")?.related).toContain("Learjet 60");
    expect(story("Jesús de Miguel")?.related).toContain("Jesús Owono");
    expect(story("2026 United States elections")?.sources).toBeGreaterThan(0);
  });

  it("keeps lists and evergreen pages out", () => {
    const titles = edition.stories.map((s) => s.title);
    expect(titles).not.toContain("Deaths in 2026");
    expect(titles).not.toContain("Donald Trump");
  });

  it("covers every continent that had a story, Africa included", () => {
    const continents = new Set(edition.stories.map((s) => s.continent));
    for (const c of ["Africa", "Asia", "Europe", "North America", "Oceania"]) {
      expect(continents.has(c as never)).toBe(true);
    }
  });

  it("ships every piece of evidence a story cites, from a credited source", () => {
    const ids = new Set(evidence.map((e) => e.id));
    const sourceIds = new Set(sources.map((s) => s.id));
    for (const s of edition.stories) for (const id of s.evidence) expect(ids.has(id)).toBe(true);
    for (const e of evidence) expect(sourceIds.has(e.source)).toBe(true);
  });
});
