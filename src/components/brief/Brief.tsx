"use client";

// The morning brief (ADR-0025): yesterday in two minutes, to read or to hear.
import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Listen } from "@/components/brief/Listen";
import { readStats } from "@/lib/game-stats";
import { latestNow } from "@/lib/live-now";
import { type BriefStory, type briefOf, spokenBrief } from "@/scene/brief";
import type { NowStory } from "@/scene/now";
import { ago, storiesIn } from "@/scene/now";

const long = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const short = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

export function Brief({ brief }: { brief: ReturnType<typeof briefOf> }) {
  const [reading, setReading] = useState(-1);
  const [since, setSince] = useState<NowStory[]>([]);
  const [streak, setStreak] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = Date.now();
    setNow(t);
    setStreak(readStats().streak);
    latestNow().then((f) => {
      if (!f) return;
      // Since then: what the outlets reported after the edition's day ended.
      const end = Date.parse(`${brief.date}T23:59:59Z`);
      setSince(
        storiesIn(f, "24h", t)
          .filter((s) => Date.parse(s.cluster.first) > end)
          .slice(0, 4),
      );
    });
  }, [brief.date]);
  const lines = useMemo(() => spokenBrief(short(brief.date), brief.top), [brief]);

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-20 sm:px-8">
      <p className="text-sm text-dust/55">Morning brief · {long(brief.date)}</p>
      <h1 className="mt-2 font-serif text-4xl leading-[1.05] font-light tracking-[-0.02em] text-moon sm:text-6xl">
        Yesterday, in two minutes.
      </h1>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Listen lines={lines} onLine={setReading} />
        <Link
          href="/today"
          className="inline-flex items-center gap-1 rounded-full bg-sodium px-4 py-2 text-sm font-medium text-void hover:bg-[#ffc46e]"
        >
          Watch the edition <ArrowRight size={14} />
        </Link>
      </div>

      <ol className="mt-10 space-y-8">
        {brief.top.map((s, i) => (
          <Item key={s.slug} s={s} n={i + 1} active={reading === i + 1} />
        ))}
      </ol>

      {brief.more.length > 0 && (
        <section className="mt-12 border-t border-moon/8 pt-8">
          <h2 className="font-serif text-2xl text-moon">Also yesterday</h2>
          <ul className="mt-4 space-y-2 text-[15px]">
            {brief.more.map((s) => (
              <li key={s.slug} className="flex items-baseline gap-2">
                <span
                  className="size-1.5 shrink-0 translate-y-[-2px] rounded-full"
                  style={{ background: s.color }}
                />
                {s.film ? (
                  <Link
                    href={`/story/${s.date}/${s.slug}`}
                    className="text-dust/85 hover:text-moon"
                  >
                    {s.title}
                  </Link>
                ) : (
                  <span className="text-dust/70">{s.title}</span>
                )}
                {s.place && <span className="text-xs text-dust/40">{s.place}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {since.length > 0 && (
        <section className="mt-12 border-t border-moon/8 pt-8">
          <h2 className="font-serif text-2xl text-moon">Since then</h2>
          <p className="mt-1 text-sm text-dust/50">What the outlets have reported today.</p>
          <ul className="mt-4 space-y-3">
            {since.map((s) => (
              <li key={s.cluster.id}>
                <Link
                  href={`/now?story=${s.cluster.id}`}
                  className="font-serif text-lg text-moon hover:underline"
                >
                  {s.cluster.title}
                </Link>
                <p className="text-xs text-dust/45">
                  {s.outlets.length} outlet{s.outlets.length > 1 ? "s" : ""} ·{" "}
                  {now ? ago(s.headlines[0]?.t ?? s.cluster.last, now) : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-moon/10 bg-moon/[0.03] px-5 py-4">
        <div>
          <p className="font-serif text-xl text-moon">Where was it?</p>
          <p className="text-sm text-dust/55">
            Find yesterday&apos;s stories on the globe.
            {streak > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 text-sodium">
                <Flame size={13} aria-hidden /> {streak}
              </span>
            )}
          </p>
        </div>
        <Link href="/play" className="inline-flex items-center gap-1 text-sm text-sodium">
          Play today&apos;s game <ArrowRight size={14} />
        </Link>
      </section>
    </main>
  );
}

function Item({ s, n, active }: { s: BriefStory; n: number; active: boolean }) {
  return (
    <li className="flex gap-5" aria-current={active || undefined}>
      <span
        className={`w-6 shrink-0 pt-1 font-serif text-xl tabular-nums ${active ? "text-sodium" : "text-dust/35"}`}
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-dust/55">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.kind}
          </span>
          {s.place && <span className="text-dust/40">{s.place}</span>}
          {s.day && <span className="text-sodium">Day {s.day}</span>}
        </p>
        <h2
          className={`mt-1 font-serif text-[1.45rem] leading-snug ${active ? "text-sodium" : "text-moon"}`}
        >
          {s.title}
        </h2>
        {s.line && <p className="mt-1.5 leading-relaxed text-dust/70">{s.line}</p>}
        {s.why.length > 0 && (
          <p className="mt-1.5 text-xs text-dust/40">{s.why.slice(0, 2).join(" · ")}</p>
        )}
        {s.film && (
          <Link
            href={`/story/${s.date}/${s.slug}`}
            className="mt-2 inline-flex items-center gap-1 text-sm text-sodium hover:text-[#ffc46e]"
          >
            Watch the film <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </li>
  );
}
