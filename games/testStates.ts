import type { GAMES } from './registry.ts';
import { addPlayer } from '../shared/seating.ts';
import type { BaseGameState, Random } from '../shared/types.ts';

// Tests patch private fields directly, so they read the state loosely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = BaseGameState & Record<string, any>;

export function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FOUR_SEATS = ['hearts', 'spades', 'euchre', 'rook', 'thecrew'];
export const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];

export function dealt(game: (typeof GAMES)[number]): Loose {
  let state: Loose = game.createGameState('g');
  const seats = FOUR_SEATS.includes(game.info.id) ? 4 : Math.max(game.info.minPlayers, 2);
  for (const name of NAMES.slice(0, seats)) {
    const result = addPlayer(game, state, name, seeded(7));
    if ('error' in result) throw new Error(result.error);
    state = result.state;
  }
  return state;
}
