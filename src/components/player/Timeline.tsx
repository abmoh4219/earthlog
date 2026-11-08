"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "@/player/store";
import { progress } from "@/scene/clock";
import { ms } from "@/scene/schema";

/**
 * Scrubber with narration markers. The playhead is moved with a rAF loop that
 * reads the store directly, so the bar is smooth without re-rendering React per frame.
 */
export function Timeline() {
  const bundle = usePlayer((s) => s.bundle);
  const window = usePlayer((s) => s.window);
  const seekTo = usePlayer((s) => s.seekTo);
  // Whole percent only: enough for assistive tech, cheap for React.
  const percent = usePlayer((s) => Math.round(progress(s.clock.t, s.window) * 100));
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const { clock, window: w } = usePlayer.getState();
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress(clock.t, w)})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seekFromPointer = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(window.start + u * (window.end - window.start));
  };

  const span = window.end - window.start;
  const markers = bundle?.scene.beats.map((b) => (ms(b.t) - window.start) / span) ?? [];
  const chapters =
    bundle?.scene.chapters.map((c) => ({ u: (ms(c.t) - window.start) / span, title: c.title })) ??
    [];

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label="Replay timeline"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="group relative h-6 flex-1 cursor-pointer touch-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromPointer(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && seekFromPointer(e.clientX)}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-0.75 -translate-y-1/2 overflow-hidden rounded-full bg-dust/15">
        <div
          ref={fillRef}
          className="h-full origin-left bg-linear-to-r from-dust/60 to-dust shadow-[0_0_12px_rgb(154_217_255/0.8)]"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
      {chapters.map((c) => (
        <button
          type="button"
          key={c.title + c.u}
          title={c.title}
          aria-label={`Chapter: ${c.title}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            seekTo(window.start + c.u * span + 1);
          }}
          className="absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dust/60 bg-void transition hover:scale-150 hover:bg-dust"
          style={{ left: `${c.u * 100}%` }}
        />
      ))}
      {markers.map((u, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: markers are positional and stable per scene
          key={i}
          className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-moon/70"
          style={{ left: `${u * 100}%` }}
        />
      ))}
    </div>
  );
}
