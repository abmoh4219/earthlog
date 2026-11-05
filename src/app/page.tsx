import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  Clapperboard,
  Database,
  Globe2,
  HeartHandshake,
  Plane,
  Rocket,
  ScrollText,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  User,
  Vote,
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

const LENSES: { lens: Lens; icon: typeof Vote; title: string; text: string }[] = [
  {
    lens: "election",
    icon: Vote,
    title: "Elections",
    text: "Results race by race, flipped seats pulsing, uncalled races left grey, parliament charts.",
  },
  {
    lens: "person",
    icon: User,
    title: "People",
    text: "A life drawn across the globe, from birthplace to the places that defined it.",
  },
  {
    lens: "organization",
    icon: Building2,
    title: "Companies and tech",
    text: "A flight to headquarters, what is on record, revenue over time, the community's discussion.",
  },
  {
    lens: "economy",
    icon: TrendingUp,
    title: "The economy",
    text: "The institution, its country in numbers, its region as 3D columns and a comparison map.",
  },
  {
    lens: "sports",
    icon: Trophy,
    title: "Sports",
    text: "The venue, arcs from the teams' home cities, the result card.",
  },
  {
    lens: "culture",
    icon: Clapperboard,
    title: "Culture",
    text: "The credits, a trail through the filming locations, where the people credited were born.",
  },
  {
    lens: "accident",
    icon: Plane,
    title: "Accidents",
    text: "The journey flown and the leg never reached, the site on real terrain, who was on board.",
  },
  {
    lens: "disaster",
    icon: Activity,
    title: "Earthquakes",
    text: "USGS shaking spreading outward, the fault model, towns as columns, people exposed.",
  },
  {
    lens: "conflict",
    icon: Swords,
    title: "Conflicts",
    text: "The week day by day, places coloured by recency, figures as the sources record them.",
  },
  {
    lens: "science",
    icon: Rocket,
    title: "Science and space",
    text: "The launch pad with a beam of light, the mission, the landing.",
  },
];

const TRUST = [
  {
    icon: BadgeCheck,
    title: "Every claim is cited",
    text: "Every sentence and every number carries a citation chip to the evidence it rests on. A validator rejects anything else, whoever wrote it.",
  },
  {
    icon: Sparkles,
    title: "AI is optional and checked",
    text: "A template writes every film. Claude may rewrite the captions once per story, offline; each chapter is checked in code or keeps the template. Visitors never trigger an AI call.",
  },
  {
    icon: Database,
    title: "Honest, open data",
    text: "Wikipedia, Wikidata, World Bank, USGS, NASA. Estimates say so, figures are attributed, and every film says when its data was read.",
  },
  {
    icon: HeartHandshake,
    title: "Free, for everyone",
    text: "No account, no ads, no tracking, no backend. MIT-licensed and built to be forked.",
  },
];

const STEPS = [
  {
    title: "Find the stories",
    text: "What the news reported (Wikipedia Current events) and what the world read (most-read articles), ranked by heat and balanced across continents.",
  },
  {
    title: "Pick the lens",
    text: "Wikidata says what each story is (an election, a person, a crash, a quake) and the matching lens gathers its data.",
  },
  {
    title: "Film it",
    text: "Chapters, camera moves, maps, charts and captions, every sentence cited. Optionally directed by Claude, then validated.",
  },
  {
    title: "Publish every morning",
    text: "A GitHub Action runs it all overnight and commits the edition; static pages serve it to everyone, free.",
  },
];

const SHOWCASE = [
  {
    src: "/media/learjet.jpg",
    title: "The journey",
    text: "Accident lens: the flight from Austin, flown in red, the leg to the Bahamas it never reached, dashed.",
  },
  {
    src: "/media/curiosity.jpg",
    title: "The curiosity map",
    text: "Who read about a story, in which language, glowing where each language is spoken.",
  },
  {
    src: "/media/thread.jpg",
    title: "How it unfolded",
    text: "A story's thread through the past week, each day cited to its own page.",
  },
  {
    src: "/media/terrain.jpg",
    title: "Real terrain",
    text: "Accident and disaster sites stand on real elevation: here, the Khumbu below Everest.",
  },
];

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

  return (
    <div className="h-dvh overflow-y-auto bg-void">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_40%,rgb(94_242_255/0.12),transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pt-16 pb-10 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            {latest && (
              <Link
                href="/today"
                className="inline-flex items-center gap-2 rounded-full border border-ice/20 bg-ice/5 px-3 py-1 text-xs text-ice/85 transition hover:border-ice/40"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-attention" />
                New edition: {day(latest, { weekday: "long", day: "numeric", month: "long" })}
                <ArrowRight size={12} />
              </Link>
            )}
            <h1 className="mt-6 text-5xl leading-[1.05] font-semibold tracking-tight text-frost md:text-6xl">
              Yesterday&apos;s world,
              <br />
              <span className="bg-gradient-to-r from-attention via-ice to-[#ff8fd0] bg-clip-text text-transparent">
                explained in 3D.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ice/75">
              Every morning, the previous day&apos;s hottest stories become short, cinematic
              explainers on a 3D globe. Each story gets the analysis its kind deserves, and every
              claim links to its source.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/today"
                className="inline-flex items-center gap-2 rounded-full bg-ice px-6 py-3 font-semibold text-void transition hover:bg-frost"
              >
                <Globe2 size={18} /> Watch today&apos;s edition
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-ice/20 px-6 py-3 font-semibold text-frost transition hover:border-ice/50"
              >
                <GithubMark /> View on GitHub
              </a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-ice/10 pt-6">
              {[
                { k: "Stories today", v: stories.length },
                { k: "Editions", v: editions.length },
                { k: "Uncited sentences", v: 0 },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="font-mono text-[10px] tracking-[0.2em] text-ice/50 uppercase">
                    {s.k}
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-frost tabular-nums">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative aspect-square w-full max-w-[600px] justify-self-center">
            <div className="absolute inset-[8%] rounded-full bg-attention/10 blur-3xl" />
            {latest && <HeroGlobe date={latest} stories={globeStories} />}
          </div>
        </div>
      </section>

      {/* The demo: a story film exported with Earthlog's own clip recorder. */}
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-4">
        <div className="text-center">
          <p className="font-mono text-[11px] tracking-[0.3em] text-attention uppercase">
            See it in action
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-frost md:text-4xl">
            The 2026 US elections, in under two minutes.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-ice/70">
            One story film, exported with Earthlog&apos;s own clip button: Senate, governor and
            House races state by state, every sentence with its cited source.
          </p>
        </div>
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-ice/15 shadow-[0_40px_120px_-40px_rgb(94_242_255/0.35)]">
          <video
            className="aspect-video w-full bg-black"
            src="/media/earthlog-demo.mp4"
            poster="/media/earthlog-demo.jpg"
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            aria-label="Earthlog story film: the 2026 United States elections"
          />
        </div>
      </section>

      {/* Today's edition */}
      {latest && edition && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] text-attention uppercase">
                Today&apos;s edition
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-frost md:text-4xl">
                {day(latest, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </h2>
            </div>
            <Link
              href={`/edition/${latest}`}
              className="inline-flex items-center gap-1 text-sm text-ice hover:text-frost"
            >
              All {stories.length} stories <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.slice(0, 6).map((s) => {
              const lens = LENS_INFO[s.lens];
              const href = films.has(s.slug) ? `/story/${latest}/${s.slug}` : `/edition/${latest}`;
              return (
                <Link
                  key={s.slug}
                  href={href}
                  className="group glass flex flex-col rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-ice/40"
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: lens.color }} />
                    <span className="font-mono text-[10px] tracking-[0.2em] text-ice/60 uppercase">
                      {lens.label}
                    </span>
                  </span>
                  <span className="mt-3 text-lg leading-snug font-semibold text-frost">
                    {s.title}
                  </span>
                  <span className="mt-2 line-clamp-3 text-sm text-ice/65">
                    {s.headline ?? s.summary}
                  </span>
                  <span className="mt-auto pt-4 text-sm font-medium text-ice group-hover:text-frost">
                    Watch the film →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Lenses */}
      <section
        id="lenses"
        className="scroll-mt-20 border-y border-ice/10 bg-[linear-gradient(180deg,rgb(10_20_32/0.5),transparent)]"
      >
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-[11px] tracking-[0.3em] text-attention uppercase">Lenses</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-frost md:text-4xl">
            Every story gets the analysis its kind deserves.
          </h2>
          <p className="mt-3 max-w-2xl text-ice/70">
            Not one template for all news: each kind of story has its own lens, with its own data,
            maps and charts. Anything else gets a general film that still explains what happened,
            where, and who read about it.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LENSES.map(({ lens, icon: Icon, title, text }) => (
              <div key={lens} className="glass rounded-2xl p-4">
                <span
                  className="grid size-9 place-items-center rounded-xl"
                  style={{ background: `${LENS_INFO[lens].color}22`, color: LENS_INFO[lens].color }}
                >
                  <Icon size={18} />
                </span>
                <p className="mt-3 font-semibold text-frost">{title}</p>
                <p className="mt-1 text-sm text-ice/65">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {SHOWCASE.map((s) => (
              <figure key={s.src} className="glass overflow-hidden rounded-2xl">
                <Image
                  src={s.src}
                  alt={s.text}
                  width={1366}
                  height={681}
                  className="aspect-[16/8] w-full object-cover"
                />
                <figcaption className="p-4">
                  <p className="font-semibold text-frost">{s.title}</p>
                  <p className="mt-1 text-sm text-ice/65">{s.text}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-mono text-[11px] tracking-[0.3em] text-attention uppercase">
          Why you can trust it
        </p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-frost md:text-4xl">
          Proof on every line.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-ice/10 p-6">
              <Icon className="text-attention" size={22} />
              <p className="mt-4 font-semibold text-frost">{title}</p>
              <p className="mt-2 text-sm text-ice/65">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="scroll-mt-20 border-y border-ice/10 bg-[linear-gradient(180deg,rgb(10_20_32/0.5),transparent)]"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-attention uppercase">
              How it works
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-frost md:text-4xl">
              Built overnight, free for every visitor.
            </h2>
            <p className="mt-3 text-ice/70">
              All the work happens once a night in a GitHub Action. Visitors download static files:
              no AI calls, no keys, no backend, so watching costs nothing.
            </p>
            <pre className="mt-8 overflow-x-auto rounded-2xl border border-ice/10 bg-black/40 p-5 font-mono text-xs leading-6 text-ice/85">
              <code>
                {`pnpm edition 2026-11-03   # find, type and rank the stories
pnpm stories 2026-11-03   # film each story with its lens
pnpm direct 2026-11-03 --ai   # optional Claude narration
pnpm validate:scenes      # every sentence must cite evidence`}
              </code>
            </pre>
          </div>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="glass flex gap-4 rounded-2xl p-5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ice/10 font-mono text-sm text-ice">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold text-frost">{s.title}</span>
                  <span className="mt-1 block text-sm text-ice/65">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Archive */}
      <section id="archive" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <p className="font-mono text-[11px] tracking-[0.3em] text-attention uppercase">Archive</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-frost md:text-4xl">
          Every edition is kept.
        </h2>
        <p className="mt-3 max-w-2xl text-ice/70">
          Day after day, the archive becomes a 3D record of the planet. Editions follow the news for
          three days, then freeze.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {archive.map(({ date, edition: e }) => (
            <Link
              key={date}
              href={`/edition/${date}`}
              className="glass rounded-2xl p-5 transition hover:border-ice/40"
            >
              <p className="font-mono text-[10px] tracking-[0.2em] text-ice/55 uppercase">
                {day(date, { weekday: "long" })}
              </p>
              <p className="mt-1 text-xl font-semibold text-frost">
                {day(date, { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="mt-1 text-sm text-ice/60">{e.stories.length} stories</p>
              <ul className="mt-3 space-y-1 text-sm text-ice/75">
                {e.stories.slice(0, 3).map((s) => (
                  <li key={s.slug} className="flex items-center gap-2">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: LENS_INFO[s.lens].color }}
                    />
                    <span className="truncate">{s.title}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
        {classics.length > 0 && (
          <>
            <h3 className="mt-14 flex items-center gap-2 text-lg font-semibold text-frost">
              <ScrollText size={18} className="text-ice" /> Classics: landmark events, replayed
              minute by minute
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {classics.map((c) => (
                <Link
                  key={c.id}
                  href={`/replay/${c.id}`}
                  className="rounded-2xl border border-ice/10 p-4 transition hover:border-ice/40"
                >
                  <p className="font-mono text-[10px] tracking-[0.2em] text-ice/55 uppercase">
                    {c.category} · {c.date}
                  </p>
                  <p className="mt-1 font-semibold text-frost">{c.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ice/60">{c.subtitle}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-ice/15 bg-[radial-gradient(80%_120%_at_20%_0%,rgb(94_242_255/0.18),transparent_60%),linear-gradient(180deg,rgb(10_20_32),rgb(2_4_9))] p-10 md:p-14">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-frost md:text-4xl">
            Open source, free forever. Add a lens.
          </h2>
          <p className="mt-3 max-w-xl text-ice/70">
            Earthlog is MIT-licensed. Star it, fork it, or teach it a new kind of story: a lens is
            one file and a few tests.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-ice px-6 py-3 font-semibold text-void hover:bg-frost"
            >
              <GithubMark /> Star on GitHub
            </a>
            <a
              href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-ice/25 px-6 py-3 font-semibold text-frost hover:border-ice/50"
            >
              How to contribute <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
