// The front-page globe: the latest edition's stories as thin columns on the planet, coloured
// by lens and as tall as their heat. The camera falls from orbit onto the edition (the intro),
// drifts slowly while idle, and flies to a story when it is chosen.
// The landing hero ("night" option) shows the planet as it is lit at the moment of the visit:
// the real sun position, the night side dark with city lights, the stories as amber points.
// Separate from the film engine on purpose: no scene clock, no evidence, no layers to time.
import type * as CesiumNS from "cesium";
import { BLACK_MARBLE, BLUE_MARBLE_RELIEF, gibsTemplate, STATIC_DATES } from "./gibs";
import { subsolarPoint } from "./sun";

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
  /** Replace the stories shown (the Now page refreshes while open). */
  update: (stories: FrontStory[]) => void;
  destroy: () => void;
}

const DEG = Math.PI / 180;
/** City-light amber, the site's one accent (globals.css --color-sodium). */
const SODIUM = "#ffb547";

export async function createFrontGlobe(
  container: HTMLElement,
  creditContainer: HTMLElement,
  stories: FrontStory[],
  onPick: (slug: string) => void,
  /**
   * zoom: wheel zooms the globe (off in a scrolling page, where the wheel must scroll).
   * hero: a floating globe for a page (no stars, closer, no names).
   * night: lit by the real sun at this moment, city lights on the night side, amber points
   * sized by heat. face: where the camera settles: the dawn line (default at night) or the
   * stories' centre.
   */
  options: { zoom?: boolean; hero?: boolean; night?: boolean; face?: "dawn" | "stories" } = {},
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
  // The same grade as the story films.
  base.brightness = 0.9;
  base.contrast = 1.06;
  base.saturation = 0.74;
  // Night: the day image only on the lit side (a trace on the night side keeps the continents
  // readable), and the city lights only on the dark side.
  if (options.night) base.nightAlpha = 0.12;
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
  // Cesium lights the globe from the real sun at the widget clock's time, which starts at now
  // and does not run. Black Marble is a multi-year composite: "a typical night", credited so.
  if (options.night) {
    s.globe.enableLighting = true;
    s.globe.dynamicAtmosphereLighting = true;
    s.globe.dynamicAtmosphereLightingFromSun = true;
    const lights = s.imageryLayers.addImageryProvider(
      new C.UrlTemplateImageryProvider({
        url: gibsTemplate(BLACK_MARBLE, STATIC_DATES.blackMarble),
        maximumLevel: BLACK_MARBLE.maxLevel,
        credit: new C.Credit(`${BLACK_MARBLE.credit} (2016 composite) · NASA GIBS`),
      }),
    );
    lights.dayAlpha = 0;
    lights.nightAlpha = 1;
    // The composite is dim at globe scale; lift it so cities read as lights, not specks.
    lights.brightness = 2.2;
  }
  if (options.zoom === false) {
    s.screenSpaceCameraController.enableZoom = false;
    s.screenSpaceCameraController.enableTilt = false;
  }

  // Columns: height from heat (log), a dot at the foot, a name that shows on focus (and for the
  // three hottest). In the night hero, the columns go and every story is an amber point.
  const lines = s.primitives.add(new C.PolylineCollection());
  const points = s.primitives.add(new C.PointPrimitiveCollection());
  const labels = s.primitives.add(new C.LabelCollection());
  type Mark = {
    st: FrontStory;
    color: CesiumNS.Color;
    line: CesiumNS.Polyline;
    dot: CesiumNS.PointPrimitive;
    label: CesiumNS.Label;
    size: number;
    tint: CesiumNS.Color;
  };
  let marks: Mark[] = [];
  let ranked: string[] = [];
  // Names of the three hottest by day; at night (many small points) only the chosen one's.
  const nameShown = (slug: string) =>
    !options.hero && !options.night && container.clientWidth >= 640 && ranked.indexOf(slug) < 3;
  const build = (list: FrontStory[]) => {
    lines.removeAll();
    points.removeAll();
    labels.removeAll();
    const maxHeat = Math.max(1, ...list.map((st) => st.heat));
    ranked = [...list].sort((a, b) => b.heat - a.heat).map((st) => st.slug);
    marks = list.map((st) => {
      const color = C.Color.fromCssColorString(options.night ? SODIUM : st.color);
      const h = 250_000 + (Math.log1p(st.heat) / Math.log1p(maxHeat)) * 1_650_000;
      // At night the heat is the point's size (the columns are off): 5 to 13 px.
      const size = options.night ? 5 + 8 * (st.heat / maxHeat) : 8;
      const line = lines.add({
        id: st.slug,
        positions: [
          C.Cartesian3.fromDegrees(st.lon, st.lat, 0),
          C.Cartesian3.fromDegrees(st.lon, st.lat, h),
        ],
        width: 1.5,
        show: !options.night,
        material: C.Material.fromType("Color", { color: color.withAlpha(0.8) }),
      });
      const dot = points.add({
        id: st.slug,
        position: C.Cartesian3.fromDegrees(st.lon, st.lat, 8_000),
        pixelSize: size,
        color,
        outlineColor: C.Color.BLACK.withAlpha(0.7),
        outlineWidth: 2,
      });
      const label = labels.add({
        position: C.Cartesian3.fromDegrees(st.lon, st.lat, options.night ? 120_000 : h + 60_000),
        text: st.title.length > 46 ? `${st.title.slice(0, 44)}…` : st.title,
        font: "500 13px Geist, system-ui, sans-serif",
        fillColor: C.Color.WHITE,
        outlineColor: C.Color.BLACK.withAlpha(0.9),
        outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        // Narrow screens: names only on focus (three would pile up on a small globe).
        show: nameShown(st.slug),
      });
      return { st, color, line, dot, label, size, tint: new C.Color() };
    });
  };
  build(stories);

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
  // Night hero: face a day/night line (90° from where the sun is overhead), 15° into the day,
  // so the visitor always sees both night and daylight: the sunrise line or the sunset line,
  // whichever is nearer the day's stories (at 18:00 UTC sunrise is over the empty Pacific and
  // sunset over Europe and Africa).
  if (options.night && options.face !== "stories") {
    const sun = subsolarPoint(new Date()).lon;
    const gap = (a: number) => Math.abs(((a - home.lon + 540) % 360) - 180);
    const dawn = sun - 75;
    const dusk = sun + 75;
    home.lon = gap(dawn) <= gap(dusk) ? dawn : dusk;
    home.lat = 18;
  }
  // How far the camera settles: closer for a page's hero and for the Now panel.
  const homeRange = options.hero ? 1.15e7 : options.night ? 1.6e7 : 2.3e7;
  s.camera.setView({ destination: C.Cartesian3.fromDegrees(home.lon + 70, home.lat, 9e7) });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  s.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(home.lon, home.lat - 6, homeRange),
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
    // The night hero turns three times slower, so the dawn line stays in view for minutes.
    if (!reduce && !focused && now - touchedAt > 8000)
      s.camera.rotate(C.Cartesian3.UNIT_Z, options.night ? 0.00015 : 0.00045);
    for (const m of marks) {
      const on = focused === m.st.slug;
      if (options.night) m.label.show = on;
      m.line.width = on ? 3 : 1.5;
      m.line.material.uniforms.color = m.color.withAlpha(on ? 1 : focused ? 0.3 : 0.8, m.tint);
      m.dot.pixelSize = on ? m.size + 5 : m.size;
      if (focused) m.label.show = on;
    }
  });

  return {
    focus: (slug) => {
      focused = slug;
      const m = marks.find((k) => k.st.slug === slug);
      if (!slug) for (const k of marks) k.label.show = nameShown(k.st.slug);
      // By day a chosen story is seen at an angle (its column stands up); at night from above.
      const tilt = m && !options.night;
      const target = m
        ? C.Cartesian3.fromDegrees(m.st.lon, tilt ? m.st.lat - 14 : m.st.lat, tilt ? 9e6 : 8e6)
        : C.Cartesian3.fromDegrees(home.lon, home.lat - 6, homeRange);
      s.camera.flyTo({
        destination: target,
        orientation: { heading: 0, pitch: (tilt ? -62 : -90) * DEG, roll: 0 },
        duration: reduce ? 0 : 2.2,
        easingFunction: C.EasingFunction.QUADRATIC_IN_OUT,
      });
    },
    update: (list) => {
      build(list);
      if (focused && !marks.some((k) => k.st.slug === focused)) focused = undefined;
    },
    destroy: () => {
      remove();
      handler.destroy();
      widget.destroy();
    },
  };
}
