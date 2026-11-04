<!-- DRAFT. Final README with hero GIF lands in PLAN.md Phase 5. -->

<h1 align="center">🌍 Earthlog</h1>

<p align="center"><strong>The planet's black box.</strong><br/>
Replay real world events minute by minute on a cinematic 3D globe, and see how we know.</p>

<p align="center"><em>Open source · free · no account · no keys</em></p>

> [!NOTE]
> **Being built today.** Everything below describes v0.1, which is in progress ([PLAN.md](PLAN.md)).

When the world has a bad day (a blackout, an earthquake, an internet shutdown), the recordings exist, scattered across NASA, USGS, internet observatories and Wikipedia. **Earthlog plays them back together, in sync, on one globe.** A narrator tells the story, and **every sentence links to the data behind it.**

## Replays in v0.1

| Event | What you'll see |
| --- | --- |
| ⚡ **Iberian blackout**, 28 Apr 2025 | Spain and Portugal's internet collapsing within minutes, the peninsula dark from space that night |
| ⚽ **World Cup final**, 18 Dec 2022 | A nation holds its breath: Argentina's internet traffic dips during the match, and attention waves roll across languages until the shootout |
| ⚔️ **Iran goes dark**, Jun 2025 | Connectivity falls to about 4% of normal during the Israel–Iran war. Sensors only, with the cause quoted from cited reporting |
| 🌋 **Myanmar earthquake**, 28 Mar 2025 | The M7.7 mainshock and its aftershocks rippling out, connectivity dropping, the world's attention spiking |

## How it's different

God's Eye View and World Monitor show the world **now**. Earthlog reconstructs **then**: a narrated, minute-by-minute replay of any moment that was recorded, with **a citation on every sentence**.

## How it works

```
offline, once per event:   free public data ──► baked bundle ──► director ──► scene.json (every sentence cited)
every visitor, free:       static site ──► CesiumJS globe plays scene.json (no AI, no keys, no backend)
```

Details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The data and its licences are in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).

## Run it locally (planned)

```bash
pnpm install
pnpm dev                       # open the player
pnpm bake iberia-2025          # rebuild an event bundle from public data
pnpm direct iberia-2025        # write the scene (template mode, free)
pnpm direct iberia-2025 --ai   # optional: Claude-written narration (your own ANTHROPIC_API_KEY)
```

## Data credits

NASA GIBS / Worldview · NASA FIRMS · USGS · IODA (Georgia Tech) · Wikimedia · Natural Earth. See [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).

## Responsible use

These are real events with real victims. Read [docs/RESPONSIBLE-USE.md](docs/RESPONSIBLE-USE.md).

## License

MIT (planned, see ADR-0006). Data keeps its own licences.
