// World regions, the reader's way to filter by where (ADR-0023). Pure; shared by the scripts
// and the site. Natural Earth's continents, with the Middle East taken out of Asia, because
// readers and newsrooms treat it as a region of its own. Egypt stays in Africa (as in Natural
// Earth); Turkey and Cyprus go with the Middle East, as most newsrooms file them.
import { z } from "zod";

export const REGIONS = [
  "Africa",
  "Middle East",
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Oceania",
] as const;
export const Region = z.enum(REGIONS);
export type Region = z.infer<typeof Region>;

const MIDDLE_EAST = new Set([
  "AE",
  "BH",
  "CY",
  "IL",
  "IQ",
  "IR",
  "JO",
  "KW",
  "LB",
  "OM",
  "PS",
  "QA",
  "SA",
  "SY",
  "TR",
  "YE",
]);

/** The region of a country (ISO alpha-2) given its Natural Earth continent. */
export function regionOf(country: string | undefined, continent: string | undefined) {
  if (country && MIDDLE_EAST.has(country)) return "Middle East" as const;
  return REGIONS.find((r) => r === continent && r !== "Middle East");
}
