"use client";

import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "@/player/store";
import { activeBeatIndex } from "@/scene/beats";
import { categoryByKey } from "@/scene/news";
import type { NewsLayer } from "@/scene/schema";

/**
 * The full story behind a news caption: complete text (captions may be shortened), the
 * outlets it rests on, and an honest note that the digest records the date, not the time.
 */
export function StoryCard() {
  const bundle = usePlayer((s) => s.bundle);
  const index = usePlayer((s) =>
    s.bundle ? activeBeatIndex(s.clock.t, s.bundle.scene.beats) : -1,
  );
  const news = bundle?.layers.find((l): l is NewsLayer => l.kind === "news");
  const beat = bundle && index >= 0 ? bundle.scene.beats[index] : undefined;
  const story = news?.stories.find((s) => beat?.cites.includes(s.evidence));
  const evidence = story ? bundle?.evidence.find((e) => e.id === story.evidence) : undefined;
  const cat = story ? categoryByKey(story.category) : undefined;
  const day = news
    ? new Date(`${news.date}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  return (
    <AnimatePresence mode="wait">
      {story && cat && (
        <motion.article
          key={story.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="glass pointer-events-auto absolute top-[calc(9vh+8.5rem)] left-6 z-20 hidden w-[340px] rounded-2xl p-4 md:block"
          style={{ boxShadow: `inset 3px 0 0 ${cat.color}` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="font-medium rounded-md px-2 py-0.5 text-xs text-void"
              style={{ background: cat.color }}
            >
              {cat.label}
            </span>
            {story.place && (
              <span className="truncate text-xs text-moon/80">{story.place.name}</span>
            )}
          </div>
          {story.topic && <p className="mt-2 text-[11px] text-dust/55">{story.topic}</p>}
          <p className="mt-1.5 text-sm leading-relaxed text-moon">{story.text}</p>
          {evidence?.links && evidence.links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {evidence.links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-dust/20 bg-dust/5 px-2 py-0.5 text-[11px] text-dust transition hover:border-dust/50 hover:bg-dust/10"
                  >
                    {l.name}
                    <ExternalLink size={10} />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-dust/10 pt-2 font-mono text-[10px] leading-snug text-dust/45">
            {day} · time of day not recorded ·{" "}
            {evidence?.url ? (
              <a
                href={evidence.url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-dust"
              >
                Wikipedia, Current events
              </a>
            ) : (
              "Wikipedia, Current events"
            )}{" "}
            (CC BY-SA)
          </p>
        </motion.article>
      )}
    </AnimatePresence>
  );
}
