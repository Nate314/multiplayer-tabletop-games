// Euchre rules shared by the browser (playable cards) and the server (validation).
//
// From Wikipedia's "Euchre" article, the standard North American game:
// - Deck: 24 cards, 9 to ace in each suit. Four players in two partnerships, partners sitting across.
// - Deal: five cards each; the four left over are the kitty, face down, and its top card is turned up.
// - Making trump, first round: from the dealer's left, each player passes or orders up the turned card's suit. If
//   someone orders it up, the dealer takes the turned card into their hand and discards one card face down.
// - Second round, if all four pass: each in turn passes or calls a different suit. If all pass again the hand is
//   thrown in and the deal passes to the left (the article's "screw the dealer" is a variant, not used here).
// - The player who made trump may go alone: their partner lays down their hand and sits the hand out.
// - Rank in trump: the jack of trump (right bower), the other jack of the same color (left bower), A, K, Q, 10, 9.
//   The left bower counts as a trump for the hand. Other suits run A, K, Q, J, 10, 9.
// - The dealer's left leads the first trick; follow suit if able, else play anything. The highest trump, else the
//   highest card of the suit led, wins, and the winner leads next.
// - Scoring: makers taking 3 or 4 tricks score 1, all 5 (a march) 2, a lone march 4. Makers who take fewer than 3
//   are euchred and the defenders score 2. Games are played to 5, 7 or 10; this game plays to 10.
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule, targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { cardName, rankValue, sameCard, standardDeck, SUITS } from '../../shared/playingCards.ts';
import { acknowledge, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { FOUR_SEATS as SEATS, nextSeat, partnerOf, partnershipBroken, teamNames, teamOf, teamSeats } from '../../shared/partnerships.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { canFollow, describeTrickPlay, trickWinner as sharedTrickWinner } from '../../shared/tricks.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, GameState, HandSummary, LastMove, Move, Play, PublicGameState, Result, Seat, Suit, Team, TeamScores } from './types.ts';

export { SEATS, nextSeat, partnerOf, teamNames, teamOf, teamSeats };

export { cardName, sameCard, SUITS };

export const RANKS: Card['rank'][] = ['9', '10', 'J', 'Q', 'K', 'A'];
export const HAND_SIZE = 5;
export const KITTY_SIZE = 3; // face down under the turned-up card
export const TRICKS = 5;
const TARGET_RULE = targetScoreRule(10, [5, 15]);
export const EUCHRE_RULES: HouseRule[] = [TARGET_RULE];

export const targetScore = (state: Pick<GameState, 'houseRules'>): number => houseRule(state, TARGET_RULE);
export const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };

export function buildDeck(): Card[] {
  return standardDeck({ ranks: RANKS });
}

const SAME_COLOR: Record<Suit, Suit> = { clubs: 'spades', spades: 'clubs', hearts: 'diamonds', diamonds: 'hearts' };

// The left bower belongs to the trump suit
export function suitOf(card: Card, trump: Suit | null): Suit {
  return trump !== null && card.rank === 'J' && card.suit === SAME_COLOR[trump] ? trump : card.suit;
}

// Within its suit: the right bower, then the left bower, above the ace
export function rankOf(card: Card, trump: Suit | null): number {
  if (card.rank === 'J' && trump !== null) {
    if (card.suit === trump) return 31;
    if (card.suit === SAME_COLOR[trump]) return 30;
  }
  return rankValue(card.rank, true);
}

export function canPlayCard(hand: Card[], card: Card, trick: Play[], trump: Suit | null): boolean {
  return canFollow(hand, card, trick, held => suitOf(held, trump));
}

export function trickWinner(plays: Play[], trump: Suit | null): Seat {
  return sharedTrickWinner(plays, card => suitOf(card, trump), card => rankOf(card, trump), trump);
}

// The partner of a lone maker, or null
export function sittingOut(state: Pick<GameState, 'alone' | 'maker'>): Seat | null {
  return state.alone && state.maker !== null ? partnerOf(state.maker) : null;
}

// The next seat to play, passing over a partner who sits out
function nextInPlay(state: GameState, seat: Seat): Seat {
  const next = nextSeat(seat);
  return next === sittingOut(state) ? nextSeat(next) : next;
}

// Everything that lasts only for one hand
const HAND_START = {
  phase: 'order',
  upcard: null,
  kitty: [],
  discard: null,
  passed: [],
  maker: null,
  trump: null,
  alone: false,
  trick: [],
  lastTrick: null,
  tricksWon: [0, 0],
  roundSummary: null,
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...HAND_START, handNumber: 1, dealer: null, scores: [0, 0], hands: {} };
}

// A fresh shuffle: five cards to each player, the next card turned up and three face down under it.
// The dealer's left speaks first.
export function dealHand(state: GameState, dealer: Seat, random: Random): GameState {
  const deck = shuffle(buildDeck(), random);
  const hands = Object.fromEntries(SEATS.map((seat, index) => [seat, deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)]));
  const rest = deck.slice(SEATS.length * HAND_SIZE);
  return { ...state, ...HAND_START, dealer, hands, upcard: rest[0], kitty: rest.slice(1), currentPlayer: nextSeat(dealer) };
}

// Before the first move the cards are dealt afresh, once four players are seated. Seat 4 deals the first hand.
export function resetLobby(state: GameState, random: Random): GameState {
  const empty: GameState = { ...state, ...HAND_START, handNumber: 1, dealer: null, scores: [0, 0], hands: {} };
  if (state.activePlayers.length < SEATS.length) return empty;
  return dealHand(empty, 4, random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, kitty: _kitty, discard, ...view } = state;
  return {
    ...view,
    hand: viewHand(hands, viewer),
    handCounts: handCounts(hands),
    discard: viewer !== null && viewer === state.dealer ? discard : null,
    undoAvailable
  };
}

function isSuit(value: unknown): value is Suit {
  return SUITS.some(suit => suit === value);
}

function parseCard(value: unknown): Card | null {
  const input = asRecord(value);
  const rank = RANKS.find(candidate => candidate === input?.rank);
  return rank && isSuit(input?.suit) ? { suit: input.suit, rank } : null;
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'orderUp':
    case 'pass':
      return { type: input.type };
    case 'nameTrump':
      return isSuit(input.suit) ? { type: 'nameTrump', suit: input.suit } : null;
    case 'goAlone':
      return typeof input.alone === 'boolean' ? { type: 'goAlone', alone: input.alone } : null;
    case 'discard':
    case 'play': {
      const card = parseCard(input.card);
      return card ? { type: input.type, card } : null;
    }
    default:
      return null;
  }
}

// How the status line and the history describe a move, e.g. 'Bob ordered up hearts' or 'Dan played ace of clubs'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'orderUp':
      return `${name} ordered up ${lastMove.suit}`;
    case 'pass':
      if (lastMove.redeal) return `${name} passed. Everyone passed twice, so the cards are dealt again`;
      if (lastMove.turnedDown) return `${name} passed. The turned card is turned down`;
      return `${name} passed`;
    case 'nameTrump':
      return `${name} named ${lastMove.suit} trump`;
    case 'goAlone':
      return lastMove.alone ? `${name} goes alone` : `${name} plays with their partner`;
    case 'discard':
      return `${name} discarded a card`;
    case 'play': {
      const played = `${name} played ${cardName(lastMove.card)}`;
      return describeTrickPlay(played, lastMove.playerNumber, lastMove.trickWinner, playerNames);
    }
  }
}

function recorded(state: GameState, lastMove: LastMove, gameStatus = describeMove(lastMove, state.playerNames)): GameState {
  return { ...state, lastMove, gameStatus };
}

function makeTrump(state: GameState, seat: Seat, suit: Suit): GameState {
  return { ...state, phase: 'alone', maker: seat, trump: suit, passed: [], currentPlayer: seat };
}

function orderUp(state: GameState, seat: Seat, upcard: Card): GameState {
  const next = makeTrump(state, seat, upcard.suit);
  const lastMove: LastMove = { type: 'orderUp', playerNumber: seat, suit: upcard.suit };
  // The dealer taking the card themselves is picking it up
  const status = seat === state.dealer ? `${state.playerNames[seat]} picked up the ${cardName(upcard)}` : undefined;
  return recorded(next, lastMove, status);
}

// The dealer's pass ends a round: the first turns the card down, the second throws the hand in
function pass(state: GameState, seat: Seat, random: Random): GameState {
  const passed = [...state.passed, seat];
  if (seat !== state.dealer) {
    return recorded({ ...state, passed, currentPlayer: nextSeat(seat) }, { type: 'pass', playerNumber: seat, turnedDown: false, redeal: false });
  }
  if (state.phase === 'order') {
    const next: GameState = { ...state, phase: 'name', passed: [], currentPlayer: nextSeat(seat) };
    return recorded(next, { type: 'pass', playerNumber: seat, turnedDown: true, redeal: false });
  }
  const dealer = nextSeat(seat);
  const lastMove: LastMove = { type: 'pass', playerNumber: seat, turnedDown: false, redeal: true };
  return recorded(dealHand(state, dealer, random), lastMove,
    `${state.playerNames[seat]} passed. Everyone passed twice, so ${state.playerNames[dealer]} deals again`);
}

function leader(state: GameState): Seat {
  return nextInPlay(state, state.dealer ?? 4);
}

// After the maker's decision: the dealer picks up the turned card if it was ordered up, unless they sit out
function goAlone(state: GameState, seat: Seat, alone: boolean): GameState {
  const decided: GameState = { ...state, alone };
  const dealer = state.dealer ?? 4;
  const pickUp = state.trump === state.upcard?.suit && sittingOut(decided) !== dealer;
  const next: GameState = pickUp && state.upcard
    ? { ...decided, phase: 'discard', hands: { ...state.hands, [dealer]: [...state.hands[dealer], state.upcard] }, currentPlayer: dealer }
    : { ...decided, phase: 'play', currentPlayer: leader(decided) };
  const out = sittingOut(decided);
  const name = state.playerNames[seat];
  const status = out === null ? undefined : `${name} goes alone; ${state.playerNames[out]} sits out`;
  return recorded(next, { type: 'goAlone', playerNumber: seat, alone }, status);
}

function discard(state: GameState, seat: Seat, card: Card): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  const next: GameState = {
    ...state,
    phase: 'play',
    hands: { ...state.hands, [seat]: hand.filter(held => !sameCard(held, card)) },
    discard: card,
    currentPlayer: leader(state)
  };
  return { state: recorded(next, { type: 'discard', playerNumber: seat }) };
}

// Scores a finished hand. Only one team scores in a hand, so the first to reach the target score (10 unless the host chose another) wins.
function endHand(state: GameState): GameState {
  const maker = state.maker ?? 1;
  const makers = teamOf(maker);
  const defenders: Team = makers === 0 ? 1 : 0;
  const taken = state.tricksWon[makers];
  const change: TeamScores = [0, 0];
  const names = teamNames(makers, state.playerNames);
  let outcome: string;
  if (taken === TRICKS) {
    change[makers] = state.alone ? 4 : 2;
    outcome = `${state.alone ? state.playerNames[maker] : names} took all 5 tricks${state.alone ? ' alone' : ''}: a march, ${change[makers]} points`;
  } else if (taken >= 3) {
    change[makers] = 1;
    outcome = `${names} made it with ${taken} tricks: 1 point`;
  } else {
    change[defenders] = 2;
    outcome = `${names} were euchred: ${teamNames(defenders, state.playerNames)} score 2`;
  }
  const scores: TeamScores = [state.scores[0] + change[0], state.scores[1] + change[1]];
  const summary: HandSummary = { handNumber: state.handNumber, maker, alone: state.alone, tricks: state.tricksWon, change, acknowledged: [] };
  const scored: GameState = { ...state, phase: 'handOver', scores, currentPlayer: null, roundSummary: summary, gameStatus: outcome };
  const winner = ([0, 1] as Team[]).find(team => scores[team] >= targetScore(state));
  if (winner === undefined) return scored;
  return {
    ...scored,
    isGameOver: true,
    winners: teamSeats(winner),
    gameStatus: `${outcome}. ${teamNames(winner, state.playerNames)} win with ${scores[winner]} points!`
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
  const players = SEATS.length - (sittingOut(state) === null ? 0 : 1);
  if (trick.length < players) {
    return { state: recorded({ ...played, currentPlayer: nextInPlay(state, seat) }, { type: 'play', playerNumber: seat, card, trickWinner: null }) };
  }

  const winner = trickWinner(trick, state.trump);
  const tricksWon: TeamScores = [...state.tricksWon];
  tricksWon[teamOf(winner)] += 1;
  const taken: GameState = { ...played, trick: [], lastTrick: { plays: trick, winner }, tricksWon, currentPlayer: winner };
  const lastMove: LastMove = { type: 'play', playerNumber: seat, card, trickWinner: winner };
  if (tricksWon[0] + tricksWon[1] < TRICKS) return { state: recorded(taken, lastMove) };
  return { state: { ...endHand(taken), lastMove } };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  const { phase } = state;
  const making = phase === 'order' || phase === 'name';
  switch (parsed.type) {
    case 'orderUp':
      if (phase === 'name') return { error: 'The turned card was turned down: name another suit or pass' };
      if (phase !== 'order' || !state.upcard) return { error: 'Trump has been made' };
      return { state: orderUp(state, seat, state.upcard) };
    case 'nameTrump':
      if (phase === 'order') return { error: 'Order up the turned card or pass' };
      if (phase !== 'name') return { error: 'Trump has been made' };
      if (parsed.suit === state.upcard?.suit) return { error: `${parsed.suit} was turned down: name another suit` };
      return { state: recorded(makeTrump(state, seat, parsed.suit), { type: 'nameTrump', playerNumber: seat, suit: parsed.suit }) };
    case 'pass':
      if (phase === 'alone') return { error: 'Say whether you go alone' };
      if (!making) return { error: 'Trump has been made' };
      return { state: pass(state, seat, random) };
    case 'goAlone':
      if (phase !== 'alone') return { error: 'Only the maker decides on going alone, once trump is made' };
      return { state: goAlone(state, seat, parsed.alone) };
    case 'discard':
      if (phase !== 'discard') return { error: 'Only the dealer discards, after picking up' };
      return discard(state, seat, parsed.card);
    case 'play':
      if (making || phase === 'alone') return { error: 'Trump has not been made yet' };
      if (phase !== 'play') return { error: 'The dealer is discarding' };
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
