// News categories: one list shared by the baker (to classify) and the player (to colour).
// Wikipedia's Current events portal uses these headings (verified 2026-11-04, e.g.
// "Armed conflicts and attacks", "Art and culture" / "Arts and culture", "Sports").

export interface NewsCategory {
  key: string;
  label: string;
  color: string;
  /** Lower comes first when the director picks which stories make the replay. */
  rank: number;
  /** Lower-case fragments of the portal's heading that map to this category. */
  match: string[];
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  { key: "politics", label: "Politics", color: "#4a8cf7", rank: 1, match: ["politic", "election"] },
  {
    key: "conflict",
    label: "Conflict",
    color: "#ff4d5e",
    rank: 2,
    match: ["armed conflict", "attack"],
  },
  {
    key: "disaster",
    label: "Disaster",
    color: "#ffb547",
    rank: 3,
    match: ["disaster", "accident"],
  },
  { key: "sports", label: "Sports", color: "#5ce69a", rank: 4, match: ["sport"] },
  {
    key: "science",
    label: "Science & tech",
    color: "#6fb7ff",
    rank: 5,
    match: ["science", "technolog"],
  },
  { key: "business", label: "Business", color: "#ffd95e", rank: 6, match: ["business", "econom"] },
  { key: "world", label: "World", color: "#5ef2ff", rank: 7, match: ["international relation"] },
  {
    key: "health",
    label: "Health & environment",
    color: "#4fe0c8",
    rank: 8,
    match: ["health", "environment"],
  },
  { key: "culture", label: "Culture", color: "#e8838f", rank: 9, match: ["art", "culture"] },
  { key: "law", label: "Law & crime", color: "#a9b8c8", rank: 10, match: ["law", "crime"] },
];

const OTHER: NewsCategory = {
  key: "other",
  label: "News",
  color: "#9ad9ff",
  rank: 11,
  match: [],
};

export function categoryFromHeading(heading: string): NewsCategory {
  const h = heading.toLowerCase();
  return NEWS_CATEGORIES.find((c) => c.match.some((m) => h.includes(m))) ?? OTHER;
}

export function categoryByKey(key: string): NewsCategory {
  return NEWS_CATEGORIES.find((c) => c.key === key) ?? OTHER;
}
