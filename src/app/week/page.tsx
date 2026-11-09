import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/landing/SiteNav";
import { listEditions, listStoryFilms, loadEdition } from "@/lib/bundles";
import { type BriefStory, weekOf } from "@/scene/brief";

export const metadata: Metadata = {
  title: "The week",
  description:
    "The last seven days on Earth: each day's biggest stories, the ones that kept running, and where they happened.",
};

const day = (date: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });

function Story({ s }: { s: BriefStory }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-dust/50">
        <span className="size-1.5 rounded-full" style={{ background: s.color }} />
        {s.kind}
        {s.place && <span className="text-dust/35">· {s.place}</span>}
        {s.day && <span className="text-sodium">· Day {s.day}</span>}
      </span>
      <span className="mt-0.5 block font-serif text-[1.1rem] leading-snug text-moon">
        {s.title}
      </span>
    </>
  );
  return s.film ? (
    <Link href={`/story/${s.date}/${s.slug}`} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

// /week: the last seven editions, built with the site (ADR-0025).
export default async function WeekPage() {
  const dates = (await listEditions()).slice(0, 7);
  const week = weekOf(
    await Promise.all(
      dates.map(async (d) => ({
        edition: await loadEdition(d),
        films: new Set(await listStoryFilms(d)),
      })),
    ),
  );
  return (
    <div className="h-dvh overflow-y-auto bg-void">
      <SiteNav />
      {week ? (
        <main className="mx-auto max-w-4xl px-5 pt-10 pb-20 sm:px-8">
          <p className="text-sm text-dust/55">
            The week · {day(week.from, { day: "numeric", month: "long" })} to{" "}
            {day(week.to, { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] font-light tracking-[-0.02em] text-moon sm:text-6xl">
            Seven days on Earth.
          </h1>
          <p className="mt-4 max-w-2xl text-dust/65">
            {week.stories} stories in {week.days.length} editions.{" "}
            {week.regions.length > 0 &&
              `Most came from ${week.regions
                .slice(0, 3)
                .map(([r, n]) => `${r} (${n})`)
                .join(", ")}.`}
          </p>

          {week.running.length > 0 && (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-moon">Kept running</h2>
              <p className="mt-1 text-sm text-dust/50">
                Stories the news came back to day after day.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {week.running.map((s) => (
                  <div
                    key={`${s.date}/${s.slug}`}
                    className="rounded-2xl border border-moon/10 bg-moon/[0.03] p-4"
                  >
                    <Story s={s} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-12">
            <h2 className="font-serif text-2xl text-moon">Day by day</h2>
            <ol className="mt-4 divide-y divide-moon/8 border-y border-moon/8">
              {week.days.map((d) => (
                <li key={d.date} className="grid gap-3 py-5 sm:grid-cols-[9rem_1fr]">
                  <Link
                    href={`/edition/${d.date}`}
                    className="text-sm text-dust/60 hover:text-moon"
                  >
                    {day(d.date, { weekday: "long", day: "numeric", month: "short" })}
                  </Link>
                  <ul className="space-y-3">
                    {d.top.map((s) => (
                      <li key={s.slug}>
                        <Story s={s} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </main>
      ) : (
        <main className="grid min-h-[60vh] place-items-center text-dust/60">No editions yet.</main>
      )}
    </div>
  );
}
