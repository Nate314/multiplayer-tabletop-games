// Helpers for the Risk tests: a game under way with a known map and deck, and dice that come up as asked
import { ALL_CARDS, TERRITORIES } from './map.ts';
import { applyMove, createGameState } from './rules.ts';
import type { GameState, Random, Result, Seat } from './types.ts';

// Territory ids in map order
export const IDS = TERRITORIES.map(({ id }) => id);

// Every territory to `seat` except the ones listed, which go to the seats given
export function ownership(seat: Seat, others: Record<string, Seat | null> = {}): Record<string, Seat | null> {
  return Object.fromEntries(IDS.map(id => [id, id in others ? others[id] : seat]));
}

// Three players in their first turn, Alice to place 3 armies. The map is dealt in turn (Alaska to Alice, the next to
// Bob, then Cara and so on) with 3 armies each, and the deck is in card order.
export function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    currentPlayer: 1,
    turnHolder: 1,
    firstPlayer: 1,
    phase: 'reinforce',
    reinforcements: 3,
    turnNumber: 1,
    owners: Object.fromEntries(IDS.map((id, index) => [id, (index % 3) + 1])),
    armies: Object.fromEntries(IDS.map(id => [id, 3])),
    setupLeft: { 1: 0, 2: 0, 3: 0 },
    hands: { 1: [], 2: [], 3: [] },
    deck: [...ALL_CARDS],
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

export const played = (state: GameState, seat: Seat, value: unknown, random: Random = dice()) => ok(move(state, seat, value, random));
