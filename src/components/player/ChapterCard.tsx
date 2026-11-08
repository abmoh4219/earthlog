"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "@/player/store";
import { ms } from "@/scene/schema";

/**
 * A film-title card when a chapter begins: the chapter number and name, large and centred,
 * for about two seconds. Driven by the scene clock, so scrubbing shows the right card.
 */
export function ChapterCard() {
  const card = usePlayer((s) => {
    const chapters = s.bundle?.scene.chapters ?? [];
    const i = chapters.findLastIndex((c) => ms(c.t) <= s.clock.t);
    const c = chapters[i];
    if (!c || s.clock.t - ms(c.t) > 2200) return "";
    return `${i}|${c.title}`;
  });
  const [n, title] = card ? card.split("|") : [];

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] grid place-items-center">
      <AnimatePresence>
        {title && (
          <motion.div
            key={card}
            initial={{ opacity: 0, y: 18, filter: "blur(10px)", letterSpacing: "0.02em" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", letterSpacing: "-0.01em" }}
            exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-center [text-shadow:0_4px_40px_rgb(0_0_0/0.85)]"
          >
            <div className="font-medium text-xs text-dust/80">
              {String(Number(n) + 1).padStart(2, "0")}
            </div>
            <div className="mt-2 font-serif text-5xl font-light tracking-[-0.02em] text-moon md:text-7xl">
              {title}
            </div>
            <motion.div
              className="mx-auto mt-4 h-px bg-linear-to-r from-transparent via-dust/70 to-transparent"
              initial={{ width: 0 }}
              animate={{ width: 220 }}
              transition={{ delay: 0.25, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
