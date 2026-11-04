import { describe, expect, it } from "vitest";
import { cleanSeries, money } from "../scripts/lenses/organization.ts";
import { countryName } from "../src/scene/geo.ts";

describe("cleanSeries", () => {
  it("keeps one value per year, oldest first", () => {
    const { points, dropped } = cleanSeries([
      { value: 3, at: "2009" },
      { value: 1, at: "2007" },
      { value: 2, at: "2008-12-31" },
      { value: 9 }, // no date: skipped
    ]);
    expect(points).toEqual([
      { year: "2007", value: 1 },
      { year: "2008", value: 2 },
      { year: "2009", value: 3 },
    ]);
    expect(dropped).toBe(0);
  });

  it("flags values wildly off the rest (a wrong unit in Wikidata) instead of charting them", () => {
    // OpenAI's recorded revenue mixes millions with bare thousands.
    const { points, dropped } = cleanSeries([
      { value: 13_807_074, at: "2016" },
      { value: 33_228_665, at: "2017" },
      { value: 49_968_631, at: "2018" },
      { value: 11_728, at: "2021" },
      { value: 44_485, at: "2022" },
    ]);
    expect(points.map((p) => p.year)).toEqual(["2016", "2017", "2018"]);
    expect(dropped).toBe(2);
  });
});

describe("money", () => {
  it("scales and uses the currency's symbol or code", () => {
    expect(money(4_097_860_000, "USD")).toBe("$4.1 billion");
    expect(money(215_938_000_000, "USD")).toBe("$215.9 billion");
    expect(money(930_000_000, "EUR")).toBe("€930 million");
    expect(money(1.2e12, "KRW")).toBe("1.2 trillion KRW");
    expect(money(-30_041_000, "USD")).toBe("−$30 million");
    expect(money(4500)).toBe("4,500");
  });
});

describe("countryName", () => {
  it("writes countries the way people do", () => {
    expect(countryName({ name: "United States of America", aliases: ["United States"] })).toBe(
      "United States",
    );
    expect(
      countryName({ name: "Dem. Rep. Congo", aliases: ["Democratic Republic of the Congo"] }),
    ).toBe("Democratic Republic of the Congo");
    expect(countryName({ name: "Iran", aliases: ["Islamic Republic of Iran"] })).toBe("Iran");
  });
});
