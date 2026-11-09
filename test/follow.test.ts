import { describe, expect, it } from "vitest";
import { type Follow, followKey, updatesFor } from "../src/scene/follow";
import type { SearchItem } from "../src/scene/search";

const item = (title: string, href: string, date: string, key?: string): SearchItem => ({
  kind: href.startsWith("/now") ? "now" : "story",
  title,
  detail: "",
  href,
  date,
  keys: "",
  ...(key ? { key } : {}),
});

describe("following a story", () => {
  const key = followKey("2026 Kraków shooting", "/story/2026-11-07/x");
  const follow: Follow = {
    key,
    title: "Kraków shooting",
    href: "/story/2026-11-07/x",
    at: "2026-11-08T09:00:00Z",
  };

  it("keys a story by its article, accents and case folded", () => {
    expect(key).toBe("a:2026 krakow shooting");
    expect(followKey(undefined, "/now?story=abc")).toBe("p:/now?story=abc");
  });

  it("finds later stories about the same article, newest first, not the followed one", () => {
    const items = [
      item("Kraków shooting", "/story/2026-11-07/x", "2026-11-07", key),
      item("Poland launches terrorism probe", "/story/2026-11-08/y", "2026-11-08", key),
      item("Gunman named", "/now?story=z", "2026-11-09T05:00:00Z", key),
      item("Another story", "/story/2026-11-08/w", "2026-11-08", "a:other"),
    ];
    expect(
      updatesFor([follow], items)
        .get(key)
        ?.map((i) => i.title),
    ).toEqual(["Gunman named", "Poland launches terrorism probe"]);
  });

  it("has no subject updates for a story without an article", () => {
    const own: Follow = { ...follow, key: "p:/now?story=q" };
    expect(updatesFor([own], [item("x", "/now?story=r", "2026-11-09", own.key)]).size).toBe(0);
  });

  it("counts an edition's update that links back to the followed film", () => {
    const own: Follow = { ...follow, key: "p:/story/2026-11-07/x" };
    const later = {
      ...item("Probe opened", "/story/2026-11-08/y", "2026-11-08"),
      prev: ["/story/2026-11-07/x"],
    };
    expect(updatesFor([own], [later]).get(own.key)?.[0]?.title).toBe("Probe opened");
  });
});
