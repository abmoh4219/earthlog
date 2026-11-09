"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Player } from "@/components/player/Player";
import { NOW_DATA_BASE } from "@/config";
import { latestNow } from "@/lib/live-now";
import { loadRemoteFilm } from "@/lib/remote-film";
import type { SceneBundle } from "@/player/store";
import { type FollowTarget, followKey } from "@/scene/follow";

/** One film from the hourly data: the now-data branch first, else the deployed copy. */
const loadFilm = (id: string) =>
  loadRemoteFilm([`${NOW_DATA_BASE}films/${id}/`, `/now/films/${id}/`]);

export function NowFilmPlayer() {
  const id = useSearchParams().get("id") ?? "";
  const [state, setState] = useState<{ bundle?: SceneBundle; missing?: boolean }>({});
  const [follow, setFollow] = useState<FollowTarget>();
  useEffect(() => {
    if (!/^[a-f0-9]{12}$/.test(id)) {
      setState({ missing: true });
      return;
    }
    loadFilm(id).then((bundle) => setState(bundle ? { bundle } : { missing: true }));
    // Followed by the story's subject (its article), so later films and editions of it are
    // updates; the film itself is replaced within the hour, the story on Now stays.
    latestNow().then((now) => {
      const c = now?.clusters.find((x) => x.id === id);
      const href = `/now?story=${id}`;
      if (c) setFollow({ key: followKey(c.context?.title, href), title: c.title, href });
    });
  }, [id]);

  if (state.bundle)
    return (
      <Player
        bundle={state.bundle}
        back={{ href: "/now", label: "Now" }}
        {...(follow ? { follow } : {})}
      />
    );
  return (
    <main className="grid h-dvh place-items-center bg-void px-6 text-center">
      {state.missing ? (
        <div className="max-w-sm">
          <p className="font-serif text-3xl font-light text-moon">This film has moved on.</p>
          <p className="mt-3 text-sm leading-relaxed text-dust/60">
            Films of the news are made every hour for the stories reported most, and replaced the
            next hour.
          </p>
          <Link
            href="/now"
            className="mt-6 inline-block rounded-full bg-sodium px-5 py-2.5 text-sm font-medium text-[#1a1206] hover:bg-[#ffc46e]"
          >
            See what&apos;s happening now
          </Link>
        </div>
      ) : (
        <p className="text-sm text-dust/50">Loading the film…</p>
      )}
    </main>
  );
}
