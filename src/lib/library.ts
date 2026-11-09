"use client";

// The reader's own library (ADR-0024): the stories they follow and the films they watched,
// kept in their browser (localStorage) and nowhere else. Components stay in step through a
// window event, so a Follow button and the "Yours" page agree without a store library.
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import type { Follow, FollowTarget } from "@/scene/follow";

const FOLLOWS = "earthlog.follows";
const HISTORY = "earthlog.history";
const EVENT = "earthlog:library";
const MAX_HISTORY = 40;

const FollowSchema = z.object({
  key: z.string(),
  title: z.string(),
  href: z.string(),
  at: z.string(),
});
const Visit = z.object({ href: z.string(), title: z.string(), at: z.string() });
export type Visit = z.infer<typeof Visit>;

function read<T>(key: string, schema: z.ZodType<T>): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? z.array(schema).safeParse(JSON.parse(raw)) : undefined;
    return parsed?.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked storage: the change lasts for this visit only.
  }
  window.dispatchEvent(new Event(EVENT));
}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** A film watched: remembered first, at most 40, one entry per page. */
export function recordVisit(href: string, title: string) {
  const rest = read(HISTORY, Visit).filter((v) => v.href !== href);
  write(HISTORY, [{ href, title, at: now() }, ...rest].slice(0, MAX_HISTORY));
}

export function clearHistory() {
  write(HISTORY, []);
}

function useStored<T>(key: string, schema: z.ZodType<T>): T[] {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    const load = () => setList(read(key, schema));
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [key, schema]);
  return list;
}

export function useFollows() {
  const follows = useStored(FOLLOWS, FollowSchema);
  const toggle = useCallback((t: FollowTarget) => {
    const list = read(FOLLOWS, FollowSchema);
    const on = list.some((f) => f.key === t.key);
    write(FOLLOWS, on ? list.filter((f) => f.key !== t.key) : [{ ...t, at: now() }, ...list]);
  }, []);
  const isFollowed = useCallback((key: string) => follows.some((f) => f.key === key), [follows]);
  const typed: Follow[] = follows;
  return { follows: typed, toggle, isFollowed };
}

export function useHistory(): Visit[] {
  return useStored(HISTORY, Visit);
}
