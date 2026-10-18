import { BOARD } from '../board.ts';
import type { Seat } from '../types.ts';

// Where a space sits on the 11 by 11 grid: GO bottom right, then left along the bottom, up the left side,
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
  'Mediterranean Avenue': 'Mediterranean',
  'Community Chest': 'Chest',
  'Baltic Avenue': 'Baltic',
  'Reading Railroad': 'Reading RR',
  'Oriental Avenue': 'Oriental',
  'Vermont Avenue': 'Vermont',
  'Connecticut Avenue': 'Connecticut',
  'St. Charles Place': 'St. Charles',
  'Electric Company': 'Electric Co.',
  'States Avenue': 'States',
  'Virginia Avenue': 'Virginia',
  'Pennsylvania Railroad': 'Penn. RR',
  'St. James Place': 'St. James',
  'Tennessee Avenue': 'Tennessee',
  'New York Avenue': 'New York',
  'Free Parking': 'Free Parking',
  'Kentucky Avenue': 'Kentucky',
  'Indiana Avenue': 'Indiana',
  'Illinois Avenue': 'Illinois',
  'B. & O. Railroad': 'B. & O. RR',
  'Atlantic Avenue': 'Atlantic',
  'Ventnor Avenue': 'Ventnor',
  'Water Works': 'Water Works',
  'Marvin Gardens': 'Marvin Gdns',
  'Go to Jail': 'Go to Jail',
  'Pacific Avenue': 'Pacific',
  'North Carolina Avenue': 'N. Carolina',
  'Pennsylvania Avenue': 'Pennsylvania',
  'Short Line': 'Short Line',
  'Park Place': 'Park Place',
  'Luxury Tax': 'Luxury Tax',
  'Income Tax': 'Income Tax'
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
