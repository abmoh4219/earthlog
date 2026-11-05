import Link from "next/link";
import { REPO_URL } from "@/config";
import { GithubMark } from "./GithubMark";

const LINKS = [
  { href: "/#lenses", label: "Lenses" },
  { href: "/#how", label: "How it works" },
  { href: "/#archive", label: "Archive" },
];

/** The site's top bar: brand, sections, the repository, and the way into today's edition. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ice/10 bg-void/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:h-16 sm:px-6">
        {/* A plain wordmark: no invented logo. */}
        <Link href="/" className="text-[17px] font-semibold tracking-tight text-frost">
          Earthlog
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
            aria-label="Earthlog on GitHub"
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ice/80 transition hover:bg-ice/5 hover:text-frost"
          >
            <GithubMark size={16} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            href="/today"
            className="rounded-lg bg-frost px-3.5 py-1.5 text-sm font-semibold text-void transition hover:bg-white"
          >
            Today&apos;s edition
          </Link>
        </div>
      </nav>
    </header>
  );
}
