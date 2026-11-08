import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeroGlobe, LitCaption } from "@/components/landing/HeroGlobe";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteNav } from "@/components/landing/SiteNav";
import { REPO_URL } from "@/config";
import {
  listEditions,
  listStoryFilms,
  loadEdition,
  loadIndex,
  loadNow,
  loadStoryBundle,
} from "@/lib/bundles";
import { type EditionStory, LENS_INFO, type Lens } from "@/scene/edition";
import { ago, blindSpot, storiesIn } from "@/scene/now";
import { outletById } from "@/scene/outlets";
import type { Evidence, Source } from "@/scene/schema";
import { TOPIC_LABEL } from "@/scene/topics";

const day = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

const LENSES: { lens: Lens; title: string; text: string }[] = [
  {
    lens: "election",
    title: "Elections",
    text: "Results race by race; flipped seats stand out, uncalled races stay grey.",
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
    text: "USGS shaking spreading outward, the fault, the people exposed.",
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

const PROMISES = [
  {
    title: "AI is optional and labelled",
    text: "Templates write every film. Claude may rewrite the captions once, offline; each chapter is checked in code, or the template stays.",
  },
  {
    title: "Open data, shown honestly",
    text: "Wikipedia, Wikidata, World Bank, USGS and NASA. Estimates say so, gaps stay visible, and every film says when its data was read.",
  },
  {
    title: "Nothing about you is recorded",
    text: "No account, no ads, no analytics. The site is static files, and visitors never trigger an AI call.",
  },
];

const STEPS = [
  {
    title: "Find the stories",
    text: "What the news reported and what the world read on Wikipedia, ranked by attention and balanced across continents. Stories told in the last week return only with new reporting.",
  },
  {
    title: "Choose the lens",
    text: "Wikidata says what each story is (an election, a person, a crash, a quake), and the matching lens gathers its data.",
  },
  {
    title: "Make the film",
    text: "Chapters, camera moves, maps, charts and captions. Every sentence cites its evidence, and a validator checks each one.",
  },
  {
    title: "Publish by morning",
    text: "A scheduled job builds the edition overnight. Visitors download static pages: nothing runs per visit.",
  },
];

const STILLS = [
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

const FAQ = [
  {
    q: "What is Earthlog?",
    a: "A daily edition of yesterday's most-followed stories, each told as a short film on a 3D globe: an election state by state, a life drawn across the map, a flight's route to the crash site. Every sentence links to its source.",
  },
  {
    q: "Where do the stories come from?",
    a: "Two public signals: what the news reported (Wikipedia's Current events, which cites news outlets) and what the world read (Wikipedia's most-read articles). Stories are ranked by attention and balanced across continents and kinds of news.",
  },
  {
    q: "Is any of it written by AI?",
    a: "Every film is first written by templates from the data. Claude may then rewrite the captions once, offline, and each chapter is checked in code: every number must appear in the cited evidence, or the template stays. Films with AI narration say so on screen. Visitors never trigger an AI call.",
  },
  {
    q: "Why does the globe look different each time I visit?",
    a: "It is lit by the sun as it is at that moment, so the night side, with its city lights, is where night really is. The lights come from NASA's Black Marble, a composite of many nights, not from last night.",
  },
  {
    q: "How fresh is the data?",
    a: "A new edition is built every night. For three days an edition follows the news (results and reports still fill in), then it freezes. Every film shows when its data was read.",
  },
  {
    q: "Do I need an account? Am I tracked?",
    a: "No account, no ads, no analytics. The site is static files; Earthlog records nothing about your visit.",
  },
  {
    q: "Can I share a story or download a video?",
    a: "Yes. The link button copies a link to the exact moment you are watching. The film button exports the story as a video, landscape or vertical, with its captions, stats and sources.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes, on any recent phone or computer with WebGL. It is at its best on a larger screen for now, and the phone layout is being improved.",
  },
  {
    q: "Can I use the code or add a kind of story?",
    a: "Earthlog is MIT-licensed. Each kind of story is a lens: one file and a few tests. The contributing guide explains how to add one.",
  },
];

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-serif text-4xl leading-[1.08] font-light tracking-[-0.015em] text-balance text-moon sm:text-5xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-base text-dust/65 sm:text-lg">{children}</p>}
    </div>
  );
}

/** The story label: "Update, day N" in amber when the story returns, else its lens. */
function StoryLabel({ story }: { story: EditionStory }) {
  return story.update ? (
    <span className="text-sodium">Update, day {story.update.day}</span>
  ) : (
    <span className="text-dust/50">{LENS_INFO[story.lens].label}</span>
  );
}

interface Proof {
  story: EditionStory;
  sentence: string;
  evidence: Evidence;
  source: Source | undefined;
  ai: boolean;
}

/**
 * A real line from one of the day's films and the report it cites, to show what "every line is
 * cited" means. Prefers a news report that names its outlets; read at build time from the films.
 */
async function findProof(
  date: string,
  stories: EditionStory[],
  films: Set<string>,
): Promise<Proof | undefined> {
  let fallback: Proof | undefined;
  for (const story of stories.slice(0, 10)) {
    if (!films.has(story.slug)) continue;
    const bundle = await loadStoryBundle(date, story.slug);
    const byId = new Map(bundle.evidence.map((e) => [e.id, e]));
    for (const beat of bundle.scene.beats) {
      for (const id of beat.cites) {
        const evidence = byId.get(id);
        if (evidence?.kind !== "report" || !evidence.quote || !evidence.url) continue;
        const proof = {
          story,
          sentence: beat.text,
          evidence,
          source: bundle.sources.find((s) => s.id === evidence.source),
          ai: bundle.scene.generatedBy.method === "claude",
        };
        if (evidence.links?.length) return proof;
        fallback ??= proof;
      }
    }
  }
  return fallback;
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
  const proof = latest ? await findProof(latest, stories, films) : undefined;
  // What the outlets are reporting, as of the last collection before this build.
  const nowFile = await loadNow();
  const nowAt = nowFile ? Date.parse(nowFile.generatedAt) : 0;
  const happening = nowFile ? storiesIn(nowFile, "24h", nowAt).slice(0, 4) : [];
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
  const dayLong = latest
    ? day(latest, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const dayShort = latest ? day(latest, { day: "numeric", month: "long" }) : "";

  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto bg-void">
      <SiteNav />

      {/* Hero: the planet as it is lit right now, the edition over its night side. */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8 lg:min-h-[720px]">
          <div className="relative mx-auto aspect-square w-full max-w-[480px] lg:absolute lg:top-1/2 lg:-right-[22%] lg:w-[78%] lg:max-w-[1000px] lg:-translate-y-1/2">
            {latest && <HeroGlobe date={latest} stories={globeStories} />}
          </div>
          {/* A scrim keeps the headline readable where it overlaps the globe's limb. */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r from-void via-void/80 to-transparent lg:block"
            aria-hidden="true"
          />
          <div className="relative max-w-xl pt-2 pb-14 lg:pt-36 lg:pb-40">
            {latest && (
              <p className="text-sm text-dust/60">
                Edition of {dayLong} · {films.size} films
              </p>
            )}
            <h1 className="mt-5 font-serif text-[2.9rem] leading-[1.02] font-light tracking-[-0.02em] text-balance text-moon sm:text-6xl lg:text-[4.6rem]">
              Yesterday&apos;s world, explained in 3D.
            </h1>
            <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-dust/70 sm:text-lg">
              Every morning, the previous day&apos;s most-followed stories become short films on a
              3D globe. Each story gets the analysis its kind deserves, and every claim links to its
              source.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/today"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sodium px-6 py-3 font-medium text-[#1a1206] transition-colors hover:bg-[#ffc46e] active:scale-[0.98]"
              >
                Watch the {dayShort} edition <ArrowRight size={16} />
              </Link>
              <Link
                href="/#how"
                className="inline-flex items-center justify-center rounded-full border border-moon/18 px-6 py-3 text-moon transition-colors hover:border-moon/35 hover:bg-moon/5"
              >
                How it works
              </Link>
            </div>
            <LitCaption className="mt-10 max-w-sm" />
          </div>
        </div>

        {/* The edition's first stories, like reels under the screen. */}
        {latest && stories.length > 0 && (
          <div className="relative border-t border-moon/8 bg-void/80 backdrop-blur-md">
            <ol className="mx-auto grid max-w-6xl grid-cols-1 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-5">
              {stories.slice(0, 4).map((s) => (
                <li key={s.slug} className="border-moon/8 max-lg:border-b lg:border-r">
                  <Link
                    href={href(s.slug)}
                    className="group block py-5 text-sm sm:pr-6 lg:min-h-full lg:pl-0"
                  >
                    <StoryLabel story={s} />
                    <span className="mt-1 line-clamp-2 block leading-snug text-moon group-hover:underline group-hover:decoration-moon/30 group-hover:underline-offset-4">
                      {s.title}
                    </span>
                    {s.place && (
                      <span className="mt-1 block truncate text-dust/45">{s.place.name}</span>
                    )}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`/edition/${latest}`}
                  className="group flex h-full items-center gap-2 py-5 text-sm text-dust/70 transition-colors hover:text-moon lg:pl-6"
                >
                  All {stories.length} stories
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* Now: the outlets' stories of the last hours, as the latest collection grouped them. */}
      {nowFile && happening.length > 0 && (
        <section className="border-t border-moon/8">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Heading title="Happening now.">
                While yesterday becomes films, the news keeps coming. {nowFile.outlets.length}{" "}
                outlets, grouped into stories every three hours.
              </Heading>
              <Link
                href="/now"
                className="group inline-flex items-center gap-2 text-sm text-dust/70 transition-colors hover:text-moon"
              >
                Open the live globe
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
            <ol className="mt-12 grid gap-x-10 border-t border-moon/8 sm:grid-cols-2">
              {happening.map((s) => {
                const spot = blindSpot(s.outlets);
                return (
                  <li key={s.cluster.id} className="border-b border-moon/8">
                    <Link href="/now" className="group block py-5">
                      <span className="flex flex-wrap gap-x-2 text-xs text-dust/50">
                        {s.breaking && <span className="font-medium text-sodium">Breaking</span>}
                        <span>{TOPIC_LABEL[s.cluster.topic]}</span>
                        {s.cluster.place && <span>· {s.cluster.place.name}</span>}
                        <span>· {ago(s.headlines[0]?.t ?? nowFile.generatedAt, nowAt)}</span>
                      </span>
                      <span className="mt-1.5 block font-serif text-xl leading-snug text-moon group-hover:underline group-hover:decoration-moon/30 group-hover:underline-offset-4">
                        {s.cluster.title}
                      </span>
                      <span className="mt-1.5 block text-xs text-dust/45">
                        {s.outlets.map((o) => outletById(o)?.name ?? o).join(", ")}
                        {spot && ` · only outlets based in ${spot}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* Proof: a real line from today's films, and the report it cites. */}
      {proof && latest && (
        <section className="border-t border-moon/8">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-20 lg:py-28">
            <div>
              <Heading title="Proof on every line.">
                Every sentence in a film cites the evidence it rests on, and a validator rejects any
                sentence that doesn&apos;t. This is a line from one of today&apos;s films.
              </Heading>
              <dl className="mt-10 grid gap-6">
                {PROMISES.map((p) => (
                  <div key={p.title}>
                    <dt className="text-moon">{p.title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-dust/60">{p.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <figure className="self-start rounded-2xl border border-moon/10 bg-night p-6 sm:p-8">
              <p className="text-sm text-dust/50">
                From the film{" "}
                <Link
                  href={href(proof.story.slug)}
                  className="text-dust/80 underline decoration-moon/20 underline-offset-4 hover:text-moon"
                >
                  {proof.story.title}
                </Link>
              </p>
              <blockquote className="mt-4 font-serif text-2xl leading-snug font-light text-moon sm:text-[1.7rem]">
                {proof.sentence}
                <sup className="ml-1 font-sans text-sm font-medium text-sodium">1</sup>
              </blockquote>
              {proof.ai && (
                <p className="mt-3 text-xs text-dust/45">
                  AI-written narration, every sentence checked against cited data.
                </p>
              )}
              <figcaption className="mt-7 border-t border-moon/10 pt-5 text-sm">
                <p className="flex gap-3">
                  <span className="font-medium text-sodium">1</span>
                  <span className="min-w-0">
                    <a
                      href={proof.evidence.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-moon hover:underline hover:decoration-moon/30 hover:underline-offset-4"
                    >
                      {proof.source?.name ?? "Source"},{" "}
                      {day(latest, { day: "numeric", month: "long", year: "numeric" })}
                      <ArrowUpRight size={14} className="text-dust/50" />
                    </a>
                    <span className="mt-2 block leading-relaxed text-dust/60">
                      &ldquo;{proof.evidence.quote}&rdquo;
                    </span>
                    {proof.evidence.links && proof.evidence.links.length > 0 && (
                      <span className="mt-3 block text-dust/50">
                        Reported by{" "}
                        {proof.evidence.links.map((l, i) => (
                          <span key={l.url}>
                            {i > 0 && ", "}
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-dust/80 underline decoration-moon/20 underline-offset-4 hover:text-moon"
                            >
                              {l.name}
                            </a>
                          </span>
                        ))}
                      </span>
                    )}
                    {proof.source && (
                      <span className="mt-3 block text-xs text-dust/40">
                        {proof.source.attribution} · {proof.source.license}
                      </span>
                    )}
                  </span>
                </p>
              </figcaption>
            </figure>
          </div>
        </section>
      )}

      {/* Lenses */}
      <section id="lenses" className="scroll-mt-16 border-t border-moon/8 bg-night">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <Heading title="Each story gets the analysis its kind deserves.">
            An election is told with its results, a person with their life, a crash with its route.
            Anything else gets a general film: what happened, where, and who read about it.
          </Heading>
          <dl className="mt-12 grid gap-x-14 sm:grid-cols-2">
            {LENSES.map(({ lens, title, text }) => (
              <div key={lens} className="flex gap-4 border-t border-moon/8 py-4">
                <span
                  className="mt-[7px] size-2 shrink-0 rounded-full"
                  style={{ background: LENS_INFO[lens].color }}
                  aria-hidden="true"
                />
                <span>
                  <dt className="text-moon">{title}</dt>
                  <dd className="mt-0.5 text-sm text-dust/55">{text}</dd>
                </span>
              </div>
            ))}
          </dl>
          <div className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {STILLS.map((s) => (
              <figure key={s.src}>
                <Image
                  src={s.src}
                  alt={s.text}
                  width={1366}
                  height={681}
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="aspect-[1366/681] w-full rounded-xl border border-moon/8 object-cover"
                />
                <figcaption className="mt-3 text-sm">
                  <span className="text-moon">{s.title}.</span>{" "}
                  <span className="text-dust/55">{s.text}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-t border-moon/8">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-20 lg:py-28">
          <Heading title="Made overnight, free to watch.">
            The work happens once a night, before anyone visits. Watching a film downloads static
            files: no AI calls, no keys, no server.
          </Heading>
          <ol className="divide-y divide-moon/8 border-y border-moon/8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5 py-5">
                <span className="w-5 shrink-0 font-serif text-lg leading-6 text-dust/40 tabular-nums">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-moon">{s.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-dust/60">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Archive */}
      <section id="archive" className="scroll-mt-16 border-t border-moon/8 bg-night">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <Heading title="Every edition is kept.">
            Editions follow the news for three days, then freeze. Day by day, the archive becomes a
            record of the planet.
          </Heading>
          <ul className="mt-12 divide-y divide-moon/8 border-y border-moon/8">
            {archive.map(({ date, edition: e }) => (
              <li key={date}>
                <Link
                  href={`/edition/${date}`}
                  className="group grid gap-1 py-4 sm:grid-cols-[15rem_1fr_auto] sm:items-baseline sm:gap-8"
                >
                  <span className="font-serif text-xl text-moon">
                    {day(date, { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className="truncate text-sm text-dust/55">
                    {e.stories.length} stories ·{" "}
                    {e.stories
                      .slice(0, 3)
                      .map((s) => s.title)
                      .join(" · ")}
                  </span>
                  <ArrowRight
                    size={16}
                    className="hidden text-dust/35 transition group-hover:translate-x-0.5 group-hover:text-moon sm:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
          {classics.length > 0 && (
            <>
              <h3 className="mt-16 font-serif text-2xl font-light text-moon">
                Classics: landmark events, replayed minute by minute
              </h3>
              <ul className="mt-5 grid gap-x-10 sm:grid-cols-2">
                {classics.map((c) => (
                  <li key={c.id} className="border-t border-moon/8">
                    <Link
                      href={`/replay/${c.id}`}
                      className="group flex items-baseline justify-between gap-4 py-3"
                    >
                      <span>
                        <span className="text-moon group-hover:underline group-hover:decoration-moon/30 group-hover:underline-offset-4">
                          {c.title}
                        </span>
                        <span className="ml-2 text-sm text-dust/45">{c.date}</span>
                      </span>
                      <ArrowUpRight
                        size={15}
                        className="shrink-0 text-dust/35 group-hover:text-moon"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-moon/8">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-20 lg:py-28">
          <Heading title="Questions, answered.">Something else? Open an issue on GitHub.</Heading>
          <div className="divide-y divide-moon/8 border-y border-moon/8">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-moon [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus
                    size={18}
                    className="shrink-0 text-dust/50 transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-dust/65 sm:text-base">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Open source */}
      <section className="border-t border-moon/8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-20">
          <div className="max-w-xl">
            <h2 className="font-serif text-3xl font-light tracking-[-0.01em] text-moon sm:text-4xl">
              Open source. Add a lens.
            </h2>
            <p className="mt-3 text-dust/65">
              Earthlog is MIT-licensed. Fork it, run it for your own region, or teach it a new kind
              of story: a lens is one file and a few tests.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-moon/18 px-5 py-2.5 text-moon transition-colors hover:border-moon/35 hover:bg-moon/5"
            >
              Read the source <ArrowUpRight size={15} />
            </a>
            <a
              href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-dust/75 transition-colors hover:text-moon"
            >
              How to contribute <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
