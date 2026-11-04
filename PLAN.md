# Earthlog: ship-in-a-day plan

> **Goal for today:** a public, open-source website where anyone can watch **cinematic, minute-by-minute replays of real world events on a 3D globe**. Every narrated sentence links to the recorded data behind it.

- **Started:** 2026-11-04
- **Ship:** end of day
- **Rules:** [CLAUDE.md](CLAUDE.md)
- **Design:** [docs/CONCEPT.md](docs/CONCEPT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Data:** [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)

---

## What ships today (v0.1)

1. **A cinematic globe player** (CesiumJS):
   - NASA's real satellite imagery *for the day of the event*;
   - night lights;
   - smooth director-driven camera moves;
   - a timeline scrubber with event markers;
   - captions where every sentence carries clickable evidence.
2. **Four hero replays across categories**, baked from real data and committed as static files. **None of them needs a key.** In ship priority order:
   1. ⚡ **Iberian blackout, 28 Apr 2025:** Spain and Portugal's internet collapsing within minutes, and the peninsula dark from space that night.
   2. ⚽ **World Cup final, 18 Dec 2022: "a nation holds its breath".** Argentina's internet traffic dips while the country watches. Attention waves roll across languages, hour by hour, ending with the penalty shootout.
   3. ⚔️ **Iran goes dark, Jun 2025:** during the Israel–Iran war, connectivity falls to about 4% of normal. Sensors only, with the cause quoted from cited reporting (RESPONSIBLE-USE.md §6).
   4. 🌋 **Myanmar earthquake, 28 Mar 2025:** the M7.7 mainshock and aftershocks rippling out, connectivity dropping, the world's attention spiking.
3. **The director:**
   - It turns baked evidence into a scene: camera path, timing and narration.
   - The **template mode** is free and deterministic.
   - The **Claude mode** runs offline, once per event, on Abdelah's key, for better prose.
   - Both are validated, so **no sentence ships without a citation**.
4. **Deployed free** at `earthlog.pages.dev` (Cloudflare Pages), with a README, a GIF and a launch post.

**Not today** (the post-launch list, see the end of this file): live flights, "type any event", bring-your-own-key in the browser, video export, voice narration, news pins.

## How we work today

```
 Phase N:  build ──► self-check (typecheck, tests, build, look at it) ──► CHECKPOINT
 CHECKPOINT: Claude posts a summary + screenshot notes + a commit message
             Abdelah reviews, commits, pushes ──► next phase
```

- **Five checkpoints, about two to three hours apart.** Never more than one phase of uncommitted work.
- **Time-box every phase.** If a phase overruns by 30 minutes, cut from the **cut list**, never from quality.
- **Parallel track for Abdelah** (no coding needed). Each item unblocks a later phase:

| When | Abdelah does | Unblocks |
| --- | --- | --- |
| Optional, Claude will prompt | A **NASA FIRMS MAP_KEY** (free) adds thermal anomalies. **None of the four v0.1 events needs it** | Later |
| Before Phase 3 | `ANTHROPIC_API_KEY=` in the local `.env` (gitignored). A monthly spend limit in the Anthropic console is recommended | Phase 3: Claude director |
| By Phase 4 | Create a free Cloudflare account, then a Pages project connected to the GitHub repo (build `pnpm build`, output `dist`) | Phase 5: deploy |
| By Phase 5 | Decide: make the repo public at launch? (Recommended: yes) | Launch |

---

## Phase 1 · Foundation and the cinematic globe (about 2.5 h)

**Build:**

- **Scaffold:** a single Vite + React + TypeScript (strict) app, pnpm, Vitest and Biome; CI on GitHub Actions (typecheck, lint, test, build); MIT `LICENSE`; `.env.example`.
- **The globe:**
  - CesiumJS with **no Cesium ion and no keys**;
  - NASA GIBS imagery as the base layer, *dated*;
  - atmosphere and space look, bloom, a dark UI theme;
  - Cesium's default widgets hidden, replaced by our own UI.
- **The player core:**
  - one clock drives everything;
  - play, pause, speed (1× to 3600×), scrubbing, keyboard shortcuts;
  - camera keyframes interpolated smoothly with easing;
  - cinema mode (letterbox bars, captions).
- **A hand-written sample scene** (`public/scenes/_sample/`), so the player is real before any data exists.

**Acceptance:**

- [ ] `pnpm dev` shows the globe with NASA imagery for a given date. The night-lights layer can be toggled.
- [ ] The sample scene plays: the camera flies through 3 keyframes in sync with the clock, scrubbing jumps the camera correctly, and captions appear at their times.
- [ ] No console errors and no ion token warnings. Interaction runs at 60 fps on the dev laptop.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` are green, locally and in CI.

**Checkpoint 1:** `feat: cinematic globe player with dated NASA imagery`

## Phase 2 · Data bakers and evidence (about 2.5 h)

**Build:** `scripts/bake/*.ts` (run with Node's built-in TypeScript support). Each baker fetches **free, key-less** sources (FIRMS uses Abdelah's key, at bake time only) and writes compact JSON into `public/scenes/<event>/`, plus an **evidence index**: every fact gets a stable ID.

| Baker | Source | Output |
| --- | --- | --- |
| `quakes` | USGS FDSN | Events with time, magnitude, depth and place |
| `outages` | IODA v2 (country and region signals) | Time series per country or region, normalised to the pre-event baseline |
| `attention` | Wikimedia pageviews: REST API (daily) plus **hourly dump files** (about 50 MB per hour, streamed and filtered, cached in `.cache/`) | Views per article and language, per hour |
| `reports` | Hand-curated citations in the event definition (URL, outlet, date, exact quote) | `report` evidence items: the only way cause, actors or context enter narration |
| `imagery` | NASA GIBS | Layer IDs and dates for before/after; nothing downloaded |
| `fires` (if a key exists) | NASA FIRMS VIIRS | Detections with time, power and confidence |
| `countries` | Natural Earth 1:110m (public domain) | Country outlines, baked once |

**Acceptance:**

- [ ] `pnpm bake <id>` produces a valid bundle for all four events (`iberia-2025`, `worldcup-2022`, `iran-2025`, `myanmar-2025`), checked by `pnpm validate:scenes`.
- [ ] Every "traffic fell X%" figure is computed against a **baseline** (the same hours on a reference day), and the baseline is cited too.
- [ ] Every baker has a unit test against a **recorded fixture** response. Tests make no network calls.
- [ ] Each bundle has a `sources` list with licence and attribution, and stays under 5 MB.
- [ ] On the globe: quakes pulse at their real times, scaled by magnitude, and countries tint by internet drop as the clock runs.

**Checkpoint 2:** `feat: data bakers for quakes, outages, attention and imagery`

## Phase 3 · The director: scenes that tell the story (about 2 h)

**Build:**

- **`scripts/direct.ts --event <id> [--ai] [--model haiku|sonnet]`.**
- **Template mode:**
  - finds the key moments from the evidence: mainshock, steepest outage drop, peak attention, night-lights comparison;
  - places camera keyframes and writes narration from templates filled with real values.
- **Claude mode:**
  - sends the evidence index (compact, at most about 30k tokens);
  - gets back a scene as **structured JSON**;
  - the result is validated by Zod: every sentence must cite IDs that exist, inside the time window, in time order;
  - on failure it retries up to 2×, then falls back to the template.
  - It prints the token count and cost, and refuses to run if the estimated cost is over $0.50.
  - Read the `claude-api` skill before writing this code.
- **The evidence drawer:** click a citation in a caption to see the source, value, time and link, and the camera flies to it.

**Acceptance:**

- [ ] Both events have a template scene that plays end to end, as a coherent 60–120 s story at default speed.
- [ ] `--ai` produces a validated scene for one event. The run's cost is printed and is under $0.25.
- [ ] A test proves an uncited sentence or an unknown ID is rejected.
- [ ] No API key appears in any built file (`grep` check in CI).

**Checkpoint 3:** `feat: evidence-grounded director with template and Claude modes`

## Phase 4 · Polish: as cool as ice (about 2 h)

**Build:**

- **A landing experience:** the globe slowly turning at night, with the three replays as cards; hovering one previews its region.
- **The intro sequence:** title card, the camera falling from orbit, the date counter rolling to the event time.
- **Visual effects:** shockwave rings, outage "heat" bleeding across borders, a before/after night-lights wipe, and a mini line chart for each layer synced to the clock.
- **Share links:** `?t=` and `?event=`, with OpenGraph image tags.
- **A small-screen fallback.**
- **A credits panel** with all data attributions.
- **Performance:** lazy-load Cesium, keep bundles small, check with a Lighthouse pass.

**Acceptance:**

- [ ] A first-time visitor understands what Earthlog is within 5 seconds, without reading.
- [ ] Replays run smoothly on a mid-range laptop. The first globe frame appears in under 3 s on a good connection.
- [ ] A share link opens at the exact moment.
- [ ] Attribution is visible for every layer on screen.

**Checkpoint 4:** `feat: cinematic landing, intro, effects and share links`

## Phase 5 · Ship (about 1.5 h)

**Build:**

- Deploy on Cloudflare Pages.
- Write the final README: hero GIF, what it is, how it works, a "how is this different" section, run locally, add your own event, data credits.
- Repo furniture: `CONTRIBUTING.md` (how to add an event via PR), issue templates, `CHANGELOG.md`.
- Record the 30–60 s launch video (free screen recorder).
- Draft the X post and Show HN text.

**Acceptance:**

- [ ] `https://earthlog.pages.dev` serves all three replays. A fresh browser with no keys works.
- [ ] The README runs from clone to `pnpm dev` in under 2 minutes on a clean machine.
- [ ] The launch text claims nothing the app doesn't do.

**Checkpoint 5:** `docs: launch README, contributing guide and deploy` (plus the tag `v0.1.0`, done by Abdelah)

---

## Cut list (cut in this order if behind; never cut the top three things that ship)

1. The fourth event, then the third (cut from the bottom of the priority list; keep at least two)
2. Small-screen fallback (show "best on desktop")
3. OpenGraph images
4. The night-lights before/after wipe (keep the plain toggle)
5. Claude mode (ship template-only; Claude scenes come next day)
6. The intro sequence (keep the landing cards)

**Never cut:** the cinematic globe, two polished replays (the Iberian blackout plus the World Cup final), cited captions, the deploy.

## After launch (backlog, roughly in order)

1. **Flights layer** (adsb.lol archives, ODbL; heavy data, needs a pre-processing step)
2. **"Type any event"**: a catalogue search over USGS, storm-track archives, IODA and Cloudflare outage records, and Wikipedia current events
3. **Bring-your-own-key Claude in the browser**, plus Ollama support, for custom scenes
4. **Video export** (WebCodecs + Mediabunny) and **voice narration** (kokoro-js)
5. **News pins** (GDELT bulk files)
6. **Community replays** submitted by pull request (a scene validator in CI)
7. **More events:** CrowdStrike 2024, Hurricane Helene, Red Sea cable cuts…
