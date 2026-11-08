// The caption editor: writing rules in code, applied to every film before it is timed
// (ADR-0019). Pure. It only removes, trims or tidies captions; it never adds a fact, and every
// caption keeps the citations it came with. Sentences come from Wikipedia and the data, so the
// editor fixes what extraction breaks: repeats, orphan pronouns, cut quotes, clumsy clipping.
import type { Lens } from "../../src/scene/edition.ts";
import type { ChapterDraft } from "./film.ts";

export const MAX_CAPTION = 220;

/** Lenses whose film is about one subject: a leading "He"/"She"/"It" is that subject. */
const SUBJECT_LENSES: ReadonlySet<Lens> = new Set([
  "person",
  "culture",
  "organization",
  "science",
  "sports",
]);

const word = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
/** The words that carry a caption's meaning: 4+ letters, or any number of 2+ digits. */
export function meaning(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[\s,;:()"“”‘’.!?]+/)
      .map(word)
      .filter((w) => w.length >= 4 || /^\d{2,}$/.test(w)),
  );
}

/**
 * Share of the smaller caption's meaning found in the other. `ignore` holds words that appear
 * everywhere in a film (its subject's name) and so prove nothing about repetition.
 */
export function overlap(a: string, b: string, ignore: ReadonlySet<string> = new Set()): number {
  const x = new Set([...meaning(a)].filter((w) => !ignore.has(w)));
  const y = new Set([...meaning(b)].filter((w) => !ignore.has(w)));
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / Math.min(x.size, y.size);
}

/** Captions that repeat an earlier one this much are dropped (unless they name something new). */
export const REPEAT = 0.6;

/** Proper names in a caption, past its first word: "Manhattan", "Pittsburgh", "India". */
export function names(text: string): Set<string> {
  const out = new Set<string>();
  const ws = text.split(/\s+/);
  ws.forEach((w, i) => {
    const clean = w.replace(/^[("'“‘]+|[)"'”’,.;:!?]+$/g, "");
    if (i > 0 && /^\p{Lu}[\p{L}'’-]{2,}$/u.test(clean)) out.add(clean);
  });
  return out;
}

/**
 * A caption repeats earlier ones when most of its meaning was said before and it names no new
 * person, place or thing: "born on 18 June 1937 in Manhattan" after "(June 18, 1937 – …)" adds
 * Manhattan and stays.
 */
export function repeats(
  earlier: string[],
  text: string,
  ignore: ReadonlySet<string> = new Set(),
): boolean {
  const said = new Set(earlier.flatMap((t) => [...names(t)]));
  const fresh = [...names(text)].filter((n) => !said.has(n) && !ignore.has(word(n)));
  return !fresh.length && earlier.some((t) => overlap(t, text, ignore) >= REPEAT);
}

/** "D.C.." → "D.C.", stray spaces before punctuation, doubled spaces. */
export function tidy(text: string): string {
  return (
    text
      .replace(/\s+/g, " ")
      // Wikipedia's stripped pronunciation guides leave "(; born …)" or "()".
      .replace(/\(\s*[;,]\s*/g, "(")
      .replace(/\s*\(\s*\)/g, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/([^.])\.\.(?!\.)/g, "$1.")
      .trim()
  );
}

/** Opening quotes and closing quotes balance (straight quotes come in pairs). */
export function quotesBalanced(text: string): boolean {
  const straight = (text.match(/"/g) ?? []).length;
  const open = (text.match(/“/g) ?? []).length;
  const close = (text.match(/”/g) ?? []).length;
  return straight % 2 === 0 && open === close;
}

/** A sentence that leans on one before it: "They also wrote…", "This was…". */
const ORPHAN = /^(They|These|Those|This|That|Such|Both|Its|Their|His|Her)\b/;
const SUBJECT_PRONOUN = /^(He|She|It)\b/;
const QUOTED_HEADLINE = /^[^“]{2,40} headlined it: “/;

/**
 * Cut a long caption where a reader can stop: a sentence end or a clause break past the middle;
 * else at a word, marked with an ellipsis.
 */
export function clip(text: string, limit = MAX_CAPTION): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("; "));
  if (sentence >= limit * 0.55) return `${head.slice(0, sentence)}.`;
  const clause = Math.max(
    ...[", ", " – ", " — ", " and ", " who ", " which ", " while ", " but "].map((b) =>
      head.lastIndexOf(b),
    ),
  );
  if (clause >= limit * 0.55) return `${head.slice(0, clause)}…`;
  return `${head.slice(0, head.lastIndexOf(" ", limit - 3))}…`;
}

/** The subject's plain name: "Michael Locke (stuntman)" → "Michael Locke". */
export function plainName(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export interface EditContext {
  lens: Lens;
  /** The story's title: the subject of single-subject films. */
  title: string;
}

/**
 * Edit a film's chapters. Captions are tidied, clipped where a reader can stop, and dropped when
 * they repeat an earlier caption, lean on a sentence that isn't there, or carry a broken quote.
 * A leading "He"/"She"/"It" opening a chapter of a single-subject film becomes the subject's
 * name. A chapter whose every caption goes stays as a short silent shot (5 seconds): the
 * camera still flies there under the chapter's title.
 */
export function editChapters(chapters: ChapterDraft[], ctx: EditContext): ChapterDraft[] {
  const kept: string[] = [];
  const name = plainName(ctx.title);
  const nameWords = meaning(name);
  return chapters.map((c) => {
    const beats: ChapterDraft["beats"] = [];
    for (const b of c.beats) {
      let text = tidy(b.text);
      if (SUBJECT_PRONOUN.test(text) && beats.length === 0) {
        if (SUBJECT_LENSES.has(ctx.lens) && name) text = text.replace(SUBJECT_PRONOUN, name);
      }
      const leaning = ORPHAN.test(text) || (SUBJECT_PRONOUN.test(text) && beats.length === 0);
      const broken = !quotesBalanced(text);
      // An outlet's headline, quoted and credited, is attribution, not repetition.
      const repeated = !QUOTED_HEADLINE.test(text) && repeats(kept, text, nameWords);
      if (leaning || broken || repeated) continue;
      text = clip(text);
      beats.push({ ...b, text });
      kept.push(text);
    }
    // Every caption gone: a short silent shot instead of a repeated line.
    if (!beats.length && c.beats.length) return { ...c, beats, seconds: Math.min(c.seconds, 5) };
    return { ...c, beats };
  });
}

export interface CaptionIssue {
  index: number;
  kind: "long" | "repeat" | "orphan" | "quote" | "cut" | "punctuation";
  text: string;
}

/** What a reader would trip on, caption by caption: the quality check run on every film. */
export function captionIssues(texts: string[], title = ""): CaptionIssue[] {
  const out: CaptionIssue[] = [];
  const nameWords = meaning(plainName(title));
  texts.forEach((text, index) => {
    const add = (kind: CaptionIssue["kind"]) => out.push({ index, kind, text });
    if (text.length > MAX_CAPTION) add("long");
    if (!QUOTED_HEADLINE.test(text) && repeats(texts.slice(0, index), text, nameWords))
      add("repeat");
    if (ORPHAN.test(text)) add("orphan");
    if (!quotesBalanced(text)) add("quote");
    if (/…$/.test(text)) add("cut");
    if (/[^.]\.\.(?!\.)|\s[,.;:]/.test(text)) add("punctuation");
  });
  return out;
}
