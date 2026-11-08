"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { fresherNow } from "@/lib/live-now";
import type { NowFile } from "@/scene/headlines";
import { ago, blindSpot, storiesIn } from "@/scene/now";
import { outletById } from "@/scene/outlets";
import { TOPIC_LABEL } from "@/scene/topics";

/**
 * The landing's "Happening now": the four hottest stories of the last 24 hours. Rendered at
 * build time from the bundled file, then refreshed from the hourly file once the page opens.
 */
export function HappeningNow({ initial, heading }: { initial: NowFile; heading: ReactNode }) {
  const [file, setFile] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));
  const fileRef = useRef(file);
  fileRef.current = file;
  useEffect(() => {
    setNow(Date.now());
    fresherNow(fileRef.current).then((next) => next && setFile(next));
  }, []);
  const stories = storiesIn(file, "24h", now).slice(0, 4);
  if (!stories.length) return null;
  return (
    <section className="border-t border-moon/8">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          {heading}
          <Link
            href="/now"
            className="group inline-flex items-center gap-2 text-sm text-dust/70 transition-colors hover:text-moon"
          >
            Open the live globe
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <ol className="mt-12 grid gap-x-10 border-t border-moon/8 sm:grid-cols-2">
          {stories.map((s) => {
            const spot = blindSpot(s.outlets);
            return (
              <li key={s.cluster.id} className="border-b border-moon/8">
                <Link href="/now" className="group block py-5">
                  <span className="flex flex-wrap gap-x-2 text-xs text-dust/50">
                    {s.breaking && <span className="font-medium text-sodium">Breaking</span>}
                    <span>{TOPIC_LABEL[s.cluster.topic]}</span>
                    {s.cluster.place && <span>· {s.cluster.place.name}</span>}
                    <span>· {ago(s.headlines[0]?.t ?? file.generatedAt, now)}</span>
                  </span>
                  <span className="mt-1.5 block font-serif text-xl leading-snug text-moon group-hover:underline group-hover:decoration-moon/30 group-hover:underline-offset-4">
                    {s.cluster.title}
                  </span>
                  <span className="mt-1.5 block text-xs text-dust/45">
                    {s.outlets.map((o) => outletById(o)?.name ?? o).join(", ")}
                    {spot && ` · only outlets based in ${spot}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
