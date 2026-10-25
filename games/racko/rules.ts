// Rack-O rules shared by the browser (move text) and the server (validation).
// Source: https://en.wikipedia.org/wiki/Rack-O, and the default target score of 500 from the official rules.
import { viewHand } from '../../shared/hands.ts';
import { houseRule, targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, GameState, LastMove, Move, Pile, PublicGameState, Result, RoundSummary, Seat } from './types.ts';

export const RACK_SIZE = 10;
export const RACKO_POINTS = 75;
export const CARD_POINTS = 5;
const TARGET_RULE = targetScoreRule(500, [250, 1000]);
export const RACKO_RULES: HouseRule[] = [TARGET_RULE];

export const targetScore = (state: Pick<GameState, 'houseRules'>): number => houseRule(state, TARGET_RULE);

// Wikipedia, Game play: cards 1 to 40 with two players, 1 to 50 with three, the whole 60 with four
export function deckSize(players: number): number {
  return players <= 2 ? 40 : players === 3 ? 50 : 60;
}

// Strictly ascending from slot 1 to slot 10
export function isAscending(rack: Card[]): boolean {
  return rack.every((card, slot) => slot === 0 || card > rack[slot - 1]);
}

// What a player who did not call Rack-O scores: 5 for each card in ascending order from slot 1, stopping where it breaks
export function roundPoints(rack: Card[]): number {
  let run = 0;
  while (run < rack.length && (run === 0 || rack[run] > rack[run - 1])) run++;
  return run * CARD_POINTS;
}

// Cards go round the table one at a time into the highest open slot, so the first card dealt lands in slot 10.
// The next card is turned face up to start the discard pile.
export function deal(deck: Card[], seats: Seat[]): { racks: Record<Seat, Card[]>; drawPile: Card[]; discardPile: Card[] } {
  const racks: Record<Seat, Card[]> = Object.fromEntries(seats.map(seat => [seat, Array<Card>(RACK_SIZE)]));
  seats.forEach((seat, index) => {
    for (let round = 0; round < RACK_SIZE; round++) racks[seat][RACK_SIZE - 1 - round] = deck[round * seats.length + index];
  });
  const rest = deck.slice(seats.length * RACK_SIZE);
  return { racks, drawPile: rest.slice(0, -1), discardPile: rest.slice(-1) };
}

export function moveText(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'draw':
      return lastMove.from === 'discard'
        ? `${name} took the ${lastMove.card} from the discard pile`
        : `${name} drew from the draw pile${lastMove.reshuffled ? ' (the discards were reshuffled into it)' : ''}`;
    case 'place': {
      const source = lastMove.from === 'discard' ? 'the discard pile' : 'the draw pile';
      const text = `${name} put the card from ${source} in slot ${lastMove.slot + 1} and discarded the ${lastMove.replaced}`;
      return lastMove.rackO ? `${text}, calling Rack-O!` : text;
    }
    case 'discard':
      return `${name} discarded the ${lastMove.card}`;
  }
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    round: 1,
    starter: null,
    scores: {},
    racks: {},
    drawPile: [],
    discardPile: [],
    held: null,
    roundSummary: null,
    lastMove: null
  };
}

function dealRound(state: GameState, starter: Seat, random: Random): GameState {
  const seats = state.activePlayers;
  const deck = shuffle(Array.from({ length: deckSize(seats.length) }, (_, index) => index + 1), random);
  return { ...state, ...deal(deck, seats), starter, currentPlayer: starter, held: null, roundSummary: null, lastMove: null };
}

// Before the first move, the cards are dealt afresh for the current players. Nothing is dealt until two are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const seats = state.activePlayers;
  const cleared: GameState = {
    ...state,
    round: 1,
    scores: Object.fromEntries(seats.map(seat => [seat, 0])),
    racks: {},
    drawPile: [],
    discardPile: [],
    starter: null,
    held: null,
    roundSummary: null,
    lastMove: null
  };
  return seats.length < 2 ? cleared : dealRound(cleared, seats[0], random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { racks, drawPile, discardPile, held, ...view } = state;
  return {
    ...view,
    undoAvailable,
    myRack: viewHand(racks, viewer),
    drawCount: drawPile.length,
    discardTop: discardPile.at(-1) ?? null,
    discardCount: discardPile.length,
    heldFrom: held?.from ?? null,
    myHeld: held !== null && held.by === viewer ? held.card : null
  };
}

// The draw pile is reshuffled after an undo, so redrawing cannot reveal what comes next
export function onUndo(state: GameState, random: Random): GameState {
  return { ...state, drawPile: shuffle(state.drawPile, random) };
}

function isSlot(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < RACK_SIZE;
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'draw': return input.from === 'deck' || input.from === 'discard' ? { type: 'draw', from: input.from } : null;
    case 'place': return isSlot(input.slot) ? { type: 'place', slot: input.slot } : null;
    case 'discard': return { type: 'discard' };
    default: return null;
  }
}

function draw(state: GameState, seat: Seat, from: Pile, random: Random): Result<GameState> {
  if (state.held) return { error: 'You already drew a card: place it or discard it' };
  if (from === 'discard') {
    const card = state.discardPile.at(-1);
    if (card === undefined) return { error: 'The discard pile is empty' };
    const lastMove: LastMove = { playerNumber: seat, type: 'draw', from, card };
    return { state: {
      ...state, discardPile: state.discardPile.slice(0, -1), held: { by: seat, card, from }, lastMove,
      gameStatus: moveText(lastMove, state.playerNames)
    } };
  }
  // An empty draw pile is refilled with the discards but the top card, shuffled
  const reshuffled = state.drawPile.length === 0;
  if (reshuffled && state.discardPile.length < 2) return { error: 'There are no cards to draw from the deck' };
  const pile = reshuffled ? shuffle(state.discardPile.slice(0, -1), random) : state.drawPile;
  const lastMove: LastMove = { playerNumber: seat, type: 'draw', from, reshuffled };
  return { state: {
    ...state,
    drawPile: pile.slice(0, -1),
    discardPile: reshuffled ? state.discardPile.slice(-1) : state.discardPile,
    held: { by: seat, card: pile[pile.length - 1], from },
    lastMove,
    gameStatus: moveText(lastMove, state.playerNames)
  } };
}

function endTurn(state: GameState, seat: Seat, lastMove: LastMove): GameState {
  return {
    ...state,
    held: null,
    currentPlayer: nextActivePlayer(state, seat),
    lastMove,
    gameStatus: moveText(lastMove, state.playerNames)
  };
}

function discard(state: GameState, seat: Seat): Result<GameState> {
  const { held } = state;
  if (!held) return { error: 'Draw a card first' };
  if (held.from === 'discard') return { error: 'A card taken from the discard pile must be placed in your rack' };
  return { state: endTurn({ ...state, discardPile: [...state.discardPile, held.card] }, seat, { playerNumber: seat, type: 'discard', card: held.card }) };
}

// The player who called Rack-O scores 75 and the others 5 per card in order. The first to the target score wins; the higher total
// wins if several pass it in the same round, and equal totals share.
function endRound(state: GameState, caller: Seat, lastMove: LastMove): GameState {
  const points: Record<Seat, number> = Object.fromEntries(state.activePlayers.map(seat =>
    [seat, seat === caller ? RACKO_POINTS : roundPoints(state.racks[seat])]));
  const scores = Object.fromEntries(state.activePlayers.map(seat => [seat, state.scores[seat] + points[seat]]));
  const roundSummary: RoundSummary = { round: state.round, caller, points, racks: state.racks, acknowledged: [] };
  const top = Math.max(...Object.values(scores));
  const over = top >= targetScore(state);
  const winners = over ? state.activePlayers.filter(seat => scores[seat] === top) : [];
  const name = state.playerNames[caller];
  const status = over
    ? `${name} called Rack-O! ${winners.map(seat => state.playerNames[seat]).join(' and ')} ${winners.length > 1 ? 'win' : 'wins'} with ${top} points`
    : `${name} called Rack-O and scores ${RACKO_POINTS} points. Waiting for everyone to continue.`;
  return { ...state, held: null, scores, roundSummary, currentPlayer: null, lastMove, isGameOver: over, winners, gameStatus: status };
}

function place(state: GameState, seat: Seat, slot: number): Result<GameState> {
  const { held } = state;
  if (!held) return { error: 'Draw a card first' };
  const replaced = state.racks[seat][slot];
  const rack = state.racks[seat].map((card, index) => (index === slot ? held.card : card));
  const rackO = isAscending(rack);
  const lastMove: LastMove = { playerNumber: seat, type: 'place', slot, from: held.from, replaced, rackO };
  const next: GameState = { ...state, racks: { ...state.racks, [seat]: rack }, discardPile: [...state.discardPile, replaced] };
  return { state: rackO ? endRound(next, seat, lastMove) : endTurn(next, seat, lastMove) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (state.isGameOver || state.roundSummary) return { error: 'The round is over' };
  switch (parsed.type) {
    case 'draw': return draw(state, seat, parsed.from, random);
    case 'place': return place(state, seat, parsed.slot);
    case 'discard': return discard(state, seat);
  }
}

const ROUND: RoundAccess<GameState, RoundSummary> = {
  get: state => state.roundSummary,
  set: (state, roundSummary) => ({ ...state, roundSummary }),
  noun: 'round'
};

// Deals the next round once every connected player has pressed Continue. The first turn passes to the starter's left.
function startNextRoundIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;
  const starter = nextActivePlayer(state, state.starter ?? 0) as Seat;
  const round = state.round + 1;
  return { ...dealRound({ ...state, round }, starter, random), gameStatus: `Round ${round}: ${state.playerNames[starter]} goes first` };
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  return acknowledge(state, seat, ROUND, next => startNextRoundIfReady(next, random));
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  if (asRecord(action)?.type !== 'acknowledgeRound') return { error: 'Unknown action' };
  return acknowledgeRound(state, seat, random);
}

// The leaver's rack and any card they were holding go into the draw pile, shuffled. The platform has already moved the
// turn on. The next round may have been waiting only for them.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: rack = [], ...racks } = state.racks;
  const { [seat]: _score, ...scores } = state.scores;
  const held = state.held?.by === seat ? state.held.card : null;
  return startNextRoundIfReady({
    ...state,
    racks,
    scores,
    held: held === null ? state.held : null,
    drawPile: shuffle([...state.drawPile, ...rack, ...(held === null ? [] : [held])], random)
  }, random);
}

// The next round may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextRoundIfReady(state, random);
}
