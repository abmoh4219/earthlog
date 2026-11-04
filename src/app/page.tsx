import Link from "next/link";
import { DESCRIPTION, TAGLINE } from "@/config";
import { loadIndex } from "@/lib/bundles";

// Phase 1 placeholder. The cinematic landing (night globe + replay cards) lands in Phase 4.
export default async function Home() {
  const index = await loadIndex();
  const isDev = process.env.NODE_ENV !== "production";
  const replays = index.filter((e) => e.listed || isDev);

  return (
    <main className="grid min-h-dvh place-items-center bg-void px-6">
      <div className="max-w-xl text-center">
        <p className="font-mono text-[11px] tracking-[0.5em] text-ice/80 uppercase">Earthlog</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{TAGLINE}</h1>
        <p className="mt-4 text-ice/70">{DESCRIPTION}</p>
        <ul className="mt-10 space-y-3">
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
