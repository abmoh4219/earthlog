import { describe, expect, it } from "vitest";
import { activeBeatIndex } from "../src/scene/beats.ts";
import type { Beat } from "../src/scene/schema.ts";

const beats: Beat[] = [
  { t: "2025-04-28T10:33:00Z", text: "a", cites: ["ioda:ES:1"] },
  { t: "2025-04-28T10:40:00Z", text: "b", cites: ["ioda:ES:2"] },
];

describe("activeBeatIndex", () => {
  it("is -1 before the first beat", () => {
    expect(activeBeatIndex(Date.parse("2025-04-28T10:00:00Z"), beats)).toBe(-1);
  });
  it("shows a beat from its time until the next one", () => {
    expect(activeBeatIndex(Date.parse("2025-04-28T10:33:00Z"), beats)).toBe(0);
    expect(activeBeatIndex(Date.parse("2025-04-28T10:39:59Z"), beats)).toBe(0);
    expect(activeBeatIndex(Date.parse("2025-04-28T10:40:00Z"), beats)).toBe(1);
  });
  it("keeps the last beat after it starts", () => {
    expect(activeBeatIndex(Date.parse("2025-04-28T23:00:00Z"), beats)).toBe(1);
  });
});
