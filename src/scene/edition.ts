// An edition: one UTC day's stories, ranked, each with the lens that will explain it
// (ADR-0012). Shared by the edition builder (scripts/edition) and the site.
import { z } from "zod";
import { EvidenceId } from "./schema.ts";

export const LENSES = [
  "election",
  "conflict",
  "accident",
  "disaster",
  "sports",
  "economy",
  "science",
  "culture",
  "organization",
  "person",
  "general",
] as const;

export const Lens = z.enum(LENSES);
export type Lens = z.infer<typeof Lens>;

export const LENS_INFO: Record<Lens, { label: string; color: string }> = {
  election: { label: "Election", color: "#b49bff" },
  conflict: { label: "Conflict", color: "#ff4d5e" },
  accident: { label: "Accident", color: "#e8f6ff" },
  disaster: { label: "Disaster", color: "#ffb547" },
  sports: { label: "Sports", color: "#5ce69a" },
  economy: { label: "Economy", color: "#ffd95e" },
  science: { label: "Science & space", color: "#6fb7ff" },
  culture: { label: "Culture", color: "#ff8fd0" },
  organization: { label: "Tech & business", color: "#5ef2ff" },
  person: { label: "People", color: "#f5c2a0" },
  general: { label: "News", color: "#9ad9ff" },
};

export const Continent = z.enum([
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
]);
export type Continent = z.infer<typeof Continent>;

export const EditionStory = z.object({
  /** URL-safe and stable for the day: /story/<date>/<slug>. */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  lens: Lens,
  title: z.string().min(1),
  /** One plain sentence: the news item, or the article's short description. */
  summary: z.string(),
  /** The main article's opening sentences (Wikipedia, CC BY-SA), when known. */
  about: z.string().optional(),
  /** What happened, in one sentence: the film's first caption (set when the story is filmed). */
  headline: z.string().optional(),
  /** The story's main Wikipedia article, if it has one. */
  article: z
    .object({
      title: z.string(),
      url: z.url(),
      qid: z
        .string()
        .regex(/^Q\d+$/)
        .optional(),
    })
    .optional(),
  place: z
    .object({
      name: z.string(),
      lon: z.number(),
      lat: z.number(),
      /** ISO alpha-2 of the country the place is in, when known. */
      country: z.string().length(2).optional(),
      /** What the place is, e.g. "Place of death" or "Headquarters"; cited by `evidence`. */
      role: z.string().optional(),
      evidence: EvidenceId.optional(),
    })
    .optional(),
  continent: Continent.optional(),
  /** 0–100 within the edition; see scripts/edition/build.ts for the formula. */
  heat: z.number().min(0).max(100),
  /** English Wikipedia readers that day, summed over the story's articles (if any). */
  readers: z.number().int().nonnegative().optional(),
  /** Readers that day ÷ the median of the previous days (if known). */
  spike: z.number().nonnegative().optional(),
  /** Number of outlets cited by the day's news items for this story. */
  sources: z.number().int().nonnegative(),
  /** Other most-read articles folded into this story (e.g. candidates into an election). */
  related: z.array(z.string()),
  /** Why it is in the edition and what it rests on: news reports, readers, the lens's basis. */
  evidence: z.array(EvidenceId).min(1),
});
export type EditionStory = z.infer<typeof EditionStory>;

export const Edition = z.object({
  version: z.literal(1),
  date: z.iso.date(),
  generatedAt: z.iso.datetime({ offset: false }),
  /** How many candidates were considered before ranking. */
  candidates: z.number().int().nonnegative(),
  stories: z.array(EditionStory),
});
export type Edition = z.infer<typeof Edition>;
