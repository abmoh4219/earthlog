// The site's share card (ADR-0026), also used by pages without their own: the latest
// edition's stories on the map.
import { listEditions, loadEdition } from "@/lib/bundles";
import { CARD, card } from "@/lib/og";

export const size = CARD;
export const contentType = "image/png";
export const alt = "Earthlog: yesterday's world, explained in 3D";

export default async function Image() {
  const date = (await listEditions())[0];
  const e = date ? await loadEdition(date) : undefined;
  return card({
    eyebrow: "A new edition every morning",
    title: "Yesterday's world, explained in 3D.",
    note: "Each story gets the analysis its kind deserves.",
    points: (e?.stories ?? []).flatMap((s) =>
      s.place ? [{ lon: s.place.lon, lat: s.place.lat }] : [],
    ),
  });
}
