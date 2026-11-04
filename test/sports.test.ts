import { describe, expect, it } from "vitest";
import { headline } from "../scripts/edition/build.ts";
import { anyInfobox } from "../scripts/lenses/election/infobox.ts";

// From "2026 Melbourne Cup" (Wikipedia, retrieved 2026-11-05).
const MELBOURNE_CUP = `{{Infobox horse race
|name            = 2026 Melbourne Cup
|location        = [[Flemington Racecourse]]<br>[[Melbourne]], Australia
|date            = 3 November 2026
|distance        = 3,200 metres
|winning horse   = [[Point Of Law (horse)|Point Of Law]]
|winning time    =
|winning jockey  = Ethan Brown
|winning trainer = [[Ciaron Maher]]
|attendance      = 97,112
|previous        = [[2025 Melbourne Cup|2025]]}}
The race was run.`;

describe("anyInfobox", () => {
  it("reads any infobox type with normalised parameter names", () => {
    const box = anyInfobox(MELBOURNE_CUP);
    expect(box?.type).toBe("horse race");
    expect(box?.params.get("winning horse")).toBe("[[Point Of Law (horse)|Point Of Law]]");
    expect(box?.params.get("winning jockey")).toBe("Ethan Brown");
    expect(box?.params.get("attendance")).toBe("97,112");
    expect(box?.params.get("winning time")).toBe("");
  });
});

describe("headline", () => {
  it("skips the sport lead-in of sports news", () => {
    expect(
      headline("In thoroughbred racing, Point Of Law wins the 2026 Melbourne Cup at Flemington."),
    ).toBe("Point Of Law wins the 2026 Melbourne Cup at Flemington.");
    expect(headline("In association football, the AFC postpones the Asian Cup")).toBe(
      "The AFC postpones the Asian Cup",
    );
  });
});
