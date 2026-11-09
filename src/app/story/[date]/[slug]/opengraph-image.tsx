// The story film's share card (ADR-0026), made at build time.
import { listEditions, listStoryFilms, loadEdition } from "@/lib/bundles";
import { CARD, card } from "@/lib/og";
import { LENS_INFO } from "@/scene/edition";

export const size = CARD;
export const contentType = "image/png";
export const alt = "An Earthlog story film";
export const dynamicParams = false;

export async function generateStaticParams() {
  const params: { date: string; slug: string }[] = [];
  for (const date of await listEditions())
    for (const slug of await listStoryFilms(date)) params.push({ date, slug });
  return params;
}

const day = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function Image({
  params,
}: {
  params: Promise<{ date: string; slug: string }>;
}) {
  const { date, slug } = await params;
  const story = (await loadEdition(date)).stories.find((s) => s.slug === slug);
  const lens = story ? LENS_INFO[story.lens] : undefined;
  return card({
    eyebrow: [lens?.label, day(date), story?.place?.name].filter(Boolean).join(" · "),
    ...(lens ? { color: lens.color } : {}),
    title: story?.title ?? "Earthlog",
    ...(story?.why?.[0] ? { note: story.why.slice(0, 2).join(" · ") } : {}),
    points: story?.place ? [{ lon: story.place.lon, lat: story.place.lat }] : [],
  });
}
