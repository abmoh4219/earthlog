// Terrain for a story's site, baked from the free AWS Terrain Tiles (Tilezen/Mapzen "joerd",
// terrarium PNG: height = R·256 + G + B/256 − 32768 metres). The browser can't read them (no
// CORS), so heights are baked into the bundle as three nested grids (wide and coarse → close
// and fine). Verified 2026-11-05:
//   GET https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png → 256×256 RGB
// Licence: per source, all redistributable with attribution (tilezen/joerd docs/attribution.md);
// for our sites the data is USGS SRTM/GMTED2010/3DEP (public domain, credit requested).
import type { Source, TerrainLayer } from "../../src/scene/schema.ts";
import { encodeHeights } from "../../src/scene/terrain.ts";
import { fetchBytes } from "./lib.ts";
import { decodePng, type Image } from "./png.ts";

const TILE = 256;
const tileUrl = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

/** Web-Mercator pixel coordinates (global, at zoom z) of a lon/lat. */
export function mercatorPixel(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z * TILE;
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  };
}

export function terrariumHeight(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** One grid: `size` degrees square around the site, `n`×`n` samples from zoom `z` tiles. */
async function grid(lon: number, lat: number, size: number, n: number, z: number) {
  const half = size / 2;
  const west = lon - half;
  const east = lon + half;
  const south = Math.max(-84, lat - half);
  const north = Math.min(84, lat + half);
  const tiles = new Map<string, Image>();
  const tileAt = async (tx: number, ty: number) => {
    const max = 2 ** z;
    const x = ((tx % max) + max) % max;
    const key = `${x}/${ty}`;
    let img = tiles.get(key);
    if (!img) {
      img = decodePng(await fetchBytes(tileUrl(z, x, ty)));
      tiles.set(key, img);
    }
    return img;
  };
  const px = async (gx: number, gy: number) => {
    const tx = Math.floor(gx / TILE);
    const ty = Math.floor(gy / TILE);
    const img = await tileAt(tx, ty);
    const i =
      ((Math.floor(gy) - ty * TILE) * img.width + (Math.floor(gx) - tx * TILE)) * img.channels;
    return terrariumHeight(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 128);
  };
  const heights: number[] = [];
  for (let row = 0; row < n; row++) {
    const la = north - ((north - south) * row) / (n - 1);
    for (let col = 0; col < n; col++) {
      const lo = west + ((east - west) * col) / (n - 1);
      const { x, y } = mercatorPixel(lo, la, z);
      // Bilinear between the four pixels around the point.
      const x0 = Math.floor(x - 0.5);
      const y0 = Math.floor(y - 0.5);
      const u = x - 0.5 - x0;
      const v = y - 0.5 - y0;
      const h =
        (await px(x0, y0)) * (1 - u) * (1 - v) +
        (await px(x0 + 1, y0)) * u * (1 - v) +
        (await px(x0, y0 + 1)) * (1 - u) * v +
        (await px(x0 + 1, y0 + 1)) * u * v;
      // The sea is flat: bathymetry would sink the ocean below the imagery.
      heights.push(Math.max(0, h));
    }
  }
  return { west, south, east, north, width: n, height: n, heights: encodeHeights(heights) };
}

/** Wide (16°), regional (3°) and close (0.6°, about 280 m a sample) grids around a site. */
export async function bakeTerrain(lon: number, lat: number): Promise<TerrainLayer> {
  return {
    kind: "terrain",
    grids: [
      await grid(lon, lat, 16, 160, 5),
      await grid(lon, lat, 3, 240, 7),
      await grid(lon, lat, 0.6, 240, 9),
    ],
  };
}

export function terrainSource(retrievedAt: string): Source {
  return {
    id: "terrain-tiles",
    name: "Terrain Tiles (Tilezen joerd, AWS Open Data)",
    url: "https://registry.opendata.aws/terrain-tiles/",
    license:
      "Per source, redistributable with attribution (https://github.com/tilezen/joerd/blob/master/docs/attribution.md)",
    attribution:
      "Terrain: SRTM, GMTED2010 and 3DEP courtesy of the U.S. Geological Survey; ETOPO1, NOAA; and the regional sources credited by Tilezen joerd",
    retrievedAt,
  };
}
