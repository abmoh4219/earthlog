// The election lens (PLAN.md Phase 6). Generic first, deep where a country adapter exists:
//   1. Universal: any election article's infobox → seats and vote share by party, the country
//      lit in the leading party's colour (Israel 2026, and any election anywhere).
//   2. US adapter: Senate and governor races by state, House races by district, painted by
//      winning party; flips stronger, uncalled races grey.
// Results are "as recorded by Wikipedia at bake time", with that time on screen; never
// "certified" (RESPONSIBLE-USE §7). Builds on the general lens (story, readers, sources).
import type { LayerData, Source } from "../../../src/scene/schema.ts";
import { slugify } from "../../edition/build.ts";
import { fetchEntities, fetchQids } from "../../edition/sources.ts";
import type { ChapterDraft, PanelDraft } from "../film.ts";
import { generalLens, type LensContext, type LensResult, sharedLayer } from "../general.ts";
import { fetchRevision } from "../news-context.ts";
import { type Infobox, type InfoboxParty, num, parseInfobox } from "./infobox.ts";
import { fetchDistricts, fetchStates } from "./shapes.ts";
import { type Party, parseHouseRaces, parseStateRaces, type Race, stateName, tally } from "./us.ts";

// ── Fetching an article at an exact revision ───────────────────────────────────────

export interface Article {
  title: string;
  revid: number;
  timestamp: string;
  wikitext: string;
  url: string;
}

export async function fetchArticle(title: string): Promise<Article | undefined> {
  // Through fetchRevision, so the edition's revision cutoff applies (ADR-0014).
  const rev = await fetchRevision(title);
  return rev
    ? {
        ...rev,
        url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(rev.title.replace(/ /g, "_"))}&oldid=${rev.revid}`,
      }
    : undefined;
}

// ── Colours ──────────────────────────────────────────────────────────────────────

const FALLBACK = [
  "#7fb4ff",
  "#ff8a80",
  "#ffd166",
  "#5ce69a",
  "#c39bff",
  "#5ef2ff",
  "#ff9ecb",
  "#b0bec5",
];
const UNCALLED = "#8a96a3";

/** Lift dark party colours so they read on a dark globe; keeps the hue. */
export function readable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return hex;
  const v = Number.parseInt(m[1], 16);
  let [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum < 0.45) {
    const k = 0.45 - lum + 0.15;
    [r, g, b] = [r, g, b].map((c) => Math.round(c + (255 - c) * k)) as [number, number, number];
  }
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Party colour from Wikidata (P465 "sRGB colour hex triplet"), by the party's article. */
async function partyColors(links: string[]): Promise<Map<string, string>> {
  const qids = await fetchQids(links);
  const entities = await fetchEntities([...qids.values()]);
  const out = new Map<string, string>();
  links.forEach((link, i) => {
    const hex = entities.get(qids.get(link) ?? "")?.strings?.P465?.[0];
    out.set(link, readable(hex ? `#${hex}` : (FALLBACK[i % FALLBACK.length] ?? "#9ad9ff")));
  });
  return out;
}

const PARTY_LABEL: Record<Party, string> = {
  D: "Democratic",
  R: "Republican",
  I: "Independent",
  O: "Other",
};

const listOf = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

// ── The lens ─────────────────────────────────────────────────────────────────────

export async function electionLens(ctx: LensContext): Promise<LensResult> {
  const { story, date } = ctx;
  const year = date.slice(0, 4);
  const dayStart = `${date}T00:00:00Z`;
  const us = story.place?.country === "US" || /United States/.test(story.title);

  // Which articles hold results: the story's own, its related ones, and for the US the
  // Senate, House and governor articles of that year.
  const titles = [
    ...new Set([story.article?.title, ...story.related].filter((t): t is string => !!t)),
  ];
  const usTitles = us
    ? {
        senate: `${year} United States Senate elections`,
        house: `${year} United States House of Representatives elections`,
        governors: `${year} United States gubernatorial elections`,
      }
    : undefined;
  const articles = new Map<string, Article>();
  for (const t of [...titles, ...Object.values(usTitles ?? {})]) {
    const a = await fetchArticle(t);
    if (a) articles.set(t, a);
  }

  // The universal layer: the first article with a real results infobox.
  const main = [...articles.values()]
    .map((a) => ({ a, box: parseInfobox(a.wikitext) }))
    .find(
      ({ box }) =>
        (box?.parties.filter((p) => p.seats !== undefined || p.pct !== undefined).length ?? 0) >= 2,
    );

  // US adapter data.
  const senateA = usTitles ? articles.get(usTitles.senate) : undefined;
  const houseA = usTitles ? articles.get(usTitles.house) : undefined;
  const govA = usTitles ? articles.get(usTitles.governors) : undefined;
  const senate = senateA ? parseStateRaces(senateA.wikitext, "Senate") : [];
  const governors = govA ? parseStateRaces(govA.wikitext, "gubernatorial") : [];
  const house = houseA ? parseHouseRaces(houseA.wikitext) : [];
  const usColors = us
    ? await partyColors(["Democratic Party (United States)", "Republican Party (United States)"])
    : new Map<string, string>();
  const colorOf: Record<Party, string> = {
    D: usColors.get("Democratic Party (United States)") ?? "#7fb4ff",
    R: usColors.get("Republican Party (United States)") ?? "#ff8a80",
    I: "#c39bff",
    O: "#b0bec5",
  };
  const states =
    us && (senate.length || governors.length) ? await fetchStates() : new Map<string, number[][]>();
  const districts = us && house.length ? await fetchDistricts() : new Map<string, number[][]>();

  const mainColors = main
    ? await partyColors(main.box?.parties.map((p) => p.link ?? p.name) ?? [])
    : new Map();
  const census: Source = {
    id: "census",
    name: "US Census Bureau, TIGERweb (state and 120th Congress district shapes)",
    url: "https://tigerweb.geo.census.gov/",
    license: "Public domain (U.S. Government work)",
    attribution: "US Census Bureau",
    retrievedAt: ctx.at,
  };

  return generalLens(ctx, {
    ...(states.size || districts.size ? { sources: [census] } : {}),
    shape: ({ chapters, layers, add, home }) => {
      // An election is explained by its results, not by "where" and Wikidata trivia.
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      // The general lens tints the country in the lens colour and pins its place; an election
      // map uses party colours and needs no pin.
      for (let i = layers.length - 1; i >= 0; i--) {
        const kind = layers[i]?.kind;
        if ((kind === "regions" || kind === "places" || kind === "arcs") && !sharedLayer(layers[i]))
          layers.splice(i, 1);
      }

      const cite = (a: Article, key: string, label: string) =>
        add({
          id: `elex:${slugify(a.title)}:${key}`,
          kind: "sensor",
          source: "wikipedia-article",
          t: dayStart,
          precision: "day",
          label: `Wikipedia, "${a.title}" (revision of ${a.timestamp.slice(0, 16).replace("T", " ")} UTC): ${label}`,
          url: a.url,
        });

      const inserts: ChapterDraft[] = [];
      // Maps must stay readable: tilted for depth, but almost still while a map is on screen.
      const usShot = { lon: -97, lat: 34.5, range: 6.2e6, pitch: -58, motion: "still" as const };

      if (us && senateA && senate.length) {
        inserts.push(
          stateMapChapter(
            "The Senate",
            "senate",
            senateA,
            senate,
            states,
            colorOf,
            cite,
            layers,
            usShot,
          ),
        );
      }
      if (us && govA && governors.length) {
        inserts.push(
          stateMapChapter(
            "Governors",
            "governors",
            govA,
            governors,
            states,
            colorOf,
            cite,
            layers,
            usShot,
          ),
        );
      }
      if (us && houseA && house.length) {
        inserts.push(houseChapter(houseA, house, districts, colorOf, cite, layers, usShot));
      }
      if (!us && main?.box) {
        inserts.push(resultChapter(main.a, main.box, mainColors, cite, layers, ctx, home));
      }

      // Each map hides when the next one appears; the last stays on for the rest of the film.
      inserts.forEach((c, i) => {
        const next = inserts[i + 1]?.reveal?.find((k) => k.startsWith("regions-"));
        const mine = c.reveal?.find((k) => k.startsWith("regions-"));
        if (next && mine) inserts[i + 1] = { ...(inserts[i + 1] as ChapterDraft), hide: [mine] };
      });
      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}

type Cite = (a: Article, key: string, label: string) => string;

/** Senate or governors: states filled by winning party; flips stronger; uncalled grey. */
function stateMapChapter(
  title: string,
  name: string,
  a: Article,
  races: Race[],
  states: Map<string, number[][]>,
  colorOf: Record<Party, string>,
  cite: Cite,
  layers: LayerData[],
  shot: { lon: number; lat: number; range: number; pitch: number },
): ChapterDraft {
  // A state with a regular and a special race shows the regular one.
  const byState = new Map<string, Race>();
  for (const r of races) if (!byState.has(r.state) || !r.special) byState.set(r.state, r);
  layers.push({
    kind: "regions",
    name,
    regions: [...byState.values()].flatMap((r) => {
      const rings = states.get(r.geoid);
      if (!rings) return [];
      return [
        {
          id: r.id,
          name: stateName(r.state),
          rings,
          color: r.winner ? colorOf[r.winner] : UNCALLED,
          opacity: r.winner ? (r.flip ? 0.78 : 0.5) : 0.3,
          ...(r.flip ? { pulse: true } : {}),
        },
      ];
    }),
    legend: legend(colorOf),
  });

  const t = tally(races);
  const office = title === "Governors" ? "governor's races" : "Senate races";
  const sumId = cite(
    a,
    `${title.toLowerCase().replace(/\s+/g, "-")}-table`,
    `${office}: ${t.D} won by Democrats, ${t.R} by Republicans${t.I ? `, ${t.I} by independents` : ""}, ${t.uncalled} not yet called`,
  );
  const flipIds = t.flips.map((r) =>
    cite(
      a,
      `${name}-${r.id.toLowerCase()}`,
      `${stateName(r.state)}: ${PARTY_LABEL[r.winner ?? "O"]} gain${r.winnerName ? `, ${r.winnerName}` : ""}`,
    ),
  );
  const beats = [
    {
      text: `${races.length} ${office} this year: Democrats won ${t.D}, Republicans ${t.R}${t.uncalled ? `, ${t.uncalled} not yet called` : ""}.`,
      cites: [sumId],
    },
  ];
  const gainsBy = (p: Party) =>
    t.flips.filter((r) => r.winner === p).map((r) => stateName(r.state));
  for (const p of ["D", "R"] as Party[]) {
    const gains = gainsBy(p);
    if (gains.length) {
      beats.push({
        text: `${PARTY_LABEL[p]} gains: ${listOf(gains)}.`,
        cites: t.flips
          .filter((r) => r.winner === p)
          .map((r) => flipIds[t.flips.indexOf(r)] ?? sumId),
      });
    }
  }
  const panels: PanelDraft[] = [
    {
      id: `${name}-tally`,
      kind: "bars",
      title: title === "Governors" ? "Governor's races won" : "Senate races won",
      unit: "races",
      note: `As recorded by Wikipedia at ${a.timestamp.slice(11, 16)} UTC, ${a.timestamp.slice(0, 10)}. Called or projected, not certified.`,
      items: [
        { label: "Democratic", value: t.D, color: colorOf.D, cites: [sumId] },
        { label: "Republican", value: t.R, color: colorOf.R, cites: [sumId] },
        ...(t.I ? [{ label: "Independent", value: t.I, color: colorOf.I, cites: [sumId] }] : []),
        ...(t.uncalled
          ? [{ label: "Not yet called", value: t.uncalled, color: UNCALLED, cites: [sumId] }]
          : []),
      ],
    },
  ];
  if (t.flips.length) {
    panels.push({
      id: `${name}-flips`,
      kind: "facts",
      title: "Seats that changed party",
      items: t.flips.slice(0, 6).map((r, i) => ({
        label: stateName(r.state),
        text: `${PARTY_LABEL[r.winner ?? "O"]} gain${r.winnerName ? ` · ${r.winnerName}` : ""}`,
        color: colorOf[r.winner ?? "O"],
        cites: [flipIds[i] ?? sumId],
      })),
    });
  }
  return { title, seconds: 6 + beats.length * 4, shot, beats, panels, reveal: [`regions-${name}`] };
}

/** The House: every district filled by its winner; seat totals from the article's infobox. */
function houseChapter(
  a: Article,
  races: Race[],
  districts: Map<string, number[][]>,
  colorOf: Record<Party, string>,
  cite: Cite,
  layers: LayerData[],
  shot: { lon: number; lat: number; range: number; pitch: number },
): ChapterDraft {
  layers.push({
    kind: "regions",
    name: "house",
    regions: races.flatMap((r) => {
      const rings = districts.get(r.geoid);
      if (!rings) return [];
      return [
        {
          id: r.id,
          name: `${stateName(r.state)} ${r.district === "00" ? "at-large" : Number(r.district)}`,
          rings,
          color: r.winner ? colorOf[r.winner] : UNCALLED,
          opacity: r.winner ? (r.flip ? 0.8 : 0.48) : 0.28,
          ...(r.flip ? { pulse: true } : {}),
        },
      ];
    }),
    legend: legend(colorOf),
  });
  const box = parseInfobox(a.wikitext);
  const d = box?.parties.find((p) => /Democratic/.test(p.name));
  const r = box?.parties.find((p) => /Republican/.test(p.name));
  const t = tally(races);
  const tableId = cite(
    a,
    "house-table",
    `race tables: ${t.D} districts won by Democrats, ${t.R} by Republicans, ${t.uncalled} not yet called, ${t.flips.length} changed party`,
  );
  const beats: ChapterDraft["beats"] = [];
  const panels: PanelDraft[] = [];
  if (d?.seats !== undefined && r?.seats !== undefined) {
    const boxId = cite(
      a,
      "house-infobox",
      `House seats: Democrats ${d.seats}, Republicans ${r.seats}${box?.majority ? `; ${box.majority} for a majority` : ""}${box?.lastUpdate ? ` (last updated ${box.lastUpdate})` : ""}`,
    );
    const total = num(box?.seatsForElection) ?? 435;
    const pending = Math.max(0, total - d.seats - r.seats);
    beats.push({
      text: `The House: Democrats ${d.seats} seats, Republicans ${r.seats}${pending ? `, ${pending} still to be called` : ""}. ${box?.majority ?? 218} make a majority.`,
      cites: [boxId],
    });
    panels.push({
      id: "house-seats",
      kind: "seats",
      title: "The new House",
      total,
      majority: box?.majority ?? 218,
      note: `One dot per seat. Infobox as of ${box?.lastUpdate ?? a.timestamp}; called or projected, not certified.`,
      items: [
        {
          label: "Democratic",
          value: d.seats,
          text: d.seatsBefore !== undefined ? `${d.seats} (was ${d.seatsBefore})` : String(d.seats),
          color: colorOf.D,
          cites: [boxId],
        },
        {
          label: "Republican",
          value: r.seats,
          text: r.seatsBefore !== undefined ? `${r.seats} (was ${r.seatsBefore})` : String(r.seats),
          color: colorOf.R,
          cites: [boxId],
        },
        ...(pending
          ? [{ label: "Not yet called", value: pending, color: UNCALLED, cites: [boxId] }]
          : []),
      ],
    });
  }
  beats.push({
    text: `On the map: ${t.flips.length} districts changed party; ${t.uncalled} not yet called in the race tables.`,
    cites: [tableId],
  });
  return {
    title: "The House",
    seconds: 14,
    shot: { ...shot, range: shot.range * 0.92 },
    beats,
    panels,
    reveal: ["regions-house"],
  };
}

/** Any country: seats and vote share from the infobox; the country in the leader's colour. */
function resultChapter(
  a: Article,
  box: Infobox,
  colors: Map<string, string>,
  cite: Cite,
  layers: LayerData[],
  ctx: LensContext,
  home: { lon: number; lat: number; range: number },
): ChapterDraft {
  const parties = box.parties.filter((p) => p.seats !== undefined || p.pct !== undefined);
  const bySeats = parties.some((p) => p.seats !== undefined);
  const ranked = [...parties].sort((x, y) =>
    bySeats ? (y.seats ?? 0) - (x.seats ?? 0) : (y.pct ?? 0) - (x.pct ?? 0),
  );
  const lead = ranked[0] as InfoboxParty;
  const colorFor = (p: InfoboxParty) => colors.get(p.link ?? p.name) ?? "#9ad9ff";
  const ids = new Map(
    ranked.map((p) => [
      p.n,
      cite(
        a,
        `party${p.n}`,
        `${p.name}${p.leader ? ` (${p.leader})` : ""}: ${p.seats !== undefined ? `${p.seats} seats` : ""}${p.seats !== undefined && p.pct !== undefined ? ", " : ""}${p.pct !== undefined ? `${p.pct}% of the vote` : ""}`,
      ),
    ]),
  );
  const summaryId = cite(
    a,
    "summary",
    [
      box.seatsForElection,
      box.majority ? `${box.majority} for a majority` : "",
      box.turnout ? `turnout ${box.turnout}%` : "",
      box.lastUpdate ? `as of ${box.lastUpdate}` : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  const country = ctx.countries.find(
    (c) => c.code === ctx.story.place?.country || c.name === box.country,
  );
  if (country) {
    layers.push({
      kind: "regions",
      name: "result",
      regions: [
        {
          id: country.code,
          name: country.name,
          rings: country.rings,
          color: colorFor(lead),
          opacity: 0.4,
        },
      ],
      legend: [{ label: `Most seats: ${lead.name}`, color: colorFor(lead) }],
    });
  }
  const leadId = ids.get(lead.n) ?? summaryId;
  const beats = [
    {
      text: bySeats
        ? `${lead.name}${lead.leader ? `, led by ${lead.leader},` : ""} won the most seats: ${lead.seats}${box.majority ? `, short of the ${box.majority} needed for a majority` : ""}.`
        : `${lead.name}${lead.leader ? ` (${lead.leader})` : ""} led with ${lead.pct}% of the vote.`,
      cites: box.majority && bySeats ? [leadId, summaryId] : [leadId],
    },
  ];
  if (bySeats && box.majority && (lead.seats ?? 0) >= box.majority) {
    beats[0] = {
      text: `${lead.name}${lead.leader ? `, led by ${lead.leader},` : ""} won a majority: ${lead.seats} seats of the ${box.majority} needed.`,
      cites: [leadId, summaryId],
    };
  }
  if (box.turnout !== undefined)
    beats.push({ text: `Turnout: ${box.turnout}%.`, cites: [summaryId] });

  const panels: PanelDraft[] = [];
  const top = ranked.slice(0, 6); // two panels must fit on screen
  const seated = ranked.filter((p) => (p.seats ?? 0) > 0);
  const seatSum = seated.reduce((n, p) => n + (p.seats ?? 0), 0);
  const total = num(box.seatsForElection) ?? seatSum;
  if (bySeats && seated.length && total >= seatSum) {
    // A parliament chart of every party with seats; the vote-share bars follow.
    panels.push({
      id: "parliament",
      kind: "seats",
      title: "The new parliament",
      total,
      ...(box.majority ? { majority: box.majority } : {}),
      note: `One dot per seat; parties ordered by size, not by political position.${box.lastUpdate ? ` As recorded by Wikipedia (${box.lastUpdate}).` : ""}`,
      items: seated.map((p) => ({
        label: p.name,
        value: p.seats ?? 0,
        color: colorFor(p),
        cites: [ids.get(p.n) ?? summaryId],
      })),
    });
  } else if (bySeats) {
    panels.push({
      id: "seats",
      kind: "bars",
      title: "Seats won",
      unit: "seats",
      note: `${box.seatsForElection ?? ""}${box.majority ? ` · ${box.majority} for a majority` : ""}. As recorded by Wikipedia${box.lastUpdate ? ` (${box.lastUpdate})` : ""}.`,
      items: top
        .filter((p) => p.seats !== undefined)
        .map((p) => ({
          label: p.name,
          value: p.seats ?? 0,
          text:
            p.lastElection !== undefined ? `${p.seats} (was ${p.lastElection})` : String(p.seats),
          color: colorFor(p),
          cites: [ids.get(p.n) ?? summaryId],
        })),
    });
  }
  if (top.some((p) => p.pct !== undefined)) {
    panels.push({
      id: "votes",
      kind: "bars",
      title: "Share of the vote",
      unit: "%",
      items: top
        .filter((p) => p.pct !== undefined)
        .map((p) => ({
          label: p.name,
          value: p.pct ?? 0,
          text: `${p.pct}%`,
          color: colorFor(p),
          cites: [ids.get(p.n) ?? summaryId],
        })),
    });
  }
  return {
    title: "The result",
    seconds: 14,
    shot: { lon: home.lon, lat: home.lat - 2, range: Math.max(home.range, 2.6e6), pitch: -48 },
    beats,
    panels,
    reveal: ["regions-result"],
  };
}

function legend(colorOf: Record<Party, string>) {
  return [
    { label: "Democratic", color: colorOf.D },
    { label: "Republican", color: colorOf.R },
    { label: "Brighter: changed party", color: "#ffffff" },
    { label: "Not yet called", color: UNCALLED },
  ];
}
