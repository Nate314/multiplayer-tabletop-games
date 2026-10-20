import type { GameInfo } from './gameDefinition.ts';

export type GameCategory = 'card' | 'dice' | 'tile' | 'classic' | 'strategy';

// Landing page group order
export const CATEGORIES: readonly { id: GameCategory; name: string }[] = [
  { id: 'card', name: 'Card games' },
  { id: 'dice', name: 'Dice games' },
  { id: 'tile', name: 'Tile games' },
  { id: 'classic', name: 'Classic board games' },
  { id: 'strategy', name: 'Strategy board games' }
];

// Empty groups are dropped; games are alphabetical by display name within a group.
export function groupByCategory<T extends { info: GameInfo }>(games: readonly T[]): { category: GameCategory; name: string; games: T[] }[] {
  return CATEGORIES
    .map(({ id, name }) => ({
      category: id,
      name,
      games: games.filter(game => game.info.category === id).sort((a, b) => a.info.name.localeCompare(b.info.name))
    }))
    .filter(group => group.games.length > 0);
}
