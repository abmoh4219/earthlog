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

describe("science lens facts", () => {
  it("reads a spaceflight infobox", async () => {
    const { readFacts } = await import("../scripts/lenses/science.ts");
    const { anyInfobox } = await import("../scripts/lenses/election/infobox.ts");
    const box = anyInfobox(`{{Infobox spaceflight
| mission type = Crewed lunar [[Flyby (spaceflight)|flyby]]
| operator = [[NASA]]
| crew members = {{Unbulleted list  | [[Reid Wiseman]]  | [[Victor Glover]]  | [[Christina Koch]]  | [[Jeremy Hansen]] }}
| launch date = April 1, 2026, 22:35:12&nbsp;[[UTC]] (6:35:12&nbsp;p.m.&nbsp;[[Eastern Daylight Time|EDT]])<ref name="t" />
| launch rocket = [[Space Launch System]]
| launch site = [[Kennedy Space Center|Kennedy]], [[Kennedy Space Center Launch Complex 39B|LC-39B]]
| landing site = [[Pacific Ocean]] southwest of [[San Diego]] ({{Coord|32.3|N|117.8|W}})
}}`);
    const facts = readFacts(box?.params ?? new Map());
    const get = (l: string) => facts.find((f) => f.label === l)?.text;
    expect(get("Mission")).toBe("Crewed lunar flyby");
    expect(get("Crew")).toBe("Reid Wiseman, Victor Glover, Christina Koch, Jeremy Hansen");
    expect(get("Rocket")).toBe("Space Launch System");
    expect(get("Launch site")).toBe("Kennedy, LC-39B");
    expect(get("Launched")).toContain("April 1, 2026, 22:35:12 UTC");
    expect(get("Launched")).not.toContain("EDT");
  });
});
