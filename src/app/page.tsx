import Link from "next/link";
import { DESCRIPTION, TAGLINE } from "@/config";
import { listEditions, loadEdition, loadIndex } from "@/lib/bundles";

// A plain landing for now. The globe front page with story beacons is PLAN.md Phase 16.
export default async function Home() {
  const index = await loadIndex();
  const latest = (await listEditions())[0];
  const edition = latest ? await loadEdition(latest) : undefined;
  const isDev = process.env.NODE_ENV !== "production";
  const replays = index.filter((e) => e.listed || isDev);

  return (
    <main className="grid h-dvh place-items-center overflow-y-auto bg-void px-6 py-16">
      <div className="max-w-xl text-center">
        <p className="font-mono text-[11px] tracking-[0.5em] text-ice/80 uppercase">Earthlog</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{TAGLINE}</h1>
        <p className="mt-4 text-ice/70">{DESCRIPTION}</p>
        {edition && latest && (
          <Link
            href={`/edition/${latest}`}
            className="glass mt-10 block rounded-2xl px-5 py-5 text-left transition hover:border-ice/40"
          >
            <span className="font-mono text-[11px] tracking-[0.25em] text-ice/60 uppercase">
              Latest edition · {latest}
            </span>
            <span className="mt-1 block text-2xl font-semibold">
              {edition.stories.length} stories from yesterday
            </span>
            <span className="mt-1 block text-sm text-ice/60">
              {edition.stories
                .slice(0, 4)
                .map((s) => s.title)
                .join(" · ")}
            </span>
          </Link>
        )}
        <p className="mt-10 text-left font-mono text-[11px] tracking-[0.25em] text-ice/50 uppercase">
          Classics
        </p>
        <ul className="mt-3 space-y-3">
          {replays.map((r) => (
            <li key={r.id}>
              <Link
                href={`/replay/${r.id}`}
                className="glass block rounded-xl px-5 py-4 text-left transition hover:border-ice/40"
              >
                <span className="font-mono text-[11px] tracking-[0.25em] text-ice/60 uppercase">
                  {r.category} · {r.date}
                  {!r.listed && " · unlisted"}
                </span>
                <span className="mt-1 block text-lg font-medium">{r.title}</span>
                <span className="block text-sm text-ice/60">{r.subtitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
