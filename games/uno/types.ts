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

export type Direction = 1 | -1; // 1 plays up through the seats, to the dealer's left; -1 down

export type Move =
  | { type: 'play'; card: Card; color?: Color; uno?: boolean } // color is required for a Wild; uno calls UNO with the play
  | { type: 'draw' }
  | { type: 'pass' } // only after drawing a playable card
  | { type: 'chooseColor'; color: Color } // the first player names the color after a starting Wild
  | { type: 'challenge' } // the player hit by a Wild Draw Four challenges it
  | { type: 'accept' }; // or takes the 4 cards

// Not turn-bound and not undoable
export type Action =
  | { type: 'callUno' } // a late call, still in time if nobody has caught you
  | { type: 'catchUno' } // the player who did not call UNO draws 2
  | { type: 'acknowledgeRound' };

// `target` is who a Skip, Reverse with 2 players, Draw Two or Wild Draw Four hit; `drew` is how many they drew.
// A Wild Draw Four that does not go out leaves its target to accept or challenge, so they have drawn nothing yet.
export type LastMove =
  | { type: 'play'; playerNumber: Seat; card: Card; color: Color; target: Seat | null; drew: number; wentOut: boolean }
  | { type: 'draw'; playerNumber: Seat; passed: boolean } // passed: the card could not be played, so the turn moved on
  | { type: 'pass'; playerNumber: Seat }
  | { type: 'chooseColor'; playerNumber: Seat; color: Color }
  | { type: 'challenge'; playerNumber: Seat; challenged: Seat; guilty: boolean; drew: number } // guilty: the challenged player drew
  | { type: 'accept'; playerNumber: Seat; drew: number };

// A Wild Draw Four waiting for its target to accept or challenge. It was legal only if `by` held no card of `previousColor`.
export type PendingFour = { by: Seat; target: Seat; previousColor: Color };

// The player who just played their second-to-last card; until the next move they may be caught if they have not called UNO
export type UnoWindow = { seat: Seat; called: boolean };

// How one round went. Cards left in hand are counted, not shown.
export type RoundSummary = {
  roundNumber: number;
  wentOut: Seat;
  points: number; // what the player who went out scored
  cardsLeft: Record<Seat, number>;
  acknowledged: Seat[]; // the next round waits for every connected player
};

// The full state, which never leaves the server: nobody may see the draw pile or another player's hand
export type GameState = BaseGameState & {
  roundNumber: number; // 1 for the first round
  dealer: Seat | null;
  scores: Record<Seat, number>;
  hands: Record<Seat, Card[]>;
  drawPile: Card[];    // the top card is the last one
  discardPile: Card[]; // the top card is the last one
  currentColor: Color | null; // null only after a starting Wild, until the first player names a color
  direction: Direction;
  drawnCard: Card | null; // the card the current player just drew and may still play
  // Whose turn it is, kept beside currentPlayer: the platform has already moved currentPlayer on
  // when onPlayerLeft runs, and only this tells whether the leaver held the turn
  turnHolder: Seat | null;
  pendingFour: PendingFour | null;
  unoWindow: UnoWindow | null;
  // The challenged player's hand as it was, shown to the challenger only, until the challenger's next move
  revealed: { to: Seat; of: Seat; hand: Card[] } | null;
  roundSummary: RoundSummary | null;
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only that player's own hand
export type PublicGameState =
  Omit<GameState, 'hands' | 'drawPile' | 'discardPile' | 'drawnCard' | 'turnHolder' | 'revealed'> &
  BasePublicState & {
    hand: Card[]; // the viewer's own hand; empty for the history
    handCounts: Record<Seat, number>;
    drawPileCount: number;
    discardTop: Card | null;
    hasDrawn: boolean; // the current player drew and may now play that card or pass
    drawnCard: Card | null; // which card that was, shown only to the player who drew it
    revealed: { of: Seat; hand: Card[] } | null; // the challenged hand, in the challenger's view only
  };
