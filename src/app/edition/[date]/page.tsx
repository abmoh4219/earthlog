import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteNav } from "@/components/landing/SiteNav";
import { listEditions, listStoryFilms, loadEdition } from "@/lib/bundles";
import { LENS_INFO } from "@/scene/edition";
import { OUTLETS, outletById } from "@/scene/outlets";

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

  const short = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <main className="h-dvh overflow-y-auto bg-void">
      <SiteNav />
      <div className="mx-auto max-w-3xl px-5 pt-12 pb-24 sm:px-8 sm:pt-16">
        {/* The archive: every edition, newest first. */}
        <nav className="flex flex-wrap gap-1.5 text-sm" aria-label="Editions">
          {editions.map((d) => (
            <Link
              key={d}
              href={`/edition/${d}`}
              aria-current={d === date ? "page" : undefined}
              className={`rounded-full px-3 py-1 transition-colors ${d === date ? "bg-moon/12 text-moon" : "text-dust/55 hover:bg-moon/5 hover:text-moon"}`}
            >
              {short(d)}
            </Link>
          ))}
        </nav>
        <h1 className="mt-10 font-serif text-4xl leading-[1.05] font-light tracking-[-0.02em] text-balance text-moon sm:text-6xl">
          {long(date)}
        </h1>
        <p className="mt-4 text-dust/65 sm:text-lg">
          {edition.stories.length} stories, ranked by what the newsrooms agreed on: how many outlets
          reported each, from where, how fast, and how many people it touches.
          {edition.mostRead === false &&
            " Wikipedia's reading figures were not published yet when it was built."}
        </p>
        <ol className="mt-12 divide-y divide-moon/8 border-y border-moon/8">
          {edition.stories.map((s, i) => {
            const lens = LENS_INFO[s.lens];
            const filmed = films.has(s.slug);
            const body = (
              <div className="flex gap-5">
                <span className="w-6 shrink-0 pt-0.5 font-serif text-lg leading-6 text-dust/35 tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-2 text-dust/55">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: lens.color }}
                        aria-hidden="true"
                      />
                      {lens.label}
                    </span>
                    {s.update && <span className="text-sodium">Update, day {s.update.day}</span>}
                    {s.place && <span className="truncate text-dust/40">{s.place.name}</span>}
                    {!filmed && <span className="text-dust/40">No film</span>}
                  </p>
                  <p
                    className={`mt-1.5 font-serif text-xl leading-snug text-moon sm:text-[1.4rem] ${filmed ? "group-hover:underline group-hover:decoration-moon/30 group-hover:underline-offset-4" : ""}`}
                  >
                    {s.title}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-dust/55">
                    {s.headline ?? s.about ?? s.summary}
                  </p>
                  {/* Which outlets reported it that day: each name opens the outlet's article. */}
                  {s.coverage && s.coverage.length > 0 && (
                    <p className="mt-2 text-sm text-dust/45">
                      Reported by{" "}
                      {s.coverage.map((c, k) => (
                        <span key={c.evidence}>
                          {k > 0 && (k === (s.coverage?.length ?? 0) - 1 ? " and " : ", ")}
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            title={c.title}
                            className="relative z-10 text-dust/75 underline decoration-moon/20 underline-offset-4 hover:text-moon"
                          >
                            {outletById(c.outlet)?.name ?? c.outlet}
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                  {/* Why it made the edition, measured (ADR-0021). */}
                  {s.why && s.why.length > 0 && (
                    <p className="mt-1.5 text-xs text-dust/40">{s.why.slice(0, 3).join(" · ")}</p>
                  )}
                  {/* Updates link back to how the story was told before. */}
                  {s.update && (
                    <p className="mt-2 text-sm text-dust/45">
                      Earlier:{" "}
                      {s.update.previous.map((p, k) => (
                        <span key={`${p.date}-${p.slug}`}>
                          {k > 0 && " · "}
                          <Link
                            href={`/story/${p.date}/${p.slug}`}
                            className="relative z-10 text-dust/75 underline decoration-moon/20 underline-offset-4 hover:text-moon"
                          >
                            {short(p.date)}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            );
            return (
              <li key={s.slug} className="group relative py-6">
                {filmed && (
                  // The whole row opens the film; the "Earlier" links sit above this overlay.
                  <Link
                    href={`/story/${date}/${s.slug}`}
                    className="absolute inset-0"
                    aria-label={`Watch: ${s.title}`}
                  />
                )}
                {body}
              </li>
            );
          })}
        </ol>
        {/* Outlets are credited by name with a link home (AllAfrica's terms ask for it). */}
        {edition.stories.some((s) => s.coverage?.length) && (
          <p className="mt-8 text-xs leading-relaxed text-dust/40">
            Headlines and links from{" "}
            {OUTLETS.filter((o) =>
              edition.stories.some((s) => s.coverage?.some((c) => c.outlet === o.id)),
            ).map((o, k, list) => (
              <span key={o.id}>
                {k > 0 && (k === list.length - 1 ? " and " : ", ")}
                <a href={o.homepage} target="_blank" rel="noreferrer" className="hover:text-moon">
                  {o.name}
                </a>
              </span>
            ))}
            , each linking to the outlet&apos;s own article.
          </p>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
