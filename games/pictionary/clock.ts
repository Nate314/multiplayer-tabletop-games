// Timings and canvas size, shared by the browser and the server; imports no rules code
import { houseRule } from '../../shared/houseRules.ts';
import { TURN_SECONDS } from './options.ts';
import type { GameState } from './types.ts';

export const CHOOSE_MS = 20_000;
export const REVEAL_MS = 5_000;
export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const MAX_POINTS = 20_000;
export const PALETTE = ['#000000', '#ffffff', '#e03131', '#f76707', '#fcc419', '#2f9e44', '#1c7ed6', '#1864ab', '#7048e8', '#f06595', '#7f4f24', '#868e96'];
export const PALETTE_NAMES = ['Black', 'White', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Navy', 'Purple', 'Pink', 'Brown', 'Gray'];
export const BRUSH_SIZES = [4, 10, 24]; // canvas px

type Clocked = Pick<GameState, 'phase' | 'houseRules' | 'phaseStartedAt' | 'started' | 'isGameOver'>;

export function phaseMs(state: Pick<GameState, 'phase' | 'houseRules'>): number {
  if (state.phase === 'choosing') return CHOOSE_MS;
  if (state.phase === 'reveal') return REVEAL_MS;
  return houseRule(state, TURN_SECONDS) * 1000;
}

// When the current phase ends, in server ms; no clock runs in the lobby or after the game
export function phaseDeadline(state: Clocked): number | null {
  if (!state.started || state.isGameOver || state.phaseStartedAt === null) return null;
  return state.phaseStartedAt + phaseMs(state);
}
