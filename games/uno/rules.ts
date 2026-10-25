// UNO rules shared by the browser (playable cards) and the server (validation).
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Standing } from '../../shared/types.ts';
import type {
  Card, Color, Direction, GameState, LastMove, Move, PendingFour, PublicGameState, Result, RoundSummary, Seat, Value
} from './types.ts';
import { TARGET_RULE, STACKING_RULE, SEVEN_ZERO_RULE, DRAW_UNTIL_RULE, JUMP_IN_RULE } from './options.ts';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];
export const HAND_SIZE = 7;

type Rules = Pick<GameState, 'houseRules'>;
export const targetScore = (state: Rules): number => houseRule(state, TARGET_RULE);
const stacking = (state: Rules): boolean => houseRule(state, STACKING_RULE);
export const sevenZero = (state: Rules): boolean => houseRule(state, SEVEN_ZERO_RULE);
const drawUntilPlayable = (state: Rules): boolean => houseRule(state, DRAW_UNTIL_RULE);
const jumpIn = (state: Rules): boolean => houseRule(state, JUMP_IN_RULE);
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

// With jump-in, a number card identical in color and number to the top card may be played out of turn, unless a Draw stack,
// a Wild Draw Four, a round summary or a starting-color choice is waiting
export function canJumpIn(
  state: Pick<GameState, 'houseRules' | 'pendingFour' | 'pendingDraw' | 'currentColor' | 'roundSummary'>,
  top: Card | null,
  card: Card
): boolean {
  if (!jumpIn(state) || state.pendingFour || state.pendingDraw || state.roundSummary || state.currentColor === null) return false;
  return top !== null && NUMBERS.includes(card.value) && sameCard(card, top);
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
  pendingDraw: null,
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
    pendingDraw: state.pendingDraw ?? null,
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
      const swapWith = typeof input.swapWith === 'number' ? { swapWith: input.swapWith } : {};
      if (!card) return null;
      if (!isWild(card)) return { type: 'play', card, uno, ...swapWith };
      return isColor(input.color) ? { type: 'play', card, color: input.color, uno, ...swapWith } : null;
    }
    default:
      return null;
  }
}

function describeDraw(lastMove: Extract<LastMove, { type: 'draw' }>, name: string): string {
  const count = lastMove.count ?? 1;
  if (count === 1) return lastMove.passed ? `${name} drew a card and could not play it` : `${name} drew a card`;
  return lastMove.passed ? `${name} drew ${count} cards and could not play any` : `${name} drew ${count} cards`;
}

// How the status line and the history describe a move, e.g. 'Alice played red Draw Two; Bob draws 2 and is skipped'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'pass':
      return `${name} passed`;
    case 'draw':
      return describeDraw(lastMove, name);
    case 'chooseColor':
      return `${name} chose ${lastMove.color} to start`;
    case 'accept':
      return `${name} accepted the ${lastMove.stacked ? 'stack' : 'Wild Draw Four'}, draws ${lastMove.drew} and is skipped`;
    case 'challenge': {
      const challenged = playerNames[lastMove.challenged];
      return lastMove.guilty
        ? `${name} challenged ${challenged}'s Wild Draw Four and won; ${challenged} draws ${lastMove.drew}`
        : `${name} challenged ${challenged}'s Wild Draw Four and lost; ${name} draws ${lastMove.drew} and is skipped`;
    }
    case 'play': {
      const { card, color, target, drew, wentOut, stack, swappedWith, passedHands, jumpedIn } = lastMove;
      const verb = jumpedIn ? 'jumped in with' : 'played';
      const played = `${name} ${verb} ${isWild(card) ? `${cardName(card)} (${color})` : cardName(card)}`;
      const targetName = target === null ? '' : playerNames[target];
      if (wentOut) return target === null ? `${played} and went out` : `${played} and went out; ${targetName} draws ${drew}`;
      if (swappedWith !== undefined) return `${played}; swaps hands with ${playerNames[swappedWith]}`;
      if (passedHands) return `${played}; every hand passes on`;
      if (target === null) return played;
      if (stack !== undefined) {
        const lone = card.value === 'wildDrawFour' && stack === DRAWS.wildDrawFour;
        return lone ? `${played}; ${targetName} may stack it, accept or challenge it` : `${played}; ${targetName} must stack or draw ${stack}`;
      }
      if (card.value === 'wildDrawFour') return `${played}; ${targetName} may accept or challenge it`;
      return `${played}; ${targetName} ${drew > 0 ? `draws ${drew} and is skipped` : 'is skipped'}`;
    }
  }
}

function recorded(state: GameState, lastMove: LastMove): GameState {
  return { ...state, lastMove, gameStatus: describeMove(lastMove, state.playerNames) };
}

// The player who went out scores every card left in the other hands, after the next player has drawn for a last
// Draw Two or Wild Draw Four. The first to reach targetScore(state) wins; otherwise the next round waits for everyone to continue.
function endRound(state: GameState, seat: Seat, card: Card, color: Color, random: Random, jumped = false): GameState {
  const count = (DRAWS[card.value] ?? 0) + (state.pendingDraw?.count ?? 0);
  const target = count > 0 ? stepFrom(state.activePlayers, seat, state.direction) : null;
  const { state: drawn, drew } = target === null ? { state, drew: 0 } : dealTo(state, target, count, random);

  const cardsLeft = Object.fromEntries(state.activePlayers.map(other => [other, drawn.hands[other].length]));
  const points = state.activePlayers.reduce((sum, other) => sum + handPoints(drawn.hands[other]), 0);
  const total = state.scores[seat] + points;
  const scored: GameState = {
    ...withTurn(drawn, null),
    pendingDraw: null,
    pendingFour: null,
    scores: { ...state.scores, [seat]: total },
    unoWindow: null,
    roundSummary: { roundNumber: state.roundNumber, wentOut: seat, points, cardsLeft, acknowledged: [] },
    lastMove: { type: 'play', playerNumber: seat, card, color, target, drew, wentOut: true, ...(jumped ? { jumpedIn: true as const } : {}) }
  };

  const name = state.playerNames[seat];
  if (total >= targetScore(state)) {
    return { ...scored, isGameOver: true, winners: [seat], gameStatus: `${name} went out and wins with ${total} points!` };
  }
  return { ...scored, gameStatus: `${name} went out and scores ${points} points. Waiting for everyone to continue.` };
}

const STACK_ERROR = 'Stack a Draw Two or Wild Draw Four, or accept the cards';

type PlayExtras = { swappedWith?: Seat; passedHands?: true };

// Under the 7-0 rule a 7 swaps hands with another player and a 0 passes every hand one seat in the direction of play
function moveHands(state: GameState, seat: Seat, card: Card, swapWith: Seat | undefined): { hands: GameState['hands'] } & PlayExtras {
  const { hands, activePlayers: players } = state;
  if (card.value !== '0') {
    if (swapWith === undefined) return { hands };
    return { hands: { ...hands, [seat]: hands[swapWith], [swapWith]: hands[seat] }, swappedWith: swapWith };
  }
  const passed = Object.fromEntries(players.map(other => [stepFrom(players, other, state.direction), hands[other]]));
  return { hands: { ...hands, ...passed }, passedHands: true };
}

// A play that leaves one card opens the UNO window, already closed if `uno` called it with the play.
// A Wild Draw Four waits for its target to accept or challenge it. With stacking, so does a Draw Two, and
// the target may answer with another Draw Two (on a Draw Two) or Wild Draw Four instead.
function play(
  state: GameState, seat: Seat, card: Card, chosen: Color | undefined, uno: boolean, swapWith: Seat | undefined, random: Random
): Result<GameState> {
  const hand = state.hands[seat];
  const index = hand.findIndex(held => sameCard(held, card));
  if (index < 0) return { error: 'You do not have that card' };
  // A jump-in is out of turn, so the turn holder's drawn card does not limit it
  const jumping = seat !== state.currentPlayer;
  if (!jumping && state.drawnCard && !sameCard(state.drawnCard, card)) return { error: 'You may only play the card you drew' };
  const top = state.discardPile[state.discardPile.length - 1] ?? null;
  const owed = state.pendingDraw ?? null;
  if (owed) {
    if (!(card.value in DRAWS)) return { error: STACK_ERROR };
    if (card.value === 'drawTwo' && top?.value === 'wildDrawFour') return { error: 'A Draw Two cannot go on a Wild Draw Four' };
  } else if (!canPlay(card, top, state.currentColor)) {
    return { error: 'That card does not match' };
  }

  const color = chosen ?? card.color as Color;
  const rest = hand.filter((_, i) => i !== index);
  const played: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: rest },
    discardPile: [...state.discardPile, card],
    currentColor: color,
    unoWindow: rest.length === 1 ? { seat, called: uno } : null
  };
  if (rest.length === 0) return { state: endRound(played, seat, card, color, random, jumping) };

  const stacks = stacking(state);
  if (card.value === 'wildDrawFour' || (stacks && card.value === 'drawTwo')) {
    const target = stepFrom(state.activePlayers, seat, state.direction);
    const count = (owed?.count ?? 0) + (DRAWS[card.value] ?? 0);
    const pendingDraw = stacks ? { count, target } : null;
    // Only a lone Wild Draw Four can be challenged
    const pendingFour: PendingFour | null = card.value === 'wildDrawFour' && !owed
      ? { by: seat, target, previousColor: state.currentColor as Color } : null;
    const lastMove: LastMove = {
      type: 'play', playerNumber: seat, card, color, target, drew: 0, wentOut: false, ...(stacks ? { stack: count } : {})
    };
    return { state: recorded(withTurn({ ...played, pendingDraw, pendingFour }, target), lastMove) };
  }

  let extra: PlayExtras = {};
  let dealt = played;
  if (sevenZero(state) && (card.value === '7' || card.value === '0')) {
    if (card.value === '7' && (swapWith === undefined || swapWith === seat || !state.activePlayers.includes(swapWith))) {
      return { error: 'Choose a player to swap hands with' };
    }
    const { hands, ...moved } = moveHands(played, seat, card, swapWith);
    extra = moved;
    // Whoever is left with one card by the swap or the pass has no UNO to call
    dealt = { ...played, hands, unoWindow: null };
  }

  const { state: next, target, drew } = applyEffect(dealt, seat, card, random);
  const jumped = jumping ? { jumpedIn: true as const } : {};
  return { state: recorded(next, { type: 'play', playerNumber: seat, card, color, target, drew, wentOut: false, ...extra, ...jumped }) };
}

// The drawn card goes to the hand. If it can be played the player may play it or pass; otherwise the turn moves on.
// Drawing until you can play takes cards until one plays or the piles run out.
function draw(state: GameState, seat: Seat, random: Random): Result<GameState> {
  if (state.drawnCard) return { error: 'You already drew a card' };
  if (!canDraw(state)) return { error: 'There are no cards left to draw' };

  const repeat = drawUntilPlayable(state);
  let next = state;
  let count = 0;
  let playable = false;
  while (!playable && canDraw(next) && (repeat || count === 0)) {
    next = dealTo(next, seat, 1, random).state;
    count++;
    const top = next.discardPile[next.discardPile.length - 1] ?? null;
    playable = canPlay(next.hands[seat][next.hands[seat].length - 1], top, state.currentColor);
  }
  const card = next.hands[seat][next.hands[seat].length - 1];
  const lastMove: LastMove = { type: 'draw', playerNumber: seat, passed: !playable, ...(count > 1 ? { count } : {}) };
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

// Takes the Wild Draw Four's 4 cards, or the whole stack, and loses the turn
function accept(state: GameState, seat: Seat, random: Random): GameState {
  const count = state.pendingDraw?.count ?? DRAWS.wildDrawFour ?? 0;
  const { state: drawn, drew } = dealTo({ ...state, pendingFour: null, pendingDraw: null }, seat, count, random);
  const next = withTurn(drawn, stepFrom(state.activePlayers, seat, state.direction));
  return recorded(next, { type: 'accept', playerNumber: seat, drew, ...(state.pendingFour ? {} : { stacked: true as const }) });
}

// The challenged player shows their hand to the challenger alone. If it holds a card of the color that was current when
// they played the Wild Draw Four, they draw 4 instead and the challenger takes their turn; otherwise the challenger
// draws 6 and loses their turn.
function challenge(state: GameState, seat: Seat, pending: PendingFour, random: Random): GameState {
  const hand = state.hands[pending.by];
  const guilty = hand.some(held => held.color === pending.previousColor);
  const drawer = guilty ? pending.by : seat;
  const count = guilty ? DRAWS.wildDrawFour ?? 0 : FAILED_CHALLENGE_DRAW;
  const { state: drawn, drew } = dealTo({ ...state, pendingFour: null, pendingDraw: null }, drawer, count, random);
  const next = withTurn(
    { ...drawn, revealed: { to: seat, of: pending.by, hand } },
    guilty ? seat : stepFrom(state.activePlayers, seat, state.direction)
  );
  return recorded(next, { type: 'challenge', playerNumber: seat, challenged: pending.by, guilty, drew });
}

// Whether a player who does not hold the turn may make this move: only a jump-in
export function allowsOutOfTurn(state: GameState, seat: Seat, move: unknown): boolean {
  const parsed = parseMove(move);
  if (parsed?.type !== 'play' || !state.activePlayers.includes(seat)) return false;
  const top = state.discardPile[state.discardPile.length - 1] ?? null;
  return state.hands[seat]?.some(held => sameCard(held, parsed.card)) === true && canJumpIn(state, top, parsed.card);
}

// Any move closes the UNO window, and the challenger's next move hides a challenged hand again
export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  const pending = state.pendingFour;
  const owed = state.pendingDraw ?? null;
  const next: GameState = { ...state, unoWindow: null, revealed: state.revealed?.to === seat ? null : state.revealed };

  if (parsed.type === 'chooseColor') return chooseColor(next, seat, parsed.color);
  if (state.currentColor === null) return { error: 'Choose the first color' };
  if (parsed.type === 'challenge' || parsed.type === 'accept') {
    if (parsed.type === 'challenge' && pending) return { state: challenge(next, seat, pending, random) };
    if (parsed.type === 'accept' && (pending || owed)) return { state: accept(next, seat, random) };
    return { error: 'There is no Wild Draw Four to answer' };
  }
  if (parsed.type !== 'play') {
    if (owed) return { error: STACK_ERROR };
    if (pending) return { error: 'Accept the Wild Draw Four or challenge it' };
    return parsed.type === 'draw' ? draw(next, seat, random) : pass(next, seat);
  }
  if (pending && !owed) return { error: 'Accept the Wild Draw Four or challenge it' };
  return play(next, seat, parsed.card, parsed.color, parsed.uno === true, parsed.swapWith, random);
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
  const owed = state.pendingDraw ?? null;
  const fourGone = pendingFour?.by === seat || pendingFour?.target === seat;
  const next: GameState = {
    ...state,
    hands,
    drawPile: [...hand, ...state.drawPile],
    pendingFour: fourGone ? null : pendingFour,
    pendingDraw: fourGone || owed?.target === seat ? null : owed,
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

export function finalStandings(state: GameState): Standing[] {
  const points = (seat: Seat) => state.scores[seat] ?? 0;
  return rankStandings(state, (a, b) => points(b) - points(a), seat => pointsText(points(seat)));
}
