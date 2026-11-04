import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Player } from "@/components/player/Player";
import { listEditions, listStoryFilms, loadEdition, loadStoryBundle } from "@/lib/bundles";

// Every story film is pre-rendered at build time; unknown ones are a 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  const params: { date: string; slug: string }[] = [];
  for (const date of await listEditions()) {
    for (const slug of await listStoryFilms(date)) params.push({ date, slug });
  }
  return params;
}

type Props = { params: Promise<{ date: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date, slug } = await params;
  const story = (await loadEdition(date)).stories.find((s) => s.slug === slug);
  if (!story) return {};
  return { title: story.title, description: story.summary };
}

export default async function StoryPage({ params }: Props) {
  const { date, slug } = await params;
  if (!(await listStoryFilms(date)).includes(slug)) notFound();
  const bundle = await loadStoryBundle(date, slug);
  return <Player bundle={bundle} back={{ href: `/edition/${date}`, label: "Edition" }} />;
}
