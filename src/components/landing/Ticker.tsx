"use client";

// The ticker (ADR-0023): the day's top stories from the outlets, breaking first, in one quiet
// line under the nav. Each opens on Now. It pauses under the pointer or keyboard focus, and
// stands still (scrollable) for visitors who prefer reduced motion. Refreshed with the hourly
// file while the page is open.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { latestNow } from "@/lib/live-now";
import type { NowFile } from "@/scene/headlines";
import { storiesIn } from "@/scene/now";
import { outletById } from "@/scene/outlets";

const REFRESH_MS = 10 * 60_000;

export function Ticker({ initial }: { initial: NowFile }) {
  const [file, setFile] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));
  useEffect(() => {
    const refresh = async () => {
      const next = await latestNow();
      if (next && next.generatedAt > file.generatedAt) setFile(next);
      setNow(Date.now());
    };
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [file.generatedAt]);
  const top = useMemo(() => storiesIn(file, "24h", now).slice(0, 10), [file, now]);
  if (top.length < 3) return null;
  const items = top.map((s) => (
    <Link
      key={s.cluster.id}
      href={`/now?story=${s.cluster.id}`}
      className="flex shrink-0 items-baseline gap-2 px-6 text-[13px] text-dust/70 hover:text-moon"
    >
      {s.breaking && <span className="text-[11px] font-medium text-sodium">Breaking</span>}
      <span>{s.cluster.title}</span>
      <span className="text-dust/40">{outletById(s.outlets[0] ?? "")?.name}</span>
    </Link>
  ));
  return (
    <section
      className="ticker group relative border-b border-moon/8 bg-night/60"
      aria-label="Top stories now"
    >
      <div className="flex items-center">
        <Link
          href="/now"
          className="z-10 shrink-0 border-r border-moon/8 bg-night px-4 py-2 text-[12px] font-medium text-sodium"
        >
          Now
        </Link>
        <div className="ticker-window min-w-0 flex-1 overflow-hidden py-2">
          <div className="ticker-track flex w-max">
            {items}
            {/* The second copy makes the loop seamless; hidden from assistive tech. */}
            <div className="flex" aria-hidden>
              {top.map((s) => (
                <span
                  key={s.cluster.id}
                  className="flex shrink-0 items-baseline gap-2 px-6 text-[13px] text-dust/70"
                >
                  {s.breaking && (
                    <span className="text-[11px] font-medium text-sodium">Breaking</span>
                  )}
                  <span>{s.cluster.title}</span>
                  <span className="text-dust/40">{outletById(s.outlets[0] ?? "")?.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
