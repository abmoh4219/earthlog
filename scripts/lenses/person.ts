// The person lens: a life drawn across the globe from Wikidata.
// Stops: birthplace (P19) → education (P69) → clubs (P54) / employers (P108) / residences
// (P551) / work locations (P937), dated by their start (P580) and end (P582) qualifiers →
// place of death (P20). Organisations are placed at their home ground (P115), headquarters
// (P159), location (P276) or city (P131), else their country. Awards (P166) and notable works
// (P800) become "Recognition". Verified 2026-11-04 on Patrick Stewart (Q16296) and Jesús de
// Miguel (Q116992476, nine clubs with years).
// Respect (RESPONSIBLE-USE §8): deaths are stated plainly, with no cause unless a cited report
// gives one, and only people with their own Wikipedia article (public figures) get this lens.
import { LENS_INFO } from "../../src/scene/edition.ts";
import type { Evidence, LayerData, Panel } from "../../src/scene/schema.ts";
import { fetchEntities, type WdEntity } from "../edition/sources.ts";
import type { ChapterDraft, PanelDraft } from "./film.ts";
import {
  generalLens,
  type LensContext,
  type LensResult,
  sharedLayer,
  wideShot,
} from "./general.ts";

type StopKind = "born" | "education" | "team" | "employer" | "residence" | "work" | "died";

interface Stop {
  kind: StopKind;
  /** The organisation or place, e.g. "CD Tenerife" or "Mirfield". */
  name: string;
  start?: string;
  end?: string;
  lon: number;
  lat: number;
  evidence: string;
}

const LIFE_PROPS: [string, StopKind][] = [
  ["P69", "education"],
  ["P54", "team"],
  ["P108", "employer"],
  ["P551", "residence"],
  ["P937", "work"],
];

const KIND_LABEL: Record<StopKind, string> = {
  born: "born in",
  education: "educated at",
  team: "played for",
  employer: "worked for",
  residence: "lived in",
  work: "worked in",
  died: "died in",
};

const year = (d?: string) => d?.slice(0, 4);

function dateText(d: string): string {
  if (/^\d{4}$/.test(d)) return d;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : d;
}

/** Whole years between two YYYY-MM-DD dates (undefined if either is only a year). */
export function ageAt(born: string, died: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(born) || !/^\d{4}-\d{2}-\d{2}$/.test(died)) return undefined;
  const [by, bm, bd] = born.split("-").map(Number);
  const [dy, dm, dd] = died.split("-").map(Number);
  if (
    by === undefined ||
    bm === undefined ||
    bd === undefined ||
    dy === undefined ||
    dm === undefined ||
    dd === undefined
  )
    return undefined;
  return dy - by - (dm < bm || (dm === bm && dd < bd) ? 1 : 0);
}

/** "2015–16", "2019", "1966–", or "" from start/end years. */
export function span(start?: string, end?: string): string {
  const s = year(start);
  const e = year(end);
  if (s && e) return s === e ? s : `${s}–${e.slice(0, 2) === s.slice(0, 2) ? e.slice(2) : e}`;
  return s ? `${s}–` : (e ?? "");
}

/** Chronological order: birth, then dated stops by start, undated ones in record order, death. */
export function orderStops(stops: Stop[]): Stop[] {
  const born = stops.filter((s) => s.kind === "born");
  const died = stops.filter((s) => s.kind === "died");
  const middle = stops.filter((s) => s.kind !== "born" && s.kind !== "died");
  const dated = middle
    .filter((s) => s.start)
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const undated = middle.filter((s) => !s.start);
  return [
    ...born,
    ...undated.filter((s) => s.kind === "education"),
    ...dated,
    ...undated.filter((s) => s.kind !== "education"),
    ...died,
  ];
}

export async function personLens(ctx: LensContext): Promise<LensResult> {
  const qid = ctx.story.article?.qid;
  const first = qid ? await fetchEntities([qid]) : new Map<string, WdEntity>();
  const person = qid ? first.get(qid) : undefined;
  // Only people (Wikidata "human", Q5) get a life on the globe.
  if (!qid || !person || !person.items.P31?.includes("Q5")) return generalLens(ctx);

  // Fetch the items a life points to, then their homes and countries (up to three hops).
  const entities = new Map(first);
  const want = (e: WdEntity | undefined, props: string[]) =>
    props.flatMap((p) => e?.items[p] ?? []);
  const lifeItems = [
    ...want(person, ["P19", "P20", "P106", "P27"]),
    ...LIFE_PROPS.flatMap(([p]) => person.dated?.[p]?.map((d) => d.item) ?? []),
    ...(person.dated?.P166 ?? []).map((d) => d.item),
    ...(person.items.P800 ?? []),
  ];
  for (const [k, v] of await fetchEntities(lifeItems)) entities.set(k, v);
  for (let hop = 0; hop < 2; hop++) {
    const next = [...entities.values()]
      .flatMap((e) => want(e, ["P115", "P159", "P276", "P131", "P17"]))
      .filter((id) => !entities.has(id));
    if (!next.length) break;
    for (const [k, v] of await fetchEntities(next)) entities.set(k, v);
  }

  const coordOf = (id: string | undefined, depth = 0): { lon: number; lat: number } | undefined => {
    const e = id ? entities.get(id) : undefined;
    if (!e) return undefined;
    if (e.coord) return e.coord;
    if (depth > 2) return undefined;
    for (const p of ["P115", "P159", "P276", "P131"]) {
      const c = coordOf(e.items[p]?.[0], depth + 1);
      if (c) return c;
    }
    const iso = entities.get(e.items.P17?.[0] ?? "")?.iso2;
    const country = iso ? ctx.countries.find((c) => c.code === iso) : undefined;
    return country ? { lon: country.label[0], lat: country.label[1] } : undefined;
  };
  const label = (id: string | undefined) => (id ? entities.get(id)?.label : undefined);
  const name = person.label ?? ctx.story.title;
  const dayStart = `${ctx.date}T00:00:00Z`;
  const wdUrl = `https://www.wikidata.org/wiki/${qid}`;

  const evidence: Evidence[] = [];
  const cite = (prop: string, text: string, item?: string) => {
    const id = `wd:${qid}:${prop}${item ? `:${item}` : ""}`;
    evidence.push({
      id,
      kind: "sensor",
      source: "wikidata",
      t: dayStart,
      precision: "day",
      label: `Wikidata, "${name}": ${text}`,
      url: `${wdUrl}#${prop}`,
    });
    return id;
  };

  // ── The stops ──
  const born = person.times?.P569?.[0];
  const died = person.times?.P570?.[0];
  const stops: Stop[] = [];
  const birthplace = person.items.P19?.[0];
  const bc = coordOf(birthplace);
  if (birthplace && bc && label(birthplace)) {
    stops.push({
      kind: "born",
      name: label(birthplace) ?? "",
      ...(born ? { start: born } : {}),
      ...bc,
      evidence: cite("P19", `place of birth ${label(birthplace)}`),
    });
  }
  for (const [prop, kind] of LIFE_PROPS) {
    for (const d of (person.dated?.[prop] ?? []).slice(0, 14)) {
      const c = coordOf(d.item);
      const n = label(d.item);
      if (!c || !n) continue;
      const when = span(d.start, d.end);
      stops.push({
        kind,
        name: n,
        ...(d.start ? { start: d.start } : {}),
        ...(d.end ? { end: d.end } : {}),
        ...c,
        evidence: cite(prop, `${KIND_LABEL[kind]} ${n}${when ? ` (${when})` : ""}`, d.item),
      });
    }
  }
  const deathplace = person.items.P20?.[0];
  const dc = coordOf(deathplace);
  if (deathplace && dc && label(deathplace)) {
    stops.push({
      kind: "died",
      name: label(deathplace) ?? "",
      ...(died ? { start: died } : {}),
      ...dc,
      evidence: cite("P20", `place of death ${label(deathplace)}`),
    });
  }
  const life = orderStops(stops);
  const bornId = born ? cite("P569", `born ${dateText(born)}`) : undefined;
  const diedId = died ? cite("P570", `died ${dateText(died)}`) : undefined;

  // Recognition: awards with years, notable works.
  const awards = (person.dated?.P166 ?? [])
    .map((d) => ({ name: label(d.item), when: d.at ?? d.start, item: d.item }))
    .filter((a): a is { name: string; when: string | undefined; item: string } => !!a.name)
    .sort((a, b) => (a.when ?? "9999").localeCompare(b.when ?? "9999"));
  const works = (person.items.P800 ?? []).flatMap((id) =>
    label(id) ? [{ id, name: label(id) ?? "" }] : [],
  );

  const color = LENS_INFO.person.color;
  return generalLens(ctx, {
    shape: ({ chapters, layers, add }) => {
      for (const e of evidence) add(e);
      // A life replaces the general "where" and "on record"; its own pins and arcs replace
      // the general ones, and no country is tinted (a person is not their country).
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      for (let i = layers.length - 1; i >= 0; i--) {
        const kind = layers[i]?.kind;
        if ((kind === "places" || kind === "arcs" || kind === "regions") && !sharedLayer(layers[i]))
          layers.splice(i, 1);
      }
      if (life.length) {
        layers.push({
          kind: "places",
          places: dedupe(life).map((s, i, all) => ({
            name: `${s.name}${year(s.start) ? ` · ${year(s.start)}` : ""}`,
            lon: s.lon,
            lat: s.lat,
            color,
            // Birth and death are the anchors of a life: always labelled, both pulse.
            ...(i === 0 || (s.kind === "died" && i === all.length - 1) ? { primary: true } : {}),
            // Labels of pins close to an earlier one would pile up; the panel lists them all.
            ...(all
              .slice(0, i)
              .some((q) => Math.abs(q.lon - s.lon) < 1.2 && Math.abs(q.lat - s.lat) < 0.9)
              ? { quiet: true }
              : {}),
          })),
        } satisfies LayerData);
      }
      const legs = journey(life);
      if (legs.length)
        layers.push({
          kind: "arcs",
          sequence: true,
          arcs: legs.map(([a, b]) => ({ from: [a.lon, a.lat], to: [b.lon, b.lat], color })),
        });

      const inserts: ChapterDraft[] = [];
      const birth = life.find((s) => s.kind === "born");
      if (birth) {
        inserts.push({
          title: "Born",
          seconds: 8,
          shot: { lon: birth.lon, lat: birth.lat - 0.9, range: 9e5, pitch: -36, heading: 14 },
          beats: [
            {
              text: born
                ? `${name} was born on ${dateText(born)} in ${birth.name}.`
                : `${name} was born in ${birth.name}.`,
              cites: [...(bornId ? [bornId] : []), birth.evidence],
            },
          ],
          reveal: ["places"],
        });
      }

      const middle = life.filter((s) => s.kind !== "born" && s.kind !== "died");
      if (middle.length) {
        const beats: ChapterDraft["beats"] = [];
        const teams = middle.filter((s) => s.kind === "team");
        if (teams.length >= 2) {
          const from = year(teams[0]?.start);
          const to = year(teams.at(-1)?.end ?? teams.at(-1)?.start);
          beats.push({
            text: `Played for ${teams.length} clubs${from && to ? ` from ${from} to ${to}` : ""}: from ${teams[0]?.name} to ${teams.at(-1)?.name}.`,
            cites: teams.map((s) => s.evidence),
          });
        }
        const school = middle.filter((s) => s.kind === "education");
        if (school.length)
          beats.push({
            text: `Educated at ${listOf(school.map((s) => s.name))}.`,
            cites: school.map((s) => s.evidence),
          });
        const work = middle.filter((s) => s.kind === "employer" || s.kind === "work");
        if (work.length && beats.length < 2)
          beats.push({
            text: `Worked with ${listOf(work.map((s) => s.name))}.`,
            cites: work.map((s) => s.evidence),
          });
        if (!beats.length)
          beats.push({
            text: `${middle.length} places on record across a life.`,
            cites: middle.map((s) => s.evidence),
          });
        const panel: PanelDraft = {
          id: "life",
          kind: "facts",
          title: "A life on record",
          note: "As recorded in Wikidata (CC0). Organisations are placed at their home ground or headquarters.",
          items: life.slice(0, 9).map((s) => ({
            label:
              s.kind === "born" || s.kind === "died"
                ? `${year(s.start) ?? ""} ${s.kind}`.trim()
                : span(s.start, s.end) || KIND_LABEL[s.kind],
            text: s.name,
            cites: [s.evidence],
          })),
        };
        inserts.push({
          title: "A life across the globe",
          seconds: Math.min(26, Math.max(10, 4 + legs.length * 1.5)),
          shot: wideShot(life) ?? {
            lon: middle[0]?.lon ?? 0,
            lat: middle[0]?.lat ?? 0,
            range: 4e6,
          },
          beats,
          panels: [panel],
          reveal: ["arcs"],
        });
      }

      if (awards.length || works.length) {
        const items: Extract<Panel, { kind: "facts" }>["items"] = [];
        const awardIds = awards
          .slice(0, 6)
          .map((a) =>
            cite("P166", `award received: ${a.name}${a.when ? ` (${year(a.when)})` : ""}`, a.item),
          );
        awards.slice(0, 6).forEach((a, i) => {
          items.push({ label: year(a.when) ?? "Award", text: a.name, cites: [awardIds[i] ?? ""] });
        });
        const workIds = works.slice(0, 3).map((w) => cite("P800", `notable work: ${w.name}`, w.id));
        works.slice(0, 3).forEach((w, i) => {
          items.push({ label: "Known for", text: w.name, cites: [workIds[i] ?? ""] });
        });
        for (const e of evidence) add(e);
        const beats: ChapterDraft["beats"] = [];
        if (awards.length) {
          const top = awards.filter((a) => a.when).slice(-2);
          const shown = top.length ? top : awards.slice(0, 2);
          beats.push({
            text: `${awards.length} award${awards.length > 1 ? "s" : ""} on record, including ${listOf(shown.map((a) => `${a.name}${a.when ? ` (${year(a.when)})` : ""}`))}.`,
            cites: shown.map((a) => awardIds[awards.indexOf(a)] ?? awardIds[0] ?? ""),
          });
        }
        if (works.length)
          beats.push({
            text: `Known for ${listOf(works.slice(0, 3).map((w) => w.name))}.`,
            cites: workIds,
          });
        inserts.push({
          title: "Recognition",
          seconds: 6 + beats.length * 4,
          shot: wideShot(life) ?? { lon: 0, lat: 20, range: 1.2e7 },
          beats: beats.map((b) => ({ ...b, cites: b.cites.filter(Boolean) })),
          panels: [
            {
              id: "recognition",
              kind: "facts",
              title: "Recognition",
              note: "As recorded in Wikidata.",
              items,
            },
          ],
        });
      }

      const death = life.find((s) => s.kind === "died");
      if (died && death) {
        const age = born ? ageAt(born, died) : undefined;
        inserts.push({
          title: "In memory",
          seconds: 8,
          shot: { lon: death.lon, lat: death.lat - 0.9, range: 9e5, pitch: -34, heading: -18 },
          beats: [
            {
              text: `${name} died on ${dateText(died)} in ${death.name}${age !== undefined ? `, aged ${age}` : ""}.`,
              cites: [
                ...(diedId ? [diedId] : []),
                death.evidence,
                ...(age !== undefined && bornId ? [bornId] : []),
              ],
            },
          ],
        });
      }

      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}

/** Consecutive stops in the same place collapse into one pin. */
function dedupe(stops: Stop[]): Stop[] {
  return stops.filter((s, i) => {
    const prev = stops[i - 1];
    return !prev || Math.abs(prev.lon - s.lon) > 0.25 || Math.abs(prev.lat - s.lat) > 0.25;
  });
}

/** The legs of the journey: consecutive stops in different places. */
function journey(stops: Stop[]): [Stop, Stop][] {
  const legs: [Stop, Stop][] = [];
  const pins = dedupe(stops);
  for (let i = 1; i < pins.length; i++) {
    const a = pins[i - 1];
    const b = pins[i];
    if (a && b) legs.push([a, b]);
  }
  return legs;
}

function listOf(xs: string[]): string {
  const u = [...new Set(xs)];
  if (u.length <= 1) return u[0] ?? "";
  if (u.length > 4) return `${u.slice(0, 3).join(", ")} and ${u.length - 3} more`;
  return `${u.slice(0, -1).join(", ")} and ${u.at(-1)}`;
}
