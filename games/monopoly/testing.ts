// Helpers for the Monopoly tests: a game under way with known decks, and dice that come up as asked
import { applyAction, applyMove, createGameState } from './rules.ts';
import type { GameState, Random, Result, Seat } from './types.ts';

const inOrder = () => Array.from({ length: 16 }, (_, index) => index);

// Three players on GO with $1500 each, Alice to roll, both decks in printed order
export function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    currentPlayer: 1,
    turnHolder: 1,
    canRoll: true,
    cash: { 1: 1500, 2: 1500, 3: 1500 },
    positions: { 1: 0, 2: 0, 3: 0 },
    jailCards: { 1: [], 2: [], 3: [] },
    decks: { chance: inOrder(), chest: inOrder() },
    ...overrides
  };
}

// Dice that roll the given faces in order, then 1s
export function dice(...faces: number[]): Random {
  let call = 0;
  return () => ((faces[call++] ?? 1) - 0.5) / 6;
}

export function ok(result: Result<GameState>): GameState {
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

export const move = (state: GameState, seat: Seat, value: unknown, random: Random = dice()) =>
  applyMove(state, seat, value, random);

export const act = (state: GameState, seat: Seat, value: unknown) => applyAction(state, seat, value);

export const played = (state: GameState, seat: Seat, value: unknown, random: Random = dice()) => ok(move(state, seat, value, random));

export const acted = (state: GameState, seat: Seat, value: unknown) => ok(act(state, seat, value));

// House rules as the host set them, e.g. houseRules({ freeParkingJackpot: true })
export function houseRules(values: Record<string, boolean>): GameState['houseRules'] {
  return { host: 1, values, maxPlayers: null, agreed: [1, 2, 3], revision: 1 };
}
