"use client";

import { useEffect } from "react";
import { type SceneBundle, usePlayer } from "@/player/store";
import { Captions } from "./Captions";
import { Credits } from "./Credits";
import { GlobeView } from "./GlobeView";
import { Hud } from "./Hud";
import { Letterbox } from "./Letterbox";
import { Transport } from "./Transport";
import { useKeyboard } from "./useKeyboard";
import { Vignette } from "./Vignette";

export function Player({ bundle }: { bundle: SceneBundle }) {
  const load = usePlayer((s) => s.load);
  const loaded = usePlayer((s) => s.bundle?.scene.id === bundle.scene.id);

  useEffect(() => {
    load(bundle);
    // Share links: ?t=<ISO time> opens at that moment, ?play starts playing.
    const params = new URLSearchParams(window.location.search);
    const t = Date.parse(params.get("t") ?? "");
    const state = usePlayer.getState();
    if (Number.isFinite(t)) state.seekTo(t);
    if (params.has("play")) state.togglePlay();
  }, [bundle, load]);

  useKeyboard();

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-void select-none">
      {loaded && <GlobeView scene={bundle.scene} />}
      <Vignette />
      <Letterbox />
      <Hud scene={bundle.scene} />
      <Captions />
      <Transport />
      <Credits />
    </main>
  );
}
