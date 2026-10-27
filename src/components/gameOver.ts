import { plural } from '../../shared/text.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

// 'Alice wins', 'Alice and Bob win', 'Alice, Bob and Cara win', or 'Draw' when nobody won
export function winnerLine({ winners, playerNames }: BasePublicState): string {
  const names = winners.map(seat => playerNames[seat]);
  if (names.length === 0) return 'Draw';
  if (names.length === 1) return `${names[0]} wins`;
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} win`;
}

// 1st, 2nd, 3rd, 4th, ... 11th, 12th, 13th, ... 21st
export function ordinal(place: number): string {
  const teen = place % 100 >= 11 && place % 100 <= 13;
  const suffix = teen ? 'th' : ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th';
  return `${place}${suffix}`;
}

export function lengthText(state: BasePublicState, client: ClientGame): string {
  return client.gameLength?.(state) ?? plural(state.moveCount, 'move');
}

// The one place that decides who may ask for a rematch: a seated player, never a spectator or a table screen (null)
export function canRematch(state: BasePublicState, viewer: Seat | null): boolean {
  return viewer !== null && state.activePlayers.includes(viewer);
}
