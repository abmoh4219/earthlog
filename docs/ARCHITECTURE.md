# Earthlog: architecture

If the code and this document disagree, one of them is a bug. Fix it in the same change.

## 0. The model: editions, stories, lenses, story films

Earthlog's unit is the **story**, not the feed. Everything below serves one pipeline:

```
 EDITION (one UTC day)                          STORY FILM (what a visitor watches)
 ┌──────────────────────────────────────┐      ┌────────────────────────────────────────┐
 │ discover   Current events (reported)  │      │ chapters: shot → caption → panel        │
 │            + Most read (attention)    │      │ globe layers chosen by the lens         │
 │ merge      by shared Wikipedia links  │ ───► │ panels (charts) synced to the narration │
 │ type       Wikidata "instance of"     │      │ evidence chips on every claim           │
 │            → lens                     │      │ exportable as a video clip              │
 │ rank       heat = readers × spike ×   │      └────────────────────────────────────────┘
 │            sources (+ sensor size)    │
 │ bake       each story with its lens   │
 └──────────────────────────────────────┘
```

- **Edition:** one UTC day, `public/editions/YYYY-MM-DD/`: `edition.json` (the ranked story list) plus one bundle per story. Built nightly and kept forever (ADR-0009, ADR-0012).
- **Story:** one topic of that day, with a lens, a place, a heat score and its evidence. `pnpm edition [date]` builds them (`scripts/edition/`):
  - **attach** each news item to the most-read article it links; otherwise it's a news-only story;
  - **drop noise:** lists and specials, and pages read no more than ~2.5× their normal level that no news mentions;
  - **fold** an article into a hotter story that links to it (candidates into their election, the aircraft model into its crash);
  - **type** via Wikidata P31 (`scripts/edition/lens.ts`), **place** via the news place, the article's coordinates, a recent death place, headquarters, or the country;
  - **heat** = log(readers) × (1 + log₂(spike)/10) + reported-news weight + a recent-death bonus, scaled to 0–100;
  - **pick** about 14: hottest first, at most 3 per lens, then the best story of every continent not yet covered.
- **Films:** `pnpm stories [date] [slug]` films each story of an edition with its lens into `public/editions/<date>/stories/<slug>/` (a normal bundle: scene, evidence, sources, data). `scripts/stories.ts` maps lenses to film functions; every lens starts as `general` and is replaced phase by phase.
- **"What happened" opens every film, whatever the lens** (`scripts/lenses/news-context.ts`): the Current events item if there is one, else the sentences in the story's article that say what happened around the edition day (dated within ten days, or added by editors since three days before, found by comparing revisions), told in time order, then who or what this is. Every sentence is quoted and cited to the exact revision. How many people read about it comes later, as a side note.
- **Lens:** the analysis template for one kind of story (`election`, `person`, `organization`, `economy`, `sports`, `culture`, `accident`, `disaster`, `conflict`, `science`, `general`). A lens is code in `scripts/lenses/<lens>/`: its bakers (what data to fetch), its director (chapters, captions, panels) and its globe layers. The concept doc lists each lens's data and visuals.
- **Story film:** a scene with **chapters**: each chapter has a camera shot, captions with citations, globe layers to show, and panels (charts) to build. Two time modes (ADR-0013):
  - **Real time** for sensor stories (quakes, storms, outages): the clock is the real UTC clock, as in the classics.
  - **Story time** for explainers (elections, people, companies): the timeline is the story's chapters; the HUD shows chapter titles, not a clock, so nothing implies a time of day we don't know.
- **Camera:** keyframes say how they are reached: `flight` (eased take-off and landing on a lifted great circle, for hops) or `glide` (a Catmull-Rom spline through neighbouring keyframes, so orbits and push-ins never stop). The film builder times flights by distance and keeps the camera orbiting, pushing in and rising through every chapter.
- **Panels:** typed chart blocks fed by bundle data: `seats` (chamber bars), `bars` (vote shares, rankings), `line` (revenue, indicators, attention), `facts` (key facts with chips), `curiosity` (readers by language), `thread` (how it unfolded), `result` (sports). Every value in a panel is evidence-backed.
- **Classics:** the hand-made deep replays (`public/scenes/<id>/`, `events/<id>.ts`) remain, using the same player.

### Routes

| Route | What |
| --- | --- |
| `/` | The front page: the latest edition's globe with story beacons and a story rail |
| `/edition/[date]` | Any day's edition (the archive) |
| `/story/[date]/[slug]` | A story film, with its own share card and clip export |
| `/replay/[id]` | Classics |

Every route is statically generated; the nightly build adds the new day's pages.

## 1. Two halves

```
 ┌──────────────────────── OFFLINE: a developer's machine ────────────────────────┐
 │                                                                                │
 │  events/<id>.ts ──► scripts/bake.ts ──► public/scenes/<id>/                    │
 │  (where, when,       fetch free data     data/*.json      layer data           │
 │   which layers)      normalise           evidence.json    citable facts        │
 │                      assign evidence IDs sources.json     licences + credits   │
 │                                                                                │
 │                      scripts/direct.ts ──► public/scenes/<id>/scene.json       │
 │                      template mode (free)  camera keyframes, beats + citations │
 │                      or Claude mode (key)  validated by Zod + reference checks │
 └────────────────────────────────────────────────┬───────────────────────────────┘
                                                  │ git commit (data: …)
 ┌──────────────────────── ONLINE: every visitor ─▼───────────────────────────────┐
 │  Vercel (statically generated Next.js pages) ──► browser                      │
 │    React UI: landing, timeline, captions, evidence drawer, credits             │
 │    Player core (pure): clock ─► camera pose, layer styles, active beats        │
 │    CesiumJS: NASA GIBS imagery (dated) + our primitives                        │
 │    No backend · no accounts · no AI calls · no keys                            │
 └────────────────────────────────────────────────────────────────────────────────┘
```

### The daily replay ("the world, yesterday")

```
 GitHub Action (nightly, Phase 5) or `pnpm bake daily [YYYY-MM-DD]`
   Wikipedia Current events ──► news.json      stories, category, place (GeoData)
   USGS worldwide M4.5+     ──► quakes.json
   NASA EONET               ──► storms.json    6-hourly fixes, interpolated in the player
   IODA outage events       ──► outages.json   only countries whose own signal fell ≥15%
   scripts/director/daily.ts ─► scene.json     world tour: news spread across the day,
                                               sensor beats at their real times
   ──► public/scenes/daily-YYYY-MM-DD/  (kept: the archive, ADR-0009)
```

## 2. Event definitions

`events/<id>.ts` holds a hand-written, typed definition: id, title, the UTC time window, the focus moment, the region bounding box, the countries and regions of interest, the Wikipedia articles to watch, and which bakers to run with what parameters. It's small, reviewable, and the only input a contributor writes by hand.

```ts
export default defineEvent({
  id: "iberia-2025",
  title: "The Iberian blackout",
  window: { start: "2025-04-28T09:30:00Z", end: "2025-04-29T06:00:00Z" },
  focus: "2025-04-28T10:33:00Z",
  region: { west: -10.5, south: 35.5, east: 4.5, north: 44.5 },
  layers: {
    outages: { countries: ["ES", "PT"] },
    attention: { articles: [{ lang: "en", title: "2025 Iberian Peninsula blackout" }] },
    imagery: { day: "2025-04-28", nightCompare: ["2025-04-27", "2025-04-28"] },
  },
});
```

## 3. Scene bundle (`public/scenes/<id>/`)

| File | Content |
| --- | --- |
| `data/<layer>.json` | Compact, columnar layer data (e.g. quakes as parallel arrays `t[]`, `lon[]`, `lat[]`, `mag[]`) |
| `evidence.json` | `Evidence[]`: every citable fact, with a stable ID |
| `sources.json` | `Source[]`: name, URL, licence, attribution text, retrieval time |
| `scene.json` | `Scene`: what the player plays |

**Evidence kinds:**

- `sensor`: a measured value from a dataset, such as a quake, a connectivity point or a pageview count.
- `baseline`: the reference value a percentage is computed against.
- `report`: a quoted, attributed statement from a reputable source, with URL, outlet, date and the exact quote. **Only `report` evidence may carry cause, actors or casualties** (RESPONSIBLE-USE.md §6).

**Evidence IDs** are stable and readable: `usgs:us7000pn9s`, `ioda:ES:2025-04-28T10:40Z:drop`, `wiki:en:2025_Iberian_Peninsula_blackout:2025-04-28`. Rebaking gives the same IDs.

### Scene schema (Zod; the source of truth is `src/scene/schema.ts`)

```ts
Scene = {
  version: 1,
  id, title, subtitle,
  window: { start: ISO, end: ISO },     // UTC
  focus: ISO,
  timezone: string,                     // IANA, for display only
  imagery: { day: string /*YYYY-MM-DD*/, night?: string[] },
  layers: LayerRef[],                   // { kind: "quakes" | "outages" | "attention" | "fires" | "countries", file, style? }
  camera: Keyframe[],                   // { t: ISO, lon, lat, height, heading, pitch, ease? }; t strictly increasing
  beats: Beat[],                        // { t: ISO, text: string (≤ 220 chars), cites: EvidenceId[] (≥ 1) }
  generatedBy: { method: "template" | "claude", model?: string, at: ISO, costUsd?: number },
}
```

### Validator (`src/scene/validate.ts`, pure)

A scene is **rejected** if:

- any beat has no citations;
- a citation ID isn't in `evidence.json`;
- a cited fact's time is outside the window;
- a beat's time is before the time of the evidence it cites, plus a small tolerance (no narrating the future);
- beats or keyframes are out of order;
- a layer file is missing;
- any source lacks a licence.

`pnpm validate:scenes` runs this over every bundle in CI.

## 4. Player (browser)

- **One clock.** `PlayerClock` maps wall time × speed to scene time. Play, pause, seek and speed are its only inputs, and every visual reads from it each frame.
- **Pure core:**
  - `cameraAt(t, keyframes)`: the interpolated pose, using eased segments with a great-circle path and height arcs for long hops;
  - `activeBeats(t)`;
  - `layerStyle(kind, value, t)`, for example outage colour from the drop against baseline, or a quake ring radius from age and magnitude.
- **The Cesium adapter (thin):**
  - creates the `Viewer` with no default widgets and no ion, plus dated GIBS imagery layers;
  - draws layers with primitives (points, polylines, polygons), not thousands of Entities;
  - applies the camera pose each frame.
- **React UI:** landing, timeline (scrubber, markers for beats and evidence), captions (cinema mode with letterbox), evidence drawer, credits, share link (`?event=&t=`).

## 5. Director (`scripts/direct.ts`)

- **Template mode** (default, free, deterministic):
  - picks key moments from the evidence with simple rules: the mainshock, the largest aftershock, the steepest outage drop and recovery, peak attention, the night comparison;
  - places keyframes (wide establishing shot → dive to the epicentre → pull back to the region);
  - fills narration templates with real values and citations.
- **Claude mode** (`--ai`):
  - sends the event definition plus a compact evidence digest;
  - asks for a scene as **structured JSON**;
  - validates it, retrying up to 2× with the validator's errors, then falls back to the template;
  - logs model, tokens and cost into `generatedBy`;
  - has a hard cost ceiling per run.
- **Claude never sees or creates data.** It only chooses, orders and phrases facts that are already in `evidence.json`.

## 6. Folder map

| Path | What |
| --- | --- |
| `src/app/` | Next.js routes: `/` (front page), `/edition/[date]`, `/story/[date]/[slug]`, `/replay/[id]` (all statically generated, each with its own metadata and share card) |
| `src/components/panels/` | Chart panels (seats, bars, line, facts, curiosity, thread, result) |
| `src/components/player/` | React HUD: title, clock, captions, timeline, transport, credits, letterbox |
| `src/player/store.ts` | Zustand store shared by the engine and the HUD |
| `src/lib/bundles.ts` | Build-time bundle loading, Zod-validated (server only) |
| `src/scene/` | Schema, clock, camera, beats, formatting, validator: pure, shared with scripts |
| `src/globe/` | Cesium adapter and layer renderers |
| `src/config.ts` | Site URL and app constants (**the** site URL lives here) |
| `events/` | Classic event definitions |
| `scripts/bake/` | One baker per source (shared by lenses) |
| `scripts/edition/` | Story discovery, typing, ranking, edition assembly |
| `scripts/lenses/<lens>/` | Each lens: its bakers, director and layer config |
| `scripts/director/` | Template directors (classics, day at a glance) |
| `public/editions/<date>/` | Baked, committed daily editions (`edition.json` + one bundle per story) |
| `public/scenes/<id>/` | Classics and the day-at-a-glance bundles |
| `public/geo/` | Shared shapes: Natural Earth countries (and later states, US districts) |
| `test/` | Unit tests and recorded fixtures |
