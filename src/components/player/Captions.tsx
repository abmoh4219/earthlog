"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "@/player/store";
import { activeBeatIndex } from "@/scene/beats";

const MAX_CHIPS = 3;
const CHIP =
  // A footnote, not a badge: small and quiet, brighter on hover where the source shows.
  "pointer-events-auto ml-1 cursor-help text-[0.5em] font-medium text-dust/60 tabular-nums transition hover:text-dust";

/** Narration captions. Every beat carries numbered citation chips (Phase 3 opens the evidence drawer). */
export function Captions() {
  const bundle = usePlayer((s) => s.bundle);
  const index = usePlayer((s) =>
    s.bundle ? activeBeatIndex(s.clock.t, s.bundle.scene.beats) : -1,
  );
  const beat = bundle && index >= 0 ? bundle.scene.beats[index] : undefined;
  const evidenceById = new Map(bundle?.evidence.map((e) => [e.id, e]));
  // Chips are numbered within the sentence; long lists collapse to "+n" (all stay in the tooltip).
  const shown = beat?.cites.slice(0, MAX_CHIPS) ?? [];
  const hidden = beat?.cites.slice(MAX_CHIPS) ?? [];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(9vh+7.5rem)] z-20 flex justify-center px-6">
      <AnimatePresence mode="wait">
        {beat && (
          <motion.p
            key={index}
            className="max-w-3xl text-center text-lg leading-snug font-medium text-moon [text-shadow:0_2px_18px_rgb(0_0_0/0.9)] md:text-2xl"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {beat.text}
            {shown.map((id, i) => (
              <sup key={id} title={evidenceById.get(id)?.label ?? id} className={CHIP}>
                {i + 1}
              </sup>
            ))}
            {hidden.length > 0 && (
              <sup
                title={hidden.map((id) => evidenceById.get(id)?.label ?? id).join("\n")}
                className={CHIP}
              >
                +{hidden.length}
              </sup>
            )}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
