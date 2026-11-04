# Earthlog: concept

> **The planet's black box.** Replay what happened, minute by minute, and see how we know.

## The idea

When a plane crashes, investigators replay the black box. When the world has a bad day (a blackout, an earthquake, an internet shutdown, a firestorm), there's no black box to replay. The recordings exist, though. They're scattered across NASA, USGS, internet observatories, Wikipedia and many others, each in its own format.

Earthlog collects those recordings for one place and one time window, and plays them back **together, in sync, on a cinematic 3D globe**. A narrator tells the story, and every sentence carries a citation you can click.

## A replay, scene by scene: the Iberian blackout

1. The camera falls from orbit toward Spain on **NASA's real satellite image of 28 April 2025**. The clock reads 12:25 local time (10:25 UTC).
2. 12:33. Spain and Portugal **start to glow red**: internet connectivity signals collapse across the peninsula within minutes. The caption says so and cites the IODA measurements.
3. Elsewhere in the frame, the world notices: a small chart shows Wikipedia views of the blackout article exploding.
4. Night falls. A wipe compares **the peninsula from space on 27 April and 28 April**: the lights are out.
5. The timeline lets you scrub, pause and click any citation to see the raw value and its source.

## Why it's different

| | God's Eye View | World Monitor | **Earthlog** |
| --- | --- | --- | --- |
| Time | Live, now | Live, now | **Any past moment** |
| Question | What's happening? | What's the situation? | **What exactly happened, and how do we know?** |
| Story | You explore | AI headline brief | **A narrated replay, every sentence cited** |
| Cost to visitors | Free (bring your own keys for extras) | Free core, paid Pro | **Free, no keys, no account** |

Research (2026-11-04):

- God's Eye View (MIT, about 62k stars) has said publicly that a "4D time machine" is its next direction, and has shown hand-made replays.
- Nobody we found does **evidence-cited narration** or focuses on **infrastructure failures** (internet, power).

Those two things are Earthlog's identity. We move fast and stay honest.

## Look and feel: as cool as ice

- **Palette:** deep space black, glacier blue UI (`#9ad9ff`), white type. Accent colours carry meaning: red is loss (outage, damage), amber is energy (quakes, fire), cyan is attention.
- **Type:** a clean grotesk for prose and a monospace for data (time codes, values, IDs). Both are open fonts.
- **Motion:**
  - slow and confident camera moves with eased arcs, never jerky;
  - data appears *at its real time*, with short, physical animations (shockwave rings, outages bleeding across borders, light fading);
  - cinema mode adds letterbox bars and captions that type in.
- **Honesty in the UI:** every layer shows its source in the corner, estimates are labelled, and gaps in the data are shown as gaps.
- **Restraint:** these are real disasters with real victims. The tone is documentary, never thrill-seeking. There's no "bombshell" framing.

## Which events Earthlog covers

**The rule:** an event fits if the planet's sensors (connectivity, satellites, seismometers, attention) recorded it **in minutes or hours, in a way you can see on a map**. That covers far more than disasters.

| Category | Examples | What the sensors show | When |
| --- | --- | --- | --- |
| 🌋 **Nature** | Earthquakes, tsunamis, volcanoes, wildfires, hurricanes, floods | Seismic events, thermal anomalies, storm tracks, before/after imagery | v0.1 |
| ⚡ **Infrastructure** | Blackouts, internet shutdowns, cable cuts, big tech outages | Connectivity collapse, night lights going dark | v0.1 |
| ⚔️ **War and conflict** | Wartime shutdowns (Iran, Jun 2025), strikes seen from space | Connectivity, thermal anomalies (FIRMS), airspace (later). **Sensors only; see the rules in RESPONSIBLE-USE.md** | v0.1 (one replay) |
| 🏛️ **Politics** | Government-ordered shutdowns during protests or exams, coups | Connectivity plus cited reporting for the cause | After launch |
| ⚽ **Sports and culture** | World Cup finals, the Olympics, eclipses, moon landings | **"The world watching"**: national internet traffic dipping while a country watches, attention waves by language | v0.1 (one replay) |
| 🦠 **Slow events** | COVID-19, Ebola, climate | Daily case or measurement data. Needs a separate days-per-second player mode | Later |
| ✈️ **Flights layer** | CrowdStrike 2024, airspace closures | Aircraft tracks (2023 on) | After launch |

**Not in scope:** election results and campaign content (misinformation risk and usage-policy limits), single air crashes as spectacle, and any replay of a conflict less than 30 days old.

## Who it's for

- **The curious:** "What actually happened in Spain that day?"
- **Journalists, teachers and analysts:** a shareable, citable reconstruction.
- **Developers:** an open, hackable example of fusing real data on a 3D globe. Contributing an event is a pull request.

## Ship today, grow later

Today: three hero replays and the player. Next: flights, "type any event", in-browser bring-your-own-key Claude, video export, voice narration, community replays. See [PLAN.md](../PLAN.md).
