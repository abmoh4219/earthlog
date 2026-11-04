import { describe, expect, it } from "vitest";
import {
  chronological,
  contextIsTheEvent,
  dateMatch,
  pickNews,
  type Revision,
  sentences,
} from "../scripts/lenses/news-context.ts";

const DATE = "2026-11-03";
const rev = (wikitext: string, revid = 2): Revision => ({
  title: "Jeffery Simmons",
  revid,
  timestamp: "2026-11-04T13:54:35Z",
  wikitext,
});

const BEFORE = `{{Infobox NFL player}}
'''Jeffery Simmons''' (born July 28, 1997) is an American professional football defensive tackle for the [[Tennessee Titans]].

== Personal life ==
On December 14, 2025, Simmons' home was broken into while the team was playing away.

== Plot ==
On 2 November 2026, a fictional event happens in a film plot that must be ignored.`;

const AFTER = `{{Infobox NFL player}}
{{nowrap|Jeffery Bernard Simmons Jr.}} (born July 28, 1997) is an American professional football defensive tackle for the [[Chicago Bears]].

== Chicago Bears ==
Simmons and a pick were traded to the [[Chicago Bears]] on October 29 in exchange for two first-round selections.<ref>ESPN</ref>
In his Bears debut, Simmons recorded a sack, six tackles, and a pass deflection as Chicago won 34–17.
At the end of a game on September 20, 2026, Simmons gestured at fans, an old event added during a tidy-up.

== Personal life ==
On December 14, 2025, Simmons' home was broken into while the team was playing away.

== Plot ==
On 2 November 2026, a fictional event happens in a film plot that must be ignored.`;

describe("sentences", () => {
  it("keeps prose with its section and drops templates, refs, links and skipped sections", () => {
    const s = sentences(AFTER);
    expect(s.some((x) => x.section === "Plot")).toBe(false);
    expect(s.find((x) => x.text.startsWith("Simmons and a pick"))?.text).toBe(
      "Simmons and a pick were traded to the Chicago Bears on October 29 in exchange for two first-round selections.",
    );
  });

  it("keeps the space where a spacing template stood", () => {
    const s = sentences(
      "Shipping has been largely blocked by Iran since 28{{nbsp}}February 2026, the reports say.",
    );
    expect(s[0]?.text).toContain("since 28 February 2026");
  });
});

describe("dateMatch", () => {
  it("finds the closest date and whether it states its year", () => {
    expect(dateMatch("On 2 November 2026, it happened.", DATE)).toEqual({
      days: -1,
      withYear: true,
    });
    expect(dateMatch("Traded on October 29 in exchange.", DATE)).toEqual({
      days: -5,
      withYear: false,
    });
    expect(dateMatch("No date here at all.", DATE)).toBeUndefined();
  });
});

describe("pickNews", () => {
  const found = pickNews(rev(AFTER), rev(BEFORE, 1), DATE);

  it("finds what happened: recently added sentences, year-less dates included", () => {
    const texts = found.news.map((s) => s.text);
    expect(texts[0]).toMatch(/^Simmons and a pick were traded/);
    expect(texts).toContain(
      "In his Bears debut, Simmons recorded a sack, six tackles, and a pass deflection as Chicago won 34–17.",
    );
  });

  it("skips old events tidied in, unchanged old material and plots", () => {
    const texts = found.news.map((s) => s.text).join(" ");
    expect(texts).not.toMatch(/September 20/);
    expect(texts).not.toMatch(/broken into/);
    expect(texts).not.toMatch(/fictional/);
  });

  it("puts the title back when the lead's subject sat in a template", () => {
    expect(found.context?.text).toMatch(/^Jeffery Simmons \(born July 28, 1997\) is an American/);
  });

  it("tells chosen sentences in time order", () => {
    const ordered = chronological(
      [{ text: "Debut on November 2, 2026, a win." }, { text: "Traded on October 29, 2026." }],
      DATE,
    ).map((s) => s.text);
    expect(ordered).toEqual(["Traded on October 29, 2026.", "Debut on November 2, 2026, a win."]);
  });

  it("recognises an article whose opening is the dated event", () => {
    const crash = pickNews(
      rev(
        "On November 1, 2026, a privately owned Learjet 60 business jet crashed in Palm Beach County, Florida.",
      ),
      undefined,
      DATE,
    );
    expect(contextIsTheEvent(crash, DATE)).toBe(true);
    expect(contextIsTheEvent(found, DATE)).toBe(false);
  });
});

describe("splitSentences", () => {
  it("does not break after abbreviations or initials", async () => {
    const { splitSentences } = await import("../scripts/lenses/news-context.ts");
    expect(
      splitSentences(
        "On November 3, oil prices fell following an announcement by U.S. President Smith. Markets rose.",
      ),
    ).toEqual([
      "On November 3, oil prices fell following an announcement by U.S. President Smith.",
      "Markets rose.",
    ]);
    expect(splitSentences("It was led by Dr. Jones. Then it ended.")).toEqual([
      "It was led by Dr. Jones.",
      "Then it ended.",
    ]);
  });
});
