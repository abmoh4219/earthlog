import Link from "next/link";
import { REPO_URL } from "@/config";
import { LogoMark } from "./LogoMark";

const doc = (path: string) => `${REPO_URL}/blob/main/${path}`;

/** The site footer: the project, its documentation, its data and licences. */
export function SiteFooter() {
  const columns = [
    {
      title: "Earthlog",
      links: [
        { label: "Today's edition", href: "/today" },
        { label: "Morning brief", href: "/brief" },
        { label: "The week", href: "/week" },
        { label: "Archive", href: "/#archive" },
        { label: "FAQ", href: "/#faq" },
        { label: "RSS feed", href: "/feed.xml" },
      ],
    },
    {
      title: "Open source",
      links: [
        { label: "Source code", href: REPO_URL },
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
    <footer className="border-t border-moon/8 bg-void">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <p className="flex items-center gap-2 font-serif text-xl text-moon">
            <LogoMark size={18} /> Earthlog
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dust/55">
            Yesterday&apos;s world, explained in 3D. A new edition every morning, every line cited.
          </p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <p className="text-sm text-dust/45">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  {/* Pages go through the router; the feed is a file. */}
                  {l.href.startsWith("/") && !l.href.endsWith(".xml") ? (
                    <Link href={l.href} className="text-dust/75 transition-colors hover:text-moon">
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-dust/75 transition-colors hover:text-moon"
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
      <div className="border-t border-moon/8">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-dust/40 sm:px-8">
          MIT licence. Data keeps its own licences; text adapted from Wikipedia is CC BY-SA 4.0.
          Imagery and city lights: NASA. Borders: Natural Earth.
        </p>
      </div>
    </footer>
  );
}
