"use client";

import { Film, Square } from "lucide-react";
import { useRef, useState } from "react";
import { type ClipFormat, clipMimeType, recordClip } from "@/player/clip";

/** WebCodecs (frame by frame) or MediaRecorder (real time). */
const canExport = () =>
  typeof window !== "undefined" &&
  (typeof VideoEncoder !== "undefined" || clipMimeType() !== undefined);

/** Record the film as a video clip (landscape or vertical), in the browser. */
export function ClipButton() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();
  const stop = useRef<() => void>(() => {});

  const start = (format: ClipFormat) => {
    setOpen(false);
    setError(undefined);
    setProgress(0);
    recordClip(format, setProgress, (s) => {
      stop.current = s;
    })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setProgress(undefined));
  };

  if (progress !== undefined)
    return (
      <button
        type="button"
        onClick={() => stop.current()}
        title="Stop recording (the clip so far is saved)"
        className="flex h-9 items-center gap-2 rounded-lg border border-loss/50 bg-loss/15 px-2 font-mono text-[11px] text-moon"
      >
        <Square size={12} fill="currentColor" className="text-loss" />
        {Math.round(progress * 100)}%
      </button>
    );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={
          canExport() ? "Export a video clip" : "Video export is not supported in this browser"
        }
        disabled={!canExport()}
        className="grid size-9 place-items-center rounded-lg border border-transparent text-dust/45 transition hover:text-dust/80 disabled:opacity-30"
      >
        <Film size={16} />
      </button>
      {open && (
        <div className="glass absolute right-0 bottom-11 w-52 rounded-xl p-2 text-left text-xs">
          <p className="px-2 pt-1 pb-2 text-dust/60">
            Exports the whole film frame by frame, with captions, stats and sources. Keep this tab
            open.
          </p>
          {(["16:9", "9:16"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => start(f)}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-moon hover:bg-dust/10"
            >
              {f === "16:9" ? "Landscape 16:9" : "Vertical 9:16"}
            </button>
          ))}
        </div>
      )}
      {error && <p className="absolute right-0 bottom-11 w-52 text-[11px] text-loss">{error}</p>}
    </div>
  );
}
