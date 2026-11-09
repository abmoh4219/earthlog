"use client";

// "For you" (ADR-0023): the topics and regions a reader follows, kept in their own browser
// (localStorage) and nowhere else: no account, nothing sent. Read after mount, so the server
// render and the first browser render agree; a blocked storage simply means no preferences.
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Region } from "@/scene/regions";
import { Topic } from "@/scene/topics";

const KEY = "earthlog.forYou";
export const ForYou = z.object({
  topics: z.array(Topic).default([]),
  regions: z.array(Region).default([]),
});
export type ForYou = z.infer<typeof ForYou>;
const EMPTY: ForYou = { topics: [], regions: [] };

export function readForYou(): ForYou {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? ForYou.safeParse(JSON.parse(raw)) : undefined;
    return parsed?.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function useForYou(): [ForYou, (next: ForYou) => void, boolean] {
  const [prefs, setPrefs] = useState<ForYou>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setPrefs(readForYou());
    setLoaded(true);
  }, []);
  const save = useCallback((next: ForYou) => {
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private window or blocked storage: the choice lasts for this visit only.
    }
  }, []);
  return [prefs, save, loaded];
}

export const hasPrefs = (p: ForYou) => p.topics.length > 0 || p.regions.length > 0;
