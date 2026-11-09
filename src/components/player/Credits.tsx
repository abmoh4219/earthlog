"use client";

import { useState } from "react";
import { usePlayer } from "@/player/store";

/**
 * Attribution for everything on screen, in the bottom letterbox. We render it
 * ourselves (instead of Cesium's credit widget) so it is readable and always
 * names the exact imagery dates being shown.
 */
export function Credits() {
  const bundle = usePlayer((s) => s.bundle);
  const eventDay = usePlayer((s) => s.layers.eventDay);
  const [open, setOpen] = useState(false);
  if (!bundle) return null;
  const { imagery } = bundle.scene;
  const night = imagery.nights.at(-1);
  // Story films are fully lit (no time of day), so no night imagery is on screen.
  const story = bundle.scene.time === "story";
  const nightCredit = night
    ? `VIIRS night lights ${night}`
    : "Black Marble 2016 composite (a typical night, not this one)";
  const imageryCredit = [
    ...(eventDay ? [`NASA GIBS: VIIRS true colour ${imagery.day}`] : []),
    ...(story ? [] : [nightCredit]),
    story ? "NASA Blue Marble: shaded relief and bathymetry" : "Blue Marble",
  ].join(" · ");
  const dataCredit = [...new Set(bundle.sources.map((s) => s.attribution))].join(" · ");

  const text = (
    <>
      Imagery: {imageryCredit}
      {dataCredit && <> · Data: {dataCredit}</>} · Borders: Natural Earth · Globe: CesiumJS
    </>
  );
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex h-[9vh] items-end justify-center px-4 pb-2 sm:px-6">
      {/* Wide screens: the whole line. Phones: one line, the rest on a tap, so a long list of
          sources never runs over the controls above it. */}
      <p className="hidden max-w-5xl text-center font-mono text-[10px] leading-relaxed text-dust/40 sm:block">
        {text}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full text-center font-mono text-[10px] leading-relaxed text-dust/45 sm:hidden ${open ? "absolute inset-x-0 bottom-0 rounded-t-2xl bg-void/95 px-5 pt-4 pb-5" : "truncate"}`}
      >
        {open ? text : <>Sources and credits · {dataCredit || "NASA, Natural Earth"}</>}
      </button>
    </div>
  );
}
