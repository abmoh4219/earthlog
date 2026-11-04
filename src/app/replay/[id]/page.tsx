import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Player } from "@/components/player/Player";
import { loadBundle, loadIndex } from "@/lib/bundles";

// Every replay is pre-rendered at build time; unknown IDs are a 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  const index = await loadIndex();
  return index.map((entry) => ({ id: entry.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = (await loadIndex()).find((e) => e.id === id);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.subtitle,
    robots: entry.listed ? undefined : { index: false },
  };
}

export default async function ReplayPage({ params }: Props) {
  const { id } = await params;
  const index = await loadIndex();
  if (!index.some((e) => e.id === id)) notFound();
  const bundle = await loadBundle(id);
  return <Player bundle={bundle} />;
}
