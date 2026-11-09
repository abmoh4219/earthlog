import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivedFilm } from "@/components/player/ArchivedFilm";
import { Player } from "@/components/player/Player";
import { SITE_URL } from "@/config";
import {
  listEditions,
  listLocalFilms,
  listStoryFilms,
  loadArchive,
  loadEdition,
  loadStoryBundle,
} from "@/lib/bundles";
import { archivedFilmUrl } from "@/scene/archive";

// /embed/<date>/<slug>: a story film for other sites' pages (ADR-0026), in an iframe. The same
// player, every claim still cited; the way to Earthlog opens a new tab. Not for search engines
// (the film's own page is).
export const dynamicParams = false;

export async function generateStaticParams() {
  const params: { date: string; slug: string }[] = [];
  for (const date of await listEditions())
    for (const slug of await listStoryFilms(date)) params.push({ date, slug });
  return params;
}

type Props = { params: Promise<{ date: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date, slug } = await params;
  const story = (await loadEdition(date)).stories.find((s) => s.slug === slug);
  return {
    title: story?.title ?? "Earthlog film",
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/story/${date}/${slug}` },
  };
}

export default async function EmbedPage({ params }: Props) {
  const { date, slug } = await params;
  if (!(await listStoryFilms(date)).includes(slug)) notFound();
  const back = {
    href: `${SITE_URL}/story/${date}/${slug}`,
    label: "Watch on Earthlog",
    external: true,
  };
  // Older than two weeks: from the archive (ADR-0027).
  if (!(await listLocalFilms(date)).includes(slug)) {
    const archive = await loadArchive(date);
    if (!archive) notFound();
    return <ArchivedFilm url={archivedFilmUrl(archive.base, date, slug)} back={back} />;
  }
  return <Player bundle={await loadStoryBundle(date, slug)} back={back} />;
}
