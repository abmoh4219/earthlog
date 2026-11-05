import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteNav } from "@/components/landing/SiteNav";
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

// Any day of the archive: every story of the edition, with a strip of the other editions.
export default async function EditionPage({ params }: Props) {
  const { date } = await params;
  if (!(await listEditions()).includes(date)) notFound();
  const edition = await loadEdition(date);
  const films = new Set(await listStoryFilms(date));
  const editions = await listEditions();

  return (
    <main className="h-dvh overflow-y-auto bg-void">
      <SiteNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* The archive: every edition, newest first. */}
        <nav className="mt-6 flex flex-wrap gap-2 text-xs" aria-label="Editions">
          {editions.map((d) => (
            <Link
              key={d}
              href={`/edition/${d}`}
              aria-current={d === date ? "page" : undefined}
              className={`rounded-full px-3 py-1 ${d === date ? "bg-ice/20 text-frost" : "glass text-ice/80 hover:text-frost"}`}
            >
              {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
            </Link>
          ))}
        </nav>
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
      <SiteFooter />
    </main>
  );
}
