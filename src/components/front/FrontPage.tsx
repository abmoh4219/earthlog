"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FrontGlobe, FrontStory } from "@/globe/front";
import { REGIONS, Region } from "@/scene/regions";

export interface RailStory extends FrontStory {
  lensLabel: string;
  headline: string;
  /** Why it made the edition, in plain words (ADR-0021). */
  why?: string[];
  /** The reader's region of its place (ADR-0023). */
  region?: Region;
  hasFilm: boolean;
  placed: boolean;
}

const TOUR_MS = 7000;

export function FrontPage({
  date,
  dateLabel,
  stories,
  editions,
  classics,
}: {
  date: string;
  dateLabel: string;
  stories: RailStory[];
  editions: { date: string; label: string }[];
  classics: { id: string; title: string }[];
}) {
  const router = useRouter();
  const globeRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const engine = useRef<FrontGlobe | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState<string | undefined>();
  const [touring, setTouring] = useState(false);
  const [stop, setStop] = useState(0);
  // Where: the reader's region filter (ADR-0023). The rail, the strip, the tour and the globe
  // show only that region's stories.
  const [region, setRegion] = useState<Region>();
  const regions = useMemo(
    () => REGIONS.filter((r) => stories.some((s) => s.region === r)),
    [stories],
  );
  const shown = useMemo(
    () => (region ? stories.filter((s) => s.region === region) : stories),
    [stories, region],
  );
  useEffect(() => {
    engine.current?.update(shown.filter((s) => s.placed));
    engine.current?.focus(undefined);
  }, [shown]);
  const filmHref = (slug: string) => `/story/${date}/${slug}`;
  // The globe is built once per edition; its click handler reads the latest router.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const el = globeRef.current;
    const credits = creditsRef.current;
    if (!el || !credits) return;
    let cancelled = false;
    let made: FrontGlobe | undefined;
    const placed = stories.filter((s) => s.placed);
    import("@/globe/front")
      .then(({ createFrontGlobe }) =>
        createFrontGlobe(el, credits, placed, (slug) => {
          const st = stories.find((s) => s.slug === slug);
          if (st?.hasFilm) routerRef.current.push(`/story/${date}/${slug}`);
        }),
      )
      .then((g) => {
        if (cancelled) g.destroy();
        else {
          made = g;
          engine.current = g;
          setReady(true);
        }
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
      made?.destroy();
      engine.current = undefined;
    };
  }, [stories, date]);

  // The tour: story to story around the planet, a few seconds each.
  const tourStories = useMemo(() => shown.filter((s) => s.placed && s.hasFilm), [shown]);
  useEffect(() => {
    if (!touring || !tourStories.length) return;
    const st = tourStories[stop % tourStories.length];
    if (st) {
      setFocus(st.slug);
      engine.current?.focus(st.slug);
    }
    const timer = setTimeout(() => setStop((n) => n + 1), TOUR_MS);
    return () => clearTimeout(timer);
  }, [touring, stop, tourStories]);

  const choose = (slug: string | undefined) => {
    setFocus(slug);
    const st = stories.find((s) => s.slug === slug);
    if (!slug || st?.placed) engine.current?.focus(slug);
  };
  const current = stories.find((s) => s.slug === focus);

  return (
    <main className="relative h-dvh overflow-hidden bg-void">
      <div ref={globeRef} className="earthlog-globe absolute inset-0" />
      <div ref={creditsRef} className="hidden" aria-hidden />

      {/* Phones: a fade under the header keeps it readable over the globe. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-void via-void/70 to-transparent p-5 pb-16 md:bg-none md:p-8">
        <Link
          href="/"
          className="pointer-events-auto font-serif text-xl text-moon/90 hover:text-moon"
        >
          Earthlog
        </Link>
        <h1 className="mt-3 max-w-xl font-serif text-[2rem] leading-[1.04] font-light tracking-[-0.02em] text-moon sm:text-4xl md:mt-4 md:text-6xl">
          Yesterday&apos;s world, explained in 3D.
        </h1>
        <p className="mt-2 max-w-md text-[13px] text-dust/70 sm:text-sm md:text-base">
          The edition of {dateLabel}: {stories.length} stories, each told with its own analysis.
          Every claim links to its source.
        </p>
        <div className="pointer-events-auto mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setTouring((t) => !t);
              if (touring) choose(undefined);
            }}
            className="rounded-full bg-sodium px-5 py-2 text-sm font-medium text-[#1a1206] transition-colors hover:bg-[#ffc46e] active:scale-[0.98]"
          >
            {touring ? "Stop the tour" : "Play the edition"}
          </button>
          <Link
            href={`/edition/${date}`}
            className="glass rounded-full px-5 py-2 text-sm text-dust transition hover:border-dust/40"
          >
            All stories
          </Link>
        </div>
      </header>

      {/* The tour's caption: the story at this stop, and the way into its film. */}
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.slug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            className="glass absolute bottom-40 left-1/2 z-10 w-[min(92vw,640px)] -translate-x-1/2 rounded-2xl px-5 py-4 md:bottom-24 md:px-6 md:py-5"
          >
            <span className="flex items-center gap-2 text-xs text-dust/60">
              <span className="size-2 rounded-full" style={{ background: current.color }} />
              {current.lensLabel}
            </span>
            <h2 className="mt-2 font-serif text-2xl leading-snug text-moon">{current.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-dust/70">{current.headline}</p>
            {current.why && current.why.length > 0 && (
              <p className="mt-2 text-xs text-dust/50">{current.why.slice(0, 3).join(" · ")}</p>
            )}
            {current.hasFilm && (
              <Link
                href={filmHref(current.slug)}
                className="mt-3 inline-block text-sm font-medium text-sodium hover:text-[#ffc46e]"
              >
                Watch the full story →
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The story rail. */}
      <aside className="panel-stack absolute top-6 right-4 bottom-24 z-10 hidden w-80 overflow-y-auto md:block">
        {regions.length > 1 && (
          <fieldset className="glass mb-2 flex min-w-0 flex-wrap gap-1 rounded-xl p-1.5 text-xs">
            <legend className="sr-only">Where</legend>
            {[undefined, ...regions].map((r) => (
              <button
                key={r ?? "all"}
                type="button"
                aria-pressed={r === region}
                onClick={() => setRegion(r)}
                className={`rounded-full px-2.5 py-1 transition-colors ${r === region ? "bg-moon/12 text-moon" : "text-dust/60 hover:text-moon"}`}
              >
                {r ?? "Everywhere"}
              </button>
            ))}
          </fieldset>
        )}
        <ol className="space-y-2">
          {shown.map((s, i) => (
            <li key={s.slug}>
              <Link
                href={s.hasFilm ? filmHref(s.slug) : `/edition/${date}`}
                onMouseEnter={() => {
                  setTouring(false);
                  choose(s.slug);
                }}
                onFocus={() => choose(s.slug)}
                className={`glass block rounded-xl px-4 py-3 transition hover:border-dust/40 ${focus === s.slug ? "border-dust/50" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-dust/40 tabular-nums">{i + 1}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="font-medium text-xs text-dust/60">{s.lensLabel}</span>
                </span>
                <span className="mt-1 block font-serif text-[15px] leading-snug text-moon">
                  {s.title}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </aside>

      {/* Phones: the stories as a strip to swipe, above the editions. */}
      <nav
        aria-label="Stories"
        className="absolute inset-x-0 bottom-14 z-10 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden"
      >
        {regions.length > 1 && (
          <select
            aria-label="Where"
            value={region ?? ""}
            style={{ colorScheme: "dark" }}
            onChange={(e) => setRegion(Region.safeParse(e.target.value).data)}
            className="glass h-10 shrink-0 snap-start self-center rounded-full bg-transparent px-3 text-xs text-moon"
          >
            <option value="">Everywhere</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        {shown.map((s) => (
          <Link
            key={s.slug}
            href={s.hasFilm ? filmHref(s.slug) : `/edition/${date}`}
            onFocus={() => choose(s.slug)}
            className="glass w-56 shrink-0 snap-start rounded-xl px-3 py-2.5"
          >
            <span className="text-xs font-medium" style={{ color: s.color }}>
              {s.lensLabel}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-sm leading-snug font-medium text-moon">
              {s.title}
            </span>
          </Link>
        ))}
      </nav>

      {/* Earlier editions and the classics (classics from tablets up). */}
      <footer className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 overflow-x-auto px-4 pb-4 text-xs sm:flex-wrap sm:px-6 sm:pb-5">
        <span className="shrink-0 font-medium text-dust/50">Editions</span>
        {editions.map((e) => (
          <Link
            key={e.date}
            href={e.date === date ? `/edition/${e.date}` : `/edition/${e.date}`}
            className={`shrink-0 rounded-full px-3 py-1 whitespace-nowrap ${e.date === date ? "bg-dust/20 text-moon" : "glass text-dust/80 hover:text-moon"}`}
          >
            {e.label}
          </Link>
        ))}
        {classics.length > 0 && (
          <span className="ml-4 hidden font-medium text-dust/50 sm:inline">Classics</span>
        )}
        {classics.map((c) => (
          <Link
            key={c.id}
            href={`/replay/${c.id}`}
            className="glass hidden shrink-0 rounded-full px-3 py-1 whitespace-nowrap text-dust/80 hover:text-moon sm:inline-block"
          >
            {c.title}
          </Link>
        ))}
      </footer>

      <AnimatePresence>
        {!ready && (
          <motion.div
            key="loading"
            className="absolute inset-0 z-20 grid place-items-center bg-void"
            exit={{ opacity: 0, transition: { duration: 1.2 } }}
          >
            <span className="font-medium text-xs text-dust/70">Loading the edition…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
