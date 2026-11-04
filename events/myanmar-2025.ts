import type { EventDef } from "./types.ts";

export default {
  id: "myanmar-2025",
  title: "The Myanmar earthquake",
  subtitle: "Magnitude 7.7 near Mandalay · 28 March 2025",
  category: "nature",
  listed: true,
  window: { start: "2025-03-28T06:00:00Z", end: "2025-03-28T18:00:00Z" },
  focus: "2025-03-28T06:20:00Z",
  timezone: "Asia/Yangon",
  region: { west: 88, south: 10, east: 106, north: 30 },
  focusPoint: { lon: 95.94, lat: 22.01 },
  imagery: { day: "2025-03-28", nights: [] },
  quakes: { minMagnitude: 4.5 },
  signal: { kind: "ping-slash24", tone: "loss", countries: ["MM", "TH"] },
} satisfies EventDef;
