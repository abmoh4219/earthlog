// The conflict lens: wars, crises, attacks.
//   Day by day       → every place the article's dated sentences of the past week link, pinned
//                      and coloured by how recent it is; the sentences themselves, cited;
//   Sides and figures → the infobox's belligerents, status and casualty figures, attributed
//                      ("as the article records them"), never computed or merged;
//   Connectivity     → IODA's internet-connectivity signal for the country over two weeks
//                      (what it measures: responsive address blocks, not people offline).
// Responsible use (docs/RESPONSIBLE-USE.md, ADR-0011): neutral words, every figure attributed,
// no tactical detail: places named in published reports only, at the article's own precision.
import type { Evidence, LayerData } from "../../src/scene/schema.ts";
import { baselined, fetchIoda, IODA_COPYRIGHT_FALLBACK, iodaSource } from "../bake/ioda.ts";
import { median } from "../bake/lib.ts";
import { fetchCoordinates } from "../bake/wikinews.ts";
import { boxItems, linkedSentences } from "./culture.ts";
import { anyInfobox } from "./election/infobox.ts";
import type { ChapterDraft, PanelDraft } from "./film.ts";
import { generalLens, type LensContext, type LensResult, wideShot } from "./general.ts";
import { dateMatch, fetchRevision } from "./news-context.ts";
import { recencyColor } from "./thread.ts";

export { recencyColor };

const DAY = 86_400_000;

/** Daily median of a ratio series: one point a day for a two-week panel. */
export function dailyMedians(
  start: number,
  step: number,
  ratio: (number | null)[],
): { day: string; ratio: number }[] {
  const byDay = new Map<string, number[]>();
  ratio.forEach((r, i) => {
    if (r === null) return;
    const day = new Date((start + i * step) * 1000).toISOString().slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  });
  return [...byDay.entries()].flatMap(([day, rs]) => {
    const m = median(rs);
    return m === null ? [] : [{ day, ratio: Math.round(m * 1000) / 1000 }];
  });
}

const SIDES = ["combatant1", "combatant2", "combatant3", "side1", "side2", "side3", "parties"];
const FIGURES: [label: string, keys: string[]][] = [
  ["Status", ["status", "result"]],
  ["Casualties (side 1)", ["casualties1"]],
  ["Casualties (side 2)", ["casualties2"]],
  ["Casualties", ["casualties3", "casualties", "fatalities", "deaths"]],
  ["Injured", ["injuries", "injured", "non-fatal injuries"]],
  ["Displaced", ["displaced", "refugees"]],
];

export async function conflictLens(ctx: LensContext): Promise<LensResult> {
  const title = ctx.story.article?.title;
  const rev = title ? await fetchRevision(title) : undefined;
  const dayStart = `${ctx.date}T00:00:00Z`;
  const day = Date.parse(dayStart);
  const evidence: Evidence[] = [];
  const url = rev
    ? `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(rev.title.replace(/ /g, "_"))}&oldid=${rev.revid}`
    : "";
  const when = rev?.timestamp.slice(0, 16).replace("T", " ");
  const report = (id: string, label: string, quote: string) => {
    if (rev && !evidence.some((e) => e.id === id))
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

  // ── Day by day: the week's dated sentences and the places they link ──
  // A date without a year ("On November 2") counts only in a sentence added in the past eight
  // days (revision diff), so a long history article can't pass an old November 2 as news.
  const before =
    rev && title ? await fetchRevision(title, new Date(day - 8 * DAY).toISOString()) : undefined;
  const older = new Set(before ? linkedSentences(before.wikitext).map((s) => s.text) : []);
  const dated = rev
    ? linkedSentences(rev.wikitext)
        .map((s, n) => ({ ...s, n, m: dateMatch(s.text, ctx.date) }))
        .filter(
          (s) =>
            s.m &&
            !s.m.month &&
            (s.m.withYear || (before !== undefined && !older.has(s.text))) &&
            s.m.days <= 1 &&
            s.m.days >= -7,
        )
        .filter((s) => s.text.length <= 215)
    : [];
  // Latest first for choosing; told in date order.
  const chosen = dated
    .sort((a, b) => (b.m?.days ?? 0) - (a.m?.days ?? 0))
    .slice(0, 5)
    .sort((a, b) => (a.m?.days ?? 0) - (b.m?.days ?? 0) || a.n - b.n);
  const coords = await fetchCoordinates(dated.flatMap((s) => s.links));
  const places: { name: string; lon: number; lat: number; daysAgo: number; id: string }[] = [];
  for (const s of dated) {
    const id = report(`wiki:week:${rev?.revid}:${s.n}`, "dated sentence", s.text);
    for (const t of s.links) {
      const c = coords.get(t);
      const name = t.replace(/\s*\([^)]*\)$/, "").replace(/,.*$/, "");
      if (!c || places.some((p) => p.name === name) || places.length >= 16) continue;
      places.push({ name, ...c, daysAgo: -(s.m?.days ?? 0), id });
    }
  }

  // ── Sides and figures, attributed ──
  const box = rev ? anyInfobox(rev.wikitext) : undefined;
  const boxText = (keys: string[]) => {
    for (const k of keys) {
      const v = box?.params.get(k);
      const items = v ? boxItems(v) : [];
      if (items.length) return items;
    }
    return undefined;
  };
  const sides = SIDES.flatMap((k) => {
    const items = boxText([k]);
    // "----" lines separate groups inside one side's cell: not a name.
    const names = items?.filter((x) => !/^[-–—\s]+$/.test(x));
    return names?.length ? [names.slice(0, 3).join(", ")] : [];
  }).filter((t) => t.length <= 90);
  const sideIds = sides.map((t, i) =>
    report(`wiki:box:${rev?.revid}:side-${i + 1}`, `side ${i + 1}: ${t}`, t),
  );
  const figures = FIGURES.flatMap(([label, keys]) => {
    const items = boxText(keys);
    const text = items?.join("; ");
    return text && text.length <= 120
      ? [
          {
            label,
            text,
            id: report(
              `wiki:box:${rev?.revid}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              `${label}: ${text}`,
              text,
            ),
          },
        ]
      : [];
  });

  // ── Connectivity: IODA for the story's country, the last two weeks ──
  const code = ctx.story.place?.country;
  let connectivity: { day: string; ratio: number; id: string }[] = [];
  let ioda: { copyright: string } | undefined;
  if (code) {
    try {
      const end = Math.floor((day + DAY) / 1000);
      const start = end - 14 * 86_400;
      const { signal, copyright } = await fetchIoda(code, "ping-slash24", start, end);
      const b = baselined(signal, start, end);
      connectivity = dailyMedians(b.start, b.step, b.ratio).map((d) => ({
        ...d,
        id: `ioda:${code}:ping:day:${d.day}`,
      }));
      ioda = { copyright };
      // Evidence ships only with its chapter, i.e. when the signal moved (below 90%).
      const moved = connectivity.length >= 5 && connectivity.some((d) => d.ratio < 0.9);
      for (const d of moved ? connectivity : [])
        evidence.push({
          id: d.id,
          kind: "sensor",
          source: "ioda",
          t: dayStart,
          precision: "day",
          label: `IODA, ${signal.entityName}: responsive address blocks on ${d.day} at ${Math.round(d.ratio * 100)}% of the usual level (median of the day; usual = same time, same weekday, previous 4 weeks)`,
          value: d.ratio,
          unit: "ratio",
          url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`,
        });
    } catch (err) {
      console.warn(`  IODA skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  return generalLens(ctx, {
    // IODA is credited only when its chapter is in the film (the signal moved).
    sources:
      ioda && connectivity.length >= 5 && connectivity.some((d) => d.ratio < 0.9)
        ? [iodaSource(ioda.copyright || IODA_COPYRIGHT_FALLBACK, ctx.at)]
        : [],
    shape: ({ chapters, layers, add }) => {
      const inserts: ChapterDraft[] = [];

      // Sentences an earlier chapter already said (What happened) aren't repeated.
      const told = new Set(chapters.flatMap((c) => c.beats.map((b) => b.text)));
      const fresh = chosen.filter((s) => !told.has(s.text));
      if (fresh.length >= 2 || (fresh.length && places.length >= 2)) {
        layers.push({
          kind: "places",
          name: "week",
          places: places.map((p) => ({
            name: p.name,
            lon: p.lon,
            lat: p.lat,
            color: recencyColor(p.daysAgo),
            primary: p.daysAgo <= 1,
          })),
        } satisfies LayerData);
        inserts.push({
          title: "Day by day",
          seconds: 5 + fresh.length * 6,
          shot: wideShot(places) ?? {
            lon: places[0]?.lon ?? ctx.story.place?.lon ?? 0,
            lat: (places[0]?.lat ?? ctx.story.place?.lat ?? 20) - 1.5,
            range: 1.5e6,
            pitch: -45,
          },
          beats: fresh.map((s) => ({ text: s.text, cites: [`wiki:week:${rev?.revid}:${s.n}`] })),
          panels: places.length
            ? [
                {
                  id: "week",
                  kind: "facts",
                  title: "Places in the week's reports",
                  note: "Places the article's dated sentences of the past seven days link to. Red: the latest; amber: a week ago.",
                  items: places.slice(0, 8).map((p) => ({
                    label: p.name,
                    text:
                      p.daysAgo <= 0
                        ? "that day"
                        : `${Math.round(p.daysAgo)} day${Math.round(p.daysAgo) === 1 ? "" : "s"} before`,
                    cites: [p.id],
                  })),
                } satisfies PanelDraft,
              ]
            : [],
          reveal: ["places-week"],
        });
      }

      if (sides.length >= 2 || figures.length) {
        const beats: ChapterDraft["beats"] = [];
        if (sides.length >= 2)
          beats.push({
            text: `The article lists ${sides.length === 2 ? "two" : sides.length === 3 ? "three" : sides.length} sides: ${sides.join("; ")}.`,
            cites: sideIds,
          });
        const status = figures.find((f) => f.label === "Status");
        if (status)
          beats.push({
            text: `Status, as the article records it: ${status.text}.`,
            cites: [status.id],
          });
        const counts = figures.filter((f) => f.label !== "Status").slice(0, 2);
        if (counts.length)
          beats.push({
            text: `Figures as the article records them, each attributed there to its sources: ${counts.map((f) => `${f.label.toLowerCase()}, ${f.text}`).join("; ")}.`,
            cites: counts.map((f) => f.id),
          });
        inserts.push({
          title: "Sides and figures",
          seconds: 5 + beats.length * 6,
          shot: ctx.story.place
            ? {
                lon: ctx.story.place.lon,
                lat: ctx.story.place.lat - 2,
                range: 1.2e6,
                pitch: -42,
                heading: -16,
              }
            : { lon: 0, lat: 20, range: 1.6e7 },
          beats,
          panels: [
            {
              id: "sides",
              kind: "facts",
              title: "As the article records them",
              note: "From the article's infobox; contested figures are attributed there to their sources.",
              items: [
                ...sides.map((t, i) => ({
                  label: `Side ${i + 1}`,
                  text: t,
                  cites: [sideIds[i] ?? ""],
                })),
                ...figures.map((f) => ({ label: f.label, text: f.text, cites: [f.id] })),
              ].slice(0, 9),
            } satisfies PanelDraft,
          ],
        });
      }

      // Only when the signal moved: a flat line adds nothing to the story.
      const low = connectivity.length
        ? connectivity.reduce((a, b) => (b.ratio < a.ratio ? b : a))
        : undefined;
      if (connectivity.length >= 5 && ctx.story.place && low && low.ratio < 0.9) {
        const last = connectivity.at(-1);
        inserts.push({
          title: "Connectivity",
          seconds: 12,
          shot: {
            lon: ctx.story.place.lon,
            lat: ctx.story.place.lat - 4,
            range: 3.2e6,
            pitch: -50,
          },
          beats: [
            {
              text: `IODA saw the country's responsive internet address blocks fall to ${Math.round(low.ratio * 100)}% of their usual level on ${low.day}.`,
              cites: [low.id, ...(last && last.id !== low.id ? [last.id] : [])],
            },
          ],
          panels: [
            {
              id: "connectivity",
              kind: "line",
              title: "Internet connectivity (IODA)",
              unit: "% of usual",
              note: "Responsive address blocks (active probing), daily median, against the same time and weekday over the previous four weeks. A connectivity signal, not a count of people offline.",
              series: [
                {
                  label: ctx.story.place.name,
                  color: "#5ef2ff",
                  points: connectivity.map((d) => ({
                    x: d.day.slice(5),
                    y: Math.round(d.ratio * 100),
                  })),
                  cites: connectivity.map((d) => d.id),
                },
              ],
              mark: connectivity.length - 1,
            } satisfies PanelDraft,
          ],
        });
      }

      for (const e of evidence) add(e);
      const keep = chapters.filter((c) => c.title !== "On record");
      const after = keep.findIndex((c) => c.title === "Where") + 1 || 1;
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}
