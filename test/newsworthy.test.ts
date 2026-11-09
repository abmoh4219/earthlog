import { describe, expect, it } from "vitest";
import type { Headline } from "../src/scene/headlines";
import { headlineSignals, newsworthiness, peopleIn, reasonsOf } from "../src/scene/newsworthy";

const h = (outlet: string, t: string, title = "Story"): Headline => ({
  id: `${outlet}${t}`
    .replace(/\W/g, "")
    .slice(-12)
    .padStart(12, "a")
    .replace(/[^a-f0-9]/g, "a"),
  outlet,
  title,
  url: `https://example.org/${outlet}`,
  t,
  seen: t,
});

describe("how many people a headline names", () => {
  it.each([
    ["Seven dead and 114 injured in train crash near Cairo", 114, true],
    ["Russian strikes leave hundreds of thousands without power", 200_000, false],
    ["Israeli strike kills 12 in Gaza", 12, true],
    ["Death toll rises to 1,200 after quake", 1200, true],
    ["Tens of thousands march in Paris", 10_000, false],
    ["1.2 million households without power", 1_200_000, false],
  ])("%s", (title, count, harm) => {
    expect(peopleIn(title)).toMatchObject({ count, harm });
  });

  it("keeps the number as written, and says it that way", () => {
    expect(peopleIn("Russian strikes leave hundreds of thousands without power").as).toBe(
      "hundreds of thousands",
    );
    const s = headlineSignals([h("dw", "2026-11-08T08:00:00Z", "Hundreds of thousands flee")]);
    expect(reasonsOf(s)).toContain("People involved, per the headlines: hundreds of thousands");
  });

  it("ignores years, money, percentages and ordinals", () => {
    for (const t of [
      "2026 elections: 3 things to know",
      "Nvidia shares fall 5% as $40bn deal stalls",
      "Messi becomes first player to win back-to-back Golden Boots",
    ])
      expect(peopleIn(t).count).toBe(0);
  });
});

describe("newsworthiness", () => {
  const base = { headlines: 1, hours: 0, early: 1, people: 0, harm: false };

  it("ranks agreement across outlets and regions above readers", () => {
    const pack = newsworthiness({ ...base, outlets: 5, regions: 3, headlines: 8, early: 4 });
    const read = newsworthiness({
      ...base,
      outlets: 0,
      regions: 0,
      headlines: 0,
      readers: 2_000_000,
      spike: 20,
    });
    expect(pack).toBeGreaterThan(read * 2);
  });

  it("weighs deaths above a crowd of the same size", () => {
    const one = { ...base, outlets: 2, regions: 1 };
    expect(newsworthiness({ ...one, people: 1000, harm: true })).toBeGreaterThan(
      newsworthiness({ ...one, people: 1000, harm: false }),
    );
  });

  it("measures a story from its headlines, and says why in plain words", () => {
    const s = headlineSignals([
      h("bbc", "2026-11-08T08:00:00Z", "Seven dead and 114 injured in train crash"),
      h("aljazeera", "2026-11-08T08:40:00Z"),
      h("dw", "2026-11-08T09:30:00Z"),
      h("npr", "2026-11-08T20:00:00Z"),
      h("bbc", "2026-11-08T21:00:00Z"),
    ]);
    expect(s).toMatchObject({ outlets: 4, regions: 3, headlines: 5, early: 3, people: 114 });
    expect(s.hours).toBe(13);
    expect(reasonsOf({ ...s, noted: true })).toEqual([
      "Reported by 4 outlets from 3 regions",
      "3 outlets within 3 hours",
      "Listed on Wikipedia's Current events",
      "114 people involved, per the headlines",
    ]);
  });
});
