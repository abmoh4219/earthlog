import { describe, expect, it } from "vitest";
import { parliamentSeats } from "../src/scene/charts.ts";

describe("parliamentSeats", () => {
  it.each([120, 435, 100, 9])("places exactly %i seats", (n) => {
    expect(parliamentSeats(n).dots).toHaveLength(n);
  });

  it("fills from left to right and stays in the upper half circle", () => {
    const { dots } = parliamentSeats(120);
    expect(dots[0]?.x).toBeLessThan(0);
    expect(dots.at(-1)?.x).toBeGreaterThan(0);
    expect(dots.every((d) => d.y >= -1e-9 && Math.hypot(d.x, d.y) <= 1 + 1e-9)).toBe(true);
  });
});
