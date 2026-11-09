// An edition's share card (ADR-0026): the day, its lead story, every placed story on the map.
import { listEditions, loadEdition } from "@/lib/bundles";
import { CARD, card } from "@/lib/og";

export const size = CARD;
export const contentType = "image/png";
export const alt = "An Earthlog edition";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listEditions()).map((date) => ({ date }));
}

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const e = await loadEdition(date);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return card({
    eyebrow: `Edition · ${label}`,
    title: `The world on ${label.replace(/^\w+, /, "")}`,
    note: `${e.stories.length} stories, each a short film · leading: ${e.stories[0]?.title ?? ""}`.slice(
      0,
      90,
    ),
    points: e.stories.flatMap((s) => (s.place ? [{ lon: s.place.lon, lat: s.place.lat }] : [])),
  });
}
