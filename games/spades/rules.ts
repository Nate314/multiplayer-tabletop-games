// Spades rules shared by the browser (playable cards) and the server (validation).
//
// From Wikipedia's "Spades (card game)" article:
// - Four players in two partnerships, partners sitting across. The whole 52-card deck is dealt, 13 cards each, and the
//   deal passes to the left after each hand.
// - Bidding starts left of the dealer and goes around once, ending with the dealer. Each player bids the tricks they
//   expect to take, or nil (zero). The partners' bids are added together for the team's contract.
// - The player left of the dealer leads the first trick. Players follow suit if they can, otherwise play any card.
//   Spades are always trump: the highest spade takes the trick, else the highest card of the suit led, ace high.
//   The winner leads the next trick.
// - Breaking spades (the article's common rule, and the spec's): spades may not be led until a spade has been played
//   on another suit, unless the leader holds nothing but spades.
// - Scoring: a team that takes at least its contract scores 10 per trick bid and 1 per overtrick (bag); a team that
//   does not loses 10 per trick bid. Every 10 bags cost 100 and the count carries on past 10. A nil scores 100 if the
//   nil bidder takes no trick and loses 100 if they take any, on top of the partner's contract. Both partners' tricks
//   count toward the contract.
// - The first team to 500 wins; a team that falls to -200 loses. On a tie another hand is played.
import { asRecord } from '../../shared/messages.ts';
import { RANKS, SUITS, cardName, rankValue, sameCard, standardDeck } from '../../shared/playingCards.ts';
import { acknowledge, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { FOUR_SEATS as SEATS, nextSeat, partnershipBroken, teamNames, teamOf, teamSeats } from '../../shared/partnerships.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { canFollow, trickWinner } from '../../shared/tricks.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, GameState, HandSummary, LastMove, Move, Play, PublicGameState, Result, Seat, Team, TeamResult, TeamScores } from './types.ts';

export { SEATS, nextSeat, teamNames, teamOf, teamSeats };

export const HAND_SIZE = 13;
export const MAX_BID = 13;
export const TARGET_SCORE = 500;
export const LOSING_SCORE = -200;
export const BAG_LIMIT = 10;
const BAG_PENALTY = 100;
const NIL_POINTS = 100;

const suitOf = (card: Card) => card.suit;
const rankOf = (card: Card) => rankValue(card.rank, true);

// Follow suit if able; a spade may be led only once spades are broken, or from a hand of nothing but spades
export function canPlayCard(hand: Card[], card: Card, trick: Play[], spadesBroken: boolean): boolean {
  if (trick.length === 0 && card.suit === 'spades' && !spadesBroken) return hand.every(held => held.suit === 'spades');
  return canFollow(hand, card, trick, suitOf);
}

export function trickWinnerOf(trick: Play[]): Seat {
  return trickWinner(trick, suitOf, rankOf, 'spades');
}

const NO_TRICKS: Record<Seat, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

// Everything that lasts only for one hand
const HAND_START = {
  phase: 'bidding',
  bids: {},
  tricksTaken: NO_TRICKS,
  trick: [],
  lastTrick: null,
  spadesBroken: false,
  roundSummary: null,
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...HAND_START, handNumber: 1, dealer: null, scores: [0, 0], bags: [0, 0], hands: {} };
}

// A fresh shuffle, 13 cards to each player. The dealer's left bids first.
export function dealHand(state: GameState, dealer: Seat, random: Random): GameState {
  const deck = shuffle(standardDeck(), random);
  const hands = Object.fromEntries(SEATS.map((seat, index) => [seat, deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)]));
  return { ...state, ...HAND_START, dealer, hands, currentPlayer: nextSeat(dealer) };
}

// Before the first move the cards are dealt afresh, once four players are seated. Seat 4 deals the first hand.
export function resetLobby(state: GameState, random: Random): GameState {
  const empty: GameState = { ...state, ...HAND_START, handNumber: 1, dealer: null, scores: [0, 0], bags: [0, 0], hands: {} };
  if (state.activePlayers.length < SEATS.length) return empty;
  return dealHand(empty, 4, random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, ...view } = state;
  return {
    ...view,
    hand: viewer === null ? [] : hands[viewer] ?? [],
    handCounts: Object.fromEntries(Object.entries(hands).map(([seat, hand]) => [seat, hand.length])),
    undoAvailable
  };
}

function parseCard(value: unknown): Card | null {
  const input = asRecord(value);
  const suit = SUITS.find(known => known === input?.suit);
  const rank = RANKS.find(known => known === input?.rank);
  return suit && rank ? { suit, rank } : null;
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'bid':
      return typeof input.tricks === 'number' ? { type: 'bid', tricks: input.tricks } : null;
    case 'play': {
      const card = parseCard(input.card);
      return card ? { type: 'play', card } : null;
    }
    default:
      return null;
  }
}

export const bidName = (tricks: number) => (tricks === 0 ? 'nil' : String(tricks));

// How the status line and the history describe a move, e.g. 'Bob bid nil' or 'Dan played the ace of hearts and took the trick'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'bid') return `${name} bid ${bidName(lastMove.tricks)}`;
  const played = `${name} played the ${cardName(lastMove.card)}`;
  if (lastMove.trickWinner === null) return played;
  if (lastMove.trickWinner === lastMove.playerNumber) return `${played} and took the trick`;
  return `${played}; ${playerNames[lastMove.trickWinner]} took the trick`;
}

function recorded(state: GameState, lastMove: LastMove): GameState {
  return { ...state, lastMove, gameStatus: describeMove(lastMove, state.playerNames) };
}

// Bidding goes around once; after the dealer's bid the dealer's left leads
function bid(state: GameState, seat: Seat, tricks: number): Result<GameState> {
  if (!Number.isInteger(tricks) || tricks < 0 || tricks > MAX_BID) return { error: `Bid 0 (nil) to ${MAX_BID} tricks` };
  const bids = { ...state.bids, [seat]: tricks };
  const done = Object.keys(bids).length === SEATS.length;
  const next: GameState = done
    ? { ...state, bids, phase: 'play', currentPlayer: nextSeat(state.dealer ?? seat) }
    : { ...state, bids, currentPlayer: nextSeat(seat) };
  return { state: recorded(next, { type: 'bid', playerNumber: seat, tricks }) };
}

// One team's hand: the contract, bags, the penalty for ten bags, and each nil on its own
function scoreTeam(state: GameState, team: Team): { result: TeamResult; bags: number } {
  const seats = teamSeats(team);
  const contract = seats.reduce((sum, seat) => sum + state.bids[seat], 0);
  const tricks = seats.reduce((sum, seat) => sum + state.tricksTaken[seat], 0);
  const nils = seats.filter(seat => state.bids[seat] === 0).map(seat => ({ seat, made: state.tricksTaken[seat] === 0 }));
  const made = tricks >= contract;
  // With both partners on nil there is no contract, so no bags either
  const overtricks = contract > 0 && made ? tricks - contract : 0;
  let change = made ? 10 * contract + overtricks : -10 * contract;
  for (const nil of nils) change += nil.made ? NIL_POINTS : -NIL_POINTS;
  let bags = state.bags[team] + overtricks;
  const bagPenalty = bags >= BAG_LIMIT;
  if (bagPenalty) {
    change -= BAG_PENALTY;
    bags -= BAG_LIMIT;
  }
  return { result: { contract, tricks, made, overtricks, bagPenalty, nils, change }, bags };
}

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

// Scores a finished hand. At 500 or more, or at -200 or less, the higher total wins; on a tie another hand is played.
function endHand(state: GameState): GameState {
  const [first, second] = [scoreTeam(state, 0), scoreTeam(state, 1)];
  const teams: [TeamResult, TeamResult] = [first.result, second.result];
  const scores: TeamScores = [state.scores[0] + teams[0].change, state.scores[1] + teams[1].change];
  const summary: HandSummary = { handNumber: state.handNumber, teams, acknowledged: [] };
  const scored: GameState = { ...state, phase: 'handOver', scores, bags: [first.bags, second.bags], currentPlayer: null, roundSummary: summary };

  const names = (team: Team) => teamNames(team, state.playerNames);
  const outcome = `${names(0)} score ${signed(teams[0].change)}, ${names(1)} score ${signed(teams[1].change)}`;
  const top = Math.max(...scores);
  const bottom = Math.min(...scores);
  if (top < TARGET_SCORE && bottom > LOSING_SCORE) return { ...scored, gameStatus: outcome };
  if (scores[0] === scores[1]) return { ...scored, gameStatus: `${outcome}. Both teams are tied at ${top}, so another hand is played` };
  const winner: Team = scores[0] > scores[1] ? 0 : 1;
  const loser: Team = winner === 0 ? 1 : 0;
  const gameStatus = top >= TARGET_SCORE
    ? `${names(winner)} win with ${top} points!`
    : `${names(loser)} fell to ${bottom}: ${names(winner)} win`;
  return { ...scored, isGameOver: true, winners: teamSeats(winner), gameStatus };
}

function play(state: GameState, seat: Seat, card: Card): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  if (!canPlayCard(hand, card, state.trick, state.spadesBroken)) {
    return state.trick.length === 0
      ? { error: 'Spades are not broken yet: lead another suit' }
      : { error: `Follow suit: play ${state.trick[0].card.suit}` };
  }
  const trick = [...state.trick, { seat, card }];
  const played: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: hand.filter(held => !sameCard(held, card)) },
    trick,
    spadesBroken: state.spadesBroken || card.suit === 'spades'
  };
  if (trick.length < SEATS.length) {
    return { state: recorded({ ...played, currentPlayer: nextSeat(seat) }, { type: 'play', playerNumber: seat, card, trickWinner: null }) };
  }

  const winner = trickWinnerOf(trick);
  const tricksTaken = { ...state.tricksTaken, [winner]: state.tricksTaken[winner] + 1 };
  const taken = recorded(
    { ...played, trick: [], lastTrick: { plays: trick, winner }, tricksTaken, currentPlayer: winner },
    { type: 'play', playerNumber: seat, card, trickWinner: winner }
  );
  if (Object.values(taken.hands).some(rest => rest.length > 0)) return { state: taken };
  return { state: endHand(taken) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (parsed.type === 'bid') {
    if (state.phase !== 'bidding') return { error: 'The bidding is over' };
    return bid(state, seat, parsed.tricks);
  }
  if (state.phase === 'bidding') return { error: 'Finish the bidding first' };
  if (state.phase !== 'play') return { error: 'The hand is over' };
  return play(state, seat, parsed.card);
}

const ROUND: RoundAccess<GameState, HandSummary> = {
  get: state => state.roundSummary,
  set: (state, roundSummary) => ({ ...state, roundSummary }),
  noun: 'hand'
};

// Deals the next hand once every connected player has acknowledged the summary. The deal passes to the left.
function startNextHandIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;
  const dealer = nextSeat(state.dealer ?? 4);
  const handNumber = state.handNumber + 1;
  const next = dealHand({ ...state, handNumber }, dealer, random);
  return { ...next, gameStatus: `Hand ${handNumber}: ${state.playerNames[dealer]} deals` };
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  return acknowledge(state, seat, ROUND, next => startNextHandIfReady(next, random));
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  if (asRecord(action)?.type === 'acknowledgeRound') return acknowledgeRound(state, seat, random);
  return { error: 'Unknown action' };
}

export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  return partnershipBroken(state, seat);
}

// The next hand may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextHandIfReady(state, random);
}
