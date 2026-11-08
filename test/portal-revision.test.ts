// News evidence ids count items in the exact Current events revision an edition was built from;
// films must read that revision, and refuse to run if an item no longer reads as quoted.
import { describe, expect, it } from "vitest";
import { editionPortalRevision, newsMismatches, type RawStory } from "../scripts/bake/wikinews";

const item = (text: string): RawStory => ({ heading: "Politics", text, links: [], sources: [] });
const url =
  "https://en.wikipedia.org/w/index.php?title=Portal%3ACurrent_events%2F2026_November_6&oldid=1384256199";

describe("the edition's portal revision", () => {
  it("is read from the news evidence's oldid", () => {
    expect(
      editionPortalRevision("2026-11-06", [
        { id: "views:en:X:2026-11-06", url: "https://en.wikipedia.org/wiki/X" },
        { id: "wiki:2026-11-06:13", url },
      ]),
    ).toBe(1384256199);
  });

  it("is undefined when the edition has no news evidence", () => {
    expect(editionPortalRevision("2026-11-06", [{ id: "wd:Q1:P31" }])).toBeUndefined();
  });
});

describe("news items that moved", () => {
  const evidence = [
    { id: "wiki:2026-11-06:1", quote: "The Senate removes the president." },
    { id: "wiki:2026-11-06:2", quote: "A bus crash kills two." },
    { id: "wd:Q1:P31" },
  ];

  it("finds none in the edition's own revision", () => {
    const news = [item("The Senate removes the president."), item("A bus crash kills two.")];
    expect(newsMismatches("2026-11-06", evidence, news)).toEqual([]);
  });

  it("finds every id whose item changed or moved (an item inserted above)", () => {
    const news = [
      item("A new item added by an editor."),
      item("The Senate removes the president."),
    ];
    expect(newsMismatches("2026-11-06", evidence, news)).toEqual([
      "wiki:2026-11-06:1",
      "wiki:2026-11-06:2",
    ]);
  });
});
