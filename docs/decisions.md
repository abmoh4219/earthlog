# Architecture Decision Records

Short records of decisions that are expensive to reverse. Newest at the bottom.

**Status today: all Proposed.** Each one becomes Accepted when Abdelah approves the foundation (Checkpoint 0).

```markdown
## ADR-000N: Title
- **Date / Status**
### Context
### Decision
### Consequences
### Alternatives considered
```

---

## ADR-0001: Static site plus offline baking; no backend

- **Date:** 2026-11-04
- **Status:** Proposed

### Context

- The project is free and open, with no accounts.
- Abdelah's Anthropic budget is small.
- A viral launch must cost nothing however many people visit.

### Decision

- **All data fetching and all AI happen offline**, in `scripts/`, once per event.
- The output is static files, committed, and served as statically generated pages on Vercel.
- Visitors make **no** calls to any backend of ours, or to Claude.

### Consequences

- Zero running cost, no keys exposed, nothing to break under load.
- Replays are reproducible and reviewable as pull requests.
- **"Type any event" can't be instant for visitors today.** It needs either a curated catalogue (later) or bring-your-own-key in the browser (later).
- Map tiles still stream from NASA GIBS, a public service built for this.

### Alternatives considered

- **A serverless API with our key.** Without sign-in, bots would drain the key.
- **Runtime AI with user keys only.** That puts a key prompt in front of the first visit and kills the wow moment.

---

## ADR-0002: CesiumJS as the globe, with NASA GIBS imagery and no ion

- **Date:** 2026-11-04
- **Status:** Proposed

### Context

We need a cinematic 3D globe with time-dynamic data, smooth camera flights, and imagery *of the event day*, at no cost.

| Option | Licence | Time-dynamic support | Globe quality |
| --- | --- | --- | --- |
| CesiumJS | Apache-2.0 | Built-in clock and time model, mature camera | Real geospatial |
| deck.gl GlobeView | MIT | — | Still experimental |
| globe.gl / three.js | MIT | Time and imagery are ours to build | Pretty |

Google Photorealistic 3D Tiles can't be cached and need keys. Cesium ion's free tier is non-commercial and token-based.

### Decision

- **CesiumJS** with **NASA GIBS WMTS** imagery (no key, daily and dated) for the day and night layers.
- **No ion and no Google tiles by default.** They can become an opt-in, bring-your-own-key extra later.
- Layers are drawn with primitives, not mass Entities.

### Consequences

- Real imagery from the exact day is a unique visual hook.
- It works with no keys at all.
- The trade-offs: Cesium's bundle is heavy (lazy-loaded), there's no photorealistic 3D city mesh, and no global terrain without ion (ellipsoid only; fine from orbital and regional heights).

### Alternatives considered

- **three.js / globe.gl.** Prettier out of the box, but we'd rebuild time, imagery tiling and camera geodesy by hand.
- **deck.gl.** GlobeView is still experimental.

---

## ADR-0003: Evidence-cited scenes with a strict validator

- **Date:** 2026-11-04
- **Status:** Proposed

### Context

AI narration of real disasters can be wrong, and wrong is harmful. Our differentiator is "and how we know".

### Decision

- Every narration beat must cite ≥ 1 evidence ID from the bundle's `evidence.json`, inside the time window, in time order.
- `src/scene/validate.ts` (pure, tested) rejects anything else, and CI validates every committed scene.
- Claude only selects and phrases facts that are already in the evidence; it never introduces data.
- We use app-level ID citations rather than the API's citations feature, which can't be combined with structured outputs (a 400 error, per the research of 2026-11-04).

### Consequences

- Trustworthy by construction, and it's the story we lead with.
- Some narration richness is lost: "why" explanations need a citable source, such as the ENTSO-E report as a document evidence item.
- Contributors get immediate, mechanical feedback.

### Alternatives considered

- **Free-form AI narration plus a disclaimer.** Fast, but indistinguishable from what everyone else does, and risky.

---

## ADR-0004: The director has a template mode and an offline Claude mode

- **Date:** 2026-11-04
- **Status:** Proposed

### Decision

- **Template mode** (rules plus text templates) is the default and is free.
- **Claude mode** (`--ai`) runs offline: Haiku 5.5 by default, Sonnet 5.5 for hero scenes.
  - It uses structured JSON output, then our validator; it retries twice with the validator's errors, then falls back to the template.
  - Prompt caching is on.
  - It has a cost ceiling per run (default $0.50).
  - The cost is recorded in `generatedBy`.

### Consequences

- The product never depends on AI.
- Launch AI spend is estimated at about $0.01 per scene with Haiku and about $0.20 with Sonnet (research estimate), so a few dollars at most.

---

## ADR-0005: One package, Next.js + React + TypeScript; scripts run as plain `.ts`

- **Date:** 2026-11-04
- **Status:** Proposed

### Decision

- A single pnpm package (no monorepo): **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript strict, with Tailwind CSS 4, Motion, Zustand, Zod, Vitest and Biome.
- **Revised 2026-11-04 (Abdelah):** originally Vite. Switched to Next.js because each replay becomes its own statically generated page (`/replay/<id>`) with its own title, description and **share card on X**, plus SEO, and Abdelah already knows Next.js from Armband. Still no backend: pages are generated at build time.
- Scripts run with Node 24+'s built-in type stripping (`node scripts/bake.ts`), so there's no tsx or build step.

### Consequences

- The fastest possible setup for a one-day ship.
- Split into packages only when a second consumer appears, such as a CLI or a plugin SDK.

### Alternatives considered

- **pnpm monorepo** (as Armband used). Overhead with no benefit yet.
- **Vite + React** (the first proposal). Simpler for a pure client app, but one URL can't carry per-replay share cards without an extra prerendering step.
- **Vanilla TS UI.** React pays for itself with the timeline, captions and drawer.

---

## ADR-0006: MIT licence

- **Date:** 2026-11-04
- **Status:** Proposed

### Decision

MIT for the code. Data keeps its own licences, listed per bundle and in docs/DATA-SOURCES.md.

### Consequences

- The simplest licence and the most adopter-friendly; it matches God's Eye View and OpenClaw.
- No patent grant, which matters little for a visualisation app.

### Alternatives considered

- **Apache-2.0.** It has a patent grant but is heavier, and we're not chasing code signing.
- **AGPL** (as World Monitor uses). It deters reuse, which is the opposite of our goal.

---

## ADR-0007: Hosting on Vercel; `earthlog.abdelah.dev` later

- **Date:** 2026-11-04
- **Status:** Proposed (revised from Cloudflare Pages by Abdelah)

### Decision

- **Vercel Hobby** (free), deploying from the GitHub repo (works while private).
- Today: a `*.vercel.app` subdomain. Later: Abdelah buys `abdelah.dev` and points `earthlog.abdelah.dev` at the project.
- The site URL lives only in `src/config.ts` (overridable with `NEXT_PUBLIC_SITE_URL`), so the switch is one value.
- Every page is statically generated; no serverless functions are needed for visitors.

### Consequences

- First-class Next.js support (share-card image generation, previews per branch).
- Vercel Hobby is for **non-commercial** use. Earthlog is free and non-commercial, so that's fine; revisit if that ever changes.

### Alternatives considered

- **Cloudflare Pages** (the first proposal). No commercial clause, but less native for Next.js.
- **GitHub Pages.** Needs a public repo on the free plan, and no Next.js server features.

---

## ADR-0008: "Normal" = same weekday, same time, median of 4 weeks

- **Date:** 2026-11-04
- **Status:** Proposed

### Decision

Every "X% of normal" figure divides a reading by its **baseline**: the median of the readings at the **same time on the same weekday over the 4 previous weeks**. A baseline needs at least 2 of those 4 weeks; otherwise the sample has no ratio and shows as a gap.

### Why

- **Same weekday:** traffic has a weekly rhythm. With a "previous 7 days" baseline, Argentina read 68% of normal before the 2022 final had even started, because a Sunday afternoon was compared with weekdays. With the weekday baseline it reads 100%.
- **Median of 4:** one odd week can't move it. The Iberian blackout's week-earlier Monday was Easter Monday.

### Consequences

- Bakers fetch 4 weeks of history per country (small: about 30 KB per signal).
- The baseline rule is shown in the live data panel and cited as `baseline` evidence in every sentence that gives a percentage.

### Alternatives considered

- **Previous 7 days, same time** (first implementation): biased by weekday rhythm, as above.
- **A single reference day:** one holiday or outage on that day would distort everything.
