"use client";

import { useEffect } from "react";
import { usePlayer } from "@/player/store";

/** Keyboard controls; the full list lives in Help.tsx (SHORTCUTS) and is shown with "?". */
export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = usePlayer.getState();
      const step = (s.window.end - s.window.start) / 100;
      if (s.help && (e.key === "Escape" || e.key === "?")) {
        s.setHelp(false);
        return;
      }
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
        case "?":
          s.setHelp(true);
          break;
        default:
          switch (e.key.toLowerCase()) {
            case "c":
              s.toggleCinema();
              break;
            case "r":
              s.setDirector(true);
              break;
            case "a":
              s.setAuto();
              break;
            case "d":
              s.togglePanel();
              break;
            case "l":
              s.toggleLayer("labels");
              break;
            case "s":
              s.toggleLayer("eventDay");
              break;
            case "n":
              s.toggleLayer("nightLights");
              break;
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
