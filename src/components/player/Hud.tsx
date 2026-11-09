"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { FollowButton } from "@/components/FollowButton";
import { usePlayer } from "@/player/store";
import type { FollowTarget } from "@/scene/follow";
import { clockText, dateText, zoneText } from "@/scene/format";
import type { Scene } from "@/scene/schema";
import { ms } from "@/scene/schema";

/** Title block (top left) and the big clock (top right); in story time, the chapter. */
export function Hud({
  scene,
  back,
  follow,
}: {
  scene: Scene;
  back?: { href: string; label: string; external?: boolean };
  follow?: FollowTarget;
}) {
  return scene.time === "story" ? (
    <StoryHud scene={scene} back={back} follow={follow} />
  ) : (
    <ClockHud scene={scene} back={back} />
  );
}

function ClockHud({
  scene,
  back,
}: {
  scene: Scene;
  back: { href: string; label: string; external?: boolean } | undefined;
}) {
  // Re-render once per scene second, not every frame.
  const second = usePlayer((s) => Math.floor(s.clock.t / 1000));
  const t = second * 1000;
  const tz = scene.timezone;
  // Honesty: when no real night pass exists, the night side is a composite. Say so on screen.
  const typicalNight = usePlayer((s) => s.layers.nightLights) && scene.imagery.nights.length === 0;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6 md:p-8">
      <div className="max-w-xl">
        <Link
          href={back?.href ?? "/"}
          className="font-medium pointer-events-auto text-xs text-dust/80 hover:text-dust"
        >
          Earthlog{back ? ` · ${back.label}` : ""}
        </Link>
        <h1 className="mt-2 line-clamp-2 font-serif text-xl leading-tight font-normal tracking-[-0.015em] text-moon sm:mt-3 sm:text-2xl md:text-4xl">
          {scene.title}
        </h1>
        <p className="mt-1.5 text-sm text-dust/70 md:text-base">{scene.subtitle}</p>
        {/* Results and reports fill in for days: say when this film read its sources. */}
        <p className="font-medium mt-1 text-xs text-dust/45">
          Data as of {asOf(scene.generatedBy.at)}
        </p>
      </div>

      {second > 0 && (
        <div className="text-right font-mono tabular-nums">
          <div className="font-serif text-3xl font-light tracking-[-0.02em] text-moon md:text-5xl">
            {clockText(t, tz)}
          </div>
          <div className="font-medium mt-1 text-xs text-dust/70">
            {dateText(t, tz)} · {zoneText(t, tz)}
          </div>
          <div className="font-medium mt-0.5 text-xs text-dust/45">{clockText(t, "UTC")} UTC</div>
          {typicalNight && (
            <div
              className="font-medium mt-3 inline-block rounded-md border border-energy/30 bg-energy/10 px-2 py-1 text-xs text-energy/90"
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
/** "4 Nov 2026, 19:35 UTC" */
function asOf(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${day}, ${iso.slice(11, 16)} UTC`;
}

function StoryHud({
  scene,
  back,
  follow,
}: {
  scene: Scene;
  back: { href: string; label: string; external?: boolean } | undefined;
  follow: FollowTarget | undefined;
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
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl">
        {back?.external ? (
          // Embedded on another site: the way to Earthlog opens a new tab.
          <a
            href={back.href}
            target="_blank"
            rel="noreferrer"
            className="font-medium pointer-events-auto text-xs text-dust/80 hover:text-dust"
          >
            Earthlog · {back.label} ↗
          </a>
        ) : (
          <Link
            href={back?.href ?? "/"}
            className="font-medium pointer-events-auto text-xs text-dust/80 hover:text-dust"
          >
            Earthlog{back ? ` · ${back.label}` : ""}
          </Link>
        )}
        <h1 className="mt-2 line-clamp-2 font-serif text-xl leading-tight font-normal tracking-[-0.015em] text-moon sm:mt-3 sm:text-2xl md:text-4xl">
          {scene.title}
        </h1>
        <p className="mt-1.5 text-sm text-dust/70 md:text-base">{scene.subtitle}</p>
        {/* Results and reports fill in for days: say when this film read its sources. */}
        <p className="font-medium mt-1 text-xs text-dust/45">
          Data as of {asOf(scene.generatedBy.at)}
        </p>
        {follow && <FollowButton target={follow} className="pointer-events-auto mt-2" />}
        {/* CLAUDE.md §3.3: AI narration is always labelled. */}
        {scene.generatedBy.method === "claude" && (
          <p className="mt-1 text-[11px] text-dust/55">
            AI-written narration, every sentence checked against cited data
          </p>
        )}
      </div>
      {/* Phones: the chapter card announces each chapter; this column would crowd the title. */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="font-mono text-xs text-dust/55 tabular-nums">
          {String(index + 1).padStart(2, "0")} / {String(scene.chapters.length).padStart(2, "0")}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={chapter?.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45 }}
            className="mt-1 font-serif text-2xl font-light tracking-[-0.02em] text-moon md:text-4xl"
          >
            {chapter?.title}
          </motion.div>
        </AnimatePresence>
        <div className="font-medium mt-1 text-xs text-dust/55">{day}</div>
      </div>
    </header>
  );
}
