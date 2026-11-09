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
- Today: `earthlog-abdi.vercel.app` (`earthlog.vercel.app` belongs to another project). Later: Abdelah buys `abdelah.dev` and points `earthlog.abdelah.dev` at the project.
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

---

## ADR-0014: Editions stay fresh for three days, then freeze

- **Date:** 2026-11-05
- **Status:** Accepted

### Decision

- A story film reads each article as it stands **now** for the first three days after its edition day, and is re-filmed during that time (nightly, Phase 18; or `pnpm stories <date>` by hand).
- From the end of day 3 on (edition day + 4 days, 00:00 UTC) it reads each article **as it stood at that moment** (`rvstart`), so the archive is reproducible: re-filming an old edition gives the same film, never one written with hindsight.
- Every film shows **"Data as of …"**: the time it read its sources (fresh) or the freeze time (frozen).
- The download cache knows what goes stale: an article's latest revision (3 hours), Wikidata and Hacker News (1 day), the last three days' pageviews (6 hours), World Bank (30 days). Everything else (a revision by date, a past day's counts, map shapes) is kept forever.

### Why

Results fill in for days. The US election film baked on 4 November afternoon showed 97 districts not yet called; the same lens that evening showed 61. A cache that never expired would have frozen the first answer forever, and a film re-made a month later would quietly use a month of hindsight.

### Cost

The nightly job re-films the last three editions (minutes, all free APIs). Old editions never change.

---

## ADR-0015: No repeated stories; real developments return as updates

- **Date:** 2026-11-08
- **Status:** Accepted

### Decision

- A story told in any of the last 7 editions (same Wikidata item, else same article, else same title) is left out, unless the day's news (a Current events item that day) reports something new about it.
- When it does return, it carries `update: { day, previous }`: "Update, day N" in the film's subtitle and on the edition page, with links back to its earlier films.
- Selection also got stricter: an article no news item mentions needs a reading spike of at least 5× (was 2.5×) and must not be evergreen reading (holidays, festivals, web domains, terms); a thing folds into the event it belongs to ("Learjet 60" into the crash), whichever was read more; a lens guessed from a linked page may only be an event lens.

### Why

From 2 to 6 November, the same stories filled most editions: the 2026 US elections five days running, *Ramayana: Part 1* four times, *Jailer 2* and Jesús de Miguel three times each, and ".xyz", a web domain, three times on readers alone. On those days nothing new had been reported. Dry runs of 5 and 6 November with the new rules left out 7 repeats each day and filled the space with reported world news (Nigeria, Somalia, Kenya, Pakistan, Nepal, Mexico).

### How it is built

`buildEdition` takes the recent editions as `history` (`scripts/edition.ts` reads them from `public/editions/`); the rules are pure and tested (`test/repeats.test.ts`). `pnpm edition <date> --dry` prints the picks without writing.

---

## ADR-0016: Visual identity: the night side

- **Date:** 2026-11-08
- **Status:** Accepted (chosen by Abdelah from three directions: a logbook, the night side, an atlas plate)

### Decision

- The site is the dark side of the planet. Tokens in `src/app/globals.css`: `void` (background), `night` (raised bands), `moon` (text), `dust` (secondary text and hairlines), `sodium` (the amber of city lights: the one accent, used once or twice per screen). The colours that carry meaning in films (loss, energy, attention, lens colours) are unchanged.
- Headlines in Newsreader (OFL, self-hosted at build by `next/font`, no new dependency); text stays Geist.
- The landing globe is lit by the real sun at the moment of the visit (`src/globe/sun.ts`, tested), faces a day/night line (sunrise or sunset, whichever is nearer the day's stories) so night and daylight are always both in view, and shows city lights from NASA Black Marble, labelled as a 2016 composite, never as last night.
- The landing shows proof instead of claiming it: a real line from one of the day's films with the report it cites and the outlets behind it, picked at build time.
- No eyebrow labels over sections, no glows or breathing animations, no icon feature grids; story markers are flat amber points.

### Why

The launch look (navy with one pale blue everywhere) read as a generic template. Of the three directions, the night side matches the films (which are dark) and gives a reason to open the page (the globe is different every visit). Dark plus a globe is also the look of intelligence dashboards, so the serif headlines, warm text and single amber accent are what keep Earthlog editorial instead.

---

## ADR-0017: A news engine from outlets' feeds

- **Date:** 2026-11-08
- **Status:** Accepted

### Decision

- Earthlog reads eight outlets' **official RSS feeds** (BBC News, The Guardian, Sky News, DW, France 24, Al Jazeera, NPR, AllAfrica) every three hours (`pnpm news`, `.github/workflows/news.yml`) and keeps **only the headline, link and time** of each item, for **72 hours**, in `public/now/now.json`. Never article text or summaries.
- Headlines are grouped into stories (`scripts/news/cluster.ts`): IDF-weighted word overlap with a light stemmer, places folded into one token each, then a second pass that merges groups naming the same city or region with a telling word in common. Each story is placed from the place names its headlines use (`scripts/news/place.ts`: Natural Earth cities, Wikipedia region coordinates, country names and demonyms; disputed places get no country), given a topic by keyword rules (`scripts/news/topic.ts`) and scored for heat and "breaking" (`scripts/news/hot.ts`).
- The nightly edition refreshes the headlines, then credits the outlets that reported each story **that day** (`scripts/edition/coverage.ts`): each headline is `report` evidence quoted exactly, each outlet a credited source, breadth of reporting adds to heat, and a story told in the last week returns as an update when outlets report on it again.
- The edition page shows "Reported by …", each name opening the outlet's own article, and credits the outlets with links to their home pages.

### Why

Wikipedia alone was one source: slower than the news and missing whole regions. Outlets' feeds are free, keyless and official. Headlines with links, credited by name, are what feed readers show; only BBC and AllAfrica say so explicitly, so the rest is kept to the minimum (no text, 72 hours, links to the outlet) and any outlet that objects is removed. Wire services (Reuters, AP) and CNN offer no usable public feed.

### Tested on

196 real headlines recorded from the eight feeds on 8 November 2026: the Krakow shooting is one story from six outlets (Al Jazeera's headline joins without naming Krakow) placed in Kraków; the Egypt train crash one story from four outlets despite different tolls; unrelated stories that share a country or a theme stay apart; the Kenyan cult leader's sentencing on 6 November matches BBC and AllAfrica.

---

## ADR-0018: "Now": the outlets' stories, live while the page is open

- **Date:** 2026-11-08
- **Status:** Accepted

### Decision

- `/now` shows the outlets' stories (ADR-0017) on a globe lit by the real sun, as amber points sized by heat, with a list beside it: last hour, 3 hours, 24 hours; topic filters; "Breaking"; "only outlets based in Europe" when every outlet that reported a story is based in one region; each headline opens the outlet's own article, and each placed story says why it is placed where it is.
- The page is rendered at build time (complete without JavaScript) and stays fresh while open: it re-reads `/now/now.json` every 10 minutes and when the tab becomes visible again, and re-ranks every minute. Ranking and "breaking" are computed at the moment of viewing (`src/scene/now.ts`), never frozen at collection time.
- Headlines are collected **every hour**. The news job force-pushes the single file `now.json` to the repository's `now-data` branch (one commit, so the branch never grows; that branch carries a `vercel.json` turning deployments off). The browser reads it from `raw.githubusercontent.com` (`NOW_DATA_URL` in `src/config.ts`) as soon as /now or the landing opens, and falls back to the copy bundled with the last deploy if it can't (repository private, offline). The nightly edition restores the file from that branch before it matches coverage. Main gets no hourly commits and Vercel no hourly deploys.
- It says when the headlines were collected and when the next collection is due, so an empty "last hour" is explained, not hidden.
- The landing gains "Happening now": the four hottest stories of the last 24 hours, refreshed from the hourly file in the browser.
- No AI on this page for now: the headlines speak for themselves, credited to their outlets. A short summary of the hottest stories by Claude (cached, capped) stays possible later.

### Why

The editions explain yesterday; readers also want to know what is happening, within the hour. Hourly commits to main would add 24 commits and 24 deploys a day and about 100 MB of history a year; a force-pushed side branch costs none of that. Its limits: the repository must be public for raw.githubusercontent.com to serve it, and GitHub does not publish raw's rate limits (they apply per visitor's address). The separate data repository planned for old films may host this file later.

---

## ADR-0019: Captions that read well without AI, and context for "Now"

- **Date:** 2026-11-08
- **Status:** Accepted

### Decision

- **Writing rules in code** (`scripts/lenses/editor.ts`), applied to every film before it is timed. The editor only removes, trims or tidies; it never adds a fact, and every caption keeps its citations:
  - a caption that repeats an earlier one is dropped, unless it names a new person, place or thing ("born … in Manhattan" stays after "(June 18, 1937 – …)"); the subject's own name never counts as repetition;
  - a sentence that leans on a missing one ("They also wrote…") or carries a broken quote is dropped;
  - a chapter of a single-subject film opening on "He"/"She"/"It" gets the subject's name;
  - long captions are cut at a sentence or clause end, never mid-phrase; stray markup ("(; born", "D.C..") is tidied;
  - a chapter whose captions all go becomes a short silent shot instead of repeating a line.
- **A quality check** (`captionIssues`) runs on every film and reports repeats, orphan sentences, broken quotes, cuts and stray punctuation in the run log and the nightly health report.
- **Lens fixes found by reading every caption of a day**: future elections show no results (a 2028 race never borrows 2026's); "none of the races had been called" instead of "Democrats won 0, Republicans 0"; "worked for" an employer, "in" a place; casualty figures only with numbers, one side and the other, attributed; "most in Turkish (14)" no longer shown.
- **Multi-source films**: when outlets reported the story that day (ADR-0017), the film gets an "In the news" chapter quoting each outlet's headline exactly, credited, with a panel of links.
- **Context for "Now"**: each hour the hottest stories get a background card, the lead of the Wikipedia article their headlines name (every word of the title must appear in the headlines; places, regions, lists and year pages never qualify; CC BY-SA, linked to the exact revision), and a link to Earthlog's film when one of the last week's editions told the same story.
- **Films read the exact Current events revision their edition was built from**, and refuse to run if an item no longer reads as quoted (`editionPortalRevision`, `newsMismatches`).

### Why

The bar is "a reader can't tell which films had AI", and the AI key may expire. Reading every template caption of 6 November showed the problems were extraction, not facts: repeats, orphan pronouns, cut quotes, raw infobox dumps.

Reading them also exposed a real fault: news evidence ids count items in a revision of the Current events page, but films fetched the latest revision, so when the download cache missed, an editor's later insertion put another story's text under the right id. Four live films of 3 and 4 November said something about another story (a footballer's film with US election results). Those editions are frozen, so their news films were re-filmed from the pinned revision (template narration).

---

## ADR-0020: Films for the news of "Now", every hour

- **Date:** 2026-11-08
- **Status:** Accepted

### Decision

- Each hour, every Now story of the last 24 hours that can be explained gets a film (up to 120; `scripts/news/film.ts`), with no AI. A story whose headlines name a Wikipedia article (ADR-0019) is typed through Wikidata and filmed by that article's lens, like an edition story: a person's life across the globe, a conflict's week and figures, a company's numbers, an event's facts on record, with their maps, charts and panels. It opens on the news itself as an outlet reported it ("…, France 24 reports."). A story no article explains but whose place is known is filmed by its place, with the place's article as background (never presented as the story): the news as reported and who else reported it; the country in World Bank charts and against its region (all topics but sports and culture); "Lately in <country>", the other stories placed there over the last three days, each cited with its own date; "About <country>" and its record from Wikipedia and Wikidata. Regions without a country (the Strait of Hormuz, the Gaza Strip) are filmed the same way without the charts. Only a story told by two or more outlets that names no place gets the short headlines film; a single report naming neither a place nor a subject gets none, because there is nothing to analyse beyond its headline. Every caption is cited and every film passes the same validator as edition films; a lens film that fails falls back to the short film. Downloads are cached between hourly runs (about a minute when warm).
- Films are built in story time like edition films. The film's day is the day of its latest headline; only that day's headlines are quoted, cited at day precision with the exact time kept in the label, so every citation falls inside the film's window. Edition films cite their outlets' headlines the same way.
- When a film's title is one outlet's headline (no Wikipedia article explains the story), its subtitle says whose headline it is.
- The films are written beside `now.json` (`films/<story>/`) and published with it to the `now-data` branch (ADR-0018). `/now/film?id=<story>` loads one in the browser (side branch first, deployed copy second) and says plainly when a film has been replaced by a newer hour.
- The Now list offers "Watch the film" for stories with a film this hour, and "Earlier on Earthlog" for an edition's film of the same story.

### Why

Readers expect the stories of "Now" to be explained like the editions, with analysis, not only listed. The editions' lenses already do that from Wikipedia and Wikidata; a Now story reaches them through the article its headlines name, matched strictly (ADR-0019: every title word in the headlines, a name not an everyday word, no stale years or unsupported disambiguations).

## ADR-0021: Hot means what the newsrooms agree on, and editions never wait for readers

Status: accepted (9 November 2026)

### Context

Editions waited for Wikipedia's most-read list, and ranked stories mostly by how many people read their articles. Wikimedia publishes that list hours or days late: on 9 November 2026 its page views had stalled since 6 November, so the editions of 7 and 8 November were not built, although eight outlets and Wikipedia's Current events had reported the day in full. And readership is not what makes news hot: a film release can top the list on a quiet day, while most of the world's conflicts and disasters never reach it.

### Decision

- **Hot is newsworthiness, measured** (`src/scene/newsworthy.ts`), one definition for editions and for Now. Each signal stands in for a news value from journalism research (Harcup & O'Neill, "What is news? News values revisited (again)", Journalism Studies 18(12), 2017, building on Galtung & Ruge, 1965) or for how aggregators rank a story cluster by "aggregate editorial interest" (Google News engineers, Nieman Lab, 2009):
  - **agreement:** how many outlets told it;
  - **reach:** outlets from how many regions;
  - **speed:** three or more outlets within three hours of the first report;
  - **persistence:** follow-up headlines, and coverage lasting through the day ("follow-up"; sustained coverage as in "media storms", Jurgens & Card, arXiv 2312.02118);
  - **magnitude:** the number of people the headlines say are involved; deaths, injuries and displacement weigh more than a crowd ("magnitude", "bad news");
  - **notability:** listed on Wikipedia's Current events, or the subject of its own Wikipedia event article that spiked that day;
  - **readers:** a small bonus when the most-read list is in, never required.
- Each story says **why it is news** in plain words ("Reported by 6 outlets from 3 regions · 114 people involved, per the headlines"), stored as `why` in editions and in `now.json`.
- **Editions never wait.** Yesterday's edition is built at 00:40 UTC from the outlets' headlines and Current events. Built without the most-read list, it says so (`mostRead: false`), and the 11:30 and 17:30 runs rebuild it once the list is published (within two days, while the outlets' headlines are still kept).
- **Stories found by the outlets:** a story two or more outlets reported that day, that neither Wikipedia list had, joins the edition (`foundBy: "outlets"`), titled by its headline and filmed the way a Now story is (the article its headlines name, else its place, else the short film), from the headlines stored in the edition. If its headlines were partly credited to another story, or it happened in the same city or region as one, it is that story: its outlets join that story's coverage. A story found by the outlets the day after an edition story in the same city, sharing a word, is that story's update.
- **Now lists what Earthlog can explain or the newsrooms agree on:** a story with a film, or one told by two or more outlets. A lone report with nothing to explain (an opinion piece, a feature) stays in the data for editions to credit, but is not listed.
- **Finding a story's article** searches the subject before a headline's colon ("Ebola: …"), the proper names the headlines repeat ("Lisa Nandy"), a COP summit by its number, then telling words and a headline. A full name found from one word ("Messi" → "Lionel Messi") must be a person's; a label finds the subject itself ("Ebola" → "Ebola disease"); asides naming a country are accepted ("Republican Party (United States)"); disambiguation written as prose is refused.
- Lens films of Now stories also get "Lately in <country>" when the place is known.

### Why

The news decides what is news, as in a newsroom: several independent desks covering the same event within hours is the strongest signal there is, and it is in hand the same night. Readers stay a signal, the last one. The rule keeps the promise of the product: every morning, yesterday's world, on time.

### Cost

Editions built before the most-read list arrive have no readers line and lean to hard news until the rebuild. Stories found by the outlets depend on the eight feeds; a story only one outlet told never joins an edition on its own. The magnitude count reads headlines, so it is labelled "per the headlines".

## ADR-0022: A living globe on Now

Status: accepted (9 November 2026)

### Context

Phase 4 asks for a globe that feels alive: the news, and the planet itself, with something to click. Earthlog is static (no backend, nothing called at runtime but files), and every point it shows must say where it comes from.

### Decision

- **The living Earth is collected with the headlines, every hour** (`scripts/live.ts`, run by the news workflow): earthquakes of magnitude 4.5 and up in the last 24 hours plus the week's significant ones (USGS summary feeds), and open storms, wildfires and volcanoes (NASA EONET), each at its latest fix. Written to `live.json` beside `now.json` and published with it to the `now-data` branch (ADR-0018); the browser reads it from there, or from the copy in the deploy. No new runtime dependency: visitors still only download files.
- **Layers on the Now globe:** News (amber), Earthquakes (coral rings sized by magnitude), Storms and fires (small points). Each layer can be switched off.
- **What a click shows:** an earthquake's card says only what USGS measured (magnitude, depth, time, its place name, a link to the event page); an event's card says its last reported position date, the size the agency gives and the agency; a story opens in the list.
- **A country's pulse:** a click on the ground opens the country under it: the last 24 hours of news placed there, its earthquakes (inside the outline, or offshore and named so by USGS), its open natural events, and Earthlog's films from it in the last week. A quiet country says it is quiet.
- **Surprise me** flies to a story with a film this hour, hotter stories more often, never the same one twice in a row.
- The globe keeps turning slowly while untouched (existing), and stops on whatever was chosen.

### Why

Static and hourly keeps the promise (free, no backend, nothing to break at runtime) and is as fresh as the news beside it. Collecting at build time also lets the data be parsed and checked once, with Zod, instead of in every visitor's browser.

### Cost

The earthquakes are up to an hour old. EONET's open events are few, and storm fixes can lag by days; the cards date every position.

## ADR-0023: Filters, For you, search and the ticker; a lone report needs its own article

Status: accepted (9 November 2026)

### Context

After the living globe went live, Now was mostly African: 39 of 73 listed stories. AllAfrica republishes hundreds of local papers, and every one of its headlines starts with a country ("Uganda: …"); the place film that a country allows made each a "story with a film", and ADR-0021 listed every story with a film. AllAfrica's Title Case headlines also fooled the background matching ("Clerk", "Street children", even "Africa"). Readers also asked to filter by region.

### Decision

- **A lone report is listed on Now only when it names a subject with its own Wikipedia article** and was filmed through it; place films and short films are made only for stories two or more outlets told. Any outlet, any region: the same rule.
- **Background matching:** a Title Case headline's capitals say nothing; common-noun titles ("Police state"), continents and their peoples, calendar words, single place names, "City, Country", one word that is part of a longer name ("60 Minutes", "Route du Rhum") and titles whose initials or numerals the headlines lack ("Pope Leo X") are refused.
- **Regions** (`src/scene/regions.ts`): Natural Earth's continents with the Middle East taken out of Asia (Turkey and Cyprus with it, Egypt in Africa). Stored per Now story (`region`), derived for edition stories. Region chips on Now and on the edition front, each with its count.
- **For you:** the reader picks topics and regions to follow; kept in their browser only (localStorage), nothing sent, no account.
- **Search** (`/`, Ctrl/Cmd+K, or the nav's button): every edition story and classic from `/search.json` (a static file written at build time) plus the last 24 hours of Now, matched in the page by word starts, accents folded.
- **The ticker:** the day's top Now stories under the landing page's nav, breaking first; pauses on hover or focus, still for reduced motion.
- `/now?story=<id>` opens a story (search results, links).

### Why

The rule for what is news must not depend on how a feed writes its headlines. Filters and search let readers find their part of the world without changing what Earthlog ranks as news; preferences stay with the reader.

### Cost

Lone reports about local news, however important there, wait for a second outlet. Preferences don't follow a reader across devices.

## ADR-0024: Reasons to come back: the daily game, following stories, history

Status: accepted (9 November 2026)

### Context

Phase 5: give readers reasons to return every morning, with no accounts and no backend.

### Decision

- **"Where was it?"** (`/play`, `src/scene/game.ts`): up to five placed stories of the latest edition, built at build time. The clue is the story's first sentence with every place hidden (the gazetteer's cities, regions, countries and demonyms, plus the story's own place name, accents folded); outlets' names are kept ("France 24" is not France). A whole country is never an answer (too vague to score), and at most two rounds come from one country. The reader clicks the globe (with country borders) and confirms; the score is 1,000 within 50 km, falling with great-circle distance (about 500 at 1,400 km). The answer, the distance and the film follow each guess. A streak counts consecutive editions played; a result can be copied as squares, without the answers.
- **Follow a story:** from its film or from Now. A story is followed by its subject, the Wikipedia article it is about (`a:<title>`), so a later edition story or a Now story about the same article is an update; an edition's own "Update, day n" link back to a followed film counts too.
- **History:** the films a reader watched, last 40.
- **"Yours"** (`/yours`): following with updates, the game's streak and best, For you, recently watched.
- All of it lives in the reader's browser (localStorage), parsed with Zod when read; nothing is sent and there is no account.

### Why

A daily ritual built from the edition itself teaches where the news happened; following turns a single film into a thread. Keeping everything in the browser keeps the promise of no accounts, no tracking, no backend.

### Cost

Streaks and follows don't move between devices, and clearing the browser clears them. A story without an article is followed only through the edition's own update links.

## ADR-0025: The morning brief, listen mode and the week

Status: accepted (9 November 2026)

### Decision

- **`/brief`**, built with the latest edition (`src/scene/brief.ts`): the five biggest stories, each with its film's opening caption (itself cited; left out when it only repeats the title) and why it is news; the rest by name; "Since then", the Now stories first reported after the edition's day; the day's game. The brief says nothing the films don't.
- **Listen mode** reads the brief with the browser's own speech synthesis (Web Speech API). Only voices that run on the device (`localService`) are used, because some browsers offer cloud voices that send the text to a server; without a local English voice the button is not shown. No key, no service, nothing sent.
- **`/week`**, built from the last seven editions: each day's three biggest stories, the stories that ran three days or more (from the editions' "Update, day n"), and where the week's stories happened.
- The nav lists Now, Brief, Play, Week, Archive and How it works; on phones they sit behind a menu button.

### Why

A two-minute version of the edition, readable or audible, is the morning habit; the week is the catch-up for readers who missed days. Built from the editions, they cost nothing to run and repeat only what the films already cite.

### Cost

Listen mode depends on the reader's device having a local voice (most desktop and mobile systems do; some Linux browsers don't). The brief is as fresh as the latest edition, plus "Since then" from Now.

## ADR-0026: Built to be shared: share cards, RSS, embeds

Status: accepted (9 November 2026)

### Decision

- **Share cards:** every story film, every edition and the site have a 1200 × 630 preview image, made at build time with `next/og` (Satori; static PNG files, nothing rendered per visitor): the story's kind, date and place, its title, why it is news, and a world map from Earthlog's own country outlines with the story's place in amber (an edition marks all its stories). Pages without their own card use the site's. Set in Geist (OFL, from the `geist` package), because Satori reads TTF and the Newsreader serif is available here only through `next/font`. Story pages use the large-image card on X.
- **RSS:** `/feed.xml`, RSS 2.0 of the last seven editions' films, one item per story (its title, its film's opening caption, the link), written at build time; announced in every page's head and linked from the footer.
- **Embeds:** `/embed/<date>/<slug>` is the same player for an iframe on another site; the way to Earthlog opens a new tab, the page is kept out of search results (its canonical is the film's own page), and it records no history. The player's toolbar copies the embed code.
- **Sharing on phones** uses the system share sheet (Web Share API); elsewhere the link is copied.
- The site's address lives only in `src/config.ts` (`SITE_URL`, or `NEXT_PUBLIC_SITE_URL` on Vercel): a custom domain later is one value.

### Why

A link that shows the story and its map gets opened; feeds and embeds let Earthlog travel without accounts or a backend. All of it is static, so sharing costs nothing at any scale.

### Cost

Each card adds about 120 KB to the build output (about 100 cards today, growing by about 15 a day; old editions' cards go with old films when the archive moves to its own repository).

## ADR-0027: Old films move to a yearly archive repository on GitHub Pages

Status: accepted (9 November 2026). Supersedes the "separate data repo" option left open earlier.

### Context

Every story now has a film and a share card: about 2 MB of films a day, roughly 700 MB a year in the working tree and more in git history (films are re-made while an edition is fresh). A repository that size slows every clone and every Vercel build, and GitHub recommends repositories under 1 GB. jsDelivr was ruled out in the earlier research (not suited to a growing archive of many small files).

### Decision

- **Films older than 14 days move** (`KEEP_DAYS`, `src/scene/archive.ts`) to `abmoh4219/earthlog-archive-<year>`, a public repository published with GitHub Pages, one per year of archiving (a year of films stays under Pages' 1 GB site limit). Verified 2026-11-09: Pages answers with `access-control-allow-origin: *`, so the site fetches the files directly ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): 1 GB site, 100 GB/month soft bandwidth).
- **Each edition keeps its index files forever** (`edition.json`, `evidence.json`, `sources.json`: about 50 KB a day) and gains `films.json`, saying where its films went. Search, the week, the archive list, share cards and every story page keep working; an archived story's page is built as before (title, description, card) and its player loads the film from the archive (`ArchivedFilm`), parsed with Zod like every fetched file. Embeds likewise.
- **The nightly workflow** moves them (`pnpm archive plan | copy | finalize`): it copies the films into a clone of this year's archive, pushes it, and only then writes `films.json` and removes the films here, in the same `data:` commit. It writes to the archive with a **deploy key** that can write to that one repository only (secret `ARCHIVE_DEPLOY_KEY`); without it nothing moves and a warning says so.
- **Setup, once a year:** `bash scripts/setup-archive.sh [year]` creates the repository, publishes it with Pages and installs the key (the private key never leaves the script, and is deleted after it is stored as the secret).
- Rehearsed on 2026-11-09 with the 2 November edition archived to a local Pages-like server: the edition validated, the story page and its card built, and the film played from the archive.

### Why

The main repository stays small and fast to build; the archive is free, static and served by GitHub's CDN; nothing about reading an old film changes for visitors.

### Cost

Existing git history is not rewritten (the rule is never to rewrite history), so what is already in it stays. Old films depend on GitHub Pages being up. Once a year a new archive repository and key are set up (the old ones stay as they are, read-only in practice).
