// The universal election layer: Wikipedia's election infobox, used by almost every election
// article in the world ({{Infobox election}}, {{Infobox legislative election}}, …). Verified
// 2026-11-04 on "2026 Israeli legislative election" and "2026 United States House of
// Representatives elections": both use partyN, leaderN, percentageN, seatsN, seats_beforeN,
// last_electionN, majority_seats, seats_for_election, turnout, last_update, election_date.
// Pure: wikitext in, numbers out. CC BY-SA text, so values are cited to the exact revision.

export interface InfoboxParty {
  /** 1-based position in the infobox (party1, party2, …). */
  n: number;
  /** Display name, links and markup removed. */
  name: string;
  /** Linked article title, to look up the party's colour on Wikidata. */
  link?: string;
  leader?: string;
  /** Vote share, percent. */
  pct?: number;
  seats?: number;
  seatsBefore?: number;
  /** Seats at the previous election, when given as a number. */
  lastElection?: number;
}

export interface Infobox {
  country?: string;
  date?: string;
  seatsForElection?: string;
  majority?: number;
  /** Turnout, percent. */
  turnout?: number;
  /** "As of" stamp written by Wikipedia editors, verbatim. */
  lastUpdate?: string;
  parties: InfoboxParty[];
}

/** The template body of the first election infobox, braces balanced; undefined if none. */
export function infoboxBody(wikitext: string): string | undefined {
  const start = wikitext.search(/\{\{\s*Infobox[^|}]*election/i);
  if (start < 0) return undefined;
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i++;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return wikitext.slice(start + 2, i - 1);
    }
  }
  return undefined;
}

/** Split template parameters at top-level pipes (not inside [[…]] or {{…}}). */
export function params(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let depth = 0;
  let current = "";
  const flush = () => {
    const eq = current.indexOf("=");
    if (eq > 0) out.set(current.slice(0, eq).trim(), current.slice(eq + 1).trim());
    current = "";
  };
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      current += two;
      i++;
    } else if (two === "}}" || two === "]]") {
      depth--;
      current += two;
      i++;
    } else if (body[i] === "|" && depth === 0) {
      flush();
    } else {
      current += body[i];
    }
  }
  flush();
  return out;
}

/** Wiki markup → plain text: links to their labels, templates and refs dropped. */
export function plainText(v: string): string {
  return v
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first linked title in a value, e.g. "[[Likud]]" → "Likud". */
function firstLink(v: string): string | undefined {
  return /\[\[([^\]|#]+)/.exec(v)?.[1]?.trim();
}

/** A number in a value ("'''231'''", "20.52", "77.97% (↑ 7.34pp)"), or undefined. */
export function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(plainText(v));
  if (!m) return undefined;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function parseInfobox(wikitext: string): Infobox | undefined {
  const body = infoboxBody(wikitext);
  if (!body) return undefined;
  const p = params(body);
  const parties: InfoboxParty[] = [];
  for (let n = 1; n <= 40; n++) {
    const raw = p.get(`party${n}`);
    if (raw === undefined) continue;
    const name = plainText(raw);
    if (!name) continue;
    const link = firstLink(raw) ?? (/[[{]/.test(raw) ? undefined : raw.trim());
    const leader = p.get(`leader${n}`);
    const pct = num(p.get(`percentage${n}`));
    const seats = num(p.get(`seats${n}`));
    const before = num(p.get(`seats_before${n}`));
    const last = p.get(`last_election${n}`);
    const lastElection = last && /^\D*\d/.test(plainText(last)) ? num(last) : undefined;
    parties.push({
      n,
      name,
      ...(link ? { link } : {}),
      ...(leader && plainText(leader) ? { leader: plainText(leader) } : {}),
      ...(pct !== undefined ? { pct } : {}),
      ...(seats !== undefined ? { seats } : {}),
      ...(before !== undefined ? { seatsBefore: before } : {}),
      ...(lastElection !== undefined ? { lastElection } : {}),
    });
  }
  const turnout = num(p.get("turnout"));
  const majority = num(p.get("majority_seats"));
  const country = p.get("country");
  const date = p.get("election_date");
  const seatsFor = p.get("seats_for_election");
  const lastUpdate = p.get("last_update");
  return {
    ...(country ? { country: plainText(country) } : {}),
    ...(date ? { date: dateFrom(date) } : {}),
    ...(seatsFor ? { seatsForElection: plainText(seatsFor) } : {}),
    ...(majority !== undefined ? { majority } : {}),
    ...(turnout !== undefined ? { turnout } : {}),
    ...(lastUpdate ? { lastUpdate: plainText(lastUpdate) } : {}),
    parties,
  };
}

/** "{{Start date|2026|10|27|df=y}}" → "2026-10-27"; plain text otherwise. */
function dateFrom(v: string): string {
  const m =
    /\{\{\s*(?:Start date|start date and age)\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i.exec(
      v,
    );
  if (m?.[1] && m[2] && m[3]) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return plainText(v);
}
