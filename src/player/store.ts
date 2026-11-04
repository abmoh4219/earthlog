// Player state shared by the globe engine and the React UI.
// The engine calls tick() every frame; components select narrowly so they
// re-render only when what they show actually changes.
import { create } from "zustand";
import {
  advance,
  type ClockState,
  initialClock,
  pause,
  play,
  seek,
  setAuto,
  setSpeed,
  type TimeWindow,
} from "@/scene/clock";
import type { Evidence, Scene, Source } from "@/scene/schema";
import { ms } from "@/scene/schema";

export interface SceneBundle {
  scene: Scene;
  evidence: Evidence[];
  sources: Source[];
}

export interface LayerToggles {
  nightLights: boolean;
  eventDay: boolean;
}

interface PlayerState {
  bundle: SceneBundle | null;
  window: TimeWindow;
  clock: ClockState;
  /** True while the scene's director drives the camera; false once the user takes over. */
  director: boolean;
  cinema: boolean;
  layers: LayerToggles;
  globeReady: boolean;

  load: (bundle: SceneBundle) => void;
  tick: (dtWallMs: number) => void;
  togglePlay: () => void;
  seekTo: (t: number) => void;
  seekBy: (dt: number) => void;
  setSpeed: (speed: number) => void;
  setAuto: () => void;
  setDirector: (on: boolean) => void;
  toggleCinema: () => void;
  toggleLayer: (key: keyof LayerToggles) => void;
  setGlobeReady: (ready: boolean) => void;
}

const EMPTY_WINDOW: TimeWindow = { start: 0, end: 1 };

export const usePlayer = create<PlayerState>((set, get) => ({
  bundle: null,
  window: EMPTY_WINDOW,
  clock: initialClock(EMPTY_WINDOW),
  director: true,
  cinema: true,
  layers: { nightLights: true, eventDay: true },
  globeReady: false,

  load: (bundle) => {
    const window = { start: ms(bundle.scene.window.start), end: ms(bundle.scene.window.end) };
    set({ bundle, window, clock: initialClock(window), director: true, globeReady: false });
  },
  tick: (dt) => {
    const { clock, window, bundle } = get();
    if (!clock.playing || !bundle) return;
    set({ clock: advance(clock, dt, window, bundle.scene.pacing) });
  },
  togglePlay: () => {
    const { clock, window } = get();
    set({ clock: clock.playing ? pause(clock) : play(clock, window) });
  },
  seekTo: (t) => set((s) => ({ clock: seek(s.clock, t, s.window) })),
  seekBy: (dt) => set((s) => ({ clock: seek(s.clock, s.clock.t + dt, s.window) })),
  setSpeed: (speed) => set((s) => ({ clock: setSpeed(s.clock, speed) })),
  setAuto: () => set((s) => ({ clock: setAuto(s.clock) })),
  setDirector: (on) => set({ director: on }),
  toggleCinema: () => set((s) => ({ cinema: !s.cinema })),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setGlobeReady: (ready) => set({ globeReady: ready }),
}));
