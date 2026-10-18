// Phase 10 rules shared by the browser (phase names, what a selection makes) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, connectedPlayers, nextActivePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type {
  Card,
  CardColor,
  DrawSource,
  GameState,
  Group,
  GroupKind,
  HandSummary,
  LastMove,
  Move,
  PublicGameState,
  Requirement,
  Result,
  Seat,
  SeatSummary
} from './types.ts';

export const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];
export const MAX_VALUE = 12;
export const WILD_COUNT = 8;
export const SKIP_COUNT = 4;
export const HAND_SIZE = 10;
export const LAST_PHASE = 10;

const set = (size: number): Requirement => ({ kind: 'set', size });
const run = (size: number): Requirement => ({ kind: 'run', size });
const color = (size: number): Requirement => ({ kind: 'color', size });

// PHASES[0] is phase 1
export const PHASES: Requirement[][] = [
  [set(3), set(3)],
  [set(3), run(4)],
  [set(4), run(4)],
  [run(7)],
  [run(8)],
  [run(9)],
  [set(4), set(4)],
  [color(7)],
  [set(5), set(2)],
  [set(5), set(3)]
];

export function phaseRequirements(phase: number): Requirement[] {
  return PHASES[phase - 1] ?? [];
}

// e.g. 'a set of 3' or '7 cards of one color'
export function requirementName({ kind, size }: Requirement): string {
  return kind === 'color' ? `${size} cards of one color` : `a ${kind} of ${size}`;
}

// e.g. '1 set of 3 + 1 run of 4'; phases with two equal parts read '2 sets of 3'
export function phaseName(phase: number): string {
  const parts = phaseRequirements(phase);
  if (parts.length === 2 && parts[0].kind === parts[1].kind && parts[0].size === parts[1].size) {
    return `2 ${parts[0].kind}s of ${parts[0].size}`;
  }
  return parts.map(part => requirementName(part).replace(/^a /, '1 ')).join(' + ');
}

export function cardName(card: Card): string {
  if (card.kind === 'wild') return 'Wild';
  if (card.kind === 'skip') return 'Skip';
  return `${card.color} ${card.value}`;
}

// What a card left in hand costs at the end of a hand
export function cardPoints(card: Card): number {
  if (card.kind === 'wild') return 25;
  if (card.kind === 'skip') return 15;
  return card.value <= 9 ? 5 : 10;
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}

export function createDeck(): Card[] {
  const numbers = [0, 1].flatMap(() =>
    COLORS.flatMap(cardColor => Array.from({ length: MAX_VALUE }, (_, index) => ({ value: index + 1, color: cardColor }))));
  return [
    ...numbers.map(({ value, color: cardColor }, id): Card => ({ id, kind: 'number', value, color: cardColor })),
    ...Array.from({ length: WILD_COUNT }, (_, index): Card => ({ id: numbers.length + index, kind: 'wild' })),
    ...Array.from({ length: SKIP_COUNT }, (_, index): Card => ({ id: numbers.length + WILD_COUNT + index, kind: 'skip' }))
  ];
}

function shuffle<T>(items: T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type NumberCard = Extract<Card, { kind: 'number' }>;

function naturals(cards: Card[]): NumberCard[] {
  return cards.filter((card): card is NumberCard => card.kind === 'number');
}

// A group needs at least one natural card, and Skips never go in a group
function usable(cards: Card[]): boolean {
  return naturals(cards).length > 0 && !cards.some(card => card.kind === 'skip');
}

// Puts unordered cards in run order, wilds filling the gaps and then the top end (the bottom once 12 is reached)
function runOf(owner: Seat, cards: Card[]): Group | null {
  const numbers = naturals(cards).sort((a, b) => a.value - b.value);
  const values = numbers.map(card => card.value);
  if (new Set(values).size !== values.length) return null;
  const length = cards.length;
  if (length > MAX_VALUE || values[values.length - 1] - values[0] > length - 1) return null;

  const start = Math.min(values[0], MAX_VALUE - length + 1);
  const wilds = cards.filter(card => card.kind === 'wild');
  let nextWild = 0;
  const ordered = Array.from({ length }, (_, index) => numbers.find(card => card.value === start + index) ?? wilds[nextWild++]);
  return { owner, kind: 'run', start, cards: ordered };
}

// The group these cards make for one part of a phase, or null if they do not make it
export function buildGroup(owner: Seat, requirement: Requirement, cards: Card[]): Group | null {
  if (cards.length !== requirement.size || !usable(cards)) return null;
  const numbers = naturals(cards);
  if (requirement.kind === 'run') return runOf(owner, cards);
  if (requirement.kind === 'set') {
    const value = numbers[0].value;
    return numbers.every(card => card.value === value) ? { owner, kind: 'set', value, cards } : null;
  }
  const cardColor = numbers[0].color;
  return numbers.every(card => card.color === cardColor) ? { owner, kind: 'color', color: cardColor, cards } : null;
}

// Adds cards to the ends of a run one at a time: a natural that fits first, else a wild,
// placed on the side a waiting natural needs
function extendRun(group: Extract<Group, { kind: 'run' }>, cards: Card[]): Group | null {
  let start = group.start;
  let ordered = group.cards;
  let rest = cards;
  while (rest.length > 0) {
    const end = start + ordered.length - 1;
    const fits = rest.find(card => card.kind === 'number' && (card.value === start - 1 || card.value === end + 1));
    const card = fits ?? rest.find(candidate => candidate.kind === 'wild');
    if (!card) return null;
    rest = rest.filter(candidate => candidate !== card);

    const wantsLower = naturals(rest).some(candidate => candidate.value < start);
    const prepend = card.kind === 'number' ? card.value === start - 1 : (wantsLower || end === MAX_VALUE) && start > 1;
    if (!prepend && end === MAX_VALUE) return null;
    ordered = prepend ? [card, ...ordered] : [...ordered, card];
    if (prepend) start--;
  }
  return { ...group, start, cards: ordered };
}

// The group with these cards added (a hit), or null if any of them does not fit
export function extendGroup(group: Group, cards: Card[]): Group | null {
  if (cards.length === 0 || cards.some(card => card.kind === 'skip')) return null;
  if (group.kind === 'run') return extendRun(group, cards);
  const fits = naturals(cards).every(card => (group.kind === 'set' ? card.value === group.value : card.color === group.color));
  return fits ? { ...group, cards: [...group.cards, ...cards] } : null;
}

// What a wild in a run stands for, so the table can show it
export function runValue(group: Group, index: number): number | null {
  return group.kind === 'run' ? group.start + index : null;
}

export function hasLaidDown(state: Pick<GameState, 'groups'>, seat: Seat): boolean {
  return state.groups.some(group => group.owner === seat);
}

// Who a Skip may skip: any other player still in the game who is not already being skipped
export function skipTargets(state: Pick<GameState, 'activePlayers' | 'skipped'>, seat: Seat): Seat[] {
  return state.activePlayers.filter(other => other !== seat && !state.skipped.includes(other));
}

// The status line and the history describe a move in the same words
export function moveText(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'draw':
      return lastMove.source === 'pile'
        ? `${name} drew from the pile`
        : `${name} took the ${cardName(lastMove.card)} from the discard pile`;
    case 'layDown':
      return `${name} laid down phase ${lastMove.phase}`;
    case 'hit': {
      const owner = lastMove.owner === lastMove.playerNumber ? 'their own' : `${playerNames[lastMove.owner]}'s`;
      const cards = lastMove.count === 1 ? '1 card' : `${lastMove.count} cards`;
      return `${name} hit ${cards} on ${owner} ${lastMove.kind === 'color' ? 'color group' : lastMove.kind}`;
    }
    case 'discard':
      return lastMove.skipped === null
        ? `${name} discarded a ${cardName(lastMove.card)}`
        : `${name} discarded a Skip on ${playerNames[lastMove.skipped]}`;
  }
}

type Deal = Pick<GameState, 'hands' | 'drawPile' | 'discardPile'>;

// Ten cards to each player from a fresh deck, then one card face up to start the discard pile
function deal(seats: Seat[], random: Random): Deal {
  const deck = shuffle(createDeck(), random);
  const hands = Object.fromEntries(seats.map((seat, index) => [seat, deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)]));
  const dealt = seats.length * HAND_SIZE;
  return { hands, discardPile: [deck[dealt]], drawPile: deck.slice(dealt + 1) };
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    handNumber: 1,
    dealer: null,
    hands: {},
    drawPile: [],
    discardPile: [],
    groups: [],
    phases: {},
    scores: {},
    skipped: [],
    drawnBy: null,
    lastMove: null,
    handSummary: null
  };
}

// Before the first move, the cards are dealt afresh for the current players. The lowest seat goes
// first, so the dealer is the seat before it. Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const seats = state.activePlayers;
  const dealt: Deal = seats.length >= 2 ? deal(seats, random) : { hands: {}, drawPile: [], discardPile: [] };
  return {
    ...state,
    ...dealt,
    handNumber: 1,
    dealer: seats.length >= 2 ? seats[seats.length - 1] : null,
    groups: [],
    phases: Object.fromEntries(seats.map(seat => [seat, 1])),
    scores: Object.fromEntries(seats.map(seat => [seat, 0])),
    skipped: [],
    drawnBy: null
  };
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, drawPile, discardPile, ...view } = state;
  return {
    ...view,
    undoAvailable,
    myHand: viewer === null ? [] : hands[viewer] ?? [],
    handCounts: Object.fromEntries(Object.entries(hands).map(([seat, cards]) => [seat, cards.length])),
    drawCount: drawPile.length,
    discardTop: discardPile[discardPile.length - 1] ?? null
  };
}

function isCardId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function parseIds(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(isCardId) ? value : null;
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'draw': {
      const source = input.source;
      return source === 'pile' || source === 'discard' ? { type: 'draw', source } : null;
    }
    case 'layDown': {
      const groups = Array.isArray(input.groups) ? input.groups.map(parseIds) : null;
      if (!groups || groups.some(ids => ids === null)) return null;
      return { type: 'layDown', groups: groups.filter(ids => ids !== null) };
    }
    case 'hit': {
      const cards = parseIds(input.cards);
      return cards && isCardId(input.group) ? { type: 'hit', group: input.group, cards } : null;
    }
    case 'discard': {
      const skip = input.skip ?? null;
      if (!isCardId(input.card) || (skip !== null && !isCardId(skip))) return null;
      return { type: 'discard', card: input.card, skip };
    }
    default:
      return null;
  }
}

// The cards with these ids, in the order given, and the hand without them; null if any is missing or repeated
function takeCards(hand: Card[], ids: number[]): { taken: Card[]; rest: Card[] } | null {
  if (new Set(ids).size !== ids.length) return null;
  const taken = ids.map(id => hand.find(card => card.id === id));
  if (taken.some(card => card === undefined)) return null;
  return { taken: taken.filter(card => card !== undefined), rest: hand.filter(card => !ids.includes(card.id)) };
}

function mapSeats<T, U>(record: Record<Seat, T>, change: (value: T, seat: Seat) => U): Record<Seat, U> {
  return Object.fromEntries(Object.entries(record).map(([seat, value]) => [seat, change(value, Number(seat))]));
}

// Scores the hand once someone has gone out. Everyone who laid down moves on a phase.
// The game ends after a hand in which someone completed phase 10: the lowest score among them wins.
function endHand(state: GameState, wentOut: Seat): GameState {
  const seats = Object.fromEntries(state.activePlayers.map((seat): [Seat, SeatSummary] => {
    const cards = state.hands[seat] ?? [];
    const points = handPoints(cards);
    return [seat, {
      phase: state.phases[seat],
      completed: hasLaidDown(state, seat),
      cardsLeft: cards.length,
      points,
      scoreAfter: state.scores[seat] + points
    }];
  }));
  const phases = mapSeats(state.phases, (phase, seat) => (seats[seat]?.completed ? phase + 1 : phase));
  const scores = mapSeats(state.scores, (score, seat) => seats[seat]?.scoreAfter ?? score);
  const handSummary: HandSummary = { handNumber: state.handNumber, wentOut, seats, acknowledged: [] };
  const scored: GameState = { ...state, phases, scores, handSummary, currentPlayer: null, drawnBy: null, skipped: [] };

  const finishers = state.activePlayers.filter(seat => seats[seat].completed && seats[seat].phase === LAST_PHASE);
  if (finishers.length === 0) {
    return { ...scored, gameStatus: `${state.playerNames[wentOut]} went out. Hand ${state.handNumber} scored. Waiting for everyone to continue.` };
  }

  const best = Math.min(...finishers.map(seat => scores[seat]));
  const winners = finishers.filter(seat => scores[seat] === best);
  const names = winners.map(seat => state.playerNames[seat]);
  return {
    ...scored,
    isGameOver: true,
    winners,
    gameStatus: winners.length === 1
      ? `${names[0]} wins with ${best} points!`
      : `${names.join(' and ')} share the win with ${best} points!`
  };
}

// The next hand may have been waiting only for the player who left
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const next = { ...state, skipped: state.skipped.filter(other => other !== seat) };
  return startNextHandIfReady(next, random);
}

// The next hand may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextHandIfReady(state, random);
}

// Deals the next hand once every connected player has acknowledged the summary. The dealer moves on one seat.
function startNextHandIfReady(state: GameState, random: Random): GameState {
  const summary = state.handSummary;
  if (!summary || state.isGameOver) return state;
  if (!connectedPlayers(state).every(seat => summary.acknowledged.includes(seat))) return state;

  const dealer = state.dealer === null ? state.activePlayers[0] : nextActivePlayer(state, state.dealer);
  const starter = dealer === null ? null : nextActivePlayer(state, dealer);
  const starterName = starter === null ? '' : state.playerNames[starter];
  return {
    ...state,
    ...deal(state.activePlayers, random),
    handNumber: state.handNumber + 1,
    dealer,
    currentPlayer: starter,
    groups: [],
    skipped: [],
    drawnBy: null,
    handSummary: null,
    gameStatus: `${starterName} starts hand ${state.handNumber + 1}.`
  };
}

export function acknowledgeHand(state: GameState, seat: Seat, random: Random = Math.random): Result<GameState> {
  const summary = state.handSummary;
  if (!summary || state.isGameOver) return { error: 'Nothing to continue' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (summary.acknowledged.includes(seat)) return { state };

  const next: GameState = {
    ...state,
    handSummary: { ...summary, acknowledged: [...summary.acknowledged, seat] },
    gameStatus: `${state.playerNames[seat]} is ready for the next hand`
  };
  return { state: startNextHandIfReady(next, random) };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (asRecord(action)?.type === 'acknowledgeHand') return acknowledgeHand(state, seat, random);
  return { error: 'Unknown action' };
}

// The turn passes on, past anyone a Skip made lose their turn; each Skip is used up as it is passed
function passTurn(state: GameState, from: Seat): GameState {
  let skipped = state.skipped;
  let next = nextActivePlayer(state, from);
  while (next !== null && skipped.includes(next)) {
    const passed = next;
    skipped = skipped.filter(seat => seat !== passed);
    next = nextActivePlayer(state, passed);
  }
  return { ...state, skipped, currentPlayer: next, drawnBy: null };
}

function draw(state: GameState, seat: Seat, source: DrawSource, random: Random): Result<GameState> {
  const hand = state.hands[seat];
  if (source === 'discard') {
    const top = state.discardPile[state.discardPile.length - 1];
    if (!top) return { error: 'The discard pile is empty' };
    if (top.kind === 'skip') return { error: 'A Skip cannot be picked up' };
    return { state: {
      ...state,
      hands: { ...state.hands, [seat]: [...hand, top] },
      discardPile: state.discardPile.slice(0, -1),
      lastMove: { playerNumber: seat, type: 'draw', source, card: top }
    } };
  }

  // An empty pile is refilled from the discards under the top card
  let drawPile = state.drawPile;
  let discardPile = state.discardPile;
  if (drawPile.length === 0) {
    drawPile = shuffle(discardPile.slice(0, -1), random);
    discardPile = discardPile.slice(-1);
  }
  if (drawPile.length === 0) return { error: 'There are no cards left to draw' };
  return { state: {
    ...state,
    hands: { ...state.hands, [seat]: [...hand, drawPile[drawPile.length - 1]] },
    drawPile: drawPile.slice(0, -1),
    discardPile,
    lastMove: { playerNumber: seat, type: 'draw', source }
  } };
}

function layDown(state: GameState, seat: Seat, groupIds: number[][]): Result<GameState> {
  if (hasLaidDown(state, seat)) return { error: 'You have already laid down your phase this hand' };
  const phase = state.phases[seat];
  const requirements = phaseRequirements(phase);
  if (groupIds.length !== requirements.length) return { error: `Phase ${phase} needs ${phaseName(phase)}` };
  const taken = takeCards(state.hands[seat], groupIds.flat());
  if (!taken) return { error: 'Those cards are not in your hand' };

  const byId = (id: number) => state.hands[seat].find(card => card.id === id);
  const groups = requirements.map((requirement, index) =>
    buildGroup(seat, requirement, groupIds[index].map(byId).filter(card => card !== undefined)));
  const invalid = groups.findIndex(group => group === null);
  if (invalid >= 0) return { error: `Group ${invalid + 1} is not ${requirementName(requirements[invalid])}` };

  return { state: {
    ...state,
    hands: { ...state.hands, [seat]: taken.rest },
    groups: [...state.groups, ...groups.filter(group => group !== null)],
    lastMove: { playerNumber: seat, type: 'layDown', phase }
  } };
}

function hit(state: GameState, seat: Seat, index: number, ids: number[]): Result<GameState> {
  if (!hasLaidDown(state, seat)) return { error: 'Lay down your own phase before hitting' };
  const group = state.groups[index];
  if (!group) return { error: 'There is no such group' };
  const taken = takeCards(state.hands[seat], ids);
  if (!taken || ids.length === 0) return { error: 'Those cards are not in your hand' };
  const extended = extendGroup(group, taken.taken);
  if (!extended) return { error: 'Those cards do not fit that group' };

  return { state: {
    ...state,
    hands: { ...state.hands, [seat]: taken.rest },
    groups: state.groups.map((existing, position) => (position === index ? extended : existing)),
    lastMove: { playerNumber: seat, type: 'hit', group: index, owner: group.owner, kind: group.kind, count: ids.length }
  } };
}

function discard(state: GameState, seat: Seat, id: number, skip: Seat | null): Result<GameState> {
  const taken = takeCards(state.hands[seat], [id]);
  if (!taken) return { error: 'That card is not in your hand' };
  const card = taken.taken[0];

  const targets = skipTargets(state, seat);
  const skipped = card.kind === 'skip' && targets.length > 0 ? skip : null;
  if (card.kind === 'skip' && targets.length > 0 && (skipped === null || !targets.includes(skipped))) {
    return { error: 'Choose a player to skip' };
  }

  return { state: {
    ...state,
    hands: { ...state.hands, [seat]: taken.rest },
    discardPile: [...state.discardPile, card],
    skipped: skipped === null ? state.skipped : [...state.skipped, skipped],
    lastMove: { playerNumber: seat, type: 'discard', card, skipped }
  } };
}

// A turn is several moves by the same player: draw, optionally lay down and hit, then discard.
// The turn passes only on the discard; the hand ends as soon as the player has no cards left.
export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  const drawn = state.drawnBy === seat;
  if (parsed.type === 'draw' && drawn) return { error: 'You have already drawn this turn' };
  if (parsed.type !== 'draw' && !drawn) return { error: 'Draw a card first' };

  let result: Result<GameState>;
  switch (parsed.type) {
    case 'draw': result = draw(state, seat, parsed.source, random); break;
    case 'layDown': result = layDown(state, seat, parsed.groups); break;
    case 'hit': result = hit(state, seat, parsed.group, parsed.cards); break;
    case 'discard': result = discard(state, seat, parsed.card, parsed.skip); break;
  }
  if ('error' in result) return result;

  const next: GameState = {
    ...result.state,
    drawnBy: seat,
    gameStatus: result.state.lastMove ? moveText(result.state.lastMove, state.playerNames) : ''
  };
  if (next.hands[seat].length === 0) return { state: endHand(next, seat) };
  return { state: parsed.type === 'discard' ? passTurn(next, seat) : next };
}
