// NASA GIBS WMTS tile URLs (no key). Layer names and tile matrix sets were checked
// against the live service on 2026-11-04; each layer only exists at specific
// GoogleMapsCompatible levels, so the level is part of the layer definition.
// https://nasa-gibs.github.io/gibs-api-docs/

const BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

export interface GibsLayer {
  id: string;
  maxLevel: number;
  ext: "jpg" | "jpeg" | "png";
  credit: string;
}

/** Cloud-free monthly composite: a calm, beautiful base for the whole planet. */
export const BLUE_MARBLE: GibsLayer = {
  id: "BlueMarble_NextGeneration",
  maxLevel: 8,
  ext: "jpeg",
  credit: "NASA Blue Marble",
};

/** City lights composite, shown on the night side of the globe. */
export const BLACK_MARBLE: GibsLayer = {
  id: "VIIRS_Black_Marble",
  maxLevel: 8,
  ext: "png",
  credit: "NASA Black Marble",
};

/** The real satellite image of a given day (VIIRS, Suomi NPP). */
export const VIIRS_TRUE_COLOR: GibsLayer = {
  id: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
  maxLevel: 9,
  ext: "jpg",
  credit: "NASA VIIRS true colour",
};

/** The real night-lights pass of a given night (VIIRS day/night band). */
export const VIIRS_NIGHT: GibsLayer = {
  id: "VIIRS_SNPP_DayNightBand_At_Sensor_Radiance",
  maxLevel: 8,
  ext: "png",
  credit: "NASA VIIRS day/night band",
};

export function gibsTemplate(layer: GibsLayer, date: string): string {
  return `${BASE}/${layer.id}/default/${date}/GoogleMapsCompatible_Level${layer.maxLevel}/{z}/{y}/{x}.${layer.ext}`;
}

export const STATIC_DATES = {
  blueMarble: "2004-08-01",
  blackMarble: "2016-01-01",
} as const;
