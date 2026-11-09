import type { Metadata } from "next";
import { Brief } from "@/components/brief/Brief";
import { SiteNav } from "@/components/landing/SiteNav";
import { listEditions, listStoryFilms, loadEdition } from "@/lib/bundles";
import { briefOf } from "@/scene/brief";

export const metadata: Metadata = {
  title: "Morning brief",
  description:
    "Yesterday's world in two minutes: the five biggest stories, why they matter, and the films.",
};

// /brief: built with the latest edition (ADR-0025); "since then" comes from Now in the page.
export default async function BriefPage() {
  const date = (await listEditions())[0];
  const brief = date
    ? briefOf(await loadEdition(date), new Set(await listStoryFilms(date)))
    : undefined;
  return (
    <div className="h-dvh overflow-y-auto bg-void">
      <SiteNav />
      {brief ? (
        <Brief brief={brief} />
      ) : (
        <main className="grid min-h-[60vh] place-items-center text-dust/60">No edition yet.</main>
      )}
    </div>
  );
}
