// Which narration beat is on screen at scene time t.
import type { Beat } from "./schema.ts";
import { ms } from "./schema.ts";

/**
 * A beat shows from its own time until the next beat starts.
 * Returns the index of the active beat, or -1 before the first one.
 */
export function activeBeatIndex(t: number, beats: readonly Beat[]): number {
  let index = -1;
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    if (beat && ms(beat.t) <= t) index = i;
    else break;
  }
  return index;
}
