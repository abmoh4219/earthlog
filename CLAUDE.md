# CLAUDE.md: Earthlog

Guidance for Claude Code, and any human, working in this repo. Read it before proposing or writing code. These rules are binding; change them only by agreement with Abdelah, in the same commit as the reason.

---

## 1. Purpose

**Earthlog: yesterday's world, explained in 3D.** Every morning, Earthlog turns the previous day's hottest stories (every topic, everywhere) into short, cinematic explainers on a 3D globe. **Each story gets the analysis its kind deserves** (a *lens*: red and blue states for an election, a flight to the headquarters for a tech story, a life drawn across the globe for a person), and **every claim links to its source**. Full concept: [docs/CONCEPT.md](docs/CONCEPT.md).

- **Editions:** one per day, built nightly, kept forever as an archive (ADR-0009, ADR-0012).
- **Stories:** discovered from what the news reported (Wikipedia Current events) and what the world read (Wikipedia most-read), typed via Wikidata, ranked by heat.
- **Lenses:** one analysis module per kind of story; they ship one per phase ([PLAN.md](PLAN.md)).
- **Story films:** chapters, captions with citations, globe layers and chart panels; exportable as video clips.
- **Classics:** hand-made deep replays of landmark events (the planet's black box) use the same player.
- **Not God's Eye View, not World Monitor:** they show the world *now*, as a spy simulator and an intelligence dashboard. Earthlog is the newsroom's data team: depth over breadth, editorial calm, proof everywhere.
- **Open source (MIT), free, no accounts, no backend.** Visitors only download static files.

## 2. Architecture in one picture

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
 OFFLINE (nightly GitHub Action, or a developer's machine)       ONLINE (every visitor, free)
 ┌──────────────────────────────────────────────────┐          ┌──────────────────────────────┐
 │ scripts/edition  discover + type + rank stories  │          │ Next.js site on Vercel (SSG)  │
 │ scripts/lenses/* bake each story with its lens   │─commit─► │ CesiumJS globe + React UI     │
 │ director         template (free) | Claude (key)  │ public/  │ plays story films, no AI      │
 │ validator        every sentence cited            │ editions │ calls, no keys, no backend    │
 └──────────────────────────────────────────────────┘          └──────────────────────────────┘
```

**The AI runs once per story (nightly for editions), never once per visitor.** A story film is a validated `scene.json` plus data files. Watching costs nothing.

The nightly edition runs the same scripts in a scheduled GitHub Action, which commits the new edition (`data:` commits) and triggers a Vercel deploy (ADR-0009).

## 3. Non-negotiable principles

1. **Every claim is cited.**
   - Every narration sentence (a "beat") cites ≥ 1 evidence ID that exists in the bundle and falls inside the scene's time window.
   - The validator rejects anything else, whether a template or Claude wrote it.
   - **No invented facts, ever.** If the data or a cited report doesn't show it, the narrator doesn't say it.
   - News enters as `report` evidence (a source, a link, and the exact text it rests on). The narrator may summarise it in its own words, but the sentence still cites it.
2. **Honest data.**
   - Show what each source measures. IODA shows *internet connectivity signals*, not "people offline".
   - Label estimates and interpolations as such.
   - Show the data's real gaps; never smooth over them silently.
   - Times are stored in **UTC** (ISO 8601), and displayed as local time plus UTC.
3. **AI is optional and labelled.**
   - The app works fully with template scenes.
   - Claude-written narration is marked "AI-written narration, every sentence checked against cited data".
   - **No AI calls at runtime for visitors.**
4. **The API key never ships.**
   - Keys live only in a local `.env` (gitignored) and, for the nightly replay, in an encrypted **GitHub Actions secret** (ADR-0010). Only `scripts/` read them, at bake and direct time.
   - If the key is missing, expired or failing, the director falls back to the free template, so nothing breaks.
   - CI greps the build output for key patterns.
   - Never put a key in client code, a public proxy or a committed file.
5. **Respect every data licence.**
   - Each bundle lists its sources with licence and attribution (docs/DATA-SOURCES.md), and the UI shows them.
   - Only bundle data whose licence allows redistribution.
6. **Responsible use** ([docs/RESPONSIBLE-USE.md](docs/RESPONSIBLE-USE.md)):
   - no tracking of private individuals, private aircraft or homes;
   - no imitating news outlets;
   - disasters are narrated with care, never as entertainment for its own sake;
   - **all news is in scope** (politics, elections, war, sports, science, business, culture, disasters), stated plainly and neutrally, **every sentence cited** (ADR-0011). Casualty figures and contested claims are attributed to their source ("according to…"). No tactical detail (live positions of forces).
7. **Free everything.** Only free tiers and open-source dependencies with compatible licences. If something has no free option, say so first.

## 4. Stack

| Concern | Choice |
| --- | --- |
| App | **Next.js 16** (App Router, Turbopack, statically generated replay pages) + React 19 + TypeScript (strict), single package, pnpm |
| UI | **Tailwind CSS 4**, **Motion** (animation), **Zustand** (player state), **Lucide** icons, **Geist** fonts |
| Globe | **CesiumJS** (Apache-2.0). **No Cesium ion, no Google tiles by default**; imagery from NASA GIBS (no key) |
| Validation | **Zod** for scene and evidence schemas, at every boundary (fetched data, scene files, Claude output) |
| Scripts | Node 24+ running `.ts` directly (built-in type stripping), no build step |
| AI (offline only) | `@anthropic-ai/sdk`; Haiku 5.5 by default, Sonnet 5.5 for hero scenes. **Read the `claude-api` skill before touching director code** |
| Tests | Vitest. Lint and format: Biome |
| Hosting | **Vercel** (Hobby, free), `earthlog.vercel.app` today, `earthlog.abdelah.dev` later. The site URL lives only in `src/config.ts` |

## 5. Conventions

- **Shared code in `src/scene/`** is imported by both Next.js and the Node scripts, so it uses explicit `.ts` import extensions and no `@/` alias. Everything else uses `@/`.
- **Cesium is client-only:** it loads in the browser via dynamic `import()`, never during server rendering. Its runtime assets are copied to `public/cesium/` by `scripts/copy-cesium-assets.ts` (gitignored).
- **Strict TypeScript:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; no `as` on external data. Parse with Zod.
- **Pure core:** scene math (camera interpolation, clock mapping, layer styling from values) and the validator are **pure functions** with unit tests. Rendering code stays thin.
- **One clock:** every visual reads time from the single player clock. Nothing animates on its own timer.
- **Comments explain *why***: especially data quirks, licence constraints and visual tricks.
- **Conventional commits:** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `perf:`, `data:` (new or rebaked event bundles).
- **New dependency?** Say what it replaces, why the platform or an existing dependency won't do, its licence and its weight.
- **Performance budget:** each scene bundle under 5 MB; the first globe frame under 3 s on a good connection; 60 fps interaction on a mid-range laptop.

## 6. Testing rules

- **Bakers are tested against recorded fixture responses** in `test/fixtures/`. Unit tests make no network calls.
- **The validator has tests for every rejection path** (an uncited beat, an unknown ID, out-of-window, out of order, a missing licence).
- `pnpm validate:scenes` checks every committed bundle in CI.
- **Before every checkpoint:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` are green, and Claude has **looked at the running app** (dev server, and a headless screenshot where possible).
- **Don't burn API tokens in tests.** Claude-mode tests use recorded responses.

## 7. Working with Abdelah

- **Abdelah commits and pushes, always.** Never run `git commit`, `git push`, `git tag` or anything that rewrites history. End each phase with a summary and a suggested conventional-commit message. The one exception is the nightly GitHub Action, which commits only the new daily bundle as a `data:` commit (ADR-0009).
- **Phase by phase** ([PLAN.md](PLAN.md)): build → self-check → checkpoint → he reviews and commits → next phase. **The ship date is real** (2026-11-05): time-box, and use the cut list rather than cutting quality.
- **Explain real design choices before implementing them:** the options, the cost of each, the recommendation. Small reversible choices: decide, and mention them.
- **Prefer the simplest thing that works.** One person maintains this.
- **His API budget is small.** Use Claude only through `scripts/direct.ts`, Haiku by default, with prompt caching. Print the cost every run, and keep a hard cost ceiling per run.

## 8. Rules for Claude

1. Explain trade-offs before structural changes. Record anything structural as an ADR in `docs/decisions.md`.
2. Never ship an uncited narration sentence, and never weaken the validator to make a scene pass.
3. Never add runtime AI calls, a backend, accounts, analytics or telemetry without asking.
4. Never commit secrets. Never print keys. Never put keys in client code.
5. Verify external behaviour before relying on it (API shapes, licences, Cesium APIs) and cite the source in a comment or doc. Mark anything unverified.
6. Copy nothing from God's Eye View, World Monitor or other projects: no code, assets or text. Learning from their ideas is fine.
7. Never commit or push. Finish each phase with a checkpoint summary and a commit message.
