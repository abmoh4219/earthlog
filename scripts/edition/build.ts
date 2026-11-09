// The edition builder's pure core: candidates in, a ranked and balanced list of stories out.
// No network here (see sources.ts); everything is decided from recorded inputs, so it is
// tested end to end against fixtures.
//
//   1. Candidates: the day's most-read articles + the day's Current events items.
//   2. Attach each news item to the most-read article it links (same story), or keep it
//      as a news-only story (most of the world's conflicts and disasters never trend).
//   3. Drop noise: lists and pages whose readership didn't spike and that no news mentions.
//   4. Fold related articles into the story that links them (candidates → their election).
//   5. Type each story into a lens from Wikidata, place it, score how newsworthy it is
//      (src/scene/newsworthy.ts: outlets, regions, speed, follow-ups, magnitude, Current
//      events; readers only as a bonus, ADR-0021). Stories two or more outlets reported that
//      neither Wikipedia list had join as stories found by the outlets.
//   6. Pick about a dozen: hottest first, at most 3 per lens, then make sure every
//      continent with a story that day is represented.
import type { Continent, Edition, EditionStory, Lens } from "../../src/scene/edition.ts";
import { countryAt, nearestCountry } from "../../src/scene/geo.ts";
import type { ClusterPlace, Headline } from "../../src/scene/headlines.ts";
import {
  headlineSignals,
  newsworthiness,
  reasonsOf,
  type Signals,
} from "../../src/scene/newsworthy.ts";
import { outletById } from "../../src/scene/outlets.ts";
import type { Country, Evidence, NewsStory, Source } from "../../src/scene/schema.ts";
import type { Topic } from "../../src/scene/topics.ts";
import type { RawStory } from "../bake/wikinews.ts";
import { words } from "../news/text.ts";
import type { Coverage } from "./coverage.ts";
import {
  EVENT_LENSES,
  isEventPage,
  isEvergreen,
  isNotAStory,
  lensFromHeading,
  lensFromTypes,
} from "./lens.ts";
import type { MostRead, WdEntity } from "./sources.ts";

export const MAX_STORIES = 14;
export const MAX_WITH_BALANCE = 18;
export const MAX_PER_LENS = 3;
/** Readers that day ÷ the article's normal level; below this a page is "evergreen". */
export const SPIKE_MIN = 2.5;
/**
 * An article no news item mentions needs a bigger spike to be a story: a web domain read 4×
 * its usual made three editions in a row (2026-11-04 to 06).
 */
export const NEWSLESS_SPIKE_MIN = 5;
/** A story seen in this many previous days returns only with new reporting (ADR-0015). */
export const REPEAT_DAYS = 7;

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
  /** Recent editions (any order), so stories already told don't come back without news. */
  history?: { date: string; stories: EditionStory[] }[];
  /** Outlets' headlines of the day, matched to stories (scripts/edition/coverage.ts). */
  coverage?: Coverage;
  /** The outlets' stories of the day (clustered headlines), for stories neither list had. */
  outletStories?: OutletStory[];
}

/** One story as the outlets told it that day (a Now cluster restricted to the day). */
export interface OutletStory {
  id: string;
  title: string;
  topic: Topic;
  place?: ClusterPlace;
  /** The Wikipedia article its headlines name (scripts/news/context.ts), if any. */
  context?: { title: string; url: string; text: string };
  /** Its headlines of the day. */
  headlines: Headline[];
}

/** A story's lens when only its topic is known (the film comes from the headlines). */
const TOPIC_LENS: Partial<Record<Topic, Lens>> = {
  conflict: "conflict",
  disaster: "disaster",
  sports: "sports",
  culture: "culture",
  business: "economy",
  science: "science",
};

/** One headline per outlet, its first: what an edition credits. */
const firstPerOutlet = (hs: Headline[]) => {
  const first = new Map<string, Headline>();
  for (const h of [...hs].sort((a, b) => a.t.localeCompare(b.t)))
    if (!first.has(h.outlet)) first.set(h.outlet, h);
  return [...first.values()];
};

/** The same story across editions: its Wikidata item, else its article, else its title. */
export function storyKey(s: {
  title: string;
  article?: { title: string; qid?: string | undefined } | undefined;
}): string {
  return (
    s.article?.qid ??
    (s.article ? `article:${s.article.title.toLowerCase()}` : `title:${slugify(s.title)}`)
  );
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

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
  /** Titles left out because a recent edition told them and nothing new was reported. */
  repeats: string[];
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

  // 3. Keep most-read pages the news mentions, or that spiked hard and are not evergreen
  //    reading (holidays, domains, terms); drop lists and specials.
  const kept = candidates
    .filter(
      (m) =>
        clusters.has(m.title) ||
        ((spikeOf(m) ?? NEWSLESS_SPIKE_MIN) >= NEWSLESS_SPIKE_MIN &&
          !isEvergreen(typeLabels(m.qid))),
    )
    .sort((a, b) => b.views - a.views);

  // 4. Fold an article into a hotter story that links to it, and a thing into the event it
  //    belongs to whichever was read more ("Learjet 60" into the Learjet 60 crash). Events go
  //    first so they are leads before the things that fold into them.
  const isEvent = (m: MostRead) => isEventPage(typeLabels(m.qid));
  const linked = (a: MostRead, b: MostRead) =>
    links.get(a.title)?.has(b.title) || links.get(b.title)?.has(a.title);
  const leadOf = new Map<string, string>();
  const order = [...kept].sort(
    (a, b) => Number(isEvent(b)) - Number(isEvent(a)) || b.views - a.views,
  );
  for (const m of order) {
    const parent = kept.find(
      (p) =>
        p !== m &&
        leadOf.get(p.title) === p.title &&
        ((p.views > m.views && links.get(p.title)?.has(m.title)) ||
          (isEvent(p) && !isEvent(m) && linked(p, m))),
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

  // Headlines already credited to a story: an outlets' story made of them is the same story.
  const claimed = new Map<string, number>();
  const reportEvidence = (h: Headline) => {
    const id = `news:${h.outlet}:${h.id}`;
    addEvidence({
      id,
      kind: "report",
      source: `outlet:${h.outlet}`,
      t: h.t,
      label: `${outletById(h.outlet)?.name ?? h.outlet}: ${h.title}`,
      url: h.url,
      quote: h.title,
    });
    return id;
  };
  const scored = all.map((c, index) => {
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

    // Which outlets reported it that day: breadth of reporting is heat, and each headline is
    // cited evidence (ADR-0017).
    const reportedAll =
      input.coverage?.matchAll(
        [c.lead?.title, c.lead?.description, c.topic, ...items.map((it) => it.raw?.text)].filter(
          (t): t is string => Boolean(t),
        ),
      ) ?? [];
    for (const h of reportedAll) if (!claimed.has(h.id)) claimed.set(h.id, index);
    const reported = firstPerOutlet(reportedAll);

    const readers = c.members.reduce((sum, m) => sum + m.views, 0);
    const spike = c.lead ? spikeOf(c.lead) : undefined;
    const sources = items.reduce((n, it) => n + (it.raw?.sources.length ?? 0), 0);
    // A death in the past week is news in itself, even when no news item lists it.
    const died = leadQid ? entities.get(leadQid)?.died : undefined;
    const diedNow =
      died !== undefined &&
      Date.parse(died) <= Date.parse(date) &&
      Date.parse(date) - Date.parse(died) <= 7 * 86_400_000;
    // How newsworthy: what the newsrooms did with it first, readers last (ADR-0021).
    const signals: Signals = {
      ...headlineSignals(reportedAll),
      noted: items.length > 0,
      eventArticle: !!c.lead && isEvent(c.lead) && (spike ?? 0) >= SPIKE_MIN,
      notedSources: sources,
      ...(readers ? { readers } : {}),
      ...(spike !== undefined ? { spike } : {}),
      died: diedNow,
    };
    const raw = newsworthiness(signals);

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
    for (const h of reported) ids.push(reportEvidence(h));
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
    const story: Omit<EditionStory, "slug" | "heat"> & {
      rawHeat: number;
      signals: Signals;
      reportedAll: Headline[];
    } = {
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
      ...(reported.length
        ? {
            coverage: reported.map((h) => ({
              outlet: h.outlet,
              title: h.title,
              url: h.url,
              t: h.t,
              evidence: `news:${h.outlet}:${h.id}`,
            })),
          }
        : {}),
      related: c.members.filter((m) => m !== c.lead).map((m) => m.title),
      evidence: ids,
      why: reasonsOf(signals),
      rawHeat: raw,
      signals,
      reportedAll,
    };
    return story;
  });

  // 5a. Found by the outlets: stories two or more outlets reported that day that neither
  //     Current events nor the most-read list had (none of their headlines credited above).
  for (const o of input.outletStories ?? []) {
    const day = o.headlines.filter((h) => h.t.startsWith(date));
    if (new Set(day.map((h) => h.outlet)).size < 2) continue;
    // Already part of a story found above: some of its headlines were credited to that story,
    // or it happened in the same city or region ("Poland launches terrorism probe into mass
    // shooting" and the Current events item on the Kraków shooting). The same event in other
    // words: its headlines join that story's coverage and count toward its heat.
    const by = day.map((h) => claimed.get(h.id)).find((i) => i !== undefined);
    const same =
      (by !== undefined ? scored[by] : undefined) ??
      (o.place && o.place.basis !== "country"
        ? scored.find((x) => x.place?.name === o.place?.name && !x.foundBy)
        : undefined);
    for (const h of day) if (!claimed.has(h.id)) claimed.set(h.id, scored.length);
    if (same) {
      const merged = [...same.reportedAll, ...day];
      const credited = new Set((same.coverage ?? []).map((c) => c.outlet));
      const added = firstPerOutlet(day).filter((h) => !credited.has(h.outlet));
      same.coverage = [
        ...(same.coverage ?? []),
        ...added.map((h) => ({
          outlet: h.outlet,
          title: h.title,
          url: h.url,
          t: h.t,
          evidence: `news:${h.outlet}:${h.id}`,
        })),
      ];
      same.evidence = [...same.evidence, ...added.map(reportEvidence)];
      same.reportedAll = [...new Map(merged.map((h) => [h.id, h])).values()];
      same.signals = { ...same.signals, ...headlineSignals(same.reportedAll) };
      same.rawHeat = newsworthiness(same.signals);
      same.why = reasonsOf(same.signals);
      continue;
    }
    const reported = firstPerOutlet(day);
    const signals = headlineSignals(day);
    const qid = o.context ? qids.get(o.context.title) : undefined;
    const lens: Lens = lensFromTypes(typeLabels(qid)) ?? TOPIC_LENS[o.topic] ?? "general";
    const ids = reported.map(reportEvidence);
    const country = o.place?.country
      ? countries.find((x) => x.code === o.place?.country)
      : o.place
        ? countryAt(o.place.lon, o.place.lat, countries)
        : undefined;
    const continent = asContinent(country?.continent);
    // The headline is the title (a statement, not a question), without a short label before a
    // colon ("Ukraine: …").
    const statement =
      [o.title, ...day.map((h) => h.title)].find((t) => !/\?\s*$/.test(t)) ?? o.title;
    const title = statement.replace(/^[^:]{2,32}:\s+(?=\S)/, (m) =>
      m.split(/\s+/).length <= 5 ? "" : m,
    );
    scored.push({
      lens,
      title,
      summary: title,
      ...(o.context ? { about: o.context.text } : {}),
      ...(o.context
        ? {
            article: {
              title: o.context.title,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(o.context.title.replace(/ /g, "_"))}`,
              ...(qid ? { qid } : {}),
            },
          }
        : {}),
      ...(o.place
        ? {
            place: {
              name: o.place.name,
              lon: o.place.lon,
              lat: o.place.lat,
              ...(o.place.country ? { country: o.place.country } : {}),
              role: "Named in the headlines",
            },
          }
        : {}),
      ...(continent ? { continent } : {}),
      sources: 0,
      coverage: reported.map((h) => ({
        outlet: h.outlet,
        title: h.title,
        url: h.url,
        t: h.t,
        evidence: `news:${h.outlet}:${h.id}`,
      })),
      related: [],
      evidence: ids,
      why: reasonsOf(signals),
      topic: o.topic,
      foundBy: "outlets",
      rawHeat: newsworthiness(signals),
      signals,
      reportedAll: day,
    });
  }

  // 5b. Already told: a story from the last REPEAT_DAYS editions comes back only when the
  //     day's news reports something new about it, and then as an update linking back.
  const seen = new Map<string, { date: string; slug: string; title: string }[]>();
  // Stories found by the outlets have no article to key them: the same city and a shared
  // word make the same story ("…mass shooting in Krakow" the day after the Kraków shooting).
  const seenAt: {
    place: string;
    words: Set<string>;
    ref: { date: string; slug: string; title: string };
  }[] = [];
  const countryNames = new Set(countries.map((x) => x.name));
  for (const h of [...(input.history ?? [])].sort((a, b) => b.date.localeCompare(a.date))) {
    const age = daysBetween(h.date, date);
    if (age < 1 || age > REPEAT_DAYS) continue;
    for (const s of h.stories) {
      const k = storyKey(s);
      const ref = { date: h.date, slug: s.slug, title: s.title };
      seen.set(k, [...(seen.get(k) ?? []), ref]);
      if (s.place && !countryNames.has(s.place.name))
        seenAt.push({ place: s.place.name, words: new Set(words(`${s.title} ${s.summary}`)), ref });
    }
  }
  const previousAt = (s: (typeof scored)[number]) => {
    if (!s.foundBy || !s.place || countryNames.has(s.place.name)) return undefined;
    const own = words(`${s.title} ${(s.coverage ?? []).map((c) => c.title).join(" ")}`);
    const hits = seenAt.filter((x) => x.place === s.place?.name && own.some((w) => x.words.has(w)));
    return hits.length ? hits.map((x) => x.ref) : undefined;
  };
  const repeats: string[] = [];
  const fresh = scored.flatMap((s) => {
    const previous = seen.get(storyKey(s)) ?? previousAt(s);
    if (!previous) return [s];
    // New reporting that day: a Current events item, or an outlet's headline of the day.
    const reportedToday = s.evidence.some(
      (id) => id.startsWith(`wiki:${date}:`) || id.startsWith("news:"),
    );
    if (!reportedToday) {
      repeats.push(s.title);
      return [];
    }
    const first = previous.reduce((a, b) => (a.date < b.date ? a : b));
    return [{ ...s, update: { day: daysBetween(first.date, date) + 1, previous } }];
  });
  scored.splice(0, scored.length, ...fresh);

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
  const stories: EditionStory[] = picked.map(({ rawHeat, signals, reportedAll, ...s }) => {
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
    // Outlets whose headlines are cited: the headline and link only, credited by name.
    ...[...sourcesUsed]
      .filter((id) => id.startsWith("outlet:"))
      .flatMap((id) => {
        const o = outletById(id.slice("outlet:".length));
        return o
          ? [
              {
                id,
                name: o.name,
                url: o.homepage,
                license: "Headline and link only, quoted with attribution; © the outlet",
                attribution: o.name,
                retrievedAt: at,
              },
            ]
          : [];
      }),
  ].filter((s) => sourcesUsed.has(s.id));

  return {
    edition: {
      version: 1,
      date,
      generatedAt: at,
      candidates: scored.length + repeats.length,
      mostRead: mostRead.length > 0,
      stories,
    },
    evidence: shipped,
    sources,
    repeats,
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
    // A guess from a linked page may only make the story an event (a crash, a war, a vote):
    // "Hungarian People's Republic" is a "satellite state", which is not a space story.
    const lens = lensFromTypes(typeLabels(q));
    if (lens && EVENT_LENSES.has(lens)) return q;
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
  // An aside after the subject would leave a title without its verb ("Several floors of Aramco
  // Tower, a skyscraper … in Riyadh, Saudi Arabia, are damaged…"): drop it.
  const body = text
    .replace(/^In [^,]{3,40}, /, "")
    .replace(/^([^,]{3,80}), (?:a|an|the) .+?, ((?:is|are|was|were|has|have|had) .+)$/, "$1 $2");
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
