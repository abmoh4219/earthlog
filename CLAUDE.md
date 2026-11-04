# CLAUDE.md: Earthlog

Guidance for Claude Code, and any human, working in this repo. Read it before proposing or writing code. These rules are binding; change them only by agreement with Abdelah, in the same commit as the reason.

---

## 1. Purpose

**Earthlog is the planet's black box.** It replays real world events (earthquakes, blackouts, internet shutdowns, fires, storms) **minute by minute on a cinematic 3D globe**, from data that was recorded at the time. A narrator explains what you see, and **every sentence links to the evidence behind it**.

- God's Eye View and World Monitor show **now**. Earthlog reconstructs **then**, and shows how we know.
- It works for anything that has already happened, from an earthquake in 1960 to yesterday's news. How rich a replay is depends on what was recorded (docs/DATA-SOURCES.md).
- **Open source (MIT), free, no accounts, no backend.** Visitors only download static files.

## 2. Architecture in one picture

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
 OFFLINE (a developer's machine, once per event)                ONLINE (every visitor, free)
 ┌─────────────────────────────────────────────┐               ┌──────────────────────────────┐
 │ scripts/bake/*   free public data ──► JSON  │               │ Next.js site on Vercel (SSG)  │
 │ scripts/direct   evidence ──► scene.json    │──commit──►    │ CesiumJS globe + React UI     │
 │   template mode (free) | Claude mode (key)  │  public/      │ plays scene.json, no AI calls │
 └─────────────────────────────────────────────┘  scenes/      └──────────────────────────────┘
```

**The AI runs once per event, never once per visitor.** A replay is a validated `scene.json` plus data files. Watching costs nothing.

## 3. Non-negotiable principles

1. **Every claim is cited.**
   - Every narration sentence (a "beat") cites ≥ 1 evidence ID that exists in the bundle and falls inside the scene's time window.
   - The validator rejects anything else, whether a template or Claude wrote it.
   - **No invented facts, ever.** If the data doesn't show it, the narrator doesn't say it.
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
   - Keys live only in a local `.env` (gitignored) and are used by `scripts/` at bake and direct time.
   - CI greps the build output for key patterns.
   - Never put a key in client code, a public proxy or a committed file.
5. **Respect every data licence.**
   - Each bundle lists its sources with licence and attribution (docs/DATA-SOURCES.md), and the UI shows them.
   - Only bundle data whose licence allows redistribution.
6. **Responsible use** ([docs/RESPONSIBLE-USE.md](docs/RESPONSIBLE-USE.md)):
   - no tracking of private individuals, private aircraft or homes;
   - no imitating news outlets;
   - disasters are narrated with care, never as entertainment for its own sake;
   - **war and politics: sensors only.** Cause, blame, actors and casualties enter narration only as quoted, cited `report` evidence, never in Earthlog's own voice. No conflict replay of anything less than 30 days old, and no election results.
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

- **Abdelah commits and pushes, always.** Never run `git commit`, `git push`, `git tag` or anything that rewrites history. End each phase with a summary and a suggested conventional-commit message.
- **Phase by phase** ([PLAN.md](PLAN.md)): build → self-check → checkpoint → he reviews and commits → next phase. **Today's deadline is real:** time-box, and use the cut list rather than cutting quality.
- **Explain real design choices before implementing them:** the options, the cost of each, the recommendation. Small reversible choices: decide, and mention them.
- **Prefer the simplest thing that works.** One person maintains this.
- **His API budget is small.** Use Claude only through `scripts/direct.ts`, Haiku by default, with prompt caching. Print the cost every run.

## 8. Rules for Claude

1. Explain trade-offs before structural changes. Record anything structural as an ADR in `docs/decisions.md`.
2. Never ship an uncited narration sentence, and never weaken the validator to make a scene pass.
3. Never add runtime AI calls, a backend, accounts, analytics or telemetry without asking.
4. Never commit secrets. Never print keys. Never put keys in client code.
5. Verify external behaviour before relying on it (API shapes, licences, Cesium APIs) and cite the source in a comment or doc. Mark anything unverified.
6. Copy nothing from God's Eye View, World Monitor or other projects: no code, assets or text. Learning from their ideas is fine.
7. Never commit or push. Finish each phase with a checkpoint summary and a commit message.
