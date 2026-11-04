// Data overlays drawn on the globe: borders, country names, the signal tint and quake
// pulses. Built once with batched primitives (not thousands of Entities), then restyled
// every frame from the player clock through the pure functions in src/scene/layers.ts.
import type * as CesiumNS from "cesium";
import { heldSample, quakeLook, smoothRatio, tintAlpha } from "@/scene/layers";
import type { Country, LayerData, QuakeLayer, SignalLayer } from "@/scene/schema";

type Cesium = typeof CesiumNS;

export interface Overlays {
  update: (t: number, opts: { labels: boolean }) => void;
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
      text: c.name.toUpperCase(),
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

  const scratch = new C.Color();
  const lastText = new Map<string, string>();

  return {
    update: (t, { labels: showLabels }) => {
      labels.show = showLabels;
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
      for (const p of [borders, fills, labels, points]) {
        if (p && !p.isDestroyed()) scene.primitives.remove(p);
      }
    },
  };
}
