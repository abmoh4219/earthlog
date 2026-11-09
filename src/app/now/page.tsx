import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { NowView } from "@/components/now/NowView";
import { loadLive, loadNow, loadRecentStories } from "@/lib/bundles";

export const metadata: Metadata = {
  title: "Now",
  description:
    "The world's news of the last hours from eight outlets, grouped into stories and placed on a live globe. Every headline links to the outlet's own article.",
};

// /now: the outlets' headlines, rendered at build time (complete without JavaScript), then
// kept fresh in the browser while the page is open (NowView polls public/now/now.json).
export default async function NowPage() {
  const [file, live, recent] = await Promise.all([loadNow(), loadLive(), loadRecentStories()]);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-void">
      <SiteNav />
      {file ? (
        <NowView initial={file} initialLive={live} recent={recent} />
      ) : (
        <main className="grid flex-1 place-items-center px-5 text-center text-dust/60">
          No headlines collected yet. Run pnpm news.
        </main>
      )}
    </div>
  );
}
