"use client";

// Everything a reader can find or follow (ADR-0023, ADR-0024): every edition story and
// classic (/search.json, built with the site) and the last 24 hours of Now (the hourly file).
import { z } from "zod";
import { latestNow } from "@/lib/live-now";
import { followKey } from "@/scene/follow";
import { ago, storiesIn } from "@/scene/now";
import { outletById } from "@/scene/outlets";
import type { SearchItem } from "@/scene/search";
import { TOPIC_LABEL } from "@/scene/topics";

const Item = z.object({
  kind: z.enum(["now", "story", "classic"]),
  title: z.string(),
  detail: z.string(),
  href: z.string(),
  date: z.string(),
  keys: z.string(),
  key: z.string().optional(),
  prev: z.array(z.string()).optional(),
});

let once: Promise<SearchItem[]> | undefined;

async function load(): Promise<SearchItem[]> {
  const [index, now] = await Promise.all([
    fetch("/search.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((j: unknown) => {
        const parsed = z.array(Item).safeParse(j);
        return parsed.success
          ? parsed.data.map(({ key, prev, ...i }) => ({
              ...i,
              ...(key ? { key } : {}),
              ...(prev ? { prev } : {}),
            }))
          : [];
      })
      .catch(() => [] as SearchItem[]),
    latestNow(),
  ]);
  const t = Date.now();
  const live: SearchItem[] = now
    ? storiesIn(now, "24h", t).map((s) => {
        const href = `/now?story=${s.cluster.id}`;
        return {
          kind: "now" as const,
          title: s.cluster.title,
          detail: `Now · ${ago(s.headlines[0]?.t ?? now.generatedAt, t)}${s.cluster.place ? ` · ${s.cluster.place.name}` : ""}`,
          href,
          date: s.cluster.last,
          key: followKey(s.cluster.context?.title, href),
          keys: [
            TOPIC_LABEL[s.cluster.topic],
            s.cluster.region,
            s.cluster.context?.title,
            ...s.outlets.map((o) => outletById(o)?.name),
          ]
            .filter(Boolean)
            .join(" "),
        };
      })
    : [];
  return [...live, ...index];
}

/** Loaded once per page view (search and the "Yours" page share it). */
export function loadItems(): Promise<SearchItem[]> {
  once ??= load().catch(() => {
    once = undefined;
    return [];
  });
  return once;
}
