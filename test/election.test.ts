// The election lens's parsers, against wikitext recorded on 2026-11-04 (trimmed). No network.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readable } from "../scripts/lenses/election/index.ts";
import {
  infoboxBody,
  num,
  params,
  parseInfobox,
  plainText,
} from "../scripts/lenses/election/infobox.ts";
import { parseHouseRaces, parseStateRaces, partyOf, tally } from "../scripts/lenses/election/us.ts";

const wiki = z
  .object({ israel: z.string(), house: z.string(), senate: z.string(), governors: z.string() })
  .parse(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, "fixtures", "election-wikitext-2026-11-03.json"),
        "utf8",
      ),
    ),
  );

describe("the universal election infobox", () => {
  it("reads a non-US election: Israel 2026", () => {
    const box = parseInfobox(wiki.israel);
    expect(box).toMatchObject({
      country: "Israel",
      date: "2026-10-27",
      majority: 61,
      turnout: 77.97,
    });
    expect(box?.parties[0]).toMatchObject({
      n: 1,
      name: "Likud",
      link: "Likud",
      leader: "Benjamin Netanyahu",
      pct: 20.52,
      seats: 27,
      lastElection: 36,
    });
    // "last_election2 = New" is not a number and must not become one.
    expect(box?.parties[1]).toMatchObject({ name: "Yashar", seats: 21 });
    expect(box?.parties[1]?.lastElection).toBeUndefined();
    expect(box?.parties.length).toBe(11);
  });

  it("reads the US House infobox: seats now and before, the editors' timestamp", () => {
    const box = parseInfobox(wiki.house);
    expect(box).toMatchObject({ majority: 218, lastUpdate: "9:15 AM, November 4, 2026" });
    expect(box?.parties.map((p) => [p.name, p.seats, p.seatsBefore])).toEqual([
      ["Democratic Party (US)", 231, 214],
      ["Republican Party (US)", 139, 218],
    ]);
  });

  it("parses template parameters without splitting inside links or templates", () => {
    const p = params("a = [[X|Y]] | b = {{t|1|2}} | c = 3");
    expect([...p]).toEqual([
      ["a", "[[X|Y]]"],
      ["b", "{{t|1|2}}"],
      ["c", "3"],
    ]);
    expect(infoboxBody("text {{Infobox election | x = {{y}} }} more")).toBe(
      "Infobox election | x = {{y}} ",
    );
    expect(plainText("'''[[Likud|The Likud]]'''<ref>cite</ref>")).toBe("The Likud");
    expect(num("77.97% ({{increase}} 7.34pp)")).toBe(77.97);
    expect(num("'''231'''")).toBe(231);
  });
});

describe("the US adapter", () => {
  it("reads House districts: winner, flip, and races not yet called", () => {
    const races = parseHouseRaces(wiki.house);
    const byId = new Map(races.map((r) => [r.id, r]));
    expect(byId.get("AL-03")).toMatchObject({
      geoid: "0103",
      winner: "R",
      winnerName: "Mike Rogers",
      flip: false,
    });
    expect(byId.get("CA-22")).toMatchObject({ geoid: "0622", flip: false });
    expect(byId.get("CA-22")?.winner).toBeUndefined(); // "advanced to general": not called
    expect(byId.get("CO-08")).toMatchObject({
      winner: "D",
      winnerName: "Manny Rutinel",
      incumbent: "R",
      flip: true,
    });
  });

  it("reads Senate rows, including Minnesota's DFL as Democratic and an uncalled race", () => {
    const races = parseStateRaces(wiki.senate, "Senate");
    const byId = new Map(races.map((r) => [r.id, r]));
    expect(byId.get("IA")).toMatchObject({ winner: "D", flip: true, geoid: "19" });
    expect(byId.get("MN")).toMatchObject({ winner: "D", winnerName: "Peggy Flanagan" });
    expect(byId.get("AK")?.winner).toBeUndefined();
    expect(tally(races)).toMatchObject({ D: 2, R: 0, uncalled: 1 });
  });

  it("reads governor rows, whose state comes before the office", () => {
    const races = parseStateRaces(wiki.governors, "gubernatorial");
    expect(races.map((r) => [r.id, r.winner, r.flip])).toEqual([
      ["AL", "R", false],
      ["GA", "D", true],
    ]);
  });

  it("knows party names and abbreviations", () => {
    expect(partyOf("Democratic")).toBe("D");
    expect(partyOf("DFL")).toBe("D");
    expect(partyOf("Republican")).toBe("R");
    expect(partyOf("Independent")).toBe("I");
    expect(partyOf("Libertarian")).toBe("O");
  });
});

describe("party colours", () => {
  it("lifts dark colours so they read on a dark globe, and keeps light ones", () => {
    expect(readable("#003CBA")).not.toBe("#003cba");
    expect(readable("#ffd166")).toBe("#ffd166");
  });
});
