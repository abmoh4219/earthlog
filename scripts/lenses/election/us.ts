// US adapter for the election lens: race-by-race results from Wikipedia's Senate, governor
// and House articles, for the deepest map (states and congressional districts).
// Verified 2026-11-04 on "2026 United States Senate elections" and "2026 United States House
// of Representatives elections". Each race is a table row:
//   Senate: "! [[2026 United States Senate election in Alabama|Alabama]]" … result cell
//           ("Republican hold.", "Democratic gain.", "Incumbent advanced to general") …
//           candidates, the winner marked "{{aye}} '''[[Name]]''' (Republican)".
//   House:  "!{{ushr|AL|3|X}}" … same pattern.
// A row with no {{aye}} is a race not yet called. Pure.

export type Party = "D" | "R" | "I" | "O";

export interface Race {
  /** "AL" for a state race; "AL-03" for a House district. */
  id: string;
  state: string;
  /** House district number ("00" for at-large); absent for statewide races. */
  district?: string;
  /** Census GEOID: state FIPS (+ district), matching TIGERweb shapes. */
  geoid: string;
  /** Winner's party, or undefined while the race is not called. */
  winner?: Party;
  winnerName?: string;
  /** Party that held the seat before, when the row says. */
  incumbent?: Party;
  /** True when the seat changed party (a "gain" for the winner). */
  flip: boolean;
  /** "special" for special elections (a state can have two Senate races). */
  special: boolean;
}

/** US states and DC: name, postal code, FIPS. */
export const STATES: [name: string, postal: string, fips: string][] = [
  ["Alabama", "AL", "01"],
  ["Alaska", "AK", "02"],
  ["Arizona", "AZ", "04"],
  ["Arkansas", "AR", "05"],
  ["California", "CA", "06"],
  ["Colorado", "CO", "08"],
  ["Connecticut", "CT", "09"],
  ["Delaware", "DE", "10"],
  ["District of Columbia", "DC", "11"],
  ["Florida", "FL", "12"],
  ["Georgia", "GA", "13"],
  ["Hawaii", "HI", "15"],
  ["Idaho", "ID", "16"],
  ["Illinois", "IL", "17"],
  ["Indiana", "IN", "18"],
  ["Iowa", "IA", "19"],
  ["Kansas", "KS", "20"],
  ["Kentucky", "KY", "21"],
  ["Louisiana", "LA", "22"],
  ["Maine", "ME", "23"],
  ["Maryland", "MD", "24"],
  ["Massachusetts", "MA", "25"],
  ["Michigan", "MI", "26"],
  ["Minnesota", "MN", "27"],
  ["Mississippi", "MS", "28"],
  ["Missouri", "MO", "29"],
  ["Montana", "MT", "30"],
  ["Nebraska", "NE", "31"],
  ["Nevada", "NV", "32"],
  ["New Hampshire", "NH", "33"],
  ["New Jersey", "NJ", "34"],
  ["New Mexico", "NM", "35"],
  ["New York", "NY", "36"],
  ["North Carolina", "NC", "37"],
  ["North Dakota", "ND", "38"],
  ["Ohio", "OH", "39"],
  ["Oklahoma", "OK", "40"],
  ["Oregon", "OR", "41"],
  ["Pennsylvania", "PA", "42"],
  ["Rhode Island", "RI", "44"],
  ["South Carolina", "SC", "45"],
  ["South Dakota", "SD", "46"],
  ["Tennessee", "TN", "47"],
  ["Texas", "TX", "48"],
  ["Utah", "UT", "49"],
  ["Vermont", "VT", "50"],
  ["Virginia", "VA", "51"],
  ["Washington", "WA", "53"],
  ["West Virginia", "WV", "54"],
  ["Wisconsin", "WI", "55"],
  ["Wyoming", "WY", "56"],
];

const byName = new Map(STATES.map(([name, postal, fips]) => [name, { postal, fips }]));
const byPostal = new Map(STATES.map(([name, postal, fips]) => [postal, { name, fips }]));

export function partyOf(text: string | undefined): Party | undefined {
  if (!text) return undefined;
  // Minnesota's Democratic–Farmer–Labor Party ("DFL") is the state's Democratic Party.
  if (/\bDemocrat/i.test(text) || /\bDFL\b/.test(text)) return "D";
  if (/\bRepublican/i.test(text)) return "R";
  if (/\bIndependent/i.test(text)) return "I";
  return "O";
}

/** Split a wikitable section into rows ("|-" separators). */
function rows(wikitext: string): string[] {
  return wikitext.split(/\n\|-[^\n]*/);
}

/** The winner line ("{{aye}} '''[[Name]]''' (Party)") of a row, if the race is called. */
function winnerOf(row: string): { party?: Party; name: string } | undefined {
  const line = row.split("\n").find((l) => /\{\{\s*aye\s*\}\}/i.test(l));
  if (!line) return undefined;
  const party = /\(([^()]*)\)\s*(?:<ref|$|\{\{|\s*$)/.exec(
    line.replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, ""),
  )?.[1];
  const name =
    /\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/.exec(line)?.[1] ?? /'''([^']+)'''/.exec(line)?.[1] ?? "";
  const p = partyOf(party);
  return { ...(p ? { party: p } : {}), name: name.trim() };
}

/**
 * The incumbent's party: a cell that is just a party name (Senate, House), or a
 * "{{party shading/Text/Republican}}" cell (governors).
 */
function incumbentOf(row: string): Party | undefined {
  const m =
    /\n\|[^\n]*?\|\s*(Republican|Democratic|Independent|Democratic[–-]Farmer[–-]Labor)\s*\n/.exec(
      `\n${row}\n`,
    );
  const shading = /\{\{\s*party shading\/Text\/(Republican|Democratic|Independent)\s*\}\}/i.exec(
    row,
  );
  return partyOf(m?.[1] ?? shading?.[1]);
}

function race(id: string, state: string, geoid: string, row: string, district?: string): Race {
  const win = winnerOf(row);
  const incumbent = incumbentOf(row);
  const winner = win?.party;
  // A flip needs both sides known; "gain" in the result cell confirms it.
  const flip =
    winner !== undefined &&
    ((incumbent !== undefined && incumbent !== winner) ||
      /\b(Democratic|Republican|Independent) gain/i.test(row));
  return {
    id,
    state,
    ...(district !== undefined ? { district } : {}),
    geoid,
    ...(winner ? { winner } : {}),
    ...(win?.name ? { winnerName: win.name } : {}),
    ...(incumbent ? { incumbent } : {}),
    flip,
    special: /\(special\)|special election/i.test(row.split("\n")[1] ?? row.slice(0, 200)),
  };
}

/**
 * The same race appears in several tables (predictions, retirements, results). Keep the
 * most informative row per race: one with a declared winner, else one with a result cell.
 */
function best(byId: Map<string, Race[]>): Race[] {
  return [...byId.values()].map(
    (rs) => rs.find((r) => r.winner) ?? rs.find((r) => r.incumbent) ?? (rs[0] as Race),
  );
}

/** Statewide races (Senate, governors): rows headed by a link to "… election in <State>". */
export function parseStateRaces(wikitext: string, office: "Senate" | "gubernatorial"): Race[] {
  const byId = new Map<string, Race[]>();
  // Senate rows link "… Senate election in Alabama"; governor rows "2026 Alabama gubernatorial election".
  const head =
    office === "Senate"
      ? /^!\s*\[\[[^\]|]*Senate (?:special )?election in ([^\]|]+?)\s*(\(special\))?\|/m
      : /^!\s*\[\[\d{4} ([^\]|]+?) gubernatorial election\|/m;
  for (const row of rows(wikitext)) {
    const m = head.exec(row);
    const name = m?.[1]?.trim();
    const st = name ? byName.get(name) : undefined;
    if (!name || !st) continue;
    const special = Boolean(m?.[2]) || /Senate special election in/.test(m?.[0] ?? "");
    const id = special ? `${st.postal}-special` : st.postal;
    const r = { ...race(id, st.postal, st.fips, row), special };
    byId.set(id, [...(byId.get(id) ?? []), r]);
  }
  return best(byId);
}

/** House races: rows headed by "!{{ushr|AL|3|X}}" (at-large: "{{ushr|AK|AL|X}}"). */
export function parseHouseRaces(wikitext: string): Race[] {
  const byId = new Map<string, Race[]>();
  for (const row of rows(wikitext)) {
    const m = /^!\s*\{\{\s*ushr\s*\|\s*([A-Z]{2})\s*\|\s*(\d+|AL)\s*\|/im.exec(row);
    const postal = m?.[1];
    const st = postal ? byPostal.get(postal) : undefined;
    if (!m || !postal || !st) continue;
    const district = m[2] === "AL" ? "00" : (m[2] ?? "").padStart(2, "0");
    const id = `${postal}-${district}`;
    byId.set(id, [
      ...(byId.get(id) ?? []),
      race(id, postal, `${st.fips}${district}`, row, district),
    ]);
  }
  return best(byId);
}

export interface Tally {
  D: number;
  R: number;
  I: number;
  O: number;
  uncalled: number;
  flips: Race[];
}

export function tally(races: Race[]): Tally {
  const t: Tally = { D: 0, R: 0, I: 0, O: 0, uncalled: 0, flips: [] };
  for (const r of races) {
    if (!r.winner) t.uncalled++;
    else t[r.winner]++;
    if (r.flip) t.flips.push(r);
  }
  return t;
}

export function stateName(postal: string): string {
  return byPostal.get(postal)?.name ?? postal;
}
