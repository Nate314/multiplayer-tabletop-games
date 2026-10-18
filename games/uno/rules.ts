// UNO rules shared by the browser (playable cards) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, Color, Direction, GameState, LastMove, Move, PublicGameState, Result, Seat, Value } from './types.ts';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];
export const HAND_SIZE = 7;
const NUMBERS: Value[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTIONS: Value[] = ['skip', 'reverse', 'drawTwo'];
const WILDS: Value[] = ['wild', 'wildDrawFour'];
const VALUES: Value[] = [...NUMBERS, ...ACTIONS, ...WILDS];

// How many cards the next player draws
const DRAWS: Partial<Record<Value, number>> = { drawTwo: 2, wildDrawFour: 4 };

// 0 once and 1 to 9, Skip, Reverse and Draw Two twice per color, then 4 Wild and 4 Wild Draw Four: 108 cards
export function buildDeck(): Card[] {
  const colored = COLORS.flatMap(color => [
    { color, value: '0' as Value },
    ...[...NUMBERS.slice(1), ...ACTIONS].flatMap(value => [{ color, value }, { color, value }])
  ]);
  const wilds = WILDS.flatMap(value => Array.from({ length: 4 }, (): Card => ({ color: 'wild', value })));
  return [...colored, ...wilds];
}

export function isWild(card: Card): boolean {
  return card.color === 'wild';
}

export function sameCard(a: Card, b: Card): boolean {
  return a.color === b.color && a.value === b.value;
}

// A Wild always plays; otherwise the color or the number or symbol must match. After a starting Wild anything plays.
export function canPlay(card: Card, top: Card | null, currentColor: Color | null): boolean {
  if (isWild(card) || !top || currentColor === null) return true;
  return card.color === currentColor || card.value === top.value;
}

// How the status line and the history name a card, e.g. 'red 7', 'blue Draw Two', 'Wild Draw Four'
export function cardName(card: Card): string {
  const names: Partial<Record<Value, string>> = {
    skip: 'Skip', reverse: 'Reverse', drawTwo: 'Draw Two', wild: 'Wild', wildDrawFour: 'Wild Draw Four'
  };
  const name = names[card.value] ?? card.value;
  return isWild(card) ? name : `${card.color} ${name}`;
}

// The next seat in `direction` from `from`, which need not be seated itself (a leaver, or the dealer before seat 1)
export function stepFrom(players: Seat[], from: Seat, direction: Direction): Seat {
  if (direction === 1) return players.find(seat => seat > from) ?? players[0];
  return [...players].reverse().find(seat => seat < from) ?? players[players.length - 1];
}

function shuffle<T>(items: T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type Piles = Pick<GameState, 'drawPile' | 'discardPile'>;

// Takes up to `count` cards from the top of the draw pile. When it runs out, every discard but the top card
// is shuffled into a new draw pile. When both run out, fewer cards are drawn.
function drawCards(piles: Piles, count: number, random: Random): Piles & { cards: Card[] } {
  let { drawPile, discardPile } = piles;
  const cards: Card[] = [];
  while (cards.length < count) {
    if (drawPile.length === 0) {
      if (discardPile.length <= 1) break;
      drawPile = shuffle(discardPile.slice(0, -1), random);
      discardPile = discardPile.slice(-1);
    }
    cards.push(drawPile[drawPile.length - 1]);
    drawPile = drawPile.slice(0, -1);
  }
  return { drawPile, discardPile, cards };
}

function canDraw(piles: Piles): boolean {
  return piles.drawPile.length > 0 || piles.discardPile.length > 1;
}

function withTurn(state: GameState, seat: Seat | null): GameState {
  return { ...state, currentPlayer: seat, turnHolder: seat, drawnCard: null };
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    hands: {},
    drawPile: [],
    discardPile: [],
    currentColor: null,
    direction: 1,
    drawnCard: null,
    turnHolder: null,
    lastMove: null
  };
}

type Effect = { state: GameState; target: Seat | null; drew: number };

// What `card`, just played by `from`, does to the turn: who is skipped, what they draw, and who plays next.
// Reverse with two players acts as a Skip.
function applyEffect(state: GameState, from: Seat, card: Card, random: Random): Effect {
  const players = state.activePlayers;
  const reverses = card.value === 'reverse';
  const direction: Direction = reverses ? (-state.direction as Direction) : state.direction;
  const skips = card.value === 'skip' || card.value in DRAWS || (reverses && players.length === 2);

  if (!skips) return { state: withTurn({ ...state, direction }, stepFrom(players, from, direction)), target: null, drew: 0 };

  const target = stepFrom(players, from, state.direction);
  const drawn = drawCards(state, DRAWS[card.value] ?? 0, random);
  const hands = { ...state.hands, [target]: [...state.hands[target], ...drawn.cards] };
  const next = { ...state, drawPile: drawn.drawPile, discardPile: drawn.discardPile, hands, direction };
  return { state: withTurn(next, stepFrom(players, target, state.direction)), target, drew: drawn.cards.length };
}

// Before the first move, the cards are dealt afresh for the current players and a starting card is flipped.
// The starting card acts as if a dealer sitting just before seat 1 had played it, so a Skip skips seat 1 and a
// Reverse hands the first turn to the last seat. A Wild Draw Four goes to the bottom of the deck and another card is flipped.
// Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const empty: GameState = {
    ...withTurn(state, state.currentPlayer),
    hands: Object.fromEntries(players.map(seat => [seat, []])),
    drawPile: [],
    discardPile: [],
    currentColor: null,
    direction: 1,
    lastMove: null
  };
  if (players.length < 2) return empty;

  let deck = shuffle(buildDeck(), random);
  while (deck[deck.length - 1].value === 'wildDrawFour') deck = [deck[deck.length - 1], ...deck.slice(0, -1)];
  const starter = deck[deck.length - 1];
  const hands = Object.fromEntries(players.map((seat, index) =>
    [seat, deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)]));
  const dealt: GameState = {
    ...empty,
    hands,
    drawPile: deck.slice(players.length * HAND_SIZE, -1),
    discardPile: [starter],
    currentColor: isWild(starter) ? null : starter.color as Color
  };
  return applyEffect(dealt, 0, starter, random).state;
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, drawPile, discardPile, drawnCard, turnHolder: _turnHolder, ...view } = state;
  return {
    ...view,
    hand: viewer === null ? [] : hands[viewer] ?? [],
    handCounts: Object.fromEntries(Object.entries(hands).map(([seat, hand]) => [seat, hand.length])),
    drawPileCount: drawPile.length,
    discardTop: discardPile[discardPile.length - 1] ?? null,
    hasDrawn: drawnCard !== null,
    drawnCard: viewer !== null && viewer === state.currentPlayer ? drawnCard : null,
    undoAvailable
  };
}

function isColor(value: unknown): value is Color {
  return COLORS.some(color => color === value);
}

function parseCard(value: unknown): Card | null {
  const input = asRecord(value);
  const card = VALUES.find(candidate => candidate === input?.value);
  const color = input?.color;
  if (!card) return null;
  if (WILDS.includes(card)) return color === 'wild' ? { color, value: card } : null;
  return isColor(color) ? { color, value: card } : null;
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  if (input?.type === 'draw' || input?.type === 'pass') return { type: input.type };
  if (input?.type !== 'play') return null;
  const card = parseCard(input.card);
  if (!card) return null;
  if (!isWild(card)) return { type: 'play', card };
  return isColor(input.color) ? { type: 'play', card, color: input.color } : null;
}

// How the status line and the history describe a move, e.g. 'Alice played red Draw Two; Bob draws 2 and is skipped'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'pass') return `${name} passed`;
  if (lastMove.type === 'draw') return lastMove.passed ? `${name} drew a card and could not play it` : `${name} drew a card`;

  const { card, color, target, drew } = lastMove;
  const played = `${name} played ${isWild(card) ? `${cardName(card)} (${color})` : cardName(card)}`;
  if (target === null) return played;
  return `${played}; ${playerNames[target]} ${drew > 0 ? `draws ${drew} and is skipped` : 'is skipped'}`;
}

function recorded(state: GameState, lastMove: LastMove): GameState {
  return { ...state, lastMove, gameStatus: describeMove(lastMove, state.playerNames) };
}

function play(state: GameState, seat: Seat, card: Card, chosen: Color | undefined, random: Random): Result<GameState> {
  const hand = state.hands[seat];
  const index = hand.findIndex(held => sameCard(held, card));
  if (index < 0) return { error: 'You do not have that card' };
  if (state.drawnCard && !sameCard(state.drawnCard, card)) return { error: 'You may only play the card you drew' };
  const top = state.discardPile[state.discardPile.length - 1] ?? null;
  if (!canPlay(card, top, state.currentColor)) return { error: 'That card does not match' };

  const color = chosen ?? card.color as Color;
  const played: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: hand.filter((_, i) => i !== index) },
    discardPile: [...state.discardPile, card],
    currentColor: color
  };

  if (played.hands[seat].length === 0) {
    const lastMove: LastMove = { type: 'play', playerNumber: seat, card, color, target: null, drew: 0 };
    return {
      state: {
        ...withTurn(played, null),
        isGameOver: true,
        winners: [seat],
        lastMove,
        gameStatus: `${describeMove(lastMove, state.playerNames)} and wins!`
      }
    };
  }

  const { state: next, target, drew } = applyEffect(played, seat, card, random);
  return { state: recorded(next, { type: 'play', playerNumber: seat, card, color, target, drew }) };
}

// The drawn card goes to the hand. If it can be played the player may play it or pass; otherwise the turn moves on.
function draw(state: GameState, seat: Seat, random: Random): Result<GameState> {
  if (state.drawnCard) return { error: 'You already drew a card' };
  if (!canDraw(state)) return { error: 'There are no cards left to draw' };

  const drawn = drawCards(state, 1, random);
  const card = drawn.cards[0];
  const top = drawn.discardPile[drawn.discardPile.length - 1] ?? null;
  const playable = canPlay(card, top, state.currentColor);
  const next: GameState = {
    ...state,
    drawPile: drawn.drawPile,
    discardPile: drawn.discardPile,
    hands: { ...state.hands, [seat]: [...state.hands[seat], card] }
  };
  const lastMove: LastMove = { type: 'draw', playerNumber: seat, passed: !playable };
  if (playable) return { state: recorded({ ...next, drawnCard: card }, lastMove) };
  return { state: recorded(withTurn(next, stepFrom(state.activePlayers, seat, state.direction)), lastMove) };
}

// Allowed after drawing a playable card, or when there is nothing left to draw
function pass(state: GameState, seat: Seat): Result<GameState> {
  if (!state.drawnCard && canDraw(state)) return { error: 'Draw a card before passing' };
  const next = withTurn(state, stepFrom(state.activePlayers, seat, state.direction));
  return { state: recorded(next, { type: 'pass', playerNumber: seat }) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (parsed.type === 'draw') return draw(state, seat, random);
  if (parsed.type === 'pass') return pass(state, seat);
  return play(state, seat, parsed.card, parsed.color, random);
}

// The leaver's hand goes under the draw pile. The platform moves a held turn up the seats,
// so when play runs downward the turn is moved to the seat below the leaver instead.
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const { [seat]: hand = [], ...hands } = state.hands;
  const next: GameState = { ...state, hands, drawPile: [...hand, ...state.drawPile] };
  if (state.turnHolder !== seat) return next;
  return withTurn(next, stepFrom(state.activePlayers, seat, state.direction));
}
