"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { GlobeEngine } from "@/globe/engine";
import { type SceneBundle, usePlayer } from "@/player/store";

export function GlobeView({ bundle }: { bundle: SceneBundle }) {
  const globeRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
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
      .then(({ createGlobe }) => createGlobe(el, credits, bundle, { reticle: reticleRef.current }))
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
      {bundle.scene.spotlight && <Reticle spotlight={bundle.scene.spotlight} ref={reticleRef} />}
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
            <div className="text-center font-mono text-xs tracking-[0.35em] text-dust/70 uppercase">
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

/**
 * Corner brackets and a coordinate readout that lock onto the story's focus point. The globe
 * engine moves it every frame (no React render per frame) and hides it behind the Earth.
 */
function Reticle({
  spotlight,
  ref,
}: {
  spotlight: NonNullable<SceneBundle["scene"]["spotlight"]>;
  ref: React.Ref<HTMLDivElement>;
}) {
  const lat = `${Math.abs(spotlight.lat).toFixed(2)}°${spotlight.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(spotlight.lon).toFixed(2)}°${spotlight.lon >= 0 ? "E" : "W"}`;
  const corner = "absolute size-3 border-[#5ef2ff]";
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-10 opacity-0 transition-opacity duration-500"
    >
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        <div className="reticle-spin relative size-16">
          <span className={`${corner} top-0 left-0 border-t-2 border-l-2`} />
          <span className={`${corner} top-0 right-0 border-t-2 border-r-2`} />
          <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
          <span className={`${corner} right-0 bottom-0 border-r-2 border-b-2`} />
        </div>
        <span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5ef2ff] shadow-[0_0_10px_#5ef2ff]" />
        <div className="absolute top-1/2 left-[calc(100%+10px)] -translate-y-1/2 font-mono text-[10px] leading-tight whitespace-nowrap text-[#5ef2ff] [text-shadow:0_0_8px_rgb(0_0_0/0.9)]">
          <div className="tracking-[0.2em] uppercase">{spotlight.label}</div>
          <div className="text-[#5ef2ff]/70">
            {lat} {lon}
          </div>
        </div>
      </div>
    </div>
  );
}
