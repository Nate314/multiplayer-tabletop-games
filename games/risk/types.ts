// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type ContinentId = 'northAmerica' | 'southAmerica' | 'europe' | 'africa' | 'asia' | 'australia';

export type Continent = { id: ContinentId; name: string; bonus: number };

// One of the 42 territories; x and y place it on the drawn map (1000 by 620)
export type Territory = { id: string; name: string; continent: ContinentId; x: number; y: number };

export type CardSymbol = 'infantry' | 'cavalry' | 'artillery' | 'wild';

// A card is a number: 0 to 41 show the territory with that index, 42 and 43 are the wilds
export type Card = number;

// setup: placing the starting armies. reinforce: trading cards and placing armies (at the start of a turn, or
// mid-turn after taking an eliminated player's cards). attack, then conquer (moving into a captured territory),
// then fortify (one move), and the turn ends.
export type Phase = 'setup' | 'reinforce' | 'attack' | 'conquer' | 'fortify';

// Armies by territory id
export type Placements = Record<string, number>;

export type Move =
  | { type: 'place'; placements: Placements }
  | { type: 'trade'; cards: Card[] }
  | { type: 'attack'; from: string; to: string; dice: number }
  | { type: 'blitz'; from: string; to: string }
  | { type: 'occupy'; armies: number }
  | { type: 'endAttack' }
  | { type: 'fortify'; from: string; to: string; armies: number }
  | { type: 'endTurn' };

// The last battle, shown with its dice. A blitz keeps its final roll and the totals over all its rolls.
export type Battle = {
  from: string;
  to: string;
  attacker: Seat;
  defender: Seat | null; // null for a neutral territory
  attackDice: number[];
  defendDice: number[];
  attackerLost: number;
  defenderLost: number;
  rolls: number;
  conquered: boolean;
};

// Moving into a just captured territory: at least `minimum` armies (the dice of the last roll)
export type Conquest = { from: string; to: string; minimum: number };

// The move that produced a state, what followed from it, and the territories it touched
export type LastMove = { type: Move['type']; playerNumber: Seat; events: string[]; territories: string[] };

// The full state. Hidden from the browser: the hands (others see counts), the deck order and the discards.
export type GameState = BaseGameState & {
  phase: Phase;
  firstPlayer: Seat | null; // who placed first in the setup and plays the first turn
  turnHolder: Seat | null; // whose turn it is; the same as currentPlayer, kept so a dismissal can tell
  owners: Record<string, Seat | null>; // null is neutral: the territories of a dismissed player
  armies: Record<string, number>;
  setupLeft: Record<Seat, number>; // starting armies each player has still to place
  reinforcements: number; // armies the current player has still to place this turn
  midTurnTrade: boolean; // the reinforce phase came from taking an eliminated player's cards
  bonusTaken: boolean; // the +2 armies for a traded card's territory, at most once a turn
  conqueredThisTurn: boolean;
  conquest: Conquest | null;
  hands: Record<Seat, Card[]>;
  deck: Card[]; // top first
  discard: Card[];
  tradeCount: number; // sets traded so far in the game, which sets the next set's value
  eliminated: Seat[];
  turnNumber: number;
  battle: Battle | null;
  log: string[]; // the most recent events, newest last
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'hands' | 'deck' | 'discard'> & BasePublicState & {
  handCounts: Record<Seat, number>;
  hand: Card[] | null; // the viewer's own cards; null for the table view
  deckCount: number;
  discardCount: number;
};
