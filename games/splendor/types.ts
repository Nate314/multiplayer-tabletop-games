// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Gem = 'white' | 'blue' | 'green' | 'red' | 'black';
export type Token = Gem | 'gold';
export type Gems = Record<Gem, number>;
export type Tokens = Record<Token, number>;
export type Level = 1 | 2 | 3;

export type Card = { id: number; level: Level; bonus: Gem; points: number; cost: Gems };
export type Noble = { id: number; points: number; cost: Gems };

// A reserved card, and whether it was taken unseen from the top of a deck (others then see only its level)
export type Reserved = { card: number; fromDeck: boolean };

export type PlayerState = {
  tokens: Tokens;
  cards: number[];    // bought, in the order bought
  reserved: Reserved[];
  nobles: number[];
};

// Where a card is taken from: a face-up slot, the top of a deck (reserve only) or the player's reserved cards (buy only)
export type MarketSlot = { kind: 'market'; level: Level; slot: number };
export type ReserveSource = MarketSlot | { kind: 'deck'; level: Level };
export type BuySource = MarketSlot | { kind: 'reserved'; index: number };

export type Move =
  | { type: 'takeThree'; colors: Gem[] }
  | { type: 'takeTwo'; color: Gem }
  | { type: 'reserve'; source: ReserveSource }
  | { type: 'buy'; source: BuySource }
  | { type: 'returnTokens'; tokens: Partial<Tokens> }
  | { type: 'chooseNoble'; noble: number }
  | { type: 'pass' };

// The rest of a turn after its action, owned by the player whose turn it is
export type Pending = { kind: 'returnTokens'; count: number } | { kind: 'chooseNoble'; nobles: number[] };

// What the last move did, for the status line and the history. A card reserved from a deck is never named.
export type LastMove = { seat: Seat; noble: number | null } & (
  | { type: 'takeThree'; colors: Gem[] }
  | { type: 'takeTwo'; color: Gem }
  | { type: 'reserve'; level: Level; card: number | null; gold: boolean }
  | { type: 'buy'; card: number; fromReserve: boolean; paid: Tokens }
  | { type: 'returnTokens'; tokens: Tokens }
  | { type: 'chooseNoble' }
  | { type: 'pass' }
);

// The full state, which never leaves the server: deck order and unseen reserved cards are hidden
export type GameState = BaseGameState & {
  supply: Tokens;
  decks: Record<Level, number[]>;              // card ids; the top is the last
  market: Record<Level, (number | null)[]>;    // four face-up slots per level; null once a deck runs out
  nobles: number[];                            // nobles still on the table
  players: Record<Seat, PlayerState>;
  pending: Pending | null;
  finalRound: boolean;                         // someone has reached 15; the game ends when the round does
  lastMove: LastMove | null;
  turnHolder: Seat | null;                     // whose turn it was, so a dismissal can tell whether the round wrapped
};

// A reserved card as one viewer sees it: card is null when it came unseen from a deck and is not theirs
export type PublicReserved = { level: Level; card: number | null };
export type PublicPlayer = Omit<PlayerState, 'reserved'> & { reserved: PublicReserved[] };

export type PublicGameState = Omit<GameState, 'decks' | 'players' | 'turnHolder'> & BasePublicState & {
  deckCounts: Record<Level, number>;
  players: Record<Seat, PublicPlayer>;
};
