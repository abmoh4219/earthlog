"use client";

import { usePlayer } from "@/player/store";

/**
 * Attribution for everything on screen, in the bottom letterbox. We render it
 * ourselves (instead of Cesium's credit widget) so it is readable and always
 * names the exact imagery dates being shown.
 */
export function Credits() {
  const bundle = usePlayer((s) => s.bundle);
  if (!bundle) return null;
  const { imagery } = bundle.scene;
  const night = imagery.nights.at(-1);
  // Story films are fully lit (no time of day), so no night imagery is on screen.
  const story = bundle.scene.time === "story";
  const nightCredit = night
    ? `VIIRS night lights ${night}`
    : "Black Marble 2016 composite (a typical night, not this one)";
  const imageryCredit = [
    `NASA GIBS: VIIRS true colour ${imagery.day}`,
    ...(story ? [] : [nightCredit]),
    "Blue Marble",
  ].join(" · ");
  const dataCredit = bundle.sources.map((s) => s.attribution).join(" · ");

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex h-[9vh] items-end justify-center px-6 pb-2">
      <p className="max-w-5xl text-center font-mono text-[10px] leading-relaxed text-ice/40">
        Imagery: {imageryCredit}
        {dataCredit && <> · Data: {dataCredit}</>} · Borders: Natural Earth · Globe: CesiumJS
      </p>
    </div>
  );
}
