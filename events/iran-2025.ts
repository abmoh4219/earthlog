import type { EventDef } from "./types.ts";

// Conflict-adjacent: sensors only (RESPONSIBLE-USE.md §6). Narration describes what the
// signals did, never why; cause and actors would need quoted, cited reports.
export default {
  id: "iran-2025",
  title: "Iran goes dark",
  subtitle: "Internet signals from Iran collapse · 18 June 2025",
  category: "conflict",
  listed: true,
  window: { start: "2025-06-18T10:00:00Z", end: "2025-06-19T04:00:00Z" },
  focus: "2025-06-18T13:00:00Z",
  timezone: "Asia/Tehran",
  region: { west: 38, south: 22, east: 66, north: 44 },
  focusPoint: { lon: 53, lat: 32.5 },
  imagery: { day: "2025-06-18", nights: [] },
  // Turkey is the comparison: a large neighbour on the same day.
  signal: { kind: "ping-slash24", tone: "loss", countries: ["IR", "TR"] },
} satisfies EventDef;
