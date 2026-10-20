// Skip-Bo rules shared by the browser (what fits where, move text) and the server (validation).
// Source: https://en.wikipedia.org/wiki/Skip-Bo, and Mattel's rules where the article is silent.
import { viewHand } from '../../shared/hands.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, GameState, LastMove, Move, PileIndex, PublicGameState, Result, Seat, Source } from './types.ts';

export const MAX_VALUE = 12;
export const COPIES = 12; // of each number
export const SKIPBO_COUNT = 18;
export const HAND_SIZE = 5;
export const PILE_COUNT = 4; // building piles, and discard piles per player
export const PILES: PileIndex[] = [0, 1, 2, 3];

// 30 cards each for 2 to 4 players, 20 for 5 or 6
export function stockSize(players: number): number {
  return players >= 5 ? 20 : 30;
}

export function createDeck(): Card[] {
  const numbers = Array.from({ length: MAX_VALUE * COPIES }, (_, id): Card => ({ id, kind: 'number', value: (id % MAX_VALUE) + 1 }));
  const wilds = Array.from({ length: SKIPBO_COUNT }, (_, index): Card => ({ id: numbers.length + index, kind: 'skipbo' }));
  return [...numbers, ...wilds];
}

export function cardName(card: Card): string {
  return card.kind === 'skipbo' ? 'Skip-Bo' : String(card.value);
}

// The number a building pile needs next. Piles always run from 1 up, so it is one more than its size.
export function nextValue(pile: Card[]): number {
  return pile.length + 1;
}

export function fits(card: Card, pile: Card[]): boolean {
  return card.kind === 'skipbo' || card.value === nextValue(pile);
}

const emptyPiles = (): Card[][] => PILES.map(() => []);

function sourceText(from: Source['kind']): string {
  if (from === 'hand') return 'their hand';
  return from === 'stock' ? 'their stock' : 'a discard pile';
}

// 'a Skip-Bo', 'a 4', 'an 8', 'an 11'
function withArticle(card: Card): string {
  const name = cardName(card);
  return `${card.kind === 'number' && (card.value === 8 || card.value === 11) ? 'an' : 'a'} ${name}`;
}

// The status line and the history describe a move in the same words
export function moveText(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'play': {
      const card = lastMove.card.kind === 'skipbo' ? `a Skip-Bo as ${lastMove.value}` : withArticle(lastMove.card);
      const done = lastMove.completed ? ` and completed building pile ${lastMove.to + 1}` : '';
      return `${name} played ${card} from ${sourceText(lastMove.from.kind)} on building pile ${lastMove.to + 1}${done}`;
    }
    case 'discard':
      return `${name} discarded ${withArticle(lastMove.card)} on discard pile ${lastMove.pile + 1}`;
    case 'endTurn':
      return `${name} had no cards to discard and ended their turn`;
  }
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    hands: {},
    stocks: {},
    discards: {},
    building: emptyPiles(),
    drawPile: [],
    turnOf: null,
    passes: 0,
    lastMove: null
  };
}

// Draws from the end of the draw pile until the hand holds five, or the pile is empty
function refill(state: GameState, seat: Seat): GameState {
  const hand = state.hands[seat] ?? [];
  const count = Math.max(0, Math.min(HAND_SIZE - hand.length, state.drawPile.length));
  if (count === 0) return state;
  const drawn = state.drawPile.slice(-count).reverse();
  return { ...state, hands: { ...state.hands, [seat]: [...hand, ...drawn] }, drawPile: state.drawPile.slice(0, -count) };
}

// The player whose turn it now is draws up to five
function startTurn(state: GameState): GameState {
  const seat = state.currentPlayer;
  if (seat === null) return { ...state, turnOf: null };
  return { ...refill(state, seat), turnOf: seat };
}

// Before the first move, the stocks are dealt afresh for the current players and the first player draws a hand.
// Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const seats = state.activePlayers;
  const cleared: GameState = { ...state, hands: {}, stocks: {}, discards: {}, building: emptyPiles(), drawPile: [], turnOf: null, passes: 0, lastMove: null };
  if (seats.length < 2) return cleared;
  const deck = shuffle(createDeck(), random);
  const size = stockSize(seats.length);
  const dealt: GameState = {
    ...cleared,
    hands: Object.fromEntries(seats.map(seat => [seat, []])),
    stocks: Object.fromEntries(seats.map((seat, index) => [seat, deck.slice(index * size, (index + 1) * size)])),
    discards: Object.fromEntries(seats.map(seat => [seat, emptyPiles()])),
    drawPile: deck.slice(seats.length * size)
  };
  return startTurn(dealt);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, stocks, drawPile, ...view } = state;
  const perSeat = <T>(change: (seat: Seat) => T) => Object.fromEntries(state.activePlayers.map(seat => [seat, change(seat)]));
  return {
    ...view,
    undoAvailable,
    myHand: viewHand(hands, viewer),
    handCounts: perSeat(seat => hands[seat]?.length ?? 0),
    stockTops: perSeat(seat => stocks[seat]?.at(-1) ?? null),
    stockCounts: perSeat(seat => stocks[seat]?.length ?? 0),
    drawCount: drawPile.length
  };
}

// A dismissed player's hand, stock and discard piles are shuffled into the draw pile.
// The platform has already moved the turn on; if it was theirs, the next player's turn starts here.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: hand = [], ...hands } = state.hands;
  const { [seat]: stock = [], ...stocks } = state.stocks;
  const { [seat]: piles = [], ...discards } = state.discards;
  const next: GameState = {
    ...state,
    hands,
    stocks,
    discards,
    drawPile: shuffle([...state.drawPile, ...hand, ...stock, ...piles.flat()], random),
    passes: 0
  };
  return next.currentPlayer === state.turnOf ? next : startTurn(next);
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPile(value: unknown): value is PileIndex {
  return isIndex(value) && value < PILE_COUNT;
}

function parseSource(value: unknown): Source | null {
  const input = asRecord(value);
  switch (input?.kind) {
    case 'hand': return isIndex(input.index) ? { kind: 'hand', index: input.index } : null;
    case 'stock': return { kind: 'stock' };
    case 'discard': return isPile(input.pile) ? { kind: 'discard', pile: input.pile } : null;
    default: return null;
  }
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'play': {
      const from = parseSource(input.from);
      return from && isPile(input.to) ? { type: 'play', from, to: input.to } : null;
    }
    case 'discard':
      return isIndex(input.handIndex) && isPile(input.pile) ? { type: 'discard', handIndex: input.handIndex, pile: input.pile } : null;
    case 'endTurn':
      return { type: 'endTurn' };
    default:
      return null;
  }
}

// The card a source offers, and the player's piles without it
function takeFrom(state: GameState, seat: Seat, from: Source): { card: Card; state: GameState } | { error: string } {
  switch (from.kind) {
    case 'hand': {
      const hand = state.hands[seat];
      const card = hand[from.index];
      if (!card) return { error: 'That card is not in your hand' };
      return { card, state: { ...state, hands: { ...state.hands, [seat]: hand.filter((_, index) => index !== from.index) } } };
    }
    case 'stock': {
      const stock = state.stocks[seat];
      const card = stock.at(-1);
      if (!card) return { error: 'Your stock is empty' };
      return { card, state: { ...state, stocks: { ...state.stocks, [seat]: stock.slice(0, -1) } } };
    }
    case 'discard': {
      const piles = state.discards[seat];
      const card = piles[from.pile].at(-1);
      if (!card) return { error: 'That discard pile is empty' };
      const rest = piles.map((pile, index) => (index === from.pile ? pile.slice(0, -1) : pile));
      return { card, state: { ...state, discards: { ...state.discards, [seat]: rest } } };
    }
  }
}

// The player who emptied their stock wins at once
function play(state: GameState, seat: Seat, from: Source, to: PileIndex, random: Random): Result<GameState> {
  const pile = state.building[to];
  const taken = takeFrom(state, seat, from);
  if ('error' in taken) return taken;
  const { card } = taken;
  if (!fits(card, pile)) {
    return { error: pile.length === 0 ? 'A building pile starts with a 1 or a Skip-Bo' : `That pile needs a ${nextValue(pile)}` };
  }

  const value = nextValue(pile);
  const completed = value === MAX_VALUE;
  const built = [...pile, card];
  const lastMove: LastMove = { playerNumber: seat, type: 'play', from, to, card, value, completed };
  let next: GameState = {
    ...taken.state,
    building: state.building.map((existing, index) => (index === to ? (completed ? [] : built) : existing)),
    drawPile: completed ? shuffle([...taken.state.drawPile, ...built], random) : taken.state.drawPile,
    passes: 0,
    lastMove,
    gameStatus: moveText(lastMove, state.playerNames)
  };

  if (next.stocks[seat].length === 0) {
    return { state: {
      ...next,
      isGameOver: true,
      winners: [seat],
      currentPlayer: null,
      turnOf: null,
      gameStatus: `${state.playerNames[seat]} played the last card of their stock and wins!`
    } };
  }
  // An emptied hand draws five more and the turn goes on
  if (next.hands[seat].length === 0) next = refill(next, seat);
  return { state: next };
}

function passTurn(state: GameState, seat: Seat): GameState {
  return startTurn({ ...state, currentPlayer: nextActivePlayer(state, seat) });
}

function discard(state: GameState, seat: Seat, handIndex: number, pile: PileIndex): Result<GameState> {
  const taken = takeFrom(state, seat, { kind: 'hand', index: handIndex });
  if ('error' in taken) return taken;
  const piles = state.discards[seat].map((cards, index) => (index === pile ? [...cards, taken.card] : cards));
  const lastMove: LastMove = { playerNumber: seat, type: 'discard', card: taken.card, pile };
  return { state: passTurn({
    ...taken.state,
    discards: { ...state.discards, [seat]: piles },
    passes: 0,
    lastMove,
    gameStatus: moveText(lastMove, state.playerNames)
  }, seat) };
}

// Whether the top of this player's stock or of any of their discard piles fits a building pile
function canPlay(state: GameState, seat: Seat): boolean {
  const tops = [state.stocks[seat].at(-1), ...state.discards[seat].map(pile => pile.at(-1))];
  return tops.some(card => card !== undefined && state.building.some(pile => fits(card, pile)));
}

// With an empty hand and an empty draw pile there is nothing to discard, so the turn just ends.
// The turn counts as stuck only if the player played nothing this turn (the turn's moves are theirs since the
// last discard or end of turn, so a play this turn is the last move) and had nothing they could play.
// If every player in a row is stuck, nobody can ever play again: the fewest stock cards left win.
function endTurn(state: GameState, seat: Seat): Result<GameState> {
  if (state.hands[seat].length > 0) return { error: 'You can end your turn only by discarding' };
  const lastMove: LastMove = { playerNumber: seat, type: 'endTurn' };
  const playedThisTurn = state.lastMove?.type === 'play' && state.lastMove.playerNumber === seat;
  const passes = playedThisTurn || canPlay(state, seat) ? 0 : state.passes + 1;
  const next: GameState = { ...state, passes, lastMove, gameStatus: moveText(lastMove, state.playerNames) };
  if (passes < state.activePlayers.length) return { state: passTurn(next, seat) };

  const fewest = Math.min(...state.activePlayers.map(player => state.stocks[player].length));
  const winners = state.activePlayers.filter(player => state.stocks[player].length === fewest);
  const names = winners.map(player => state.playerNames[player]).join(' and ');
  return { state: {
    ...next,
    isGameOver: true,
    winners,
    currentPlayer: null,
    turnOf: null,
    gameStatus: `Nobody can play. ${names} ${winners.length > 1 ? 'win' : 'wins'} with the fewest stock cards left.`
  } };
}

// A turn is any number of plays onto the building piles, ended by one discard.
// A turn not yet set up (an undo across a dismissal can restore one) is set up first, so its player still draws.
export function applyMove(input: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  const state = input.turnOf === input.currentPlayer ? input : startTurn(input);
  switch (parsed.type) {
    case 'play': return play(state, seat, parsed.from, parsed.to, random);
    case 'discard': return discard(state, seat, parsed.handIndex, parsed.pile);
    case 'endTurn': return endTurn(state, seat);
  }
}
