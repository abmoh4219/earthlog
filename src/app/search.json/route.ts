// /search.json: the search index of every edition story and classic, written at build time
// (a static file; ADR-0023). The browser adds Now's stories from the hourly file.
import { listEditions, listStoryFilms, loadEdition, loadIndex } from "@/lib/bundles";
import { LENS_INFO } from "@/scene/edition";
import { followKey } from "@/scene/follow";
import { regionOf } from "@/scene/regions";
import type { SearchItem } from "@/scene/search";

export const dynamic = "force-static";

const day = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export async function GET() {
  const items: SearchItem[] = [];
  for (const date of await listEditions()) {
    const films = new Set(await listStoryFilms(date));
    const edition = await loadEdition(date);
    for (const s of edition.stories) {
      if (!films.has(s.slug)) continue;
      const region = regionOf(s.place?.country, s.continent);
      const href = `/story/${date}/${s.slug}`;
      items.push({
        kind: "story",
        title: s.title,
        detail: `${day(date)} · ${LENS_INFO[s.lens].label}${s.place ? ` · ${s.place.name}` : ""}`,
        href,
        key: followKey(s.article?.title, href),
        ...(s.update ? { prev: s.update.previous.map((p) => `/story/${p.date}/${p.slug}`) } : {}),
        date,
        keys: [s.summary, s.article?.title, region, s.topic].filter(Boolean).join(" "),
      });
    }
  }
  for (const c of await loadIndex()) {
    if (!c.listed || c.category === "daily") continue;
    items.push({
      kind: "classic",
      title: c.title,
      detail: `Classic · ${c.subtitle}`,
      href: `/replay/${c.id}`,
      date: c.date,
      keys: c.category,
    });
  }
  return Response.json(items);
}
