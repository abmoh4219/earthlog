"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "@/player/store";
import { ms } from "@/scene/schema";

/** The key to whichever coloured map is on the globe right now (e.g. party colours). */
export function Legend() {
  const bundle = usePlayer((s) => s.bundle);
  const visible = usePlayer((s) => {
    const refs = s.bundle?.scene.layers ?? [];
    let found = -1;
    refs.forEach((r, i) => {
      if (r.kind !== "regions") return;
      const from = r.from ? ms(r.from) : Number.NEGATIVE_INFINITY;
      const until = r.until ? ms(r.until) : Number.POSITIVE_INFINITY;
      if (s.clock.t >= from && s.clock.t < until) found = i;
    });
    return found;
  });
  const layer = visible >= 0 ? bundle?.layers[visible] : undefined;
  const legend = layer?.kind === "regions" ? layer.legend : [];

  return (
    <AnimatePresence>
      {legend.length > 0 && (
        <motion.ul
          key={visible}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="glass pointer-events-none absolute bottom-[calc(9vh+5.5rem)] left-6 z-20 hidden space-y-1.5 rounded-xl px-3 py-2.5 md:block"
        >
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-[11px] text-moon/85">
              <span className="size-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}
