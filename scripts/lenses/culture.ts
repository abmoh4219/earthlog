// The culture lens (PLAN.md Phase 11): films, series, shows, albums, books.
//   The credits  → the infobox (director, cast, music, studio, network, release, box office…),
//                  each value cited to the exact revision, at the studio's home;
//   Where it was filmed → the places the article's filming section links, in the order it
//                  tells them, drawn as a trail; each place cites its sentence;
//   The people   → where the people credited were born (Wikidata P19), converging on the
//                  studio; a "born in" panel by country.
// Then the general chapters (readers by language and the rest).
// Verified 2026-11-05 on Jailer 2 and Ramayana: Part 1 ({{Infobox film}}) and Dancing with the
// Stars season 35 ({{Infobox television season}} with a nested {{Infobox reality competition
// season}} for hosts and judges). Wikidata had no filming locations (P915) for any of them, so
// the article's own filming section is the source.
import { LENS_INFO } from "../../src/scene/edition.ts";
import { countryAt, countryName } from "../../src/scene/geo.ts";
import type { Country, Evidence, LayerData } from "../../src/scene/schema.ts";
import { fetchCoordinates } from "../bake/wikinews.ts";
import { fetchEntities, fetchQids, type WdEntity } from "../edition/sources.ts";
import { anyInfobox, plainText } from "./election/infobox.ts";
import type { ChapterDraft, PanelDraft } from "./film.ts";
import {
  generalLens,
  type LensContext,
  type LensResult,
  sharedLayer,
  wideShot,
} from "./general.ts";
import { expandTemplate, fetchRevision, splitSentences } from "./news-context.ts";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "{{Film date|2026|10|27|Academy Museum|2026|11|05|worldwide}}" → readable dates. */
function dates(args: string[]): string {
  const out: string[] = [];
  for (let i = 0; i + 2 < args.length + 1; ) {
    const [y, m, d] = [args[i], args[i + 1], args[i + 2]];
    if (!y || !/^\d{4}$/.test(y)) break;
    const month = m && /^\d{1,2}$/.test(m) ? MONTHS[Number(m) - 1] : undefined;
    const day = d && /^\d{1,2}$/.test(d) ? String(Number(d)) : undefined;
    const label = args[i + 3] && !/^\d{4}$/.test(args[i + 3] ?? "") ? args[i + 3] : undefined;
    out.push(`${[day, month, y].filter(Boolean).join(" ")}${label ? ` (${label})` : ""}`);
    i += label ? 4 : 3;
  }
  return out.join(", ");
}

const LIST =
  /^(plain ?list|ubl|ublist|unbulleted list|flat ?list|hlist|bulleted list|ordered list)$/;

/** Infobox templates → their words. Lists become one item per line. */
export function boxTemplate(body: string): string {
  const parts = body.split("|").map((p) => p.trim());
  const name = (parts[0] ?? "").toLowerCase().replace(/_/g, " ");
  const args = parts.slice(1).filter((p) => !/^[a-z_ ]+=/i.test(p));
  if (LIST.test(name)) return `\n${args.join("\n")}\n`;
  if (
    /^(film date|start date|end date|release date|start date and age|end date and age)$/.test(name)
  )
    return dates(args);
  if (name === "based on")
    return args.length >= 2 ? `${args[0]} by ${args.slice(1).join(" and ")}` : (args[0] ?? "");
  if (name === "en dash" || name === "ndash" || name === "snd") return "–";
  if (name === "inr") return `₹${args[0] ?? ""}`;
  // Aircraft registrations: US marks have no hyphen (N722BD), others do (G-EUPT).
  if (name === "airreg") return args[0] === "N" ? args.join("") : args.slice(0, 2).join("-");
  return expandTemplate(body);
}

/** An infobox value as items: refs and comments dropped, links to their text, lists split. */
export function boxItems(v: string): string[] {
  let w = v
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    // Links first, so a piped link's "|" can't split a template's arguments.
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1");
  for (let i = 0; i < 4; i++)
    w = w.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => boxTemplate(body));
  return w
    .split(/\n|<br\s*\/?>|^\s*\*|\s\*\s/gim)
    .map((s) => plainText(s.replace(/^\s*\*\s*/, "")))
    .map((s) => s.replace(/^[,;\s]+|[,;\s]+$/g, ""))
    .filter((s) => s.length > 0);
}

/** Linked article titles in a value, in order. */
export function links(v: string): string[] {
  return [...v.replace(/<ref[\s\S]*?<\/ref>/g, "").matchAll(/\[\[([^\]|#]+)/g)]
    .map((m) => (m[1] ?? "").trim())
    .filter((t) => t && !/^(File|Image|Category):/i.test(t));
}

/** Country names that take "the" in a sentence ("born in the United States"). */
export function the(country: string): string {
  return /^(United |Netherlands$|Philippines$|Czech Republic$|Bahamas$|Gambia$|Maldives$|Central African|Dominican Republic$|Democratic Republic|Republic of|Comoros$|Seychelles$|Marshall Islands$|Solomon Islands$)/.test(
    country,
  )
    ? `the ${country}`
    : country;
}

/**
 * The country whose outline passes closest to a point (within about 50 km), for coastal
 * cities just outside the simplified shapes. Label points would mislead: Thiruvananthapuram
 * is nearer Sri Lanka's label than India's.
 */
export function closestOutline(
  lon: number,
  lat: number,
  countries: Country[],
): Country | undefined {
  const k = Math.cos((lat * Math.PI) / 180);
  // Squared distance from the point to segment a–b, longitudes scaled by cos(latitude).
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    const [px, qx, rx] = [lon * k, ax * k, bx * k];
    const dx = rx - qx;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const u = len ? Math.max(0, Math.min(1, ((px - qx) * dx + (lat - ay) * dy) / len)) : 0;
    return (qx + u * dx - px) ** 2 + (ay + u * dy - lat) ** 2;
  };
  let best: Country | undefined;
  let bestD = 0.45 ** 2;
  for (const c of countries)
    for (const r of c.rings)
      for (let i = 0; i + 3 < r.length; i += 2) {
        const d = seg(r[i] ?? 0, r[i + 1] ?? 0, r[i + 2] ?? 0, r[i + 3] ?? 0);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
  return best;
}

/** "A", "A and B", "A, B and C". */
export function andList(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** The sections whose heading matches `re`, with their subsections, as raw wikitext. */
export function sectionsMatching(wikitext: string, re: RegExp): string {
  const lines = wikitext.split("\n");
  const out: string[] = [];
  let level = 0;
  for (const line of lines) {
    const h = /^(=+)\s*(.*?)\s*=+\s*$/.exec(line);
    if (h) {
      const l = h[1]?.length ?? 2;
      if (level && l <= level) level = 0;
      if (!level && re.test(h[2] ?? "")) level = l;
      continue;
    }
    if (level) out.push(line);
  }
  return out.join("\n");
}

/** Prose sentences of raw wikitext, each with the titles it links. */
export function linkedSentences(raw: string): { text: string; links: string[] }[] {
  let w = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "");
  for (let i = 0; i < 4; i++)
    w = w.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => expandTemplate(body));
  // Each paragraph is split on its own: headings ("==== November ====") and lists never
  // glue onto the sentence before or after them.
  const paragraphs = w
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^[|{}!*#:;=]/.test(l));
  return paragraphs
    .flatMap((p) => splitSentences(p))
    .map((s) => ({
      links: links(s),
      text: s
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
        .replace(/\[https?:\/\/\S+ ([^\]]+)\]/g, "$1")
        .replace(/'{2,}/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((s) => s.text.length > 20);
}

/** Credits worth showing, in order: [label, infobox keys, max items]. */
const CREDITS: [label: string, keys: string[], max: number][] = [
  ["Directed by", ["director", "directed by"], 2],
  ["Created by", ["creator", "created by"], 3],
  ["Author", ["author"], 2],
  ["Artist", ["artist"], 2],
  ["Starring", ["starring", "cast"], 4],
  ["Hosts", ["host", "hosts", "presenter", "presented by"], 3],
  ["Judges", ["judges"], 4],
  ["Music", ["music", "music by", "composer"], 2],
  ["Based on", ["based on"], 1],
  ["Studio", ["studio", "production companies", "production company"], 3],
  ["Network", ["network", "channel", "original network"], 3],
  ["Publisher", ["publisher"], 2],
  ["Label", ["label"], 2],
  ["Released", ["released", "release date", "published"], 2],
  ["First aired", ["first aired"], 1],
  ["Episodes", ["num episodes"], 1],
  ["Runtime", ["runtime", "length"], 1],
  ["Language", ["language"], 2],
  ["Budget", ["budget"], 1],
  ["Box office", ["gross", "box office"], 1],
];
/** Credits whose people we look up (birthplaces). */
const PEOPLE = [
  "Directed by",
  "Created by",
  "Author",
  "Artist",
  "Starring",
  "Hosts",
  "Judges",
  "Music",
];

export async function cultureLens(ctx: LensContext): Promise<LensResult> {
  const title = ctx.story.article?.title;
  const rev = title ? await fetchRevision(title) : undefined;
  const box = rev ? anyInfobox(rev.wikitext) : undefined;
  if (!title || !rev || !box) return generalLens(ctx);

  // TV seasons nest a second infobox (hosts, judges) inside a module parameter.
  const nested = [...box.params.values()].flatMap((v) => {
    const inner = /\{\{\s*Infobox/i.test(v) ? anyInfobox(v) : undefined;
    return inner ? [inner.params] : [];
  });
  const raw = (keys: string[]) => {
    for (const p of [box.params, ...nested])
      for (const k of keys) {
        const v = p.get(k);
        if (v && boxItems(v).length) return v;
      }
    return undefined;
  };

  const color = LENS_INFO.culture.color;
  const dayStart = `${ctx.date}T00:00:00Z`;
  const url = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(rev.title.replace(/ /g, "_"))}&oldid=${rev.revid}`;
  const when = rev.timestamp.slice(0, 16).replace("T", " ");
  const evidence: Evidence[] = [];
  const cite = (key: string, text: string, quote = text) => {
    const id = `wiki:box:${rev.revid}:${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    if (!evidence.some((e) => e.id === id)) {
      evidence.push({
        id,
        kind: "report",
        source: "wikipedia-article",
        t: dayStart,
        precision: "day",
        label: `Wikipedia, "${rev.title}" (revision of ${when} UTC): ${text}`,
        quote,
        url,
      });
    }
    return id;
  };

  // ── The credits ──
  const credits = CREDITS.flatMap(([label, keys, max]) => {
    const v = raw(keys);
    if (!v) return [];
    const items = boxItems(v).filter((s) => !/^see below$/i.test(s));
    if (!items.length) return [];
    const shown = items.slice(0, max);
    const more = items.length - shown.length;
    const text = `${shown.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
    if (text.length > 110) return [];
    return [
      { label, text, items: shown, more, links: links(v), id: cite(label, `${label}: ${text}`) },
    ];
  });
  const credit = (l: string) => credits.find((c) => c.label === l);

  // The studio's (or network's) home: Wikipedia coordinates, else Wikidata headquarters (P159).
  const studio = credit("Studio") ?? credit("Network");
  const studioTitle = studio?.links[0];
  let home: { name: string; lon: number; lat: number; id: string } | undefined;
  if (studioTitle) {
    const c = (await fetchCoordinates([studioTitle])).get(studioTitle);
    if (c) home = { name: studio?.items[0] ?? studioTitle, ...c, id: studio?.id ?? "" };
    else {
      const qid = (await fetchQids([studioTitle])).get(studioTitle);
      const org = qid ? (await fetchEntities([qid])).get(qid) : undefined;
      const hq = org?.items.P159?.[0];
      const hqe = hq ? (await fetchEntities([hq])).get(hq) : undefined;
      if (qid && org && hqe?.coord && hqe.label) {
        const id = `wd:${qid}:P159`;
        evidence.push({
          id,
          kind: "sensor",
          source: "wikidata",
          t: dayStart,
          precision: "day",
          label: `Wikidata, "${org.label ?? studioTitle}": headquarters ${hqe.label}`,
          url: `https://www.wikidata.org/wiki/${qid}#P159`,
        });
        home = { name: `${studio?.items[0] ?? studioTitle}, ${hqe.label}`, ...hqe.coord, id };
      }
    }
  }

  // ── Where it was filmed ──
  const filmingRaw = sectionsMatching(
    rev.wikitext,
    /^(filming|principal photography|shooting|locations?|filming locations?|production design)$/i,
  );
  const filmSentences = linkedSentences(filmingRaw).slice(0, 40);
  const filmCoords = await fetchCoordinates(filmSentences.flatMap((s) => s.links));
  const filming: { name: string; lon: number; lat: number; id: string }[] = [];
  filmSentences.forEach((s, n) => {
    for (const t of s.links) {
      const c = filmCoords.get(t);
      if (!c || filming.some((f) => f.name === t) || filming.length >= 10) continue;
      // Sentence evidence: the exact text the place rests on.
      const id = `wiki:film:${rev.revid}:${n}`;
      if (!evidence.some((e) => e.id === id))
        evidence.push({
          id,
          kind: "report",
          source: "wikipedia-article",
          t: dayStart,
          precision: "day",
          label: `Wikipedia, "${rev.title}", filming (revision of ${when} UTC)`,
          quote: s.text,
          url,
        });
      // "Film City, Mumbai" → "Film City"; "Attappadi taluk" → "Attappadi".
      const name = t
        .replace(/\s*\([^)]*\)$/, "")
        .replace(/,.*$/, "")
        .replace(/ (taluk|district|tehsil)$/i, "");
      if (!filming.some((f) => f.name === name)) filming.push({ name, ...c, id });
    }
  });

  // ── The people: where they were born ──
  const peopleTitles = [
    ...new Set(credits.filter((c) => PEOPLE.includes(c.label)).flatMap((c) => c.links)),
  ];
  // Reality shows list their celebrities in the cast or couples section, not the infobox.
  if (box.params.has("judges") || nested.some((p) => p.has("judges")))
    for (const s of linkedSentences(
      sectionsMatching(rev.wikitext, /^(cast|couples|contestants)$/i),
    ))
      for (const t of s.links) if (!peopleTitles.includes(t)) peopleTitles.push(t);
  const qids = await fetchQids(peopleTitles.slice(0, 40));
  const people = await fetchEntities([...new Set(qids.values())]);
  const humans = [...people.values()].filter(
    (e) => e.items.P31?.includes("Q5") && e.items.P19?.[0],
  );
  const birthplaces: Map<string, WdEntity> = await fetchEntities(
    humans.flatMap((h) => h.items.P19?.slice(0, 1) ?? []),
  );
  const births = humans.flatMap((h) => {
    const place = birthplaces.get(h.items.P19?.[0] ?? "");
    if (!place?.coord || !place.label || !h.label) return [];
    const id = `wd:${h.id}:P19`;
    evidence.push({
      id,
      kind: "sensor",
      source: "wikidata",
      t: dayStart,
      precision: "day",
      label: `Wikidata, "${h.label}": place of birth ${place.label}`,
      url: `https://www.wikidata.org/wiki/${h.id}#P19`,
    });
    // Coastal cities can fall just outside the simplified outlines: take the nearest country.
    const country =
      countryAt(place.coord.lon, place.coord.lat, ctx.countries) ??
      closestOutline(place.coord.lon, place.coord.lat, ctx.countries);
    const countryLabel = country ? countryName(country) : undefined;
    return [
      {
        person: h.label,
        // A birthplace recorded as a whole country is named once ("in Russia", not "Russia, Russia").
        place: place.label,
        where:
          place.label === countryLabel || !countryLabel
            ? place.label
            : `${place.label}, ${countryLabel}`,
        ...place.coord,
        country: countryLabel,
        id,
      },
    ];
  });

  return generalLens(ctx, {
    shape: ({ chapters, layers, add }) => {
      for (let i = layers.length - 1; i >= 0; i--)
        if (layers[i]?.kind === "places" && !sharedLayer(layers[i])) layers.splice(i, 1);
      const keep = chapters.filter((c) => c.title !== "Where" && c.title !== "On record");
      const inserts: ChapterDraft[] = [];
      const anchor = home ?? filming[0] ?? births[0] ?? ctx.story.place;

      // 1. The credits.
      if (credits.length >= 2) {
        const dir = credit("Directed by") ?? credit("Created by") ?? credit("Author");
        const stars = credit("Starring");
        const music = credit("Music");
        const hosts = credit("Hosts");
        const judges = credit("Judges");
        const network = credit("Network");
        const released = credit("Released");
        const gross = credit("Box office");
        const beats: ChapterDraft["beats"] = [];
        if (dir || stars) {
          const verb =
            dir?.label === "Author"
              ? "written"
              : dir?.label === "Created by"
                ? "created"
                : "directed";
          // Don't repeat a director the opening chapter already named.
          const told = chapters.flatMap((c) => c.beats.map((b) => b.text)).join(" ");
          const fresh = dir && !dir.items.every((n) => told.includes(n));
          const made = [
            dir && fresh ? `${verb} by ${andList(dir.items)}` : "",
            music ? `with music by ${andList(music.items)}` : "",
          ].filter(Boolean);
          const text = stars
            ? `${rev.title} stars ${andList(stars.items)}${stars.more > 0 ? " among others" : ""}${made.length ? `; ${made.join(", ")}` : ""}.`
            : `${rev.title} is ${made.join(", ")}.`;
          beats.push({
            text,
            cites: [stars, fresh ? dir : undefined, music].flatMap((c) => (c ? [c.id] : [])),
          });
        }
        if (hosts || judges) {
          beats.push({
            text: `${network ? `On ${andList(network.items)}, ` : ""}${hosts ? `hosted by ${andList(hosts.items)}` : ""}${hosts && judges ? ", " : ""}${judges ? `judged by ${andList(judges.items)}` : ""}.`.replace(
              /^./,
              (c) => c.toUpperCase(),
            ),
            cites: [network, hosts, judges].flatMap((c) => (c ? [c.id] : [])),
          });
        }
        if (released || gross) {
          beats.push({
            text: [
              released ? `Released: ${released.text}.` : "",
              gross ? `Box office, as Wikipedia records it: ${gross.text}.` : "",
            ]
              .filter(Boolean)
              .join(" "),
            cites: [released, gross].flatMap((c) => (c ? [c.id] : [])),
          });
        }
        if (!beats.length) {
          const [a, b] = credits;
          beats.push({
            text: `${a?.label}: ${a?.text}. ${b?.label}: ${b?.text}.`,
            cites: [a?.id ?? "", b?.id ?? ""].filter(Boolean),
          });
        }
        if (home) {
          layers.push({
            kind: "places",
            name: "home",
            places: [
              {
                name: home.name.split(",")[0] ?? home.name,
                lon: home.lon,
                lat: home.lat,
                color,
                primary: true,
              },
            ],
          } satisfies LayerData);
        }
        inserts.push({
          title: "The credits",
          seconds: 6 + beats.length * 6,
          shot: anchor
            ? { lon: anchor.lon, lat: anchor.lat - 2.2, range: 1.8e6, pitch: -40, heading: 16 }
            : { lon: 0, lat: 20, range: 1.6e7 },
          beats,
          panels: [
            {
              id: "credits",
              kind: "facts",
              title: "The credits",
              note: `From the Wikipedia infobox (revision of ${rev.timestamp.slice(0, 10)}).`,
              items: credits
                .slice(0, 9)
                .map((c) => ({ label: c.label, text: c.text, cites: [c.id] })),
            } satisfies PanelDraft,
          ],
          ...(home ? { reveal: ["places-home"] } : {}),
        });
      }

      // 2. Where it was filmed: a trail through the places, in the order the article tells them.
      if (filming.length >= 2) {
        layers.push({
          kind: "places",
          name: "filming",
          places: filming.map((f, i) => ({
            name: f.name,
            lon: f.lon,
            lat: f.lat,
            color,
            primary: i === 0,
          })),
        } satisfies LayerData);
        const legs = filming
          .slice(1)
          .map((f, i) => ({ from: filming[i], to: f }))
          .filter(
            (l): l is { from: (typeof filming)[number]; to: (typeof filming)[number] } =>
              !!l.from && Math.hypot(l.from.lon - l.to.lon, l.from.lat - l.to.lat) > 0.2,
          );
        if (legs.length)
          layers.push({
            kind: "arcs",
            name: "filming",
            sequence: true,
            arcs: legs.map((l) => ({
              from: [l.from.lon, l.from.lat],
              to: [l.to.lon, l.to.lat],
              color,
            })),
          } satisfies LayerData);
        const first = filmSentences.find(
          (s) =>
            s.text.length <= 220 &&
            /\b(began|started|commenced|took place|filmed|shot)\b/i.test(s.text),
        );
        const firstId = first
          ? `wiki:film:${rev.revid}:${filmSentences.indexOf(first)}`
          : undefined;
        const beats: ChapterDraft["beats"] = [];
        if (first && firstId && evidence.some((e) => e.id === firstId))
          beats.push({ text: first.text, cites: [firstId] });
        beats.push({
          text: `The article places the filming in ${
            filming.length > 6
              ? `${filming
                  .slice(0, 6)
                  .map((f) => f.name)
                  .join(", ")} and ${filming.length - 6} more places`
              : andList(filming.map((f) => f.name))
          }.`,
          cites: [...new Set(filming.map((f) => f.id))],
        });
        inserts.push({
          title: "Where it was filmed",
          seconds: 6 + beats.length * 5 + legs.length * 1.4,
          shot: wideShot(filming) ?? {
            lon: filming[0]?.lon ?? 0,
            lat: filming[0]?.lat ?? 0,
            range: 1.5e6,
          },
          beats,
          reveal: ["places-filming", "arcs-filming"],
          hide: ["places-home"],
        });
      }

      // 3. The people: where they were born, converging on the studio's home.
      if (births.length >= 3) {
        const groups = new Map<string, typeof births>();
        for (const b of births) groups.set(b.place, [...(groups.get(b.place) ?? []), b]);
        layers.push({
          kind: "places",
          name: "people",
          places: [...groups.values()].map((g) => {
            const [b] = g;
            return {
              name: g.length === 1 ? `${b?.person} · ${b?.place}` : `${b?.place} · ${g.length}`,
              lon: b?.lon ?? 0,
              lat: b?.lat ?? 0,
              color: "#ffd38a",
            };
          }),
        } satisfies LayerData);
        if (home)
          layers.push({
            kind: "arcs",
            name: "people",
            arcs: [...groups.values()]
              .map((g) => g[0])
              .filter(
                (b): b is (typeof births)[number] =>
                  !!b && Math.hypot(b.lon - home.lon, b.lat - home.lat) > 0.3,
              )
              .map((b) => ({ from: [b.lon, b.lat], to: [home.lon, home.lat], color: "#ffd38a" })),
          } satisfies LayerData);
        const byCountry = new Map<string, typeof births>();
        for (const b of births)
          if (b.country) byCountry.set(b.country, [...(byCountry.get(b.country) ?? []), b]);
        const ranked = [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length);
        const [top] = ranked;
        const beats: ChapterDraft["beats"] = [
          {
            text: top
              ? `${births.length} of the people credited have a birthplace on record; ${top[1].length === births.length ? "all" : top[1].length} ${top[1].length === 1 ? "was" : "were"} born in ${the(top[0])}.`
              : `${births.length} of the people credited have a birthplace on record.`,
            cites: births.map((b) => b.id),
          },
        ];
        const away = top ? births.filter((b) => b.country !== top[0]).slice(0, 3) : [];
        if (away.length)
          beats.push({
            text: `Born further afield: ${andList(away.map((b) => `${b.person} in ${b.where}`))}.`,
            cites: away.map((b) => b.id),
          });
        inserts.push({
          title: "The people",
          seconds: 6 + beats.length * 6,
          shot: wideShot([...births, ...(home ? [home] : [])]) ?? {
            lon: births[0]?.lon ?? 0,
            lat: births[0]?.lat ?? 0,
            range: 3e6,
          },
          beats,
          panels: ranked.length
            ? [
                {
                  id: "born-in",
                  kind: "bars",
                  title: "Born in",
                  unit: "people",
                  note: "Birthplaces of the people credited, from Wikidata.",
                  items: ranked.slice(0, 8).map(([country, list], i) => ({
                    label: country,
                    value: list.length,
                    text: String(list.length),
                    color: i === 0 ? color : "#ffd38a",
                    cites: list.map((b) => b.id),
                  })),
                } satisfies PanelDraft,
              ]
            : [],
          reveal: ["places-people", "arcs-people"],
          hide: ["places-filming", "arcs-filming", "places-home"],
        });
      }

      for (const e of evidence) add(e);
      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      // The chapter after ours clears the people map so it doesn't crowd what follows.
      const next = keep[after];
      if (next && inserts.length)
        next.hide = [
          ...(next.hide ?? []),
          "places-people",
          "arcs-people",
          "places-filming",
          "arcs-filming",
        ];
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}
