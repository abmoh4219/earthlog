import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Database,
  HeartHandshake,
  ListChecks,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { GithubMark } from "@/components/landing/GithubMark";
import { HeroGlobe } from "@/components/landing/HeroGlobe";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteNav } from "@/components/landing/SiteNav";
import { REPO_URL } from "@/config";
import { listEditions, listStoryFilms, loadEdition, loadIndex } from "@/lib/bundles";
import { LENS_INFO, type Lens } from "@/scene/edition";

const day = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

const LENSES: { lens: Lens; title: string; text: string }[] = [
  {
    lens: "election",
    title: "Elections",
    text: "Results race by race; flipped seats pulse, uncalled races stay grey.",
  },
  {
    lens: "person",
    title: "People",
    text: "A life drawn across the globe, from birthplace to the places that shaped it.",
  },
  {
    lens: "organization",
    title: "Companies and tech",
    text: "Headquarters, what is on record, revenue over time.",
  },
  {
    lens: "economy",
    title: "The economy",
    text: "The institution, its country in numbers, its region compared.",
  },
  { lens: "sports", title: "Sports", text: "The venue, the teams' home cities, the result." },
  {
    lens: "culture",
    title: "Culture",
    text: "The credits, the filming locations, where the cast was born.",
  },
  {
    lens: "accident",
    title: "Accidents",
    text: "The route flown and the leg never reached, the site on real terrain.",
  },
  {
    lens: "disaster",
    title: "Earthquakes",
    text: "USGS shaking spreading outward, the fault, people exposed.",
  },
  {
    lens: "conflict",
    title: "Conflicts",
    text: "The week day by day; figures as the sources record them.",
  },
  {
    lens: "science",
    title: "Science and space",
    text: "The launch site, the mission, the landing.",
  },
];

const TRUST = [
  {
    icon: BadgeCheck,
    title: "Every claim is cited",
    text: "Each sentence and number links to the evidence it rests on. A validator rejects anything else, whoever wrote it.",
  },
  {
    icon: ListChecks,
    title: "AI is optional and checked",
    text: "A template writes every film. Claude may rewrite captions once, offline; each chapter is checked in code or keeps the template.",
  },
  {
    icon: Database,
    title: "Open data, honestly shown",
    text: "Wikipedia, Wikidata, World Bank, USGS, NASA. Estimates say so, and every film says when its data was read.",
  },
  {
    icon: HeartHandshake,
    title: "Free for everyone",
    text: "No account, no ads, no tracking, no backend. MIT-licensed and built to be forked.",
  },
];

const STEPS = [
  {
    title: "Find the stories",
    text: "What the news reported and what the world read on Wikipedia, ranked by attention and balanced across continents.",
  },
  {
    title: "Choose the lens",
    text: "Wikidata says what each story is (an election, a person, a crash, a quake) and the matching lens gathers its data.",
  },
  {
    title: "Make the film",
    text: "Chapters, camera moves, maps, charts and captions, every sentence cited, then validated.",
  },
  {
    title: "Publish by morning",
    text: "A GitHub Action runs it overnight and commits the edition. Visitors download static pages: nothing runs per visit.",
  },
];

const SHOWCASE = [
  {
    src: "/media/learjet.jpg",
    title: "The journey",
    text: "An accident film: the route flown in red, the leg never reached dashed.",
  },
  {
    src: "/media/curiosity.jpg",
    title: "Who read about it",
    text: "Readers by language, drawn where each language is spoken.",
  },
  {
    src: "/media/thread.jpg",
    title: "How it unfolded",
    text: "A story's thread through the past week, each day cited.",
  },
  {
    src: "/media/terrain.jpg",
    title: "Real terrain",
    text: "Accident and disaster sites stand on real elevation.",
  },
];

function SectionHead({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-ice">{kicker}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-frost sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-base text-ice/70 sm:text-lg">{children}</p>}
    </div>
  );
}

export default async function Landing() {
  const editions = await listEditions();
  const latest = editions[0];
  const edition = latest ? await loadEdition(latest) : undefined;
  const films = new Set(latest ? await listStoryFilms(latest) : []);
  const classics = (await loadIndex()).filter((e) => e.listed && e.category !== "daily");
  const archive = await Promise.all(
    editions.slice(0, 8).map(async (d) => ({ date: d, edition: await loadEdition(d) })),
  );
  const stories = edition?.stories ?? [];
  const href = (slug: string) =>
    latest && films.has(slug) ? `/story/${latest}/${slug}` : `/edition/${latest}`;
  const globeStories = stories.flatMap((s) =>
    s.place
      ? [
          {
            slug: s.slug,
            title: s.title,
            color: LENS_INFO[s.lens].color,
            heat: s.heat,
            lon: s.place.lon,
            lat: s.place.lat,
          },
        ]
      : [],
  );
  const [lead, ...rest] = stories;

  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto bg-void">
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 pt-12 pb-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pt-20 lg:pb-16">
        <div>
          {latest && (
            <p className="text-sm text-ice/70">
              Edition of{" "}
              {day(latest, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          <h1 className="mt-4 text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-frost sm:text-6xl">
            Yesterday&apos;s world, <span className="text-ice">explained in 3D.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-ice/75 sm:text-lg">
            Every morning, the previous day&apos;s most-followed stories become short films on a 3D
            globe. Each story gets the analysis its kind needs, and every claim links to its source.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/today"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-frost px-5 py-3 font-semibold text-void transition hover:bg-white"
            >
              Open today&apos;s edition <ArrowRight size={16} />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ice/20 px-5 py-3 font-semibold text-frost transition hover:border-ice/45 hover:bg-ice/5"
            >
              <GithubMark size={16} /> View the source
            </a>
          </div>
          <p className="mt-6 text-sm text-ice/55">
            {stories.length} stories today · {editions.length} editions · every sentence cited · no
            account
          </p>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[560px]">
          {latest && <HeroGlobe date={latest} stories={globeStories} />}
        </div>
      </section>

      {/* Today's edition, set like a front page: the lead, then the rest by rank. */}
      {latest && lead && (
        <section className="border-t border-ice/10">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHead
                kicker="Today's edition"
                title={day(latest, { weekday: "long", day: "numeric", month: "long" })}
              />
              <Link
                href={`/edition/${latest}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-ice hover:text-frost"
              >
                All {stories.length} stories <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
              <Link href={href(lead.slug)} className="group block">
                <p className="text-sm font-medium" style={{ color: LENS_INFO[lead.lens].color }}>
                  {LENS_INFO[lead.lens].label}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-frost group-hover:underline group-hover:decoration-ice/40 group-hover:underline-offset-4 sm:text-3xl">
                  {lead.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-ice/70 sm:text-lg">
                  {lead.headline ?? lead.summary}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-ice group-hover:text-frost">
                  Watch the film <ArrowRight size={14} />
                </span>
              </Link>
              <ol className="divide-y divide-ice/10 border-y border-ice/10">
                {rest.slice(0, 5).map((s, i) => (
                  <li key={s.slug}>
                    <Link href={href(s.slug)} className="group flex gap-4 py-4">
                      <span className="w-5 shrink-0 pt-0.5 text-sm text-ice/40 tabular-nums">
                        {i + 2}
                      </span>
                      <span className="min-w-0">
                        <span
                          className="text-xs font-medium"
                          style={{ color: LENS_INFO[s.lens].color }}
                        >
                          {LENS_INFO[s.lens].label}
                        </span>
                        <span className="mt-0.5 block font-medium leading-snug text-frost group-hover:text-white group-hover:underline group-hover:decoration-ice/40 group-hover:underline-offset-4">
                          {s.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* Lenses */}
      <section id="lenses" className="scroll-mt-16 border-t border-ice/10">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
          <SectionHead kicker="Lenses" title="Each story gets the analysis its kind needs.">
            An election is told with its results, a person with their life, a crash with its route.
            Anything else gets a general film: what happened, where, and who read about it.
          </SectionHead>
          <dl className="mt-10 grid gap-x-12 sm:grid-cols-2">
            {LENSES.map(({ lens, title, text }) => (
              <div key={lens} className="flex gap-4 border-t border-ice/10 py-4">
                <span
                  className="mt-1.5 h-4 w-0.5 shrink-0 rounded-full"
                  style={{ background: LENS_INFO[lens].color }}
                />
                <span>
                  <dt className="font-medium text-frost">{title}</dt>
                  <dd className="mt-0.5 text-sm text-ice/65">{text}</dd>
                </span>
              </div>
            ))}
          </dl>
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {SHOWCASE.map((s) => (
              <figure key={s.src}>
                <Image
                  src={s.src}
                  alt={s.text}
                  width={1366}
                  height={681}
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="aspect-[1366/681] w-full rounded-xl border border-ice/10 object-cover"
                />
                <figcaption className="mt-3">
                  <span className="font-medium text-frost">{s.title}.</span>{" "}
                  <span className="text-sm text-ice/65">{s.text}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-ice/10">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
          <SectionHead kicker="Why you can trust it" title="Proof on every line." />
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <Icon className="text-ice" size={18} />
                <p className="mt-3 font-medium text-frost">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ice/65">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-t border-ice/10">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-20">
          <div>
            <SectionHead kicker="How it works" title="Made overnight, free to watch.">
              The work happens once a night in a GitHub Action. Visitors download static files: no
              AI calls, no keys, no backend.
            </SectionHead>
            <pre className="mt-8 overflow-x-auto rounded-xl border border-ice/10 bg-black/40 p-4 font-mono text-[12px] leading-6 text-ice/80 sm:text-[13px]">
              <code>{`pnpm edition 2026-11-04   # find and rank the stories
pnpm stories 2026-11-04   # one film per story
pnpm direct 2026-11-04 --ai   # optional narration
pnpm validate:scenes      # every sentence cited`}</code>
            </pre>
          </div>
          <ol className="divide-y divide-ice/10 border-y border-ice/10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 py-5">
                <span className="w-5 shrink-0 text-sm text-ice/40 tabular-nums">{i + 1}</span>
                <span>
                  <span className="block font-medium text-frost">{s.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ice/65">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Archive */}
      <section id="archive" className="scroll-mt-16 border-t border-ice/10">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
          <SectionHead kicker="Archive" title="Every edition is kept.">
            Editions follow the news for three days, then freeze. Day by day, the archive becomes a
            record of the planet.
          </SectionHead>
          <ul className="mt-10 divide-y divide-ice/10 border-y border-ice/10">
            {archive.map(({ date, edition: e }) => (
              <li key={date}>
                <Link
                  href={`/edition/${date}`}
                  className="group grid gap-1 py-4 sm:grid-cols-[14rem_1fr_auto] sm:items-center sm:gap-6"
                >
                  <span className="font-medium text-frost">
                    {day(date, { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className="truncate text-sm text-ice/65">
                    {e.stories.length} stories ·{" "}
                    {e.stories
                      .slice(0, 3)
                      .map((s) => s.title)
                      .join(" · ")}
                  </span>
                  <ArrowRight
                    size={16}
                    className="hidden text-ice/40 transition group-hover:translate-x-0.5 group-hover:text-ice sm:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
          {classics.length > 0 && (
            <>
              <h3 className="mt-14 font-medium text-frost">
                Classics: landmark events, replayed minute by minute
              </h3>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {classics.map((c) => (
                  <li key={c.id} className="border-t border-ice/10">
                    <Link
                      href={`/replay/${c.id}`}
                      className="group flex items-baseline justify-between gap-4 py-3"
                    >
                      <span>
                        <span className="font-medium text-frost group-hover:underline group-hover:decoration-ice/40 group-hover:underline-offset-4">
                          {c.title}
                        </span>
                        <span className="ml-2 text-sm text-ice/55">{c.date}</span>
                      </span>
                      <ArrowUpRight
                        size={15}
                        className="shrink-0 text-ice/40 group-hover:text-ice"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Open source */}
      <section className="border-t border-ice/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-20">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight text-frost sm:text-3xl">
              Open source. Add a lens.
            </h2>
            <p className="mt-2 text-ice/70">
              Earthlog is MIT-licensed. Fork it, run it for your own region, or teach it a new kind
              of story: a lens is one file and a few tests.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-frost px-5 py-3 font-semibold text-void transition hover:bg-white"
            >
              <GithubMark size={16} /> Star on GitHub
            </a>
            <a
              href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ice/20 px-5 py-3 font-semibold text-frost transition hover:border-ice/45 hover:bg-ice/5"
            >
              How to contribute
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
