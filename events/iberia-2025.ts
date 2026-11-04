import type { EventDef } from "./types.ts";

export default {
  id: "iberia-2025",
  title: "The Iberian blackout",
  subtitle: "Spain and Portugal lose power · 28 April 2025",
  category: "infrastructure",
  listed: true,
  window: { start: "2025-04-28T09:30:00Z", end: "2025-04-29T05:00:00Z" },
  focus: "2025-04-28T10:30:00Z",
  timezone: "Europe/Madrid",
  region: { west: -12, south: 34, east: 6, north: 46 },
  focusPoint: { lon: -4.2, lat: 40.2 },
  // No Suomi NPP night pass covers Spain on the blackout night (GIBS returns no data,
  // checked 2026-11-04), so the night side shows the labelled typical-night composite.
  imagery: { day: "2025-04-28", nights: [] },
  // France is the comparison: same grid region, barely touched.
  signal: { kind: "ping-slash24", tone: "loss", countries: ["ES", "PT", "FR"] },
} satisfies EventDef;
