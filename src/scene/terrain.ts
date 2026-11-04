// Heights from baked terrain grids (see TerrainLayer in schema.ts). Pure, shared by the
// globe's heightmap provider and the tests.
import type { TerrainGrid } from "./schema.ts";

export interface Grid extends Omit<TerrainGrid, "heights"> {
  heights: Int16Array;
}

/** base64 little-endian Int16 → Int16Array (atob exists in browsers and Node). */
export function decodeGrid(g: TerrainGrid): Grid {
  const bin = atob(g.heights);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const heights = new Int16Array(g.width * g.height);
  for (let i = 0; i < heights.length; i++) heights[i] = view.getInt16(i * 2, true);
  return { ...g, heights };
}

export function encodeHeights(heights: ArrayLike<number>): string {
  const bytes = new Uint8Array(heights.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < heights.length; i++)
    view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(heights[i] ?? 0))), true);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

/** Bilinear height inside one grid, or undefined outside it. */
function sample(g: Grid, lon: number, lat: number): number | undefined {
  if (lon < g.west || lon > g.east || lat < g.south || lat > g.north) return undefined;
  const fx = ((lon - g.west) / (g.east - g.west)) * (g.width - 1);
  const fy = ((g.north - lat) / (g.north - g.south)) * (g.height - 1);
  const x0 = Math.min(g.width - 2, Math.floor(fx));
  const y0 = Math.min(g.height - 2, Math.floor(fy));
  const u = fx - x0;
  const v = fy - y0;
  const at = (x: number, y: number) => g.heights[y * g.width + x] ?? 0;
  return (
    at(x0, y0) * (1 - u) * (1 - v) +
    at(x0 + 1, y0) * u * (1 - v) +
    at(x0, y0 + 1) * (1 - u) * v +
    at(x0 + 1, y0 + 1) * u * v
  );
}

/** 0 at a grid's edge, rising to 1 a fraction `band` of its size inside. */
function edgeWeight(g: Grid, lon: number, lat: number, band: number): number {
  const dx = Math.min(lon - g.west, g.east - lon) / (g.east - g.west);
  const dy = Math.min(lat - g.south, g.north - lat) / (g.north - g.south);
  const t = Math.max(0, Math.min(1, Math.min(dx, dy) / band));
  return t * t * (3 - 2 * t);
}

/**
 * The height at a point: grids are ordered coarse to fine; each finer grid blends in over
 * its outer edge (no seams), and the coarsest fades to sea level (no cliff where the baked
 * area ends). 0 outside every grid.
 */
export function heightAt(grids: readonly Grid[], lon: number, lat: number): number {
  let h = 0;
  grids.forEach((g, i) => {
    const s = sample(g, lon, lat);
    if (s === undefined) return;
    const w = edgeWeight(g, lon, lat, i === 0 ? 0.18 : 0.1);
    h = h + (s - h) * w;
  });
  return h;
}
