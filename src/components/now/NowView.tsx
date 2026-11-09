"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { LitCaption } from "@/components/landing/HeroGlobe";
import {
  EarthControls,
  type Layers,
  type Selection,
  SelectionCard,
} from "@/components/now/EarthPanel";
import type { FrontGlobe, FrontStory, NaturePoint } from "@/globe/front";
import { fresherLive, fresherNow } from "@/lib/live-now";
import { countryAt } from "@/scene/geo";
import type { Headline, NowFile } from "@/scene/headlines";
import type { LiveFile } from "@/scene/live";
import {
  ago,
  blindSpot,
  type NowStory,
  type NowWindow,
  nextCollection,
  storiesIn,
  WINDOWS,
  windowCounts,
} from "@/scene/now";
import { OUTLETS, outletById } from "@/scene/outlets";
import { countryPulse, type PulseStory, surprise } from "@/scene/pulse";
import { Country } from "@/scene/schema";
import { TOPIC_LABEL, type Topic } from "@/scene/topics";

const WINDOW_LABEL: Record<NowWindow, string> = {
  "1h": "Last hour",
  "3h": "3 hours",
  "24h": "24 hours",
};
const POLL_MS = 10 * 60_000;
const hhmm = (iso: string) => `${iso.slice(11, 16)} UTC`;
const name = (outlet: string) => outletById(outlet)?.name ?? outlet;

/** The headline that names the story: its outlet is credited first. */
function lead(s: NowStory): Headline | undefined {
  return s.headlines.find((h) => h.title === s.cluster.title) ?? s.headlines[0];
}

/** Country outlines, loaded on the first click on the ground (150 KB, not needed before). */
let countriesOnce: Promise<Country[]> | undefined;
const loadCountries = () => {
  countriesOnce ??= fetch("/geo/countries.json")
    .then((r) => r.json())
    .then((j) => z.array(Country).parse(j))
    .catch(() => {
      countriesOnce = undefined;
      return [];
    });
  return countriesOnce;
};

export function NowView({
  initial,
  initialLive,
  recent = [],
}: {
  initial: NowFile;
  initialLive?: LiveFile | undefined;
  recent?: PulseStory[];
}) {
  const [file, setFile] = useState(initial);
  const [live, setLive] = useState(initialLive);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [layers, setLayers] = useState<Layers>({ news: true, quakes: true, nature: true });
  const [selection, setSelection] = useState<Selection>();
  const fileRef = useRef(file);
  fileRef.current = file;
  // The first render uses the collection time as "now", so the server and the browser agree;
  // the real clock takes over after mount and ticks every minute (re-ranking, "3 h ago").
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));
  const [win, setWin] = useState<NowWindow>(() =>
    storiesIn(initial, "3h", Date.parse(initial.generatedAt)).length >= 6 ? "3h" : "24h",
  );
  const [topic, setTopic] = useState<Topic | undefined>();
  const [open, setOpen] = useState<string>();
  const globeEl = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const globe = useRef<FrontGlobe | undefined>(undefined);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    // Fresh headlines while the page is open: the hourly file, read at once and every 10 min.
    const poll = async () => {
      const [next, nextLive] = await Promise.all([
        fresherNow(fileRef.current),
        fresherLive(liveRef.current),
      ]);
      if (next) setFile(next);
      if (nextLive) setLive(nextLive);
    };
    poll();
    const every = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const counts = useMemo(() => windowCounts(file, now, topic), [file, now, topic]);
  const stories = useMemo(() => storiesIn(file, win, now, topic), [file, win, now, topic]);
  const topics = useMemo(() => {
    const all = storiesIn(file, win, now);
    const n = new Map<Topic, number>();
    for (const s of all) n.set(s.cluster.topic, (n.get(s.cluster.topic) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [file, win, now]);
  const failed = file.outlets.filter((o) => !o.ok).map((o) => name(o.id));

  const placed = useMemo<FrontStory[]>(
    () =>
      stories.flatMap((s) =>
        s.cluster.place
          ? [
              {
                slug: s.cluster.id,
                title: s.cluster.title,
                color: "#ffb547",
                heat: Math.max(8, s.heat),
                lon: s.cluster.place.lon,
                lat: s.cluster.place.lat,
              },
            ]
          : [],
      ),
    [stories],
  );
  const shown = useMemo(() => (layers.news ? placed : []), [placed, layers.news]);
  const nature = useMemo<NaturePoint[]>(
    () => [
      ...(layers.quakes
        ? (live?.quakes ?? []).map((q) => ({
            id: `q:${q.id}`,
            kind: "quake" as const,
            lon: q.lon,
            lat: q.lat,
            mag: q.mag,
          }))
        : []),
      ...(layers.nature
        ? (live?.events ?? []).map((e) => ({
            id: `e:${e.id}`,
            kind: e.kind,
            lon: e.lon,
            lat: e.lat,
          }))
        : []),
    ],
    [live, layers.quakes, layers.nature],
  );
  const natureRef = useRef(nature);
  natureRef.current = nature;
  // A country's pulse reads the whole day, whatever window the list shows.
  const day = useMemo(() => storiesIn(file, "24h", now), [file, now]);
  const storiesRef = useRef(day);
  storiesRef.current = day;
  const recentRef = useRef(recent);
  recentRef.current = recent;
  const placedRef = useRef(shown);
  placedRef.current = shown;

  const choose = useCallback((id: string | undefined, fromGlobe = false) => {
    setSelection(undefined);
    setOpen((cur) => (cur === id && !fromGlobe ? undefined : id));
    globe.current?.focus(id);
    if (fromGlobe && id)
      requestAnimationFrame(() =>
        listRef.current
          ?.querySelector(`[data-id="${id}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
  }, []);

  // A click on the globe: an earthquake or an event opens its card; a story opens in the list.
  const pick = useCallback(
    (id: string) => {
      const l = liveRef.current;
      if (id.startsWith("q:")) {
        const quake = l?.quakes.find((q) => `q:${q.id}` === id);
        if (quake) {
          setSelection({ kind: "quake", quake });
          globe.current?.look(quake.lon, quake.lat, 8e6);
        }
        return;
      }
      if (id.startsWith("e:")) {
        const event = l?.events.find((e) => `e:${e.id}` === id);
        if (event) {
          setSelection({ kind: "event", event });
          globe.current?.look(event.lon, event.lat, 8e6);
        }
        return;
      }
      choose(id, true);
    },
    [choose],
  );
  // A click on the ground: that country's pulse.
  const ground = useCallback(async (lon: number, lat: number) => {
    const countries = await loadCountries();
    const country = countryAt(lon, lat, countries);
    if (!country) return setSelection(undefined);
    setOpen(undefined);
    setSelection({
      kind: "country",
      pulse: countryPulse(
        country,
        storiesRef.current,
        liveRef.current,
        recentRef.current,
        countries,
      ),
    });
    globe.current?.look(country.label[0], country.label[1], 6e6);
  }, []);
  const groundRef = useRef(ground);
  groundRef.current = ground;
  const filmed = useMemo(
    () => stories.filter((s) => s.cluster.nowFilm).map((s) => ({ id: s.cluster.id, heat: s.heat })),
    [stories],
  );
  const onSurprise = useCallback(() => {
    const next = surprise(filmed, Math.random(), open);
    if (next) choose(next.id, true);
  }, [filmed, open, choose]);

  // The globe is built once; story changes go through update().
  useEffect(() => {
    const el = globeEl.current;
    const cr = credits.current;
    if (!el || !cr) return;
    let cancelled = false;
    let made: FrontGlobe | undefined;
    import("@/globe/front")
      .then(({ createFrontGlobe }) =>
        createFrontGlobe(el, cr, placedRef.current, (id) => pick(id), {
          zoom: true,
          night: true,
          face: "stories",
          onGround: (lon, lat) => groundRef.current(lon, lat),
        }),
      )
      .then((g) => {
        if (cancelled) g.destroy();
        else {
          made = g;
          globe.current = g;
          g.update(placedRef.current);
          g.setNature(natureRef.current);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      made?.destroy();
      globe.current = undefined;
    };
  }, [pick]);
  useEffect(() => {
    globe.current?.update(shown);
  }, [shown]);
  useEffect(() => {
    globe.current?.setNature(nature);
  }, [nature]);

  return (
    <main className="grid min-h-0 flex-1 grid-rows-[40vh_1fr] lg:grid-cols-[minmax(380px,460px)_1fr] lg:grid-rows-1">
      <aside className="panel-stack order-2 min-h-0 overflow-y-auto border-moon/8 lg:order-1 lg:border-r">
        <div className="px-5 pt-8 pb-4 sm:px-6">
          <h1 className="font-serif text-4xl font-light tracking-[-0.02em] text-moon">Now</h1>
          <p className="mt-2 text-sm leading-relaxed text-dust/60">
            The news of the last hours from {file.outlets.length} outlets, grouped into stories.
            Every headline opens the outlet&apos;s own article.
          </p>
          <p className="mt-3 text-xs text-dust/45">
            Collected {ago(file.generatedAt, now)} · next at{" "}
            {hhmm(nextCollection(file.generatedAt))}
            {failed.length > 0 && ` · not reached this time: ${failed.join(", ")}`}
          </p>

          <div
            className="mt-5 grid grid-cols-3 rounded-full border border-moon/10 p-1 text-sm"
            role="tablist"
          >
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                role="tab"
                aria-selected={w === win}
                onClick={() => setWin(w)}
                className={`rounded-full px-3 py-1.5 transition-colors ${w === win ? "bg-moon/12 text-moon" : "text-dust/55 hover:text-moon"}`}
              >
                {WINDOW_LABEL[w]} <span className="text-dust/40 tabular-nums">{counts[w]}</span>
              </button>
            ))}
          </div>

          {topics.length > 1 && (
            <div className="-mx-1 mt-3 flex flex-wrap gap-1 text-[13px]">
              {[undefined, ...topics.map(([t]) => t)].map((t) => (
                <button
                  key={t ?? "all"}
                  type="button"
                  onClick={() => setTopic(t)}
                  aria-pressed={t === topic}
                  className={`rounded-full px-2.5 py-1 transition-colors ${t === topic ? "bg-moon/12 text-moon" : "text-dust/55 hover:bg-moon/5 hover:text-moon"}`}
                >
                  {t ? TOPIC_LABEL[t] : "All"}
                </button>
              ))}
            </div>
          )}
        </div>

        {stories.length === 0 ? (
          <div className="px-5 py-10 text-sm leading-relaxed text-dust/55 sm:px-6">
            No headlines in this window yet. Headlines are collected every hour; the next collection
            is at {hhmm(nextCollection(file.generatedAt))}.
            {win !== "24h" && (
              <button
                type="button"
                onClick={() => setWin("24h")}
                className="ml-1 text-moon underline decoration-moon/30 underline-offset-4"
              >
                Show 24 hours
              </button>
            )}
          </div>
        ) : (
          <ol ref={listRef} className="divide-y divide-moon/8 border-t border-moon/8">
            {stories.map((s) => {
              const first = lead(s);
              const others = s.outlets.filter((o) => o !== first?.outlet);
              const spot = blindSpot(s.outlets);
              const isOpen = open === s.cluster.id;
              return (
                <li key={s.cluster.id} data-id={s.cluster.id}>
                  <button
                    type="button"
                    onClick={() => choose(s.cluster.id)}
                    aria-expanded={isOpen}
                    className={`block w-full px-5 py-4 text-left transition-colors sm:px-6 ${isOpen ? "bg-moon/[0.04]" : "hover:bg-moon/[0.03]"}`}
                  >
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-dust/50">
                      {s.breaking && <span className="font-medium text-sodium">Breaking</span>}
                      <span>{TOPIC_LABEL[s.cluster.topic]}</span>
                      {s.cluster.place && <span>· {s.cluster.place.name}</span>}
                      <span>· {ago(s.headlines[0]?.t ?? file.generatedAt, now)}</span>
                    </span>
                    <span className="mt-1.5 block font-serif text-[1.15rem] leading-snug text-moon">
                      {s.cluster.title}
                    </span>
                    <span className="mt-1.5 block text-xs text-dust/45">
                      {first && <span className="text-dust/70">{name(first.outlet)}</span>}
                      {others.length > 0 && ` · also ${others.map(name).join(", ")}`}
                      {spot && <span> · only outlets based in {spot}</span>}
                      {(s.cluster.nowFilm || s.cluster.film) && (
                        <span className="font-medium text-sodium"> · Film</span>
                      )}
                    </span>
                  </button>
                  {isOpen &&
                    (s.cluster.context || s.cluster.film || s.cluster.nowFilm || s.cluster.why) && (
                      <div className="space-y-3 px-5 pb-4 sm:px-6">
                        {/* Why it is news, measured (ADR-0021). */}
                        {s.cluster.why && s.cluster.why.length > 0 && (
                          <p className="text-xs text-dust/55">
                            <span className="text-dust/75">Why it's here:</span>{" "}
                            {s.cluster.why.join(" · ")}
                          </p>
                        )}
                        {/* This hour's film first; an edition's earlier film of the story after it. */}
                        {s.cluster.nowFilm && (
                          <Link
                            href={`/now/film?id=${s.cluster.id}`}
                            className="inline-flex items-center gap-2 rounded-full bg-sodium px-4 py-1.5 text-sm font-medium text-[#1a1206] transition-colors hover:bg-[#ffc46e] active:scale-[0.98]"
                          >
                            Watch the film
                          </Link>
                        )}
                        {s.cluster.film && (
                          <Link
                            href={`/story/${s.cluster.film.date}/${s.cluster.film.slug}`}
                            className="group flex items-center gap-2 text-sm text-dust/70 hover:text-moon"
                          >
                            {s.cluster.nowFilm ? "Earlier on Earthlog" : "Watch Earthlog's film"}
                            <span className="truncate text-dust/50 group-hover:text-dust/70">
                              · {s.cluster.film.title}
                            </span>
                          </Link>
                        )}
                        {s.cluster.context && (
                          <div className="rounded-xl border border-moon/8 bg-moon/[0.03] p-3.5">
                            <p className="text-xs text-dust/45">
                              Background from{" "}
                              <a
                                href={s.cluster.context.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-dust/70 underline decoration-moon/20 underline-offset-4 hover:text-moon"
                              >
                                Wikipedia: {s.cluster.context.title}
                              </a>{" "}
                              · CC BY-SA
                            </p>
                            <p className="mt-1.5 text-sm leading-relaxed text-dust/75">
                              {s.cluster.context.text}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  {isOpen && (
                    <ul className="space-y-3 px-5 pb-5 sm:px-6">
                      {s.headlines.map((h) => (
                        <li key={h.id}>
                          <a
                            href={h.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group block text-sm"
                          >
                            <span className="text-xs text-dust/45">
                              {name(h.outlet)} · {hhmm(h.t)}
                            </span>
                            <span className="mt-0.5 flex items-start gap-1.5 leading-snug text-dust/80 group-hover:text-moon">
                              {h.title}
                              <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-dust/40" />
                            </span>
                          </a>
                        </li>
                      ))}
                      {s.cluster.place && (
                        <li className="text-xs text-dust/40">
                          Placed at {s.cluster.place.name} because the headlines name{" "}
                          {s.cluster.place.basis === "country" ? "the country" : "the place"}.
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <p className="px-5 py-6 text-xs leading-relaxed text-dust/40 sm:px-6">
          Headlines and links from{" "}
          {OUTLETS.map((o, k) => (
            <span key={o.id}>
              {k > 0 && (k === OUTLETS.length - 1 ? " and " : ", ")}
              <a href={o.homepage} target="_blank" rel="noreferrer" className="hover:text-moon">
                {o.name}
              </a>
            </span>
          ))}
          . Earthlog keeps only each headline, its link and its time, for three days.
        </p>
      </aside>

      <div className="relative order-1 min-h-0 lg:order-2">
        <div ref={globeEl} className="earthlog-globe absolute inset-0" />
        <div ref={credits} className="hidden" aria-hidden />
        <EarthControls
          live={live}
          layers={layers}
          setLayers={setLayers}
          onSurprise={onSurprise}
          canSurprise={filmed.length > 1}
        />
        {selection ? (
          <SelectionCard
            selection={selection}
            now={now}
            onClose={() => setSelection(undefined)}
            onStory={(id) => choose(id, true)}
          />
        ) : (
          <p className="pointer-events-none absolute bottom-3 left-4 hidden font-mono text-[11px] text-dust/45 sm:block">
            Click a country for its pulse
          </p>
        )}
        <LitCaption className="pointer-events-none absolute right-4 bottom-3 hidden text-right sm:block" />
      </div>
    </main>
  );
}
