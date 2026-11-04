// The edition builder's pure core: candidates in, a ranked and balanced list of stories out.
// No network here (see sources.ts); everything is decided from recorded inputs, so it is
// tested end to end against fixtures.
//
//   1. Candidates: the day's most-read articles + the day's Current events items.
//   2. Attach each news item to the most-read article it links (same story), or keep it
//      as a news-only story (most of the world's conflicts and disasters never trend).
//   3. Drop noise: lists and pages whose readership didn't spike and that no news mentions.
//   4. Fold related articles into the story that links them (candidates → their election).
//   5. Type each story into a lens from Wikidata, place it, score its heat.
//   6. Pick about a dozen: hottest first, at most 3 per lens, then make sure every
//      continent with a story that day is represented.
import type { Continent, Edition, EditionStory, Lens } from "../../src/scene/edition.ts";
import { countryAt, nearestCountry } from "../../src/scene/geo.ts";
import type { Country, Evidence, NewsStory, Source } from "../../src/scene/schema.ts";
import type { RawStory } from "../bake/wikinews.ts";
import { isNotAStory, lensFromHeading, lensFromTypes } from "./lens.ts";
import type { MostRead, WdEntity } from "./sources.ts";

export const MAX_STORIES = 14;
export const MAX_WITH_BALANCE = 18;
export const MAX_PER_LENS = 3;
/** Readers that day ÷ the article's normal level; below this a page is "evergreen". */
export const SPIKE_MIN = 2.5;

const NOISE_TITLE = /^(Main Page|Special:|Deaths in |List of |Portal:|Wikipedia:|File:|Template:)/;

export interface BuildInput {
  date: string;
  generatedAt: string;
  mostRead: MostRead[];
  news: { raw: RawStory[]; stories: NewsStory[]; evidence: Evidence[] };
  /** Page title → Wikidata id, for news links and topics. */
  qids: Map<string, string>;
  entities: Map<string, WdEntity>;
  /** Article title → candidate titles it links to. */
  links: Map<string, Set<string>>;
  countries: Country[];
}

interface Cluster {
  lead?: MostRead;
  members: MostRead[];
  newsIdx: number[];
  /** Topic article for news-only stories, e.g. "2026 Strait of Hormuz crisis". */
  topic?: string;
}

const spikeOf = (m: MostRead) =>
  m.priorMedian !== undefined ? m.views / Math.max(1, m.priorMedian) : undefined;

export function buildEdition(input: BuildInput): {
  edition: Edition;
  evidence: Evidence[];
  sources: Source[];
} {
  const { date, mostRead, news, qids, entities, links, countries } = input;
  const typeLabels = (qid?: string) =>
    (qid ? (entities.get(qid)?.items.P31 ?? []) : []).map((t) => entities.get(t)?.label ?? t);

  // Lists, specials and calendars are never stories (checked first, so news can't attach to them).
  const candidates = mostRead.filter(
    (m) => !NOISE_TITLE.test(m.title) && !isNotAStory(typeLabels(m.qid)),
  );

  // 1–2. Attach news items to most-read articles they link.
  const byTitle = new Map(candidates.map((m) => [m.title, m]));
  const clusters = new Map<string, Cluster>();
  const newsOnly: Cluster[] = [];
  news.raw.forEach((r, i) => {
    const hits = [...(r.topic ? [r.topic] : []), ...r.links]
      .map((t) => byTitle.get(t))
      .filter((m): m is MostRead => m !== undefined)
      .sort((a, b) => b.views - a.views);
    const hit = hits[0];
    if (hit) {
      const c = clusters.get(hit.title) ?? { lead: hit, members: [hit], newsIdx: [] };
      c.newsIdx.push(i);
      clusters.set(hit.title, c);
      return;
    }
    // News-only: items under the same running topic are one story.
    const same = r.topic ? newsOnly.find((c) => c.topic === r.topic) : undefined;
    if (same) same.newsIdx.push(i);
    else newsOnly.push({ members: [], newsIdx: [i], ...(r.topic ? { topic: r.topic } : {}) });
  });

  // 3. Keep most-read pages that spiked or that the news mentions; drop lists and specials.
  const kept = candidates
    .filter((m) => clusters.has(m.title) || (spikeOf(m) ?? SPIKE_MIN) >= SPIKE_MIN)
    .sort((a, b) => b.views - a.views);

  // 4. Fold an article into a hotter story that links to it.
  const leadOf = new Map<string, string>();
  for (const m of kept) {
    const parent = kept.find(
      (p) =>
        p.views > m.views && leadOf.get(p.title) === p.title && links.get(p.title)?.has(m.title),
    );
    if (parent && !clusters.get(m.title)?.newsIdx.length) {
      leadOf.set(m.title, parent.title);
      const c = clusters.get(parent.title) ?? { lead: parent, members: [parent], newsIdx: [] };
      c.members.push(m);
      clusters.set(parent.title, c);
    } else {
      leadOf.set(m.title, m.title);
      if (!clusters.has(m.title)) clusters.set(m.title, { lead: m, members: [m], newsIdx: [] });
    }
  }
  const all: Cluster[] = [
    ...[...clusters.values()].filter((c) => c.lead && leadOf.get(c.lead.title) === c.lead.title),
    ...newsOnly,
  ];

  // 5. Type, place and score.
  const evidence: Evidence[] = [];
  const evidenceIds = new Set<string>();
  const addEvidence = (e: Evidence) => {
    if (!evidenceIds.has(e.id)) {
      evidenceIds.add(e.id);
      evidence.push(e);
    }
  };
  const dayStart = `${date}T00:00:00Z`;
  const dayLabel = new Date(dayStart).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const scored = all.map((c) => {
    const items = c.newsIdx.map((i) => ({ raw: news.raw[i], story: news.stories[i] }));
    const firstNews = items[0];
    const topicQid = c.topic ? qids.get(c.topic) : undefined;
    // News-only stories without a topic: the news heading ("Disasters and accidents") knows
    // the kind of story better than whatever company or person the item happens to link.
    const headingLens = firstNews?.raw ? lensFromHeading(firstNews.raw.heading) : "general";
    const leadQid =
      c.lead?.qid ??
      topicQid ??
      (headingLens === "general"
        ? leadLinkQid(firstNews?.raw, qids, entities, typeLabels)
        : undefined);
    const types = typeLabels(leadQid);
    const lens: Lens = lensFromTypes(types) ?? headingLens;

    const readers = c.members.reduce((sum, m) => sum + m.views, 0);
    const spike = c.lead ? spikeOf(c.lead) : undefined;
    const sources = items.reduce((n, it) => n + (it.raw?.sources.length ?? 0), 0);
    // A death in the past week is news in itself, even when no news item lists it.
    const died = leadQid ? entities.get(leadQid)?.died : undefined;
    const diedNow =
      died !== undefined &&
      Date.parse(died) <= Date.parse(date) &&
      Date.parse(date) - Date.parse(died) <= 7 * 86_400_000;
    const raw =
      Math.log10(1 + readers) * (1 + Math.log2(Math.min(1024, Math.max(1, spike ?? 1))) / 10) +
      // Reported news weighs like a strongly read article: most of the world's conflicts and
      // disasters never reach the English most-read list, and must still make the edition.
      3 * Math.min(2, items.length) +
      0.3 * Math.min(10, sources) +
      (diedNow ? 2 : 0);

    const place = placeOf(c, items[0]?.story, leadQid, entities, countries, date);
    if (place?.evidence?.startsWith("wd:") && leadQid) {
      addEvidence({
        id: place.evidence,
        kind: "sensor",
        source: "wikidata",
        t: dayStart,
        precision: "day",
        label: `Wikidata: ${place.role ?? "place"} of "${entities.get(leadQid)?.label ?? leadQid}": ${place.name}`,
        url: `https://www.wikidata.org/wiki/${leadQid}`,
      });
    }
    const country = place?.country
      ? countries.find((x) => x.code === place.country)
      : place
        ? (countryAt(place.lon, place.lat, countries) ??
          nearestCountry(place.lon, place.lat, countries))
        : undefined;
    const continent = asContinent(country?.continent);

    // Evidence: why this story is here and what its lens rests on.
    const ids: string[] = [];
    for (const it of items) if (it.story) ids.push(it.story.evidence);
    for (const m of c.members) {
      const id = `views:en:${m.title.replace(/ /g, "_")}:${date}`;
      addEvidence({
        id,
        kind: "sensor",
        source: "wikimedia",
        t: dayStart,
        precision: "day",
        label: `English Wikipedia: ${m.views.toLocaleString("en-GB")} readers of "${m.title}" on ${dayLabel}`,
        value: m.views,
        unit: "readers",
        url: m.url,
      });
      ids.push(id);
      if (m.priorMedian !== undefined) {
        const base = `views:en:${m.title.replace(/ /g, "_")}:prior`;
        addEvidence({
          id: base,
          kind: "baseline",
          source: "wikimedia",
          t: dayStart,
          precision: "day",
          label:
            m.priorMedian === 0
              ? `"${m.title}": no readers 8 to 60 days before (a new article)`
              : `"${m.title}": normally a median of ${m.priorMedian.toLocaleString("en-GB")} readers a day (8 to 60 days before)`,
          value: m.priorMedian,
          unit: "readers",
          url: m.url,
        });
        ids.push(base);
      }
    }
    if (leadQid && types.length) {
      const id = `wd:${leadQid}:P31`;
      addEvidence({
        id,
        kind: "sensor",
        source: "wikidata",
        t: dayStart,
        precision: "day",
        label: `Wikidata: "${entities.get(leadQid)?.label ?? leadQid}" is an instance of ${types.join(", ")}`,
        url: `https://www.wikidata.org/wiki/${leadQid}`,
      });
      ids.push(id);
    }

    // News-only stories are titled by what happened, not by the broad topic they sit under,
    // unless the topic is the event itself (a race, an election, a crash: same lens).
    const topicLens = c.topic ? lensFromTypes(typeLabels(topicQid)) : undefined;
    const title =
      c.lead?.title ??
      (c.topic && topicLens && topicLens === lens
        ? c.topic
        : headline(firstNews?.raw?.text ?? c.topic ?? "Untitled"));
    const summary = firstNews?.raw?.text ?? c.lead?.description ?? "";
    const about = c.lead?.extract;
    const story: Omit<EditionStory, "slug" | "heat"> & { rawHeat: number } = {
      lens,
      title,
      summary,
      ...(about ? { about } : {}),
      ...(c.lead
        ? {
            article: {
              title: c.lead.title,
              url: c.lead.url,
              ...(c.lead.qid ? { qid: c.lead.qid } : {}),
            },
          }
        : c.topic
          ? {
              article: {
                title: c.topic,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(c.topic.replace(/ /g, "_"))}`,
                ...(topicQid ? { qid: topicQid } : {}),
              },
            }
          : {}),
      ...(place ? { place } : {}),
      ...(continent ? { continent } : {}),
      ...(readers ? { readers } : {}),
      ...(spike !== undefined ? { spike: Math.round(spike * 10) / 10 } : {}),
      sources,
      related: c.members.filter((m) => m !== c.lead).map((m) => m.title),
      evidence: ids,
      rawHeat: raw,
    };
    return story;
  });

  // 6. Pick: hottest first with a per-lens cap, then fill missing continents.
  scored.sort((a, b) => b.rawHeat - a.rawHeat);
  const picked: typeof scored = [];
  const perLens = new Map<Lens, number>();
  for (const s of scored) {
    if (picked.length >= MAX_STORIES) break;
    if ((perLens.get(s.lens) ?? 0) >= MAX_PER_LENS) continue;
    if (s.evidence.length === 0) continue;
    picked.push(s);
    perLens.set(s.lens, (perLens.get(s.lens) ?? 0) + 1);
  }
  const covered = new Set(picked.map((s) => s.continent));
  for (const s of scored) {
    if (picked.length >= MAX_WITH_BALANCE) break;
    if (!s.continent || covered.has(s.continent) || picked.includes(s) || !s.evidence.length)
      continue;
    picked.push(s);
    covered.add(s.continent);
  }
  // Every kind of story that had a candidate gets its best one too (a sports result, a film),
  // so an edition is never all one kind of news.
  const kinds = new Set(picked.map((s) => s.lens));
  for (const s of scored) {
    if (picked.length >= MAX_WITH_BALANCE) break;
    if (kinds.has(s.lens) || s.lens === "general" || picked.includes(s) || !s.evidence.length)
      continue;
    picked.push(s);
    kinds.add(s.lens);
  }
  picked.sort((a, b) => b.rawHeat - a.rawHeat);

  const top = picked[0]?.rawHeat ?? 1;
  const slugs = new Set<string>();
  const stories: EditionStory[] = picked.map(({ rawHeat, ...s }) => {
    let slug = slugify(s.title);
    for (let n = 2; slugs.has(slug); n++) slug = `${slugify(s.title)}-${n}`;
    slugs.add(slug);
    return { ...s, slug, heat: Math.round((rawHeat / top) * 100) };
  });

  // Only evidence that a picked story uses ships with the edition.
  const used = new Set(stories.flatMap((s) => s.evidence));
  const shipped = [...news.evidence, ...evidence].filter((e) => used.has(e.id));
  const sourcesUsed = new Set(shipped.map((e) => e.source));
  const at = input.generatedAt;
  const sources: Source[] = [
    {
      id: "wikipedia",
      name: "Wikipedia, Current events",
      url: "https://en.wikipedia.org/wiki/Portal:Current_events",
      license: "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)",
      attribution: "Wikipedia contributors, Current events",
      retrievedAt: at,
    },
    {
      id: "wikimedia",
      name: "Wikimedia pageviews (most read)",
      url: "https://wikimedia.org/api/rest_v1/",
      license: "Pageview counts: CC0; article titles and descriptions: CC BY-SA 4.0",
      attribution: "Wikimedia Foundation",
      retrievedAt: at,
    },
    {
      id: "wikidata",
      name: "Wikidata",
      url: "https://www.wikidata.org/",
      license: "CC0 1.0",
      attribution: "Wikidata contributors",
      retrievedAt: at,
    },
  ].filter((s) => sourcesUsed.has(s.id));

  return {
    edition: { version: 1, date, generatedAt: at, candidates: all.length, stories },
    evidence: shipped,
    sources,
  };
}

/** For a news item with no topic: the first linked article whose type gives a real lens. */
function leadLinkQid(
  raw: RawStory | undefined,
  qids: Map<string, string>,
  entities: Map<string, WdEntity>,
  typeLabels: (q?: string) => string[],
): string | undefined {
  for (const t of raw?.links ?? []) {
    const q = qids.get(t);
    if (!q || !entities.has(q)) continue;
    const lens = lensFromTypes(typeLabels(q));
    if (lens && lens !== "person") return q;
  }
  return undefined;
}

/**
 * Where the story is: the news item's place (most specific); else the article's own
 * coordinates; for a person who died that week, the place of death; else headquarters or
 * location; else the country (of the event, of origin, of citizenship).
 */
function placeOf(
  c: Cluster,
  newsStory: NewsStory | undefined,
  qid: string | undefined,
  entities: Map<string, WdEntity>,
  countries: Country[],
  date: string,
): EditionStory["place"] {
  if (newsStory?.place) {
    const p = newsStory.place;
    const country = p.country
      ? countries.find((x) => x.name === p.name || x.aliases.includes(p.name))
      : countryAt(p.lon, p.lat, countries);
    return {
      name: p.name,
      lon: p.lon,
      lat: p.lat,
      ...(country ? { country: country.code } : {}),
      role: "Where it was reported",
      evidence: newsStory.evidence,
    };
  }
  const ROLE: Record<string, string> = {
    P625: "Location",
    P20: "Place of death",
    P159: "Headquarters",
    P276: "Location",
    P131: "Located in",
    P17: "Country",
    P495: "Country of origin",
    P27: "Country of citizenship",
  };
  const cite = (prop: string) => ({ role: ROLE[prop] ?? "Place", evidence: `wd:${qid}:${prop}` });
  const e = qid ? entities.get(qid) : undefined;
  if (!e) return undefined;
  const at = (id: string | undefined) => (id ? entities.get(id) : undefined);
  const named = (x: WdEntity, coord: { lat: number; lon: number }) => {
    // The place's own country (Wikidata P17) beats geometry: 1:110m outlines miss small
    // islands (the Canaries would otherwise snap to Africa's nearest country).
    const iso = at(x.items.P17?.[0])?.iso2;
    const country =
      (iso ? countries.find((k) => k.code === iso) : undefined) ??
      countryAt(coord.lon, coord.lat, countries);
    // An event's own coordinates are best named by the area it happened in.
    const area =
      x === e ? (at(x.items.P131?.[0])?.label ?? at(x.items.P276?.[0])?.label) : undefined;
    return {
      name: area ?? x.label ?? c.lead?.title ?? "",
      lon: coord.lon,
      lat: coord.lat,
      ...(country ? { country: country.code } : {}),
    };
  };
  if (e.coord) return { ...named(e, e.coord), ...cite("P625") };
  const recentDeath =
    e.died !== undefined && Math.abs(Date.parse(e.died) - Date.parse(date)) < 14 * 86_400_000;
  const placeProps = recentDeath ? ["P20", "P159", "P276", "P131"] : ["P159", "P276", "P131"];
  for (const prop of placeProps) {
    const p = at(e.items[prop]?.[0]);
    if (p?.coord) return { ...named(p, p.coord), ...cite(prop) };
  }
  // The country: of the event, of origin, of citizenship; for a season or an episode, of the
  // series it belongs to (P179 "part of the series", P361 "part of").
  for (const holder of [e, at(e.items.P179?.[0]), at(e.items.P361?.[0])]) {
    for (const prop of ["P17", "P495", "P27"]) {
      const iso = at(holder?.items[prop]?.[0])?.iso2;
      const country = iso ? countries.find((x) => x.code === iso) : undefined;
      if (country) {
        return {
          name: country.name,
          lon: country.label[0],
          lat: country.label[1],
          country: country.code,
          // Inherited from the series (a TV season): cite only the story's own claims.
          ...(holder === e ? cite(prop) : { role: ROLE[prop] ?? "Country" }),
        };
      }
    }
  }
  return undefined;
}

function asContinent(name: string | undefined): Continent | undefined {
  const all: Continent[] = [
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "South America",
    "Oceania",
    "Antarctica",
  ];
  return all.find((c) => c === name);
}

/** A short title from a news sentence: up to the first clause, at most ~80 characters. */
export function headline(text: string): string {
  // Sports items open with the sport ("In association football, …"): skip that lead-in.
  const body = text.replace(/^In [^,]{3,40}, /, "");
  const clean = body.charAt(0).toUpperCase() + body.slice(1);
  const first = clean.split(/[,;:]| — /)[0]?.trim() ?? clean;
  return first.length <= 80 ? first : `${first.slice(0, first.lastIndexOf(" ", 78))}…`;
}

export function slugify(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "story"
  );
}

/** Referenced Wikidata ids not fetched yet (types, places, countries); call until empty. */
export function secondRoundIds(entities: Map<string, WdEntity>): string[] {
  const ids = new Set<string>();
  for (const e of entities.values()) {
    for (const prop of [
      "P31",
      "P20",
      "P159",
      "P276",
      "P131",
      "P17",
      "P495",
      "P27",
      "P179",
      "P361",
    ]) {
      for (const id of e.items[prop] ?? []) if (!entities.has(id)) ids.add(id);
    }
  }
  return [...ids];
}
