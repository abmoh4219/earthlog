// The disaster lens (PLAN.md Phase 12). Earthquakes first, from USGS:
//   The earthquake → epicentre and the fault's rupture model on real terrain; magnitude,
//                    depth, time;
//   The shaking    → ShakeMap intensity contours spreading outward from the strongest, and
//                    3D columns of estimated intensity over nearby towns (PAGER);
//   Who felt it    → people exposed at each intensity (PAGER), the alert level, "Did You
//                    Feel It?" reports.
// Other disasters (and quakes USGS can't match) get the general film on real terrain.
// Honesty (CLAUDE.md §3.2): intensities and exposure are USGS *estimates* and say so;
// the PAGER alert is an estimate of likely losses, not a count.
import type { Evidence, LayerData } from "../../src/scene/schema.ts";
import {
  type Contour,
  type Detail,
  fetchDetail,
  fetchProduct,
  findQuake,
  MMI,
  mmiInfo,
  parseCities,
  parseContours,
  parseExposure,
  parseRupture,
} from "../bake/shakemap.ts";
import { usgsSource } from "../bake/usgs.ts";
import { groundedLens, terrainHooks } from "./accident.ts";
import type { ChapterDraft, PanelDraft } from "./film.ts";
import { generalLens, type LensContext, type LensResult } from "./general.ts";

export interface QuakeData {
  detail: Detail;
  contours: Contour[];
  rupture: number[][];
  exposure: { mmi: number; people: number }[];
  cities: { name: string; lat: number; lon: number; pop: number; mmi: number }[];
}

const fmt = (n: number) => n.toLocaleString("en-GB");

/** The quake's chapters, layers and evidence. Pure, so it is tested on recorded USGS data. */
export function quakeFilm(q: QuakeData, date: string) {
  const p = q.detail.properties;
  const [lon, lat, depth] = q.detail.geometry.coordinates;
  const dayStart = `${date}T00:00:00Z`;
  const when = new Date(p.time).toISOString().slice(0, 16).replace("T", " ");
  const evidence: Evidence[] = [];
  const ev = (key: string, label: string, value?: number, unit?: string) => {
    const id = `usgs:${q.detail.id}:${key}`;
    evidence.push({
      id,
      kind: "sensor",
      source: "usgs",
      t: dayStart,
      precision: "day",
      label: `USGS, ${p.place} (${when} UTC): ${label}`,
      ...(value !== undefined ? { value } : {}),
      ...(unit ? { unit } : {}),
      url: p.url,
    });
    return id;
  };

  const quakeId = ev("event", `magnitude ${p.mag}, depth ${depth} km`, p.mag, "magnitude");
  const layers: LayerData[] = [];
  const chapters: ChapterDraft[] = [];

  // 1. The earthquake: epicentre and rupture.
  layers.push({
    kind: "places",
    name: "epicentre",
    places: [{ name: `M ${p.mag}`, lon, lat, color: "#ff5a5f", primary: true }],
  });
  if (q.rupture.length)
    layers.push({
      kind: "lines",
      name: "rupture",
      lines: q.rupture.map((ring) => ({ points: ring, color: "#ff5a5f", width: 4 })),
    });
  chapters.push({
    title: "The earthquake",
    seconds: 12,
    shot: { lon, lat: lat - 0.6, range: 2.6e5, pitch: -28, heading: 18 },
    beats: [
      {
        text: `A magnitude ${p.mag} earthquake struck ${p.place}, at ${when.slice(11)} UTC on ${new Date(p.time).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}, ${depth} km deep, according to the USGS.`,
        cites: [quakeId],
      },
      ...(q.rupture.length
        ? [
            {
              text: "The red outline is the USGS model of the fault that slipped.",
              cites: [ev("rupture", "ShakeMap finite-fault rupture model")],
            },
          ]
        : []),
    ],
    reveal: ["places-epicentre", "lines-rupture"],
  });

  // 2. The shaking: contours outward from the strongest, columns over towns.
  const strongest = q.contours[0];
  if (strongest) {
    const contourId = ev(
      "shakemap",
      `ShakeMap estimated intensity contours, strongest MMI ${strongest.mmi}`,
      strongest.mmi,
      "MMI",
    );
    layers.push({
      kind: "lines",
      name: "shaking",
      lines: q.contours.flatMap((c) =>
        c.lines.map((points) => ({
          points,
          color: c.color,
          width: Number.isInteger(c.mmi) ? 3 : 2,
        })),
      ),
    });
    const towns = [...q.cities].sort((a, b) => b.mmi - a.mmi).slice(0, 12);
    const townIds = towns.map((c) =>
      ev(
        `city:${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        `estimated intensity in ${c.name}: MMI ${c.mmi.toFixed(1)}`,
        c.mmi,
        "MMI",
      ),
    );
    if (towns.length >= 3)
      layers.push({
        kind: "columns",
        name: "towns",
        unit: "MMI",
        maxHeight: 60_000,
        // Only the four strongest carry a tip label; more would pile up around the epicentre.
        columns: towns.map((c, i) => ({
          id: c.name,
          name: `${c.name} · ${mmiInfo(c.mmi).roman}`,
          lon: c.lon,
          lat: c.lat,
          value: c.mmi,
          color: mmiInfo(c.mmi).color,
          label: i < 4,
        })),
      });
    const top = towns[0];
    const info = mmiInfo(strongest.mmi);
    chapters.push({
      title: "The shaking",
      seconds: 16,
      shot: { lon, lat: lat - 1.6, range: 6.5e5, pitch: -38, heading: -12 },
      beats: [
        {
          text: `USGS ShakeMap estimates shaking up to intensity ${info.roman} (${info.word}) near the epicentre, fading outward.`,
          cites: [contourId],
        },
        ...(top && townIds[0]
          ? [
              {
                text: `Among nearby towns, the strongest estimate is for ${top.name}: intensity ${mmiInfo(top.mmi).roman} (${mmiInfo(top.mmi).word}).`,
                cites: [townIds[0]],
              },
            ]
          : []),
      ],
      reveal: ["lines-shaking", "columns-towns"],
    });
  }

  // 3. Who felt it: exposure by intensity, the alert, DYFI.
  const exposed = q.exposure.filter((e) => e.mmi >= 4 && e.people > 0);
  if (exposed.length) {
    const ids = exposed.map((e) =>
      ev(
        `exposure:${e.mmi}`,
        `PAGER estimate: ${fmt(e.people)} people exposed to intensity ${MMI[e.mmi - 1]?.roman}`,
        e.people,
        "people",
      ),
    );
    const strong = exposed.filter((e) => e.mmi >= 6);
    const strongPeople = strong.reduce((s, e) => s + e.people, 0);
    const beats: ChapterDraft["beats"] = [];
    if (strongPeople)
      beats.push({
        text: `USGS PAGER estimates about ${fmt(strongPeople)} people were exposed to strong shaking or worse (intensity VI and above).`,
        cites: exposed.flatMap((e, i) => (e.mmi >= 6 ? [ids[i] ?? ""] : [])),
      });
    if (p.alert)
      beats.push({
        text: `PAGER issued ${/^[aeiou]/i.test(p.alert) ? "an" : "a"} ${p.alert} alert, its estimate of likely losses.`,
        cites: [ev("alert", `PAGER alert level ${p.alert}`)],
      });
    if (p.felt)
      beats.push({
        text: `${fmt(p.felt)} people reported to USGS that they felt it.`,
        cites: [ev("dyfi", `${fmt(p.felt)} "Did You Feel It?" responses`, p.felt, "responses")],
      });
    if (p.tsunami)
      beats.push({
        text: "USGS flagged the event for possible tsunami (see official warning centres).",
        cites: [ev("tsunami", "tsunami flag set")],
      });
    chapters.push({
      title: "Who felt it",
      hide: ["columns-towns"],
      seconds: 6 + beats.length * 6,
      shot: { lon, lat: lat - 3, range: 1.5e6, pitch: -48, heading: 6 },
      beats,
      panels: [
        {
          id: "exposure",
          kind: "bars",
          title: "People exposed, by intensity",
          unit: "people",
          note: "USGS PAGER estimates, not counts.",
          // Strongest first, each value with its own cited estimate.
          items: exposed
            .map((e, i) => ({ e, id: ids[i] ?? "" }))
            .reverse()
            .map(({ e, id }) => ({
              label: `${MMI[e.mmi - 1]?.roman} ${MMI[e.mmi - 1]?.word}`,
              value: e.people,
              text: fmt(e.people),
              color: MMI[e.mmi - 1]?.color ?? "#ffffff",
              cites: [id],
            })),
        } satisfies PanelDraft,
      ],
    });
  }
  return { chapters, layers, evidence };
}

/** Earthquake stories → USGS; anything else → the general film on terrain. */
export async function disasterLens(ctx: LensContext): Promise<LensResult> {
  const text = [ctx.story.title, ctx.story.headline, ctx.story.summary, ctx.story.about].join(" ");
  const place = ctx.story.place;
  if (!/\b(earthquake|quake|tremor|seismic)/i.test(text) || !place) return groundedLens(ctx);
  const day = Date.parse(`${ctx.date}T00:00:00Z`);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const id = await findQuake(
    place.lon,
    place.lat,
    iso(day - 3 * 86_400_000),
    iso(day + 86_400_000),
  );
  if (!id) return groundedLens(ctx);
  const detail = await fetchDetail(id);
  const [lon, lat] = detail.geometry.coordinates;
  const product = async <T>(
    kind: "shakemap" | "losspager",
    file: string,
    parse: (j: unknown) => T,
    empty: T,
  ) => {
    const j = await fetchProduct(detail, kind, file).catch(() => undefined);
    return j === undefined ? empty : parse(j);
  };
  const film = quakeFilm(
    {
      detail,
      contours: await product("shakemap", "download/cont_mmi.json", parseContours, []),
      rupture: await product("shakemap", "download/rupture.json", parseRupture, []),
      exposure: await product("losspager", "json/exposures.json", parseExposure, []),
      cities: await product("losspager", "json/cities.json", parseCities, []),
    },
    ctx.date,
  );
  const t = await terrainHooks({ lon, lat }, ctx.at);
  return generalLens(ctx, {
    sources: [usgsSource(ctx.at), ...(t.sources ?? [])],
    shape: ({ chapters, layers, add }) => {
      for (let i = layers.length - 1; i >= 0; i--)
        if (layers[i]?.kind === "places") layers.splice(i, 1);
      if (t.layer) layers.push(t.layer);
      layers.push(...film.layers);
      for (const e of film.evidence) add(e);
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      keep.splice(after, 0, ...film.chapters);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}
