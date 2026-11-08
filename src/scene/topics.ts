// Topics: the reader's way to filter the news ("For you"), shared by every source of stories.
// Headlines are classified by scripts/news/topic.ts; edition stories map from their lens.
import { z } from "zod";
import type { Lens } from "./edition.ts";

export const TOPICS = [
  "conflict",
  "politics",
  "disaster",
  "climate",
  "business",
  "tech",
  "science",
  "health",
  "crime",
  "sports",
  "culture",
  "world",
] as const;

export const Topic = z.enum(TOPICS);
export type Topic = z.infer<typeof Topic>;

export const TOPIC_LABEL: Record<Topic, string> = {
  conflict: "War and conflict",
  politics: "Politics",
  disaster: "Disasters",
  climate: "Climate",
  business: "Business",
  tech: "Tech",
  science: "Science and space",
  health: "Health",
  crime: "Law and crime",
  sports: "Sports",
  culture: "Culture",
  world: "World",
};

/** The topic an edition story belongs to, from the lens that explains it. */
export const LENS_TOPIC: Record<Lens, Topic> = {
  election: "politics",
  conflict: "conflict",
  accident: "disaster",
  disaster: "disaster",
  sports: "sports",
  economy: "business",
  science: "science",
  culture: "culture",
  organization: "tech",
  person: "world",
  general: "world",
};
