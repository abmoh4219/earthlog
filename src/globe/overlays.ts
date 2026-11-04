// Data overlays drawn on the globe: borders, country names, the signal tint and quake
// pulses. Built once with batched primitives (not thousands of Entities), then restyled
// every frame from the player clock through the pure functions in src/scene/layers.ts.
import type * as CesiumNS from "cesium";
import { countryName } from "@/scene/geo";
import { heldSample, quakeLook, smoothRatio, stormAt, tintAlpha } from "@/scene/layers";
import { categoryByKey } from "@/scene/news";
import type {
  ArcsLayer,
  Country,
  LayerData,
  LayerRef,
  NewsLayer,
  PlacesLayer,
  QuakeLayer,
  SignalLayer,
  StormLayer,
} from "@/scene/schema";
import { ms } from "@/scene/schema";

type Cesium = typeof CesiumNS;

export interface Overlays {
  /** `active`: evidence IDs cited by the caption on screen, to highlight their stories. */
  update: (t: number, opts: { labels: boolean; active: ReadonlySet<string> }) => void;
  destroy: () => void;
}

/** Brand colours from globals.css, as Cesium colours. */
const TONE = { loss: "#ff4d5e", attention: "#5ef2ff" } as const;
const ICE = "#9ad9ff";
const ENERGY = "#ffb547";

// Small heights lift lines and fills off the ellipsoid so they never z-fight the imagery.
const LINE_HEIGHT = 1_500;
const FILL_HEIGHT = 1_000;

export function createOverlays(
  C: Cesium,
  scene: CesiumNS.Scene,
  countries: Country[],
  layers: LayerData[],
  refs: LayerRef[] = [],
): Overlays {
  const signal = layers.find((l): l is SignalLayer => l.kind === "outages");
  const quakes = layers.find((l): l is QuakeLayer => l.kind === "quakes");
  const tracked = new Set(signal?.series.map((s) => s.code) ?? []);
  const tone = C.Color.fromCssColorString(signal ? TONE[signal.tone] : TONE.loss);
  const ice = C.Color.fromCssColorString(ICE);

  const ringPositions = (ring: number[], height: number) => {
    const withHeights: number[] = [];
    for (let i = 0; i + 1 < ring.length; i += 2) {
      withHeights.push(ring[i] ?? 0, ring[i + 1] ?? 0, height);
    }
    return C.Cartesian3.fromDegreesArrayHeights(withHeights);
  };

  // 1. Every border, hairline and faint: context, not decoration.
  const borders = scene.primitives.add(
    new C.Primitive({
      geometryInstances: countries.flatMap((c) =>
        c.rings.map(
          (ring) =>
            new C.GeometryInstance({
              geometry: new C.SimplePolylineGeometry({
                positions: ringPositions(ring, LINE_HEIGHT),
                arcType: C.ArcType.GEODESIC,
              }),
              attributes: {
                color: C.ColorGeometryInstanceAttribute.fromColor(
                  ice.withAlpha(tracked.has(c.code) ? 0.55 : 0.18),
                ),
              },
            }),
        ),
      ),
      appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
      asynchronous: false,
    }),
  );

  // 2. Fills for countries with a signal; colour is updated per frame.
  const tracking = countries.filter((c) => tracked.has(c.code));
  const fills = tracking.length
    ? scene.primitives.add(
        new C.Primitive({
          geometryInstances: tracking.flatMap((c) =>
            c.rings.map(
              (ring, i) =>
                new C.GeometryInstance({
                  id: `${c.code}:${i}`,
                  geometry: new C.PolygonGeometry({
                    polygonHierarchy: new C.PolygonHierarchy(ringPositions(ring, 0)),
                    height: FILL_HEIGHT,
                    vertexFormat: C.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
                  }),
                  attributes: {
                    color: C.ColorGeometryInstanceAttribute.fromColor(C.Color.TRANSPARENT),
                  },
                }),
            ),
          ),
          appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
          asynchronous: false,
        }),
      )
    : undefined;

  // 3. Country names; tracked countries also show their live reading.
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const labels = scene.primitives.add(new C.LabelCollection());
  const labelOf = new Map<string, CesiumNS.Label>();
  for (const c of countries) {
    const isTracked = tracked.has(c.code);
    const label = labels.add({
      position: C.Cartesian3.fromDegrees(c.label[0], c.label[1], 20_000),
      text: countryName(c).toUpperCase(),
      font: `${isTracked ? 600 : 500} ${isTracked ? 15 : 11}px ${font}`,
      fillColor: isTracked ? C.Color.WHITE : ice.withAlpha(0.6),
      outlineColor: C.Color.BLACK.withAlpha(0.85),
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: C.HorizontalOrigin.CENTER,
      verticalOrigin: C.VerticalOrigin.CENTER,
      // Names fade as the camera pulls out, so the planet view stays clean.
      translucencyByDistance: isTracked
        ? new C.NearFarScalar(2e6, 1, 2.5e7, 0.35)
        : new C.NearFarScalar(1.5e6, 1, 9e6, 0),
      scaleByDistance: new C.NearFarScalar(1e6, 1.1, 1.2e7, 0.75),
    });
    labelOf.set(c.code, label);
  }

  // 4. Quakes: a core dot that stays, and a shock ring that bursts out and fades.
  const points = scene.primitives.add(new C.PointPrimitiveCollection());
  const energy = C.Color.fromCssColorString(ENERGY);
  const quakePoints = (quakes?.quakes ?? []).map((q) => {
    const position = C.Cartesian3.fromDegrees(q.lon, q.lat, 5_000);
    const ring = points.add({
      position,
      color: C.Color.TRANSPARENT,
      outlineColor: energy,
      outlineWidth: 2,
      show: false,
    });
    const core = points.add({
      position,
      color: energy,
      outlineColor: C.Color.WHITE.withAlpha(0.9),
      outlineWidth: 1.5,
      show: false,
    });
    return { q, ring, core };
  });

  // 5. News pins: every story of the day, coloured by category. The story being told
  //    gets a pulse and its place name. The pulse follows the scene clock (one clock).
  const news = layers.find((l): l is NewsLayer => l.kind === "news");
  const pins = (news?.stories ?? []).flatMap((story) => {
    if (!story.place) return [];
    const color = C.Color.fromCssColorString(categoryByKey(story.category).color);
    const position = C.Cartesian3.fromDegrees(story.place.lon, story.place.lat, 6_000);
    const pulse = points.add({
      position,
      color: C.Color.TRANSPARENT,
      outlineColor: color,
      outlineWidth: 2,
      show: false,
    });
    const dot = points.add({
      position,
      pixelSize: 9,
      color,
      outlineColor: C.Color.BLACK.withAlpha(0.7),
      outlineWidth: 1.5,
    });
    const name = labels.add({
      position,
      text: story.place.name.toUpperCase(),
      font: `600 13px ${font}`,
      fillColor: color,
      outlineColor: C.Color.BLACK.withAlpha(0.9),
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      pixelOffset: new C.Cartesian2(0, -14),
      show: false,
    });
    return [{ story, color, pulse, dot, name }];
  });

  // 6. Storms: the whole track faint, the stretch already travelled bright, and the storm
  //    itself moving between 6-hourly fixes (interpolated, and the panel says so).
  const storms = layers.find((l): l is StormLayer => l.kind === "storms");
  const stormLines = scene.primitives.add(new C.PolylineCollection());
  const stormMarks = (storms?.storms ?? []).map((storm) => {
    const all = storm.track.map((f) => C.Cartesian3.fromDegrees(f.lon, f.lat, 8_000));
    stormLines.add({
      positions: all,
      width: 1.5,
      material: C.Material.fromType("Color", { color: energy.withAlpha(0.25) }),
    });
    const travelled = stormLines.add({
      positions: all.slice(0, 1),
      width: 2.5,
      material: C.Material.fromType("Color", { color: energy.withAlpha(0.85) }),
    });
    // Positions are set every frame; start anywhere on the track.
    const start = all[0] ?? C.Cartesian3.ZERO;
    const eye = points.add({
      position: start,
      pixelSize: 14,
      color: C.Color.WHITE.withAlpha(0.9),
      outlineColor: energy,
      outlineWidth: 3,
      show: false,
    });
    const label = labels.add({
      position: start,
      text: storm.name.toUpperCase(),
      font: `600 12px ${font}`,
      fillColor: energy,
      outlineColor: C.Color.BLACK.withAlpha(0.9),
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      pixelOffset: new C.Cartesian2(0, -16),
      show: false,
    });
    return { storm, all, travelled, eye, label, shown: -1 };
  });

  // ── Story-film layers: revealed chapter by chapter (LayerRef.from/until). ──
  const span = (kind: LayerData["kind"]) => {
    const ref = refs.find((r) => r.kind === kind);
    return {
      from: ref?.from ? ms(ref.from) : Number.NEGATIVE_INFINITY,
      until: ref?.until ? ms(ref.until) : Number.POSITIVE_INFINITY,
    };
  };
  /** 0 before the layer's reveal, easing to 1 over a second of scene time. */
  const reveal = (kind: LayerData["kind"], t: number) => {
    const { from, until } = span(kind);
    if (t < from || t >= until) return 0;
    return from === Number.NEGATIVE_INFINITY ? 1 : Math.min(1, (t - from) / 1200);
  };

  // 7. Places: pins with names; the primary one pulses.
  const placesLayer = layers.find((l): l is PlacesLayer => l.kind === "places");
  const placeMarks = (placesLayer?.places ?? []).map((p) => {
    const color = C.Color.fromCssColorString(p.color ?? ICE);
    const position = C.Cartesian3.fromDegrees(p.lon, p.lat, 6_000);
    const ring = p.primary
      ? points.add({
          position,
          color: C.Color.TRANSPARENT,
          outlineColor: color,
          outlineWidth: 2,
          show: false,
        })
      : undefined;
    const dot = points.add({
      position,
      pixelSize: p.primary ? 13 : 9,
      color,
      outlineColor: C.Color.BLACK.withAlpha(0.7),
      outlineWidth: 1.5,
      show: false,
    });
    const name = labels.add({
      position,
      text: p.name.toUpperCase(),
      font: `600 ${p.primary ? 14 : 12}px ${font}`,
      fillColor: p.primary ? C.Color.WHITE : color,
      outlineColor: C.Color.BLACK.withAlpha(0.9),
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      pixelOffset: new C.Cartesian2(0, -14),
      // Secondary names fade out in wide shots, where neighbours' labels would pile up.
      ...(p.primary ? {} : { translucencyByDistance: new C.NearFarScalar(2.5e6, 1, 6e6, 0) }),
      show: false,
    });
    return { color, ring, dot, name, quiet: p.quiet === true };
  });

  // 8. Arcs: great circles lifted off the surface, drawn in from start to end.
  const arcsLayer = layers.find((l): l is ArcsLayer => l.kind === "arcs");
  const arcLines = scene.primitives.add(new C.PolylineCollection());
  const ARC_STEPS = 64;
  const ARC_LEG_MS = 1400;
  const arcs = (arcsLayer?.arcs ?? []).map((a) => {
    const geo = new C.EllipsoidGeodesic(
      C.Cartographic.fromDegrees(a.from[0], a.from[1]),
      C.Cartographic.fromDegrees(a.to[0], a.to[1]),
    );
    const lift = Math.min(1.2e6, geo.surfaceDistance * 0.18);
    const full = Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
      const f = i / ARC_STEPS;
      const c = geo.interpolateUsingFraction(f);
      return C.Cartesian3.fromRadians(
        c.longitude,
        c.latitude,
        8_000 + Math.sin(Math.PI * f) * lift,
      );
    });
    const color = C.Color.fromCssColorString(a.color ?? ICE);
    const line = arcLines.add({
      positions: full.slice(0, 2),
      width: 2,
      material: C.Material.fromType("Color", { color: color.withAlpha(0.85) }),
      show: false,
    });
    return { full, line, drawn: -1 };
  });

  // 9. Regions: one or more filled maps (e.g. Senate states, House districts), each with thin
  //    outlines, revealed and hidden by its own LayerRef, fading over a second of scene time.
  const regionMaps = layers.flatMap((l, index) => {
    if (l.kind !== "regions" || l.regions.length === 0) return [];
    const ref = refs[index];
    const from = ref?.from ? ms(ref.from) : Number.NEGATIVE_INFINITY;
    const until = ref?.until ? ms(ref.until) : Number.POSITIVE_INFINITY;
    const fill = scene.primitives.add(
      new C.Primitive({
        geometryInstances: l.regions.flatMap((r) =>
          r.rings.map(
            (ring, i) =>
              new C.GeometryInstance({
                id: `region:${index}:${r.id}:${i}`,
                geometry: new C.PolygonGeometry({
                  polygonHierarchy: new C.PolygonHierarchy(ringPositions(ring, 0)),
                  height: FILL_HEIGHT + 200 + index * 50,
                  vertexFormat: C.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
                }),
                attributes: {
                  color: C.ColorGeometryInstanceAttribute.fromColor(C.Color.TRANSPARENT),
                },
              }),
          ),
        ),
        appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
        asynchronous: false,
      }),
    );
    const outline = scene.primitives.add(
      new C.Primitive({
        geometryInstances: l.regions.flatMap((r) =>
          r.rings.map(
            (ring) =>
              new C.GeometryInstance({
                geometry: new C.SimplePolylineGeometry({
                  positions: ringPositions(
                    [...ring, ring[0] ?? 0, ring[1] ?? 0],
                    LINE_HEIGHT + 300,
                  ),
                  arcType: C.ArcType.GEODESIC,
                }),
                attributes: {
                  color: C.ColorGeometryInstanceAttribute.fromColor(C.Color.WHITE.withAlpha(0.28)),
                },
              }),
          ),
        ),
        appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
        asynchronous: false,
        show: false,
      }),
    );
    const colors = l.regions.map((r) => ({
      id: r.id,
      color: C.Color.fromCssColorString(r.color),
      opacity: r.opacity,
      rings: r.rings.length,
      pulse: r.pulse === true,
    }));
    return [{ index, from, until, fill, outline, colors, alpha: -1 }];
  });

  const scratch = new C.Color();
  const lastText = new Map<string, string>();

  return {
    update: (t, { labels: showLabels, active }) => {
      labels.show = showLabels;
      // A slow heartbeat in scene time: one beat every 40 scene-minutes.
      const beat = ((t / 60_000) % 40) / 40;
      for (const pin of pins) {
        const on = active.has(pin.story.evidence);
        pin.pulse.show = on;
        pin.name.show = on;
        pin.dot.pixelSize = on ? 12 : 8;
        if (on) {
          pin.pulse.pixelSize = 12 + beat * 46;
          pin.pulse.outlineColor = pin.color.withAlpha(1 - beat, scratch);
        }
      }
      // Story-film layers.
      const pv = reveal("places", t);
      for (const m of placeMarks) {
        m.dot.show = pv > 0;
        m.name.show = pv > 0 && showLabels && !m.quiet;
        if (pv > 0) m.dot.color = m.color.withAlpha(pv, m.dot.color);
        if (m.ring) {
          m.ring.show = pv > 0;
          m.ring.pixelSize = 14 + beat * 44;
          m.ring.outlineColor = m.color.withAlpha((1 - beat) * pv, scratch);
        }
      }
      const av = reveal("arcs", t);
      const sinceArcs = t - span("arcs").from;
      arcs.forEach((a, i) => {
        // A journey draws leg by leg (1.4 s each on the scene clock); otherwise all together.
        const progress = arcsLayer?.sequence
          ? av > 0
            ? Math.min(1, Math.max(0, (sinceArcs - i * ARC_LEG_MS) / ARC_LEG_MS))
            : 0
          : av;
        const n = Math.max(2, Math.round(progress * ARC_STEPS) + 1);
        a.line.show = progress > 0;
        if (progress > 0 && n !== a.drawn) {
          a.line.positions = a.full.slice(0, n);
          a.drawn = n;
        }
      });
      for (const map of regionMaps) {
        const inside = t >= map.from && t < map.until;
        const rv = !inside
          ? 0
          : map.from === Number.NEGATIVE_INFINITY
            ? 1
            : Math.min(1, (t - map.from) / 1200);
        map.outline.show = rv > 0;
        if (!map.fill.ready) continue;
        // Pulsing regions breathe on the scene clock (1.6 s per breath in story time), so
        // they freeze when paused like everything else (one clock).
        const breath = 0.72 + 0.28 * Math.cos(((t % 1600) / 1600) * Math.PI * 2);
        const pulsing = rv > 0 && map.colors.some((r) => r.pulse);
        if (rv === map.alpha && !pulsing) continue;
        for (const r of map.colors) {
          if (rv === map.alpha && !r.pulse) continue;
          const alpha = r.opacity * rv * (r.pulse ? breath + 0.15 : 1);
          const value = C.ColorGeometryInstanceAttribute.toValue(
            C.Color.clone(r.color, scratch).withAlpha(Math.min(1, alpha), scratch),
          );
          for (let i = 0; i < r.rings; i++) {
            const attrs = map.fill.getGeometryInstanceAttributes(
              `region:${map.index}:${r.id}:${i}`,
            );
            if (attrs) attrs.color = value;
          }
        }
        map.alpha = rv;
      }

      for (const m of stormMarks) {
        const at = stormAt(m.storm, t);
        m.eye.show = at !== null;
        m.label.show = at !== null;
        if (!at) continue;
        const pos = C.Cartesian3.fromDegrees(at.lon, at.lat, 8_000);
        m.eye.position = pos;
        m.label.position = pos;
        // Rebuild the bright trail only when a new fix is passed.
        if (at.passed !== m.shown) {
          m.travelled.positions = [...m.all.slice(0, at.passed + 1), pos];
          m.shown = at.passed;
        }
      }
      if (signal && fills?.ready) {
        for (const s of signal.series) {
          const alpha = tintAlpha(smoothRatio(s, t));
          const value = C.ColorGeometryInstanceAttribute.toValue(
            C.Color.clone(tone, scratch).withAlpha(alpha, scratch),
          );
          const country = countries.find((c) => c.code === s.code);
          country?.rings.forEach((_, i) => {
            const attrs = fills.getGeometryInstanceAttributes(`${s.code}:${i}`);
            if (attrs) attrs.color = value;
          });
          // The label carries the measured (held) value, never the interpolated one.
          const held = heldSample(s, t);
          const name = country?.name.toUpperCase() ?? s.name;
          const text = held ? `${name}  ${Math.round(held.ratio * 100)}%` : `${name}  no data`;
          if (lastText.get(s.code) !== text) {
            const label = labelOf.get(s.code);
            if (label) label.text = text;
            lastText.set(s.code, text);
          }
        }
      }
      for (const { q, ring, core } of quakePoints) {
        const look = quakeLook(q, t);
        core.show = look !== null;
        ring.show = look !== null && look.ringAlpha > 0;
        if (!look) continue;
        core.pixelSize = look.core;
        ring.pixelSize = look.ring;
        ring.outlineColor = energy.withAlpha(look.ringAlpha, scratch);
      }
    },
    destroy: () => {
      for (const p of [
        borders,
        fills,
        labels,
        points,
        stormLines,
        arcLines,
        ...regionMaps.flatMap((m) => [m.fill, m.outline]),
      ]) {
        if (p && !p.isDestroyed()) scene.primitives.remove(p);
      }
    },
  };
}
