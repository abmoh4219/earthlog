import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseCountries, parseValues } from "../scripts/bake/worldbank.ts";
import { median, neighbourhoodShot, peakAndLatest } from "../scripts/lenses/economy.ts";

const fixture = z
  .object({ countries: z.unknown(), inflation: z.unknown() })
  .parse(
    JSON.parse(
      readFileSync(join(import.meta.dirname, "fixtures", "worldbank-2026-11-04.json"), "utf8"),
    ),
  );

describe("World Bank parsers (recorded 2026-11-04)", () => {
  it("lists countries with trimmed regions and no aggregates", () => {
    const c = parseCountries(fixture.countries);
    expect(c.every((x) => x.region !== "Aggregates" && x.region === x.region.trim())).toBe(true);
    expect(c.find((x) => x.iso2 === "AU")?.region).toBe("East Asia & Pacific");
  });

  it("groups values by country, oldest first, nulls dropped", () => {
    const s = parseValues(fixture.inflation);
    const au = s.byCountry.get("AU") ?? [];
    expect(au.length).toBeGreaterThan(3);
    expect(au.every((p, i) => i === 0 || (au[i - 1]?.year ?? "") < p.year)).toBe(true);
    expect(au.at(-1)?.value).toBeCloseTo(2.87, 1);
  });
});

describe("economy lens helpers", () => {
  it("takes medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });

  it("finds a recent peak and the latest value", () => {
    const { latest, peak } = peakAndLatest([
      { year: "2021", value: 2.9 },
      { year: "2022", value: 6.6 },
      { year: "2023", value: 5.6 },
      { year: "2025", value: 2.9 },
    ]);
    expect(peak?.year).toBe("2022");
    expect(latest?.year).toBe("2025");
  });

  it("stands behind the story's country and looks toward its neighbours", () => {
    // Australia looking at Asia: north-ish (heading between -45° and 45°).
    const shot = neighbourhoodShot({ lon: 134, lat: -24 }, [
      { lon: 105, lat: 35 },
      { lon: 138, lat: 36 },
      { lon: 106, lat: 47 },
      { lon: 174, lat: -41 },
      { lon: 134, lat: -24 },
    ]);
    expect(Math.abs(shot.heading ?? 999)).toBeLessThan(45);
    expect(shot.pitch).toBeGreaterThan(-60);
  });
});
