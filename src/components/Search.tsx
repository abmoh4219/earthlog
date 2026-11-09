"use client";

// Search everything (ADR-0023): press "/" (or Ctrl/Cmd+K, or the nav's search button) on any
// page. Edition stories and classics come from /search.json (built with the site); Now's
// stories from the hourly file. Everything runs in the page.
import { Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { latestNow } from "@/lib/live-now";
import { ago, storiesIn } from "@/scene/now";
import { outletById } from "@/scene/outlets";
import { type SearchItem, search } from "@/scene/search";
import { TOPIC_LABEL } from "@/scene/topics";

export const OPEN_SEARCH = "earthlog:search";

const KIND_LABEL: Record<SearchItem["kind"], string> = {
  now: "Now",
  story: "Edition",
  classic: "Classic",
};

async function loadItems(): Promise<SearchItem[]> {
  const [index, now] = await Promise.all([
    fetch("/search.json")
      .then((r) => (r.ok ? (r.json() as Promise<SearchItem[]>) : []))
      .catch(() => [] as SearchItem[]),
    latestNow(),
  ]);
  const t = Date.now();
  const live: SearchItem[] = now
    ? storiesIn(now, "24h", t).map((s) => ({
        kind: "now" as const,
        title: s.cluster.title,
        detail: `Now · ${ago(s.headlines[0]?.t ?? now.generatedAt, t)}${s.cluster.place ? ` · ${s.cluster.place.name}` : ""}`,
        href: `/now?story=${s.cluster.id}`,
        date: s.cluster.last,
        keys: [
          TOPIC_LABEL[s.cluster.topic],
          s.cluster.region,
          s.cluster.context?.title,
          ...s.outlets.map((o) => outletById(o)?.name),
        ]
          .filter(Boolean)
          .join(" "),
      }))
    : [];
  return [...live, ...index];
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>();
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const show = useCallback(() => {
    setOpen(true);
    setActive(0);
    loadItems().then(setItems);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH, show);
    };
  }, [show]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  const results = useMemo(() => (items ? search(items, query) : []), [items, query]);
  const go = (item: SearchItem | undefined) => {
    if (!item) return;
    setOpen(false);
    setQuery("");
    router.push(item.href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
      {/* The backdrop: a click outside closes the dialog (Esc does too). */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close search"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-void/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Earthlog"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-moon/12 bg-night shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-moon/8 px-4">
          <SearchIcon size={16} className="text-dust/50" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") go(results[active]);
            }}
            placeholder="Search stories, places, people…"
            className="h-14 flex-1 bg-transparent text-[15px] text-moon outline-none placeholder:text-dust/40"
            aria-controls="search-results"
          />
          <kbd className="rounded border border-moon/12 px-1.5 py-0.5 font-mono text-[10px] text-dust/45">
            Esc
          </kbd>
        </div>
        <ul id="search-results" className="max-h-[55vh] overflow-y-auto py-1">
          {!items && <li className="px-4 py-6 text-sm text-dust/50">Loading…</li>}
          {items && query.trim() && results.length === 0 && (
            <li className="px-4 py-6 text-sm text-dust/50">
              Nothing found for &ldquo;{query}&rdquo;.
            </li>
          )}
          {items && !query.trim() && (
            <li className="px-4 py-6 text-sm text-dust/50">
              Every edition story, the classics and the last 24 hours of news. Try a place, a person
              or a topic.
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.href}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`block w-full px-4 py-2.5 text-left ${i === active ? "bg-moon/[0.06]" : ""}`}
              >
                <span className="flex items-baseline gap-2">
                  <span
                    className={`shrink-0 text-[11px] ${r.kind === "now" ? "text-sodium" : "text-dust/45"}`}
                  >
                    {KIND_LABEL[r.kind]}
                  </span>
                  <span className="truncate font-serif text-[17px] text-moon">{r.title}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-dust/50">{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The nav's search button: opens the same dialog. */
export function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH))}
      aria-label="Search (press /)"
      className="flex h-9 items-center gap-2 rounded-full px-2.5 text-sm text-dust/70 transition-colors hover:bg-moon/6 hover:text-moon"
    >
      <SearchIcon size={16} aria-hidden />
      <kbd className="hidden rounded border border-moon/12 px-1.5 font-mono text-[10px] text-dust/45 sm:inline">
        /
      </kbd>
    </button>
  );
}
