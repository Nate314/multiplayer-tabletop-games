// Rook rules shared by the browser (playable cards) and the server (validation).
//
// From Wikipedia's "Rook (card game)" article, section "Official rules", which it calls Tournament Rook, also known
// as Kentucky Discard:
// - Deck: the 1s to 4s are taken out of the 57-card Rook deck and the Rook Bird card is kept: 5 to 14 in red, yellow,
//   green and black, plus the Rook, 41 cards. Four players in two partnerships, partners sitting across.
// - Rank: 14 high down to 5 in each color. The Rook counts as the highest card of the trump suit, whatever trump is.
//   It may be played at any time, even when its holder could follow suit. If it is led, the others must play trump
//   if they can, and its holder must play it when trump is led and they hold no other trump.
// - Counters: each 5 is worth 5, each 10 and 14 is worth 10, and the Rook 20, so 120 points in all.
// - Deal: a five-card nest is set aside face down and the rest dealt, 9 cards each.
// - Bidding: starts left of the dealer and goes around in steps of 5, from 70 up to 120 (all the counters).
//   A player who passes cannot bid again that hand.
// - The high bidder takes the nest, lays any five cards aside, then names trump. The player left of the dealer
//   leads the first trick; players follow suit if they can, the highest trump or else the highest card of the
//   suit led takes the trick, and its winner leads next.
// - Last trick: whoever takes it captures the nest and scores the counters in it (the article's only last-trick bonus).
// - Scoring: a bidding team that takes at least its bid scores what it took, otherwise it loses its bid; the other
//   team scores what it took. The article plays to 300 and gives the win to the higher total if both pass it.
//   This game plays to 500 (the owner's choice); see the README.
import { handCounts, viewHand } from '../../shared/hands.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { FOUR_SEATS as SEATS, nextSeat, partnershipBroken, teamNames, teamOf, teamSeats } from '../../shared/partnerships.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type {
  Bidding, Card, Color, GameState, HandSummary, LastMove, Move, Play, PublicGameState, Result, RookCard, Seat, Team,
  TeamScores
} from './types.ts';

export { SEATS, nextSeat, teamNames, teamOf, teamSeats };

export const COLORS: Color[] = ['red', 'yellow', 'green', 'black'];
export const NUMBERS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const ROOK: RookCard = { color: 'rook' };
export const HAND_SIZE = 9;
export const NEST_SIZE = 5;
export const MIN_BID = 70;
export const MAX_BID = 120;
export const BID_STEP = 5;
export const TARGET_SCORE = 500;
const ROOK_POINTS = 20;

export function buildDeck(): Card[] {
  return [...COLORS.flatMap(color => NUMBERS.map((number): Card => ({ color, number }))), ROOK];
}

export function sameCard(a: Card, b: Card): boolean {
  if (a.color === 'rook' || b.color === 'rook') return a.color === b.color;
  return a.color === b.color && a.number === b.number;
}

export function cardName(card: Card): string {
  return card.color === 'rook' ? 'the Rook' : `${card.color} ${card.number}`;
}

export function cardPoints(card: Card): number {
  if (card.color === 'rook') return ROOK_POINTS;
  if (card.number === 5) return 5;
  return card.number === 10 || card.number === 14 ? 10 : 0;
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}

// The Rook belongs to the trump suit
export function suitOf(card: Card, trump: Color | null): Color | null {
  return card.color === 'rook' ? trump : card.color;
}

// The Rook always plays; otherwise a player who holds the suit led (the Rook counting as trump) must follow it
export function canPlayCard(hand: Card[], card: Card, trick: Play[], trump: Color | null): boolean {
  if (card.color === 'rook' || trick.length === 0) return true;
  const led = suitOf(trick[0].card, trump);
  return card.color === led || !hand.some(held => suitOf(held, trump) === led);
}

// How strong a card is in this trick: any trump beats the suit led, and the Rook beats every trump
function strength(card: Card, led: Color | null, trump: Color | null): number {
  if (card.color === 'rook') return 200;
  if (card.color === trump) return 100 + card.number;
  return card.color === led ? card.number : 0;
}

export function trickWinner(plays: Play[], trump: Color | null): Seat {
  const led = suitOf(plays[0].card, trump);
  return plays.reduce((best, play) =>
    strength(play.card, led, trump) > strength(best.card, led, trump) ? play : best).seat;
}

const NO_BIDDING: Bidding = { high: null, passed: [] };

// Everything that lasts only for one hand
const HAND_START = {
  phase: 'bidding',
  bidding: NO_BIDDING,
  bidder: null,
  bid: null,
  trump: null,
  trick: [],
  lastTrick: null,
  tricksWon: [0, 0],
  captured: [0, 0],
  roundSummary: null,
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    ...HAND_START,
    handNumber: 1,
    dealer: null,
    scores: [0, 0],
    hands: {},
    nest: []
  };
}

// A fresh shuffle: the nest from the top, then nine cards to each player. The dealer's left bids first.
export function dealHand(state: GameState, dealer: Seat, random: Random): GameState {
  const deck = shuffle(buildDeck(), random);
  const hands = Object.fromEntries(SEATS.map((seat, index) =>
    [seat, deck.slice(NEST_SIZE + index * HAND_SIZE, NEST_SIZE + (index + 1) * HAND_SIZE)]));
  return { ...state, ...HAND_START, dealer, hands, nest: deck.slice(0, NEST_SIZE), currentPlayer: nextSeat(dealer) };
}

// Before the first move the cards are dealt afresh, once four players are seated. Seat 4 deals the first hand.
export function resetLobby(state: GameState, random: Random): GameState {
  const empty: GameState = { ...state, ...HAND_START, handNumber: 1, dealer: null, scores: [0, 0], hands: {}, nest: [] };
  if (state.activePlayers.length < SEATS.length) return empty;
  return dealHand(empty, 4, random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, nest, captured: _captured, ...view } = state;
  const laidAside = state.bidder !== null && viewer === state.bidder && state.phase !== 'discard' && state.phase !== 'bidding';
  return {
    ...view,
    hand: viewHand(hands, viewer),
    handCounts: handCounts(hands),
    nestCount: nest.length,
    discards: laidAside ? nest : [],
    undoAvailable
  };
}

function isColor(value: unknown): value is Color {
  return COLORS.some(color => color === value);
}

function parseCard(value: unknown): Card | null {
  const input = asRecord(value);
  if (input?.color === 'rook') return ROOK;
  const number = input?.number;
  if (!isColor(input?.color) || typeof number !== 'number' || !NUMBERS.includes(number)) return null;
  return { color: input.color, number };
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'pass':
      return { type: 'pass' };
    case 'bid':
      return typeof input.amount === 'number' && Number.isFinite(input.amount) ? { type: 'bid', amount: input.amount } : null;
    case 'nameTrump':
      return isColor(input.color) ? { type: 'nameTrump', color: input.color } : null;
    case 'play': {
      const card = parseCard(input.card);
      return card ? { type: 'play', card } : null;
    }
    case 'discard': {
      if (!Array.isArray(input.cards)) return null;
      const cards = input.cards.map(parseCard);
      return cards.every(card => card !== null) ? { type: 'discard', cards: cards as Card[] } : null;
    }
    default:
      return null;
  }
}

// How the status line and the history describe a move, e.g. 'Bob bid 85' or 'Dan played red 12 and took the trick'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'bid':
      return lastMove.won ? `${name} bid ${lastMove.amount}, the most there is, and takes the nest` : `${name} bid ${lastMove.amount}`;
    case 'pass':
      if (lastMove.redeal) return `${name} passed. Everyone passed, so the cards are dealt again`;
      if (lastMove.won) return `${name} passed. ${playerNames[lastMove.won.seat]} won the bidding at ${lastMove.won.amount} and takes the nest`;
      return `${name} passed`;
    case 'discard':
      return `${name} laid aside ${NEST_SIZE} cards`;
    case 'nameTrump':
      return `${name} named ${lastMove.color} trump`;
    case 'play': {
      const played = `${name} played ${cardName(lastMove.card)}`;
      if (lastMove.trickWinner === null) return played;
      if (lastMove.trickWinner === lastMove.playerNumber) return `${played} and took the trick`;
      return `${played}; ${playerNames[lastMove.trickWinner]} took the trick`;
    }
  }
}

function recorded(state: GameState, lastMove: LastMove, gameStatus = describeMove(lastMove, state.playerNames)): GameState {
  return { ...state, lastMove, gameStatus };
}

// The next bidder who has not passed, or null when only the high bidder is left
function nextBidder(bidding: Bidding, from: Seat): Seat | null {
  let seat = nextSeat(from);
  for (let i = 0; i < 3; i++, seat = nextSeat(seat)) {
    if (!bidding.passed.includes(seat)) return seat;
  }
  return null;
}

// The high bidder adds the nest to their hand
function winBidding(state: GameState, high: { seat: Seat; amount: number }): GameState {
  return {
    ...state,
    phase: 'discard',
    bidder: high.seat,
    bid: high.amount,
    hands: { ...state.hands, [high.seat]: [...state.hands[high.seat], ...state.nest] },
    nest: [],
    currentPlayer: high.seat
  };
}

function bid(state: GameState, seat: Seat, amount: number): Result<GameState> {
  const high = state.bidding.high;
  if (!Number.isInteger(amount) || amount < MIN_BID) return { error: `Bid at least ${MIN_BID}` };
  if (amount > MAX_BID) return { error: `The highest bid is ${MAX_BID}` };
  if (amount % BID_STEP !== 0) return { error: `Bid in steps of ${BID_STEP}` };
  if (high && amount <= high.amount) return { error: `Bid more than ${high.amount}` };

  const bidding: Bidding = { ...state.bidding, high: { seat, amount } };
  const next = { ...state, bidding };
  const bidder = nextBidder(bidding, seat);
  if (amount === MAX_BID || bidder === null) {
    return { state: recorded(winBidding(next, { seat, amount }), { type: 'bid', playerNumber: seat, amount, won: true }) };
  }
  return { state: recorded({ ...next, currentPlayer: bidder }, { type: 'bid', playerNumber: seat, amount, won: false }) };
}

// A pass is final. When only the high bidder is left they win; when all four pass the deal moves left and starts again.
function pass(state: GameState, seat: Seat, random: Random): Result<GameState> {
  const bidding: Bidding = { ...state.bidding, passed: [...state.bidding.passed, seat] };
  const { high } = bidding;
  if (bidding.passed.length === SEATS.length) {
    const dealer = nextSeat(state.dealer ?? seat);
    return { state: recorded(dealHand(state, dealer, random), { type: 'pass', playerNumber: seat, won: null, redeal: true }) };
  }
  // Three passes leave only the high bidder
  if (high && bidding.passed.length === SEATS.length - 1) {
    const lastMove: LastMove = { type: 'pass', playerNumber: seat, won: high, redeal: false };
    const status = `${state.playerNames[high.seat]} won the bidding at ${high.amount} and takes the nest`;
    return { state: recorded(winBidding({ ...state, bidding }, high), lastMove, status) };
  }
  const next = { ...state, bidding, currentPlayer: nextBidder(bidding, seat) };
  return { state: recorded(next, { type: 'pass', playerNumber: seat, won: null, redeal: false }) };
}

function discard(state: GameState, seat: Seat, cards: Card[]): Result<GameState> {
  if (cards.length !== NEST_SIZE) return { error: `Lay aside exactly ${NEST_SIZE} cards` };
  if (cards.some((card, i) => cards.findIndex(other => sameCard(other, card)) !== i)) {
    return { error: `Lay aside ${NEST_SIZE} different cards` };
  }
  const hand = state.hands[seat];
  if (!cards.every(card => hand.some(held => sameCard(held, card)))) return { error: 'You do not have those cards' };
  const next: GameState = {
    ...state,
    phase: 'trump',
    hands: { ...state.hands, [seat]: hand.filter(held => !cards.some(card => sameCard(card, held))) },
    nest: cards
  };
  return { state: recorded(next, { type: 'discard', playerNumber: seat }) };
}

function nameTrump(state: GameState, seat: Seat, color: Color): GameState {
  const leader = nextSeat(state.dealer ?? seat);
  return recorded({ ...state, phase: 'play', trump: color, currentPlayer: leader }, { type: 'nameTrump', playerNumber: seat, color });
}

// Scores a finished hand. The first team at or over 500 wins, the higher total if both are; on a tie another hand is played.
function endHand(state: GameState, lastTrick: Seat): GameState {
  const bidder = state.bidder ?? lastTrick;
  const bid = state.bid ?? 0;
  const nestPoints = handPoints(state.nest);
  const points: TeamScores = [...state.captured];
  points[teamOf(lastTrick)] += nestPoints;
  const bidTeam = teamOf(bidder);
  const made = points[bidTeam] >= bid;
  const change: TeamScores = [...points];
  if (!made) change[bidTeam] = -bid;
  const scores: TeamScores = [state.scores[0] + change[0], state.scores[1] + change[1]];
  const summary: HandSummary = { handNumber: state.handNumber, bidder, bid, made, points, change, nestPoints, lastTrick, acknowledged: [] };
  const scored: GameState = { ...state, phase: 'handOver', scores, currentPlayer: null, roundSummary: summary };

  const bidderName = state.playerNames[bidder];
  const outcome = `${bidderName}'s team bid ${bid} and took ${points[bidTeam]}: ${made ? `they score ${points[bidTeam]}` : `they lose ${bid}`}`;
  const top = Math.max(...scores);
  if (top < TARGET_SCORE) return { ...scored, gameStatus: outcome };
  if (scores[0] === scores[1]) return { ...scored, gameStatus: `${outcome}. Both teams are tied at ${top}, so another hand is played` };
  const winner: Team = scores[0] > scores[1] ? 0 : 1;
  return {
    ...scored,
    isGameOver: true,
    winners: teamSeats(winner),
    gameStatus: `${teamNames(winner, state.playerNames)} win with ${top} points!`
  };
}

function play(state: GameState, seat: Seat, card: Card): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  if (!canPlayCard(hand, card, state.trick, state.trump)) {
    return { error: `Follow suit: play ${suitOf(state.trick[0].card, state.trump)}` };
  }
  const trick = [...state.trick, { seat, card }];
  const played: GameState = { ...state, hands: { ...state.hands, [seat]: hand.filter(held => !sameCard(held, card)) }, trick };
  if (trick.length < SEATS.length) {
    return { state: recorded({ ...played, currentPlayer: nextSeat(seat) }, { type: 'play', playerNumber: seat, card, trickWinner: null }) };
  }

  const winner = trickWinner(trick, state.trump);
  const team = teamOf(winner);
  const tricksWon: TeamScores = [...state.tricksWon];
  const captured: TeamScores = [...state.captured];
  tricksWon[team] += 1;
  captured[team] += handPoints(trick.map(p => p.card));
  const taken: GameState = { ...played, trick: [], lastTrick: { plays: trick, winner }, tricksWon, captured, currentPlayer: winner };
  const lastMove: LastMove = { type: 'play', playerNumber: seat, card, trickWinner: winner };
  if (Object.values(taken.hands).some(rest => rest.length > 0)) return { state: recorded(taken, lastMove) };
  const ended = endHand(taken, winner);
  return { state: { ...ended, lastMove } };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  const { phase } = state;
  switch (parsed.type) {
    case 'bid':
    case 'pass':
      if (phase !== 'bidding') return { error: 'The bidding is over' };
      return parsed.type === 'bid' ? bid(state, seat, parsed.amount) : pass(state, seat, random);
    case 'discard':
      if (phase !== 'discard') return { error: 'Only the bid winner lays aside cards, after the bidding' };
      return discard(state, seat, parsed.cards);
    case 'nameTrump':
      if (phase === 'discard') return { error: `Lay aside ${NEST_SIZE} cards first` };
      if (phase !== 'trump') return { error: 'Trump is named by the bid winner after the bidding' };
      return { state: nameTrump(state, seat, parsed.color) };
    case 'play':
      if (phase === 'bidding') return { error: 'Finish the bidding first' };
      if (phase !== 'play') return { error: 'Wait for trump to be named' };
      return play(state, seat, parsed.card);
  }
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
