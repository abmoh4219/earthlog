// The archive of old films (ADR-0027). Pure; shared by scripts/archive.ts and the site.
// Films older than KEEP_DAYS move to a separate repository published with GitHub Pages, one
// per year of archiving (earthlog-archive-2026, …), so the main repository and the Vercel
// build stay small. Each edition keeps its small index files forever; a films.json manifest
// says where its films went, and the site's player loads them from there.
import { z } from "zod";
import { IsoUtc } from "./schema.ts";

/** Days a film stays in the main repository (editions are frozen after 3: ADR-0014). */
export const KEEP_DAYS = 14;
export const ARCHIVE_OWNER = "abmoh4219";

/** The repository films archived in `year` go to. */
export const archiveRepo = (year: string) => `earthlog-archive-${year}`;

/** Where GitHub Pages publishes it (verified 2026-11-09: Pages answers with
 * `access-control-allow-origin: *`, so the site can fetch the files). */
export const archiveBase = (year: string) =>
  `https://${ARCHIVE_OWNER}.github.io/${archiveRepo(year)}/`;

/** public/editions/<date>/films.json, written when an edition's films are archived. */
export const ArchiveManifest = z.object({
  version: z.literal(1),
  /** The Pages address of the archive holding the films (ends with "/"). */
  base: z.url(),
  /** The films' slugs (folders under <base>editions/<date>/stories/). */
  films: z.array(z.string()),
  archivedAt: IsoUtc,
});
export type ArchiveManifest = z.infer<typeof ArchiveManifest>;

/** Editions whose films are old enough to move: more than `keep` days before `today`. */
export function datesToArchive(dates: string[], today: string, keep = KEEP_DAYS): string[] {
  const now = Date.parse(`${today}T00:00:00Z`);
  return dates
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .filter((d) => (now - Date.parse(`${d}T00:00:00Z`)) / 86_400_000 > keep)
    .sort();
}

/** Where one archived film's files are. */
export const archivedFilmUrl = (base: string, date: string, slug: string) =>
  `${base}editions/${date}/stories/${slug}/`;
