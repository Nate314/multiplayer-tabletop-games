import { groupByCategory } from '../../shared/categories.ts';
import type { GameCategory } from '../../shared/categories.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';

export type GameSort = 'category' | 'name';
export type LandingFilters = { search: string; sort: GameSort; categories: GameCategory[]; players: number | null };
export type GameSection<T> = { key: string; heading: string | null; games: T[] };

export const DEFAULT_FILTERS: LandingFilters = { search: '', sort: 'category', categories: [], players: null };

type PlayerCounts = Pick<GameInfo, 'minPlayers' | 'maxPlayers' | 'stretchedPlayers'>;

// The game seats `players`, counting the stretched range the host can unlock with "I know what I'm doing"
export function supportsPlayers(info: PlayerCounts, players: number): boolean {
  const min = Math.min(info.minPlayers, info.stretchedPlayers?.min ?? info.minPlayers);
  const max = Math.max(info.maxPlayers, info.stretchedPlayers?.max ?? info.maxPlayers);
  return min <= players && players <= max;
}

// The game seats `players` only with the player-count override, so its card is marked "house rule"
export function needsHouseRule(info: PlayerCounts, players: number): boolean {
  return supportsPlayers(info, players) && (players < info.minPlayers || players > info.maxPlayers);
}

export function matchesFilters(info: GameInfo, filters: LandingFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  return (
    (!search || info.name.toLowerCase().includes(search) || info.description.toLowerCase().includes(search)) &&
    (filters.categories.length === 0 || filters.categories.includes(info.category)) &&
    (filters.players === null || supportsPlayers(info, filters.players))
  );
}

export function arrangeGames<T extends { info: GameInfo }>(games: readonly T[], filters: LandingFilters): GameSection<T>[] {
  const matches = games.filter(game => matchesFilters(game.info, filters));
  if (matches.length === 0) return [];
  if (filters.sort === 'category') {
    return groupByCategory(matches).map(group => ({ key: group.category, heading: group.name, games: group.games }));
  }
  return [{ key: 'all', heading: null, games: [...matches].sort((a, b) => a.info.name.localeCompare(b.info.name)) }];
}

export function hasActiveFilters(filters: LandingFilters): boolean {
  return filters.search.trim() !== '' || filters.categories.length > 0 || filters.players !== null;
}

// The number on the Filter button: search stays visible beside it and sort is not a filter
export function activeFilterCount(filters: LandingFilters): number {
  return filters.categories.length + (filters.players === null ? 0 : 1);
}

export function parsePlayers(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null;
  const count = Number(text);
  return count >= 1 ? count : null;
}
