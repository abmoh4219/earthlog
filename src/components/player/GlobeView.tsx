"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { GlobeEngine } from "@/globe/engine";
import { type SceneBundle, usePlayer } from "@/player/store";

export function GlobeView({ bundle }: { bundle: SceneBundle }) {
  const globeRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const ready = usePlayer((s) => s.globeReady);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = globeRef.current;
    const credits = creditsRef.current;
    if (!el || !credits) return;
    let engine: GlobeEngine | undefined;
    let cancelled = false;
    // Cesium is heavy: load it only in the browser, after first paint.
    import("@/globe/engine")
      .then(({ createGlobe }) => createGlobe(el, credits, bundle))
      .then((e) => {
        // React dev mode mounts twice: the first globe resolves after its cleanup ran.
        // Only the globe we keep may flip "ready", or a discarded one would hide it.
        if (cancelled) e.destroy();
        else {
          engine = e;
          usePlayer.getState().setGlobeReady(true);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      engine?.destroy();
      usePlayer.getState().setGlobeReady(false);
    };
  }, [bundle]);

  return (
    <>
      <div ref={globeRef} className="earthlog-globe absolute inset-0" />
      {/* Cesium insists on a credit container; we show our own Credits instead. */}
      <div ref={creditsRef} className="hidden" aria-hidden />
      <AnimatePresence>
        {!ready && (
          <motion.div
            key="loading"
            className="absolute inset-0 z-20 grid place-items-center bg-void"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.2, ease: "easeOut" } }}
          >
            <div className="text-center font-mono text-xs tracking-[0.35em] text-ice/70 uppercase">
              {error ? (
                <span className="text-loss">Globe failed to start: {error}</span>
              ) : (
                <motion.span
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
                >
                  Acquiring satellite imagery
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
