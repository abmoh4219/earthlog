# Earthlog: data sources, licences and credits

Researched 2026-11-04. Endpoints marked ✅ were called successfully from the dev machine on that date, with no key. Licences marked **verify** need a check against the primary source before they're relied on.

**Rule:** a source's data is bundled into `public/scenes/` only if its licence allows redistribution. Every bundle's `sources.json` and the in-app credits panel carry the attribution.

## v0.1 sources (today)

| Layer | Source | Access | History | Resolution | Licence | Bundled? |
| --- | --- | --- | --- | --- | --- | --- |
| Satellite imagery (day) | **NASA GIBS** WMTS, e.g. `VIIRS_SNPP_CorrectedReflectance_TrueColor` ✅ | No key; tiles loaded by the browser | 2000 on (MODIS), 2012 on (VIIRS) | Daily, about 250 m | NASA data has no copyright; credit NASA GIBS / Worldview | No (streamed tiles) |
| Night lights | **NASA GIBS** `VIIRS_SNPP_DayNightBand_At_Sensor_Radiance` (`GoogleMapsCompatible_Level8`) ✅ | No key | 2012 on | Nightly, about 750 m | As above | No (streamed tiles) |
| Earthquakes | **USGS** FDSN event API ✅ | No key; at most 20,000 events per query | 100+ years | Per event, to the second | US public domain; credit USGS | **Yes** |
| Internet connectivity | **IODA** v2 API (Georgia Tech) ✅ (CORS allows browser fetch) | No key; at most 31 days per query (unverified) | Several years | 5–30 min signals: Google traffic (`gtr`, `gtr-norm`), telescope (`merit-nt`), BGP, active probing | **No explicit licence found**, copyright Georgia Tech Research Corp. → **verify**; see "Open question" | See below |
| Public attention | **Wikimedia** pageviews REST API ✅ | No key; requires a `User-Agent` | Jul 2015 on (REST), Dec 2007 on (dumps) | **Daily** via REST (hourly only via dumps) | CC0 | **Yes** |
| Country outlines | **Natural Earth** 1:110m admin-0 | Download once | n/a | 1:110m | Public domain | **Yes** |
| Fires (if a key exists) | **NASA FIRMS** VIIRS 375 m | Free `MAP_KEY`, used at bake time only; 5,000 transactions per 10 min | 2012 on (VIIRS) | Per satellite pass | NASA, no copyright; credit NASA FIRMS | **Yes** |

**Decision: IODA (2026-11-04, Abdelah).** We bundle the small, normalised series with clear attribution and a link to IODA, in a free, non-commercial, open-source project. We don't email first. **If IODA ever asks**, we switch to having the browser fetch their API at view time (CORS echoes the requesting origin, verified 2026-11-04), so nothing is redistributed.

## Gotchas found

- **Times:** IODA uses Unix seconds, and USGS uses epoch milliseconds or ISO. Everything is normalised to ISO UTC at bake time.
- **The Wikipedia article title changes.** The REST API wants the *current* title (redirects resolved), and views on the event day may sit under an older title. Bakers resolve redirects and sum across them.
- **GIBS tile matrix sets differ per layer:** for example, the night-lights layer exists at `Level8`, not `Level7`. Layer metadata comes from GIBS `GetCapabilities`, not guesses.
- **IODA signals measure connectivity, not people.** Narration says "internet traffic fell to 54% of normal", never "54% of people lost internet".
- **IODA's copyright line**, verbatim in each response: "Copyright (c) 2021-2025 Georgia Tech Research Corporation. All Rights Reserved." Bakers copy it into `sources.json`, next to our attribution (see the decision above).
- **IODA country names** are formal ("Iran (Islamic Republic Of)"); bakers use Natural Earth's names instead.
- **Natural Earth `ISO_A2` is "-99" for France and Norway.** Use `ISO_A2_EH`. Two disputed areas have no code at all and are skipped.
- **Night passes don't always exist.** For the Iberian blackout night, Suomi NPP's day-night band returns no data over Spain on 2025-04-29, and NOAA-20's pass (around 01:30 local) shows Madrid already lit. A replay with no usable pass shows the Black Marble composite, **labelled on screen** as "a typical night, not this one".
- **The best minute-by-minute outage signal is `ping-slash24`** (responsive /24 address blocks, every 10 min). `gtr-norm` (Google traffic, every 30 min) is better for attention events like a final, because people stop searching to watch.
- **The MODIS sensors are ending** (Terra around February 2027, Aqua around September 2027). Prefer VIIRS layers.

## Later sources (backlog)

| Layer | Source | Licence | Notes |
| --- | --- | --- | --- |
| Flights | adsb.lol `globe_history_*` (GitHub releases) | ODbL 1.0 (attribution and share-alike) | 2023 on; hundreds of GB per year → needs a regional pre-filter. OpenSky's terms rule it out for a public app |
| Ships | NOAA MarineCadastre; Danish and Norwegian AIS | CC0 / PSI / NLOD (verify) | No free *global* history |
| News | GDELT 2.0 bulk files (15 min, since 2015) | Open use with citation | Use bulk files, not the rate-limited APIs. Show links, not article text |
| Storms | IBTrACS, NHC HURDAT2 | Public domain | 3–6 h tracks, interpolated (labelled) |
| Weather | ERA5 (CC BY 4.0 since July 2025) | CC BY | Slow CDS queue; pre-bake |
| Outages (alt) | Cloudflare Radar | API data CC BY-NC 4.0 | Free token; non-commercial (fine for us), attribution |
| Grid (EU) | ENTSO-E Transparency | Only the "free re-use" list | Token; the Iberian blackout timeline is in their factual report |
| Conflict | UCDP GED | CC BY 4.0 (verify) | ACLED's terms forbid redistribution: don't use it |
