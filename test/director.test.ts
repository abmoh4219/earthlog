import { describe, expect, it } from "vitest";
import {
  applyDirection,
  type ChapterInput,
  checkChapter,
  costUsd,
  type Direction,
  numbers,
} from "../scripts/director/claude.ts";
import type { Scene } from "../src/scene/schema.ts";

const input: ChapterInput = {
  title: "On board",
  template: [
    {
      text: "All 9 people on board died: 7 passengers and 2 crew, according to the article.",
      cites: ["box:occ"],
    },
  ],
  evidence: [
    { id: "box:occ", text: "occupants: 9 | fatalities: 9" },
    { id: "box:pax", text: "passengers: 7 | crew: 2" },
  ],
};
const ok = (text: string, cites = ["box:occ"]) => ({ title: "On board", beats: [{ text, cites }] });

describe("director checks (every rejection path)", () => {
  it("accepts a grounded rewrite", () => {
    expect(
      checkChapter(
        input,
        ok("All 9 aboard died, 7 passengers and 2 crew, as the article records."),
      ),
    ).toEqual([]);
  });
  it("rejects an invented number", () => {
    expect(checkChapter(input, ok("All 9 died and 12 were hurt."))[0]).toContain("number 12");
  });
  it("rejects an uncited caption", () => {
    expect(checkChapter(input, ok("All 9 died.", [])).join()).toContain("uncited");
  });
  it("rejects a cite outside the chapter", () => {
    expect(checkChapter(input, ok("All 9 died.", ["wiki:other"])).join()).toContain(
      "not in this chapter",
    );
  });
  it("rejects too many captions and over-long ones", () => {
    const many = {
      title: "On board",
      beats: Array.from({ length: 4 }, () => ({ text: "All 9 died.", cites: ["box:occ"] })),
    };
    expect(checkChapter(input, many).join()).toContain("4 captions");
    expect(checkChapter(input, ok(`All 9 died. ${"x".repeat(220)}`)).join()).toContain("length");
  });
  it("normalises numbers", () => {
    expect(numbers("1,760 km on 2026-11-03, 8× usual.")).toEqual(["1760", "2026", "11", "3", "8"]);
  });
});

describe("applyDirection", () => {
  const scene = {
    id: "s",
    title: "T",
    subtitle: "S",
    time: "story",
    window: { start: "2026-11-03T00:00:00Z", end: "2026-11-03T00:00:40Z" },
    chapters: [
      { t: "2026-11-03T00:00:00Z", title: "On board" },
      { t: "2026-11-03T00:00:20Z", title: "Other" },
    ],
    beats: [
      {
        t: "2026-11-03T00:00:01Z",
        text: "All 9 people on board died: 7 passengers and 2 crew, according to the article.",
        cites: ["box:occ"],
      },
      { t: "2026-11-03T00:00:21Z", text: "Template kept.", cites: ["box:pax"] },
    ],
    generatedBy: { method: "template", at: "2026-11-04T00:00:00Z" },
  } as unknown as Scene;
  const direction: Direction = {
    chapters: [
      {
        title: "On board",
        beats: [
          { text: "Nine people were aboard.", cites: ["box:occ"] },
          { text: "All 9 died: 7 passengers and 2 crew.", cites: ["box:occ"] },
        ],
      },
      { title: "Other", beats: [{ text: "Invented 42.", cites: ["box:pax"] }] },
    ],
    lens_check: { fits: true, better_lens: null, reason: "" },
  };
  it("keeps passing chapters, falls back to the template elsewhere, and re-times", () => {
    const other: ChapterInput = {
      title: "Other",
      template: [{ text: "Template kept.", cites: ["box:pax"] }],
      evidence: [{ id: "box:pax", text: "passengers: 7" }],
    };
    const r = applyDirection(scene, [input, other], direction);
    expect(r.accepted).toBe(1);
    expect(r.rejected[0]?.title).toBe("Other");
    expect(r.scene.beats.map((b) => b.text)).toEqual([
      "Nine people were aboard.",
      "All 9 died: 7 passengers and 2 crew.",
      "Template kept.",
    ]);
    const times = r.scene.beats.map((b) => Date.parse(b.t));
    expect(times[0]).toBeLessThan(times[1] ?? 0);
    expect(times[1]).toBeLessThan(Date.parse("2026-11-03T00:00:20Z"));
  });
});

describe("cost", () => {
  it("prices Haiku 5.5 usage", () => {
    expect(costUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
  });
});

describe("director keeps the template's facts", () => {
  it("rejects a rewrite that drops a number or reads coordinates", () => {
    expect(
      checkChapter(input, ok("Everyone aboard died, as the article records.")).join(),
    ).toContain("dropped a fact (9)");
    const withCoord: ChapterInput = {
      ...input,
      evidence: [...input.evidence, { id: "c", text: "site 26.6329, -80.1131" }],
    };
    expect(
      checkChapter(withCoord, {
        title: "On board",
        beats: [{ text: "All 9 (7 passengers, 2 crew) died at 26.6329.", cites: ["box:occ", "c"] }],
      }).join(),
    ).toContain("coordinate");
  });
});
