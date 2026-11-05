// The front-page globe: the latest edition's stories as columns of light on the planet,
// coloured by lens and as tall as their heat. The camera falls from orbit onto the edition
// (the intro), drifts slowly while idle, and flies to a story when it is chosen.
// Separate from the film engine on purpose: no scene clock, no evidence, no layers to time.
import type * as CesiumNS from "cesium";
import { BLUE_MARBLE_RELIEF, gibsTemplate, STATIC_DATES } from "./gibs";

export interface FrontStory {
  slug: string;
  title: string;
  color: string;
  heat: number;
  lon: number;
  lat: number;
}

export interface FrontGlobe {
  /** Fly to a story (or back to the whole edition with undefined). */
  focus: (slug: string | undefined) => void;
  destroy: () => void;
}

const DEG = Math.PI / 180;

export async function createFrontGlobe(
  container: HTMLElement,
  creditContainer: HTMLElement,
  stories: FrontStory[],
  onPick: (slug: string) => void,
  /** In a scrolling page the wheel must scroll the page, not zoom the globe. */
  /** zoom: wheel zooms the globe. hero: a floating globe for a page (no stars, closer, no names). */
  options: { zoom?: boolean; hero?: boolean } = {},
): Promise<FrontGlobe> {
  window.CESIUM_BASE_URL = "/cesium/";
  const C = await import("cesium");

  const base = new C.ImageryLayer(
    new C.UrlTemplateImageryProvider({
      url: gibsTemplate(BLUE_MARBLE_RELIEF, STATIC_DATES.blueMarble),
      maximumLevel: BLUE_MARBLE_RELIEF.maxLevel,
      credit: new C.Credit(`${BLUE_MARBLE_RELIEF.credit} · NASA GIBS`),
    }),
  );
  // The same ice grade as the story films.
  base.brightness = 0.9;
  base.contrast = 1.06;
  base.saturation = 0.74;
  const widget = new C.CesiumWidget(container, {
    baseLayer: base,
    skyAtmosphere: new C.SkyAtmosphere(),
    creditContainer,
    scene3DOnly: true,
    msaaSamples: 4,
    showRenderLoopErrors: false,
    // In a page, the globe floats on the page's own background: no starfield, a clear canvas.
    ...(options.hero ? { skyBox: false as const, contextOptions: { webgl: { alpha: true } } } : {}),
  });
  const s = widget.scene;
  s.backgroundColor = options.hero ? C.Color.TRANSPARENT : C.Color.BLACK;
  s.globe.baseColor = C.Color.BLACK;
  s.globe.showGroundAtmosphere = true;
  s.screenSpaceCameraController.minimumZoomDistance = 1_500_000;
  if (options.zoom === false) {
    s.screenSpaceCameraController.enableZoom = false;
    s.screenSpaceCameraController.enableTilt = false;
  }

  // Columns of light: height from heat (log), a bright dot at the foot, a name that shows on
  // focus (and for the three hottest).
  const lines = s.primitives.add(new C.PolylineCollection());
  const points = s.primitives.add(new C.PointPrimitiveCollection());
  const labels = s.primitives.add(new C.LabelCollection());
  const maxHeat = Math.max(1, ...stories.map((st) => st.heat));
  const ranked = [...stories].sort((a, b) => b.heat - a.heat).map((st) => st.slug);
  const marks = stories.map((st) => {
    const color = C.Color.fromCssColorString(st.color);
    const h = 250_000 + (Math.log1p(st.heat) / Math.log1p(maxHeat)) * 1_650_000;
    const line = lines.add({
      id: st.slug,
      positions: [
        C.Cartesian3.fromDegrees(st.lon, st.lat, 0),
        C.Cartesian3.fromDegrees(st.lon, st.lat, h),
      ],
      width: 10,
      material: C.Material.fromType("PolylineGlow", {
        color: color.withAlpha(0.85),
        glowPower: 0.28,
        taperPower: 0.4,
      }),
    });
    const dot = points.add({
      id: st.slug,
      position: C.Cartesian3.fromDegrees(st.lon, st.lat, 8_000),
      pixelSize: 9,
      color,
      outlineColor: C.Color.BLACK.withAlpha(0.6),
      outlineWidth: 1.5,
    });
    const label = labels.add({
      position: C.Cartesian3.fromDegrees(st.lon, st.lat, h + 60_000),
      text: st.title.length > 46 ? `${st.title.slice(0, 44)}…` : st.title,
      font: "600 13px Geist, system-ui, sans-serif",
      fillColor: C.Color.WHITE,
      outlineColor: C.Color.BLACK.withAlpha(0.9),
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      // Narrow screens: names only on focus (three would pile up on a small globe).
      show: !options.hero && container.clientWidth >= 640 && ranked.indexOf(st.slug) < 3,
    });
    return { st, color, line, dot, label, tint: new C.Color() };
  });

  // The intro: from deep space down onto the edition's centre of gravity.
  let x = 0;
  let y = 0;
  let z = 0;
  for (const st of stories) {
    x += Math.cos(st.lat * DEG) * Math.cos(st.lon * DEG);
    y += Math.cos(st.lat * DEG) * Math.sin(st.lon * DEG);
    z += Math.sin(st.lat * DEG);
  }
  const home = {
    lon: stories.length ? Math.atan2(y, x) / DEG : 10,
    lat: stories.length ? Math.max(-30, Math.min(40, Math.atan2(z, Math.hypot(x, y)) / DEG)) : 20,
  };
  s.camera.setView({ destination: C.Cartesian3.fromDegrees(home.lon + 70, home.lat, 9e7) });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  s.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(home.lon, home.lat - 6, options.hero ? 1.15e7 : 2.3e7),
    duration: reduce ? 0 : 4.5,
    easingFunction: C.EasingFunction.QUINTIC_OUT,
  });

  // Idle drift (slow spin) until the visitor touches the globe or a story is focused.
  let focused: string | undefined;
  let touchedAt = 0;
  const handler = new C.ScreenSpaceEventHandler(s.canvas);
  for (const type of [
    C.ScreenSpaceEventType.LEFT_DOWN,
    C.ScreenSpaceEventType.WHEEL,
    C.ScreenSpaceEventType.PINCH_START,
  ])
    handler.setInputAction(() => {
      touchedAt = performance.now();
    }, type);
  handler.setInputAction((e: { position: CesiumNS.Cartesian2 }) => {
    const hit = s.pick(e.position) as { id?: unknown } | undefined;
    if (typeof hit?.id === "string") onPick(hit.id);
  }, C.ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction((e: { endPosition: CesiumNS.Cartesian2 }) => {
    const hit = s.pick(e.endPosition) as { id?: unknown } | undefined;
    s.canvas.style.cursor = typeof hit?.id === "string" ? "pointer" : "";
  }, C.ScreenSpaceEventType.MOUSE_MOVE);

  const remove = s.preRender.addEventListener(() => {
    const now = performance.now();
    if (!reduce && !focused && now - touchedAt > 8000)
      s.camera.rotate(C.Cartesian3.UNIT_Z, 0.00045);
    const breathe = 0.65 + 0.3 * Math.sin((now / 2600) * Math.PI * 2);
    for (const m of marks) {
      const on = focused === m.st.slug;
      m.line.width = on ? 16 : 10;
      m.line.material.uniforms.color = m.color.withAlpha(on ? 1 : focused ? 0.35 : breathe, m.tint);
      m.dot.pixelSize = on ? 14 : 9;
      if (focused) m.label.show = on;
    }
  });

  return {
    focus: (slug) => {
      focused = slug;
      const m = marks.find((k) => k.st.slug === slug);
      if (!slug)
        for (const k of marks)
          k.label.show =
            !options.hero && container.clientWidth >= 640 && ranked.indexOf(k.st.slug) < 3;
      const target = m
        ? C.Cartesian3.fromDegrees(m.st.lon, m.st.lat - 14, 9e6)
        : C.Cartesian3.fromDegrees(home.lon, home.lat - 6, 2.3e7);
      s.camera.flyTo({
        destination: target,
        orientation: { heading: 0, pitch: (m ? -62 : -90) * DEG, roll: 0 },
        duration: reduce ? 0 : 2.2,
        easingFunction: C.EasingFunction.QUADRATIC_IN_OUT,
      });
    },
    destroy: () => {
      remove();
      handler.destroy();
      widget.destroy();
    },
  };
}
