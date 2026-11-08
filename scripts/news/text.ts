// Headline text → comparable tokens. Pure.
// Words are lower-cased, possessives and plurals folded, everyday words dropped; places are
// added as canonical tokens ("@pl", "@krakow") so "Polish police" and "Krakow gunman" share one.

const STOP = new Set(
  `a an the and or but if of in on at to for from by with as is are was were be been being
  has have had do does did not no nor so than too very can could will would shall should may
  might must its it this that these those there their them they he she his her him we our you
  your i me my who whom whose which what when where why how all any both each few more most
  other some such only own same just also into over under after before about against between
  through during without within up down out off again further then once here new says say said
  amid after over vs via per like near more than latest live update updates watch video
  report reports reported news us uk eu`.split(/\s+/),
);

/** "Krakow's", "attacks" → "krakow", "attack"; short words and stop words dropped. */
export function words(title: string): string[] {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem);
}

/**
 * A light stemmer, enough to fold the forms headlines use: "mourns", "mourning" → "mourn";
 * "launches" → "launch"; "killed" → "kill". Not a linguistic stemmer: it only has to make the
 * same word meet itself across outlets.
 */
export function stem(word: string): string {
  const w = suffixless(word);
  // "sentence" and "sentenced" must meet: a final e goes too ("sentenc").
  return w.length > 4 && w.endsWith("e") ? w.slice(0, -1) : w;
}

function suffixless(w: string): string {
  if (w.length > 6 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ied")) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ed") && !w.endsWith("eed")) return w.slice(0, -2);
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us"))
    return w.slice(0, -1);
  return w;
}

/** Inverse document frequency over a pool of token sets: rare words (names) weigh more. */
export function idfOf(docs: Set<string>[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const idf = new Map<string, number>();
  for (const [t, k] of df) idf.set(t, Math.log(1 + n / k));
  return idf;
}

/** Cosine similarity of two token sets, each token weighted by its IDF. */
export function similarity(a: Set<string>, b: Set<string>, idf: Map<string, number>): number {
  let shared = 0;
  let na = 0;
  let nb = 0;
  const w = (t: string) => idf.get(t) ?? 1;
  for (const t of a) {
    const x = w(t) ** 2;
    na += x;
    if (b.has(t)) shared += x;
  }
  for (const t of b) nb += w(t) ** 2;
  return na && nb ? shared / Math.sqrt(na * nb) : 0;
}
