// Cribbage's show: each hand, then the crib, counted in order, and Muggins when the house rule is on.
//
// From Wikipedia's "Cribbage" article: hands are counted from the dealer's left, the dealer's last, then the crib,
// which the dealer scores. Under Muggins a player counts their own hand, and an opponent may take points they missed.
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, awaiting, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { nextActivePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import { MUGGINS_RULE, MUGGINS_STYLE_RULE } from './options.ts';
import { addPoints, dealHand, parseCard, sideOf, waitingOn as discardsAwaited } from './rules.ts';
import { describeItems, matchCombination, scoreShow, totalOf } from './scoring.ts';
import type { Card, GameState, LastMove, PublicShow, Result, RoundSummary, ScoreItem, Seat, Show, Side } from './types.ts';

export const MUGGINS_MS = 20000;
const MISSED_NOTHING_COST = 2;

const muggins = (state: GameState) => houseRule(state, MUGGINS_RULE);
const dealerOf = (state: GameState): Seat => state.dealer ?? state.activePlayers[0];
const whose = (state: GameState, show: Show) => (show.crib ? 'the crib' : `${state.playerNames[show.owner]}'s hand`);

// The seats after the dealer, the dealer, then the crib
function showOrder(state: GameState): { owner: Seat; crib: boolean }[] {
  const seats = state.activePlayers;
  const at = seats.indexOf(dealerOf(state));
  const owners = [...seats.slice(at + 1), ...seats.slice(0, at + 1)];
  return [...owners.map(owner => ({ owner, crib: false })), { owner: dealerOf(state), crib: true }];
}

// The next count in the order, made up when it is reached so the crib stays hidden until then
function nextShowOf(state: GameState): Show | null {
  const turn = showOrder(state)[state.shows.length];
  if (!turn || !state.starter) return null;
  const cards = turn.crib ? state.crib : state.played[turn.owner] ?? [];
  const items = scoreShow(cards, state.starter, turn.crib);
  return { ...turn, cards, items, total: totalOf(items), claimed: null, muggins: [], passed: [], taken: [], closesAt: null };
}

const openShow = (state: GameState): Show | null => (state.phase === 'show' ? state.shows[state.showIndex] ?? null : null);
const opponents = (state: GameState, show: Show) => state.activePlayers.filter(seat => sideOf(state, seat) !== sideOf(state, show.owner));
const answered = (show: Show, seat: Seat) => show.passed.includes(seat) || show.muggins.some(press => press.by === seat);
const withShow = (state: GameState, show: Show): GameState => ({ ...state, shows: state.shows.map((s, i) => (i === state.showIndex ? show : s)) });

// Muggins off: every count is scored at once, in order, until a side wins. On: the first count waits for its claim.
export function startShow(state: GameState): GameState {
  const begun: GameState = { ...state, phase: 'show', currentPlayer: null, shows: [], showIndex: 0 };
  if (muggins(state)) return awaitClaim(begun);
  let next = begun;
  for (let show = nextShowOf(next); show; show = nextShowOf(next)) {
    next = count({ ...next, shows: [...next.shows, show], showIndex: next.shows.length }, show, show.items);
    if (next.isGameOver) return next;
  }
  return endRound(next);
}

// Scores `items` for the show's owner
function count(state: GameState, show: Show, items: ScoreItem[]): GameState {
  const points = totalOf(items);
  const lastMove: LastMove = { type: 'count', playerNumber: show.owner, crib: show.crib, points, items: show.items };
  const gameStatus = `${whose(state, show)}: ${describeItems(show.items)}${show.claimed === null ? '' : `. ${state.playerNames[show.owner]} scores ${points}`}`;
  return addPoints({ ...state, lastMove, gameStatus }, sideOf(state, show.owner), items);
}

function awaitClaim(state: GameState): GameState {
  const show = nextShowOf(state);
  if (!show) return endRound(state);
  const counter = state.playerNames[show.owner];
  return {
    ...state,
    shows: [...state.shows, show],
    showIndex: state.shows.length,
    currentPlayer: show.owner,
    gameStatus: `${counter} counts ${show.crib ? 'the crib' : 'their hand'}`
  };
}

const ROUND: RoundAccess<GameState, RoundSummary> = {
  get: state => state.roundSummary,
  set: (state, roundSummary) => ({ ...state, roundSummary }),
  noun: 'hand'
};

function endRound(state: GameState): GameState {
  const counts = state.shows.map(({ owner, crib, items, total }) => ({ owner, crib, items, total }));
  const change = Object.fromEntries(Object.entries(state.scores).map(([side, score]) => [side, score - (state.handStartScores[Number(side)] ?? 0)]));
  const roundSummary: RoundSummary = { handNumber: state.handNumber, dealer: dealerOf(state), counts, change, acknowledged: [] };
  return { ...state, phase: 'roundOver', currentPlayer: null, roundSummary };
}

// Deals the next hand once every connected player has acknowledged the summary. The deal passes left.
function startNextHandIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;
  const dealer = nextActivePlayer(state, dealerOf(state)) ?? dealerOf(state);
  const handNumber = state.handNumber + 1;
  return { ...dealHand({ ...state, handNumber }, dealer, random), gameStatus: `Hand ${handNumber}: ${state.playerNames[dealer]} deals` };
}

// The owner's number opens the Muggins window
export function applyShowMove(state: GameState, seat: Seat, move: { type: 'claim'; points: number }, now: number): Result<GameState> {
  const show = openShow(state);
  if (!muggins(state)) return { error: 'The counts are made for you' };
  if (!show || show.claimed !== null || show.owner !== seat) return { error: 'It is not your count' };
  const opened = withShow(state, { ...show, claimed: move.points, closesAt: now + MUGGINS_MS });
  const name = state.playerNames[seat];
  return {
    state: {
      ...opened,
      currentPlayer: null,
      lastMove: { type: 'claim', playerNumber: seat, crib: show.crib, points: move.points },
      gameStatus: `${name} claims ${move.points} for ${show.crib ? 'the crib' : 'their hand'}: Muggins?`
    }
  };
}

// Points still missed: an overclaim misses nothing
const missed = (show: Show) =>
  show.total - Math.min(show.claimed ?? 0, show.total) - show.muggins.reduce((sum, press) => sum + Math.max(press.points, 0), 0);

function pressPoints(state: GameState, show: Show, cards: unknown): Result<{ points: number; taken: number[] }> {
  const left = missed(show);
  switch (houseRule(state, MUGGINS_STYLE_RULE)) {
    case 'name': {
      const selection = Array.isArray(cards) ? cards.map(parseCard) : [];
      if (!selection.length || selection.some(card => card === null)) return { error: 'Select the cards of a combination they missed' };
      const index = left > 0 ? matchCombination(show.items, selection as Card[], show.taken) : null;
      if (index === null) return { error: 'That is not a combination they missed' };
      return { state: { points: Math.min(show.items[index].points, left), taken: [...show.taken, index] } };
    }
    case 'single':
      return { state: { points: show.total > (show.claimed ?? 0) ? left : -MISSED_NOTHING_COST, taken: show.taken } };
    case 'shown':
      return { state: { points: left, taken: show.taken } };
  }
}

function press(state: GameState, seat: Seat, show: Show, cards: unknown): Result<GameState> {
  const result = pressPoints(state, show, cards);
  if ('error' in result) return result;
  const { points, taken } = result.state;
  const name = state.playerNames[seat];
  const outcome = points < 0 ? `but nothing was missed: it costs ${-points}` : `and takes ${points}`;
  const next: GameState = {
    ...withShow(state, { ...show, taken, muggins: [...show.muggins, { by: seat, points }] }),
    lastMove: { type: 'muggins', playerNumber: seat, points },
    gameStatus: `${name} presses Muggins! ${outcome}`
  };
  return { state: closeIfAnswered(next) };
}

function pass(state: GameState, seat: Seat, show: Show): GameState {
  const next: GameState = {
    ...withShow(state, { ...show, passed: [...show.passed, seat] }),
    lastMove: { type: 'noMuggins', playerNumber: seat },
    gameStatus: `${state.playerNames[seat]} says No Muggins`
  };
  return closeIfAnswered(next);
}

function closeIfAnswered(state: GameState): GameState {
  const show = openShow(state);
  return show && opponents(state, show).every(seat => answered(show, seat)) ? closeWindow(state) : state;
}

// A Single press penalty never takes a score below 0
function penalize(state: GameState, side: Side, points: number): GameState {
  const score = Math.max(0, state.scores[side] - points);
  return { ...state, scores: { ...state.scores, [side]: score }, pegs: { ...state.pegs, [side]: { front: score, back: Math.min(state.pegs[side].back, score) } } };
}

// The owner scores the claim (an overclaim corrected to the true total), then each press in turn, then the next count
function closeWindow(state: GameState): GameState {
  const show = openShow(state);
  if (!show || show.closesAt === null) return state;
  const closed: Show = { ...show, closesAt: null };
  const claimed = show.claimed ?? 0;
  const owned: ScoreItem[] = claimed >= show.total ? show.items : [{ kind: 'claim', cards: [], points: claimed }];
  let next = count(withShow(state, closed), closed, owned);
  for (const { by, points } of show.muggins) {
    if (next.isGameOver) return next;
    next = points < 0 ? penalize(next, sideOf(state, by), -points) : addPoints(next, sideOf(state, by), [{ kind: 'muggins', cards: [], points }]);
  }
  return next.isGameOver ? next : awaitClaim(next);
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  const input = asRecord(action);
  if (input?.type === 'acknowledgeRound') return acknowledge(state, seat, ROUND, next => startNextHandIfReady(next, random));
  if (input?.type !== 'muggins' && input?.type !== 'noMuggins') return { error: 'Unknown action' };
  const show = openShow(state);
  if (!show || show.closesAt === null) return { error: 'There is no count to answer' };
  if (sideOf(state, seat) === sideOf(state, show.owner)) return { error: seat === show.owner ? 'This is your own count' : "This is your partner's count" };
  if (answered(show, seat)) return { error: 'You have already answered this count' };
  return input.type === 'muggins' ? press(state, seat, show, input.cards) : { state: pass(state, seat, show) };
}

export function recordsAction(_state: GameState, _seat: Seat, action: unknown): boolean {
  const type = asRecord(action)?.type;
  return type === 'muggins' || type === 'noMuggins';
}

export const deadline = (state: GameState): number | null => (state.isGameOver ? null : openShow(state)?.closesAt ?? null);

export const onDeadline = (state: GameState): GameState => closeWindow(state);

// After an undo or a restart, an open window gets its full time again
export function resumeClock(state: GameState, now: number): GameState {
  const show = openShow(state);
  return show && deadline(state) !== null ? withShow(state, { ...show, closesAt: now + MUGGINS_MS }) : state;
}

// Until its owner claims, and during a window unless the style shows the total, a count's points stay hidden
export function publicShow(state: GameState, show: Show): PublicShow {
  const counted = show.claimed !== null && show.closesAt === null;
  if (!muggins(state) || counted || (show.closesAt !== null && houseRule(state, MUGGINS_STYLE_RULE) === 'shown')) return show;
  const { items: _items, total: _total, taken: _taken, ...hidden } = show;
  return hidden;
}

// The discards, the opponents still to answer a window, and the Continue
export function waitingOn(state: GameState): Seat[] {
  const show = openShow(state);
  const answering = show?.closesAt != null ? opponents(state, show).filter(seat => !answered(show, seat)) : [];
  return [...discardsAwaited(state), ...answering, ...awaiting(state, ROUND)];
}

// The next hand may have been waiting only for the player who disconnected
export const onPlayerDisconnected = (state: GameState, _seat: Seat, random: Random): GameState => startNextHandIfReady(state, random);
