// /feed.xml: RSS 2.0 of the last seven editions' films (ADR-0026), written at build time.
// Each item is a story: its title, its film's opening caption, the link to the film.
import { DESCRIPTION, SITE_NAME, SITE_URL } from "@/config";
import { listEditions, listStoryFilms, loadEdition } from "@/lib/bundles";
import { LENS_INFO } from "@/scene/edition";

export const dynamic = "force-static";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const items: string[] = [];
  let latest = "";
  for (const date of (await listEditions()).slice(0, 7)) {
    const films = new Set(await listStoryFilms(date));
    const edition = await loadEdition(date);
    latest ||= edition.generatedAt;
    // An edition is published the morning after its day.
    const published = new Date(edition.generatedAt).toUTCString();
    for (const s of edition.stories) {
      if (!films.has(s.slug)) continue;
      const link = `${SITE_URL}/story/${date}/${s.slug}`;
      const text = s.headline ?? s.summary;
      items.push(
        [
          "<item>",
          `<title>${esc(s.title)}</title>`,
          `<link>${esc(link)}</link>`,
          `<guid isPermaLink="true">${esc(link)}</guid>`,
          `<pubDate>${published}</pubDate>`,
          `<category>${esc(LENS_INFO[s.lens].label)}</category>`,
          `<description>${esc(text)}</description>`,
          "</item>",
        ].join(""),
      );
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(SITE_NAME)}</title>
<link>${esc(SITE_URL)}</link>
<atom:link href="${esc(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml"/>
<description>${esc(DESCRIPTION)}</description>
<language>en</language>
${latest ? `<lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>` : ""}
${items.join("\n")}
</channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
