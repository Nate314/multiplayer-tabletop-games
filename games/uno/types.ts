// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Color = 'red' | 'yellow' | 'green' | 'blue';

export type Value =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'drawTwo' | 'wild' | 'wildDrawFour';

// Wild cards have no color of their own; the color their player chose is the state's currentColor
export type Card = { color: Color | 'wild'; value: Value };

export type Direction = 1 | -1; // 1 plays up through the seats, -1 down

export type Move =
  | { type: 'play'; card: Card; color?: Color } // color is required for a Wild and ignored otherwise
  | { type: 'draw' }
  | { type: 'pass' }; // only after drawing a playable card

// `target` is who a Skip, Reverse with 2 players, Draw Two or Wild Draw Four skipped; `drew` is how many they drew
export type LastMove =
  | { type: 'play'; playerNumber: Seat; card: Card; color: Color; target: Seat | null; drew: number }
  | { type: 'draw'; playerNumber: Seat; passed: boolean } // passed: the card could not be played, so the turn moved on
  | { type: 'pass'; playerNumber: Seat };

// The full state, which never leaves the server: nobody may see the draw pile or another player's hand
export type GameState = BaseGameState & {
  hands: Record<Seat, Card[]>;
  drawPile: Card[];    // the top card is the last one
  discardPile: Card[]; // the top card is the last one
  currentColor: Color | null; // null only after a starting Wild, when any card may follow
  direction: Direction;
  drawnCard: Card | null; // the card the current player just drew and may still play
  // Whose turn it is, kept beside currentPlayer: the platform has already moved currentPlayer on
  // when onPlayerLeft runs, and only this tells whether the leaver held the turn
  turnHolder: Seat | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand
export type PublicGameState = Omit<GameState, 'hands' | 'drawPile' | 'discardPile' | 'drawnCard' | 'turnHolder'> &
  BasePublicState & {
    hand: Card[]; // the viewer's own hand; empty for the history
    handCounts: Record<Seat, number>;
    drawPileCount: number;
    discardTop: Card | null;
    hasDrawn: boolean; // the current player drew and may now play that card or pass
    drawnCard: Card | null; // which card that was, shown only to the player who drew it
  };
