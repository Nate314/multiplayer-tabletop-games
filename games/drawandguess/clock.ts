// Timings and canvas size, shared by the browser and the server; imports no rules code
import { CHOOSE_MS, REVEAL_MS, phaseDeadline as guessDeadline, phaseMs as guessMs } from '../../shared/guessing/clock.ts';
import { TURN_SECONDS } from './options.ts';
import type { GameState } from './types.ts';

export { CHOOSE_MS, REVEAL_MS };
export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const MAX_POINTS = 20_000;
export const PALETTE = ['#000000', '#ffffff', '#e03131', '#f76707', '#fcc419', '#2f9e44', '#1c7ed6', '#1864ab', '#7048e8', '#f06595', '#7f4f24', '#868e96'];
export const PALETTE_NAMES = ['Black', 'White', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Navy', 'Purple', 'Pink', 'Brown', 'Gray'];
export const BRUSH_SIZES = [4, 10, 24]; // canvas px

export const phaseMs = (state: Pick<GameState, 'phase' | 'houseRules'>) => guessMs(state, TURN_SECONDS);
export const phaseDeadline = (state: Pick<GameState, 'phase' | 'houseRules' | 'phaseStartedAt' | 'started' | 'isGameOver'>) =>
  guessDeadline(state, TURN_SECONDS);
