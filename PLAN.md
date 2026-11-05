# Earthlog: roadmap

> **Yesterday's world, explained in 3D.** Every morning, Earthlog turns the previous day's hottest stories (every topic, everywhere) into short, cinematic explainers on a 3D globe. Each story gets the analysis its kind deserves, and every claim links to its source.

- **Started:** 2026-11-04
- **Ship:** when Phase 20 is done (estimated 4–6 working days). Moved twice by Abdelah: build it properly, phase by phase, without overlooking any part.
- **Rules:** [CLAUDE.md](CLAUDE.md) · **Concept:** [docs/CONCEPT.md](docs/CONCEPT.md) · **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · **Data:** [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) · **Decisions:** [docs/decisions.md](docs/decisions.md)

---

## What v0.1 is

1. **The front page:** yesterday's stories glowing on the globe, sized by heat.
2. **Daily editions:** about 10 stories a day across every topic, built nightly, kept forever.
3. **Lenses:** a deep analysis for each kind of story: election, person, organization and tech, economy, sports, culture, accident, disaster, conflict, science and space, general.
4. **Story films:** chapters, citations on every claim, globe layers and chart panels; exportable as video clips.
5. **Classics:** four hand-made deep replays (Iberian blackout, 2022 World Cup final, Iran 2025 shutdown, Myanmar 2025 earthquake).
6. **Free and open:** static site on Vercel, no accounts, no keys for visitors.

## Roadmap at a glance

| Stage | Phases | Outcome |
| --- | --- | --- |
| **Foundation** ✅ | 1–3 | Cinematic globe, data bakers, evidence and validator, classics, day at a glance |
| **The story engine** | 4–5 | Editions discover and rank yesterday's stories; story films with chapters and panels |
| **The lenses** | 6–13 | One deep analysis per kind of story, each shipped with a real story from a real day |
| **Intelligence and signature** | 14–15 | Claude director; the curiosity map and "how it unfolded" |
| **The experience** | 16–17 | Front page and archive; evidence drawer, click-to-explore, share links |
| **Reach** | 18–19 | Nightly automation; video clip export |
| **Launch** | 20 | Polish, performance, deploy, README, launch posts |

## How we work

```
 Phase N:  build ──► self-check (typecheck, tests, build, look at it) ──► CHECKPOINT
 CHECKPOINT: Claude posts a summary + screenshot notes + a commit message
             Abdelah reviews, commits, pushes ──► next phase
```

- **One checkpoint per phase, about two to three hours apart.** Never more than one phase of uncommitted work.
- **Time-box every phase.** If a phase overruns by 30 minutes, cut from the **cut list**, never from quality.
- **Parallel track for Abdelah** (no coding needed). Each item unblocks a later phase:

| When | Abdelah does | Unblocks |
| --- | --- | --- |
| Optional, Claude will prompt | A **NASA FIRMS MAP_KEY** (free) adds thermal anomalies. **None of the four v0.1 events needs it** | Later |
| ✅ Done | `ANTHROPIC_API_KEY=` in the local `.env` (gitignored). A monthly spend limit in the Anthropic console is recommended | Phase 14: Claude director |
| By Phase 18 | Add the same key as a GitHub **repository secret** named `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions) | Phase 18: nightly editions |
| By Phase 20 | Import the GitHub repo into **Vercel** (free Hobby plan; framework preset: Next.js, defaults are fine) | Phase 20: deploy |
| By Phase 20 | Decide: make the repo public at launch? (Recommended: yes) | Launch |

---

## Phase 1 · Foundation and the cinematic globe (about 2.5 h) ✅

**Build:**

- **Scaffold:** a single Next.js 16 + React 19 + TypeScript (strict) app with Tailwind 4, Motion and Zustand; pnpm, Vitest and Biome; CI on GitHub Actions (typecheck, lint, test, build, no-secrets check); MIT `LICENSE`; `.env.example`.
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

- [x] `pnpm dev` shows the globe with NASA imagery for a given date. The night-lights layer can be toggled.
- [x] The sample scene plays: the camera flies through 3 keyframes in sync with the clock, scrubbing jumps the camera correctly, and captions appear at their times.
- [ ] No console errors and no ion token warnings. Interaction runs at 60 fps on the dev laptop. *(Console clean. 60 fps not measured yet: headless tests use software rendering.)*
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` are green, locally and in CI.

**Checkpoint 1:** `feat: cinematic globe player with dated NASA imagery`

## Phase 2 · Data bakers and evidence (about 2.5 h) ✅

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

- [x] `pnpm bake <id>` produces a valid bundle for all four events (`iberia-2025`, `worldcup-2022`, `iran-2025`, `myanmar-2025`), checked by `pnpm validate:scenes`.
- [x] Every "traffic fell X%" figure is computed against a **baseline** (the same time on the same weekday, median of the 4 previous weeks: ADR-0008), and the baseline is cited too.
- [x] Every baker has a unit test against a **recorded fixture** response. Tests make no network calls.
- [x] Each bundle has a `sources` list with licence and attribution, and stays under 5 MB (largest: 128 KB).
- [x] On the globe: quakes pulse at their real times, scaled by magnitude, and countries tint by internet drop as the clock runs.

**Done differently (2026-11-04):**

- **Cut for v0.1:** the `attention` baker (Wikimedia pageviews). Daily values can't be placed honestly inside a few-hours window, and hourly dumps are 50 MB each. The World Cup replay uses IODA's Google-traffic signal instead. Back in the backlog.
- **Pulled forward from Phase 3:** the **template director** (`scripts/director/template.ts`), because a bundle isn't playable without a scene. `pnpm bake` runs it. Phase 3 adds Claude mode and the evidence drawer.
- **Added:** country borders and names (with live readings), the live data panel, and a `?` shortcut sheet.
- **No real night pass for the Iberian blackout** (see DATA-SOURCES.md), so that replay uses the labelled "typical night" composite.

**Checkpoint 2:** `feat: data bakers for quakes, outages, attention and imagery`

## Phase 3 · The world, yesterday: day at a glance (about 3 h) ✅

**Build:**

- **Verify the sources first** (shapes, licences, rate limits), and record them in DATA-SOURCES.md.
- **Bakers:**
  - `news`: the day's stories from Wikipedia's *Current events* portal (human-curated, categorised, each linked to its sources), placed on the map and ranked by how much the world covered them (GDELT, if verified usable).
  - `quakes` worldwide (USGS, M4.5+), `outages` (IODA alerts), `natural` (NASA EONET: fires, storms, volcanoes).
- **A daily scene:** a world tour that visits the day's top stories in time order, with sensor layers underneath. Stories pulse on the globe, by category colour.
- `pnpm bake daily [YYYY-MM-DD]` (default: yesterday, UTC), writing `public/scenes/daily-YYYY-MM-DD/`.
- The player shows news pins and a story card (headline, category, source links).

**Acceptance:**

- [x] `pnpm bake daily 2026-11-03` produces a valid bundle covering at least five categories, every sentence cited. *(14 stories in 8 categories, 12 quakes, 2 storms, 2 outages; 15 beats.)*
- [x] Bakers are tested against recorded fixtures.
- [x] Each news item links to its source, and the licence of every text we bundle is honoured (attribution shown).

**Done differently (2026-11-04):** GDELT was cut (rate-limited to the point of being unusable; see DATA-SOURCES.md). Stories are ranked by category, round-robin, so every kind of news gets a turn.

**Checkpoint 3:** `feat: the world, yesterday — daily news and sensor replay`

---

## Phase 4 · The edition builder: finding yesterday's stories (about 3 h) ✅

**Build:**

- `pnpm edition [YYYY-MM-DD]` (default: yesterday, UTC) → `public/editions/<date>/edition.json`.
- **Discover:** Current events items (reported, with sources) + the most-read list (what people read).
- **Merge:** a most-read article and a news item are the same story when the news item links that article.
- **Filter noise:** drop evergreen pages (lists, the Main Page, perennial favourites) unless their readers spiked at least 3× their 30-day median or the news mentions them.
- **Type:** the main article's Wikidata `instance of` → a lens (a tested mapping table, with a `general` fallback).
- **Rank:** heat = readers × spike × sources (+ sensor size for disasters); balanced across lenses; about 10 stories.
- Each story records why it's in the edition (its heat inputs), as evidence.

**Acceptance:**

- [x] For 3 Nov 2026 the edition includes the midterms (election), Jesús de Miguel (person), the Learjet crash (accident), *Jailer 2* (culture), the RBA rate rise (economy) and Patrick Stewart (person), each with its lens.
- [x] Recorded fixtures for every source; the typing table has tests.

**Done differently (2026-11-04):**

- **"Spike" compares with the article's normal level** (median readers 60 to 8 days before), not with the last few days: big stories trend for days (the Learjet crash, Patrick Stewart's death on 28 Oct), and a last-days baseline wrongly dropped them.
- **Geographic balance:** after the hottest stories (at most 3 per lens), every continent with a story that day gets its best one. The 3 Nov edition covers Africa (Zamfara, Nigeria), Asia, Europe, North America and Oceania.
- **Reported news weighs like a strongly read article**, so conflicts and disasters that never trend in English still make the edition.
- **A death in the past week** counts as news in itself.

**Checkpoint 4:** `feat: edition builder discovers, types and ranks yesterday's stories`

## Phase 5 · The story-film engine (about 3 h) ✅

**Build:**

- **Story time** (ADR-0013): chapters with shots, captions, layers and panels; the HUD shows chapter titles instead of a clock.
- **Panels:** `facts`, `bars`, `line`, `seats` chart blocks in plain SVG and Motion, synced to the narration, every value with a chip.
- **New globe layers:** choropleth (filled regions with a legend), arcs (place to place), labelled places.
- **Routes:** `/story/[date]/[slug]` and a first plain `/edition/[date]` list.
- The `general` lens (place, linked places, attention) as the first lens on the engine.

**Acceptance:**

- [x] Every story of the 3 Nov edition plays as a `general` story film with at least one panel. *(14 films, 20–55 s, up to 6 chapters: the story, where, readers, on record, connected, reported by.)*
- [x] Panel values and captions pass the validator; no clock is shown in story time.

**Done differently (2026-11-04):** in story time the globe is **fully lit** with the day's satellite image (no day/night terminator, no night lights), because an explainer has no time of day.

**Checkpoint 5:** `feat: story films with chapters, panels and new globe layers`

## Phase 6 · Election lens: any election, anywhere (about 4 h) ✅

**The engine is generic; countries only add depth.** Three layers:

1. **Universal, any country:** parse Wikipedia's *election infobox* (used by almost every election article worldwide): parties or candidates, leaders, seats before and after, vote share, turnout. Party colours from Wikipedia/Wikidata. Globe: the country lit in the leading party's colour. Panels: seat bars before → after, vote-share bars, turnout.
2. **Regional map, where the article has results by region:** match region names to Natural Earth admin-1 shapes (worldwide) and fill each by its winning party.
3. **Country adapters, for the deepest maps:** the US first (Senate and governors by state, House by district; flips pulse; uncalled races hatched grey). Other countries can be added later as adapters.

**Honesty:** results as recorded by Wikipedia at bake time, with that time on screen; "called" or "projected", never "certified"; races not yet called stay grey; no results yet → candidates and what's at stake, nothing guessed.

**Acceptance:**

- [x] The same lens films **both** elections of 3 Nov 2026: the US midterms (states and districts in red and blue) and Israel's legislative election (seats and vote share).
- [x] Parser tests against recorded wikitext, including "hold", "gain", uncalled rows and an infobox from a non-US election.

**Done (2026-11-04):** the US film has three maps (Senate: 35 races; governors: 36; House: 435 districts from the Census's 120th-Congress shapes), seat bars from the infobox, and the seats that changed party with their winners. Israel's film shows seats and vote share for every party in its Wikidata colour. The regional layer (results by province for any country) is **not built yet**: it needs per-region results tables, which vary by article; it moves to the backlog.

**Checkpoint 6:** `feat: election lens for any election, with a US adapter`

## Phase 7 · Person lens: a life across the globe (about 3 h) ✅

- Wikidata life places (birth, education, clubs or employers, residences, death) with dates → chronological arcs across the globe.
- Panels: life timeline, notable works, the reader spike.
- Respect rules for deaths (RESPONSIBLE-USE §8).
- Stories: Jesús de Miguel, Patrick Stewart.

**Done (2026-11-04):** chapters Born → A life across the globe (journey arcs drawn leg by leg, a dated "life on record" panel) → Recognition (awards with years, notable works) → In memory (date, place, age; no cause unless a cited report gives one). Organisations are placed at their home ground, headquarters or city. Jesús de Miguel: 9 clubs, 2015–2026; Patrick Stewart: schools, awards, *X-Men* and *Star Trek*; Jeffery Simmons: school to Chicago Bears.

**Checkpoint 7:** `feat: person lens`

## Phase 7½ · Narration that tells the news (done 2026-11-04) ✅

Abdelah: films said *what* something is, not *why* it was in the news, and jumped to reader counts. Every film now opens with **What happened**: the reported news, or what the article says happened around the day (dated or newly added sentences, compared across revisions), in time order, then who or what it is. Readers moved to the end; the edition page shows each story's headline.

## Phase 8 · Organization and tech lens (about 3 h) ✅

- Fly to the headquarters (Wikidata P159 → P625); arcs to the places the story names.
- Panels: what's on record (founded, staff, industry, leadership), revenue over time (labelled "as recorded in Wikidata"; outliers flagged, not hidden), the reader spike, tech-community heat (Hacker News counts) for tech stories.
- Stories: the day's company and tech stories (e.g. the .xyz domain, Elizabeth Holmes).

**Done (2026-11-04):** chapters Headquarters (a website or project follows its operator) → On record (founded, founders, CEO, chair, industry, owner, parent, exchange, staff, website link) → The numbers (revenue and net income in the claim's currency, staff, each by year; values inconsistent with the rest are flagged, not charted) → Footprint (subsidiaries and holdings arcing out from headquarters) → Tech talk (Hacker News stories a day and the most discussed one, under the name and the opening's short name, e.g. "AO3"). Tried on Nvidia (19 years of revenue), OpenAI (3 inconsistent values flagged) and Archive of Our Own (its outage spike on Hacker News). Month-only dates ("In October 2026") now count as news.

**Checkpoint 8:** `feat: organization and tech lens`

## Phase 8½ · Cinematography (done 2026-11-04) ✅

Abdelah: the camera felt like a map app. Now, for every lens: glide segments (a spline through keyframes, no stops) and distance-timed flights that lift off and arc over the Earth; low, tilted shots with the horizon and atmosphere; slow orbits, push-ins and rises while chapters hold (maps move gently); an opening where the Earth turns into place and a closing pull-back to space; glowing arcs with travelling comets, light beacons on key places, a subtle bloom, and cinematic chapter cards. Measured: the camera never pauses more than 0.2 s outside election maps (was: a full stop at every keyframe).

**Next for 3D: terrain.** Free elevation tiles (AWS Terrain Tiles) send no CORS header, so the browser can't read them. Plan: bake heights per story at build time and feed Cesium a custom heightmap provider, blending to sea level at the edges.

## Phase 9 · Economy lens (about 2 h) ✅

- The institution → its country → neighbours compared on a choropleth.
- Panels: World Bank indicators (inflation, growth, rates) with the decision marked; the cited figure from the report.
- Story: the Reserve Bank of Australia rate rise.

**Done (2026-11-04):** Who decided (the institution among the story's links, at its headquarters) → the country in numbers (World Bank inflation, growth, unemployment since 2010) → The neighbourhood (the World Bank region as **3D columns** of inflation rising from each country, the camera standing behind the story's country and looking across them; a ranked panel with the regional median). New reusable layer: `columns`. Also: a camera-following key light so story globes read as spheres, sentences no longer split at "U.S.", "Dr." and the like.

**Checkpoint 9:** `feat: economy lens`

## Phase 10 · Sports lens (about 2 h) ✅

- The venue; arcs from the teams' or athletes' home cities.
- Panels: result card (from the cited report or article), where the world followed it (readers by language).
- Stories: the Melbourne Cup, football.

**Done (2026-11-05):** The venue (from the event's infobox, any infobox type; arcs from the teams when the box names them) → The result (winner, runner-up, score, jockey, trainer, attendance, prize…, each cited to the exact revision) → Followed around the world (readers in each Wikipedia language edition). Readers by language now also appear in every film's Readers chapter. Editions get **lens balance** (every lens with a candidate gets its best story, up to 18). Inline templates (`convert`, `nowrap`, `lang`…) are expanded before narration.

**A new globe look (all story films):** NASA Blue Marble shaded relief and bathymetry in an ice grade (the event-day satellite image is now a toggle, S); the focus country **traced in light** like a pen, then breathing, over a faint fill; **radar rings** from the focus point; a **lock-on reticle** with coordinates; a 15° graticule for wide views; **cool-to-warm comparison fills** with a legend (the economy lens compares the region's inflation). Bloom removed: Cesium's bloom turned the deep-blue ocean into noise.

**Checkpoint 10:** `feat: sports lens and a new globe look`

## Phase 11 · Culture lens (about 2 h) ✅

- Country of origin, studio, filming locations (Wikidata).
- Panels: release and box office as recorded, readers by language.
- Stories: *Jailer 2*, *Dancing with the Stars*.

**Done (2026-11-05):** The credits (director, cast, music, studio or network, hosts and judges, release, budget, box office, read from any infobox, nested ones included, and cited to the exact revision; shot over the studio's home, from Wikipedia coordinates or Wikidata headquarters) → Where it was filmed (every place the article's filming section links, in the order it tells them, drawn as a trail; each place cites its sentence) → The people (where everyone credited was born, Wikidata P19, with arcs converging on the studio and a "born in" panel by country). Wikidata had no filming locations for these stories, so the article is the source.

**Globe and camera:** a lens pass on every story film (tilt-shift on low oblique shots, a teal split tone, vignette, film grain on the scene clock); the camera banks into turns and drifts like a handheld camera (off under reduced motion); a radar sweep turns around the spotlight; arcs ripple where they land; labels declutter on screen each frame instead of fading with distance; several named places and arcs layers per film, each with its own chapter; wide shots centre on the places' spherical centroid (right across the antimeridian).

**Checkpoint 11:** `feat: culture lens, a camera with a lens`

## Phase 12 · Accident and disaster lenses (about 4 h) ✅

- **Accident:** the exact site; route arcs where known; vehicle facts (type, maker, first flight); timeline. Story: the Palm Beach County Learjet crash.
- **Disaster (sensor films, real time):** quakes (ShakeMap rupture and intensity, felt reports over time, PAGER exposure), storms (**geostationary clouds every 10 minutes**, frames archived with the bundle), outages (province-level IODA). Story: Super Typhoon In-fa.

**Done (2026-11-05):**
- **Accident:** The journey (origin → the site in red, the rest of the route dashed; distance flown and left, straight-line, from the cited coordinates) → The site (low over real terrain) → The aircraft (type, maker and first flight from Wikidata, operator, registration) → On board (the infobox's counts, "according to the article") → Minute by minute (the article's own timed sentences) → The investigation. Stories with no article (the Nepal helicopters) get the general film on terrain.
- **Disaster, earthquakes:** USGS ShakeMap intensity contours spreading outward, the fault's rupture model, 3D columns of estimated intensity over nearby towns, PAGER people exposed by intensity and its alert, "Did You Feel It?" reports; all labelled as USGS estimates. Tested on the M7.7 Panama quake (recorded fixtures); no disaster story in the 2026-11-03 edition.
- **Terrain:** baked per story from the AWS Terrain Tiles (three nested grids, ~370 KB), fed to Cesium through a heightmap provider; the coarse grid fades to sea level at its edge.
- **Fresh data (ADR-0014):** the cache expires answers about "now"; editions follow the news for three days, then freeze; every film shows "Data as of".
- **Moved to later:** storms with geostationary frames and province-level outages in edition films (the classic replays already have both).

**Checkpoint 12:** `feat: accident and disaster lenses on real terrain`

## Phase 13 · Conflict, science and space lenses (about 3 h) ✅

- **Conflict:** every place mentioned, day by day; attributed figures; sensors where they exist (IODA, FIRMS). Story: the Strait of Hormuz ship attack.
- **Science and space:** launch site, mission path (labelled as estimated), institutions.

**Done (2026-11-05):**
- **Conflict:** Day by day (the article's dated sentences of the past week, with a year or added in the past eight days by revision diff; the places they link, red for the latest, amber a week old) → Sides and figures (the infobox's belligerents, status and casualty figures, "as the article records them") → Connectivity (IODA, only when the signal dropped below 90% of usual; otherwise neither the chapter nor its credit ships). FIRMS fire data needs a key: left out.
- **Science and space:** Launch (the pad on real terrain, a column of light rising from it) → The mission or The discovery (crew, spacecraft, maker, duration, distance, discoverer) → Landing (the dashed line joins launch and splashdown and says it is not the path flown). Tested on Artemis II; no science story in the 2026-11-03 edition.
- Shared: sentences are split per paragraph (headings no longer glue onto sentences); infobox values decode `&nbsp;` and similar; large converted numbers get separators; credits list each attribution once.

**Checkpoint 13:** `feat: conflict, science and space lenses`

## Phase 14 · The director: Claude mode for every lens (about 3 h) ✅

- `pnpm direct <story> [--ai]`: Claude (Haiku) picks chapters and writes captions from the lens's evidence, as structured JSON; validated; up to 2 retries; **template fallback** on any failure; cost printed; hard ceiling per edition.
- Claude also double-checks the lens choice for ambiguous stories.
- Recorded responses for tests; no tokens spent in CI.

**Done (2026-11-05):** `pnpm direct <date> [slug] --ai` rewrites every film's captions with Claude Haiku 5.5 from the evidence each chapter cites, chapter by chapter, with grounding checks (cites, numbers, no dropped facts) and a template fallback per chapter. The 2026-11-03 edition: 15 films, 77 of 79 chapters by Claude, **$0.031 in total** (about $0.002 a film). The lens check runs in the same request and is printed when Claude thinks a lens doesn't fit. Nightly order: `pnpm edition` → `pnpm stories` → `pnpm direct --ai`.

**Checkpoint 14:** `feat: Claude director for story films`

## Phase 15 · Signature features: the curiosity map and "how it unfolded" (about 3 h) ✅

- **Curiosity map:** readers per Wikipedia language edition, drawn as glowing language regions, clearly labelled as languages, not countries.
- **How it unfolded:** a story's thread through previous days of Current events, as a timeline panel and day-by-day places.

**Done (2026-11-05):**
- **Curiosity map** (every film's Readers chapter): each language with readers lights the countries where it is mainly spoken (cyan → pink by readers, log scale), with a 3D column of readers per language; English left off (read everywhere); the legend and caption say a language is not a country. Earlier maps step aside while it shows.
- **How it unfolded:** the story's earlier items on Current events over the past week, tied only by the portal's own topic or links; dated captions, a "days before" panel, places coloured by recency joined in order. Each day's portal page is its own cited source.
- Shared layers (curiosity, thread) survive lenses that replace the general map layers.

**Checkpoint 15:** `feat: curiosity map and story threads`

## Phase 16 · The front page and the archive (about 3 h) ✅

- `/`: the latest edition. The globe at dawn, story beacons sized by heat and coloured by lens, a story rail; click a beacon to fly into its film.
- **The edition tour:** press play on the front page and the camera flies from story to story around the planet, each stop building its own analysis (maps, charts, facts) in a few seconds, with a "watch the full story" link. Grab the globe at any time to explore.
- `/edition/[date]`: any day, with a calendar strip; the day at a glance links to every story.
- The intro: the camera falling from orbit onto the morning's edition.

**Done (2026-11-05):** `/` is a landing page (navigation with GitHub, a hero with the live edition globe, today's stories, the lenses with screenshots, why to trust it, how it works, the archive and classics, a footer); `/today` is the latest edition on the full-screen globe: the camera falls from orbit onto it, each story a column of light coloured by lens and as tall as its heat (log), a story rail (hover flies there, click opens the film, clicking a column too), **Play the edition** tours story to story with a caption card and "Watch the full story". An editions strip and the classics sit along the bottom; every edition page has the archive strip. **Cut to the backlog:** each tour stop building its own maps and charts live.

**Checkpoint 16:** `feat: front page, editions archive and intro`

## Phase 17 · Interaction: evidence drawer, click-to-explore, share links (about 2 h) ✅

- Click any chip: the evidence drawer (value, time, source, link), and the camera flies to it.
- Click anything on the globe (a state, a beacon, a place): it focuses and a detail card opens.
- Share links to a story, a chapter or a moment; share cards (OpenGraph images).

**Done (2026-11-05), trimmed:** a share button copies a link to the current moment (`?t=…&play`); story pages carry their own link previews (title and headline). **Moved to the backlog:** click-to-explore on globe layers.

**Checkpoint 17:** `feat: evidence drawer, click-to-explore and share links`

## Phase 18 · Nightly editions (about 1.5 h) ✅

- `.github/workflows/edition.yml`: build yesterday's edition, direct it (Claude, falling back to the template), validate, commit only `public/editions/<date>/` as a `data:` commit; Vercel deploys on push.
- Re-film the three previous editions too (ADR-0014): results and reports still fill in; from day 4 an edition is frozen.

**Done (2026-11-05):** `.github/workflows/edition.yml` runs at 04:30 UTC (or by hand with a date): edition → stories → direct (Claude, $0.25 ceiling) → the three editions before it re-filmed and re-directed (ADR-0014) → day at a glance → validate → key scan → `data: edition <date>` commit. A failed film is a warning, not a failed night. Claude answers are cached by input, so re-directing an unchanged film costs nothing. Hardened on the way: a fallback to the pageviews "top" list when the most-read feed omits its list (it did for 2026-11-02), and longer connect attempts for IPv6-less networks.

**Checkpoint 18:** `ci: nightly editions`

## Phase 19 · Video clip export (about 3 h) ✅

- Record any story film or a chosen span in the browser, with captions, chapter titles and sources burned in; landscape (16:9) and vertical (9:16). Free, no server.

**Done (2026-11-05):** the film button in the player records the whole film in the browser (MediaRecorder on a canvas fed by each globe frame), landscape 1280×720 or vertical 720×1280, with the title, chapter, caption, citation count, source credits and site address burned in; MP4 where the browser can, else WebM. Stop at any time to keep the clip so far. Checked by Abdelah: the clip records to 100% and downloads.

**Checkpoint 19:** `feat: video clip export`

## Phase 20 · Launch (about 4 h)

- Polish: sensor looks for disaster films (thermal, night), small-screen layout, performance pass.
- Deploy on Vercel; add the repository secret; run the nightly workflow once.
- README and landing page with a hero clip made by Earthlog itself: the **2026 US elections film** (Abdelah's pick), recorded once the Claude director is in; CONTRIBUTING (how to add a lens or a classic), CHANGELOG, launch posts.

**Done so far (2026-11-05):** README (what it does, why to trust it, how it works, deploy your own, credits, screenshots), CONTRIBUTING (how to add a lens or a classic), CHANGELOG (v0.1.0), the front page copy. **Left for the morning:** Vercel import, the `ANTHROPIC_API_KEY` repository secret, the first nightly run by hand, the hero clip (the US elections film, exported with the clip button), launch posts.

**Checkpoint 20:** `docs: launch` (plus the tag `v0.1.0`, done by Abdelah)

---

## Cut list (cut in this order if behind)

1. Small-screen layout (show "best on desktop")
2. Sensor looks
3. Share cards (OpenGraph images)
4. Science and space lens (fold into `general`)
5. Vertical clip format (keep landscape)
6. The intro (keep the front page)

**Never cut:** the edition builder, story films, the election, person and organization lenses, citations, the archive, clip export, the deploy.

## After launch (backlog, roughly in order)

1. **Election regional layer** for any country (results by province or state, matched to Natural Earth admin-1 shapes), and more country adapters
2. **Flights layer** for accidents and airspace (adsb.lol archives, ODbL; heavy data)
3. **Voice narration** (kokoro-js, in the browser)
4. **Weather at the time** for accidents and disasters (Open-Meteo archive, CC BY 4.0; verify)
5. **Images** from Wikimedia Commons, with their licences
6. **Bring-your-own-key Claude in the browser** for custom stories
7. **Community lenses and classics** by pull request
8. **More classics:** CrowdStrike 2024, Hurricane Helene, Red Sea cable cuts…
