// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';

export type TrainColor = 'pink' | 'white' | 'blue' | 'yellow' | 'orange' | 'black' | 'red' | 'green';
export type Card = TrainColor | 'locomotive';
export type RouteColor = TrainColor | 'gray';
export type Hand = Record<Card, number>;

export type City = { id: number; name: string; x: number; y: number; label?: 'left' | 'right' | 'above' | 'below' };

// One track between two cities. A double route is two tracks, each naming the other as its twin.
// `via` bends the drawn track through a control point, where a straight line would cross another city.
export type Route = { id: number; a: number; b: number; length: number; color: RouteColor; twin: number | null; via?: [number, number] };

export type Ticket = { id: number; a: number; b: number; points: number };

// The colored cards and locomotives paid for a route; `color` is null when it is paid with locomotives only
export type Payment = { color: TrainColor | null; locomotives: number };

// A face-up slot, or the top of the deck unseen
export type CardSource = number | 'deck';

export type Move =
  | { type: 'drawCard'; source: CardSource }
  | { type: 'claim'; route: number; payment: Payment }
  | { type: 'drawTickets' }
  | { type: 'keepTickets'; tickets: number[] }
  | { type: 'pass' };

// What the last move did, for the status line and the history. A card drawn from the deck is never named.
export type LastMove = { seat: Seat } & (
  | { type: 'drawCard'; card: Card | null; second: boolean; marketReset: boolean }
  | { type: 'claim'; route: number; payment: Payment }
  | { type: 'drawTickets'; count: number }
  | { type: 'keepTickets'; kept: number; returned: number; initial: boolean }
  | { type: 'pass' }
);

export type PlayerState = {
  hand: Hand;
  tickets: number[];
  offered: number[] | null; // tickets drawn and not yet chosen
  trains: number;
};

// A player's score once the game is over: routes, every ticket made or missed, and the longest path bonus
export type FinalScore = {
  routes: number;
  tickets: { ticket: number; completed: boolean }[];
  ticketPoints: number;
  longestPath: number;
  longestBonus: boolean;
  total: number;
};

// The full state, which never leaves the server: hands, tickets and both deck orders are hidden
export type GameState = BaseGameState & {
  phase: 'setup' | 'play';         // setup: each player in seat order keeps 2 or 3 of the tickets they were dealt
  playerCount: number;             // seated when the game began; 2 or 3 close the second track of a double route
  deck: Card[];                    // the top is the last
  discards: Card[];
  faceUp: (Card | null)[];         // five slots; null once the deck and discards run out
  ticketDeck: number[];            // the top is the first; returned tickets go to the end
  claimed: Record<number, Seat>;   // route id to owner
  players: Record<Seat, PlayerState>;
  drawing: Seat | null;            // has taken one card and takes a second to end the turn
  lastTurns: Seat[] | null;        // after someone is down to 2 trains: the turns still to play, in order
  passes: number;                  // turns passed in a row by players who could do nothing
  final: Record<Seat, FinalScore> | null;
  lastMove: LastMove | null;
};

// A player as one viewer sees them: their own hand, tickets and offer, and only the counts of everyone else's.
// Tickets are shown to everyone once the game is over.
export type PublicPlayer = {
  trains: number;
  cardCount: number;
  ticketCount: number;
  offeredCount: number;
  hand: Hand | null;
  tickets: number[] | null;
  offered: number[] | null;
};

export type PublicGameState = Omit<GameState, 'deck' | 'discards' | 'ticketDeck' | 'players'> & BasePublicState & {
  deckCount: number;
  discardCount: number;
  ticketDeckCount: number;
  players: Record<Seat, PublicPlayer>;
};
