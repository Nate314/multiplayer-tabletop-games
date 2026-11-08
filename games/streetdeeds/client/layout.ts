import { BOARD } from '../board.ts';
import type { Seat } from '../types.ts';

// Where a space sits on the 11 by 11 grid: Start bottom right, then left along the bottom, up the left side,
// right along the top and down the right side
export function gridPosition(space: number): { row: number; column: number } {
  if (space <= 10) return { row: 11, column: 11 - space };
  if (space <= 20) return { row: 11 - (space - 10), column: 1 };
  if (space <= 30) return { row: 1, column: 1 + (space - 20) };
  return { row: 1 + (space - 30), column: 11 };
}

// The board's side a space is on, for which edge its color bar takes
export function sideOf(space: number): 'bottom' | 'left' | 'top' | 'right' | 'corner' {
  if (space % 10 === 0) return 'corner';
  if (space < 10) return 'bottom';
  if (space < 20) return 'left';
  if (space < 30) return 'top';
  return 'right';
}

// Short names that fit on a board space
const SHORT: Record<string, string> = {
  'Harbor Station': 'Harbor Stn.',
  'Willow Street': 'Willow St.',
  'Fennel Street': 'Fennel St.',
  'Copper Street': 'Copper St.',
  'Orchard Road': 'Orchard Rd.',
  'Quarry Road': 'Quarry Rd.',
  'Market Station': 'Market Stn.',
  'Belfry Place': 'Belfry Pl.',
  'Chapel Place': 'Chapel Pl.',
  'Mercer Place': 'Mercer Pl.',
  'Juniper Avenue': 'Juniper Ave.',
  'Sterling Avenue': 'Sterling Ave.',
  'Regent Avenue': 'Regent Ave.',
  'Union Station': 'Union Stn.',
  'Amber Terrace': 'Amber Ter.',
  'Linden Terrace': 'Linden Ter.',
  'Hawthorn Gardens': 'Hawthorn Gdns',
  'Kingsley Drive': 'Kingsley Dr.',
  'Ashcombe Drive': 'Ashcombe Dr.',
  'Galloway Drive': 'Galloway Dr.',
  'Ridge Station': 'Ridge Stn.',
  'Skyline Crescent': 'Skyline Cres.'
};

export function shortName(space: number): string {
  const { name } = BOARD[space];
  return SHORT[name] ?? name;
}

export const PLAYER_COUNT = 8;

// Seat colors repeat only past eight seats, which the game never has
export function seatClass(seat: Seat): string {
  return `seat${((seat - 1) % PLAYER_COUNT) + 1}`;
}

export const tokenKey = (seat: Seat) => `token-${seat}`;
