"use client";

// "Where was it?" (ADR-0024): click the globe where each of yesterday's stories happened.
// Scores and the streak stay in the reader's browser (localStorage); nothing is sent.
import { ArrowRight, Check, Copy, Flame } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SITE_URL } from "@/config";
import type { FrontGlobe, GameMark } from "@/globe/front";
import { readStats, saveStats } from "@/lib/game-stats";
import {
  distanceKm,
  EMPTY_STATS,
  finish,
  type Round,
  type Stats,
  scoreFor,
  squares,
} from "@/scene/game";

const SODIUM = "#ffb547";
const GUESS = "#8fd3ff";

const day = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
const km = (n: number) => `${Math.round(n).toLocaleString("en-GB")} km`;

export function Game({ date, rounds }: { date: string; rounds: Round[] }) {
  const globeEl = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const globe = useRef<FrontGlobe | undefined>(undefined);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState<{ lon: number; lat: number }>();
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [distances, setDistances] = useState<number[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const round = rounds[i];
  // Done once the last answer has been seen ("See my score").
  const done = scores.length === rounds.length && i >= rounds.length;
  const already = loaded && stats.scores[date] !== undefined && scores.length === 0;

  useEffect(() => {
    setStats(readStats());
    setLoaded(true);
  }, []);

  // While guessing, a click on the ground moves the guess.
  const guessing = useRef(true);
  guessing.current = !revealed && !done;
  const onGround = useCallback((lon: number, lat: number) => {
    if (!guessing.current) return;
    setGuess({ lon, lat });
    globe.current?.setMarks([{ lon, lat, color: GUESS, label: "Your guess" }]);
  }, []);

  useEffect(() => {
    const el = globeEl.current;
    const cr = credits.current;
    if (!el || !cr) return;
    let cancelled = false;
    let made: FrontGlobe | undefined;
    import("@/globe/front")
      .then(({ createFrontGlobe }) =>
        createFrontGlobe(el, cr, [], () => {}, {
          zoom: true,
          borders: true,
          spin: false,
          onGround: (lon, lat) => onGround(lon, lat),
        }),
      )
      .then((g) => {
        if (cancelled) g.destroy();
        else {
          made = g;
          globe.current = g;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      made?.destroy();
      globe.current = undefined;
    };
  }, [onGround]);

  const confirm = () => {
    if (!round || !guess) return;
    const d = distanceKm(guess, round.answer);
    const sc = scoreFor(d);
    const answer: GameMark = { ...round.answer, color: SODIUM, label: round.answer.name };
    const mine: GameMark = { ...guess, color: GUESS, label: km(d) };
    globe.current?.setMarks([mine, answer], [mine, answer]);
    // Frame both: from the midpoint, far enough to see the pair.
    globe.current?.look(
      (guess.lon + round.answer.lon) / 2,
      (guess.lat + round.answer.lat) / 2,
      Math.min(2.2e7, Math.max(3e6, d * 2600)),
    );
    setDistances((x) => [...x, d]);
    setScores((x) => [...x, sc]);
    setRevealed(true);
    if (scores.length + 1 === rounds.length) {
      const total = [...scores, sc].reduce((a, b) => a + b, 0);
      const next = finish(readStats(), date, total);
      saveStats(next);
      setStats(next);
    }
  };

  const nextRound = () => {
    setI((n) => n + 1);
    setGuess(undefined);
    setRevealed(false);
    globe.current?.setMarks([]);
    globe.current?.focus(undefined);
  };

  const total = scores.reduce((a, b) => a + b, 0);
  const share = async () => {
    const text = `Earthlog · Where was it? ${day(date)}\n${squares(scores)} ${total.toLocaleString("en-GB")} / ${(rounds.length * 1000).toLocaleString("en-GB")}\n${SITE_URL}/play`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access: nothing to do.
    }
  };

  return (
    <main className="relative min-h-0 flex-1">
      {/* Phones: the globe above the card, so the whole planet stays in reach. */}
      <div
        ref={globeEl}
        className="earthlog-globe absolute inset-x-0 top-0 bottom-[40%] sm:inset-0"
      />
      <div ref={credits} className="hidden" aria-hidden />

      <section className="glass absolute inset-x-3 bottom-3 z-10 max-h-[55%] overflow-y-auto rounded-2xl px-5 py-4 sm:inset-x-auto sm:top-4 sm:bottom-auto sm:left-4 sm:w-[400px] sm:max-h-[calc(100%-2rem)]">
        <header className="flex items-center justify-between text-xs text-dust/55">
          <span>Where was it? · {day(date)}</span>
          {loaded && stats.streak > 0 && (
            <span className="flex items-center gap-1 text-sodium" title="Days in a row">
              <Flame size={13} aria-hidden /> {stats.streak}
            </span>
          )}
        </header>

        {already ? (
          <div className="mt-3">
            <h1 className="font-serif text-2xl text-moon">You played today.</h1>
            <p className="mt-2 text-sm text-dust/70">
              {(stats.scores[date] ?? 0).toLocaleString("en-GB")} points. A new game comes with each
              edition, every morning.
            </p>
            <p className="mt-2 text-xs text-dust/50">
              Streak {stats.streak} · best {stats.best.toLocaleString("en-GB")}
            </p>
            <Link href="/today" className="mt-4 inline-flex items-center gap-1 text-sm text-sodium">
              Watch the edition <ArrowRight size={14} />
            </Link>
          </div>
        ) : done ? (
          <div className="mt-3">
            <h1 className="font-serif text-2xl text-moon">
              {total.toLocaleString("en-GB")}{" "}
              <span className="text-dust/45">
                / {(rounds.length * 1000).toLocaleString("en-GB")}
              </span>
            </h1>
            <p className="mt-1 text-2xl tracking-widest">{squares(scores)}</p>
            <p className="mt-2 text-xs text-dust/55">
              Streak {stats.streak} · best {stats.best.toLocaleString("en-GB")} · a new game every
              morning
            </p>
            <ol className="mt-3 space-y-2 text-sm">
              {rounds.map((r, k) => (
                <li key={r.slug} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-dust/80">
                    {r.film ? (
                      <Link href={`/story/${date}/${r.slug}`} className="hover:text-moon">
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-dust/50 tabular-nums">
                    {km(distances[k] ?? 0)}
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={share}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sodium px-4 py-1.5 text-sm font-medium text-void hover:bg-[#ffc46e]"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy my result"}
            </button>
          </div>
        ) : round ? (
          <div className="mt-3">
            <p className="text-xs text-dust/50">
              Round {i + 1} of {rounds.length} · {round.kind}
            </p>
            <p className="mt-1.5 font-serif text-[1.2rem] leading-snug text-moon">{round.clue}</p>
            {!revealed ? (
              <>
                <p className="mt-3 text-xs text-dust/50">
                  {guess
                    ? "Tap again to move it, or confirm."
                    : "Tap the globe where it happened. Drag to turn it; pinch or scroll to zoom."}
                </p>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!guess}
                  className="mt-3 rounded-full bg-sodium px-4 py-1.5 text-sm font-medium text-void enabled:hover:bg-[#ffc46e] disabled:opacity-40"
                >
                  Confirm my guess
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-dust/80">
                  <span className="text-moon">{round.answer.name}</span>, {km(distances[i] ?? 0)}{" "}
                  from your guess ·{" "}
                  <span className="text-sodium">
                    {(scores[i] ?? 0).toLocaleString("en-GB")} points
                  </span>
                </p>
                <p className="mt-1 text-xs text-dust/55">
                  {round.film ? (
                    <Link href={`/story/${date}/${round.slug}`} className="hover:text-moon">
                      {round.title} · watch the film
                    </Link>
                  ) : (
                    round.title
                  )}
                </p>
                <button
                  type="button"
                  onClick={nextRound}
                  className="mt-3 inline-flex items-center gap-1 rounded-full border border-moon/18 px-4 py-1.5 text-sm text-moon hover:bg-moon/5"
                >
                  {i + 1 < rounds.length ? "Next story" : "See my score"} <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
