import { describe, expect, it } from "vitest";
import { REGIONS, regionOf } from "../src/scene/regions";
import { type SearchItem, search } from "../src/scene/search";

const item = (title: string, kind: SearchItem["kind"], date: string, keys = ""): SearchItem => ({
  kind,
  title,
  detail: "",
  href: `/${title}`,
  date,
  keys,
});

describe("search", () => {
  const items = [
    item("2026 Kraków shooting", "story", "2026-11-08", "Europe crime"),
    item(
      "Poland launches terrorism probe into mass shooting in Krakow",
      "now",
      "2026-11-09T01:00:00Z",
    ),
    item("2026 El Ayyat train collision", "story", "2026-11-08", "Africa Egypt"),
    item("The Iberian blackout", "classic", "2025-04-28", "outage"),
  ];

  it("matches the start of words, accents folded, every word required", () => {
    expect(search(items, "krak").map((i) => i.title)).toEqual([
      "Poland launches terrorism probe into mass shooting in Krakow",
      "2026 Kraków shooting",
    ]);
    expect(search(items, "train egypt").map((i) => i.title)).toEqual([
      "2026 El Ayyat train collision",
    ]);
    expect(search(items, "train poland")).toEqual([]);
    expect(search(items, "  ")).toEqual([]);
  });

  it("finds by region, topic and other keys, title matches first", () => {
    expect(search(items, "europe")[0]?.title).toBe("2026 Kraków shooting");
    expect(search(items, "blackout")[0]?.kind).toBe("classic");
  });
});

describe("regions", () => {
  it("takes the Middle East out of Asia, keeps Egypt in Africa", () => {
    expect(regionOf("IR", "Asia")).toBe("Middle East");
    expect(regionOf("TR", "Asia")).toBe("Middle East");
    expect(regionOf("EG", "Africa")).toBe("Africa");
    expect(regionOf("JP", "Asia")).toBe("Asia");
    expect(regionOf(undefined, "Antarctica")).toBeUndefined();
    expect(REGIONS).toHaveLength(7);
  });
});
