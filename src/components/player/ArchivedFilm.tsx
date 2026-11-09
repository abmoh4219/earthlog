"use client";

// An old edition's film, played from the archive (ADR-0027): the page is built with the site
// (title, description, share card); the film's files come from the archive's GitHub Pages.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Player } from "@/components/player/Player";
import { loadRemoteFilm } from "@/lib/remote-film";
import type { SceneBundle } from "@/player/store";
import type { FollowTarget } from "@/scene/follow";

export function ArchivedFilm({
  url,
  back,
  follow,
}: {
  /** The film's folder in the archive (ends with "/"). */
  url: string;
  back: { href: string; label: string; external?: boolean };
  follow?: FollowTarget;
}) {
  const [state, setState] = useState<{ bundle?: SceneBundle; missing?: boolean }>({});
  useEffect(() => {
    loadRemoteFilm([url]).then((bundle) => setState(bundle ? { bundle } : { missing: true }));
  }, [url]);
  if (state.bundle)
    return <Player bundle={state.bundle} back={back} {...(follow ? { follow } : {})} />;
  return (
    <main className="grid h-dvh place-items-center bg-void px-6 text-center">
      {state.missing ? (
        <div className="max-w-sm">
          <p className="font-serif text-3xl font-light text-moon">The archive did not answer.</p>
          <p className="mt-3 text-sm leading-relaxed text-dust/60">
            This film is kept in Earthlog&apos;s archive. It may be offline for a moment; try again
            shortly.
          </p>
          <Link
            href={back.href}
            className="mt-6 inline-block rounded-full bg-sodium px-5 py-2.5 text-sm font-medium text-[#1a1206] hover:bg-[#ffc46e]"
          >
            Back to the edition
          </Link>
        </div>
      ) : (
        <p className="text-sm text-dust/50">Loading the film from the archive…</p>
      )}
    </main>
  );
}
