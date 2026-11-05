import Link from "next/link";
import { REPO_URL } from "@/config";
import { GithubMark } from "./GithubMark";

const doc = (path: string) => `${REPO_URL}/blob/main/${path}`;

/** The site footer: project, documentation, data and licence. */
export function SiteFooter() {
  const columns = [
    {
      title: "Earthlog",
      links: [
        { label: "Today's edition", href: "/today" },
        { label: "Archive", href: "/#archive" },
        { label: "How it works", href: "/#how" },
      ],
    },
    {
      title: "Open source",
      links: [
        { label: "Repository", href: REPO_URL },
        { label: "Contributing", href: doc("CONTRIBUTING.md") },
        { label: "Changelog", href: doc("CHANGELOG.md") },
        { label: "Architecture", href: doc("docs/ARCHITECTURE.md") },
      ],
    },
    {
      title: "Trust",
      links: [
        { label: "Data sources and licences", href: doc("docs/DATA-SOURCES.md") },
        { label: "Responsible use", href: doc("docs/RESPONSIBLE-USE.md") },
        { label: "Design decisions", href: doc("docs/decisions.md") },
      ],
    },
  ];
  return (
    <footer className="border-t border-ice/10 bg-void">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <p className="font-semibold text-frost">Earthlog</p>
          <p className="mt-2 max-w-xs text-sm text-ice/60">
            Yesterday&apos;s world, explained in 3D. Free, open source, no account, no tracking.
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-ice/80 hover:text-frost"
          >
            <GithubMark size={16} /> Star us on GitHub
          </a>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <p className="font-medium text-xs text-ice/50">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("/") ? (
                    <Link href={l.href} className="text-ice/75 hover:text-frost">
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ice/75 hover:text-frost"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ice/10">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-ice/45 sm:px-6">
          MIT licence. Data keeps its own licences; text adapted from Wikipedia is CC BY-SA 4.0.
          Imagery: NASA. Borders: Natural Earth.
        </p>
      </div>
    </footer>
  );
}
