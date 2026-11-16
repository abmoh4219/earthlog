import { describe, expect, it } from "vitest";
import { RETRY_STATUS, retryDelayMs, USER_AGENT } from "../scripts/bake/lib";

describe("polite downloads (ADR-0028)", () => {
  it("waits as long as the server asks, at most a minute", () => {
    expect(retryDelayMs(1, "5")).toBe(5000);
    expect(retryDelayMs(3, "120")).toBe(60_000);
  });

  it("otherwise backs off exponentially: 2, 4, 8, 16, 32 seconds", () => {
    expect([1, 2, 3, 4, 5].map((a) => retryDelayMs(a, null))).toEqual([
      2000, 4000, 8000, 16_000, 32_000,
    ]);
    expect(retryDelayMs(9, "not a number")).toBe(60_000);
  });

  it("retries rate limits and passing server trouble, not client errors", () => {
    expect(RETRY_STATUS.has(429)).toBe(true);
    expect(RETRY_STATUS.has(503)).toBe(true);
    expect(RETRY_STATUS.has(404)).toBe(false);
  });

  it("identifies itself with contact information, as Wikimedia requires", () => {
    expect(USER_AGENT).toMatch(/^Earthlog\/\S+ \(https:\/\/\S+/);
  });
});
