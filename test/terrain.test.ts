import { describe, expect, it } from "vitest";
import { decodeGrid, encodeHeights, heightAt } from "../src/scene/terrain.ts";

const flat = (west: number, south: number, size: number, value: number, n = 11) =>
  decodeGrid({
    west,
    south,
    east: west + size,
    north: south + size,
    width: n,
    height: n,
    heights: encodeHeights(new Array(n * n).fill(value)),
  });

describe("terrain", () => {
  it("round-trips heights, including negatives", () => {
    const g = decodeGrid({
      west: 0,
      south: 0,
      east: 1,
      north: 1,
      width: 2,
      height: 2,
      heights: encodeHeights([8848, -12, 0, 300]),
    });
    expect([...g.heights]).toEqual([8848, -12, 0, 300]);
  });
  it("fades the coarse grid to sea level at its edge", () => {
    const g = flat(0, 0, 10, 1000);
    expect(heightAt([g], 5, 5)).toBeCloseTo(1000);
    expect(heightAt([g], 0.01, 5)).toBeLessThan(50);
    expect(heightAt([g], 20, 5)).toBe(0);
  });
  it("prefers the finer grid inside it, blending at its edge", () => {
    const coarse = flat(0, 0, 10, 1000);
    const fine = flat(4, 4, 2, 3000);
    expect(heightAt([coarse, fine], 5, 5)).toBeCloseTo(3000);
    const edge = heightAt([coarse, fine], 4.05, 5);
    expect(edge).toBeGreaterThan(1000);
    expect(edge).toBeLessThan(3000);
  });
  it("reads north at row 0", () => {
    const g = decodeGrid({
      west: 0,
      south: 0,
      east: 1,
      north: 1,
      width: 2,
      height: 2,
      heights: encodeHeights([100, 100, 0, 0]),
    });
    // A single grid fades at its edge, so compare the two halves instead of exact values.
    expect(heightAt([g], 0.5, 0.75)).toBeGreaterThan(heightAt([g], 0.5, 0.25));
  });
});

describe("terrain tiles", () => {
  it("decodes terrarium heights and Mercator pixels", async () => {
    const { mercatorPixel, terrariumHeight } = await import("../scripts/bake/terrain.ts");
    expect(terrariumHeight(128, 0, 0)).toBe(0);
    expect(terrariumHeight(162, 144, 0)).toBe(8848);
    const p = mercatorPixel(0, 0, 0);
    expect(p.x).toBeCloseTo(128);
    expect(p.y).toBeCloseTo(128);
  });
  it("decodes a recorded tile (Everest region, zoom 9)", async () => {
    const { readFileSync } = await import("node:fs");
    const { decodePng } = await import("../scripts/bake/png.ts");
    const { terrariumHeight } = await import("../scripts/bake/terrain.ts");
    const img = decodePng(readFileSync("test/fixtures/terrarium-9-379-214.png"));
    expect([img.width, img.height, img.channels]).toEqual([256, 256, 3]);
    let max = 0;
    for (let i = 0; i < img.data.length; i += 3)
      max = Math.max(
        max,
        terrariumHeight(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0),
      );
    // The tile holds the Khumbu: its highest sample is above 8,000 m.
    expect(max).toBeGreaterThan(8000);
  });
});
