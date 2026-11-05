"use client";

import {
  Activity,
  Clapperboard,
  Keyboard,
  Moon,
  Pause,
  Play,
  Satellite,
  Tags,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { usePlayer } from "@/player/store";
import { effectiveSpeed } from "@/scene/clock";
import { speedText } from "@/scene/format";
import { ClipButton } from "./ClipButton";
import { ShareButton } from "./ShareButton";
import { Timeline } from "./Timeline";

const SPEEDS = [60, 600, 3600] as const;

function Toggle({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-lg border transition",
        on
          ? "border-ice/40 bg-ice/15 text-ice shadow-[0_0_14px_rgb(154_217_255/0.25)]"
          : "border-transparent text-ice/45 hover:text-ice/80",
      )}
    >
      {children}
    </button>
  );
}

/** Bottom control bar: play, scrubber, speed, camera and layer toggles. */
export function Transport() {
  const playing = usePlayer((s) => s.clock.playing);
  const auto = usePlayer((s) => s.clock.auto);
  const manualSpeed = usePlayer((s) => s.clock.speed);
  const speed = usePlayer((s) => (s.bundle ? effectiveSpeed(s.clock, s.bundle.scene.pacing) : 1));
  const director = usePlayer((s) => s.director);
  const cinema = usePlayer((s) => s.cinema);
  const layers = usePlayer((s) => s.layers);
  const panel = usePlayer((s) => s.panel);
  // Story films run in real seconds: no speed controls, no time of day.
  const story = usePlayer((s) => s.bundle?.scene.time === "story");
  const a = usePlayer.getState();

  return (
    <div className="absolute inset-x-0 bottom-[calc(9vh+1rem)] z-30 flex justify-center px-4">
      <div className="glass flex w-full max-w-4xl items-center gap-3 rounded-2xl px-3 py-2">
        <button
          type="button"
          onClick={a.togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-ice text-void transition hover:bg-frost"
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>

        <Timeline />

        <div
          className={cn(
            "flex shrink-0 items-center gap-1 font-mono text-[11px]",
            story && "hidden",
          )}
        >
          <button
            type="button"
            onClick={a.setAuto}
            className={cn(
              "rounded-md px-2 py-1 tracking-wider uppercase transition",
              auto ? "bg-ice/15 text-ice" : "text-ice/50 hover:text-ice/80",
            )}
            title="Follow the director's pacing"
          >
            Auto
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => a.setSpeed(s)}
              className={cn(
                "rounded-md px-2 py-1 transition",
                !auto && manualSpeed === s ? "bg-ice/15 text-ice" : "text-ice/50 hover:text-ice/80",
              )}
            >
              {speedText(s)}
            </button>
          ))}
          <span className="w-20 text-right whitespace-nowrap text-ice/40 tabular-nums">
            {speedText(speed)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-l border-ice/10 pl-2">
          <ShareButton />
          {story && <ClipButton />}
          <Toggle
            on={director}
            onClick={() => a.setDirector(!director)}
            label="Director camera (R)"
          >
            <Video size={16} />
          </Toggle>
          <Toggle on={cinema} onClick={a.toggleCinema} label="Cinema mode (C)">
            <Clapperboard size={16} />
          </Toggle>
          <Toggle
            on={layers.eventDay}
            onClick={() => a.toggleLayer("eventDay")}
            label="Satellite image of the event day (S)"
          >
            <Satellite size={16} />
          </Toggle>
          <Toggle
            on={layers.nightLights}
            onClick={() => a.toggleLayer("nightLights")}
            label="Night lights (N)"
          >
            <Moon size={16} />
          </Toggle>
          <Toggle
            on={layers.labels}
            onClick={() => a.toggleLayer("labels")}
            label="Country names (L)"
          >
            <Tags size={16} />
          </Toggle>
          <Toggle on={panel} onClick={a.togglePanel} label="Live data panel (D)">
            <Activity size={16} />
          </Toggle>
          <Toggle on={false} onClick={() => a.setHelp(true)} label="Keyboard shortcuts (?)">
            <Keyboard size={16} />
          </Toggle>
        </div>
      </div>
    </div>
  );
}
