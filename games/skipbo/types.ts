// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

// Every card has an id, unique in the deck, so the screen can follow a card from one pile to another
export type Card =
  | { id: number; kind: 'number'; value: number }
  | { id: number; kind: 'skipbo' };

export type PileIndex = 0 | 1 | 2 | 3;

// Where a played card comes from: a hand card by its index, the top of your stock, or the top of one of your discard piles
export type Source =
  | { kind: 'hand'; index: number }
  | { kind: 'stock' }
  | { kind: 'discard'; pile: PileIndex };

export type Move =
  | { type: 'play'; from: Source; to: PileIndex } // `to` is a building pile
  | { type: 'discard'; handIndex: number; pile: PileIndex } // onto one of your discard piles; ends the turn
  | { type: 'endTurn' }; // only with an empty hand that cannot be refilled

// Every card in these moves ends up face up, so naming it hides nothing
export type LastMove =
  | {
    playerNumber: Seat;
    type: 'play';
    from: Source;
    to: PileIndex;
    card: Card;
    value: number; // the number it counts as on the building pile
    completed: boolean; // it was the 12, so the pile went back into the draw pile
  }
  | { playerNumber: Seat; type: 'discard'; card: Card; pile: PileIndex }
  | { playerNumber: Seat; type: 'endTurn' };

// The full state, which never leaves the server: nobody sees the draw pile, another hand, or a stock below its top
export type GameState = BaseGameState & {
  hands: Record<Seat, Card[]>;
  stocks: Record<Seat, Card[]>;          // the last card is the face-up top
  discards: Record<Seat, Card[][]>;      // four piles per player, the last card of each on top
  building: Card[][];                    // the four shared building piles; a pile holds 1 up to 11 cards
  drawPile: Card[];                      // drawn from the end
  turnOf: Seat | null;                   // the player whose turn has been set up (hand refilled)
  passes: number;                        // turns ended in a row with nothing played or discarded
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: the viewer's own hand, and counts for the rest
export type PublicGameState = Omit<GameState, 'hands' | 'stocks' | 'drawPile'> & BasePublicState & {
  myHand: Card[];
  handCounts: Record<Seat, number>;
  stockTops: Record<Seat, Card | null>;
  stockCounts: Record<Seat, number>;
  drawCount: number;
};
