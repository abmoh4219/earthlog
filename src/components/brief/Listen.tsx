"use client";

// Listen mode (ADR-0025): the brief read aloud by the browser's own speech synthesis (Web
// Speech API, free, no key). Only voices that run on the device (`localService`) are used:
// some browsers offer cloud voices that would send the text to a server. With no local
// English voice, the button is not shown.
import { Headphones, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function localVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => v.localService && /^en/i.test(v.lang));
  return voices.find((v) => /en-GB/i.test(v.lang)) ?? voices[0];
}

export function Listen({
  lines,
  onLine,
}: {
  lines: string[];
  /** The line being read (-1 when stopped), to highlight it. */
  onLine?: (i: number) => void;
}) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice>();
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const cancelled = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => setVoice(localVoice());
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", pick);
      speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    speechSynthesis.cancel();
    setState("idle");
    onLine?.(-1);
  }, [onLine]);

  const play = useCallback(() => {
    if (!voice) return;
    if (state === "paused") {
      speechSynthesis.resume();
      setState("playing");
      return;
    }
    cancelled.current = false;
    speechSynthesis.cancel();
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 1;
      u.onstart = () => onLine?.(i);
      if (i === lines.length - 1)
        u.onend = () => {
          if (!cancelled.current) {
            setState("idle");
            onLine?.(-1);
          }
        };
      speechSynthesis.speak(u);
    });
    setState("playing");
  }, [voice, state, lines, onLine]);

  if (!voice) return null;
  return (
    <div className="flex items-center gap-2">
      {state === "playing" ? (
        <button
          type="button"
          onClick={() => {
            speechSynthesis.pause();
            setState("paused");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-sodium/50 px-4 py-2 text-sm text-sodium hover:bg-sodium/10"
        >
          <Pause size={15} aria-hidden /> Pause
        </button>
      ) : (
        <button
          type="button"
          onClick={play}
          className="inline-flex items-center gap-2 rounded-full border border-sodium/50 px-4 py-2 text-sm text-sodium hover:bg-sodium/10"
        >
          {state === "paused" ? (
            <Play size={15} aria-hidden />
          ) : (
            <Headphones size={15} aria-hidden />
          )}
          {state === "paused" ? "Resume" : "Listen"}
        </button>
      )}
      {state !== "idle" && (
        <button
          type="button"
          onClick={stop}
          aria-label="Stop"
          className="grid size-9 place-items-center rounded-full border border-moon/15 text-dust/70 hover:text-moon"
        >
          <Square size={13} aria-hidden />
        </button>
      )}
      <span className="hidden text-xs text-dust/40 sm:inline">
        Read by your device&apos;s own voice
      </span>
    </div>
  );
}
