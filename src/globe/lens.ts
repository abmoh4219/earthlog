// The lens: one post-process pass that makes story films look shot, not rendered.
//   - tilt-shift: on low oblique shots the top and bottom of frame soften (a shallow depth
//     of field), so the eye lands on the subject in the middle band;
//   - a split tone: shadows lean teal, highlights stay neutral (the ice grade);
//   - a vignette and a fine film grain.
// One cheap pass (9 taps at most), no HDR tricks: unlike Cesium's bloom it can't corrupt
// the ocean, because it only blends colours that are already on screen.
import type * as CesiumNS from "cesium";

type Cesium = typeof CesiumNS;

export interface Lens {
  /** `tilt` 0..1 (see tiltShift in src/scene/camera.ts); `t` = scene time, for the grain. */
  update: (tilt: number, t: number) => void;
  destroy: () => void;
}

const SHADER = /* glsl */ `
uniform sampler2D colorTexture;
uniform float tilt;
uniform float grainSeed;
uniform vec2 texel;
in vec2 v_textureCoordinates;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_textureCoordinates;
  vec4 c = texture(colorTexture, uv);

  // Tilt-shift: blur grows with distance from the horizontal focus band.
  float band = smoothstep(0.2, 0.5, abs(uv.y - 0.5)) * tilt;
  if (band > 0.01) {
    vec2 r = texel * (1.0 + 3.5 * band);
    vec4 acc = c;
    acc += texture(colorTexture, uv + vec2(r.x, 0.0));
    acc += texture(colorTexture, uv - vec2(r.x, 0.0));
    acc += texture(colorTexture, uv + vec2(0.0, r.y));
    acc += texture(colorTexture, uv - vec2(0.0, r.y));
    acc += texture(colorTexture, uv + r);
    acc += texture(colorTexture, uv - r);
    acc += texture(colorTexture, uv + vec2(r.x, -r.y));
    acc += texture(colorTexture, uv + vec2(-r.x, r.y));
    c = mix(c, acc / 9.0, band);
  }

  // Split tone: teal in the shadows, fading out by the mid-tones.
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(c.rgb * vec3(0.9, 1.0, 1.08), c.rgb, smoothstep(0.0, 0.45, lum));

  // Vignette: the frame's corners fall off by about a third.
  vec2 d = uv - 0.5;
  d.x *= texel.y / texel.x;
  // (smoothstep needs edge0 < edge1, so invert it rather than swapping the edges.)
  float v = 1.0 - smoothstep(0.25, 0.95, length(d) * 0.9);
  c.rgb *= mix(0.66, 1.0, v);

  // Grain: fine and faint, re-seeded on the scene clock.
  float g = hash(uv / texel + grainSeed) - 0.5;
  c.rgb += g * 0.022;

  out_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}
`;

export function createLens(C: Cesium, scene: CesiumNS.Scene): Lens {
  const state = { tilt: 0, seed: 0 };
  const texel = new C.Cartesian2();
  const stage = scene.postProcessStages.add(
    new C.PostProcessStage({
      name: "earthlog_lens",
      fragmentShader: SHADER,
      uniforms: {
        tilt: () => state.tilt,
        grainSeed: () => state.seed,
        texel: () => {
          texel.x = 1 / Math.max(1, scene.drawingBufferWidth);
          texel.y = 1 / Math.max(1, scene.drawingBufferHeight);
          return texel;
        },
      },
    }),
  );
  return {
    update: (tilt, t) => {
      state.tilt = tilt;
      // 24 grain frames a second, like film, tied to scene time.
      state.seed = Math.floor(t / 41.7) % 997;
    },
    destroy: () => {
      if (!stage.isDestroyed()) scene.postProcessStages.remove(stage);
    },
  };
}
