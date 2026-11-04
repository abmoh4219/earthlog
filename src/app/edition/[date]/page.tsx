import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listEditions, listStoryFilms, loadEdition } from "@/lib/bundles";
import { LENS_INFO } from "@/scene/edition";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listEditions()).map((date) => ({ date }));
}

type Props = { params: Promise<{ date: string }> };

const long = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return { title: `The world on ${long(date)}` };
}

// A plain, fast list for now; the globe front page with story beacons is PLAN.md Phase 16.
export default async function EditionPage({ params }: Props) {
  const { date } = await params;
  if (!(await listEditions()).includes(date)) notFound();
  const edition = await loadEdition(date);
  const films = new Set(await listStoryFilms(date));

  return (
    <main className="h-dvh overflow-y-auto bg-void px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="font-mono text-[11px] tracking-[0.45em] text-ice/80 uppercase hover:text-ice"
        >
          Earthlog
        </Link>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{long(date)}</h1>
        <p className="mt-2 text-ice/70">
          {edition.stories.length} stories, ranked by how much the world read and how widely they
          were reported.
        </p>
        <ol className="mt-10 space-y-3">
          {edition.stories.map((s, i) => {
            const lens = LENS_INFO[s.lens];
            const body = (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-6 font-mono text-sm text-ice/40 tabular-nums">{i + 1}</span>
                  <span
                    className="rounded-md px-2 py-0.5 font-mono text-[10px] tracking-[0.2em] text-void uppercase"
                    style={{ background: lens.color }}
                  >
                    {lens.label}
                  </span>
                  {s.place && <span className="truncate text-xs text-ice/60">{s.place.name}</span>}
                  <span
                    className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-ice/10"
                    title={`Heat ${s.heat}`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${s.heat}%`, background: lens.color }}
                    />
                  </span>
                </div>
                <p className="mt-2 pl-9 text-lg font-medium text-frost">{s.title}</p>
                <p className="mt-1 line-clamp-2 pl-9 text-sm text-ice/60">
                  {s.headline ?? s.about ?? s.summary}
                </p>
              </>
            );
            return (
              <li key={s.slug}>
                {films.has(s.slug) ? (
                  <Link
                    href={`/story/${date}/${s.slug}`}
                    className="glass block rounded-2xl p-4 transition hover:border-ice/40"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="glass rounded-2xl p-4 opacity-70">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
