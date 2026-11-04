// The Cesium adapter. Thin on purpose: the scene maths lives in src/scene/ (pure),
// this file only turns poses and toggles into Cesium calls.
// No Cesium ion, no Google tiles, no keys: imagery comes from NASA GIBS (ADR-0002).
import type * as CesiumNS from "cesium";
import { z } from "zod";
import type { SceneBundle } from "@/player/store";
import { usePlayer } from "@/player/store";
import { activeBeatIndex } from "@/scene/beats";
import { cameraAt } from "@/scene/camera";
import { Country } from "@/scene/schema";
import {
  BLACK_MARBLE,
  BLUE_MARBLE,
  BLUE_MARBLE_RELIEF,
  type GibsLayer,
  gibsTemplate,
  STATIC_DATES,
  VIIRS_NIGHT,
  VIIRS_TRUE_COLOR,
} from "./gibs";
import { createOverlays } from "./overlays";
import { createSpotlight } from "./spotlight";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

export interface GlobeEngine {
  destroy: () => void;
}

const DEG = Math.PI / 180;

async function loadCountries(): Promise<Country[]> {
  const res = await fetch("/geo/countries.json");
  if (!res.ok) throw new Error(`countries.json: ${res.status}`);
  return z.array(Country).parse(await res.json());
}

export async function createGlobe(
  container: HTMLElement,
  creditContainer: HTMLElement,
  bundle: SceneBundle,
  hud: { reticle?: HTMLElement | null } = {},
): Promise<GlobeEngine> {
  const { scene } = bundle;
  // Must be set before Cesium loads its workers and assets (copied to public/cesium).
  window.CESIUM_BASE_URL = "/cesium/";
  const [C, countries] = await Promise.all([import("cesium"), loadCountries()]);

  const provider = (layer: GibsLayer, date: string, rectangle?: CesiumNS.Rectangle) => {
    const p = new C.UrlTemplateImageryProvider({
      url: gibsTemplate(layer, date),
      maximumLevel: layer.maxLevel,
      credit: new C.Credit(`${layer.credit} · NASA GIBS`),
      ...(rectangle ? { rectangle } : {}),
    });
    // GIBS answers 404 for tiles with no data (e.g. outside a night-lights swath).
    // A listener stops Cesium logging every miss; one retry covers transient errors,
    // then the tile simply stays empty and the layer below shows through.
    p.errorEvent.addEventListener((err: CesiumNS.TileProviderError) => {
      err.retry = err.timesRetried < 1;
    });
    return p;
  };

  // Story films stand on a timeless, cloud-free globe (relief and ocean floor) graded to the
  // "ice" look so data glows on top; the day's satellite image is an optional layer there.
  // Real-time replays keep the event-day imagery as their ground truth.
  const story = scene.time === "story";
  const storyBase = () => {
    const layer = new C.ImageryLayer(
      story
        ? provider(BLUE_MARBLE_RELIEF, STATIC_DATES.blueMarble)
        : provider(BLUE_MARBLE, STATIC_DATES.blueMarble),
    );
    if (story) {
      // No gamma (pow of a colour that contrast pushed below zero is NaN in the shader),
      // and gentle contrast, so the deepest ocean blues stay valid colours.
      layer.brightness = 0.9;
      layer.contrast = 1.06;
      layer.saturation = 0.74;
    }
    return layer;
  };
  const widget = new C.CesiumWidget(container, {
    baseLayer: storyBase(),
    skyAtmosphere: new C.SkyAtmosphere(),
    creditContainer,
    shouldAnimate: false,
    scene3DOnly: true,
    msaaSamples: 4,
  });

  const s = widget.scene;
  const globe = s.globe;
  // Real time: the real sun position from the scene clock gives an honest day/night
  // terminator. Story time (explainers) has no time of day, so the whole globe is lit
  // with the day's satellite image and no night is implied (ADR-0013).
  const storyTime = story;
  // Story time: a studio key light that follows the camera from the upper left. The side we
  // see is always lit (no terminator, so no time of day is implied), but the globe gets real
  // shading toward its limb and reads as a sphere instead of a flat disc.
  globe.enableLighting = true;
  globe.dynamicAtmosphereLighting = !storyTime;
  globe.dynamicAtmosphereLightingFromSun = !storyTime;
  const keyLight = storyTime
    ? new C.DirectionalLight({ direction: new C.Cartesian3(0, 0, -1), intensity: 2.2 })
    : undefined;
  if (keyLight) s.light = keyLight;
  const lightDir = new C.Cartesian3();
  const lightTmp = new C.Cartesian3();
  globe.showGroundAtmosphere = true;
  globe.baseColor = C.Color.BLACK;
  s.backgroundColor = C.Color.BLACK;
  s.highDynamicRange = true;
  // No bloom: Cesium's bloom (with the contrast it needs to isolate highlights) turns the
  // relief globe's deep-blue ocean into yellow-red noise. Beams and beacons glow by their
  // own PolylineGlow material instead.
  if (s.sun) s.sun.glowFactor = 1.4;

  // Night side. Honesty rule: when the scene names an event night, show the REAL
  // VIIRS pass of that night (opaque), never the pretty multi-year composite: a
  // composite would paint city lights over a blackout. The composite is only used
  // when no event night is given, and the credits say which one is on screen.
  const eventNight = scene.imagery.nights.at(-1);
  const nightLights = s.imageryLayers.addImageryProvider(
    eventNight
      ? provider(VIIRS_NIGHT, eventNight)
      : provider(BLACK_MARBLE, STATIC_DATES.blackMarble),
  );
  nightLights.dayAlpha = 0;
  // The composite is "a typical night", not this one: shown dimmer, and labelled in Credits.
  nightLights.nightAlpha = eventNight ? 1 : 0.55;

  // Day side: the actual satellite image of the event day, worldwide. Swath gaps in the
  // daily mosaic are black; colorToAlpha turns them transparent so the Blue Marble
  // shows through instead of black wedges.
  const eventDay = s.imageryLayers.addImageryProvider(
    provider(VIIRS_TRUE_COLOR, scene.imagery.day),
  );
  eventDay.dayAlpha = 1;
  eventDay.nightAlpha = 0;
  eventDay.colorToAlpha = C.Color.BLACK;
  eventDay.colorToAlphaThreshold = 0.02;

  const overlays = createOverlays(C, s, countries, bundle.layers, scene.layers);
  const spot =
    story && scene.spotlight
      ? createSpotlight(C, s, countries, scene.spotlight, Date.parse(scene.window.start))
      : undefined;
  // The reticle (a DOM overlay) locks onto the spotlight point on screen; hidden behind the Earth.
  const spotPoint = scene.spotlight
    ? C.Cartesian3.fromDegrees(scene.spotlight.lon, scene.spotlight.lat, 0)
    : undefined;
  const occluder = new C.EllipsoidalOccluder(C.Ellipsoid.WGS84, C.Cartesian3.ZERO);
  const screen = new C.Cartesian2();

  // Any user input hands the camera to the user until they resume the director.
  const handler = new C.ScreenSpaceEventHandler(s.canvas);
  const takeOver = () => usePlayer.getState().setDirector(false);
  for (const type of [
    C.ScreenSpaceEventType.LEFT_DOWN,
    C.ScreenSpaceEventType.RIGHT_DOWN,
    C.ScreenSpaceEventType.MIDDLE_DOWN,
    C.ScreenSpaceEventType.WHEEL,
    C.ScreenSpaceEventType.PINCH_START,
  ]) {
    handler.setInputAction(takeOver, type);
  }

  let last = performance.now();
  let lastBeat = -2;
  let active: ReadonlySet<string> = new Set();
  let directing = false;
  const julian = new C.JulianDate();
  const target = new C.Cartesian3();
  const hpr = new C.HeadingPitchRange();

  const removePreUpdate = s.preUpdate.addEventListener(() => {
    const now = performance.now();
    const store = usePlayer.getState();
    store.tick(now - last);
    last = now;

    const { clock, director, layers } = usePlayer.getState();
    C.JulianDate.fromDate(new Date(clock.t), julian);
    widget.clock.currentTime = julian;

    nightLights.show = layers.nightLights && !storyTime;
    if (keyLight) {
      // Camera direction, nudged right and down: light from over the viewer's left shoulder.
      C.Cartesian3.multiplyByScalar(s.camera.rightWC, 0.35, lightTmp);
      C.Cartesian3.add(s.camera.directionWC, lightTmp, lightDir);
      C.Cartesian3.multiplyByScalar(s.camera.upWC, -0.45, lightTmp);
      C.Cartesian3.add(lightDir, lightTmp, lightDir);
      C.Cartesian3.normalize(lightDir, keyLight.direction);
    }
    eventDay.show = layers.eventDay;
    const beatIndex = activeBeatIndex(clock.t, scene.beats);
    if (beatIndex !== lastBeat) {
      active = new Set(scene.beats[beatIndex]?.cites ?? []);
      lastBeat = beatIndex;
    }
    overlays.update(clock.t, { labels: layers.labels, active });
    spot?.update(clock.t);
    if (hud.reticle && spotPoint) {
      occluder.cameraPosition = s.camera.positionWC;
      const seen =
        clock.t - Date.parse(scene.window.start) > 3000 &&
        occluder.isPointVisible(spotPoint) &&
        C.SceneTransforms.worldToWindowCoordinates(s, spotPoint, screen) !== undefined;
      hud.reticle.style.opacity = seen ? "1" : "0";
      // Flag the moment it appears, so the lock-on animation plays when it can be seen.
      const on = seen ? "1" : "0";
      if (hud.reticle.dataset.on !== on) hud.reticle.dataset.on = on;
      if (seen) hud.reticle.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
    }

    if (director) {
      const pose = cameraAt(clock.t, scene.camera);
      C.Cartesian3.fromDegrees(pose.lon, pose.lat, 0, undefined, target);
      hpr.heading = pose.heading * DEG;
      hpr.pitch = pose.pitch * DEG;
      hpr.range = pose.range;
      s.camera.lookAt(target, hpr);
      directing = true;
    } else if (directing) {
      // Release the look-at frame so free navigation behaves normally.
      s.camera.lookAtTransform(C.Matrix4.IDENTITY);
      directing = false;
    }
  });

  return {
    destroy: () => {
      removePreUpdate();
      handler.destroy();
      overlays.destroy();
      spot?.destroy();
      widget.destroy();
    },
  };
}
