// The science and space lens: launches, missions, discoveries.
//   Launch    → the launch site on real terrain, a column of light rising from the pad;
//               rocket, operator and date from the article's infobox;
//   The mission → crew, spacecraft, maker, duration, distance: the infobox's own words;
//   Landing   → splashdown or landing site; the arc from launch to landing joins two points
//               and is labelled as such (it is not the flight path, which no free source gives);
//   Discovery → for comets, asteroids and finds: the discovery site and who found it.
// Verified 2026-11-05 on Artemis II ({{Infobox spaceflight}}: launch site, launch rocket, crew
// members, landing site with {{Coord}}, mission duration, distance travelled).
import { LENS_INFO } from "../../src/scene/edition.ts";
import type { Evidence, LayerData } from "../../src/scene/schema.ts";
import { fetchCoordinates } from "../bake/wikinews.ts";
import { parseCoord, terrainHooks } from "./accident.ts";
import { andList, boxItems, links } from "./culture.ts";
import { anyInfobox } from "./election/infobox.ts";
import type { ChapterDraft } from "./film.ts";
import {
  generalLens,
  type LensContext,
  type LensResult,
  sharedLayer,
  wideShot,
} from "./general.ts";
import { fetchRevision } from "./news-context.ts";

/** Facts worth showing, in order: [label, infobox keys]. */
export const SCIENCE_FACTS: [label: string, keys: string[]][] = [
  ["Mission", ["mission type"]],
  ["Operator", ["operator"]],
  ["Rocket", ["launch rocket", "rocket"]],
  ["Launch site", ["launch site"]],
  ["Launched", ["launch date"]],
  ["Spacecraft", ["spacecraft", "spacecraft type"]],
  ["Built by", ["manufacturer"]],
  ["Crew", ["crew members"]],
  ["Duration", ["mission duration"]],
  ["Distance", ["distance travelled"]],
  ["Landing site", ["landing site", "recovery by"]],
  ["Landed", ["landing date", "decay date"]],
  ["Discovered by", ["discoverer", "discovered by", "discovered"]],
  ["Discovery site", ["discovery site", "discovery place"]],
  ["Discovery date", ["discovery date", "discovered date"]],
];

/** The infobox's facts as plain text (dates trimmed of time-zone repeats). */
export function readFacts(params: Map<string, string>) {
  return SCIENCE_FACTS.flatMap(([label, keys]) => {
    for (const k of keys) {
      const v = params.get(k);
      if (!v) continue;
      const items = boxItems(v).map((x) =>
        // "April 1, 2026, 22:35:12 UTC (6:35:12 p.m. EDT)" → keep the UTC part.
        x.replace(/\s*\([^)]*\b(EDT|EST|PDT|PST|CEST|CET|IST|JST|BST)\b[^)]*\)/g, ""),
      );
      const text = items.join(", ").replace(/\s+/g, " ").trim();
      if (text && text.length <= 110) return [{ label, text, raw: v, items }];
    }
    return [];
  });
}

export async function scienceLens(ctx: LensContext): Promise<LensResult> {
  const title = ctx.story.article?.title;
  const rev = title ? await fetchRevision(title) : undefined;
  const box = rev ? anyInfobox(rev.wikitext) : undefined;
  if (!title || !rev || !box) return generalLens(ctx);

  const dayStart = `${ctx.date}T00:00:00Z`;
  const url = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(rev.title.replace(/ /g, "_"))}&oldid=${rev.revid}`;
  const when = rev.timestamp.slice(0, 16).replace("T", " ");
  const evidence: Evidence[] = [];
  const facts = readFacts(box.params).map((f) => {
    const id = `wiki:box:${rev.revid}:${f.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    evidence.push({
      id,
      kind: "report",
      source: "wikipedia-article",
      t: dayStart,
      precision: "day",
      label: `Wikipedia, "${rev.title}" infobox (revision of ${when} UTC): ${f.label.toLowerCase()}: ${f.text}`,
      quote: f.text,
      url,
    });
    return { ...f, id };
  });
  const fact = (l: string) => facts.find((f) => f.label === l);

  // Points: launch site, landing site, discovery site (coordinates from Wikipedia).
  const launch = fact("Launch site");
  const landing = fact("Landing site");
  const discovery = fact("Discovery site");
  const titles = [launch, discovery].flatMap((f) => (f ? links(f.raw).slice(0, 1) : []));
  const coords = await fetchCoordinates(titles);
  const at = (f: typeof launch) => {
    const t = f ? links(f.raw)[0] : undefined;
    return (t ? coords.get(t) : undefined) ?? (f ? parseCoord(f.raw) : undefined);
  };
  const launchAt = at(launch);
  const landingAt = landing ? parseCoord(landing.raw) : undefined;
  const discoveryAt = at(discovery);
  const site = launchAt ?? discoveryAt ?? ctx.story.place;
  const t = await terrainHooks(site, ctx.at);
  const color = LENS_INFO.science.color;

  return generalLens(ctx, {
    ...(t.sources ? { sources: t.sources } : {}),
    shape: ({ chapters, layers, add }) => {
      for (let i = layers.length - 1; i >= 0; i--)
        if (layers[i]?.kind === "places" && !sharedLayer(layers[i])) layers.splice(i, 1);
      if (t.layer) layers.push(t.layer);
      const inserts: ChapterDraft[] = [];
      const name = rev.title;

      // 1. Launch: the pad, a column of light rising from it.
      if (launch && launchAt) {
        const rocket = fact("Rocket");
        const date = fact("Launched");
        layers.push({
          kind: "places",
          name: "launch",
          places: [{ name: launch.items[0] ?? launch.text, ...launchAt, color, primary: true }],
        } satisfies LayerData);
        layers.push({
          kind: "columns",
          name: "launch",
          unit: "",
          maxHeight: 900_000,
          columns: [{ id: "launch", name: "Launch", ...launchAt, value: 1, color: "#e8f6ff" }],
        } satisfies LayerData);
        inserts.push({
          title: "Launch",
          seconds: 11,
          shot: {
            lon: launchAt.lon,
            lat: launchAt.lat - 1.4,
            range: 4.2e5,
            pitch: -16,
            heading: 8,
          },
          beats: [
            {
              text: `${name} launched${rocket ? ` on a ${rocket.text}` : ""} from ${launch.text}${date ? `, ${date.text}` : ""}.`,
              cites: [launch, rocket, date].flatMap((f) => (f ? [f.id] : [])),
            },
          ],
          reveal: ["places-launch", "columns-launch"],
        });
      }

      // 2. The mission: the infobox's own words.
      const crew = fact("Crew");
      const mission = fact("Mission");
      const panelFacts = facts.filter(
        (f) => !["Launch site", "Landing site", "Discovery site"].includes(f.label),
      );
      if (panelFacts.length >= 2) {
        const beats: ChapterDraft["beats"] = [];
        if (mission || crew)
          beats.push({
            text: mission
              ? `Mission: ${mission.text}${crew ? `, with ${andList(crew.items)} aboard` : ""}.`
              : `Aboard: ${andList(crew?.items ?? [])}.`,
            cites: [mission, crew].flatMap((f) => (f ? [f.id] : [])),
          });
        const dur = fact("Duration");
        const dist = fact("Distance");
        if (dur || dist)
          beats.push({
            text: [
              dur ? `It lasted ${dur.text}` : "",
              dist ? `${dur ? "and" : "It"} covered ${dist.text}` : "",
            ]
              .filter(Boolean)
              .join(" ")
              .concat("."),
            cites: [dur, dist].flatMap((f) => (f ? [f.id] : [])),
          });
        const found = fact("Discovered by");
        if (found)
          beats.push({
            text: `Discovered by ${found.text}${fact("Discovery date") ? `, ${fact("Discovery date")?.text}` : ""}.`,
            cites: [found, fact("Discovery date")].flatMap((f) => (f ? [f.id] : [])),
          });
        if (beats.length)
          inserts.push({
            title: fact("Discovered by") ? "The discovery" : "The mission",
            seconds: 5 + beats.length * 6,
            shot: site
              ? { lon: site.lon, lat: site.lat - 6, range: 4.5e6, pitch: -46, heading: -10 }
              : { lon: 0, lat: 20, range: 1.6e7 },
            beats,
            panels: [
              {
                id: "mission",
                kind: "facts",
                title: rev.title,
                note: `From the article's infobox (revision of ${rev.timestamp.slice(0, 10)}).`,
                items: panelFacts
                  .slice(0, 9)
                  .map((f) => ({ label: f.label, text: f.text, cites: [f.id] })),
              },
            ],
            ...(discoveryAt ? { reveal: ["places-discovery"] } : {}),
          });
        if (discoveryAt && discovery)
          layers.push({
            kind: "places",
            name: "discovery",
            places: [
              { name: discovery.items[0] ?? discovery.text, ...discoveryAt, color, primary: true },
            ],
          });
      }

      // 3. Landing: two points joined, labelled as such.
      if (landing && landingAt) {
        layers.push({
          kind: "places",
          name: "landing",
          places: [
            {
              name: (landing.items[0] ?? "Landing").split(" (")[0] ?? "Landing",
              ...landingAt,
              color: "#ffb547",
            },
          ],
        } satisfies LayerData);
        if (launchAt)
          layers.push({
            kind: "arcs",
            name: "mission",
            arcs: [
              {
                from: [launchAt.lon, launchAt.lat],
                to: [landingAt.lon, landingAt.lat],
                color,
                dashed: true,
              },
            ],
          } satisfies LayerData);
        const landed = fact("Landed");
        inserts.push({
          title: "Landing",
          seconds: 12,
          shot: wideShot([landingAt, ...(launchAt ? [launchAt] : [])]) ?? {
            ...landingAt,
            range: 2e6,
          },
          beats: [
            {
              text: `It came back down in ${landing.text.replace(/\s*\(.*$/, "").replace(/^(Pacific|Atlantic|Indian|Arctic|Southern) Ocean/, "the $&")}${landed ? `, ${landed.text}` : ""}.`,
              cites: [landing, landed].flatMap((f) => (f ? [f.id] : [])),
            },
            ...(launchAt
              ? [
                  {
                    text: "The dashed line only joins launch and landing; the path flown is not drawn.",
                    cites: [landing.id, ...(launch ? [launch.id] : [])],
                  },
                ]
              : []),
          ],
          reveal: ["places-landing", "arcs-mission"],
          hide: ["columns-launch"],
        });
      }

      for (const e of evidence) add(e);
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}
