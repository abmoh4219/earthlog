import { describe, expect, it } from "vitest";
import {
  andList,
  boxItems,
  boxTemplate,
  linkedSentences,
  links,
  sectionsMatching,
  the,
} from "../scripts/lenses/culture.ts";

describe("infobox values", () => {
  it("splits plain lists, keeping piped links' text", () => {
    const v = "{{Plain list| * [[Rajinikanth]] * [[Yash (actor)|Yash]] * [[Sai Pallavi]] }}";
    expect(boxItems(v)).toEqual(["Rajinikanth", "Yash", "Sai Pallavi"]);
    expect(links(v)).toEqual(["Rajinikanth", "Yash (actor)", "Sai Pallavi"]);
  });
  it("drops refs and expands currency and dashes", () => {
    expect(boxItems("{{INR|808 crore}}<ref>{{Cite web |title=x}}</ref>")).toEqual(["₹808 crore"]);
    expect(boxItems("{{INR}}250{{en dash}}350 crore<ref name=a/>")).toEqual(["₹250–350 crore"]);
  });
  it("reads film dates, with their labels", () => {
    expect(boxTemplate("Film date|df=yes|2026|10|15")).toBe("15 October 2026");
    expect(boxTemplate("Film date|2026|10|27|Academy Museum|2026|11|05|worldwide|df=yes")).toBe(
      "27 October 2026 (Academy Museum), 5 November 2026 (worldwide)",
    );
    expect(boxTemplate("Start date|2026|9|15")).toBe("15 September 2026");
  });
  it("reads 'based on'", () => {
    expect(boxItems("{{Based on|''[[Ramayana]]''|[[Valmiki]]}}")).toEqual(["Ramayana by Valmiki"]);
  });
  it("splits <br /> lists", () => {
    expect(boxItems("[[Shridhar Raghavan]]<br />Nitesh Tiwari")).toEqual([
      "Shridhar Raghavan",
      "Nitesh Tiwari",
    ]);
  });
});

describe("filming sections", () => {
  const wikitext = [
    "== Production ==",
    "=== Development ===",
    "Announced in [[Paris]] in 2024.",
    "=== Filming ===",
    "[[Principal photography]] began on 10 March 2025 in Chennai.<ref>{{Cite web|title=a}}</ref> The second schedule began in [[Attappadi taluk|Attappadi]], [[Kerala]], on 11 April.",
    "==== Overseas ====",
    "Some scenes were shot in [[Dubai]].",
    "== Music ==",
    "The score was recorded in [[London]].",
  ].join("\n");
  it("keeps the filming section and its subsections only", () => {
    const raw = sectionsMatching(wikitext, /^filming$/i);
    expect(raw).toContain("Attappadi");
    expect(raw).toContain("Dubai");
    expect(raw).not.toContain("Paris");
    expect(raw).not.toContain("London");
  });
  it("splits sentences and keeps their links", () => {
    const s = linkedSentences(sectionsMatching(wikitext, /^filming$/i));
    expect(s.map((x) => x.text)).toEqual([
      "Principal photography began on 10 March 2025 in Chennai.",
      "The second schedule began in Attappadi, Kerala, on 11 April.",
      "Some scenes were shot in Dubai.",
    ]);
    expect(s[1]?.links).toEqual(["Attappadi taluk", "Kerala"]);
  });
});

describe("phrasing", () => {
  it("joins lists and names countries", () => {
    expect(andList(["A"])).toBe("A");
    expect(andList(["A", "B", "C"])).toBe("A, B and C");
    expect(the("United States")).toBe("the United States");
    expect(the("India")).toBe("India");
  });
});

describe("closestOutline", () => {
  it("finds the country a coastal city sits just outside of", async () => {
    const { closestOutline } = await import("../scripts/lenses/culture.ts");
    const square = (code: string, x: number, y: number) => ({
      code,
      name: code,
      label: [x + 1, y + 1] as [number, number],
      rings: [[x, y, x + 2, y, x + 2, y + 2, x, y + 2, x, y]],
    });
    const countries = [square("AA", 0, 0), square("BB", 5, 0)];
    // @ts-expect-error minimal country shapes for the test
    expect(closestOutline(2.2, 1, countries)?.code).toBe("AA");
    // @ts-expect-error minimal country shapes for the test
    expect(closestOutline(3.5, 1, countries)).toBeUndefined();
  });
});

describe("wideShot", () => {
  it("centres across the antimeridian and on where most places are", async () => {
    const { wideShot } = await import("../scripts/lenses/general.ts");
    const fiji = wideShot([
      { lon: 178, lat: -18 },
      { lon: -179, lat: -16 },
    ]);
    expect(Math.abs(fiji?.lon ?? 0)).toBeGreaterThan(178);
    const us = wideShot([
      { lon: -118, lat: 34 },
      { lon: -74, lat: 40 },
      { lon: -87, lat: 41 },
      { lon: 147, lat: -35 },
    ]);
    // Not the lon/lat midpoint (Africa): the centroid leans toward the United States.
    expect(us?.lon ?? 0).toBeLessThan(-60);
  });
});
