import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  Detail,
  mmiInfo,
  parseCities,
  parseContours,
  parseExposure,
  parseRupture,
} from "../scripts/bake/shakemap.ts";
import { quakeFilm } from "../scripts/lenses/disaster.ts";
import { LayerData } from "../src/scene/schema.ts";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`test/fixtures/usgs-us6000u18k-${name}.json`, "utf8"));

describe("USGS ShakeMap and PAGER (M7.7 Panama, 2026-10-09)", () => {
  const detail = Detail.parse(fixture("detail"));
  const data = {
    detail,
    contours: parseContours(fixture("cont_mmi")),
    rupture: parseRupture(fixture("rupture")),
    exposure: parseExposure(fixture("exposures")),
    cities: parseCities(fixture("cities")),
  };

  it("parses the products", () => {
    expect(detail.properties.mag).toBe(7.7);
    expect(data.contours[0]?.mmi).toBeGreaterThan(data.contours.at(-1)?.mmi ?? 99);
    expect(data.rupture.length).toBeGreaterThan(0);
    expect(data.exposure.find((e) => e.mmi === 8)?.people).toBe(11406);
    expect(data.cities[0]?.name).toBe("Tonosi");
    expect(mmiInfo(7.9).roman).toBe("VIII");
  });

  it("films the quake with every sentence cited and every layer valid", () => {
    const film = quakeFilm(data, "2026-10-10");
    const ids = new Set(film.evidence.map((e) => e.id));
    expect(film.chapters.map((c) => c.title)).toEqual([
      "The earthquake",
      "The shaking",
      "Who felt it",
    ]);
    for (const c of film.chapters)
      for (const b of c.beats) {
        expect(b.cites.length).toBeGreaterThan(0);
        for (const id of b.cites) expect(ids.has(id)).toBe(true);
      }
    for (const l of film.layers) LayerData.parse(l);
    const text = film.chapters.flatMap((c) => c.beats.map((b) => b.text)).join(" ");
    expect(text).toContain(
      "A magnitude 7.7 earthquake struck 10 km WSW of Pitaloza Arriba, Panama",
    );
    expect(text).toContain("orange alert");
    expect(text).toContain("2,013 people reported");
  });
});
