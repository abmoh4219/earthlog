import type { EventDef } from "./types.ts";

export default {
  id: "worldcup-2022",
  title: "The World Cup final",
  subtitle: "Argentina v France · Lusail, Qatar · 18 December 2022",
  category: "sports",
  listed: true,
  window: { start: "2022-12-18T13:30:00Z", end: "2022-12-18T20:00:00Z" },
  focus: "2022-12-18T15:00:00Z",
  timezone: "America/Argentina/Buenos_Aires",
  region: { west: -75, south: -56, east: 12, north: 52 },
  focusPoint: { lon: -63.5, lat: -34 },
  imagery: { day: "2022-12-18", nights: [] },
  // Google traffic dips when a country stops searching to watch: attention, not an outage.
  signal: { kind: "gtr-norm", tone: "attention", countries: ["AR", "FR"] },
} satisfies EventDef;
