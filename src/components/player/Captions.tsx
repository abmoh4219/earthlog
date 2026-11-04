"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "@/player/store";
import { activeBeatIndex } from "@/scene/beats";

/** Narration captions. Every beat carries numbered citation chips (Phase 3 opens the evidence drawer). */
export function Captions() {
  const bundle = usePlayer((s) => s.bundle);
  const index = usePlayer((s) =>
    s.bundle ? activeBeatIndex(s.clock.t, s.bundle.scene.beats) : -1,
  );
  const beat = bundle && index >= 0 ? bundle.scene.beats[index] : undefined;
  const evidenceOrder = new Map(bundle?.evidence.map((e, i) => [e.id, i + 1]));
  const evidenceById = new Map(bundle?.evidence.map((e) => [e.id, e]));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(9vh+7.5rem)] z-20 flex justify-center px-6">
      <AnimatePresence mode="wait">
        {beat && (
          <motion.p
            key={index}
            className="max-w-3xl text-center text-lg leading-snug font-medium text-frost [text-shadow:0_2px_18px_rgb(0_0_0/0.9)] md:text-2xl"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {beat.text}
            {beat.cites.map((id) => (
              <sup
                key={id}
                title={evidenceById.get(id)?.label ?? id}
                className="pointer-events-auto ml-1 cursor-help rounded border border-ice/30 bg-ice/10 px-1 font-mono text-[0.55em] text-ice"
              >
                {evidenceOrder.get(id) ?? "?"}
              </sup>
            ))}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
