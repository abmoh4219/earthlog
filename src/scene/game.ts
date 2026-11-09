// "Where was it?" (ADR-0024): the daily game. Pure; shared by the build (the rounds are made
// with the edition, src/app/play/page.tsx) and the page (scoring, the streak). Each round is
// one placed story of yesterday's edition with its places hidden; the reader clicks the globe
// where they think it happened and scores by distance.
import type { Edition } from "./edition.ts";
import { LENS_INFO } from "./edition.ts";

export interface Round {
  slug: string;
  /** The story's opening sentence with every place hidden. */
  clue: string;
  /** What kind of story (the lens label), a fair hint. */
  kind: string;
  answer: { lon: number; lat: number; name: string };
  /** Shown after the guess: the story's real title, and whether it has a film. */
  title: string;
  film: boolean;
}

export const ROUNDS = 5;
const OUTLET_NAMES = [
  "France 24",
  "Al Jazeera",
  "Sky News",
  "BBC News",
  "The Guardian",
  "DW",
  "NPR",
  "AllAfrica",
];

/** Up to the first full stop that ends a sentence (not "U.S." or "St."). */
function firstSentence(text: string): string {
  const m = /^(.{40,}?[a-z0-9)”"'’])\.\s+(?=[A-Z])/.exec(text);
  return m ? `${m[1]}.` : text;
}
const HIDDEN = "▢▢▢";

/**
 * Up to five rounds from an edition: placed stories whose clue still says something once its
 * places are hidden, hottest first, at most two from one country (so it is a tour, not a quiz
 * about one place).
 */
export function roundsOf(
  edition: Edition,
  mask: (text: string) => string,
  films: Set<string>,
  isCountry: (name: string) => boolean = () => false,
): Round[] {
  const perCountry = new Map<string, number>();
  const out: Round[] = [];
  for (const s of edition.stories) {
    if (out.length >= ROUNDS) break;
    const p = s.place;
    // A whole country is too easy and too vague to score: a city or a precise point only.
    if (!p || p.role === "Country" || p.role === "Country of citizenship" || isCountry(p.name))
      continue;
    const key = p.country ?? p.name;
    if ((perCountry.get(key) ?? 0) >= 2) continue;
    // The first sentence only; outlets' names are not places ("France 24", "Al Jazeera").
    const sentence = firstSentence(s.headline ?? s.summary);
    const kept = OUTLET_NAMES.reduce((t, n, i) => t.split(n).join(`\uE000${i}\uE000`), sentence);
    const masked = mask(hideNames(kept, [p.name, ...p.name.split(/,\s*/)]));
    const clue = masked.replace(
      /\uE000(\d+)\uE000/g,
      (_, i: string) => OUTLET_NAMES[Number(i)] ?? "",
    );
    // Too little left to reason about once the places are hidden.
    if (clue.replace(new RegExp(HIDDEN, "g"), "").trim().split(/\s+/).length < 6) continue;
    perCountry.set(key, (perCountry.get(key) ?? 0) + 1);
    out.push({
      slug: s.slug,
      clue,
      kind: LENS_INFO[s.lens].label,
      answer: { lon: p.lon, lat: p.lat, name: p.name },
      title: s.title,
      film: films.has(s.slug),
    });
  }
  return out;
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Hide names the gazetteer may not know ("El Ayyat"), accents folded ("Krakow" = "Kraków"). */
export function hideNames(text: string, names: string[]): string {
  let out = text;
  for (const n of names.filter((x) => x.length >= 3)) {
    const f = fold(n);
    const words = out.split(/(\s+)/);
    const len = n.split(/\s+/).length;
    for (let i = 0; i < words.length; i += 2) {
      const span = words.slice(i, i + len * 2 - 1).join("");
      const core = span.replace(/^[("'‘“]+|(['’]s)?[,.:;!?"'’”)]*$/g, "");
      if (fold(core) === f) {
        const tail = span.slice(span.indexOf(core) + core.length);
        const lead = span.slice(0, span.indexOf(core));
        words.splice(i, len * 2 - 1, `${lead}${HIDDEN}${tail}`);
      }
    }
    out = words.join("");
  }
  return out;
}

/** Great-circle distance in kilometres (haversine, mean Earth radius). */
export function distanceKm(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 1,000 on the spot, 500 at about 1,400 km, near nothing beyond 10,000 km. */
export function scoreFor(km: number): number {
  if (km <= 50) return 1000;
  return Math.round(1000 * Math.exp(-(km - 50) / 2000));
}

export interface Stats {
  /** The last edition date played. */
  last?: string;
  /** Consecutive editions played, up to `last`. */
  streak: number;
  best: number;
  /** Edition date → total score. */
  scores: Record<string, number>;
}

export const EMPTY_STATS: Stats = { streak: 0, best: 0, scores: {} };

/**
 * The stats after finishing the game of `date`: the streak grows when the day before was
 * played, starts again at 1 otherwise; a day already played changes nothing.
 */
export function finish(stats: Stats, date: string, score: number): Stats {
  if (stats.scores[date] !== undefined) return stats;
  const yesterday = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const streak = stats.last === yesterday ? stats.streak + 1 : 1;
  return {
    last: date,
    streak,
    best: Math.max(stats.best, score),
    scores: { ...stats.scores, [date]: score },
  };
}

/** One square per round, for sharing a result without the answers ("🟩🟨⬛🟩🟥"). */
export function squares(scores: number[]): string {
  return scores.map((s) => (s >= 800 ? "🟩" : s >= 400 ? "🟨" : s >= 100 ? "🟧" : "🟥")).join("");
}
