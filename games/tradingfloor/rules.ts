// Trading Floor rules shared by the browser and the server (validation). No turns: every step is an action from any seat
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, awaiting, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState } from '../../shared/seating.ts';
import { seatFields } from '../../shared/spectators.ts';
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { plural } from '../../shared/text.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { BULL_BEAR_PENALTY, COMMODITIES, cornerOf, deal, offerError } from './cards.ts';
import { tradingfloorInfo } from './info.ts';
import { BULL_BEAR_RULE, TARGET_RULE } from './options.ts';
import type { Card, GameState, LastMove, PublicGameState, Result, RoundSummary, Seat } from './types.ts';

const ROUND: RoundAccess<GameState, RoundSummary> = {
  get: state => state.summary,
  set: (state, summary) => ({ ...state, summary }),
  noun: 'round'
};

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    phase: 'trading',
    round: 1,
    hands: {},
    offers: [],
    nextOfferId: 1,
    scores: {},
    summary: null,
    lastMove: null
  };
}

function dealRound(state: GameState, round: number, random: Random): GameState {
  const seats = state.activePlayers;
  return {
    ...state,
    round,
    phase: 'trading',
    hands: seats.length < tradingfloorInfo.minPlayers ? {} : deal(seats, round, houseRule(state, BULL_BEAR_RULE), random),
    offers: [],
    summary: null,
    lastMove: null
  };
}

// After every join and rule change: round 1 dealt for the seats and rule now, and no turns
export function resetLobby(state: GameState, random: Random): GameState {
  const scores = Object.fromEntries(state.activePlayers.map(seat => [seat, 0]));
  return dealRound({ ...state, currentPlayer: null, scores }, 1, random);
}

const name = (state: GameState, seat: Seat) => state.playerNames[seat];
const holds = (hand: Card[] | undefined, kind: Card['kind']) => hand?.some(card => card.kind === kind) ?? false;

function topWinners(state: GameState): Seat[] {
  const top = Math.max(...state.activePlayers.map(seat => state.scores[seat] ?? 0));
  return state.activePlayers.filter(seat => (state.scores[seat] ?? 0) === top);
}

function endGame(state: GameState, status: string): GameState {
  const winners = topWinners(state);
  const names = winners.map(seat => name(state, seat)).join(' and ');
  return {
    ...state, isGameOver: true, currentPlayer: null, winners, offers: [],
    gameStatus: `${status} ${names} ${winners.length > 1 ? 'win' : 'wins'}!`
  };
}

function offer(state: GameState, seat: Seat, cards: unknown): Result<GameState> {
  const error = offerError(state.hands[seat] ?? [], cards);
  if (error) return { error };
  const ids = cards as number[];
  return { state: {
    ...state,
    started: true,
    offers: [...state.offers.filter(o => o.seat !== seat), { id: state.nextOfferId, seat, cards: ids }],
    nextOfferId: state.nextOfferId + 1,
    gameStatus: `${name(state, seat)} offers ${ids.length}!`
  } };
}

function withdraw(state: GameState, seat: Seat): Result<GameState> {
  if (!state.offers.some(o => o.seat === seat)) return { error: 'You have no open offer' };
  return { state: { ...state, offers: state.offers.filter(o => o.seat !== seat) } };
}

// The first accept to reach the server swaps; a later one, or one naming a replaced offer, finds the id gone
function accept(state: GameState, seat: Seat, id: unknown): Result<GameState> {
  const theirs = state.offers.find(o => o.id === id);
  if (!theirs) return { error: 'Already taken' };
  if (theirs.seat === seat) return { error: 'That is your own offer' };
  const count = theirs.cards.length;
  const mine = state.offers.find(o => o.seat === seat);
  if (!mine) return { error: `Make an offer of ${count} first` };
  if (mine.cards.length !== count) return { error: `Your offer must be ${plural(count, 'card')}` };
  const give = (from: Seat, out: number[], to: Seat) =>
    [...state.hands[to]!.filter(card => !mine.cards.concat(theirs.cards).includes(card.id)),
      ...state.hands[from]!.filter(card => out.includes(card.id))];
  const lastMove: LastMove = { type: 'swap', seats: [seat, theirs.seat], count };
  return { state: {
    ...state,
    hands: { ...state.hands, [seat]: give(theirs.seat, theirs.cards, seat), [theirs.seat]: give(seat, mine.cards, theirs.seat) },
    offers: state.offers.filter(o => o !== mine && o !== theirs),
    lastMove,
    gameStatus: `${name(state, seat)} and ${name(state, theirs.seat)} swapped ${plural(count, 'card')}`
  } };
}

// The corner scores; every other Bull holder and every Bear holder loses 20
function corner(state: GameState, seat: Seat): Result<GameState> {
  const hand = state.hands[seat] ?? [];
  const won = cornerOf(hand);
  if (!won) return { error: 'You have no corner' };
  const penalties: RoundSummary['penalties'] = {};
  for (const other of state.activePlayers) {
    if ((other !== seat && holds(state.hands[other], 'bull')) || holds(state.hands[other], 'bear')) penalties[other] = -BULL_BEAR_PENALTY;
  }
  const scores = Object.fromEntries(state.activePlayers.map(each =>
    [each, (state.scores[each] ?? 0) + (each === seat ? won.points : 0) + (penalties[each] ?? 0)]));
  const commodity = COMMODITIES.find(c => c.kind === won.commodity)!.name;
  const status = `${name(state, seat)} cornered ${commodity} for ${pointsText(won.points)}${won.double ? ' (doubled by the Bull)' : ''}.`;
  const next: GameState = {
    ...state,
    phase: 'summary',
    scores,
    offers: [],
    summary: { round: state.round, winner: seat, corner: won, hand, penalties, acknowledged: [] },
    lastMove: { type: 'corner', playerNumber: seat, ...won },
    gameStatus: `${status} Waiting for everyone to continue.`
  };
  return { state: Math.max(...Object.values(scores)) >= houseRule(state, TARGET_RULE) ? endGame(next, status) : next };
}

function startNextIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;
  const next = dealRound(state, state.round + 1, random);
  return { ...next, gameStatus: `Round ${next.round}: start trading!` };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  const input = asRecord(action);
  if (input?.type === 'continue') return acknowledge(state, seat, ROUND, next => startNextIfReady(next, random));
  if (state.phase === 'summary' && ['offer', 'withdraw', 'accept', 'corner'].includes(String(input?.type))) {
    return { error: 'The round is over' };
  }
  switch (input?.type) {
    case 'offer': return offer(state, seat, input.cards);
    case 'withdraw': return withdraw(state, seat);
    case 'accept': return accept(state, seat, input.offer);
    case 'corner': return corner(state, seat);
    default: return { error: 'Unknown action' };
  }
}

// A swap and a corner are steps in History; offers and withdrawals are not
export function recordsAction(state: GameState, _seat: Seat, action: unknown): boolean {
  const type = asRecord(action)?.type;
  return !state.isGameOver && state.phase === 'trading' && (type === 'accept' || type === 'corner');
}

export function applyMove(): Result<GameState> {
  return { error: 'Trading Floor has no turns' };
}

// Undoing a swap would also wipe every offer made since, and there are no turn moves to undo
export function allowsUndoVote(): boolean {
  return false;
}

// The seat's offer is withdrawn; a summary may have been waiting only for them
export function onPlayerDisconnected(state: GameState, seat: Seat, random: Random): GameState {
  return startNextIfReady({ ...state, offers: state.offers.filter(o => o.seat !== seat) }, random);
}

// Three or more left: the round is called off and dealt again for them. Fewer: the scores as they stand decide
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: _hand, ...hands } = state.hands;
  const next = { ...state, hands, offers: state.offers.filter(o => o.seat !== seat) };
  if (state.activePlayers.length < tradingfloorInfo.minPlayers) return endGame(next, `${name(state, seat)} left.`);
  if (state.phase === 'summary') return startNextIfReady(next, random);
  const dealt = dealRound(next, state.round + 1, random);
  return { ...dealt, gameStatus: `${name(state, seat)} left, so round ${dealt.round} is dealt for those left` };
}

export const waitingOn = (state: GameState): Seat[] => awaiting(state, ROUND);

export function finalStandings(state: GameState): Standing[] {
  const points = (seat: Seat) => state.scores[seat] ?? 0;
  return rankStandings(state, (a, b) => points(b) - points(a), seat => pointsText(points(seat)));
}

// Hands and the offers' cards reach only their owner; everyone sees counts
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, offers, ...view } = state;
  return {
    ...view,
    undoAvailable,
    hand: viewHand(hands, viewer),
    offering: offers.find(o => o.seat === viewer)?.cards ?? [],
    offers: offers.map(({ id, seat, cards }) => ({ id, seat, count: cards.length })),
    handCounts: handCounts(hands)
  };
}

export const privateSeatView = (state: GameState, seat: Seat) =>
  seatFields(toPublicState(state, false, seat), ['hand', 'offering']);
