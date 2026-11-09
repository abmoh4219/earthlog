import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { z } from "zod";
import { Game } from "@/components/game/Game";
import { SiteNav } from "@/components/landing/SiteNav";
import { listEditions, listStoryFilms, loadEdition } from "@/lib/bundles";
import { roundsOf } from "@/scene/game";
import { Country } from "@/scene/schema";
import { type Gazetteer, makePlacer } from "../../../scripts/news/place.ts";

export const metadata: Metadata = {
  title: "Where was it?",
  description:
    "The daily Earthlog game: five of yesterday's stories with their places hidden. Find each one on the globe.",
};

// /play: the rounds are made at build time from the latest edition (ADR-0024); the page
// scores and keeps the streak in the reader's browser.
export default async function PlayPage() {
  const date = (await listEditions())[0];
  const countries = z
    .array(Country)
    .parse(
      JSON.parse(await readFile(join(process.cwd(), "public", "geo", "countries.json"), "utf8")),
    );
  const placer = makePlacer(
    JSON.parse(
      await readFile(join(process.cwd(), "scripts", "news", "places.json"), "utf8"),
    ) as Gazetteer,
    countries,
  );
  const rounds = date
    ? roundsOf(await loadEdition(date), placer.mask, new Set(await listStoryFilms(date)), (name) =>
        countries.some((c) => c.name === name || c.aliases.includes(name)),
      )
    : [];
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-void">
      <SiteNav />
      {date && rounds.length >= 3 ? (
        <Game date={date} rounds={rounds} />
      ) : (
        <main className="grid flex-1 place-items-center px-5 text-center text-dust/60">
          No game today: the latest edition has too few placed stories.
        </main>
      )}
    </div>
  );
}
