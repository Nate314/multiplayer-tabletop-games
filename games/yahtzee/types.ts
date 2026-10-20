// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Category =
  | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
  | 'threeKind' | 'fourKind' | 'fullHouse' | 'smallStraight' | 'largeStraight' | 'yahtzee' | 'chance';

// The boxes a player has filled, with the points written in each (0 is a scratched box)
export type Sheet = Partial<Record<Category, number>>;

// `hold` has one flag per die; every flag is false and ignored on the first roll of a turn
export type Move =
  | { type: 'roll'; hold: boolean[] }
  | { type: 'score'; category: Category };

// A score move keeps the dice it scored, since the table is cleared for the next player
export type LastMove =
  | { type: 'roll'; playerNumber: Seat; dice: number[]; rollsLeft: number }
  | { type: 'score'; playerNumber: Seat; category: Category; points: number; bonus: boolean; dice: number[] };

export type GameState = BaseGameState & {
  dice: number[]; // this turn's five dice; empty until the player to move has rolled
  held: boolean[]; // the dice kept in the latest roll; empty before the first roll
  rollsLeft: number; // 3 at the start of a turn
  sheets: Record<Seat, Sheet>;
  yahtzeeBonuses: Record<Seat, number>; // extra Yahtzees rolled after a 50 in the Yahtzee box, 100 points each
  lastMove: LastMove | null;
};

// The game state as the server sends it to browsers; nothing is hidden
export type PublicGameState = GameState & BasePublicState;
