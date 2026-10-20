// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// A card is its number, 1 to 60 (only 1 to 40 with 2 players, 1 to 50 with 3)
export type Card = number;

export type Pile = 'deck' | 'discard';

export type Move =
  | { type: 'draw'; from: Pile }
  | { type: 'place'; slot: number } // 0 to 9, slot 0 is the lowest; the card it replaces goes on the discard pile
  | { type: 'discard' }; // only a card drawn from the deck

// Not turn-bound and not undoable
export type Action = { type: 'acknowledgeRound' };

// A card taken from the deck stays hidden until it is placed, so `draw` names it only for the discard pile.
// A placed card is not named either: it joins a rack nobody else may see. `replaced` goes face up on the discard pile.
export type LastMove =
  | { playerNumber: Seat; type: 'draw'; from: 'deck'; reshuffled: boolean }
  | { playerNumber: Seat; type: 'draw'; from: 'discard'; card: Card }
  | { playerNumber: Seat; type: 'place'; slot: number; from: Pile; replaced: Card; rackO: boolean }
  | { playerNumber: Seat; type: 'discard'; card: Card };

// How one round went. Racks are shown face up here, because the round is over.
export type RoundSummary = {
  round: number;
  caller: Seat; // the player who called Rack-O
  points: Record<Seat, number>; // scored this round
  racks: Record<Seat, Card[]>;
  acknowledged: Seat[]; // the next round waits for every connected player
};

// The card the current player drew and has not yet placed or discarded
export type Held = { by: Seat; card: Card; from: Pile };

// The full state, which never leaves the server: nobody sees another rack, the draw pile or a card drawn from the deck
export type GameState = BaseGameState & {
  round: number; // 1 for the first round
  starter: Seat | null; // who takes the first turn of the round
  scores: Record<Seat, number>;
  racks: Record<Seat, Card[]>; // ten cards each, slot 0 first
  drawPile: Card[]; // drawn from the end
  discardPile: Card[]; // the last card is the face-up top
  held: Held | null;
  roundSummary: RoundSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: the viewer's own rack and counts for the rest
export type PublicGameState = Omit<GameState, 'racks' | 'drawPile' | 'discardPile' | 'held'> & BasePublicState & {
  myRack: Card[];
  drawCount: number;
  discardTop: Card | null;
  discardCount: number;
  heldFrom: Pile | null; // what the current player drew and has yet to place
  myHeld: Card | null; // that card, for the player holding it only
};
