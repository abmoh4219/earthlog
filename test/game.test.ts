import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type Gazetteer, makePlacer } from "../scripts/news/place";
import { Edition } from "../src/scene/edition";
import {
  distanceKm,
  EMPTY_STATS,
  finish,
  hideNames,
  roundsOf,
  scoreFor,
  squares,
} from "../src/scene/game";
import { Country } from "../src/scene/schema";

const root = join(__dirname, "..");
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));
const countries = z.array(Country).parse(read("public/geo/countries.json"));
const placer = makePlacer(read("scripts/news/places.json") as Gazetteer, countries);

describe("hiding the places of a clue", () => {
  it("hides cities, countries and demonyms, keeping punctuation", () => {
    expect(placer.mask("A train derails near Giza, Egypt, killing seven people.")).toBe(
      "A train derails near ▢▢▢, ▢▢▢, killing seven people.",
    );
    expect(placer.mask("Israeli strike kills 12 in Gaza")).toBe("▢▢▢ strike kills 12 in ▢▢▢");
  });

  it("hides names the gazetteer lacks, accents folded", () => {
    expect(hideNames("Gunman kills six in Krakow's main square", ["Kraków"])).toBe(
      "Gunman kills six in ▢▢▢'s main square",
    );
    expect(hideNames("Crash at El Ayyat station", ["El Ayyat"])).toBe("Crash at ▢▢▢ station");
  });
});

describe("the rounds of a day", () => {
  const edition = Edition.parse(read("public/editions/2026-11-08/edition.json"));
  const rounds = roundsOf(edition, placer.mask, new Set());

  it("makes up to five rounds of placed stories, places hidden", () => {
    expect(rounds.length).toBeGreaterThan(0);
    expect(rounds.length).toBeLessThanOrEqual(5);
    for (const r of rounds) {
      expect(r.clue).not.toContain(r.answer.name.split(",")[0]);
      expect(Number.isFinite(r.answer.lon)).toBe(true);
    }
  });

  it("never asks more than twice about one country", () => {
    const story = new Map(edition.stories.map((s) => [s.slug, s]));
    const per = new Map<string, number>();
    for (const r of rounds) {
      const c = story.get(r.slug)?.place?.country ?? "";
      per.set(c, (per.get(c) ?? 0) + 1);
    }
    expect(Math.max(...per.values())).toBeLessThanOrEqual(2);
  });
});

describe("scoring and the streak", () => {
  it("measures great-circle distance", () => {
    // Cairo to Kraków, about 2,450 km.
    const d = distanceKm({ lon: 31.24, lat: 30.04 }, { lon: 19.94, lat: 50.06 });
    expect(d).toBeGreaterThan(2350);
    expect(d).toBeLessThan(2550);
  });

  it("scores 1,000 on the spot, less further away", () => {
    expect(scoreFor(10)).toBe(1000);
    expect(scoreFor(1436)).toBeGreaterThan(480);
    expect(scoreFor(1436)).toBeLessThan(520);
    expect(scoreFor(12000)).toBeLessThan(10);
  });

  it("grows the streak on consecutive days, restarts after a gap, ignores replays", () => {
    let s = finish(EMPTY_STATS, "2026-11-07", 3000);
    s = finish(s, "2026-11-08", 4200);
    expect(s).toMatchObject({ streak: 2, best: 4200, last: "2026-11-08" });
    expect(finish(s, "2026-11-08", 5000)).toBe(s);
    expect(finish(s, "2026-11-10", 100).streak).toBe(1);
  });

  it("shares a result as squares, without the answers", () => {
    expect(squares([1000, 500, 150, 20])).toBe("🟩🟨🟧🟥");
  });
});
