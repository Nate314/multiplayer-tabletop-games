// Go Fish rules shared by the browser (rank names) and the server (validation).
// Rules: https://en.wikipedia.org/wiki/Go_Fish, played until all 13 books are down.
import { rankStandings } from '../../shared/standings.ts';
import { plural } from '../../shared/text.ts';
import { handCounts, viewHand } from '../../shared/hands.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { RANKS, standardDeck } from '../../shared/playingCards.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Standing } from '../../shared/types.ts';
import type { Ask, Fished, GameState, Move, PlayingCard, PublicGameState, Rank, Result, Seat } from './types.ts';

export const BOOK_SIZE = 4;
export const TOTAL_BOOKS = RANKS.length;

// 7 cards each for 2 or 3 players, 5 for 4 or more
export function handSize(players: number): number {
  return players <= 3 ? 7 : 5;
}

const PLURALS: Partial<Record<Rank, string>> = { A: 'aces', J: 'jacks', Q: 'queens', K: 'kings' };
const SINGULARS: Partial<Record<Rank, string>> = { A: 'an ace', J: 'a jack', Q: 'a queen', K: 'a king', '8': 'an 8' };

// 'aces', '7s', 'kings'
export function rankPlural(rank: Rank): string {
  return PLURALS[rank] ?? `${rank}s`;
}

// 'an ace', 'a 7', 'an 8'
export function rankSingular(rank: Rank): string {
  return SINGULARS[rank] ?? `a ${rank}`;
}

// The seats after `from` in seat order, wrapping round and ending with `from` itself when seated
export function seatsAfter(players: Seat[], from: Seat): Seat[] {
  return [...players.filter(seat => seat > from), ...players.filter(seat => seat <= from)];
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), hands: {}, stock: [], books: {}, log: [], lastMove: null, fishedCard: null };
}

// Every rank `seat` holds all four of goes down as a book, in rank order
function layBooks(state: GameState, seat: Seat): { state: GameState; laid: Rank[] } {
  const hand = state.hands[seat];
  const laid = RANKS.filter(rank => hand.filter(card => card.rank === rank).length === BOOK_SIZE);
  if (laid.length === 0) return { state, laid };
  return {
    state: {
      ...state,
      hands: { ...state.hands, [seat]: hand.filter(card => !laid.includes(card.rank)) },
      books: { ...state.books, [seat]: [...(state.books[seat] ?? []), ...laid] }
    },
    laid
  };
}

// Each player with an empty hand draws one card while the stock has any, starting from `first`; the rest are out
function refill(state: GameState, first: Seat): GameState {
  let next = state;
  for (const seat of seatsAfter(state.activePlayers, first - 1)) {
    if (next.hands[seat].length > 0 || next.stock.length === 0) continue;
    next = {
      ...next,
      hands: { ...next.hands, [seat]: [next.stock[next.stock.length - 1]] },
      stock: next.stock.slice(0, -1)
    };
  }
  return next;
}

const hasCards = (state: GameState, seat: Seat) => (state.hands[seat]?.length ?? 0) > 0;

// The first player from `first` on, in seat order, who still holds cards
function turnFrom(state: GameState, first: Seat): Seat | null {
  return seatsAfter(state.activePlayers, first - 1).find(seat => hasCards(state, seat)) ?? null;
}

const booksDown = (state: GameState) => Object.values(state.books).flat().length;

// Once all 13 books are down the seated players with the most books win, sharing a tie
function finish(state: GameState, moveText: string): GameState {
  const counts = state.activePlayers.map(seat => state.books[seat]?.length ?? 0);
  const most = Math.max(...counts);
  const winners = state.activePlayers.filter((_, index) => counts[index] === most);
  const names = winners.map(seat => state.playerNames[seat]);
  const result = winners.length === 1
    ? `${names[0]} wins with ${most} books!`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} tie with ${most} books each!`;
  return { ...state, isGameOver: true, currentPlayer: null, winners, gameStatus: `${moveText} ${result}` };
}

// Deals from the top of `deck` (its first cards), lays down any book the deal made and starts with `first`
export function dealFrom(state: GameState, deck: PlayingCard[], first: Seat): GameState {
  const players = state.activePlayers;
  const size = handSize(players.length);
  let dealt: GameState = {
    ...state,
    hands: Object.fromEntries(players.map((seat, index) => [seat, deck.slice(index * size, (index + 1) * size)])),
    stock: deck.slice(players.length * size).reverse(),
    books: Object.fromEntries(players.map(seat => [seat, []])),
    log: [],
    lastMove: null,
    fishedCard: null
  };
  for (const seat of players) dealt = layBooks(dealt, seat).state;
  dealt = refill(dealt, first);
  return { ...dealt, currentPlayer: turnFrom(dealt, first) };
}

// Before the first move the cards are dealt afresh for the current players and a random player goes first.
// Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  if (players.length < 2) {
    return { ...state, hands: Object.fromEntries(players.map(seat => [seat, []])), stock: [], books: {}, log: [], lastMove: null, fishedCard: null };
  }
  const deck = shuffle(standardDeck(), random);
  return dealFrom(state, deck, players[Math.floor(random() * players.length)]);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, stock, fishedCard, ...view } = state;
  const asker = state.lastMove?.asker;
  const shown = state.lastMove?.fished === 'asked' || (viewer !== null && viewer === asker);
  return {
    ...view,
    hand: viewHand(hands, viewer),
    handCounts: handCounts(hands),
    stockCount: stock.length,
    fishedCard: shown ? fishedCard : null,
    undoAvailable
  };
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  if (input?.type !== 'ask') return null;
  const rank = RANKS.find(candidate => candidate === input.rank);
  const target = input.target;
  if (!rank || typeof target !== 'number' || !Number.isInteger(target) || target < 1) return null;
  return { type: 'ask', target, rank };
}

// How the status line, the ask log and the history describe an ask, e.g.
// 'Alice asked Bob for 7s and got 2. Alice laid down the 7s. Alice goes again.'
export function describeAsk(ask: Ask, playerNames: Record<Seat, string>): string {
  const asker = playerNames[ask.asker];
  const parts = [`${asker} asked ${playerNames[ask.target]} for ${rankPlural(ask.rank)}`];
  const fished: Record<Fished, string> = {
    none: ` and got ${ask.given}.`,
    asked: `: go fish! ${asker} drew ${rankSingular(ask.rank)}.`,
    other: `: go fish! ${asker} drew a card.`,
    empty: ': go fish! The stock is empty.'
  };
  parts[0] += fished[ask.fished];
  if (ask.books.length > 0) parts.push(`${asker} laid down the ${ask.books.map(rankPlural).join(' and the ')}.`);
  if (ask.goesAgain) parts.push(`${asker} goes again.`);
  return parts.join(' ');
}

// A hit takes every card of the rank and the asker goes again. A miss draws from the stock: drawing the asked rank
// goes again, anything else passes the turn to the next player with cards. Books go down at once, and anyone left
// with no cards draws one if the stock has any.
function ask(state: GameState, seat: Seat, { target, rank }: Move): Result<GameState> {
  if (target === seat) return { error: 'Ask another player' };
  if (!state.activePlayers.includes(target)) return { error: 'That player is not in the game' };
  if (!hasCards(state, target)) return { error: `${state.playerNames[target]} has no cards` };
  if (!state.hands[seat].some(card => card.rank === rank)) return { error: 'You can only ask for a rank you hold' };

  const given = state.hands[target].filter(card => card.rank === rank);
  let next: GameState = { ...state, fishedCard: null };
  let fished: Fished = 'none';
  if (given.length > 0) {
    next = {
      ...next,
      hands: { ...next.hands, [seat]: [...next.hands[seat], ...given], [target]: next.hands[target].filter(card => card.rank !== rank) }
    };
  } else if (next.stock.length === 0) {
    fished = 'empty';
  } else {
    const drawn = next.stock[next.stock.length - 1];
    fished = drawn.rank === rank ? 'asked' : 'other';
    next = { ...next, hands: { ...next.hands, [seat]: [...next.hands[seat], drawn] }, stock: next.stock.slice(0, -1), fishedCard: drawn };
  }

  const booked = layBooks(next, seat);
  next = refill(booked.state, seat);
  const over = booksDown(next) === TOTAL_BOOKS;
  const goesAgain = !over && (fished === 'none' || fished === 'asked') && hasCards(next, seat);
  const lastMove: Ask = { asker: seat, target, rank, given: given.length, fished, books: booked.laid, goesAgain };
  next = { ...next, lastMove, log: [...next.log, lastMove] };
  const text = describeAsk(lastMove, state.playerNames);

  if (over) return { state: finish(next, text) };
  return { state: { ...next, currentPlayer: goesAgain ? seat : turnFrom(next, seat + 1), gameStatus: text } };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  return ask(state, seat, parsed);
}

// The leaver's cards are shuffled into the stock and anyone out of cards draws from it. The platform has moved a held
// turn to the next seat; if that player has no cards the turn goes on to the next one who has. Their books stay down.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: hand = [], ...hands } = state.hands;
  const stocked: GameState = { ...state, hands, stock: shuffle([...state.stock, ...hand], random) };
  const first = state.currentPlayer ?? state.activePlayers[0];
  const next = refill(stocked, first);
  return { ...next, currentPlayer: turnFrom(next, first) };
}

export function finalStandings(state: GameState): Standing[] {
  const books = (seat: Seat) => state.books[seat]?.length ?? 0;
  return rankStandings(state, (a, b) => books(b) - books(a), seat => plural(books(seat), 'book'));
}
