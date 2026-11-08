import { describe, expect, it } from "vitest";
import { type BuildInput, buildEdition, storyKey } from "../scripts/edition/build.ts";
import { isEventPage, isEvergreen, lensFromTypes } from "../scripts/edition/lens.ts";
import type { MostRead, WdEntity } from "../scripts/edition/sources.ts";
import type { EditionStory } from "../src/scene/edition.ts";

// A small synthetic day (2026-11-05) to check each selection rule on its own.
const DATE = "2026-11-05";
const wiki = (t: string) => `https://en.wikipedia.org/wiki/${t.replace(/ /g, "_")}`;
const read = (title: string, qid: string, views: number, priorMedian: number): MostRead => ({
  title,
  url: wiki(title),
  qid,
  views,
  priorMedian,
});
const entity = (id: string, label: string, types: string[]): [string, WdEntity] => [
  id,
  { id, label, items: { P31: types } },
];
const typeEntity = (id: string, label: string): [string, WdEntity] => [
  id,
  { id, label, items: {} },
];

function newsItem(i: number, heading: string, text: string, links: string[], topic?: string) {
  const id = `wiki:${DATE}:${i}`;
  return {
    raw: {
      heading,
      text,
      links,
      sources: [{ name: "Reuters", url: "https://example.org/r" }],
      ...(topic ? { topic } : {}),
    },
    story: { id, category: "politics" as const, text, evidence: id },
    evidence: {
      id,
      kind: "report" as const,
      source: "wikipedia",
      t: `${DATE}T00:00:00Z`,
      precision: "day" as const,
      label: text,
      quote: text,
      url: wiki(`Portal:Current events/${DATE}`),
    },
  };
}

const past = (slug: string, title: string, qid?: string): EditionStory => ({
  slug,
  lens: "general",
  title,
  summary: "",
  heat: 50,
  sources: 0,
  related: [],
  evidence: ["x"],
  ...(qid ? { article: { title, url: wiki(title), qid } } : {}),
});

const paraguay = newsItem(
  1,
  "Politics and elections",
  "The Paraguayan Senate removes President Santiago Peña from office.",
  ["Paraguay", "Santiago Peña"],
  "2026 Paraguayan political crisis",
);
const hungary = newsItem(
  2,
  "Politics and elections",
  "Hungary makes Communist-era secret police records publicly accessible.",
  ["Hungarian People's Republic", "secret police"],
);

const input: BuildInput = {
  date: DATE,
  generatedAt: `${DATE}T06:00:00Z`,
  mostRead: [
    read("Ramayana: Part 1", "Q1", 90_000, 1_000),
    read("Guy Fawkes Night", "Q3", 80_000, 700),
    read("Learjet 60", "Q4", 260_000, 120),
    read("2026 Learjet 60 crash", "Q5", 220_000, 2),
  ],
  news: {
    raw: [paraguay.raw, hungary.raw],
    stories: [paraguay.story, hungary.story],
    evidence: [paraguay.evidence, hungary.evidence],
  },
  qids: new Map([
    ["2026 Paraguayan political crisis", "Q2"],
    ["Hungarian People's Republic", "Q6"],
  ]),
  entities: new Map([
    entity("Q1", "Ramayana: Part 1", ["Tfilm"]),
    entity("Q2", "2026 Paraguayan political crisis", ["Tcrisis"]),
    entity("Q3", "Guy Fawkes Night", ["Tholiday"]),
    entity("Q4", "Learjet 60", ["Tmodel"]),
    entity("Q5", "2026 Learjet 60 crash", ["Taccident"]),
    entity("Q6", "Hungarian People's Republic", ["Tsatellite"]),
    typeEntity("Tfilm", "film"),
    typeEntity("Tcrisis", "political crisis"),
    typeEntity("Tholiday", "public holiday"),
    typeEntity("Tmodel", "aircraft model"),
    typeEntity("Taccident", "aviation accident"),
    typeEntity("Tsatellite", "satellite state"),
  ]),
  // The crash article links the aircraft type; the type's article does not link back.
  links: new Map([["2026 Learjet 60 crash", new Set(["Learjet 60"])]]),
  countries: [],
  history: [
    {
      date: "2026-11-04",
      stories: [
        past("ramayana-part-1", "Ramayana: Part 1", "Q1"),
        past("paraguayan-president-resigns", "Paraguayan president resigns", "Q2"),
      ],
    },
    {
      date: "2026-11-03",
      stories: [past("ramayana-part-1", "Ramayana: Part 1", "Q1")],
    },
  ],
};

const { edition, repeats } = buildEdition(input);
const story = (title: string) => edition.stories.find((s) => s.title.startsWith(title));

describe("no repeats (ADR-0015)", () => {
  it("drops a story already told when nothing new was reported", () => {
    expect(story("Ramayana")).toBeUndefined();
    expect(repeats).toContain("Ramayana: Part 1");
  });

  it("brings a story back as an update when the day's news reports something new", () => {
    const update = edition.stories.find((s) => s.article?.qid === "Q2");
    expect(update?.update?.day).toBe(2);
    expect(update?.update?.previous[0]).toEqual({
      date: "2026-11-04",
      slug: "paraguayan-president-resigns",
      title: "Paraguayan president resigns",
    });
  });

  it("keys a story by its Wikidata item, then its article, then its title", () => {
    expect(storyKey({ title: "A", article: { title: "B", qid: "Q9" } })).toBe("Q9");
    expect(storyKey({ title: "A", article: { title: "B" } })).toBe("article:b");
    expect(storyKey({ title: "Two buses collide" })).toBe("title:two-buses-collide");
  });
});

describe("cleaner picks", () => {
  it("leaves out evergreen reading that no news mentions", () => {
    expect(story("Guy Fawkes Night")).toBeUndefined();
    expect(isEvergreen(["public holiday"])).toBe(true);
    expect(isEvergreen(["sponsored top-level domain"])).toBe(true);
    expect(isEvergreen(["film"])).toBe(false);
  });

  it("folds a thing into the event it belongs to, whichever was read more", () => {
    expect(story("Learjet 60")).toBeUndefined();
    expect(story("2026 Learjet 60 crash")?.related).toContain("Learjet 60");
  });

  it("treats races and matches as events, clubs and leagues as things", () => {
    expect(isEventPage(["aviation accident"])).toBe(true);
    expect(isEventPage(["horse race"])).toBe(true);
    expect(isEventPage(["association football club"])).toBe(false);
  });

  it("never turns a political story into a space story from a guessed link", () => {
    expect(story("Hungary")?.lens).toBe("general");
    expect(lensFromTypes(["satellite state"])).toBeUndefined();
    expect(lensFromTypes(["artificial satellite"])).toBe("science");
  });
});
