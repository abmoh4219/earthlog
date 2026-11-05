# Contributing to Earthlog

Thank you for helping. Earthlog is maintained by one person, so small, focused changes with a clear reason are the easiest to review. Read [CLAUDE.md](CLAUDE.md) first: its rules (every claim cited, honest data, no keys in the client, data licences respected) apply to every contribution.

## Set up

Requires Node 24+ and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # must be green before a pull request
```

## How a film is made

```
pnpm edition <date>          scripts/edition/   find, type (Wikidata) and rank the day's stories
pnpm stories <date>          scripts/lenses/    film each story with its lens (template narration)
pnpm direct <date> --ai      scripts/direct.ts  optional: Claude rewrites the captions, checked
pnpm validate:scenes                            every sentence must cite evidence in the bundle
```

A film is a folder in `public/editions/<date>/stories/<slug>/`: `scene.json` (chapters, captions, camera, panels), `evidence.json`, `sources.json` and `data/*.json` (globe layers). The player in `src/` only plays it.

## Add a lens

A lens is the analysis a kind of story deserves. Start from [scripts/lenses/sports.ts](scripts/lenses/sports.ts) (small) or [scripts/lenses/accident.ts](scripts/lenses/accident.ts) (richer).

1. **Type the stories:** add the Wikidata "instance of" labels that should pick your lens in [scripts/edition/lens.ts](scripts/edition/lens.ts), and the lens name and colour in `src/scene/edition.ts`.
2. **Write the lens:** `export async function myLens(ctx: LensContext): Promise<LensResult>`. Fetch only free, redistributable data, cache it through `fetchJson`, and build on `generalLens(ctx, { shape })`: add chapters (a title, a camera shot, captions with `cites`, panels), layers (places, arcs, regions, columns, lines, terrain) and evidence.
3. **Register it** in `LENS_FILMS` in [scripts/stories.ts](scripts/stories.ts).
4. **Test it against recorded responses** in `test/fixtures/` (unit tests never touch the network).
5. **Document the source** (what it measures, licence, the exact response shape you verified) in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).

Rules a lens must keep: every caption cites at least one evidence item; numbers come from the data (never typed in); estimates say they are estimates; casualty figures and contested claims are attributed; no tactical detail and no private individuals ([docs/RESPONSIBLE-USE.md](docs/RESPONSIBLE-USE.md)).

## Add a classic

Classics are hand-made deep replays of landmark events. Add an event definition in `events/` (see [events/iberia-2025.ts](events/iberia-2025.ts)), bake it with `pnpm bake <id>`, and check it with `pnpm validate:scenes`.

## Commits

Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `perf:`, `data:` (new or rebaked data).

## Code of conduct

Be kind and assume good faith. Disagreements about how a story is told are settled by the evidence and the responsible-use rules, not by volume.
