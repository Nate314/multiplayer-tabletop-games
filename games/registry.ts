import type { GameDefinition } from '../shared/gameDefinition.ts';

// Landing page order. Games differ in their state types, so the list holds them type-erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: GameDefinition<any, any>[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findGame(id: unknown): GameDefinition<any, any> | undefined {
  return GAMES.find(game => game.info.id === id);
}
