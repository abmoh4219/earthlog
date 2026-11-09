import Link from "next/link";
import { SearchButton } from "@/components/Search";
import { REPO_URL } from "@/config";
import { GithubMark } from "./GithubMark";
import { LogoMark } from "./LogoMark";

const LINKS = [
  { href: "/now", label: "Now" },
  { href: "/#archive", label: "Archive" },
  { href: "/#lenses", label: "Lenses" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

/** The site's top bar: the name, the sections, the source, and the way into today's edition. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-moon/8 bg-void/75 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5 sm:h-16 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-serif text-[22px] leading-none tracking-[-0.01em] text-moon"
        >
          <LogoMark size={20} />
          Earthlog
        </Link>
        <ul className="hidden items-center gap-6 text-sm text-dust/65 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition-colors hover:text-moon">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <SearchButton />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Earthlog's source on GitHub"
            className="grid size-9 place-items-center rounded-full text-dust/70 transition-colors hover:bg-moon/6 hover:text-moon"
          >
            <GithubMark size={17} />
          </a>
          <Link
            href="/today"
            className="rounded-full border border-moon/18 px-4 py-1.5 text-sm whitespace-nowrap text-moon transition-colors hover:border-moon/35 hover:bg-moon/5"
          >
            Today&apos;s edition
          </Link>
        </div>
      </nav>
    </header>
  );
}
