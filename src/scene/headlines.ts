// Headlines from news outlets' official feeds, the clusters they form (one story told by
// several outlets) and the "Now" file the site reads (ADR-0017). Shared by scripts/news and
// the site, so explicit .ts imports and no @/ alias.
// What is stored per headline is only what a feed reader shows: the outlet, the headline, the
// link to the outlet's own article and the time. Never the article.
import { z } from "zod";
import { Region } from "./regions.ts";
import { IsoUtc } from "./schema.ts";
import { Topic } from "./topics.ts";

export const Headline = z.object({
  /** Stable for the article: a hash of its canonical URL. */
  id: z.string().regex(/^[a-f0-9]{12}$/),
  /** Key into OUTLETS (src/scene/outlets.ts). */
  outlet: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  /** When the outlet published it (UTC). */
  t: IsoUtc,
  /** When Earthlog first saw it (UTC): feeds sometimes back-date or re-date items. */
  seen: IsoUtc,
  /** The feed's own section or category, when it gives one (e.g. "Africa", "Sport"). */
  section: z.string().optional(),
});
export type Headline = z.infer<typeof Headline>;

export const ClusterPlace = z.object({
  name: z.string(),
  lon: z.number(),
  lat: z.number(),
  /** ISO alpha-2 of the country, when known. */
  country: z.string().length(2).optional(),
  /** What placed it: a city named in the headlines, or only a country. */
  basis: z.enum(["city", "region", "country"]),
});
export type ClusterPlace = z.infer<typeof ClusterPlace>;

export const Cluster = z.object({
  /** Stable while the story runs: the id of its first headline. */
  id: z.string(),
  /** The headline chosen to name the cluster (the one most like the others). */
  title: z.string(),
  /** Headline ids, newest first. */
  headlines: z.array(z.string()).min(1),
  /** Distinct outlets, in order of first report. */
  outlets: z.array(z.string()).min(1),
  first: IsoUtc,
  last: IsoUtc,
  topic: Topic,
  place: ClusterPlace.optional(),
  /** The reader's region of the place (src/scene/regions.ts, ADR-0023). */
  region: Region.optional(),
  /** 0–100 within the file: outlets, how recently and how fast (scripts/news/hot.ts). */
  heat: z.number().min(0).max(100),
  /** Several outlets within the last two hours of a story first seen in that window. */
  breaking: z.boolean(),
  /** Why it counts as news, in plain words (src/scene/newsworthy.ts, ADR-0021). */
  why: z.array(z.string()).optional(),
  /** Background from Wikipedia: the lead of the article the headlines name (ADR-0019). */
  context: z.object({ title: z.string(), url: z.url(), text: z.string() }).optional(),
  /** This story has its own short film this hour: films/<id>/ beside now.json (ADR-0020). */
  nowFilm: z.boolean().optional(),
  /** Earthlog's film of the same story, from one of the last editions. */
  film: z.object({ date: z.iso.date(), slug: z.string(), title: z.string() }).optional(),
});
export type Cluster = z.infer<typeof Cluster>;

export const NowFile = z.object({
  version: z.literal(1),
  generatedAt: IsoUtc,
  /** The outlets read this run, and which failed (shown, never hidden). */
  outlets: z.array(z.object({ id: z.string(), ok: z.boolean(), items: z.number().int() })),
  headlines: z.array(Headline),
  clusters: z.array(Cluster),
});
export type NowFile = z.infer<typeof NowFile>;
