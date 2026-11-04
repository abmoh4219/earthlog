import { describe, expect, it } from "vitest";
import { declutter } from "../src/scene/declutter.ts";

describe("declutter", () => {
  it("keeps the most important of two overlapping labels", () => {
    const show = declutter([
      { x: 0, y: 0, w: 100, h: 16, priority: 1 },
      { x: 50, y: 5, w: 100, h: 16, priority: 2 },
    ]);
    expect(show).toEqual([false, true]);
  });
  it("keeps labels that don't touch", () => {
    expect(
      declutter([
        { x: 0, y: 0, w: 100, h: 16, priority: 1 },
        { x: 0, y: 40, w: 100, h: 16, priority: 1 },
      ]),
    ).toEqual([true, true]);
  });
});
