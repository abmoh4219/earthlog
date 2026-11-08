// The freshest headlines the browser can reach (ADR-0018): the hourly file on the repository's
// now-data branch, else the copy bundled with the deploy. Whichever was collected last wins.
import { NOW_DATA_URL } from "@/config";
import { NowFile } from "@/scene/headlines";

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
