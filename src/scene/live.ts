// The living Earth beside the news (ADR-0022): the day's significant earthquakes and the open
// natural events (storms, wildfires, volcanoes), collected every hour with the headlines and
// published with them (now-data branch). Shared by scripts/live.ts and the site.
import { z } from "zod";
import { IsoUtc } from "./schema.ts";

export const LiveQuake = z.object({
  id: z.string(),
  t: IsoUtc,
  mag: z.number(),
  place: z.string(),
  lon: z.number(),
  lat: z.number(),
  depthKm: z.number(),
  url: z.url(),
});
export type LiveQuake = z.infer<typeof LiveQuake>;

export const LIVE_KINDS = ["storm", "wildfire", "volcano"] as const;
export const LiveEvent = z.object({
  id: z.string(),
  kind: z.enum(LIVE_KINDS),
  title: z.string(),
  /** Its latest position fix (UTC). */
  t: IsoUtc,
  lon: z.number(),
  lat: z.number(),
  /** The size the agency gives, as it gives it ("65 kts", "982 acres"). */
  size: z.string().optional(),
  /** The agency that reports it (JTWC, IRWIN, …), credited with NASA EONET. */
  agency: z.string(),
  url: z.url(),
});
export type LiveEvent = z.infer<typeof LiveEvent>;

export const LiveFile = z.object({
  version: z.literal(1),
  generatedAt: IsoUtc,
  quakes: z.array(LiveQuake),
  events: z.array(LiveEvent),
  /** Each source reached this run, and whether it answered (shown, never hidden). */
  sources: z.array(
    z.object({
      id: z.enum(["usgs", "eonet"]),
      name: z.string(),
      url: z.url(),
      license: z.string(),
      ok: z.boolean(),
    }),
  ),
});
export type LiveFile = z.infer<typeof LiveFile>;

/** "M6.1 earthquake, 10 km deep" — what USGS measured, nothing more. */
export function quakeLine(q: LiveQuake): string {
  return `M${q.mag.toFixed(1)} earthquake, ${Math.round(q.depthKm)} km deep`;
}

export const KIND_LABEL: Record<LiveEvent["kind"], string> = {
  storm: "Storm",
  wildfire: "Wildfire",
  volcano: "Volcano",
};
