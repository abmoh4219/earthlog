import { describe, expect, it } from "vitest";
import { curiosityColor, curiosityLayers, curiosityRegions } from "../scripts/lenses/attention.ts";
import { firstSentence, inThread } from "../scripts/lenses/thread.ts";
import type { Country } from "../src/scene/schema.ts";

describe("curiosity map", () => {
  const readers = [
    { lang: "en", title: "X", views: 100_000 },
    { lang: "es", title: "X", views: 5_000 },
    { lang: "pt", title: "X", views: 800 },
    { lang: "zz", title: "X", views: 50 },
  ];
  it("lights each language's countries, never English, one language per country", () => {
    const regions = curiosityRegions(readers);
    expect(regions.some((r) => r.lang === "en")).toBe(false);
    expect(regions.find((r) => r.code === "MX")?.lang).toBe("es");
    expect(regions.find((r) => r.code === "BR")?.lang).toBe("pt");
    expect(new Set(regions.map((r) => r.code)).size).toBe(regions.length);
  });
  it("colours from cyan (fewest) to amber (most)", () => {
    expect(curiosityColor(800, 800, 5000)).toBe("#5ef2ff");
    expect(curiosityColor(5000, 800, 5000)).toBe("#f2b65a");
  });
  it("builds a regions layer and one column per placed language", () => {
    const square = (code: string, x: number): Country =>
      ({
        code,
        name: code,
        aliases: [],
        continent: "",
        label: [x + 1, 1],
        rings: [[x, 0, x + 2, 0, x + 2, 2, x, 2, x, 0]],
      }) as unknown as Country;
    const { layers } = curiosityLayers(readers, [square("MX", 0), square("BR", 10)]);
    const cols = layers.find((l) => l.kind === "columns");
    expect(cols && cols.kind === "columns" ? cols.columns.map((c) => c.id) : []).toEqual([
      "es",
      "pt",
    ]);
  });
});

describe("story threads", () => {
  const item = (topic: string | undefined, links: string[]) => ({
    heading: "",
    text: "",
    links,
    sources: [],
    ...(topic ? { topic } : {}),
  });
  it("ties items only through the portal's own topic or links", () => {
    const anchor = { topic: "2026 Strait of Hormuz crisis", title: "2026 Strait of Hormuz crisis" };
    expect(inThread(anchor, item("2026 Strait of Hormuz crisis", []))).toBe(true);
    expect(inThread(anchor, item(undefined, ["Oman", "2026 Strait of Hormuz crisis"]))).toBe(true);
    expect(inThread(anchor, item("2026 Iran war", ["Iran"]))).toBe(false);
    expect(inThread({}, item("x", ["x"]))).toBe(false);
  });
  it("takes an item's first sentence when it is short enough", () => {
    expect(firstSentence("A ship is hit. 13 are rescued.")).toBe("A ship is hit.");
    expect(firstSentence(`${"x".repeat(250)}.`)).toBeUndefined();
  });
});

describe("shared layers", () => {
  it("survive a lens clearing the general places, arcs and regions", async () => {
    const { sharedLayer } = await import("../scripts/lenses/general.ts");
    expect(sharedLayer({ kind: "regions", name: "curiosity", regions: [], legend: [] })).toBe(true);
    expect(sharedLayer({ kind: "places", name: "thread", places: [] })).toBe(true);
    expect(sharedLayer({ kind: "places", places: [] })).toBe(false);
  });
});
