# Earthlog: architecture

If the code and this document disagree, one of them is a bug. Fix it in the same change.

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
 │  Cloudflare Pages (static) ──► browser                                         │
 │    React UI: landing, timeline, captions, evidence drawer, credits             │
 │    Player core (pure): clock ─► camera pose, layer styles, active beats        │
 │    CesiumJS: NASA GIBS imagery (dated) + our primitives                        │
 │    No backend · no accounts · no AI calls · no keys                            │
 └────────────────────────────────────────────────────────────────────────────────┘
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
| `src/scene/` | Schema, validator, pure player math |
| `src/globe/` | Cesium adapter and layer renderers |
| `src/ui/` | React components |
| `src/config.ts` | Site URL and app constants (**the** site URL lives here) |
| `events/` | Event definitions |
| `scripts/bake/` | One baker per source |
| `scripts/direct.ts` | Director |
| `public/scenes/<id>/` | Baked, committed bundles |
| `public/static/` | Natural Earth country outlines |
| `test/` | Unit tests and recorded fixtures |
