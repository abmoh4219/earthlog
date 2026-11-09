import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalUrl, headlineId, parseFeed, textOf } from "../scripts/news/feeds";
import { Headline } from "../src/scene/headlines";
import { OUTLETS } from "../src/scene/outlets";

const SEEN = "2026-11-08T07:00:00Z";
const fixture = (id: string) =>
  readFileSync(join(__dirname, "fixtures", "feeds", `${id}.xml`), "utf8");

describe("parseFeed on recorded feeds", () => {
  for (const outlet of OUTLETS) {
    it(`reads ${outlet.name}`, () => {
      const items = parseFeed(fixture(outlet.id), outlet.id, SEEN);
      expect(items.length).toBeGreaterThanOrEqual(6);
      for (const h of items) {
        expect(Headline.safeParse(h).success).toBe(true);
        expect(h.title).not.toMatch(/<|&amp;|&#|CDATA/);
        expect(h.url).toMatch(/^https:\/\//);
        expect(h.url).not.toMatch(/utm_|at_medium|traffic_source|maca=/);
        expect(h.t <= SEEN).toBe(true);
      }
    });
  }

  it("decodes entities and CDATA the way each outlet writes them", () => {
    const npr = parseFeed(fixture("npr"), "npr", SEEN);
    expect(npr[0]?.title).toBe(
      "Israeli president invites Netanyahu's opposition leader to broker new government",
    );
    const bbc = parseFeed(fixture("bbc"), "bbc", SEEN);
    expect(bbc[0]?.title).toBe("What we know so far after Krakow gun attack");
    expect(bbc[0]?.t).toBe("2026-11-08T01:47:41Z");
  });

  it("reads RDF dates (DW) and sections", () => {
    const dw = parseFeed(fixture("dw"), "dw", SEEN);
    expect(dw[0]?.t).toBe("2026-11-08T05:55:00Z");
    expect(dw[0]?.section).toBe("Environment");
  });
});

describe("parseFeed edge cases", () => {
  it("reads Atom entries and skips items without a link or a date", () => {
    const atom = `<feed><entry><title type="html">A &amp; B</title><link href="https://x.org/a?utm_source=rss"/>
      <updated>2026-11-08T06:00:00+01:00</updated></entry>
      <entry><title>No date</title><link href="https://x.org/b"/></entry>
      <entry><title>No link</title><updated>2026-11-08T06:00:00Z</updated></entry></feed>`;
    const items = parseFeed(atom, "x", SEEN);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "A & B",
      url: "https://x.org/a",
      t: "2026-11-08T05:00:00Z",
    });
  });

  it("never dates an item after it was seen, and drops duplicates", () => {
    const rss = `<rss><channel>
      <item><title>Future</title><link>https://x.org/f</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item>
      <item><title>Future again</title><link>https://x.org/f#top</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const items = parseFeed(rss, "x", SEEN);
    expect(items).toHaveLength(1);
    expect(items[0]?.t).toBe(SEEN);
  });
});

describe("urls and text", () => {
  it("canonicalises links so the same article has one id", () => {
    expect(canonicalUrl("http://www.bbc.co.uk/news/a?at_medium=RSS&at_campaign=rss")).toBe(
      "https://www.bbc.co.uk/news/a",
    );
    expect(headlineId("https://a.org/x?utm_source=feed")).toBe(headlineId("https://a.org/x"));
    expect(canonicalUrl("https://a.org/x?id=3")).toBe("https://a.org/x?id=3");
  });

  it("strips tags and decodes numeric entities", () => {
    expect(textOf("<p>Caf&#233; &#x2013; <b>open</b></p>")).toBe("Café – open");
  });

  it("strips markup a feed escaped inside its title (Sky News, 8 Nov 2026)", () => {
    expect(
      textOf(
        "&lt;a href='https://news.sky.com/video/x'&gt;Russia's last major independent news outlet closing&lt;/a&gt;",
      ),
    ).toBe("Russia's last major independent news outlet closing");
  });
});
