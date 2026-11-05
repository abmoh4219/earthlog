// The accident lens (PLAN.md Phase 12): crashes, collisions, derailments, sinkings.
//   The flight   → origin, the crash site and the destination it never reached: the route
//                  flown drawn in red, the rest dashed; distances flown and left, computed
//                  from the cited coordinates and labelled as straight-line estimates;
//   The aircraft → the type, its maker and first flight (Wikidata), operator, registration;
//   On board     → occupants, fatalities, survivors as the article's infobox records them;
//   The investigation → the article's own sentences, cited.
// Every accident film stands on real terrain baked around the site.
// Tone (docs/RESPONSIBLE-USE.md): plain facts, attributed; no dramatisation of the victims.
// Verified 2026-11-05 on the 2026 Palm Beach County Learjet 60 crash ({{Infobox aircraft
// occurrence}}: site, coordinates, aircraft type, operator, tail number, origin, destination,
// occupants, passengers, crew, fatalities, survivors, ground injuries).

import { centralAngle } from "../../src/scene/camera.ts";
import type { Evidence, LayerData } from "../../src/scene/schema.ts";
import { bakeTerrain, terrainSource } from "../bake/terrain.ts";
import { fetchCoordinates } from "../bake/wikinews.ts";
import { fetchEntities, fetchQids } from "../edition/sources.ts";
import { boxItems, linkedSentences, links, sectionsMatching } from "./culture.ts";
import { anyInfobox } from "./election/infobox.ts";
import type { ChapterDraft, Shot } from "./film.ts";
import {
  generalLens,
  type LensContext,
  type LensHooks,
  type LensResult,
  sharedLayer,
  wideShot,
} from "./general.ts";
import { fetchRevision } from "./news-context.ts";

const RED = "#ff5a5f";
const ICE = "#9ad9ff";

/** "{{Coord|26|37|58.4|N|80|06|47.2|W|type:event}}" or "{{coord|26.63|-80.11}}" → lon/lat. */
export function parseCoord(v: string | undefined): { lon: number; lat: number } | undefined {
  const m = v ? /\{\{\s*coord\s*\|([^}]*)\}\}/i.exec(v) : null;
  if (!m) return undefined;
  const args = (m[1] ?? "")
    .split("|")
    .map((a) => a.trim())
    .filter((a) => a && !a.includes(":") && !a.includes("="));
  const ns = args.findIndex((a) => /^[NS]$/i.test(a));
  const dms = (parts: string[]) => parts.reduce((sum, p, i) => sum + Number(p) / 60 ** i, 0);
  if (ns > 0) {
    const ew = args.findIndex((a, i) => i > ns && /^[EW]$/i.test(a));
    if (ew < 0) return undefined;
    const lat = dms(args.slice(0, ns)) * (/S/i.test(args[ns] ?? "") ? -1 : 1);
    const lon = dms(args.slice(ns + 1, ew)) * (/W/i.test(args[ew] ?? "") ? -1 : 1);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lon, lat } : undefined;
  }
  const [lat, lon] = args.map(Number);
  return lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)
    ? { lon, lat }
    : undefined;
}

/** Straight-line kilometres between two points, rounded for speech ("about 1,640 km"). */
export function km(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const d = centralAngle(a.lon, a.lat, b.lon, b.lat) * 6371;
  return d >= 100 ? Math.round(d / 10) * 10 : Math.round(d);
}

/** Facts worth showing, in order: [label, infobox keys]. */
const FACTS: [label: string, keys: string[]][] = [
  ["Aircraft", ["aircraft type", "aircraft"]],
  ["Vehicle", ["vehicle", "trains", "train", "ship name", "ship"]],
  ["Operator", ["operator", "owner"]],
  ["Registration", ["tail number", "registration"]],
  ["Callsign", ["plane1 callsign", "callsign", "flight number"]],
  ["Occupants", ["occupants", "total occupants"]],
  ["Passengers", ["passengers"]],
  ["Crew", ["crew"]],
  ["Fatalities", ["fatalities", "deaths", "total fatalities"]],
  ["Injuries", ["injuries", "total injuries", "non-fatal injuries"]],
  ["Survivors", ["survivors", "total survivors"]],
  ["Ground fatalities", ["ground fatalities"]],
  ["Ground injuries", ["ground injuries"]],
  ["Summary", ["summary", "cause"]],
];

/** Terrain for any film with a site: a shape hook adding the layer, and its source. */
export async function terrainHooks(
  site: { lon: number; lat: number } | undefined,
  at: string,
): Promise<Pick<LensHooks, "sources"> & { layer?: LayerData }> {
  if (!site) return {};
  try {
    return { layer: await bakeTerrain(site.lon, site.lat), sources: [terrainSource(at)] };
  } catch (err) {
    // Terrain is a bonus: a film without it is still correct.
    console.warn(`  terrain skipped: ${err instanceof Error ? err.message : err}`);
    return {};
  }
}

/** Low, oblique shot over a site, the terrain rising in front of the camera. */
function siteShot(site: { lon: number; lat: number }, range = 1.4e5, heading = 24): Shot {
  return { lon: site.lon, lat: site.lat, range, pitch: -24, heading };
}

/** The general film on real terrain around the story's place (no article to read). */
export async function groundedLens(ctx: LensContext): Promise<LensResult> {
  const t = await terrainHooks(ctx.story.place, ctx.at);
  return generalLens(ctx, {
    ...(t.sources ? { sources: t.sources } : {}),
    shape: ({ chapters, layers }) => {
      if (t.layer) layers.push(t.layer);
      // Bring the "Where" chapter down to the ground, where the terrain is.
      const where = chapters.find((c) => c.title === "Where");
      if (where && ctx.story.place && t.layer) where.shot = siteShot(ctx.story.place, 1.1e5);
    },
  });
}

export async function accidentLens(ctx: LensContext): Promise<LensResult> {
  const title = ctx.story.article?.title;
  const rev = title ? await fetchRevision(title) : undefined;
  const box = rev ? anyInfobox(rev.wikitext) : undefined;

  // No article or infobox (a Current events item): the general film, on real terrain.
  if (!title || !rev || !box) return groundedLens(ctx);

  const raw = (keys: string[]) => {
    for (const k of keys) {
      const v = box.params.get(k);
      if (v && boxItems(v).length) return v;
    }
    return undefined;
  };
  const dayStart = `${ctx.date}T00:00:00Z`;
  const url = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(rev.title.replace(/ /g, "_"))}&oldid=${rev.revid}`;
  const when = rev.timestamp.slice(0, 16).replace("T", " ");
  const evidence: Evidence[] = [];
  const report = (id: string, label: string, quote: string) => {
    if (!evidence.some((e) => e.id === id))
      evidence.push({
        id,
        kind: "report",
        source: "wikipedia-article",
        t: dayStart,
        precision: "day",
        label: `Wikipedia, "${rev.title}" (revision of ${when} UTC): ${label}`,
        quote,
        url,
      });
    return id;
  };
  const boxId = (key: string, text: string) =>
    report(`wiki:box:${rev.revid}:${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, text, text);

  const facts = FACTS.flatMap(([label, keys]) => {
    const v = raw(keys);
    if (!v) return [];
    const text = boxItems(v).join(", ");
    if (!text || text.length > 120) return [];
    return [{ label, text, links: links(v), id: boxId(label, `${label.toLowerCase()}: ${text}`) }];
  });
  const fact = (l: string) => facts.find((f) => f.label === l);
  const count = (l: string) => {
    const n = Number(/^\d[\d,]*/.exec(fact(l)?.text ?? "")?.[0]?.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };

  // The site: the infobox's coordinates, else the story's place.
  const coord = parseCoord(box.params.get("coordinates") ?? box.params.get("coords"));
  const siteText = boxItems(box.params.get("site") ?? box.params.get("location") ?? "").join(", ");
  const siteId = coord
    ? report(
        `wiki:box:${rev.revid}:coordinates`,
        `site coordinates ${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}${siteText ? ` (${siteText})` : ""}`,
        `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`,
      )
    : undefined;
  const site = coord ?? ctx.story.place;
  const siteName = siteText.split(",")[0] || ctx.story.place?.name || "The site";

  // The route: origin and destination with coordinates (airports, stations, ports).
  const originRaw = raw(["origin", "origin station", "departure"]);
  const destRaw = raw(["destination", "destination station", "arrival"]);
  const originTitle = originRaw ? links(originRaw)[0] : undefined;
  const destTitle = destRaw ? links(destRaw)[0] : undefined;
  const coords = await fetchCoordinates([originTitle, destTitle].filter((t): t is string => !!t));
  const origin = originTitle ? coords.get(originTitle) : undefined;
  const dest = destTitle ? coords.get(destTitle) : undefined;
  const originName = originRaw ? (boxItems(originRaw)[0] ?? "").split(",")[0] : undefined;
  const destName = destRaw ? (boxItems(destRaw)[0] ?? "").split(",")[0] : undefined;
  const originId = originRaw
    ? boxId("origin", `origin: ${boxItems(originRaw).join(", ")}`)
    : undefined;
  const destId = destRaw
    ? boxId("destination", `destination: ${boxItems(destRaw).join(", ")}`)
    : undefined;

  // The type: its maker and first flight, from Wikidata.
  const typeTitle = fact("Aircraft")?.links[0] ?? fact("Vehicle")?.links[0];
  const typeQid = typeTitle ? (await fetchQids([typeTitle])).get(typeTitle) : undefined;
  const type = typeQid ? (await fetchEntities([typeQid])).get(typeQid) : undefined;
  const makerQid = type?.items.P176?.[0];
  const maker = makerQid ? (await fetchEntities([makerQid])).get(makerQid) : undefined;
  const firstFlight = type?.times?.P606?.[0];
  const typeEvidence = (prop: string, text: string) => {
    const id = `wd:${typeQid}:${prop}`;
    evidence.push({
      id,
      kind: "sensor",
      source: "wikidata",
      t: dayStart,
      precision: "day",
      label: `Wikidata, "${type?.label ?? typeTitle}": ${text}`,
      url: `https://www.wikidata.org/wiki/${typeQid}#${prop}`,
    });
    return id;
  };
  const makerId = maker?.label ? typeEvidence("P176", `manufacturer ${maker.label}`) : undefined;
  const firstId = firstFlight ? typeEvidence("P606", `first flight ${firstFlight}`) : undefined;

  // The investigation, and any timed sentences ("At 10:42 …"), in the article's words.
  const sectionSentences = (re: RegExp, key: string, max: number, filter = (_: string) => true) =>
    linkedSentences(sectionsMatching(rev.wikitext, re))
      .filter((s) => s.text.length <= 215 && filter(s.text))
      .slice(0, max)
      .map((s, n) => ({
        text: s.text,
        id: report(`wiki:${key}:${rev.revid}:${n}`, key, s.text),
      }));
  const investigation = sectionSentences(
    /^(investigation|investigations|inquiry|probe)$/i,
    "investigation",
    3,
  );
  const timeline = sectionSentences(
    /^(accident|crash|incident|flight|collision|derailment|sinking|the accident|the crash|background)$/i,
    "timeline",
    4,
    (t) => /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(a\.m\.|p\.m\.)/i.test(t),
  );

  const t = await terrainHooks(site, ctx.at);

  return generalLens(ctx, {
    ...(t.sources ? { sources: t.sources } : {}),
    shape: ({ chapters, layers, add }) => {
      for (let i = layers.length - 1; i >= 0; i--) {
        const kind = layers[i]?.kind;
        if ((kind === "places" || kind === "arcs") && !sharedLayer(layers[i])) layers.splice(i, 1);
      }
      if (t.layer) layers.push(t.layer);
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      const inserts: ChapterDraft[] = [];

      if (site) {
        layers.push({
          kind: "places",
          name: "site",
          places: [{ name: siteName, lon: site.lon, lat: site.lat, color: RED, primary: true }],
        } satisfies LayerData);
      }

      // 1. The flight (or journey): flown in red, the rest dashed.
      if (site && origin && dest && originName && destName && originId && destId) {
        layers.push({
          kind: "places",
          name: "route",
          places: [
            { name: originName, lon: origin.lon, lat: origin.lat, color: ICE },
            { name: destName, lon: dest.lon, lat: dest.lat, color: ICE },
          ],
        } satisfies LayerData);
        layers.push({
          kind: "arcs",
          name: "route",
          sequence: true,
          arcs: [
            { from: [origin.lon, origin.lat], to: [site.lon, site.lat], color: RED },
            { from: [site.lon, site.lat], to: [dest.lon, dest.lat], color: ICE, dashed: true },
          ],
        } satisfies LayerData);
        const flown = km(origin, site);
        const left = km(site, dest);
        const cites = [originId, destId, ...(siteId ? [siteId] : [])];
        inserts.push({
          title: "The journey",
          seconds: 15,
          shot: wideShot([origin, dest, site]) ?? siteShot(site, 2e6),
          beats: [
            {
              text: `It set out from ${originName}, bound for ${destName}.`,
              cites: [originId, destId],
            },
            {
              text: `It came down about ${flown.toLocaleString("en-GB")} km from ${originName} in a straight line, with about ${left.toLocaleString("en-GB")} km still to go.`,
              cites,
            },
          ],
          reveal: ["places-route", "arcs-route", "places-site"],
        });
      }

      // 2. The site, low over the ground.
      if (site) {
        const summary = fact("Summary");
        inserts.push({
          title: "The site",
          seconds: 9,
          shot: siteShot(site),
          beats: [
            {
              text: summary
                ? `${siteName}: ${summary.text.replace(/^./, (c) => c.toLowerCase())}.`
                : `It happened in ${siteText || siteName}.`,
              cites: [summary?.id, siteId].filter((x): x is string => !!x),
            },
          ].filter((b) => b.cites.length > 0),
          reveal: ["places-site"],
          hide: ["places-route"],
        });
      }

      // 3. The aircraft or vehicle.
      const vehicle = fact("Aircraft") ?? fact("Vehicle");
      const machine = [vehicle, fact("Operator"), fact("Registration"), fact("Callsign")].filter(
        (f): f is NonNullable<typeof f> => !!f,
      );
      if (vehicle) {
        const items: { label: string; text: string; cites: string[] }[] = [
          ...machine.map((f) => ({ label: f.label, text: f.text, cites: [f.id] })),
          ...(maker?.label && makerId
            ? [{ label: "Built by", text: maker.label, cites: [makerId] }]
            : []),
          ...(firstFlight && firstId
            ? [{ label: "Type first flew", text: firstFlight.slice(0, 4), cites: [firstId] }]
            : []),
        ];
        inserts.push({
          title: "The aircraft",
          seconds: 9,
          shot: site ? siteShot(site, 2.4e5, -30) : { lon: 0, lat: 20, range: 1.6e7 },
          beats: [
            {
              text: `The aircraft was a ${vehicle.text}${maker?.label ? `, built by ${maker.label}` : ""}${firstFlight ? `; the type first flew in ${firstFlight.slice(0, 4)}` : ""}${fact("Operator") ? `, operated by ${fact("Operator")?.text}` : ""}.`.replace(
                "The aircraft was a",
                fact("Aircraft") ? "The aircraft was a" : "The vehicle was",
              ),
              cites: [vehicle.id, makerId, firstId, fact("Operator")?.id].filter(
                (x): x is string => !!x,
              ),
            },
          ],
          panels: [
            {
              id: "vehicle",
              kind: "facts",
              title: fact("Aircraft") ? "The aircraft" : "The vehicle",
              note: `From the article's infobox (revision of ${rev.timestamp.slice(0, 10)}) and Wikidata.`,
              items,
            },
          ],
        });
      }

      // 4. On board: counts as the infobox records them.
      const people = [
        "Occupants",
        "Passengers",
        "Crew",
        "Fatalities",
        "Injuries",
        "Survivors",
        "Ground fatalities",
        "Ground injuries",
      ]
        .map((l) => ({ l, f: fact(l), n: count(l) }))
        .filter(
          (x): x is { l: string; f: NonNullable<ReturnType<typeof fact>>; n: number } =>
            !!x.f && x.n !== undefined,
        );
      if (people.length >= 2) {
        const occ = count("Occupants");
        const dead = count("Fatalities");
        const surv = count("Survivors");
        const pax = count("Passengers");
        const crew = count("Crew");
        const ids = (...ls: string[]) => ls.flatMap((l) => (fact(l) ? [fact(l)?.id ?? ""] : []));
        const beats: ChapterDraft["beats"] = [];
        if (occ !== undefined && dead !== undefined) {
          beats.push({
            text:
              dead >= occ && occ > 0
                ? `All ${occ} people on board died${pax !== undefined && crew !== undefined ? `: ${pax} passengers and ${crew} crew` : ""}, according to the article.`
                : `${dead} of the ${occ} people on board died${surv !== undefined ? ` and ${surv} survived` : ""}, according to the article.`,
            cites: ids("Occupants", "Fatalities", "Passengers", "Crew", "Survivors"),
          });
        } else if (dead !== undefined) {
          beats.push({ text: `The article records ${dead} deaths.`, cites: ids("Fatalities") });
        }
        const gi = count("Ground injuries");
        const gf = count("Ground fatalities");
        if (gf || gi)
          beats.push({
            text: `On the ground: ${[gf ? `${gf} killed` : "", gi ? `${gi} injured` : ""].filter(Boolean).join(", ")}.`,
            cites: ids("Ground fatalities", "Ground injuries"),
          });
        if (beats.length)
          inserts.push({
            title: "On board",
            seconds: 5 + beats.length * 6,
            shot: site ? siteShot(site, 9e4, 70) : { lon: 0, lat: 20, range: 1.6e7 },
            beats,
            panels: [
              {
                id: "on-board",
                kind: "bars",
                title: "People",
                unit: "people",
                note: "As the article's infobox records them; figures may change as the investigation goes on.",
                items: people.map((p) => ({
                  label: p.l,
                  value: p.n,
                  text: p.n.toLocaleString("en-GB"),
                  color: /Fatal/.test(p.l) ? RED : ICE,
                  cites: [p.f.id],
                })),
              },
            ],
          });
      }

      // 5. Minute by minute, then the investigation: the article's own words.
      if (timeline.length >= 2)
        inserts.push({
          title: "Minute by minute",
          seconds: 4 + timeline.length * 6,
          shot: site ? siteShot(site, 6e5, -10) : { lon: 0, lat: 20, range: 1.6e7 },
          beats: timeline.map((s) => ({ text: s.text, cites: [s.id] })),
        });
      if (investigation.length)
        inserts.push({
          title: "The investigation",
          seconds: 4 + investigation.length * 6,
          shot: site ? siteShot(site, 3.5e5, 140) : { lon: 0, lat: 20, range: 1.6e7 },
          beats: investigation.map((s) => ({ text: s.text, cites: [s.id] })),
        });

      for (const e of evidence) add(e);
      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}
