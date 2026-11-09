import { describe, expect, it } from "vitest";
import {
  ArchiveManifest,
  archiveBase,
  archivedFilmUrl,
  datesToArchive,
  KEEP_DAYS,
} from "../src/scene/archive";

describe("the film archive (ADR-0027)", () => {
  it("moves editions older than two weeks, oldest first", () => {
    expect(KEEP_DAYS).toBe(14);
    const dates = ["2026-11-02", "2026-11-08", "2026-10-20", "notes", "2026-10-26"];
    expect(datesToArchive(dates, "2026-11-09")).toEqual(["2026-10-20"]);
    expect(datesToArchive(dates, "2026-11-17")).toEqual(["2026-10-20", "2026-10-26", "2026-11-02"]);
    // Fourteen days old stays; fifteen moves.
    expect(datesToArchive(["2026-11-02"], "2026-11-16")).toEqual([]);
    expect(datesToArchive(["2026-11-02"], "2026-11-17")).toEqual(["2026-11-02"]);
  });

  it("knows where a year's archive is published and where a film's files are", () => {
    const base = archiveBase("2026");
    expect(base).toBe("https://abmoh4219.github.io/earthlog-archive-2026/");
    expect(archivedFilmUrl(base, "2026-11-02", "jay-rockefeller")).toBe(
      "https://abmoh4219.github.io/earthlog-archive-2026/editions/2026-11-02/stories/jay-rockefeller/",
    );
  });

  it("parses a manifest, and refuses a broken one", () => {
    const ok = ArchiveManifest.safeParse({
      version: 1,
      base: archiveBase("2026"),
      films: ["a", "b"],
      archivedAt: "2026-11-17T01:00:00Z",
    });
    expect(ok.success).toBe(true);
    expect(ArchiveManifest.safeParse({ version: 1, films: [] }).success).toBe(false);
  });
});
