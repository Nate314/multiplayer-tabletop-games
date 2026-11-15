// Cribbage rules for the deal, the crib, the cut and pegging; the show is in show.ts.
//
// From Wikipedia's "Cribbage" article:
// - Deal: 2 players get 6 cards and lay 2 in the crib; 3 players get 5, lay 1, and 1 card from the deck goes to the
//   crib; 4 players in partnerships across the table get 5 and lay 1. The crib belongs to the dealer.
// - The player after the dealer cuts the starter. A Jack scores 2 to the dealer (his heels).
// - Pegging: from the dealer's left, each plays a card and calls the count, never past 31. Fifteen and 31 score 2,
//   pairs and runs score as made. A player who cannot play says Go; once nobody can, the last to play scores 1 and the
//   count starts again. The last card of all scores 1 (a 31 scores only its 2).
// - The first side to the target score (121, or 61) wins at once.
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { partnershipBroken, teamNames, teamOf, teamSeats } from '../../shared/partnerships.ts';
import { cardName, RANKS, sameCard, standardDeck, SUITS } from '../../shared/playingCards.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { cardValue, describeItems, pegItems, playable, totalOf } from './scoring.ts';
import { TARGET_RULE } from './options.ts';
import type { Card, GameState, LastMove, Move, PublicGameState, Result, ScoreItem, Seat, Side } from './types.ts';

export const targetScore = (state: Pick<GameState, 'houseRules'>): number => houseRule(state, TARGET_RULE);

const HAND_AFTER_DISCARD = 4;
const handSize = (state: GameState) => (state.activePlayers.length === 2 ? 6 : 5);

// Partnerships at 4. A seat that left keeps its name, so a broken partnership still ranks by team.
const partnerships = (state: Pick<GameState, 'playerNames'>) => Object.keys(state.playerNames).length === 4;

export function sideOf(state: Pick<GameState, 'playerNames'>, seat: Seat): Side {
  return partnerships(state) ? teamOf(seat) : seat;
}

const sidesOf = (state: GameState): Side[] => (partnerships(state) ? [0, 1] : state.activePlayers);
const sideName = (state: GameState, side: Side) => (partnerships(state) ? teamNames(side === 0 ? 0 : 1, state.playerNames) : state.playerNames[side]);

// Everything that lasts only for one hand
const HAND_START = {
  phase: 'discard',
  crib: [],
  deck: [],
  starter: null,
  pile: [],
  count: 0,
  saidGo: [],
  shows: [],
  showIndex: 0,
  roundSummary: null,
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...HAND_START, handNumber: 1, dealer: null, hands: {}, played: {}, scores: {}, pegs: {} };
}

// A fresh shuffle. At 3 players the deck's top card starts the crib. Everyone discards at once, so no one has the turn.
function dealHand(state: GameState, dealer: Seat, random: Random): GameState {
  const deck = shuffle(standardDeck(), random);
  const seats = state.activePlayers;
  const size = handSize(state);
  const hands = Object.fromEntries(seats.map((seat, i) => [seat, deck.slice(i * size, (i + 1) * size)]));
  const rest = deck.slice(seats.length * size);
  const crib = seats.length === 3 ? rest.splice(0, 1) : [];
  const played = Object.fromEntries(seats.map(seat => [seat, []]));
  return { ...state, ...HAND_START, dealer, hands, crib, deck: rest, played, currentPlayer: null };
}

// Each seat is dealt one card and the lowest deals (ace low); a tie deals again
function cutForDeal(seats: Seat[], random: Random): { dealer: Seat; card: Card } {
  for (;;) {
    const deck = shuffle(standardDeck(), random);
    const low = Math.min(...seats.map((_, i) => RANKS.indexOf(deck[i].rank)));
    const lows = seats.filter((_, i) => RANKS.indexOf(deck[i].rank) === low);
    if (lows.length === 1) return { dealer: lows[0], card: deck[seats.indexOf(lows[0])] };
  }
}

export function resetLobby(state: GameState, random: Random): GameState {
  const sides = sidesOf(state);
  const reset: GameState = {
    ...state,
    ...HAND_START,
    handNumber: 1,
    dealer: null,
    hands: {},
    played: {},
    scores: Object.fromEntries(sides.map(side => [side, 0])),
    pegs: Object.fromEntries(sides.map(side => [side, { front: 0, back: 0 }]))
  };
  if (state.activePlayers.length < 2) return reset;
  const { dealer, card } = cutForDeal(state.activePlayers, random);
  return { ...dealHand(reset, dealer, random), gameStatus: `${state.playerNames[dealer]} cut low with the ${cardName(card)} and deals` };
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, crib, deck: _deck, ...view } = state;
  return { ...view, hand: viewHand(hands, viewer), handCounts: handCounts(hands), cribCount: crib.length, undoAvailable };
}

function parseCard(value: unknown): Card | null {
  const input = asRecord(value);
  const rank = RANKS.find(candidate => candidate === input?.rank);
  const suit = SUITS.find(candidate => candidate === input?.suit);
  return rank && suit ? { rank, suit } : null;
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'discard': {
      if (!Array.isArray(input.cards)) return null;
      const cards = input.cards.map(parseCard);
      return cards.every(card => card !== null) ? { type: 'discard', cards } : null;
    }
    case 'cut':
    case 'go':
      return { type: input.type };
    case 'play': {
      const card = parseCard(input.card);
      return card ? { type: 'play', card } : null;
    }
    default:
      return null;
  }
}

export function allowsOutOfTurn(state: GameState, _seat: Seat, move: unknown): boolean {
  return state.phase === 'discard' && asRecord(move)?.type === 'discard';
}

// Scores `items` for `side`: the back peg leapfrogs to the new front. Reaching the target ends the game at once.
export function addPoints(state: GameState, side: Side, items: ScoreItem[]): GameState {
  const points = totalOf(items);
  if (!points) return state;
  const score = state.scores[side] + points;
  const scored: GameState = {
    ...state,
    scores: { ...state.scores, [side]: score },
    pegs: { ...state.pegs, [side]: { front: score, back: state.pegs[side].front } }
  };
  if (score < targetScore(state)) return scored;
  const win = `${sideName(state, side)} ${partnerships(state) ? 'win' : 'wins'} with ${score} points!`;
  return {
    ...scored,
    isGameOver: true,
    currentPlayer: null,
    winners: partnerships(state) ? teamSeats(side === 0 ? 0 : 1) : [side],
    gameStatus: [state.gameStatus, win].filter(Boolean).join('. ')
  };
}

function recorded(state: GameState, lastMove: LastMove, gameStatus: string): GameState {
  return { ...state, lastMove, gameStatus };
}

const scoredText = (items: ScoreItem[]) => (items.length ? `. ${describeItems(items)}` : '');

function discard(state: GameState, seat: Seat, cards: Card[]): Result<GameState> {
  const hand = state.hands[seat] ?? [];
  if (hand.length === HAND_AFTER_DISCARD) return { error: 'Your cards are already in the crib' };
  const wanted = handSize(state) - HAND_AFTER_DISCARD;
  if (cards.length !== wanted) return { error: `Discard ${wanted} ${wanted === 1 ? 'card' : 'cards'} to the crib` };
  const kept = hand.filter(held => !cards.some(card => sameCard(card, held)));
  if (kept.length !== HAND_AFTER_DISCARD) return { error: 'You do not have those cards' };
  const laid: GameState = { ...state, hands: { ...state.hands, [seat]: kept }, crib: [...state.crib, ...cards] };
  const name = state.playerNames[seat];
  const lastMove: LastMove = { type: 'discard', playerNumber: seat };
  if (waitingOn(laid).length) return { state: recorded(laid, lastMove, `${name} laid ${wanted === 1 ? 'a card' : 'two cards'} in the crib`) };
  const cutter = nextActivePlayer(state, state.dealer ?? seat);
  const next: GameState = { ...laid, phase: 'cut', currentPlayer: cutter };
  return { state: recorded(next, lastMove, `The crib is laid: ${cutter === null ? '' : state.playerNames[cutter]} cuts the starter`) };
}

// The starter is the card at a random cut of the deck. Pegging starts from the cutter.
function cut(state: GameState, seat: Seat, random: Random): GameState {
  const at = Math.floor(random() * state.deck.length);
  const starter = state.deck[at];
  const deck = [...state.deck.slice(at + 1), ...state.deck.slice(0, at)];
  const dealer = state.dealer ?? seat;
  const heels = starter.rank === 'J';
  const status = `${state.playerNames[seat]} cut the ${cardName(starter)}${heels ? `. His heels: ${state.playerNames[dealer]} scores 2` : ''}`;
  const next = recorded({ ...state, deck, starter, phase: 'pegging', currentPlayer: seat }, { type: 'cut', playerNumber: seat, starter, heels }, status);
  return heels ? addPoints(next, sideOf(state, dealer), [{ kind: 'heels', cards: [starter], points: 2 }]) : next;
}

// The next seat after `from` that holds cards and has not said Go, coming round to `from` itself last
function nextToPlay(state: GameState, from: Seat): Seat | null {
  const seats = state.activePlayers;
  const start = seats.indexOf(from);
  const order = [...seats.slice(start + 1), ...seats.slice(0, start + 1)];
  return order.find(seat => state.hands[seat]?.length && !state.saidGo.includes(seat)) ?? null;
}

const allPlayedOut = (state: GameState) => state.activePlayers.every(seat => !state.hands[seat]?.length);

// After a play or a Go: a reset clears the count, and once every hand is played out the show follows
function continuePegging(state: GameState, from: Seat, reset: boolean): GameState {
  const next = reset ? { ...state, pile: [], count: 0, saidGo: [] } : state;
  if (allPlayedOut(next)) return { ...next, phase: 'show', currentPlayer: null };
  return { ...next, currentPlayer: nextToPlay(next, from) };
}

function play(state: GameState, seat: Seat, card: Card): Result<GameState> {
  const hand = state.hands[seat] ?? [];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  if (!playable([card], state.count).length) return { error: 'That card would take the count past 31' };
  const pile = [...state.pile, { seat, card }];
  const count = state.count + cardValue(card.rank);
  const after: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: hand.filter(held => !sameCard(held, card)) },
    played: { ...state.played, [seat]: [...(state.played[seat] ?? []), card] },
    pile,
    count
  };
  const items = pegItems(pile.map(p => p.card), count);
  // Nobody can go on: the last card of the count scores 1, unless it made 31
  const stuck = count !== 31 && nextToPlay(after, seat) === null;
  if (stuck) items.push({ kind: allPlayedOut(after) ? 'lastCard' : 'go', cards: [card], points: 1 });
  const status = `${state.playerNames[seat]} played the ${cardName(card)} for ${count}${scoredText(items)}`;
  const scored = addPoints(recorded(after, { type: 'play', playerNumber: seat, card, items }, status), sideOf(state, seat), items);
  return { state: scored.isGameOver ? scored : continuePegging(scored, seat, count === 31 || stuck) };
}

// Once nobody can play, the last to play scores 1 and the count starts again
function sayGo(state: GameState, seat: Seat): Result<GameState> {
  const hand = state.hands[seat] ?? [];
  if (!hand.length) return { error: 'You have no cards left' };
  if (playable(hand, state.count).length) return { error: 'You have a card you can play' };
  const after: GameState = { ...state, saidGo: [...state.saidGo, seat] };
  const name = state.playerNames[seat];
  const next = nextToPlay(after, seat);
  if (next !== null) return { state: recorded({ ...after, currentPlayer: next }, { type: 'go', playerNumber: seat, lastCard: false }, `${name} says Go`) };
  const last = state.pile[state.pile.length - 1].seat;
  const status = `${name} says Go. ${state.playerNames[last]} scores 1 for the go`;
  const goItem: ScoreItem = { kind: 'go', cards: [], points: 1 };
  const scored = addPoints(recorded(after, { type: 'go', playerNumber: seat, lastCard: true }, status), sideOf(state, last), [goItem]);
  return { state: scored.isGameOver ? scored : continuePegging(scored, last, true) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  switch (parsed.type) {
    case 'discard':
      if (state.phase !== 'discard') return { error: 'The crib is already laid' };
      return discard(state, seat, parsed.cards);
    case 'cut':
      if (state.phase !== 'cut') return { error: 'It is not time to cut the starter' };
      return { state: cut(state, seat, random) };
    case 'play':
      if (state.phase !== 'pegging') return { error: 'Pegging has not started' };
      return play(state, seat, parsed.card);
    case 'go':
      if (state.phase !== 'pegging') return { error: 'Pegging has not started' };
      return sayGo(state, seat);
    case 'claim':
      return { error: 'Invalid move' };
  }
}

// Everyone discards at once
export const waitingOn = (state: GameState): Seat[] =>
  state.phase === 'discard' ? state.activePlayers.filter(seat => (state.hands[seat]?.length ?? 0) > HAND_AFTER_DISCARD) : [];

// At 4 the partnership is broken. At 3 the hand is abandoned and dealt again for the two left, scores kept.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  if (partnerships(state)) return partnershipBroken(state, seat);
  const { [seat]: _score, ...scores } = state.scores;
  const { [seat]: _pegs, ...pegs } = state.pegs;
  const dealer = state.dealer === seat || state.dealer === null ? nextActivePlayer(state, seat) ?? state.activePlayers[0] : state.dealer;
  const handNumber = state.handNumber + 1;
  const dealt = dealHand({ ...state, scores, pegs, handNumber }, dealer, random);
  return { ...dealt, gameStatus: `${state.playerNames[seat]} left, so the cards are dealt again: ${state.playerNames[dealer]} deals` };
}

// An undone cut cannot show the starter again
export function onUndo(state: GameState, random: Random): GameState {
  return { ...state, deck: shuffle(state.deck, random) };
}

export function finalStandings(state: GameState): Standing[] {
  const points = (seat: Seat) => state.scores[sideOf(state, seat)] ?? 0;
  return rankStandings(state, (a, b) => points(b) - points(a), seat => pointsText(points(seat)));
}
