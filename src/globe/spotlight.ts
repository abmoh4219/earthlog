// The spotlight: what a story film draws on the globe to point at its subject.
//   - the focus country's outline traced like a pen, then breathing, over a faint fill;
//   - radar rings pulsing out from the focus point, and a radar sweep turning around it;
//   - a faint latitude/longitude grid that fades out as the camera dives in.
// Everything is driven by the scene clock (one clock), so it pauses and scrubs with the film.
import type * as CesiumNS from "cesium";
import type { Country, Scene } from "@/scene/schema";

type Cesium = typeof CesiumNS;

export interface Spotlight {
  update: (t: number) => void;
  destroy: () => void;
}

const ACCENT = "#5ef2ff";
const TRACE_START_MS = 2500;
const TRACE_MS = 3200;
const RING_PERIOD_MS = 3400;
const RING_MAX_M = 520_000;

export function createSpotlight(
  C: Cesium,
  scene: CesiumNS.Scene,
  countries: Country[],
  spotlight: NonNullable<Scene["spotlight"]>,
  start: number,
): Spotlight {
  const accent = C.Color.fromCssColorString(ACCENT);
  const lines = scene.primitives.add(new C.PolylineCollection());

  // 1. The country, traced. Rings are densified so the pen moves at an even speed.
  const country = spotlight.country
    ? countries.find((c) => c.code === spotlight.country)
    : undefined;
  const traces = (country?.rings ?? [])
    .filter((r) => r.length >= 8)
    .map((ring) => {
      const pts: CesiumNS.Cartesian3[] = [];
      for (let i = 0; i + 1 < ring.length; i += 2)
        pts.push(C.Cartesian3.fromDegrees(ring[i] ?? 0, ring[i + 1] ?? 0, 3_000));
      pts.push(pts[0] ?? C.Cartesian3.ZERO);
      const line = lines.add({
        positions: pts.slice(0, 2),
        width: 5,
        material: C.Material.fromType("PolylineGlow", {
          color: accent.withAlpha(0.95),
          glowPower: 0.25,
          taperPower: 1,
        }),
        show: false,
      });
      return { pts, line, drawn: -1 };
    });
  const fill = country
    ? scene.primitives.add(
        new C.Primitive({
          geometryInstances: country.rings.map(
            (ring) =>
              new C.GeometryInstance({
                geometry: new C.PolygonGeometry({
                  polygonHierarchy: new C.PolygonHierarchy(
                    C.Cartesian3.fromDegreesArray(ring.slice(0, ring.length - (ring.length % 2))),
                  ),
                  height: 1_400,
                  vertexFormat: C.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
                }),
                attributes: {
                  color: C.ColorGeometryInstanceAttribute.fromColor(accent.withAlpha(0.1)),
                },
              }),
          ),
          appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
          asynchronous: false,
          show: false,
        }),
      )
    : undefined;

  // 2. Radar rings around the focus point.
  const center = C.Cartographic.fromDegrees(spotlight.lon, spotlight.lat);
  const ellipsoid = C.Ellipsoid.WGS84;
  /** The point `radius` metres from the focus along `bearing` (radians), on a great circle. */
  const dest = (bearing: number, radius: number, height = 4_000) => {
    const d = radius / 6_371_000;
    const lat1 = center.latitude;
    const lon1 = center.longitude;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );
    return ellipsoid.cartographicToCartesian(new C.Cartographic(lon2, lat2, height));
  };
  const circle = (radius: number) =>
    Array.from({ length: 73 }, (_, k) => dest((k / 72) * Math.PI * 2, radius));

  // 2b. A radar sweep: a bright beam turning around the focus, trailed by fading echoes.
  const SWEEP_MS = 5200;
  const SWEEP_TRAIL = 10;
  const sweep = Array.from({ length: SWEEP_TRAIL }, (_, k) =>
    lines.add({
      positions: [dest(0, 0, 5_000), dest(0, RING_MAX_M, 5_000)],
      width: k === 0 ? 3 : 2,
      material: C.Material.fromType("Color", { color: accent.withAlpha(0) }),
      show: false,
    }),
  );
  const hub = dest(0, 0, 5_000);
  const rings = [0, 1, 2].map(() =>
    lines.add({
      positions: circle(1_000),
      width: 2,
      material: C.Material.fromType("Color", { color: accent.withAlpha(0) }),
      show: false,
    }),
  );

  // 3. A faint graticule every 15°.
  const grid = scene.primitives.add(
    new C.Primitive({
      geometryInstances: [
        ...Array.from({ length: 24 }, (_, i) => {
          const lon = -180 + i * 15;
          const pts: number[] = [];
          for (let lat = -80; lat <= 80; lat += 4) pts.push(lon, lat);
          return pts;
        }),
        ...Array.from({ length: 11 }, (_, i) => {
          const lat = -75 + i * 15;
          const pts: number[] = [];
          for (let lon = -180; lon <= 180; lon += 4) pts.push(lon, lat);
          return pts;
        }),
      ].map(
        (pts) =>
          new C.GeometryInstance({
            geometry: new C.SimplePolylineGeometry({
              positions: C.Cartesian3.fromDegreesArray(pts),
              arcType: C.ArcType.GEODESIC,
            }),
            attributes: {
              color: C.ColorGeometryInstanceAttribute.fromColor(accent.withAlpha(0.07)),
            },
          }),
      ),
      appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
      asynchronous: false,
    }),
  );

  const scratch = new C.Color();
  return {
    update: (t) => {
      const since = t - start - TRACE_START_MS;
      // The pen: each ring drawn over TRACE_MS, then the outline breathes.
      const progress = Math.min(1, Math.max(0, since / TRACE_MS));
      const breathe = 0.65 + 0.3 * Math.sin(((t % 2800) / 2800) * Math.PI * 2);
      for (const tr of traces) {
        const n = Math.max(2, Math.round(progress * (tr.pts.length - 1)) + 1);
        tr.line.show = progress > 0;
        if (progress > 0 && n !== tr.drawn) {
          tr.line.positions = tr.pts.slice(0, n);
          tr.drawn = n;
        }
        if (progress >= 1) tr.line.material.uniforms.color = accent.withAlpha(breathe, scratch);
      }
      if (fill) fill.show = progress >= 1;

      // Rings start with the trace and repeat; each grows and fades.
      rings.forEach((ring, i) => {
        const phase = since - (i * RING_PERIOD_MS) / 3;
        ring.show = since > 0;
        if (since <= 0) return;
        const u = (((phase % RING_PERIOD_MS) + RING_PERIOD_MS) % RING_PERIOD_MS) / RING_PERIOD_MS;
        ring.positions = circle(20_000 + u * RING_MAX_M);
        ring.material.uniforms.color = accent.withAlpha((1 - u) * 0.8, scratch);
      });

      // The sweep turns once every SWEEP_MS, echoes lagging 2.5° each.
      sweep.forEach((beam, k) => {
        beam.show = since > 0;
        if (since <= 0) return;
        const bearing = ((since / SWEEP_MS) % 1) * Math.PI * 2 - k * 0.044;
        beam.positions = [hub, dest(bearing, RING_MAX_M, 5_000)];
        const fadeIn = Math.min(1, since / 1200);
        beam.material.uniforms.color = accent.withAlpha(
          fadeIn * (k === 0 ? 0.85 : 0.32 * (1 - k / SWEEP_TRAIL)),
          scratch,
        );
      });

      // The grid is for the wide view: fade it away below ~3,000 km.
      const height = scene.camera.positionCartographic.height;
      grid.show = height > 2_500_000;
    },
    destroy: () => {
      for (const p of [lines, fill, grid]) if (p && !p.isDestroyed()) scene.primitives.remove(p);
    },
  };
}
