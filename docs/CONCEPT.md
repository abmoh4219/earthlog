# Earthlog: concept

> **Yesterday's world, explained in 3D.**
> Every morning, Earthlog turns the previous day's hottest stories (every topic, everywhere) into short, cinematic explainers on a 3D globe. Each story gets the analysis its kind deserves, and every claim links to its source.

## The idea in one scenario

It's the morning of 4 November 2026. You open Earthlog.

1. **The front page.** The globe turns slowly at dawn. Yesterday's stories glow on it as beacons: a large violet light over Washington (the US midterms), a green one over Tenerife (a footballer's death), white over Florida (a Learjet crash), gold over Sydney (an interest-rate rise), pink over India (*Jailer 2*, an Indian film). The bigger the beacon, the hotter the story: how many people read about it, how many outlets reported it.
2. **You click the midterms.** The camera falls toward the United States. States fill in **red or blue, race by race**. Flipped seats pulse, and races not yet called stay hatched grey. A panel builds the **Senate and House seat bars**, before and after. A chart shows which candidates the world was reading about. Every number has a citation chip.
3. **You click the footballer.** The camera draws **his life across the globe**, from his birthplace through the clubs he played for, as Wikidata records them. A **curiosity map** shows where the world read about him: Spanish-language readers went from 33 to 1,006 in a day, and other language editions followed.
4. **You click a tech story.** The camera flies to **the company's headquarters** (for example San Francisco, for OpenAI). A panel shows what's on record about the company (founded, staff, revenue over time) and how attention spiked.
5. **You press Export.** A 20-second vertical clip with captions and sources goes straight to your phone.

Tomorrow there's a new edition. Every edition is kept: **the archive is a 3D record of the planet, day by day.**

## What makes it ours (and not God's Eye View or World Monitor)

| | God's Eye View | World Monitor | **Earthlog** |
| --- | --- | --- | --- |
| Feels like | A spy-satellite simulator | An intelligence dashboard | **A newsroom's data team, in 3D** |
| Time | Live, now | Live, now | **Yesterday, explained (and every day before it)** |
| Unit | Feeds and objects (planes, ships, satellites) | Layers and alerts | **Stories**, each with an analysis built for its kind |
| Depth | Track one object | Many layers at once | **One story, explained end to end** |
| Trust | Labels simulations | AI briefs | **Every sentence cites its source; click to check** |
| Sharing | Links to a view | Links to a view | **One-click video clips**, vertical or landscape |

**Our taste:**

- **Editorial, not tactical.** We borrow the best of data journalism: clear charts, calm motion, generous type, honest labels. No military HUD, no surveillance vibe.
- **Depth over breadth.** Fewer things on screen, each one explained. A story film runs 60–90 seconds and you understand it.
- **Ice.** Deep space black, glacier blue, glass panels, letterbox, a slow confident camera. Colour carries meaning.
- **Proof everywhere.** Every number has a chip; every chip opens its source.

## The lenses: an analysis for every kind of story

A **lens** is the analysis template for one kind of story. The lens is chosen from what the story's main Wikipedia/Wikidata entry *is* (an election, a person, a company, a film, an accident…).

| Lens | On the globe | Panels and charts | Data (free) |
| --- | --- | --- | --- |
| 🗳️ **Election** | States or districts filled by winning party; flips pulse; uncalled races hatched grey | Seat bars before → after, flips list, vote-share bars per race, candidate attention | Wikipedia election articles (per-state and per-district result tables), Natural Earth states, US Census district shapes |
| 👤 **Person** (deaths, awards, appointments, arrests) | Their life drawn as arcs: birthplace, education, work, death place | Life timeline, key works, attention spike, curiosity map | Wikidata (places with coordinates and dates), Wikipedia pageviews in every language |
| 🏢 **Organization and tech** | Fly to headquarters; arcs to the places in the story | What's on record: founded, staff, revenue over time; attention spike; tech-community heat | Wikidata (HQ coordinates, revenue series), Wikipedia pageviews, Hacker News |
| 💹 **Economy** | The institution, then the country, then its neighbours compared | Indicator charts (inflation, growth, rates) with the decision marked | Cited report, World Bank indicators (CC BY 4.0) |
| ⚽ **Sports** | The venue; arcs from teams' and athletes' home cities | Result card, where the world followed it | Wikipedia/Wikidata, pageviews by language |
| 🎬 **Culture** (film, TV, music, games) | Country of origin, filming locations, studio | Release and box office on record, curiosity map | Wikidata, pageviews by language |
| ✈️ **Accident** | The exact site; route arcs where known | Vehicle facts (type, maker, age), timeline | Wikipedia article coordinates, Wikidata |
| 🌋 **Disaster** (quake, storm, fire, outage) | Minute-by-minute sensor replay: fault rupture and shaking, **satellite clouds moving every 10 minutes**, fire detections, provinces losing internet | Intensity, exposure, wind, signal charts | USGS ShakeMap/DYFI/PAGER, NASA GIBS geostationary, EONET, FIRMS, IODA |
| ⚔️ **Conflict and security** | Every place mentioned, day by day | How it unfolded over previous days; attributed figures | Wikipedia Current events archive, IODA, FIRMS |
| 🚀 **Science and space** | Launch site, mission path, institution | Mission facts, attention | Launch Library 2, Wikidata |
| 📰 **General** (fallback) | The place and the places linked | How it unfolded, attention | Current events, pageviews |

## Signature features (used across lenses)

- **The front page:** yesterday's stories as beacons on the globe, sized by heat.
- **The curiosity map:** where the world read about a story, from Wikipedia's language editions. Shown as approximate, because a language isn't a country.
- **How it unfolded:** a story's thread through previous days of the news.
- **Evidence chips** on every sentence and every number.
- **Clip export:** any story as a captioned video, landscape or vertical.
- **The archive:** every edition kept; open any day.
- **Classics:** hand-made deep replays of landmark events (the Iberian blackout, the 2022 World Cup final, Iran's 2025 shutdown, the Myanmar earthquake) stay as showcases.

## Which stories make an edition

- **Candidates:** every item in Wikipedia's *Current events* for the day (reported news, with sources) and every article in Wikipedia's *most read* list (what people actually looked up).
- **Heat:** readers that day (and how far above that article's normal), number of sources, and sensor size for disasters.
- **Noise filter:** evergreen pages (lists, "Deaths in 2026", perennial favourites) are dropped unless their readership spiked or the news mentions them.
- **Balance:** about 10 stories, spread across topics so no single field takes the whole edition.

## Look and feel: as cool as ice

- **Palette:** deep space black, glacier blue UI (`#9ad9ff`), white type. Colour carries meaning: lens colours for stories, party colours for elections, red for loss, amber for energy, cyan for attention.
- **Type:** Geist for prose, Geist Mono for data.
- **Motion:** slow, eased camera arcs; data appears when it happens; panels build in sync with narration.
- **Honesty in the UI:** sources in every panel, estimates and approximations labelled, gaps shown as gaps, uncalled races shown as uncalled.
- **Respect:** deaths and disasters are told with care. No mockery, no spectacle.

## Who it's for

- **Everyone, every morning:** "What happened yesterday, and why does it matter?"
- **People who share:** clips that explain a story in 20 seconds, with sources.
- **Journalists, teachers, analysts:** a citable visual explainer and a daily archive.
- **Developers:** an open, hackable pipeline. A new lens or classic is a pull request.
