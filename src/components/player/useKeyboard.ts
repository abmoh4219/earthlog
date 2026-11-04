"use client";

import { useEffect } from "react";
import { usePlayer } from "@/player/store";

/** Space play/pause · ←/→ seek 1% · C cinema · R resume director · A auto pacing. */
export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = usePlayer.getState();
      const step = (s.window.end - s.window.start) / 100;
      switch (e.key) {
        case " ":
          e.preventDefault();
          s.togglePlay();
          break;
        case "ArrowRight":
          s.seekBy(step);
          break;
        case "ArrowLeft":
          s.seekBy(-step);
          break;
        case "c":
        case "C":
          s.toggleCinema();
          break;
        case "r":
        case "R":
          s.setDirector(true);
          break;
        case "a":
        case "A":
          s.setAuto();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
