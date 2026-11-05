import type { Metadata } from "next";
import { FrontPage, type RailStory } from "@/components/front/FrontPage";
import { listEditions, listStoryFilms, loadEdition, loadIndex } from "@/lib/bundles";
import { LENS_INFO } from "@/scene/edition";

const label = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

export const metadata: Metadata = { title: "Today's edition" };

// /today: the latest edition on the full-screen globe, with the edition tour.
export default async function Today() {
  const editions = await listEditions();
  const latest = editions[0];
  const index = await loadIndex();
  const classics = index
    .filter((e) => e.listed && e.category !== "daily")
    .map((e) => ({ id: e.id, title: e.title }));
  if (!latest) {
    return (
      <main className="grid h-dvh place-items-center bg-void text-ice/70">
        No edition yet. Run pnpm edition, pnpm stories and pnpm direct.
      </main>
    );
  }
  const edition = await loadEdition(latest);
  const films = new Set(await listStoryFilms(latest));
  const stories: RailStory[] = edition.stories.map((s) => {
    const lens = LENS_INFO[s.lens];
    return {
      slug: s.slug,
      title: s.title,
      headline: s.headline ?? s.summary,
      color: lens.color,
      lensLabel: lens.label,
      heat: s.heat,
      lon: s.place?.lon ?? 0,
      lat: s.place?.lat ?? 0,
      placed: s.place !== undefined,
      hasFilm: films.has(s.slug),
    };
  });
  return (
    <FrontPage
      date={latest}
      dateLabel={label(latest, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      stories={stories}
      editions={editions
        .slice(0, 10)
        .map((d) => ({ date: d, label: label(d, { day: "numeric", month: "short" }) }))}
      classics={classics}
    />
  );
}
