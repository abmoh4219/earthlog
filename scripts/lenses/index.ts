// Which lens films which kind of story, shared by edition films (scripts/stories.ts) and the
// films of "Now" (scripts/news/film.ts).
import type { Lens } from "../../src/scene/edition.ts";
import { accidentLens } from "./accident.ts";
import { conflictLens } from "./conflict.ts";
import { cultureLens } from "./culture.ts";
import { disasterLens } from "./disaster.ts";
import { economyLens } from "./economy.ts";
import { electionLens } from "./election/index.ts";
import { generalLens, type LensContext, type LensResult } from "./general.ts";
import { organizationLens } from "./organization.ts";
import { personLens } from "./person.ts";
import { scienceLens } from "./science.ts";
import { sportsLens } from "./sports.ts";

export /** Which lens films which kind of story. Specialised lenses replace `general` phase by phase. */
const LENS_FILMS: Record<Lens, (ctx: LensContext) => Promise<LensResult>> = {
  election: electionLens,
  conflict: conflictLens,
  accident: accidentLens,
  disaster: disasterLens,
  sports: sportsLens,
  economy: economyLens,
  science: scienceLens,
  culture: cultureLens,
  organization: organizationLens,
  person: personLens,
  general: generalLens,
};
