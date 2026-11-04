// Which lens explains a story, from what Wikidata says its main article *is* (P31 "instance
// of" labels), with the news heading as a hint when there's no article. Pure and tested.
// Verified 2026-11-04 on the 3 Nov edition: "human", "legislative election", "aviation
// accident", "film", "television series season", "association football club", "central bank",
// "armed conflict", "civil war", "blockade", "sponsored top-level domain"…
import type { Lens } from "../../src/scene/edition.ts";

/** Checked in order: the first rule whose words appear in any P31 label wins. */
const RULES: [Lens, string[]][] = [
  ["election", ["election", "referendum", "by-election", "primary election"]],
  [
    "conflict",
    [
      "war",
      "armed conflict",
      "insurgency",
      "coup",
      "battle",
      "military operation",
      "blockade",
      "massacre",
      "attack",
      "terrorist",
      "airstrike",
      "siege",
      "rebellion",
    ],
  ],
  [
    "accident",
    [
      "accident",
      "crash",
      "shipwreck",
      "derailment",
      "collision",
      "explosion",
      "structural failure",
      "fire disaster",
    ],
  ],
  [
    "disaster",
    [
      "earthquake",
      "tropical cyclone",
      "hurricane",
      "typhoon",
      "wildfire",
      "flood",
      "volcanic eruption",
      "tsunami",
      "landslide",
      "heat wave",
      "drought",
      "blizzard",
      "storm",
    ],
  ],
  [
    "sports",
    [
      "sport",
      "sporting event",
      "racing",
      "football club",
      "horse race",
      "tournament",
      "championship",
      "olympic",
      "grand prix",
      "match",
      "season of",
      "league",
      "cup final",
      "racehorse",
    ],
  ],
  [
    "science",
    [
      "spaceflight",
      "space probe",
      "spacecraft",
      "rocket launch",
      "satellite",
      "space mission",
      "space telescope",
      "comet",
      "asteroid",
      "scientific discovery",
    ],
  ],
  [
    "economy",
    [
      "central bank",
      "stock exchange",
      "stock market",
      "currency",
      "recession",
      "tariff",
      "economic",
      "financial crisis",
      "interest rate",
      "budget",
    ],
  ],
  [
    "culture",
    [
      "film",
      "television",
      "series",
      "season",
      "album",
      "song",
      "single",
      "video game",
      "novel",
      "book",
      "musical",
      "award",
      "prize",
      "festival",
      "anime",
      "concert",
      "tour",
    ],
  ],
  [
    "organization",
    [
      "company",
      "business",
      "enterprise",
      "organization",
      "organisation",
      "corporation",
      "startup",
      "website",
      "service on internet",
      "software",
      "top-level domain",
      "social network",
      "app",
      "brand",
      "product",
      "aircraft model",
      "automobile model",
      "chatbot",
      "large language model",
    ],
  ],
  ["person", ["human"]],
];

/** Labels that mean "this page is not a story" (lists, calendars, disambiguation). */
const NOT_A_STORY = [
  "wikimedia list article",
  "wikimedia disambiguation page",
  "calendar year",
  "calendar day",
  "wikimedia category",
];

export function isNotAStory(p31Labels: string[]): boolean {
  return p31Labels.some((l) => NOT_A_STORY.includes(l.toLowerCase()));
}

function matches(label: string, word: string): boolean {
  // Whole words, so "art" doesn't match "party" and "war" doesn't match "award".
  return new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(
    label,
  );
}

export function lensFromTypes(p31Labels: string[]): Lens | undefined {
  for (const [lens, words] of RULES) {
    if (p31Labels.some((label) => words.some((w) => matches(label, w)))) return lens;
  }
  return undefined;
}

/** Wikipedia Current events headings → a lens, when the story has no typed article. */
export function lensFromHeading(heading: string): Lens {
  const h = heading.toLowerCase();
  if (h.includes("armed conflict") || h.includes("attack")) return "conflict";
  if (h.includes("disaster") || h.includes("accident")) return "accident";
  if (h.includes("sport")) return "sports";
  if (h.includes("business") || h.includes("econom")) return "economy";
  if (h.includes("science") || h.includes("technolog")) return "science";
  if (h.includes("art") || h.includes("culture")) return "culture";
  return "general";
}
