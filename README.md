<!-- Work in progress. The launch README (hero clip made by Earthlog itself) lands in PLAN.md Phase 20. -->

<h1 align="center">🌍 Earthlog</h1>

<p align="center"><strong>Yesterday's world, explained in 3D.</strong><br/>
Every morning, the previous day's hottest stories (every topic, everywhere) become short, cinematic explainers on a 3D globe.<br/>
Each story gets the analysis its kind deserves. Every claim links to its source.</p>

<p align="center"><em>Open source · free · no account · no keys</em></p>

> [!NOTE]
> **In active development.** The globe, the data pipeline, four classic replays and a day-at-a-glance edition work today. The story lenses are being built one per phase: see the [roadmap](PLAN.md).

## What it does

Open Earthlog in the morning and yesterday is waiting on the globe: each story a beacon, sized by how much the world read about it and how widely it was reported. Click one and the camera dives in.

| When the story is… | Earthlog shows you |
| --- | --- |
| 🗳️ **An election** | States and districts filling in red and blue race by race, flipped seats pulsing, uncalled races left grey, seat charts before and after |
| 👤 **A person** (a death, an award, an appointment) | Their life drawn across the globe, from birthplace to the places that defined them, and where the world read about them |
| 🏢 **A company or a tech story** | A flight to its headquarters, what's on record about it (founded, staff, revenue over time), how attention spiked |
| 💹 **The economy** | The institution, its country and its neighbours compared, with the key indicators charted |
| ⚽ **Sports** | The venue, arcs from the teams' home cities, the result, who followed it around the world |
| 🎬 **Culture** | Where it was made, what's on record, where the world was reading about it |
| ✈️ **An accident** | The exact site, the route, the vehicle's facts |
| 🌋 **A disaster** | A minute-by-minute replay from the sensors: fault rupture and shaking, satellite clouds moving every 10 minutes, provinces losing internet |
| ⚔️ **A conflict** | Every place mentioned, day by day, with figures attributed to their sources |

Every story is a 60–90 second **story film** you can pause, scrub and explore, with **citation chips on every sentence and every number**. Any story exports as a **video clip** for sharing. **Every edition is kept**, so the archive becomes a 3D record of the planet, day by day.

**Classics:** four hand-made deep replays of landmark events: the 2025 Iberian blackout, the 2022 World Cup final, Iran's 2025 internet shutdown and the 2025 Myanmar earthquake.

## Why it's different

Most globe apps show the world **now**: live feeds, dashboards, tracked objects. Earthlog takes **yesterday's stories one at a time and explains each in depth**, the way a newsroom's data team would, with proof on every line, and keeps every day in a 3D archive.

## How it works

```
nightly, once per day:    what the news reported (Wikipedia Current events)
                        + what the world read (Wikipedia most-read)
                        → stories, each typed via Wikidata into a lens
                        → each lens bakes its free public data (Wikidata, USGS, NASA, IODA, World Bank…)
                        → a director writes the film (template, or Claude), every sentence validated against cited evidence
every visitor, free:      Next.js static pages → CesiumJS globe plays the films (no AI, no keys, no backend)
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Data and licences: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) · Concept: [docs/CONCEPT.md](docs/CONCEPT.md)

## Run it locally

Requires Node 24+ and pnpm.

```bash
pnpm install
pnpm dev                          # http://localhost:3000
```

Then open a classic, for example http://localhost:3000/replay/iberia-2025, or the day at a glance for 3 November 2026: http://localhost:3000/replay/daily-2026-11-03.
Keys: <kbd>Space</kbd> play/pause · <kbd>←</kbd>/<kbd>→</kbd> seek · <kbd>?</kbd> all shortcuts.

**Rebuild data** (free public sources, cached in `.cache/`):

```bash
pnpm bake iberia-2025             # a classic
pnpm bake daily 2026-11-03        # a day at a glance
pnpm edition 2026-11-03           # find, type and rank that day's stories
pnpm validate:scenes              # every sentence must cite real evidence
```

Claude-written narration is optional and runs offline only: put your own `ANTHROPIC_API_KEY` in `.env` (see `.env.example`). The site never needs a key.

## Data credits

NASA GIBS / Worldview · NASA EONET · USGS · IODA (Georgia Tech) · Wikipedia and Wikidata (Wikimedia contributors) · World Bank · Natural Earth · US Census Bureau. Licences per source: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).

## Responsible use

Real stories involve real people. How we cover elections, deaths, conflicts and disasters: [docs/RESPONSIBLE-USE.md](docs/RESPONSIBLE-USE.md).

## License

MIT. Data keeps its own licences; text adapted from Wikipedia is CC BY-SA 4.0.
