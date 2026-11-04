// The validator: the gate every scene passes, whether a template or Claude wrote it
// (CLAUDE.md §3.1, §8.2). It never "fixes" a scene; it only reports what is wrong.
// Schema shape is Zod's job; this checks the rules that span files.
import { type Evidence, ms, type Scene, type Source } from "./schema.ts";

export interface BundleInput {
  scene: Scene;
  evidence: Evidence[];
  sources: Source[];
}

export function validateBundle({ scene, evidence, sources }: BundleInput): string[] {
  const errors: string[] = [];
  const start = ms(scene.window.start);
  const end = ms(scene.window.end);
  const inWindow = (t: number) => t >= start && t <= end;

  if (end <= start) errors.push("window: end must be after start");
  if (!inWindow(ms(scene.focus))) errors.push("focus: must fall inside the window");

  // Sources: every one names its licence and attribution (§3.5).
  const sourceIds = new Set<string>();
  for (const s of sources) {
    if (sourceIds.has(s.id)) errors.push(`source ${s.id}: duplicate id`);
    sourceIds.add(s.id);
    if (!s.license.trim()) errors.push(`source ${s.id}: missing licence`);
    if (!s.attribution.trim()) errors.push(`source ${s.id}: missing attribution`);
  }

  // Evidence: unique IDs, known source, reports carry their exact quote and link.
  const byId = new Map<string, Evidence>();
  for (const e of evidence) {
    if (byId.has(e.id)) errors.push(`evidence ${e.id}: duplicate id`);
    byId.set(e.id, e);
    if (!sourceIds.has(e.source)) errors.push(`evidence ${e.id}: unknown source "${e.source}"`);
    if (e.kind === "report" && (!e.quote?.trim() || !e.url)) {
      errors.push(`evidence ${e.id}: a report needs an exact quote and a url`);
    }
  }

  // Beats: in order, inside the window, each citing ≥1 known evidence item from the window.
  let previous = Number.NEGATIVE_INFINITY;
  scene.beats.forEach((beat, i) => {
    const where = `beat ${i + 1} (${beat.t})`;
    const t = ms(beat.t);
    if (!inWindow(t)) errors.push(`${where}: outside the scene window`);
    if (t < previous) errors.push(`${where}: out of order`);
    previous = t;
    if (beat.cites.length === 0) errors.push(`${where}: cites nothing`);
    for (const id of beat.cites) {
      const e = byId.get(id);
      if (!e) errors.push(`${where}: cites unknown evidence "${id}"`);
      else if (!inWindow(ms(e.t))) errors.push(`${where}: cites "${id}", outside the window`);
    }
  });

  // Camera and pacing must be chronological, or interpolation goes backwards.
  for (const [name, list] of [
    ["camera", scene.camera],
    ["pacing", scene.pacing],
  ] as const) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      if (a && b && ms(b.t) < ms(a.t)) errors.push(`${name} ${i + 1}: out of order`);
    }
  }

  return errors;
}
