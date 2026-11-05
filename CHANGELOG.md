# Changelog

## v0.1.0 (2026-11-05): first public release

**Yesterday's world, explained in 3D.**

- **Daily editions:** every night, the previous day's hottest stories, from what the news reported (Wikipedia Current events) and what the world read (Wikipedia most-read), typed via Wikidata, ranked by heat and balanced across continents and kinds of story. Kept forever as an archive.
- **Story films** on a CesiumJS globe: chapters, captions with citation chips, panels (facts, bars, lines, parliament charts), and globe layers revealed chapter by chapter.
- **Lenses:** election (any country; US races state by state and district by district), person, organization and tech, economy (World Bank), sports, culture, accident (route, aircraft, on board), disaster (USGS ShakeMap and PAGER for earthquakes), conflict (the week day by day, attributed figures, IODA connectivity), science and space, and a general lens for everything else.
- **Signature features:** the curiosity map (readers per Wikipedia language, drawn where each language is spoken) and "how it unfolded" (a story's thread through the past week).
- **Cinematic globe:** NASA relief and bathymetry, real terrain at accident and disaster sites, a traced spotlight with radar rings and sweep, lock-on reticle, glowing arcs with comets and landing ripples, 3D columns, a lens pass (tilt-shift, grade, vignette, grain), a camera that banks and drifts.
- **Claude director (optional, offline):** Claude Haiku 5.5 rewrites captions chapter by chapter; every chapter is checked (citations, numbers, no dropped facts) or keeps the template; about $0.002 a film; labelled on screen.
- **Fresh, then frozen:** editions follow the news for three days, then freeze (ADR-0014); every film shows "Data as of".
- **Classics:** the 2025 Iberian blackout, the 2022 World Cup final, Iran's 2025 internet shutdown and the 2025 Myanmar earthquake.
- **Nightly GitHub Action** builds, films, directs, validates and commits each edition.
