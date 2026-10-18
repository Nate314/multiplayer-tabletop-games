// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type ColorGroup = 'brown' | 'lightBlue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkBlue';

export type DeckName = 'chance' | 'chest';

// One of the 40 board spaces, numbered 0 (GO) to 39 (Boardwalk) in the direction of play
export type Space =
  | { kind: 'street'; name: string; group: ColorGroup; price: number; mortgage: number; houseCost: number; rents: number[] }
  | { kind: 'railroad' | 'utility'; name: string; price: number; mortgage: number }
  | { kind: 'tax'; name: string; amount: number }
  | { kind: 'card'; name: string; deck: DeckName }
  | { kind: 'go' | 'jail' | 'parking' | 'goToJail'; name: string };

export type OwnableSpace = Extract<Space, { price: number }>;

// What a card does when it is drawn
export type CardEffect =
  | { type: 'advance'; to: number } // collect $200 when passing GO
  | { type: 'nearest'; kind: 'railroad' | 'utility' } // owned: double railroad rent, or ten times a new roll
  | { type: 'back'; spaces: number }
  | { type: 'goToJail' }
  | { type: 'jailCard' }
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'payEach'; amount: number } // to every other player
  | { type: 'collectEach'; amount: number } // from every other player
  | { type: 'repairs'; house: number; hotel: number };

export type Card = { text: string; effect: CardEffect };

// Money `debtor` owes and cannot pay yet; null creditor is the bank. The turn waits for the first debt.
export type Debt = { debtor: Seat; creditor: Seat | null; amount: number; reason: string };

// Bidding is open to every player still in the game; a pass is final, and the last bidder standing buys
export type Auction = { space: number; highBid: number; highBidder: Seat | null; passed: Seat[] };

// Who just received mortgaged properties (in a trade or a bankruptcy) and must lift or keep each mortgage
export type MortgageDecision = { seat: Seat; spaces: number[] };

export type TradeSide = { properties: number[]; cash: number; jailCards: number };

// `from` offers to give `give` and asks for `get` from `to`
export type Trade = { from: Seat; to: Seat; give: TradeSide; get: TradeSide };

export type Move =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'build'; space: number }
  | { type: 'sellBuilding'; space: number }
  | { type: 'mortgage'; space: number }
  | { type: 'unmortgage'; space: number }
  | { type: 'payJailFine' }
  | { type: 'useJailCard' }
  | { type: 'endTurn' }
  | { type: 'declareBankruptcy' }
  | { type: 'liftMortgages'; spaces: number[] }; // lifts these received mortgages for 110%, keeps the rest for 10%

// Not turn-bound and not undoable
export type Action =
  | { type: 'bid'; amount: number }
  | { type: 'passBid' }
  | { type: 'offerTrade'; to: Seat; give: TradeSide; get: TradeSide }
  | { type: 'answerTrade'; accept: boolean }
  | { type: 'cancelTrade' };

// The move that produced a state and what followed from it, e.g. ['rolled 3 and 4', 'moved to Chance']
export type LastMove = { type: Move['type']; playerNumber: Seat; events: string[] };

export type DrawnCard = { deck: DeckName; index: number; seat: Seat };

// The full state. Only the order of the two card decks is hidden.
export type GameState = BaseGameState & {
  cash: Record<Seat, number>;
  positions: Record<Seat, number>;
  jailed: Record<Seat, number>; // a seat in jail, with how many rolls for doubles it has failed
  jailCards: Record<Seat, DeckName[]>; // Get Out of Jail Free cards held, by the deck they go back to
  bankrupt: Seat[];
  owners: Record<number, Seat>; // space to owner; a space with no entry belongs to the bank
  buildings: Record<number, number>; // 1 to 4 houses, 5 is a hotel
  mortgaged: number[];
  decks: Record<DeckName, number[]>; // card indices, top first; a held jail card is out of its deck
  turnHolder: Seat | null; // whose turn it is; currentPlayer is whoever must act now, such as a debtor
  canRoll: boolean; // the turn holder still has a roll this turn (the first, or after doubles)
  doublesRolled: number; // doubles in a row this turn
  dice: [number, number] | null; // the most recent roll
  pendingBuy: number | null; // the space the turn holder may buy, or decline to start an auction
  auction: Auction | null;
  auctionQueue: number[]; // spaces of a player bankrupt to the bank, auctioned one after another
  debts: Debt[];
  trade: Trade | null; // one open offer at a time
  mortgageDecisions: MortgageDecision[]; // the game waits for the first, after any debts
  drawnCard: DrawnCard | null; // the last card drawn, shown until the next one
  log: string[]; // the most recent events, newest last
  lastMove: LastMove | null;
};

// Everything but the deck order, which is what the browser sees and what read-only rule checks need
export type TableState = Omit<GameState, 'decks'>;

export type PublicGameState = TableState & BasePublicState & {
  deckCounts: Record<DeckName, number>;
};
