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

/** Smooth ease for flights: gentle take-off and landing, no sudden jerk at either end. */
export function easeInOutSine(u: number): number {
  return -(Math.cos(Math.PI * u) - 1) / 2;
}

/**
 * Catmull-Rom (uniform) through p0..p3 at u ∈ [0, 1] between p1 and p2. The curve passes
 * through every keyframe with continuous speed, so a chain of glides never stops.
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

/**
 * A glide between b and c, using a and d (the neighbours) to keep speed continuous. A
 * neighbour reached by a flight is treated as a rest point (the camera has landed), which
 * makes the glide start or end smoothly from rest. Longitude and heading are unwrapped;
 * range moves in log space so push-ins feel even.
 */
export function glidePose(
  a: Keyframe | undefined,
  b: Keyframe,
  c: Keyframe,
  d: Keyframe | undefined,
  u: number,
): CameraPose {
  const prev = a && b.move === "glide" ? a : b;
  const next = d && d.move === "glide" ? d : c;
  const unwrapLon = (ref: number, x: number) => ref + angleDelta(ref, x);
  const lon0 = unwrapLon(b.lon, prev.lon);
  const lon2 = unwrapLon(b.lon, c.lon);
  const lon3 = unwrapLon(lon2, next.lon);
  const h0 = b.heading + angleDelta(b.heading, prev.heading);
  const h2 = b.heading + angleDelta(b.heading, c.heading);
  const h3 = h2 + angleDelta(h2, next.heading);
  let lon = catmullRom(lon0, b.lon, lon2, lon3, u);
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return {
    lon,
    lat: Math.max(-89.9, Math.min(89.9, catmullRom(prev.lat, b.lat, c.lat, next.lat, u))),
    range: Math.exp(
      catmullRom(
        Math.log(prev.range),
        Math.log(b.range),
        Math.log(c.range),
        Math.log(next.range),
        u,
      ),
    ),
    heading: catmullRom(h0, b.heading, h2, h3, u),
    pitch: Math.max(-90, Math.min(-5, catmullRom(prev.pitch, b.pitch, c.pitch, next.pitch, u))),
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
      const u = (t - ta) / (tb - ta);
      return b.move === "glide"
        ? glidePose(keyframes[i - 2], a, b, keyframes[i + 1], u)
        : interpolatePose(a, b, u);
    }
  }
  const last = keyframes[keyframes.length - 1];
  return poseOf(last ?? first);
}

export interface CinematicPose extends CameraPose {
  /** Camera roll in degrees (positive = horizon tilts clockwise). */
  roll: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * The director's pose plus what a camera operator adds: a slow handheld drift (sums of
 * sines with unrelated periods, so it never visibly repeats) and a bank into turns, from the
 * rate the heading changes. Both are driven by scene time only (one clock): pause the film
 * and the camera holds still. `drift` = 0 turns the drift off (reduced motion).
 */
export function cinematicPose(t: number, keyframes: readonly Keyframe[], drift = 1): CinematicPose {
  const pose = cameraAt(t, keyframes);
  const s = t / 1000;
  const wave = (a: number, b: number, c: number) =>
    Math.sin(s * a) * 0.6 + Math.sin(s * b + 1.3) * 0.3 + Math.sin(s * c + 4.1) * 0.1;
  // Heading rate over ±150 ms, degrees per second; banking follows it, capped at 5°.
  const dt = 150;
  const rate =
    angleDelta(cameraAt(t - dt, keyframes).heading, cameraAt(t + dt, keyframes).heading) /
    ((2 * dt) / 1000);
  return {
    ...pose,
    heading: pose.heading + drift * 0.45 * wave(0.21, 0.53, 1.37),
    pitch: clamp(pose.pitch + drift * 0.3 * wave(0.17, 0.41, 1.13), -90, -5),
    range: pose.range * (1 + drift * 0.006 * wave(0.11, 0.29, 0.83)),
    roll: clamp(rate * 0.35, -5, 5) + drift * 0.25 * wave(0.13, 0.37, 0.97),
  };
}

/**
 * Tilt-shift strength (0..1) for the lens: low, oblique shots near the ground get a shallow
 * depth of field (top and bottom of frame soften); wide and top-down shots stay sharp.
 */
export function tiltShift(pitch: number, range: number): number {
  const oblique = clamp((pitch + 62) / 24, 0, 1); // -62° → 0, -38° → 1
  const near = clamp((3_000_000 - range) / 2_000_000, 0, 1); // 3,000 km → 0, 1,000 km → 1
  return oblique * near;
}
