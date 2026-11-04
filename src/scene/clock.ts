// The player clock: pure state transitions. Every visual reads time from here.
// Scene time is epoch milliseconds (UTC). "speed" is scene seconds per wall second.
import type { PaceMark } from "./schema.ts";
import { ms } from "./schema.ts";

export interface ClockState {
  t: number;
  playing: boolean;
  /** Manual speed, used when auto is false. */
  speed: number;
  /** Follow the scene's director pacing. */
  auto: boolean;
}

export interface TimeWindow {
  start: number;
  end: number;
}

export function initialClock(window: TimeWindow): ClockState {
  return { t: window.start, playing: false, speed: 60, auto: true };
}

/** The director's speed at scene time t: the last pace mark at or before t. */
export function pacedSpeed(t: number, pacing: readonly PaceMark[], fallback: number): number {
  let speed = fallback;
  for (const mark of pacing) {
    if (ms(mark.t) <= t) speed = mark.speed;
    else break;
  }
  return speed;
}

export function effectiveSpeed(state: ClockState, pacing: readonly PaceMark[]): number {
  return state.auto && pacing.length > 0 ? pacedSpeed(state.t, pacing, state.speed) : state.speed;
}

/** Advance by a wall-clock delta. Stops (and clamps) at the end of the window. */
export function advance(
  state: ClockState,
  dtWallMs: number,
  window: TimeWindow,
  pacing: readonly PaceMark[],
): ClockState {
  if (!state.playing || dtWallMs <= 0) return state;
  // A long frame (tab in background) must not teleport the story.
  const dt = Math.min(dtWallMs, 100);
  const t = state.t + dt * effectiveSpeed(state, pacing);
  if (t >= window.end) return { ...state, t: window.end, playing: false };
  return { ...state, t };
}

export function seek(state: ClockState, t: number, window: TimeWindow): ClockState {
  return { ...state, t: Math.min(window.end, Math.max(window.start, t)) };
}

export function play(state: ClockState, window: TimeWindow): ClockState {
  // Pressing play at the end restarts the replay.
  const t = state.t >= window.end ? window.start : state.t;
  return { ...state, t, playing: true };
}

export function pause(state: ClockState): ClockState {
  return { ...state, playing: false };
}

export function setSpeed(state: ClockState, speed: number): ClockState {
  return { ...state, speed, auto: false };
}

export function setAuto(state: ClockState): ClockState {
  return { ...state, auto: true };
}

/** 0..1 progress through the window. */
export function progress(t: number, window: TimeWindow): number {
  const span = window.end - window.start;
  return span <= 0 ? 0 : Math.min(1, Math.max(0, (t - window.start) / span));
}
