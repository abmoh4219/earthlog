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
| News (daily replay) | **Wikipedia, Portal:Current events/<date>** via the MediaWiki API (`action=parse&prop=wikitext`) ✅ | No key; `User-Agent` sent | Daily pages back to 1990s | Per story, **date only, no time of day** | **CC BY-SA 4.0**: story text bundled with attribution and a link to the exact revision; captions adapted from it are shared under the same licence | **Yes** |
| News places | **Wikipedia GeoData** (`prop=coordinates&colimit=max&coprop=type\|dim\|country`) ✅ | No key | n/a | Place coordinates of linked pages, with a place type (city, adm1st, landmark, country…) | Facts; credited with Wikipedia | **Yes** (coordinates only) |
| Storms | **NASA EONET v3** `events` ✅ | No key | 2015 on | 6-hourly fixes from the tracking agency (e.g. JTWC), with wind in knots | NASA, no copyright; credit EONET and the agency | **Yes** |
| Outage detection | **IODA** `/v2/outages/events` ✅ | No key | As IODA | Algorithmic outage events per country, with a score | As IODA | Only to pick countries; we show each country's own signal |
| Fires (if a key exists) | **NASA FIRMS** VIIRS 375 m | Free `MAP_KEY`, used at bake time only; 5,000 transactions per 10 min | 2012 on (VIIRS) | Per satellite pass | NASA, no copyright; credit NASA FIRMS | **Yes** |

## Story sources for editions and lenses (verified 2026-11-04)

| Use | Source | Access | Verified with | Licence | Bundled? |
| --- | --- | --- | --- | --- | --- |
| **What the world read** (story discovery, heat) | Wikimedia feed API `api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD` → `mostread` (the *previous* day's top articles with view counts) | No key; `User-Agent` | 4 Nov feed → 3 Nov list: Jesús de Miguel 585k, 2026 United States elections 455k, a Learjet crash, *Jailer 2*, Patrick Stewart… | Pageview counts CC0; article descriptions CC BY-SA | Yes (counts, titles) |
| **What the news reported** | Wikipedia *Current events* (above) | No key | 14 sourced stories for 3 Nov | CC BY-SA 4.0 | Yes |
| **Readers by language** (curiosity map, attention spikes) | `prop=langlinks` + Wikimedia REST `metrics/pageviews/per-article/<lang>.wikipedia/all-access/user/<title>/daily/…` | No key | Spanish Wikipedia, Jesús de Miguel: 33 → 1,006 views (2 → 3 Nov) | CC0 | Yes |
| **Facts about people, companies, works, places** | Wikidata SPARQL `query.wikidata.org/sparql` | No key; `User-Agent`; 60 s query limit | OpenAI: HQ San Francisco (with coordinates), founded 2015-12-08, 4,500 staff, revenue series with dates | **CC0** | Yes |
| **Story type** (lens choice) | Wikipedia `pageprops` → Wikidata item → `instance of` (P31) | No key | Patrick Stewart → Q16296; *Jailer 2* → Q133255153; the Learjet crash → Q141966885 | CC0 | n/a |
| **Accident and event sites** | Wikipedia GeoData on the event's own article | No key | 2026 Palm Beach County Learjet 60 crash: 26.633°N, 80.113°W | Facts | Yes |
| **Election results** | Wikipedia election articles, e.g. `2026_United_States_Senate_elections` (per-state rows: winner, party, "hold"/"gain") and the House article (per district) | No key | Senate article: per-state winners and "Republican hold" marks; races not yet called are marked as such | CC BY-SA 4.0 (results cite their outlets) | Yes |
| **State and province shapes** | Natural Earth 1:50m admin-1 | Download once (2.3 MB) | GeoJSON reachable | Public domain | Yes (simplified) |
| **US congressional districts** | US Census cartographic boundaries `cb_2024_us_cd119_5m.zip` | Download once (2.1 MB) | Reachable | Public domain | Yes (simplified) |
| **Country indicators** | World Bank API `api.worldbank.org/v2/country/<ISO>/indicator/<id>?format=json` | No key | Australia inflation series | **CC BY 4.0** | Yes |
| **Tech heat** | Hacker News API (`hacker-news.firebaseio.com/v0/…`) | No key | Top stories list | No licence stated: **links and counts only, no text** (unverified) | Counts only |
| **Space launches** | Launch Library 2 (`ll.thespacedevs.com/2.3.0/launches/…`) | No key; free tier rate-limited (about 15 requests/hour, unverified) | Previous launches list | **Unverified**: check terms before bundling | TBD |

**Deep-replay sources (verified 2026-11-04):**

- **USGS event detail** (`/fdsnws/event/1/query?eventid=<id>&format=geojson`) lists products per quake: `shakemap` (`cont_mmi.json` intensity contours, `rupture.json`, `stationlist.json`), `finite-fault` (`FFM.geojson`), `dyfi` (`dyfi_geo_10km.geojson`, `dyfi_plot_numresp.json` responses over time), `losspager` (`exposures.json`, `cities.json`, `alerts.json`). Public domain.
- **GIBS geostationary imagery** at exact times (5–10 minute steps): `GOES-East_ABI_GeoColor`, `GOES-West_ABI_GeoColor` (`GoogleMapsCompatible_Level7`, PNG), `Himawari_AHI_Band3_Red_Visible_1km` (Level7). A **rolling window**: 2026-08-01 works, March 2025 and October 2024 return 404. About one request in three returns a spurious 404, so clients must retry.

**Not used (verified 2026-11-04):** **GDELT DOC API** answered HTTP 429 ("one request every 5 seconds") to every request, even when paced, so a nightly job can't rely on it. News is ranked by category and source count instead. Revisit with GDELT's bulk files.

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
- **Wikipedia's coordinates lookup returns at most 10 results per request** unless `colimit=max` is set; without it, most stories fell back to country level.
- **Country pages don't always carry coordinates** ("United States" has none). Bakers fall back to Natural Earth's label point, matching names through aliases ("United States" = "United States of America").
- **News digests give dates, not times.** Report evidence carries `precision: "day"`; captions for news state no clock time, and the story card says "time of day not recorded".
- **The Wikimedia feed sometimes omits `mostread`.** The downloader refuses to cache an incomplete answer and retries (seen 2026-11-04).
- **An article's "normal" readership** comes from the per-article pageviews API, 60 to 8 days before the day. A 404 means the article had no views then: it's new.
- **Most-read lists include noise:** the Main Page, `Special:` pages and lists like "Deaths in 2026". The builder drops them by title and by Wikidata type ("Wikimedia list article").
- **Election infoboxes** (`{{Infobox election}}`, `{{Infobox legislative election}}`) share `partyN`, `leaderN`, `percentageN`, `seatsN`, `seats_beforeN`, `last_electionN`, `majority_seats`, `turnout`, `last_update`. `last_electionN` can be "New": not a number.
- **US race tables** mark a called race's winner with `{{aye}}`; no `{{aye}}` means not called. The same race appears in prediction and retirement tables too, so the row with a winner wins. Minnesota's Democrats appear as "(DFL)". Governor rows write "[[2026 Alabama gubernatorial election|Alabama]]" (state before office).
- **Infobox totals run ahead of race tables:** at 9:15 AM ET on 4 Nov the House infobox showed 231–139 while the race tables still had 97 districts uncalled. Films show both, each labelled with its own timestamp.
- **US Census TIGERweb** (`tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb`): `Legislative/MapServer/0` is the 120th Congress (2026) districts, `State_County/MapServer/0` the states; `f=geojson` with `maxAllowableOffset` returns simplified lon/lat polygons (districts 269 KB, states 64 KB). Public domain.
- **Party colours:** Wikidata P465 ("sRGB colour hex triplet") on the party's item, e.g. Democratic `003CBA`, Republican `E9151E`. Dark colours are lightened for the dark globe.
- **Wikidata claim qualifiers carry a life's dates:** P580 (start time), P582 (end time), P585 (point in time), e.g. each club on P54 "member of sports team". Organisations rarely have coordinates themselves: use P115 (home venue), P159 (headquarters), P276 (location) or P131 (located in), then the country.
- **Page-view spikes on brand-new or obscure articles are meaningless as ratios** (585,060 vs a usual 3 a day). Captions say "almost nobody read it in the weeks before" when the normal level is under 50 a day.
- **Why a story trends, without AI:** editors write the news into the article within hours. `prop=revisions&rvstart=<3 days before>&rvdir=older` gives the earlier revision to compare with; the sentences added since, or dated near the day, say what happened (de Miguel's collision, Simmons' trade, AO3's outage). Year-less dates ("on October 29") are trusted only in newly added sentences; plots, casts and lists are skipped.
- **Company numbers on Wikidata** (P2139 revenue, P2295 net income, P1128 employees) are quantities with a unit (a currency item whose P498 is the ISO code) and a P585 date. Quality varies: OpenAI's revenue mixes millions and bare thousands. Films drop values more than 50× off the series median and say how many.
- **Hacker News search** (`hn.algolia.com/api/v1/search_by_date`, `restrictSearchableAttributes=title`, `typoTolerance=false`) is still forgiving, so titles are re-checked for the name as a whole word. Search the opening's short name too ("Archive of Our Own (AO3)"): titles use it. No licence stated: counts, and the top story's title as a link.
- **AWS Terrain Tiles** (`elevation-tiles-prod`, terrarium PNG, attribution per tilezen/joerd) are reachable but send **no CORS header**, so a browser can't decode them. Use only at bake time (planned).
- **World Bank** (`api.worldbank.org/v2`): `country/all/indicator/<id>?date=2010:2026&per_page=20000` returns every country at once; `country?per_page=400` gives regions (drop "Aggregates"; some names end with a space). Indicators used: `FP.CPI.TOTL.ZG` inflation, `NY.GDP.MKTP.KD.ZG` growth, `SL.UEM.TOTL.ZS` unemployment. Annual, so captions name the year. CC BY 4.0.
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
