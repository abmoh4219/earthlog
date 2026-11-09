"use client";

import { useEffect } from "react";
import { recordVisit } from "@/lib/library";
import { type SceneBundle, usePlayer } from "@/player/store";
import type { FollowTarget } from "@/scene/follow";
import { Captions } from "./Captions";
import { ChapterCard } from "./ChapterCard";
import { Credits } from "./Credits";
import { DataPanel } from "./DataPanel";
import { GlobeView } from "./GlobeView";
import { Help } from "./Help";
import { Hud } from "./Hud";
import { Legend } from "./Legend";
import { Letterbox } from "./Letterbox";
import { Panels } from "./Panels";
import { StoryCard } from "./StoryCard";
import { Transport } from "./Transport";
import { useKeyboard } from "./useKeyboard";
import { Vignette } from "./Vignette";

export function Player({
  bundle,
  back,
  follow,
}: {
  bundle: SceneBundle;
  back?: { href: string; label: string };
  /** The story, to follow it (ADR-0024). */
  follow?: FollowTarget;
}) {
  const load = usePlayer((s) => s.load);
  const loaded = usePlayer((s) => s.bundle?.scene.id === bundle.scene.id);

  // The reader's history: films they watched, in their browser only (ADR-0024).
  useEffect(() => {
    recordVisit(window.location.pathname + window.location.search, bundle.scene.title);
  }, [bundle.scene.title]);

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
      {loaded && <GlobeView bundle={bundle} />}
      <Vignette />
      <Letterbox />
      <Hud scene={bundle.scene} {...(back ? { back } : {})} {...(follow ? { follow } : {})} />
      <DataPanel />
      <Panels />
      <Legend />
      <StoryCard />
      <ChapterCard />
      <Captions />
      <Transport />
      <Credits />
      <Help />
    </main>
  );
}
