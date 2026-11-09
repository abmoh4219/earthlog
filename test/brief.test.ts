import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { briefOf, spokenBrief, weekOf } from "../src/scene/brief";
import { Edition } from "../src/scene/edition";

const edition = (date: string) =>
  Edition.parse(
    JSON.parse(
      readFileSync(join(__dirname, "..", "public", "editions", date, "edition.json"), "utf8"),
    ),
  );

describe("the morning brief", () => {
  const e = edition("2026-11-08");
  const b = briefOf(e, new Set(e.stories.map((s) => s.slug)));

  it("leads with the five biggest stories, in the edition's order", () => {
    expect(b.top.map((s) => s.slug)).toEqual(e.stories.slice(0, 5).map((s) => s.slug));
    expect(b.top.length + b.more.length).toBe(e.stories.length);
  });

  it("uses only what the edition says: titles and film openings", () => {
    for (const s of b.top) {
      const story = e.stories.find((x) => x.slug === s.slug);
      const opening = story?.headline ?? story?.summary ?? "";
      // The opening, or nothing when it only repeats the title.
      expect(["", opening]).toContain(s.line);
    }
  });

  it("is read aloud as plain sentences, numbered", () => {
    const lines = spokenBrief("8 November", b.top);
    expect(lines[0]).toBe("Earthlog. The world on 8 November.");
    expect(lines[1]?.startsWith("1. ")).toBe(true);
    expect(lines).toHaveLength(b.top.length + 2);
  });
});

describe("the week", () => {
  const dates = [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ];
  const w = weekOf(dates.map((d) => ({ edition: edition(d), films: new Set<string>() })));

  it("covers each day, newest first, three stories each", () => {
    expect(w?.from).toBe("2026-11-02");
    expect(w?.to).toBe("2026-11-08");
    expect(w?.days.map((d) => d.date)[0]).toBe("2026-11-08");
    for (const d of w?.days ?? []) expect(d.top.length).toBeLessThanOrEqual(3);
  });

  it("lists stories that ran three days or more, once each", () => {
    for (const s of w?.running ?? []) expect(s.day).toBeGreaterThanOrEqual(3);
    const titles = (w?.running ?? []).map((s) => s.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("counts where the week's stories happened", () => {
    expect(w?.stories).toBeGreaterThan(50);
    expect(w?.regions[0]?.[1]).toBeGreaterThan(0);
  });

  it("is nothing without editions", () => {
    expect(weekOf([])).toBeUndefined();
  });
});
