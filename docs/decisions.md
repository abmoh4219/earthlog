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

---

## ADR-0009: "The world, yesterday", baked nightly and archived

- **Date:** 2026-11-04
- **Status:** Accepted (Abdelah)

### Decision

- Every night a scheduled **GitHub Action** bakes the previous UTC day into a replay: the day's news stories, earthquakes, internet outages and natural events, worldwide.
- Each day is **kept** in `public/scenes/daily-YYYY-MM-DD/`. Hero replays stay as they are. The landing page opens on the newest day and offers the archive.
- The Action validates the bundle, then **commits only that folder** (`data: daily replay YYYY-MM-DD`), which triggers a Vercel deploy. If validation fails, nothing is committed.

### Why

Replays of old events compete with polished YouTube documentaries. A fresh, automatic, checkable replay of yesterday competes with nothing, gives people a reason to return daily, and builds a unique archive over time.

### Consequences

- An exception to "only Abdelah commits": a bot commits daily data, never code.
- Repository growth: roughly 0.2–0.5 MB per day (about 100–200 MB per year). Revisit with a separate data branch or object storage if it grows past that.
- GitHub Actions minutes: a few per night, well inside the free tier.

### Alternatives considered

- **Replace yesterday each night (no archive):** simpler, but loses the record, which is the long-term value.
- **Bake during the Vercel build:** no bot commits, but no archive and slower deploys.

---

## ADR-0010: Claude in the nightly Action, with template fallback

- **Date:** 2026-11-04
- **Status:** Accepted (Abdelah)

### Decision

- The nightly director runs Claude (Haiku by default) with the key stored as an encrypted GitHub Actions secret.
- If the key is missing, expired, rate-limited or over the cost ceiling, or if Claude's scene fails validation twice, the director **falls back to the template** and the replay ships anyway.
- Each run records its method, model and cost in `scene.json` (`generatedBy`).

### Why

Better prose every day for about a cent per night, with no single point of failure.

### Consequences

- The key now lives in two places: the local `.env` and the GitHub secret. Neither is ever readable by the site. CI still greps the build output for key patterns.

---

## ADR-0011: All news in scope, cited and neutral

- **Date:** 2026-11-04
- **Status:** Accepted (Abdelah), replacing the "sensors only" rule for war and politics

### Decision

- The daily replay covers the day's hottest news in every field: politics and elections, conflicts, sports, science, business, culture, health and disasters.
- The narrator may phrase news in its own words. **Every sentence still cites a report**, and the validator is unchanged.
- Contested claims, casualty figures and blame are attributed to their source. No tactical detail.

### Why

Abdelah: a replay of yesterday that leaves out the biggest stories wouldn't be worth sharing. The citation rule keeps the trust that makes Earthlog different.

### Risks and mitigations

- **A wrong or one-sided sentence going viral.** Mitigated by mandatory citations, attribution of contested claims, neutral wording rules in the director's prompt, and evidence drawers that let anyone check.
- **Election and war coverage draws scrutiny.** Mitigated by quoting reputable sources and showing them on screen.

---

## ADR-0012: Editions of stories, each with a lens

- **Date:** 2026-11-04
- **Status:** Accepted (Abdelah), refining ADR-0009

### Decision

- Earthlog's main product is the **daily edition**: yesterday's hottest stories across **every topic**, each explained by a **lens** built for its kind (election, person, organization, economy, sports, culture, accident, disaster, conflict, science, general).
- Stories come from two signals: **what the news reported** (Wikipedia Current events, with sources) and **what the world read** (Wikipedia's most-read list). A story's lens comes from its Wikidata "instance of".
- The Phase 3 "world on one day" montage becomes the edition's **day at a glance**, not the product. The four hand-made replays become **classics**.

### Why

Abdelah: one montage of headlines isn't a product, and replays of last year compete with YouTube documentaries. A deep, story-specific explanation of *yesterday* (red and blue states for an election, a flight to the headquarters for a tech story) is something neither God's Eye View nor World Monitor does, and it is shareable every day.

### Consequences

- A lens is a self-contained module (bakers, director, layers, panels). Lenses ship one per phase.
- Wikidata and Wikipedia carry most enrichment: free and CC0/CC BY-SA, but community-edited, so every value is cited to its exact revision or item and labelled "as recorded in Wikidata/Wikipedia".
- Election results come from Wikipedia: we show **called/projected** races as Wikipedia recorded them at bake time, never "certified", and uncalled races as uncalled.

### Alternatives considered

- **A live dashboard** (World Monitor's model): crowded and not ours.
- **Object tracking** (God's Eye View's model): already done well, and surveillance-flavoured.

---

## ADR-0013: Story films with chapters and panels

- **Date:** 2026-11-04
- **Status:** Accepted (implemented in Phase 5)

### Decision

- A scene can run in **real time** (the clock is UTC: sensor stories, classics) or **story time** (the timeline is a sequence of chapters: explainers).
- In story time the HUD shows chapter titles, not a clock, so no caption implies a time of day the data doesn't have.
- Chapters carry a shot, captions with citations, the globe layers to show and the panels to build. Panels are typed chart blocks whose every value is evidence-backed.

### Why

Most stories (an election, a death, a company announcement) are understood through structure and comparison, not minute-by-minute time. Forcing them onto a 24-hour clock (as the Phase 3 overview does) implies timings we don't know.

### How it is built

- A story-time scene's window starts at the edition day's 00:00 UTC and runs one scene second per wall second, so day-precision evidence falls inside it and the validator applies unchanged.
- Lenses describe chapters (`scripts/lenses/film.ts` lays them out: captions, camera shots, panels from chapter start to end, layers revealed from a chapter on).
- The globe is fully lit in story time: no terminator and no night lights, since no time of day is claimed.
- Panels are validated like captions: every value cites evidence in the bundle.
