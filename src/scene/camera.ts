// Camera pose at scene time t, interpolated between director keyframes.
// Pure maths: no Cesium here, so it is unit-testable and engine-agnostic.
import type { Keyframe } from "./schema.ts";
import { ms } from "./schema.ts";

export interface CameraPose {
  lon: number;
  lat: number;
  range: number;
  heading: number;
  pitch: number;
}

const DEG = Math.PI / 180;

export function easeInOutCubic(u: number): number {
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

/** Shortest signed difference b - a in degrees, in (-180, 180]. */
export function angleDelta(a: number, b: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Central angle between two lon/lat points, radians. */
export function centralAngle(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = p2 - p1;
  const dl = (lon2 - lon1) * DEG;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point a fraction u along the great circle from (lon1,lat1) to (lon2,lat2). */
export function slerpLonLat(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  u: number,
): { lon: number; lat: number } {
  const d = centralAngle(lon1, lat1, lon2, lat2);
  if (d < 1e-9) return { lon: lon1, lat: lat1 };
  const a = Math.sin((1 - u) * d) / Math.sin(d);
  const b = Math.sin(u * d) / Math.sin(d);
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const l1 = lon1 * DEG;
  const l2 = lon2 * DEG;
  const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
  const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
  const z = a * Math.sin(p1) + b * Math.sin(p2);
  return { lon: Math.atan2(y, x) / DEG, lat: Math.atan2(z, Math.hypot(x, y)) / DEG };
}

const EARTH_RADIUS_M = 6_371_000;

/**
 * Pose between two keyframes. Range interpolates geometrically (zooms feel even),
 * and long hops rise in an arc so the camera "flies" instead of skimming the ground.
 */
export function interpolatePose(a: Keyframe, b: Keyframe, u: number): CameraPose {
  const e = easeInOutCubic(Math.min(1, Math.max(0, u)));
  const { lon, lat } = slerpLonLat(a.lon, a.lat, b.lon, b.lat, e);
  const groundDistance = centralAngle(a.lon, a.lat, b.lon, b.lat) * EARTH_RADIUS_M;
  const baseRange = a.range * (b.range / a.range) ** e;
  const arc =
    Math.max(0, groundDistance * 0.6 - Math.max(a.range, b.range)) * Math.sin(Math.PI * e);
  return {
    lon,
    lat,
    range: baseRange + arc,
    heading: a.heading + angleDelta(a.heading, b.heading) * e,
    pitch: a.pitch + (b.pitch - a.pitch) * e,
  };
}

function poseOf(k: Keyframe): CameraPose {
  return { lon: k.lon, lat: k.lat, range: k.range, heading: k.heading, pitch: k.pitch };
}

/** Camera pose at time t (epoch ms). Holds the first/last keyframe outside the range. */
export function cameraAt(t: number, keyframes: readonly Keyframe[]): CameraPose {
  const first = keyframes[0];
  if (!first) throw new Error("cameraAt: no keyframes");
  if (t <= ms(first.t)) return poseOf(first);
  for (let i = 1; i < keyframes.length; i++) {
    const b = keyframes[i];
    const a = keyframes[i - 1];
    if (!a || !b) continue;
    const tb = ms(b.t);
    if (t <= tb) {
      const ta = ms(a.t);
      return interpolatePose(a, b, (t - ta) / (tb - ta));
    }
  }
  const last = keyframes[keyframes.length - 1];
  return poseOf(last ?? first);
}
