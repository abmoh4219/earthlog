// The Claude director, pure parts. Claude rewrites a story film's captions
// chapter by chapter from the lens's own evidence; this file builds the request and checks
// the answer. The network call lives in scripts/direct.ts.
// Rules (CLAUDE.md §3): every sentence cites evidence the chapter already has; every number
// it states must be found in that evidence or in the lens's own (validated) caption; anything
// else falls back to the template, chapter by chapter. Nothing here weakens the validator:
// the rewritten scene still goes through validateBundle before it is written.
import { z } from "zod";
import { type Beat, type Evidence, ms, type Scene } from "../../src/scene/schema.ts";

export const MODEL = "claude-haiku-5-5";
/** Haiku 5.5 list prices per million tokens (claude-api skill, cached 2026-10-06). */
export const PRICE = { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 };

export const LENSES = [
  "general",
  "election",
  "person",
  "organization",
  "economy",
  "sports",
  "culture",
  "accident",
  "disaster",
  "conflict",
  "science",
] as const;

/** What Claude returns (structured output). */
export const Direction = z.object({
  chapters: z.array(
    z.object({
      title: z.string(),
      beats: z.array(z.object({ text: z.string(), cites: z.array(z.string()) })),
    }),
  ),
  lens_check: z.object({
    fits: z.boolean(),
    better_lens: z.enum(LENSES).nullable(),
    reason: z.string(),
  }),
});
export type Direction = z.infer<typeof Direction>;

/** Stable instructions: identical for every story, so the prefix can be cached. */
export const SYSTEM = `You are the narrator of Earthlog, a calm, neutral newsroom explainer that plays on a 3D globe.
You receive one story film: its chapters, the captions a template wrote for each chapter, and the evidence each chapter may cite.
Rewrite the captions so they read like a short, clear spoken explainer.

Hard rules (a checker rejects any chapter that breaks one, and the template is kept instead):
- Use ONLY facts stated in that chapter's evidence or in its template captions. Never add a fact, a number, a date, a name, a cause or an opinion that is not there.
- Every caption cites at least one evidence id from that chapter's list, and only ids from that list. Cite the items the sentence rests on.
- Every number you write (counts, dates, percentages, amounts) must appear in the cited evidence or in that chapter's template captions, written the same way.
- 1 to 3 captions per chapter, each one sentence, at most 200 characters.
- Attribute casualty figures and contested claims to their source ("according to …", "as the article records"). Do not attribute ordinary facts: the cites already show the source, so most sentences need no "according to".
- Vary how sentences begin; write for the ear, like a calm documentary narrator.
- Keep every fact the template captions state (you may reword, merge or reorder them). Never read out coordinates, ids or URLs.
- Neutral words. No speculation, no drama, no "shocking", no second person.
- Keep the chapters in the same order with the same titles.

Also judge whether the story's lens (its kind of analysis) fits. Set fits=false and suggest a better lens only when it clearly does not.`;

export interface ChapterInput {
  title: string;
  template: { text: string; cites: string[] }[];
  evidence: { id: string; text: string }[];
}

/** Evidence as Claude sees it: the label, the quoted text and the value, nothing else. */
export function evidenceText(e: Evidence): string {
  const parts = [e.label];
  if ("quote" in e && e.quote && !e.label.includes(e.quote)) parts.push(`quote: "${e.quote}"`);
  if ("value" in e && e.value !== undefined)
    parts.push(`value: ${e.value}${"unit" in e && e.unit ? ` ${e.unit}` : ""}`);
  return parts.join(" | ").slice(0, 600);
}

/** The chapters of a scene with their template captions and the evidence each may cite. */
export function chapterInputs(scene: Scene, evidence: Evidence[]): ChapterInput[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return scene.chapters.map((c, i) => {
    const from = ms(c.t);
    const to = scene.chapters[i + 1]
      ? ms(scene.chapters[i + 1]?.t ?? c.t)
      : Number.POSITIVE_INFINITY;
    const beats = scene.beats.filter((b) => ms(b.t) >= from && ms(b.t) < to);
    const panelIds = scene.panels
      .filter((p) => ms(p.t) >= from && ms(p.t) < to)
      .flatMap((p) =>
        "items" in p
          ? p.items.flatMap((it) => it.cites)
          : "series" in p
            ? p.series.flatMap((s) => s.cites)
            : [],
      );
    const ids = [...new Set([...beats.flatMap((b) => b.cites), ...panelIds])].slice(0, 40);
    return {
      title: c.title,
      template: beats.map((b) => ({ text: b.text, cites: b.cites })),
      evidence: ids.flatMap((id) => {
        const e = byId.get(id);
        return e ? [{ id, text: evidenceText(e) }] : [];
      }),
    };
  });
}

/** The per-story request text (after the cached system prompt). */
export function storyPrompt(scene: Scene, lens: string, chapters: ChapterInput[]): string {
  return JSON.stringify({ title: scene.title, lens, chapters }, null, 1);
}

/** Numbers as written, normalised ("1,760" → "1760"; "8×" → "8"). */
export function numbers(text: string): string[] {
  // Leading zeros dropped, so "2026-11-03" in evidence matches "3 November" in a caption.
  return [...text.matchAll(/\d[\d,.]*/g)].map((m) =>
    m[0]
      .replace(/[,.]+$/, "")
      .replace(/,/g, "")
      .replace(/^0+(?=\d)/, ""),
  );
}

/** Problems with one rewritten chapter; empty when it passes. */
export function checkChapter(
  input: ChapterInput,
  out: Direction["chapters"][number] | undefined,
): string[] {
  if (!out) return ["chapter missing"];
  const errors: string[] = [];
  const allowed = new Set(input.evidence.map((e) => e.id));
  if (out.beats.length < 1 || out.beats.length > 3)
    errors.push(`${out.beats.length} captions (1–3 allowed)`);
  const evidenceById = new Map(input.evidence.map((e) => [e.id, e.text]));
  const templateNumbers = new Set(numbers(input.template.map((t) => t.text).join(" ")));
  for (const b of out.beats) {
    if (!b.text.trim() || b.text.length > 220) errors.push(`caption length ${b.text.length}`);
    if (!b.cites.length) errors.push(`uncited: "${b.text.slice(0, 60)}"`);
    for (const id of b.cites)
      if (!allowed.has(id)) errors.push(`cites ${id}, not in this chapter's evidence`);
    const source = new Set(numbers(b.cites.map((id) => evidenceById.get(id) ?? "").join(" ")));
    for (const n of numbers(b.text)) {
      if (!source.has(n) && !templateNumbers.has(n))
        errors.push(`number ${n} is not in the cited evidence`);
      // Coordinates read aloud ("26.6329") are noise, not narration.
      if (/\.\d{3,}$/.test(n) && !templateNumbers.has(n)) errors.push(`reads out coordinate ${n}`);
    }
  }
  // Facts the template stated must survive the rewrite: every number it said is said again.
  const said = new Set(numbers(out.beats.map((b) => b.text).join(" ")));
  for (const n of templateNumbers) if (!said.has(n)) errors.push(`dropped a fact (${n})`);
  return errors;
}

/**
 * The scene with Claude's captions where a chapter passed, the template's where it didn't.
 * Captions are re-timed evenly inside their chapter (whole seconds, strictly increasing).
 */
export function applyDirection(
  scene: Scene,
  inputs: ChapterInput[],
  direction: Direction,
): { scene: Scene; accepted: number; rejected: { title: string; errors: string[] }[] } {
  const beats: Beat[] = [];
  const rejected: { title: string; errors: string[] }[] = [];
  let accepted = 0;
  const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
  scene.chapters.forEach((c, i) => {
    const from = ms(c.t);
    const next = scene.chapters[i + 1];
    const to = next ? ms(next.t) : ms(scene.window.end) - 3_500;
    const template = scene.beats.filter(
      (b) => ms(b.t) >= from && ms(b.t) < (next ? ms(next.t) : Infinity),
    );
    const out = direction.chapters[i];
    const errors =
      out && out.title !== c.title
        ? [`title changed to "${out.title}"`]
        : checkChapter(inputs[i] ?? { title: c.title, template: [], evidence: [] }, out);
    if (!out || errors.length) {
      if (template.length) rejected.push({ title: c.title, errors });
      beats.push(...template);
      return;
    }
    accepted++;
    const start = Math.ceil((from + 600) / 1000) * 1000;
    const step = Math.max(1000, Math.floor((to - start) / out.beats.length / 1000) * 1000);
    for (const [k, b] of out.beats.entries())
      beats.push({ t: iso(start + k * step), text: b.text.trim(), cites: b.cites });
  });
  return { scene: { ...scene, beats }, accepted, rejected };
}

/** Dollars for one response's usage at Haiku 5.5 prices. */
export function costUsd(u: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): number {
  return (
    (u.input_tokens * PRICE.input +
      u.output_tokens * PRICE.output +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead) /
    1_000_000
  );
}
