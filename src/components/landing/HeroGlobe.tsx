"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FrontGlobe, FrontStory } from "@/globe/front";

/**
 * The live globe in the landing hero: the planet as it is lit right now (real sun, city lights
 * on the night side), today's stories as amber points; click one to watch its film.
 */
export function HeroGlobe({ date, stories }: { date: string; stories: FrontStory[] }) {
  const globeRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = globeRef.current;
    const credits = creditsRef.current;
    if (!el || !credits) return;
    let cancelled = false;
    let made: FrontGlobe | undefined;
    import("@/globe/front")
      .then(({ createFrontGlobe }) =>
        createFrontGlobe(
          el,
          credits,
          stories,
          (slug) => routerRef.current.push(`/story/${date}/${slug}`),
          { zoom: false, hero: true, night: true },
        ),
      )
      .then((g) => {
        if (cancelled) g.destroy();
        else {
          made = g;
          setReady(true);
        }
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
      made?.destroy();
    };
  }, [date, stories]);

  return (
    <div className="relative size-full">
      <div ref={globeRef} className="earthlog-globe absolute inset-0" />
      <div ref={creditsRef} className="hidden" aria-hidden />
      <div
        className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-1000 ${ready ? "opacity-0" : "opacity-100"}`}
      >
        <span className="text-xs text-dust/50">Loading the globe…</span>
      </div>
    </div>
  );
}

/**
 * What the hero globe shows, said plainly: lit for the visitor's moment, and city lights from a
 * multi-year composite, not last night's. Rendered after mount: the server can't know the moment.
 */
export function LitCaption({ className = "" }: { className?: string }) {
  const [at, setAt] = useState<string>();
  useEffect(() => setAt(new Date().toISOString().slice(11, 16)), []);
  return (
    <p className={`font-mono text-[11px] leading-5 text-dust/45 ${className}`}>
      {at ? `Lit as of ${at} UTC` : "Lit by the sun right now"} · city lights: NASA Black Marble,
      2016 composite
    </p>
  );
}
