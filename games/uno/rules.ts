// UNO rules shared by the browser (playable cards) and the server (validation).
import { handCounts, viewHand } from '../../shared/hands.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type {
  Card, Color, Direction, GameState, LastMove, Move, PendingFour, PublicGameState, Result, RoundSummary, Seat, Value
} from './types.ts';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];
export const HAND_SIZE = 7;
export const TARGET_SCORE = 500;
const NUMBERS: Value[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTIONS: Value[] = ['skip', 'reverse', 'drawTwo'];
const WILDS: Value[] = ['wild', 'wildDrawFour'];
const VALUES: Value[] = [...NUMBERS, ...ACTIONS, ...WILDS];

// How many cards the next player draws
const DRAWS: Partial<Record<Value, number>> = { drawTwo: 2, wildDrawFour: 4 };
const FAILED_CHALLENGE_DRAW = 6;
const UNO_PENALTY = 2;

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

// A Wild always plays; otherwise the color or the number or symbol must match
export function canPlay(card: Card, top: Card | null, currentColor: Color | null): boolean {
  if (isWild(card) || !top) return true;
  return card.color === currentColor || card.value === top.value;
}

// What a card left in a hand scores for the player who went out: a number its face value, an action card 20, a Wild 50
export function cardPoints(card: Card): number {
  if (isWild(card)) return 50;
  return NUMBERS.includes(card.value) ? Number(card.value) : 20;
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}

// How the status line and the history name a card, e.g. 'red 7', 'blue Draw Two', 'Wild Draw Four'
export function cardName(card: Card): string {
  const names: Partial<Record<Value, string>> = {
    skip: 'Skip', reverse: 'Reverse', drawTwo: 'Draw Two', wild: 'Wild', wildDrawFour: 'Wild Draw Four'
  };
  const name = names[card.value] ?? card.value;
  return isWild(card) ? name : `${card.color} ${name}`;
}

// The next seat in `direction` from `from`, which need not be seated itself (a leaver, or a dealer who left)
export function stepFrom(players: Seat[], from: Seat, direction: Direction): Seat {
  if (direction === 1) return players.find(seat => seat > from) ?? players[0];
  return [...players].reverse().find(seat => seat < from) ?? players[players.length - 1];
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

// `seat` draws up to `count` cards; `drew` is how many they got
function dealTo(state: GameState, seat: Seat, count: number, random: Random): { state: GameState; drew: number } {
  const drawn = drawCards(state, count, random);
  const hands = { ...state.hands, [seat]: [...state.hands[seat], ...drawn.cards] };
  return { state: { ...state, drawPile: drawn.drawPile, discardPile: drawn.discardPile, hands }, drew: drawn.cards.length };
}

function canDraw(piles: Piles): boolean {
  return piles.drawPile.length > 0 || piles.discardPile.length > 1;
}

function withTurn(state: GameState, seat: Seat | null): GameState {
  return { ...state, currentPlayer: seat, turnHolder: seat, drawnCard: null };
}

// Everything that lasts only for one round
const ROUND_START = {
  currentColor: null,
  direction: 1,
  drawnCard: null,
  pendingFour: null,
  unoWindow: null,
  revealed: null,
  roundSummary: null,
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    ...ROUND_START,
    roundNumber: 1,
    dealer: null,
    scores: {},
    hands: {},
    drawPile: [],
    discardPile: [],
    turnHolder: null
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
  const { state: drawn, drew } = dealTo({ ...state, direction }, target, DRAWS[card.value] ?? 0, random);
  return { state: withTurn(drawn, stepFrom(players, target, state.direction)), target, drew };
}

// Each player draws a card from a shuffled deck and the highest number deals; a card that is not a number counts lowest.
// Tied players draw again. If the deck ran out first, the lowest tied seat would deal.
export function cutForDealer(players: Seat[], random: Random): Seat {
  let deck = shuffle(buildDeck(), random);
  let tied = players;
  while (tied.length > 1 && deck.length >= tied.length) {
    // The top card goes to the lowest tied seat
    const ranks = deck.slice(-tied.length).reverse().map(card => NUMBERS.indexOf(card.value));
    deck = deck.slice(0, -tied.length);
    const best = Math.max(...ranks);
    tied = tied.filter((_, index) => ranks[index] === best);
  }
  return tied[0];
}

// Seven cards each from a fresh deck, then a starting card is flipped. A starting Wild Draw Four goes back into the deck,
// which is reshuffled, and another card is flipped. The starting card acts as if the dealer had played it, so a Skip skips
// the player to the dealer's left, except that after a starting Reverse the dealer plays first and play runs to their right.
// After a starting Wild the player to the dealer's left names the color before playing.
export function dealRound(state: GameState, dealer: Seat, random: Random): GameState {
  const players = state.activePlayers;
  const deck = shuffle(buildDeck(), random);
  const hands = Object.fromEntries(players.map((seat, index) =>
    [seat, deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)]));
  let drawPile = deck.slice(players.length * HAND_SIZE);
  while (drawPile[drawPile.length - 1].value === 'wildDrawFour') drawPile = shuffle(drawPile, random);
  const starter = drawPile[drawPile.length - 1];

  const dealt: GameState = {
    ...state,
    ...ROUND_START,
    dealer,
    hands,
    drawPile: drawPile.slice(0, -1),
    discardPile: [starter],
    currentColor: isWild(starter) ? null : starter.color as Color
  };
  if (starter.value === 'reverse') return withTurn({ ...dealt, direction: -1 }, dealer);
  return applyEffect(dealt, dealer, starter, random).state;
}

// Before the first move, the dealer is chosen and the cards are dealt afresh for the current players.
// Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const empty: GameState = {
    ...withTurn(state, state.currentPlayer),
    ...ROUND_START,
    roundNumber: 1,
    dealer: null,
    scores: Object.fromEntries(players.map(seat => [seat, 0])),
    hands: Object.fromEntries(players.map(seat => [seat, []])),
    drawPile: [],
    discardPile: []
  };
  if (players.length < 2) return empty;
  return dealRound(empty, cutForDealer(players, random), random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, drawPile, discardPile, drawnCard, turnHolder: _turnHolder, revealed, ...view } = state;
  return {
    ...view,
    hand: viewHand(hands, viewer),
    handCounts: handCounts(hands),
    drawPileCount: drawPile.length,
    discardTop: discardPile[discardPile.length - 1] ?? null,
    hasDrawn: drawnCard !== null,
    drawnCard: viewer !== null && viewer === state.currentPlayer ? drawnCard : null,
    revealed: revealed !== null && viewer !== null && viewer === revealed.to ? { of: revealed.of, hand: revealed.hand } : null,
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
  switch (input?.type) {
    case 'draw':
    case 'pass':
    case 'challenge':
    case 'accept':
      return { type: input.type };
    case 'chooseColor':
      return isColor(input.color) ? { type: 'chooseColor', color: input.color } : null;
    case 'play': {
      const card = parseCard(input.card);
      const uno = input.uno === true;
      if (!card) return null;
      if (!isWild(card)) return { type: 'play', card, uno };
      return isColor(input.color) ? { type: 'play', card, color: input.color, uno } : null;
    }
    default:
      return null;
  }
}

// How the status line and the history describe a move, e.g. 'Alice played red Draw Two; Bob draws 2 and is skipped'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'pass':
      return `${name} passed`;
    case 'draw':
      return lastMove.passed ? `${name} drew a card and could not play it` : `${name} drew a card`;
    case 'chooseColor':
      return `${name} chose ${lastMove.color} to start`;
    case 'accept':
      return `${name} accepted the Wild Draw Four, draws ${lastMove.drew} and is skipped`;
    case 'challenge': {
      const challenged = playerNames[lastMove.challenged];
      return lastMove.guilty
        ? `${name} challenged ${challenged}'s Wild Draw Four and won; ${challenged} draws ${lastMove.drew}`
        : `${name} challenged ${challenged}'s Wild Draw Four and lost; ${name} draws ${lastMove.drew} and is skipped`;
    }
    case 'play': {
      const { card, color, target, drew, wentOut } = lastMove;
      const played = `${name} played ${isWild(card) ? `${cardName(card)} (${color})` : cardName(card)}`;
      const targetName = target === null ? '' : playerNames[target];
      if (wentOut) return target === null ? `${played} and went out` : `${played} and went out; ${targetName} draws ${drew}`;
      if (target === null) return played;
      if (card.value === 'wildDrawFour') return `${played}; ${targetName} may accept or challenge it`;
      return `${played}; ${targetName} ${drew > 0 ? `draws ${drew} and is skipped` : 'is skipped'}`;
    }
  }
}

function recorded(state: GameState, lastMove: LastMove): GameState {
  return { ...state, lastMove, gameStatus: describeMove(lastMove, state.playerNames) };
}

// The player who went out scores every card left in the other hands, after the next player has drawn for a last
// Draw Two or Wild Draw Four. The first to reach TARGET_SCORE wins; otherwise the next round waits for everyone to continue.
function endRound(state: GameState, seat: Seat, card: Card, color: Color, random: Random): GameState {
  const count = DRAWS[card.value] ?? 0;
  const target = count > 0 ? stepFrom(state.activePlayers, seat, state.direction) : null;
  const { state: drawn, drew } = target === null ? { state, drew: 0 } : dealTo(state, target, count, random);

  const cardsLeft = Object.fromEntries(state.activePlayers.map(other => [other, drawn.hands[other].length]));
  const points = state.activePlayers.reduce((sum, other) => sum + handPoints(drawn.hands[other]), 0);
  const total = state.scores[seat] + points;
  const scored: GameState = {
    ...withTurn(drawn, null),
    scores: { ...state.scores, [seat]: total },
    unoWindow: null,
    roundSummary: { roundNumber: state.roundNumber, wentOut: seat, points, cardsLeft, acknowledged: [] },
    lastMove: { type: 'play', playerNumber: seat, card, color, target, drew, wentOut: true }
  };

  const name = state.playerNames[seat];
  if (total >= TARGET_SCORE) {
    return { ...scored, isGameOver: true, winners: [seat], gameStatus: `${name} went out and wins with ${total} points!` };
  }
  return { ...scored, gameStatus: `${name} went out and scores ${points} points. Waiting for everyone to continue.` };
}

// A play that leaves one card opens the UNO window, already closed if `uno` called it with the play.
// A Wild Draw Four waits for its target to accept or challenge it.
function play(state: GameState, seat: Seat, card: Card, chosen: Color | undefined, uno: boolean, random: Random): Result<GameState> {
  const hand = state.hands[seat];
  const index = hand.findIndex(held => sameCard(held, card));
  if (index < 0) return { error: 'You do not have that card' };
  if (state.drawnCard && !sameCard(state.drawnCard, card)) return { error: 'You may only play the card you drew' };
  const top = state.discardPile[state.discardPile.length - 1] ?? null;
  if (!canPlay(card, top, state.currentColor)) return { error: 'That card does not match' };

  const color = chosen ?? card.color as Color;
  const rest = hand.filter((_, i) => i !== index);
  const played: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: rest },
    discardPile: [...state.discardPile, card],
    currentColor: color,
    unoWindow: rest.length === 1 ? { seat, called: uno } : null
  };
  if (rest.length === 0) return { state: endRound(played, seat, card, color, random) };

  if (card.value === 'wildDrawFour') {
    const target = stepFrom(state.activePlayers, seat, state.direction);
    const pendingFour: PendingFour = { by: seat, target, previousColor: state.currentColor as Color };
    const lastMove: LastMove = { type: 'play', playerNumber: seat, card, color, target, drew: 0, wentOut: false };
    return { state: recorded(withTurn({ ...played, pendingFour }, target), lastMove) };
  }

  const { state: next, target, drew } = applyEffect(played, seat, card, random);
  return { state: recorded(next, { type: 'play', playerNumber: seat, card, color, target, drew, wentOut: false }) };
}

// The drawn card goes to the hand. If it can be played the player may play it or pass; otherwise the turn moves on.
function draw(state: GameState, seat: Seat, random: Random): Result<GameState> {
  if (state.drawnCard) return { error: 'You already drew a card' };
  if (!canDraw(state)) return { error: 'There are no cards left to draw' };

  const { state: next } = dealTo(state, seat, 1, random);
  const card = next.hands[seat][next.hands[seat].length - 1];
  const top = next.discardPile[next.discardPile.length - 1] ?? null;
  const playable = canPlay(card, top, state.currentColor);
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

// After a starting Wild the first player names the color, then takes their turn
function chooseColor(state: GameState, seat: Seat, color: Color): Result<GameState> {
  if (state.currentColor !== null) return { error: 'The color is already set' };
  return { state: recorded({ ...state, currentColor: color }, { type: 'chooseColor', playerNumber: seat, color }) };
}

function accept(state: GameState, seat: Seat, random: Random): GameState {
  const { state: drawn, drew } = dealTo({ ...state, pendingFour: null }, seat, DRAWS.wildDrawFour ?? 0, random);
  const next = withTurn(drawn, stepFrom(state.activePlayers, seat, state.direction));
  return recorded(next, { type: 'accept', playerNumber: seat, drew });
}

// The challenged player shows their hand to the challenger alone. If it holds a card of the color that was current when
// they played the Wild Draw Four, they draw 4 instead and the challenger takes their turn; otherwise the challenger
// draws 6 and loses their turn.
function challenge(state: GameState, seat: Seat, pending: PendingFour, random: Random): GameState {
  const hand = state.hands[pending.by];
  const guilty = hand.some(held => held.color === pending.previousColor);
  const drawer = guilty ? pending.by : seat;
  const count = guilty ? DRAWS.wildDrawFour ?? 0 : FAILED_CHALLENGE_DRAW;
  const { state: drawn, drew } = dealTo({ ...state, pendingFour: null }, drawer, count, random);
  const next = withTurn(
    { ...drawn, revealed: { to: seat, of: pending.by, hand } },
    guilty ? seat : stepFrom(state.activePlayers, seat, state.direction)
  );
  return recorded(next, { type: 'challenge', playerNumber: seat, challenged: pending.by, guilty, drew });
}

// Any move closes the UNO window, and the challenger's next move hides a challenged hand again
export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  const pending = state.pendingFour;
  const next: GameState = { ...state, unoWindow: null, revealed: state.revealed?.to === seat ? null : state.revealed };

  if (parsed.type === 'chooseColor') return chooseColor(next, seat, parsed.color);
  if (state.currentColor === null) return { error: 'Choose the first color' };
  if (parsed.type === 'challenge' || parsed.type === 'accept') {
    if (!pending) return { error: 'There is no Wild Draw Four to answer' };
    return { state: parsed.type === 'challenge' ? challenge(next, seat, pending, random) : accept(next, seat, random) };
  }
  if (pending) return { error: 'Accept the Wild Draw Four or challenge it' };
  if (parsed.type === 'draw') return draw(next, seat, random);
  if (parsed.type === 'pass') return pass(next, seat);
  return play(next, seat, parsed.card, parsed.color, parsed.uno === true, random);
}

const ROUND: RoundAccess<GameState, RoundSummary> = {
  get: state => state.roundSummary,
  set: (state, roundSummary) => ({ ...state, roundSummary }),
  noun: 'round'
};

// Deals the next round once every connected player has acknowledged the summary. The deal passes to the dealer's left.
function startNextRoundIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;

  const dealer = stepFrom(state.activePlayers, state.dealer ?? state.activePlayers[0], 1);
  const roundNumber = state.roundNumber + 1;
  const next = dealRound({ ...state, roundNumber }, dealer, random);
  return { ...next, gameStatus: `Round ${roundNumber}: ${state.playerNames[dealer]} deals` };
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  return acknowledge(state, seat, ROUND, next => startNextRoundIfReady(next, random));
}

// A call after the play still counts if nobody has caught the player yet
function callUno(state: GameState, seat: Seat): Result<GameState> {
  if (state.unoWindow?.seat !== seat) return { error: 'Call UNO when you play your second-to-last card' };
  return { state: { ...state, unoWindow: { seat, called: true }, gameStatus: `${state.playerNames[seat]} called UNO!` } };
}

// Any other player may catch someone who has not called UNO before the next move; they draw 2
function catchUno(state: GameState, seat: Seat, random: Random): Result<GameState> {
  const open = state.unoWindow;
  if (!open || open.called || open.seat === seat) return { error: 'There is nobody to catch' };
  const { state: drawn, drew } = dealTo({ ...state, unoWindow: null }, open.seat, UNO_PENALTY, random);
  const caught = state.playerNames[open.seat];
  return { state: { ...drawn, gameStatus: `${state.playerNames[seat]} caught ${caught} not calling UNO; ${caught} draws ${drew}` } };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  switch (asRecord(action)?.type) {
    case 'callUno': return callUno(state, seat);
    case 'catchUno': return catchUno(state, seat, random);
    case 'acknowledgeRound': return acknowledgeRound(state, seat, random);
    default: return { error: 'Unknown action' };
  }
}

// The leaver's hand goes under the draw pile. The platform moves a held turn up the seats,
// so when play runs downward the turn is moved to the seat below the leaver instead.
// A Wild Draw Four played by or at the leaver is dropped, and the next round may have been waiting only for them.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: hand = [], ...hands } = state.hands;
  const { pendingFour, unoWindow, revealed } = state;
  const next: GameState = {
    ...state,
    hands,
    drawPile: [...hand, ...state.drawPile],
    pendingFour: pendingFour?.by === seat || pendingFour?.target === seat ? null : pendingFour,
    unoWindow: unoWindow?.seat === seat ? null : unoWindow,
    revealed: revealed?.to === seat || revealed?.of === seat ? null : revealed
  };
  const turned = state.turnHolder === seat ? withTurn(next, stepFrom(state.activePlayers, seat, state.direction)) : next;
  return startNextRoundIfReady(turned, random);
}

// The next round may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextRoundIfReady(state, random);
}
