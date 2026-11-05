// The sports lens (PLAN.md Phase 10): matches, races, tournaments.
// The venue (from the event article's infobox, else the story's place) with the camera low
// over it → the result card (winner, runner-up, score, jockey, trainer, attendance, prize…
// whatever the infobox records, cited to the exact revision) → arcs from the teams' home
// cities into the venue when the infobox names teams → followed around the world (readers in
// each Wikipedia language). Verified 2026-11-04 on the 2026 Melbourne Cup ({{Infobox horse
// race}}: winning horse, jockey, trainer, attendance) and the 2027 AFC Asian Cup.
import { LENS_INFO } from "../../src/scene/edition.ts";
import type { Evidence, LayerData } from "../../src/scene/schema.ts";
import { fetchCoordinates } from "../bake/wikinews.ts";
import { fetchLanguageReaders, LANGUAGE } from "./attention.ts";
import { anyInfobox, plainText } from "./election/infobox.ts";
import type { ChapterDraft, PanelDraft } from "./film.ts";
import {
  generalLens,
  type LensContext,
  type LensResult,
  sharedLayer,
  wideShot,
} from "./general.ts";
import { fetchRevision } from "./news-context.ts";

/** Infobox keys worth showing, in order, under one plain label each. */
const RESULT_KEYS: [label: string, keys: string[]][] = [
  ["Winner", ["winner", "winning horse", "champion", "champions", "winning team", "gold"]],
  ["Runner-up", ["runner-up", "runner up", "runnerup", "second", "silver"]],
  ["Third", ["third", "bronze"]],
  ["Score", ["score", "result", "final score"]],
  ["Jockey", ["winning jockey", "jockey"]],
  ["Trainer", ["winning trainer", "trainer"]],
  ["Player of the match", ["man of the match", "player of the match", "motm"]],
  ["Time", ["winning time", "time"]],
  ["Attendance", ["attendance", "crowd"]],
  ["Distance", ["distance"]],
  ["Prize", ["prize", "purse", "prize money"]],
  ["Teams", ["num teams", "teams"]],
  ["Host country", ["country", "host"]],
  ["Dates", ["dates", "date"]],
];
const VENUE_KEYS = ["venue", "location", "stadium", "racecourse", "city"];
const TEAM_KEYS = [
  ["team1", "team2"],
  ["home", "away"],
  ["team 1", "team 2"],
];

const firstLink = (v?: string) => (v ? /\[\[([^\]|#]+)/.exec(v)?.[1]?.trim() : undefined);
const clean = (v?: string) =>
  v
    ? plainText(v.replace(/<br\s*\/?>/gi, ", "))
        .replace(/,\s*,/g, ",")
        .replace(/^,\s*|\s*,$/g, "")
    : "";

export async function sportsLens(ctx: LensContext): Promise<LensResult> {
  const title = ctx.story.article?.title;
  const rev = title ? await fetchRevision(title) : undefined;
  const box = rev ? anyInfobox(rev.wikitext) : undefined;
  if (!title || !rev || !box) return generalLens(ctx);

  const get = (keys: string[]) => keys.map((k) => box.params.get(k)).find((v) => v && clean(v));
  const dayStart = `${ctx.date}T00:00:00Z`;
  const url = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(rev.title.replace(/ /g, "_"))}&oldid=${rev.revid}`;
  const evidence: Evidence[] = [];
  const cite = (key: string, text: string) => {
    const id = `wiki:box:${rev.revid}:${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    if (!evidence.some((e) => e.id === id)) {
      evidence.push({
        id,
        kind: "report",
        source: "wikipedia-article",
        t: dayStart,
        precision: "day",
        label: `Wikipedia, "${rev.title}" infobox (revision of ${rev.timestamp.slice(0, 16).replace("T", " ")} UTC): ${text}`,
        quote: text,
        url,
      });
    }
    return id;
  };

  // The venue and, for matches, the teams.
  const venueRaw = get(VENUE_KEYS);
  const venueTitle = firstLink(venueRaw);
  const teams =
    TEAM_KEYS.map((pair) => pair.map((k) => firstLink(box.params.get(k)))).find((p) =>
      p.every(Boolean),
    ) ?? [];
  const coords = await fetchCoordinates([
    ...(venueTitle ? [venueTitle] : []),
    ...teams.filter((t): t is string => !!t),
  ]);
  const venueCoord = (venueTitle ? coords.get(venueTitle) : undefined) ?? ctx.story.place;
  const venueName = venueRaw ? clean(venueRaw) : ctx.story.place?.name;

  // The result card.
  const results = RESULT_KEYS.flatMap(([label, keys]) => {
    const v = get(keys);
    const text = clean(v);
    return text && text.length <= 80
      ? [{ label, text, id: cite(label, `${label.toLowerCase()}: ${text}`) }]
      : [];
  });

  const readers = await fetchLanguageReaders(title, ctx.date).catch(() => []);
  const color = LENS_INFO.sports.color;

  return generalLens(ctx, {
    shape: ({ chapters, layers, add }) => {
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      const inserts: ChapterDraft[] = [];

      // 1. The venue.
      if (venueCoord && venueName) {
        const venueId = cite("venue", `venue: ${venueName}`);
        for (let i = layers.length - 1; i >= 0; i--)
          if (layers[i]?.kind === "places" && !sharedLayer(layers[i])) layers.splice(i, 1);
        const teamPins = teams.flatMap((t) => {
          const c = t ? coords.get(t) : undefined;
          return c && t
            ? [{ name: t.replace(/\s*\([^)]*\)$/, ""), lon: c.lon, lat: c.lat, color }]
            : [];
        });
        layers.push({
          kind: "places",
          places: [
            {
              name: venueName.split(",")[0] ?? venueName,
              lon: venueCoord.lon,
              lat: venueCoord.lat,
              color,
              primary: true,
            },
            ...teamPins,
          ],
        } satisfies LayerData);
        if (teamPins.length) {
          layers.push({
            kind: "arcs",
            arcs: teamPins.map((p) => ({
              from: [p.lon, p.lat],
              to: [venueCoord.lon, venueCoord.lat],
              color,
            })),
          });
        }
        inserts.push({
          title: "The venue",
          seconds: teamPins.length ? 11 : 8,
          shot: teamPins.length
            ? (wideShot([venueCoord, ...teamPins]) ?? {
                lon: venueCoord.lon,
                lat: venueCoord.lat,
                range: 2e6,
              })
            : {
                lon: venueCoord.lon,
                lat: venueCoord.lat - 0.5,
                range: 5.5e5,
                pitch: -34,
                heading: 20,
              },
          beats: [
            {
              text: teamPins.length
                ? `${teams.filter(Boolean).join(" and ")} met at ${venueName}.`
                : `${rev.title} took place at ${venueName}.`,
              cites: [venueId],
            },
          ],
          reveal: ["places", "arcs"],
        });
      }

      // 2. The result.
      if (results.length >= 2) {
        const by = (l: string) => results.find((r) => r.label === l);
        const winner = by("Winner");
        const jockey = by("Jockey");
        const trainer = by("Trainer");
        const second = by("Runner-up");
        const score = by("Score");
        const crowd = by("Attendance");
        const beats: ChapterDraft["beats"] = [];
        if (winner) {
          const extras = [
            jockey ? `ridden by ${jockey.text}` : "",
            trainer ? `trained by ${trainer.text}` : "",
          ].filter(Boolean);
          beats.push({
            text: `${winner.text} won${score ? `, ${score.text}` : ""}${second ? `, ahead of ${second.text}` : ""}${extras.length ? `, ${extras.join(" and ")}` : ""}.`,
            cites: [winner, score, second, jockey, trainer].flatMap((r) => (r ? [r.id] : [])),
          });
        }
        if (crowd) beats.push({ text: `${crowd.text} people were there.`, cites: [crowd.id] });
        if (!beats.length) {
          const [a, b] = results;
          beats.push({
            text: `${a?.label}: ${a?.text}. ${b?.label}: ${b?.text}.`,
            cites: [a?.id ?? "", b?.id ?? ""].filter(Boolean),
          });
        }
        inserts.push({
          title: "The result",
          seconds: 5 + beats.length * 6,
          shot: venueCoord
            ? {
                lon: venueCoord.lon,
                lat: venueCoord.lat - 1.2,
                range: 1.3e6,
                pitch: -40,
                heading: -14,
              }
            : { lon: 0, lat: 20, range: 1.6e7 },
          beats,
          panels: [
            {
              id: "result",
              kind: "facts",
              title: "The result",
              note: `From the event's Wikipedia infobox (revision of ${rev.timestamp.slice(0, 10)}).`,
              items: results
                .slice(0, 8)
                .map((r) => ({ label: r.label, text: r.text, cites: [r.id] })),
            } satisfies PanelDraft,
          ],
        });
      }

      // 3. Followed around the world: readers in each language.
      if (readers.length >= 3) {
        const ids = readers.map((r) =>
          add({
            id: `views:${r.lang}:${r.title.replace(/\s+/g, "_")}:${ctx.date}`,
            kind: "sensor",
            source: "wikimedia",
            t: dayStart,
            precision: "day",
            label: `${LANGUAGE[r.lang] ?? r.lang} Wikipedia: ${r.views.toLocaleString("en-GB")} readers of "${r.title}" on ${ctx.date}`,
            value: r.views,
            unit: "readers",
            url: `https://${r.lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
          }),
        );
        const [a, b, c] = readers;
        inserts.push({
          title: "Followed around the world",
          seconds: 10,
          shot: venueCoord
            ? { lon: venueCoord.lon, lat: venueCoord.lat - 8, range: 9e6, pitch: -50 }
            : { lon: 0, lat: 20, range: 1.6e7 },
          beats: [
            {
              text: `Read in ${readers.length} languages that day: most in ${LANGUAGE[a?.lang ?? ""] ?? a?.lang} (${a?.views.toLocaleString("en-GB")}), then ${LANGUAGE[b?.lang ?? ""] ?? b?.lang} (${b?.views.toLocaleString("en-GB")})${c ? ` and ${LANGUAGE[c.lang] ?? c.lang} (${c.views.toLocaleString("en-GB")})` : ""}.`,
              cites: ids.slice(0, 3),
            },
          ],
          panels: [
            {
              id: "languages",
              kind: "bars",
              title: "Readers by language",
              unit: "readers",
              note: "Wikipedia language editions on the day. A language is not a country.",
              items: readers.slice(0, 8).map((r, i) => ({
                label: LANGUAGE[r.lang] ?? r.lang,
                value: r.views,
                text: r.views.toLocaleString("en-GB"),
                color: i === 0 ? color : "#9ad9ff",
                cites: [ids[i] ?? ""],
              })),
            },
          ],
        });
      }

      for (const e of evidence) add(e);
      // Readers by language replace the English-only readers chapter.
      // The curiosity map moves with the readers: our chapter reveals it, from the same shot.
      const general = keep.find((c) => c.title === "Readers");
      const ours = inserts.find((c) => c.title === "Followed around the world");
      if (readers.length >= 3 && general?.reveal && ours) {
        ours.reveal = general.reveal;
        ours.shot = general.shot;
      }
      const base = readers.length >= 3 ? keep.filter((c) => c.title !== "Readers") : keep;
      const after = base.findIndex((c) => c.title === "What happened") + 1;
      base.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...base);
    },
  });
}
