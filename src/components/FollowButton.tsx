"use client";

// Follow a story (ADR-0024): kept in this browser; updates show on the "Yours" page.
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useFollows } from "@/lib/library";
import type { FollowTarget } from "@/scene/follow";

export function FollowButton({
  target,
  className = "",
}: {
  target: FollowTarget;
  className?: string;
}) {
  const { toggle, isFollowed } = useFollows();
  const on = isFollowed(target.key);
  return (
    <button
      type="button"
      onClick={() => toggle(target)}
      aria-pressed={on}
      title={on ? "Following: updates appear on your page" : "Follow this story"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-sodium/40 text-sodium" : "border-moon/15 text-dust/75 hover:border-moon/30 hover:text-moon"} ${className}`}
    >
      {on ? <BookmarkCheck size={13} aria-hidden /> : <Bookmark size={13} aria-hidden />}
      {on ? "Following" : "Follow"}
    </button>
  );
}
