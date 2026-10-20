// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';
import type { PlayingCard } from '../../shared/playingCards.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';
export type { PlayingCard };

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type Move =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number }; // the total bet this round; a bet when nobody has bet yet

// Not turn-bound and not undoable; only between hands
export type Action =
  | { type: 'acknowledgeRound' }
  | { type: 'voteEnd'; yes: boolean };

// `to` is the player's total bet this round after the move and `paid` what it cost; `allIn` when it took their last chip;
// `bet` when it was the first bet of the round
export type LastMove = { type: Move['type']; playerNumber: Seat; to: number; paid: number; allIn: boolean; bet: boolean };

// One pot: the main pot first, then each side pot. Only `eligible` players can win it.
export type Pot = { amount: number; eligible: Seat[] };

// A pot as it was paid out; hand is null when nobody else could contest it (everyone else folded, or an uncalled bet).
// `uncalled` is the part of an uncontested pot that was the winner's own bet nobody matched; the rest was won.
export type PaidPot = { amount: number; winners: Seat[]; hand: string | null; uncalled: number };

// How the last hand went, shown until everyone with chips presses Continue
export type HandResult = {
  handNumber: number;
  showdown: boolean;
  shown: Record<Seat, { cards: PlayingCard[]; hand: string }>; // the hands still in at a showdown; empty otherwise
  pots: PaidPot[];
  won: Record<Seat, number>;
  acknowledged: Seat[];
};

// The full state, which never leaves the server: the deck and other players' hole cards are hidden
export type GameState = BaseGameState & {
  handNumber: number; // 0 until the first deal
  button: Seat | null;
  chips: Record<Seat, number>; // the stack in front of each player, not counting what they have bet
  holeCards: Record<Seat, PlayingCard[]>; // the players dealt into this hand
  deck: PlayingCard[]; // the top card is the last one
  board: PlayingCard[];
  street: Street;
  dealtIn: Seat[]; // who was dealt this hand: everyone holding chips when it started
  folded: Seat[];
  bets: Record<Seat, number>; // this betting round
  contributed: Record<Seat, number>; // this hand, all rounds, including players who have left
  currentBet: number; // the highest bet this round
  raiseSize: number; // the last full bet or raise this round; the next raise must be at least this much more
  // The current bet when each player last acted this round. A player who has acted may raise again only if the bet
  // has gone up by a full raise since; a short all-in does not reopen the betting.
  actedAt: Record<Seat, number>;
  handResult: HandResult | null;
  endVotes: Seat[]; // players with chips who voted to end the game, between hands
  lastMove: LastMove | null;
};

// The game state as the server sends it to one browser: only the viewer's own hole cards
export type PublicGameState = Omit<GameState, 'holeCards' | 'deck'> & BasePublicState & {
  myCards: PlayingCard[]; // empty for the history and for a player not in the hand
  pots: Pot[]; // what is in the middle, from every bet so far
};
