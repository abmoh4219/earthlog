import { describe, expect, it } from "vitest";
import { ageAt, orderStops, span } from "../scripts/lenses/person.ts";

describe("person lens helpers", () => {
  it("computes age at death from full dates only", () => {
    expect(ageAt("1940-07-13", "2026-10-28")).toBe(86);
    expect(ageAt("1996-09-21", "2026-11-03")).toBe(30);
    expect(ageAt("1996-11-04", "2026-11-03")).toBe(29); // the day before the birthday
    expect(ageAt("1940", "2026-10-28")).toBeUndefined();
  });

  it("writes year spans compactly", () => {
    expect(span("2015", "2016")).toBe("2015–16");
    expect(span("1999", "2004")).toBe("1999–2004"); // a new century is written in full
    expect(span("2001", "2009")).toBe("2001–09");
    expect(span("1966")).toBe("1966–");
    expect(span("2019", "2019")).toBe("2019");
    expect(span()).toBe("");
  });

  it("orders a life: birth, schools, dated stops, the rest, death", () => {
    const stop = (
      kind: Parameters<typeof orderStops>[0][number]["kind"],
      name: string,
      start?: string,
    ) => ({
      kind,
      name,
      lon: 0,
      lat: 0,
      evidence: `wd:Q1:${name}`,
      ...(start ? { start } : {}),
    });
    const order = orderStops([
      stop("died", "Los Angeles", "2026-10-28"),
      stop("team", "Club B", "2019"),
      stop("employer", "Studio"),
      stop("team", "Club A", "2015"),
      stop("education", "School"),
      stop("born", "Mirfield", "1940-07-13"),
    ]).map((s) => s.name);
    expect(order).toEqual(["Mirfield", "School", "Club A", "Club B", "Studio", "Los Angeles"]);
  });
});
