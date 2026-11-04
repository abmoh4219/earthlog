"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "@/player/store";

/** One list drives both the sheet and useKeyboard's documentation. */
export const SHORTCUTS: [keys: string[], action: string][] = [
  [["Space"], "Play / pause"],
  [["←", "→"], "Jump back / forward"],
  [["A"], "Auto pacing: the director slows down at key moments"],
  [["Drag", "Scroll"], "Fly the camera yourself"],
  [["R"], "Give the camera back to the director"],
  [["D"], "Show / hide the live data panel"],
  [["L"], "Show / hide country names"],
  [["S"], "Satellite image of the event day"],
  [["N"], "Night lights"],
  [["C"], "Cinema mode (letterbox)"],
  [["?"], "This sheet"],
];

export function Help() {
  const open = usePlayer((s) => s.help);
  const setHelp = usePlayer((s) => s.setHelp);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="help"
          className="absolute inset-0 z-50 grid place-items-center bg-void/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setHelp(false)}
        >
          <motion.div
            role="dialog"
            aria-label="Keyboard shortcuts"
            className="glass w-[min(92vw,440px)] rounded-2xl p-6"
            initial={{ y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-mono text-[11px] tracking-[0.35em] text-ice/70 uppercase">
              Controls
            </h2>
            <ul className="mt-4 space-y-2.5">
              {SHORTCUTS.map(([keys, action]) => (
                <li key={action} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-frost/85">{action}</span>
                  <span className="flex shrink-0 gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="min-w-7 rounded-md border border-ice/25 bg-ice/10 px-1.5 py-0.5 text-center font-mono text-[11px] text-ice"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-ice/10 pt-3 text-xs leading-relaxed text-ice/55">
              Every caption cites the measurements behind it: hover a numbered chip to see the
              reading. Colours show each country against its own normal, not against other
              countries.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
