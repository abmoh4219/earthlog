import { describe, expect, it } from "vitest";
import {
  captionIssues,
  clip,
  editChapters,
  overlap,
  plainName,
  quotesBalanced,
  tidy,
} from "../scripts/lenses/editor";
import { type ChapterDraft, withCoverage } from "../scripts/lenses/film";
import type { EditionStory } from "../src/scene/edition";

const shot = { lon: 0, lat: 0, range: 1e6 };
const chapter = (title: string, texts: string[]): ChapterDraft => ({
  title,
  seconds: 10,
  shot,
  beats: texts.map((text, i) => ({ text, cites: [`e:${title}:${i}`] })),
});
const texts = (cs: ChapterDraft[]) => cs.flatMap((c) => c.beats.map((b) => b.text));

describe("the caption editor (real captions from the 6 November films)", () => {
  it("drops a caption that repeats an earlier one", () => {
    const out = editChapters(
      [
        chapter("What happened", [
          "Jay Rockefeller died at his home in Washington, D.C., on November 6, 2026, at the age of 89.",
          "West Virginia Governor Patrick Morrisey ordered flags in the state to fly at half staff.",
        ]),
        chapter("In memory", [
          "Jay Rockefeller died on 6 November 2026 in Washington, D.C., aged 89.",
          "Born in Manhattan.",
        ]),
      ],
      { lens: "person", title: "Jay Rockefeller" },
    );
    expect(texts(out)).not.toContain(
      "Jay Rockefeller died on 6 November 2026 in Washington, D.C., aged 89.",
    );
    expect(texts(out)).toContain("Born in Manhattan.");
  });

  it("folds release captions that add nothing new", () => {
    const out = editChapters(
      [
        chapter("What happened", [
          "Ramayana: Part 1 premiered at the Academy Museum of Motion Pictures on 27 October 2026, and was released worldwide on 5 November.",
          "It was theatrically released on 5 November 2026.",
          "Released: 27 October 2026 (Academy Museum), 5 November 2026 (India).",
        ]),
      ],
      { lens: "culture", title: "Ramayana: Part 1" },
    );
    // "It was theatrically released…" goes; the line that adds India stays.
    expect(texts(out)).toEqual([
      "Ramayana: Part 1 premiered at the Academy Museum of Motion Pictures on 27 October 2026, and was released worldwide on 5 November.",
      "Released: 27 October 2026 (Academy Museum), 5 November 2026 (India).",
    ]);
  });

  it("names the subject when a chapter opens on a pronoun, in single-subject films", () => {
    const out = editChapters(
      [chapter("What happened", ["He was best known for MTV UK's Dirty Sanchez."])],
      {
        lens: "person",
        title: "Michael Locke (stuntman)",
      },
    );
    expect(texts(out)).toEqual(["Michael Locke was best known for MTV UK's Dirty Sanchez."]);
  });

  it("drops sentences that lean on a missing one, or carry a broken quote", () => {
    const out = editChapters(
      [
        chapter("What happened", [
          "Elections in the United States were held on November 3, 2026.",
          'They also wrote on November 3, 2026 that "Support for Medicare for All points to a thread.',
          'Turnout was "the highest since 1914", officials said.',
        ]),
      ],
      { lens: "election", title: "2026 United States elections" },
    );
    expect(texts(out)).toEqual([
      "Elections in the United States were held on November 3, 2026.",
      'Turnout was "the highest since 1914", officials said.',
    ]);
  });

  it("keeps citations, and turns a chapter of repeats into a short silent shot", () => {
    const out = editChapters(
      [
        chapter("A", ["The same fact about the dam."]),
        chapter("B", ["The same fact about the dam."]),
      ],
      { lens: "general", title: "Dam" },
    );
    expect(out[0]?.beats[0]?.cites).toEqual(["e:A:0"]);
    expect(out[1]?.beats).toHaveLength(0);
    expect(out[1]?.seconds).toBe(5);
  });

  it("keeps a caption that names something new, even if its dates were said", () => {
    const out = editChapters(
      [
        chapter("What happened", [
          'John Davison "Jay" Rockefeller IV (June 18, 1937 – November 6, 2026) was an American politician.',
        ]),
        chapter("Born", ["Jay Rockefeller was born on 18 June 1937 in Manhattan."]),
      ],
      { lens: "person", title: "Jay Rockefeller" },
    );
    expect(out[1]?.beats.map((b) => b.text)).toEqual([
      "Jay Rockefeller was born on 18 June 1937 in Manhattan.",
    ]);
  });

  it("does not count the subject's name as repetition", () => {
    const out = editChapters(
      [
        chapter("What happened", [
          "Michael Richard Locke (13 March 1979 – November 2026), better known as Pancho, was a Welsh stuntman.",
        ]),
        chapter("Born", ["Michael Locke was born on 13 March 1979 in Port Talbot."]),
      ],
      { lens: "person", title: "Michael Locke (stuntman)" },
    );
    expect(out[1]?.beats).toHaveLength(1);
  });

  it("tidies punctuation and clips where a reader can stop", () => {
    expect(tidy("Worked for AmeriCorps VISTA, in Washington, D.C..")).toBe(
      "Worked for AmeriCorps VISTA, in Washington, D.C.",
    );
    expect(tidy("Wait ... three dots stay...")).toBe("Wait... three dots stay...");
    expect(tidy("Scott Winston Colom (; born December 24, 1982) is a lawyer.")).toBe(
      "Scott Winston Colom (born December 24, 1982) is a lawyer.",
    );
    expect(tidy("Ana Pérez () is a judge.")).toBe("Ana Pérez is a judge.");
    expect(tidy("Dipavali (IAST: ), commonly known as Diwali, is a festival.")).toBe(
      "Dipavali, commonly known as Diwali, is a festival.",
    );
    expect(tidy("The Thing (film: 1982) stays.")).toBe("The Thing (film: 1982) stays.");
    expect(tidy("Gadi Eisenkot (\u200f; born 19 May 1960) is a general.")).toBe(
      "Gadi Eisenkot (born 19 May 1960) is a general.",
    );
    const long = `${"The first sentence runs long enough to pass the middle of the limit, with detail. ".repeat(2)}And a third that would not fit at all within the limit anyway.`;
    expect(clip(long).endsWith(".")).toBe(true);
    expect(clip(long).length).toBeLessThanOrEqual(220);
  });

  it("knows a balanced quote and a plain name", () => {
    expect(quotesBalanced("He said “yes”.")).toBe(true);
    expect(quotesBalanced('He said "yes.')).toBe(false);
    expect(plainName("Scene (2026 film)")).toBe("Scene");
    expect(overlap("A b", "")).toBe(0);
  });
});

describe("the quality check", () => {
  it("names what a reader would trip on", () => {
    const kinds = captionIssues([
      "The museum opens on 3 March 2026 in Lisbon.",
      "The museum opens in Lisbon on 3 March 2026.",
      "They said it was late.",
      'A "broken quote.',
      "Cut here…",
      "Washington, D.C..",
    ]).map((i) => i.kind);
    expect(kinds).toEqual(["repeat", "orphan", "quote", "cut", "punctuation"]);
  });
});

describe("In the news", () => {
  const story = {
    slug: "s",
    lens: "general",
    title: "Kenyan cult leader sentenced",
    summary: "",
    heat: 50,
    sources: 0,
    related: [],
    evidence: ["news:bbc:aaaaaaaaaaaa"],
    coverage: [
      {
        outlet: "bbc",
        title: "Kenyan doomsday cult leader given life sentence for murdering 191 people",
        url: "https://www.bbc.co.uk/news/articles/x",
        t: "2026-11-06T14:46:03Z",
        evidence: "news:bbc:aaaaaaaaaaaa",
      },
    ],
  } as EditionStory;

  it("quotes each outlet's headline before the sources, with a panel of links", () => {
    const out = withCoverage([chapter("What happened", ["x"]), chapter("Sources", ["y"])], story);
    expect(out.map((c) => c.title)).toEqual(["What happened", "In the news", "Sources"]);
    const news = out[1];
    expect(news?.beats[0]).toEqual({
      text: "BBC News headlined it: “Kenyan doomsday cult leader given life sentence for murdering 191 people”",
      cites: ["news:bbc:aaaaaaaaaaaa"],
    });
    expect(news?.panels?.[0]).toMatchObject({ kind: "facts", id: "coverage" });
  });

  it("survives the editor even when the headline restates the opening", () => {
    const out = editChapters(
      withCoverage(
        [
          chapter("What happened", [
            "Kenyan cult leader given life sentence for murdering 191 people.",
          ]),
        ],
        story,
      ),
      { lens: "general", title: story.title },
    );
    expect(out[1]?.beats).toHaveLength(1);
  });

  it("adds nothing when no outlet reported it", () => {
    const cs = [chapter("What happened", ["x"])];
    expect(withCoverage(cs, { ...story, coverage: [] })).toBe(cs);
  });
});
