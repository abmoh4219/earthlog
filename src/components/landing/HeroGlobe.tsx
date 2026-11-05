"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FrontGlobe, FrontStory } from "@/globe/front";

/** The live globe in the landing hero: today's stories as columns of light; click to watch. */
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
          { zoom: false, hero: true },
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
        <span className="font-mono text-[11px] tracking-[0.35em] text-ice/50 uppercase">
          Loading the globe…
        </span>
      </div>
    </div>
  );
}
