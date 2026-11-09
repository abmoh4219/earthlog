// The freshest headlines the browser can reach (ADR-0018): the hourly file on the repository's
// now-data branch, else the copy bundled with the deploy. Whichever was collected last wins.
import { NOW_DATA_BASE, NOW_DATA_URL } from "@/config";
import { NowFile } from "@/scene/headlines";
import { LiveFile } from "@/scene/live";

async function read(url: string): Promise<NowFile | undefined> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const parsed = NowFile.safeParse(await res.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** A newer file than `current`, or undefined if there is none. */
export async function fresherNow(current: NowFile): Promise<NowFile | undefined> {
  const found = (await Promise.all([read(NOW_DATA_URL), read("/now/now.json")])).filter(
    (f): f is NowFile => f !== undefined,
  );
  const newest = found.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
  return newest && newest.generatedAt > current.generatedAt ? newest : undefined;
}

async function readLive(url: string): Promise<LiveFile | undefined> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const parsed = LiveFile.safeParse(await res.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** A newer living-Earth file than `current` (ADR-0022), from the same two places. */
export async function fresherLive(current?: LiveFile): Promise<LiveFile | undefined> {
  const found = (
    await Promise.all([readLive(`${NOW_DATA_BASE}live.json`), readLive("/now/live.json")])
  ).filter((f): f is LiveFile => f !== undefined);
  const newest = found.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
  return newest && (!current || newest.generatedAt > current.generatedAt) ? newest : undefined;
}
