// How long Play shows each step of the history dialog
export const PLAY_STEP_MS = 1500;

// The step Play starts from: where the slider is, or the first step when it is already at the last
export function nextPlayIndex(index: number, lastIndex: number): number {
  return index >= lastIndex ? 0 : index;
}

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

// How long Play shows each step at a speed
export function stepDelayMs(speed: PlaybackSpeed): number {
  return PLAY_STEP_MS / speed;
}
