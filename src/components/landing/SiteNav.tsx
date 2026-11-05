import Link from "next/link";
import { REPO_URL } from "@/config";
import { GithubMark } from "./GithubMark";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/#lenses", label: "Lenses" },
  { href: "/#how", label: "How it works" },
  { href: "/#archive", label: "Archive" },
];

/** The site's top bar: brand, sections, the repository, and the way into today's edition. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ice/10 bg-void/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative grid size-7 place-items-center rounded-full bg-gradient-to-br from-attention to-ice-dim shadow-[0_0_18px_rgb(94_242_255/0.45)]">
            <span className="size-3 rounded-full border border-void/60" />
          </span>
          <span className="font-semibold tracking-tight text-frost">Earthlog</span>
        </Link>
        <ul className="hidden items-center gap-5 text-sm text-ice/70 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition hover:text-frost">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-ice/15 px-3 py-1.5 text-sm text-ice/85 transition hover:border-ice/40 hover:text-frost"
          >
            <GithubMark size={16} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            href="/today"
            className="rounded-full bg-ice px-4 py-1.5 text-sm font-semibold text-void transition hover:bg-frost"
          >
            Watch today
          </Link>
        </div>
      </nav>
    </header>
  );
}
