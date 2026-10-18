// Helpers for the Catan tests: a known board, a game past setup, and dice that come up as asked
import { HEX_RESOURCES, NUMBER_TOKENS, PORT_EDGES, PORT_KINDS } from './board.ts';
import { DEV_DECK } from './devCards.ts';
import { applyAction, applyMove, createGameState } from './rules.ts';
import { BANK_SIZE, noResources, resources } from './resources.ts';
import type { GameState, Layout, Random, Resources, Result, Seat } from './types.ts';

// Hexes take the printed resource list in order (the desert last, hex 18) and the tokens in order
export const LAYOUT: Layout = {
  hexes: HEX_RESOURCES.map((resource, index) => ({ resource, number: resource === null ? null : NUMBER_TOKENS[index] })),
  ports: PORT_EDGES.map((edge, index) => ({ edge, kind: PORT_KINDS[index] }))
};

// Three players past setup with nothing built, Alice to roll, the robber on the desert and the deck in printed order
export function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    currentPlayer: 1,
    turnHolder: 1,
    layout: LAYOUT,
    robber: 18,
    hands: { 1: noResources(), 2: noResources(), 3: noResources() },
    bank: resources({ wood: BANK_SIZE, brick: BANK_SIZE, sheep: BANK_SIZE, wheat: BANK_SIZE, ore: BANK_SIZE }),
    devDeck: [...DEV_DECK],
    devCards: { 1: [], 2: [], 3: [] },
    knights: { 1: 0, 2: 0, 3: 0 },
    ...overrides
  };
}

// The game with `seat` holding `cards` (taken from the bank) and the dice rolled
export function holding(state: GameState, seat: Seat, cards: Partial<Resources>): GameState {
  const hand = resources(cards);
  const bank = { ...state.bank };
  for (const [resource, count] of Object.entries(hand)) bank[resource as keyof Resources] -= count;
  return { ...state, hands: { ...state.hands, [seat]: hand }, bank };
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

export const move = (state: GameState, seat: Seat, value: unknown, random: Random = dice()) => applyMove(state, seat, value, random);

export const act = (state: GameState, seat: Seat, value: unknown) => applyAction(state, seat, value);

export const played = (state: GameState, seat: Seat, value: unknown, random: Random = dice()) => ok(move(state, seat, value, random));

export const acted = (state: GameState, seat: Seat, value: unknown) => ok(act(state, seat, value));
