"use client";

// The game's scores and streak (ADR-0024), in the reader's browser only.
import { z } from "zod";
import { EMPTY_STATS, type Stats } from "@/scene/game";

const KEY = "earthlog.game";
const Saved = z.object({
  last: z.string().optional(),
  streak: z.number().default(0),
  best: z.number().default(0),
  scores: z.record(z.string(), z.number()).default({}),
});

export function readStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? Saved.safeParse(JSON.parse(raw)) : undefined;
    if (!parsed?.success) return EMPTY_STATS;
    const { last, ...rest } = parsed.data;
    return { ...rest, ...(last ? { last } : {}) };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(s: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Blocked storage: the game still plays, the streak lasts for this visit.
  }
}
