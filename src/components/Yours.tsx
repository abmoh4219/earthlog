"use client";

// "Yours" (ADR-0024): what the reader follows and has done, all from their own browser.
import { ArrowRight, Flame, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForYou } from "@/lib/for-you";
import { readStats } from "@/lib/game-stats";
import { loadItems } from "@/lib/items";
import { clearHistory, useFollows, useHistory } from "@/lib/library";
import { updatesFor } from "@/scene/follow";
import { EMPTY_STATS, type Stats } from "@/scene/game";
import { ago } from "@/scene/now";
import type { SearchItem } from "@/scene/search";
import { TOPIC_LABEL } from "@/scene/topics";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-moon/8 py-8">
    <h2 className="font-serif text-2xl text-moon">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

export function Yours() {
  const { follows, toggle } = useFollows();
  const history = useHistory();
  const [prefs] = useForYou();
  const [items, setItems] = useState<SearchItem[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [now, setNow] = useState(0);
  useEffect(() => {
    loadItems().then(setItems);
    setStats(readStats());
    setNow(Date.now());
  }, []);
  const updates = useMemo(() => updatesFor(follows, items), [follows, items]);
  const followed = [...prefs.topics.map((t) => TOPIC_LABEL[t]), ...prefs.regions];

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-20 sm:px-8">
      <h1 className="font-serif text-4xl font-light tracking-[-0.02em] text-moon sm:text-5xl">
        Yours
      </h1>
      <p className="mt-3 text-sm text-dust/60">
        Kept in this browser only: nothing is sent anywhere, and there is no account.
      </p>

      <Section title="Following">
        {follows.length === 0 ? (
          <p className="text-sm text-dust/55">
            Follow a story from its film or from Now, and later stories about it appear here.
          </p>
        ) : (
          <ul className="space-y-5">
            {follows.map((f) => {
              const news = updates.get(f.key) ?? [];
              return (
                <li key={f.key}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={f.href} className="font-serif text-lg text-moon hover:underline">
                        {f.title}
                      </Link>
                      <p className="text-xs text-dust/45">
                        Followed {now ? ago(f.at, now) : ""}
                        {news.length > 0 && (
                          <span className="text-sodium">
                            {" "}
                            · {news.length} update{news.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(f)}
                      aria-label={`Stop following ${f.title}`}
                      className="rounded-full p-1 text-dust/45 hover:bg-moon/8 hover:text-moon"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {news.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l border-sodium/40 pl-3 text-sm">
                      {news.slice(0, 4).map((u) => (
                        <li key={u.href}>
                          <Link href={u.href} className="text-dust/85 hover:text-moon">
                            {u.title}
                          </Link>
                          <span className="text-xs text-dust/45"> · {u.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Where was it?">
        {Object.keys(stats.scores).length === 0 ? (
          <p className="text-sm text-dust/55">
            Find five of yesterday&apos;s stories on the globe. A new game every morning.
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dust/75">
            <span className="flex items-center gap-1 text-sodium">
              <Flame size={14} aria-hidden /> {stats.streak} day{stats.streak === 1 ? "" : "s"} in a
              row
            </span>
            <span>Best {stats.best.toLocaleString("en-GB")}</span>
            <span>{Object.keys(stats.scores).length} games played</span>
          </p>
        )}
        <Link href="/play" className="mt-3 inline-flex items-center gap-1 text-sm text-sodium">
          Play today&apos;s game <ArrowRight size={14} />
        </Link>
      </Section>

      <Section title="For you">
        <p className="text-sm text-dust/65">
          {followed.length
            ? `You follow ${followed.join(", ")}.`
            : "You don't follow any topics or regions yet."}{" "}
          <Link
            href="/now"
            className="text-dust/85 underline decoration-moon/30 underline-offset-4"
          >
            Choose on Now
          </Link>
        </p>
      </Section>

      <Section title="Recently watched">
        {history.length === 0 ? (
          <p className="text-sm text-dust/55">The films you watch are listed here.</p>
        ) : (
          <>
            <ul className="space-y-1.5 text-sm">
              {history.slice(0, 15).map((v) => (
                <li key={v.href} className="flex items-baseline justify-between gap-3">
                  <Link href={v.href} className="min-w-0 truncate text-dust/85 hover:text-moon">
                    {v.title}
                  </Link>
                  <span className="shrink-0 text-xs text-dust/40">{now ? ago(v.at, now) : ""}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={clearHistory}
              className="mt-3 text-xs text-dust/50 underline decoration-moon/20 underline-offset-4 hover:text-moon"
            >
              Clear the list
            </button>
          </>
        )}
      </Section>
    </main>
  );
}
