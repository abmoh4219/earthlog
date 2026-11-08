import type { Metadata } from "next";
import { Suspense } from "react";
import { NowFilmPlayer } from "@/components/now/NowFilmPlayer";

export const metadata: Metadata = {
  title: "Now · film",
  description: "A short film of a story the outlets are reporting now, every caption cited.",
};

// /now/film?id=<story>: the films of "Now" change every hour, so they are loaded in the
// browser from the hourly data (ADR-0020) rather than built into the site.
export default function NowFilmPage() {
  return (
    <Suspense fallback={<main className="h-dvh bg-void" />}>
      <NowFilmPlayer />
    </Suspense>
  );
}
