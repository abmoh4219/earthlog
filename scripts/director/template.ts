// Template director: free, deterministic, no AI. Picks key moments from baked data and
// fills plain sentences with real values. Every sentence cites the evidence it reads
// from, and states its own local time, so it stays true even if pacing nudges it later.
import type { EventDef } from "../../events/types.ts";
import { clockText, zoneText } from "../../src/scene/format.ts";
import type {
  Beat,
  Evidence,
  Keyframe,
  LayerData,
  PaceMark,
  QuakeLayer,
  Scene,
  SignalLayer,
} from "../../src/scene/schema.ts";
import { ms } from "../../src/scene/schema.ts";
import { baselineId, evidenceId, pct, SIGNAL_INFO } from "../bake/ioda.ts";

const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

interface Draft {
  t: number;
  text: string;
  cites: string[];
}

export function templateScene(
  def: EventDef,
  evidence: Evidence[],
  layers: LayerData[],
  at: string,
): Scene {
  const known = new Set(evidence.map((e) => e.id));
  const local = (t: number) =>
    `${clockText(t, def.timezone).slice(0, 5)} ${zoneText(t, def.timezone)}`;
  const drafts: Draft[] = [];

  for (const layer of layers) {
    if (layer.kind === "outages") drafts.push(...signalBeats(layer, local, known));
    if (layer.kind === "quakes") drafts.push(...quakeBeats(layer, local));
  }

  const start = ms(def.window.start);
  const end = ms(def.window.end);
  const total = (end - start) / 1000;
  // Fast travel plays the whole window in about a minute; beats get a readable hold.
  const fast = Math.max(120, Math.round(total / 60));
  const hold = Math.min(300, Math.max(60, Math.round(fast / 8)));
  const readSeconds = 7;

  // Keep beats in order and at least one reading-time apart.
  drafts.sort((a, b) => a.t - b.t);
  const beats: Beat[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const d of drafts) {
    const t = Math.max(d.t, last + readSeconds * hold * 1000);
    if (t > end) break;
    beats.push({ t: iso(t), text: d.text, cites: d.cites });
    last = t;
  }

  return {
    version: 1,
    id: def.id,
    title: def.title,
    subtitle: def.subtitle,
    category: def.category,
    window: def.window,
    focus: def.focus,
    timezone: def.timezone,
    region: def.region,
    imagery: def.imagery,
    layers: layers.map((l) => ({ kind: l.kind, file: `data/${l.kind}.json` })),
    camera: cameraPlan(def),
    pacing: pacingPlan(def, beats, fast, hold, readSeconds),
    beats,
    generatedBy: { method: "template", at },
  };
}

function signalBeats(
  layer: SignalLayer,
  local: (t: number) => string,
  known: Set<string>,
): Draft[] {
  const { noun, plural } = SIGNAL_INFO[layer.signal];
  const falls = plural ? "fall" : "falls";
  const drop = layer.tone === "loss" ? 0.8 : 0.85;
  const out: Draft[] = [];
  const [lead, ...others] = layer.series;
  if (!lead) return out;

  const points = (s: typeof lead) =>
    s.ratio.flatMap((r, i) => {
      if (r === null || r === undefined) return [];
      const t = ms(s.start) + i * s.step * 1000;
      const id = evidenceId(s.code, layer.signal, iso(t));
      return known.has(id) ? [{ i, t, r, id }] : [];
    });

  const leadPts = points(lead);
  const first = leadPts[0];
  if (!first) return out;
  const leadBase = baselineId(lead.code, layer.signal);
  out.push({
    t: first.t,
    text: `${local(first.t)}. ${lead.name}: ${noun} at ${pct(first.r)}% of normal.`,
    cites: [first.id, leadBase],
  });

  // The onset: the first fall below the threshold from a reading at or above it.
  const onsetIdx = leadPts.findIndex(
    (p, i) => i > 0 && p.r < drop && (leadPts[i - 1]?.r ?? 0) >= drop,
  );
  const onset = leadPts[onsetIdx];
  if (onset) {
    const before = leadPts[onsetIdx - 1];
    const minutes = before ? Math.round((onset.t - before.t) / 60_000) : 0;
    out.push({
      t: onset.t,
      text: before
        ? `${local(onset.t)}. ${lead.name}: ${noun} ${falls} from ${pct(before.r)}% to ${pct(onset.r)}% of normal in ${minutes} minutes.`
        : `${local(onset.t)}. ${lead.name}: ${noun} at ${pct(onset.r)}% of normal.`,
      cites: before ? [before.id, onset.id, leadBase] : [onset.id, leadBase],
    });

    const after = leadPts.slice(onsetIdx);
    const lowest = after.reduce((m, p) => (p.r < m.r ? p : m), onset);
    // A steep fall deserves its own sentence: the first reading under half the onset value.
    const collapse = after.find((p) => p.r < onset.r / 2);
    if (collapse && collapse !== lowest) {
      const hours = (collapse.t - onset.t) / 3_600_000;
      const span = hours < 1 ? `${Math.round(hours * 60)} minutes` : `${+hours.toFixed(1)} hours`;
      out.push({
        t: collapse.t,
        text: `${local(collapse.t)}. ${span} later, ${lead.name} is down to ${pct(collapse.r)}% of normal.`,
        cites: [collapse.id, onset.id, leadBase],
      });
    }
    if (lowest !== onset && lowest.r < onset.r - 0.03) {
      out.push({
        t: lowest.t,
        text: `${local(lowest.t)}. Lowest reading for ${lead.name}: ${pct(lowest.r)}% of normal.`,
        cites: [lowest.id, leadBase],
      });
    }
    const halfway = lowest.r + (1 - lowest.r) / 2;
    const back = leadPts.find((p) => p.t > lowest.t && p.r >= halfway);
    if (back) {
      out.push({
        t: back.t,
        text: `${local(back.t)}. ${lead.name} is back to ${pct(back.r)}% of normal.`,
        cites: [back.id, leadBase],
      });
    } else {
      const final = leadPts.at(-1);
      if (final && final.t > lowest.t && pct(final.r) !== pct(lowest.r)) {
        out.push({
          t: final.t,
          text: `${local(final.t)}. ${lead.name} is still at ${pct(final.r)}% of normal.`,
          cites: [final.id, leadBase],
        });
      }
    }

    // The other countries: either they follow, or they are the comparison that holds.
    for (const s of others) {
      const pts = points(s);
      const base = baselineId(s.code, layer.signal);
      const hit = pts.find((p) => p.t >= onset.t && p.r < drop);
      if (hit) {
        out.push({
          t: hit.t,
          text: `${local(hit.t)}. ${s.name}: ${noun} ${falls} to ${pct(hit.r)}% of normal.`,
          cites: [hit.id, base],
        });
      } else {
        const lowestOther = pts
          .filter((p) => p.t >= onset.t)
          .reduce<(typeof pts)[number] | undefined>((m, p) => (!m || p.r < m.r ? p : m), undefined);
        const steady = pts.find((p) => p.t > onset.t);
        if (steady && lowestOther && lowestOther.r >= 0.9) {
          out.push({
            t: steady.t,
            text:
              pct(steady.r) === pct(lowestOther.r)
                ? `${s.name}, for comparison, holds steady at ${pct(steady.r)}% of normal.`
                : `${s.name}, for comparison, holds steady: ${pct(steady.r)}% of normal, never below ${pct(lowestOther.r)}%.`,
            cites: [...new Set([steady.id, lowestOther.id, base])],
          });
        }
      }
    }
  }
  return out;
}

function quakeBeats(layer: QuakeLayer, local: (t: number) => string): Draft[] {
  const out: Draft[] = [];
  const quakes = [...layer.quakes].sort((a, b) => b.mag - a.mag);
  const [main, second] = quakes;
  if (!main) return out;
  const told = new Set([main.id]);
  // USGS gives big events a name ("2025 Mandalay, Burma (Myanmar) Earthquake"); quote it.
  const where = /earthquake$/i.test(main.place)
    ? ` USGS names it the "${main.place}".`
    : ` ${main.place}.`;
  out.push({
    t: ms(main.t),
    text: `${local(ms(main.t))}. A magnitude ${main.mag.toFixed(1)} earthquake, ${Math.round(main.depthKm)} km deep.${where}`,
    cites: [main.evidence],
  });
  if (second && second.mag >= 6) {
    told.add(second.id);
    const minutes = Math.round((ms(second.t) - ms(main.t)) / 60_000);
    out.push({
      t: ms(second.t),
      text: `${local(ms(second.t))}. Another quake, magnitude ${second.mag.toFixed(1)}, ${minutes} minutes later: ${second.place}.`,
      cites: [second.evidence],
    });
  }
  const rest = layer.quakes.filter((q) => !told.has(q.id));
  const lastOne = rest.at(-1);
  if (lastOne && rest.length >= 2) {
    const min = Math.min(...rest.map((q) => q.mag));
    out.push({
      t: ms(lastOne.t),
      text: `${local(ms(lastOne.t))}. ${rest.length} more quakes of magnitude ${min.toFixed(1)} or above recorded in the region so far.`,
      cites: rest.map((q) => q.evidence),
    });
  }
  return out;
}

/** Wide establishing shot → dive at the focus moment → slow pull back over the region. */
function cameraPlan(def: EventDef): Keyframe[] {
  const { west, south, east, north } = def.region;
  const lon = (west + east) / 2;
  const lat = (south + north) / 2;
  const km = 111_000;
  const extent = Math.max((east - west) * Math.cos((lat * Math.PI) / 180), north - south) * km;
  const start = ms(def.window.start);
  const end = ms(def.window.end);
  const focus = ms(def.focus);
  const p = def.focusPoint;
  const clampT = (t: number) => iso(Math.min(end, Math.max(start, t)));
  return [
    { t: def.window.start, lon, lat: lat - 4, range: extent * 2.6, heading: 0, pitch: -82 },
    { t: clampT(focus - 10 * 60_000), lon, lat, range: extent * 1.6, heading: 0, pitch: -70 },
    {
      t: clampT(focus + 15 * 60_000),
      lon: p.lon,
      lat: p.lat - 1.5,
      range: extent * 1.05,
      heading: 10,
      pitch: -52,
    },
    {
      t: clampT(focus + 60 * 60_000),
      lon: p.lon,
      lat: p.lat - 1,
      range: extent * 1.2,
      heading: -8,
      pitch: -55,
    },
    {
      t: clampT(start + (end - start) * 0.7),
      lon,
      lat: lat - 2,
      range: extent * 1.3,
      heading: -4,
      pitch: -62,
    },
    { t: def.window.end, lon, lat: lat - 3, range: extent * 1.9, heading: 0, pitch: -75 },
  ].filter((k, i, all) => i === 0 || ms(k.t) > ms(all[i - 1]?.t ?? "")) satisfies Keyframe[];
}

/** Fast between moments, slow around the focus, a readable hold on every beat. */
function pacingPlan(
  def: EventDef,
  beats: Beat[],
  fast: number,
  hold: number,
  readSeconds: number,
): PaceMark[] {
  const start = ms(def.window.start);
  const end = ms(def.window.end);
  const focus = ms(def.focus);
  const slow = 60;
  // Speed at any time: slowest rule that applies.
  const zones: { from: number; to: number; speed: number }[] = [
    { from: focus - 5 * 60_000, to: focus + 25 * 60_000, speed: slow },
    ...beats.map((b) => ({ from: ms(b.t), to: ms(b.t) + readSeconds * hold * 1000, speed: hold })),
  ];
  const edges = [...new Set([start, ...zones.flatMap((z) => [z.from, z.to])])]
    .filter((t) => t >= start && t < end)
    .sort((a, b) => a - b);
  const marks: PaceMark[] = [];
  for (const t of edges) {
    const active = zones.filter((z) => t >= z.from && t < z.to).map((z) => z.speed);
    const speed = Math.min(fast, ...active);
    if (marks.at(-1)?.speed !== speed) marks.push({ t: iso(t), speed });
  }
  return marks;
}
