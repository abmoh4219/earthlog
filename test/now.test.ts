import { describe, expect, it } from "vitest";
import type { Cluster, Headline, NowFile } from "../src/scene/headlines";
import { ago, blindSpot, nextCollection, storiesIn, windowCounts } from "../src/scene/now";

const NOW = Date.parse("2026-11-08T12:00:00Z");
const iso = (minutesAgo: number) =>
  new Date(NOW - minutesAgo * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
let n = 0;
const h = (outlet: string, minutesAgo: number): Headline => ({
  id: (n++).toString(16).padStart(12, "0"),
  outlet,
  title: `${outlet} headline`,
  url: "https://example.org/a",
  t: iso(minutesAgo),
  seen: iso(0),
});
const cluster = (id: string, hs: Headline[], topic: Cluster["topic"] = "world"): Cluster => ({
  id,
  title: id,
  headlines: hs.map((x) => x.id),
  outlets: [...new Set(hs.map((x) => x.outlet))],
  first: hs.map((x) => x.t).sort()[0] ?? iso(0),
  last:
    hs
      .map((x) => x.t)
      .sort()
      .at(-1) ?? iso(0),
  topic,
  heat: 0,
  breaking: false,
});

const fresh = [h("bbc", 20), h("dw", 40), h("aljazeera", 50)];
const older = [h("guardian", 150), h("npr", 170)];
const stale = [h("sky", 20 * 60)];
const file: NowFile = {
  version: 1,
  generatedAt: iso(10),
  outlets: [],
  headlines: [...fresh, ...older, ...stale],
  clusters: [
    cluster("fresh", fresh, "conflict"),
    cluster("older", older, "politics"),
    cluster("stale", stale),
  ],
};

describe("stories in a window, at the moment of viewing", () => {
  it("keeps stories with a headline inside the window", () => {
    expect(storiesIn(file, "1h", NOW).map((s) => s.cluster.id)).toEqual(["fresh"]);
    expect(storiesIn(file, "3h", NOW).map((s) => s.cluster.id)).toEqual(["fresh", "older"]);
    expect(storiesIn(file, "24h", NOW)).toHaveLength(3);
    expect(windowCounts(file, NOW)).toEqual({ "1h": 1, "3h": 2, "24h": 3 });
  });

  it("puts breaking first and ranks the rest by heat within the window", () => {
    const [first] = storiesIn(file, "24h", NOW);
    expect(first?.cluster.id).toBe("fresh");
    expect(first?.breaking).toBe(true);
    expect(first?.heat).toBe(100);
  });

  it("is no longer breaking hours later", () => {
    expect(storiesIn(file, "24h", NOW + 4 * 3_600_000)[0]?.breaking).toBe(false);
  });

  it("filters by topic", () => {
    expect(storiesIn(file, "24h", NOW, "politics").map((s) => s.cluster.id)).toEqual(["older"]);
  });

  it("counts only the outlets inside the window", () => {
    const mixed = [h("bbc", 30), h("dw", 300)];
    const f = { ...file, headlines: mixed, clusters: [cluster("m", mixed)] };
    expect(storiesIn(f, "1h", NOW)[0]?.outlets).toEqual(["bbc"]);
    expect(storiesIn(f, "24h", NOW)[0]?.outlets).toEqual(["dw", "bbc"]);
  });
});

describe("blind spots", () => {
  it("flags stories several outlets from one region reported", () => {
    expect(blindSpot(["bbc", "guardian", "dw"])).toBe("Europe");
    expect(blindSpot(["bbc", "aljazeera"])).toBeUndefined();
    expect(blindSpot(["bbc"])).toBeUndefined();
  });
});

describe("time words", () => {
  it("says how long ago", () => {
    expect(ago(iso(0), NOW)).toBe("just now");
    expect(ago(iso(12), NOW)).toBe("12 min ago");
    expect(ago(iso(180), NOW)).toBe("3 h ago");
    expect(ago(iso(3 * 24 * 60), NOW)).toBe("3 days ago");
  });

  it("knows when the next collection is due (minute 15 of every third hour, UTC)", () => {
    expect(nextCollection("2026-11-08T12:16:00Z")).toBe("2026-11-08T15:15:00Z");
    expect(nextCollection("2026-11-08T12:14:00Z")).toBe("2026-11-08T12:15:00Z");
    expect(nextCollection("2026-11-08T22:30:00Z")).toBe("2026-11-09T00:15:00Z");
  });
});
