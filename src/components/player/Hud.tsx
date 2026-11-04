"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePlayer } from "@/player/store";
import { clockText, dateText, zoneText } from "@/scene/format";
import type { Scene } from "@/scene/schema";
import { ms } from "@/scene/schema";

/** Title block (top left) and the big clock (top right); in story time, the chapter. */
export function Hud({ scene, back }: { scene: Scene; back?: { href: string; label: string } }) {
  return scene.time === "story" ? (
    <StoryHud scene={scene} back={back} />
  ) : (
    <ClockHud scene={scene} back={back} />
  );
}

function ClockHud({
  scene,
  back,
}: {
  scene: Scene;
  back: { href: string; label: string } | undefined;
}) {
  // Re-render once per scene second, not every frame.
  const second = usePlayer((s) => Math.floor(s.clock.t / 1000));
  const t = second * 1000;
  const tz = scene.timezone;
  // Honesty: when no real night pass exists, the night side is a composite. Say so on screen.
  const typicalNight = usePlayer((s) => s.layers.nightLights) && scene.imagery.nights.length === 0;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-6 md:p-8">
      <div className="max-w-xl">
        <Link
          href={back?.href ?? "/"}
          className="pointer-events-auto font-mono text-[11px] tracking-[0.45em] text-ice/80 uppercase hover:text-ice"
        >
          Earthlog{back ? ` · ${back.label}` : ""}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-frost md:text-4xl">
          {scene.title}
        </h1>
        <p className="mt-1.5 text-sm text-ice/70 md:text-base">{scene.subtitle}</p>
      </div>

      {second > 0 && (
        <div className="text-right font-mono tabular-nums">
          <div className="text-3xl font-light tracking-tight text-frost md:text-5xl">
            {clockText(t, tz)}
          </div>
          <div className="mt-1 text-xs tracking-[0.2em] text-ice/70 uppercase">
            {dateText(t, tz)} · {zoneText(t, tz)}
          </div>
          <div className="mt-0.5 text-[11px] tracking-[0.2em] text-ice/45 uppercase">
            {clockText(t, "UTC")} UTC
          </div>
          {typicalNight && (
            <div
              className="mt-3 inline-block rounded-md border border-energy/30 bg-energy/10 px-2 py-1 text-[10px] tracking-[0.15em] text-energy/90 uppercase"
              title="No satellite night pass covers this event, so night lights show a 2016 composite."
            >
              Night lights: a typical night, not this one
            </div>
          )}
        </div>
      )}
    </header>
  );
}

/**
 * Story time (ADR-0013): no clock, because explainers have no time of day. Instead the
 * chapter title, its number, and the edition's date.
 */
function StoryHud({
  scene,
  back,
}: {
  scene: Scene;
  back: { href: string; label: string } | undefined;
}) {
  const index = usePlayer((s) => {
    let i = 0;
    scene.chapters.forEach((c, k) => {
      if (ms(c.t) <= s.clock.t) i = k;
    });
    return i;
  });
  const chapter = scene.chapters[index];
  const day = new Date(scene.window.start).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-6 md:p-8">
      <div className="max-w-2xl">
        <Link
          href={back?.href ?? "/"}
          className="pointer-events-auto font-mono text-[11px] tracking-[0.45em] text-ice/80 uppercase hover:text-ice"
        >
          Earthlog{back ? ` · ${back.label}` : ""}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-frost md:text-4xl">
          {scene.title}
        </h1>
        <p className="mt-1.5 text-sm text-ice/70 md:text-base">{scene.subtitle}</p>
      </div>
      <div className="text-right">
        <div className="font-mono text-[11px] tracking-[0.3em] text-ice/55 uppercase tabular-nums">
          {String(index + 1).padStart(2, "0")} / {String(scene.chapters.length).padStart(2, "0")}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={chapter?.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45 }}
            className="mt-1 text-2xl font-light tracking-tight text-frost md:text-4xl"
          >
            {chapter?.title}
          </motion.div>
        </AnimatePresence>
        <div className="mt-1 text-xs tracking-[0.2em] text-ice/55 uppercase">{day}</div>
      </div>
    </header>
  );
}
