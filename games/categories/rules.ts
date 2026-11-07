import { everyoneAgreed, houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, awaiting, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { seatFields } from '../../shared/spectators.ts';
import type { Random, Result, Seat, Standing } from '../../shared/types.ts';
import { phaseDeadline } from './clock.ts';
import { categoriesInfo } from './info.ts';
import { HARD_LETTERS, LIST_SIZE, ROUNDS, lettersFor } from './options.ts';
import { POOL } from './pool.ts';
import { roundPoints, verdicts } from './scoring.ts';
import type { Challenge, GameState, PublicGameState, Review } from './types.ts';

const MAX_ANSWER = 40;

const ROUND: RoundAccess<GameState, Review> = {
  get: state => state.review,
  set: (state, review) => ({ ...state, review }),
  noun: 'round'
};

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    phase: 'answering',
    round: 1,
    letter: '',
    list: [],
    letters: [],
    pool: [],
    phaseStartedAt: null,
    answers: {},
    done: [],
    challenges: [],
    review: null,
    scores: {},
    lastMove: null
  };
}

// Each round takes its letter and list off the decks, so none repeats in a game
function deal(state: GameState): Pick<GameState, 'letter' | 'letters' | 'list' | 'pool'> {
  const size = houseRule(state, LIST_SIZE);
  return { letter: state.letters[0], letters: state.letters.slice(1), list: state.pool.slice(0, size), pool: state.pool.slice(size) };
}

export function resetLobby(state: GameState, random: Random): GameState {
  const dealt = deal({
    ...state,
    letters: shuffle(lettersFor(houseRule(state, HARD_LETTERS)), random),
    pool: shuffle([...POOL], random)
  });
  return {
    ...state,
    ...dealt,
    phase: 'answering',
    round: 1,
    phaseStartedAt: null,
    currentPlayer: null,
    answers: {},
    done: [],
    challenges: [],
    review: null,
    scores: Object.fromEntries(state.activePlayers.map(seat => [seat, 0])),
    lastMove: null
  };
}

export const votersOf = (state: Pick<GameState, 'activePlayers'>, author: Seat): Seat[] => state.activePlayers.filter(seat => seat !== author);

const verdictsOf = (state: GameState) => verdicts(state.answers, state.activePlayers, state.letter, state.challenges);

const owes = (state: GameState, seat: Seat): boolean =>
  state.challenges.some(c => c.verdict === 'open' && c.seat !== seat && c.votes[seat] === undefined);

// Resolves each open challenge whose voters have all voted; more than half of the voters must reject
function settle(state: GameState): GameState {
  let next = state;
  for (const c of state.challenges) {
    if (c.verdict !== 'open') continue;
    const voters = votersOf(state, c.seat);
    if (!voters.every(seat => c.votes[seat] !== undefined)) continue;
    const rejected = voters.filter(seat => c.votes[seat]).length * 2 > voters.length;
    next = {
      ...next,
      challenges: next.challenges.map(o => o === c ? { ...c, verdict: rejected ? 'rejected' : 'kept' } : o),
      lastMove: { type: 'verdict', category: c.category, seat: c.seat, rejected },
      gameStatus: `${state.playerNames[c.seat]}'s answer for ${state.list[c.category]} was ${rejected ? 'rejected' : 'kept'}`
    };
  }
  return next;
}

// A seat with no answers entry gets blanks, so every review row is full
function closeAnswers(state: GameState, reason: 'allDone' | 'timeUp'): GameState {
  const blank = Array.from({ length: state.list.length }, () => '');
  const answers = { ...state.answers };
  for (const seat of state.activePlayers) answers[seat] ??= blank;
  return { ...state, answers, phase: 'review', review: { acknowledged: [] }, lastMove: { type: 'closeAnswers', reason }, gameStatus: 'Review the answers' };
}

const allDone = (state: GameState) => state.activePlayers.length > 0 && state.activePlayers.every(seat => state.done.includes(seat));

function endGame(state: GameState): GameState {
  const top = Math.max(...state.activePlayers.map(seat => state.scores[seat] ?? 0));
  const winners = state.activePlayers.filter(seat => (state.scores[seat] ?? 0) === top);
  const names = winners.map(seat => state.playerNames[seat]).join(' and ');
  return { ...state, isGameOver: true, currentPlayer: null, winners, review: null, gameStatus: `${names} won with ${pointsText(top)}` };
}

// Everyone is ready: the round's points are added, then the game ends or the next round deals
function nextRound(state: GameState, now: number): GameState {
  const points = roundPoints(verdictsOf(state));
  const scores = { ...state.scores };
  for (const seat of state.activePlayers) scores[seat] = (scores[seat] ?? 0) + (points[seat] ?? 0);
  const scored = { ...state, scores };
  if (state.round >= houseRule(state, ROUNDS)) return endGame(scored);
  const dealt = deal(scored);
  return {
    ...scored,
    ...dealt,
    round: state.round + 1,
    phase: 'answering',
    phaseStartedAt: now,
    answers: {},
    done: [],
    challenges: [],
    review: null,
    lastMove: { type: 'nextRound', round: state.round + 1, letter: dealt.letter },
    gameStatus: `Round ${state.round + 1}, the letter is ${dealt.letter}`
  };
}

export function applyMove(): Result<GameState> {
  return { error: 'Categories has no turns' };
}

function answersOf(state: GameState, value: unknown): string[] | { error: string } {
  if (!Array.isArray(value) || value.length !== state.list.length || !value.every(a => typeof a === 'string')) {
    return { error: 'Send one answer per category' };
  }
  const answers = value.map((a: string) => a.trim());
  return answers.some(a => a.length > MAX_ANSWER) ? { error: `Answers are up to ${MAX_ANSWER} characters` } : answers;
}

function answerAction(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  if (state.phase !== 'answering') return { error: 'Answering is over' };
  if (!state.activePlayers.includes(seat)) return { error: 'You are not playing' };
  if (state.done.includes(seat)) return { error: 'You are done for this round' };
  const answers = answersOf(state, input.answers);
  if ('error' in answers) return answers;
  const stored = { ...state, answers: { ...state.answers, [seat]: answers } };
  if (input.type === 'answers') {
    return { state: state.started ? stored : { ...stored, lastMove: { type: 'answers', playerNumber: seat } } };
  }
  const done: GameState = {
    ...stored,
    done: [...state.done, seat],
    lastMove: { type: 'done', playerNumber: seat },
    gameStatus: `${state.playerNames[seat]} is done`
  };
  return { state: allDone(done) ? closeAnswers(done, 'allDone') : done };
}

function challengeAction(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const { category, seat: author } = input;
  if (state.phase !== 'review') return { error: 'Answers can be challenged in review' };
  if (!state.activePlayers.includes(seat)) return { error: 'You are not playing' };
  if (typeof category !== 'number' || !Number.isInteger(category) || category < 0 || category >= state.list.length
    || typeof author !== 'number' || !state.activePlayers.includes(author)) return { error: 'Invalid challenge' };
  if (author === seat) return { error: 'You cannot challenge your own answer' };
  if (verdictsOf(state)[author]?.[category] !== 'valid') return { error: 'Only a scoring answer can be challenged' };
  if (state.challenges.some(c => c.category === category && c.seat === author)) return { error: 'That answer was already challenged' };
  const challenge: Challenge = { category, seat: author, by: seat, votes: { [seat]: true }, verdict: 'open' };
  return {
    state: settle({
      ...state,
      challenges: [...state.challenges, challenge],
      review: { acknowledged: [] },
      lastMove: { type: 'challenge', playerNumber: seat, category, seat: author },
      gameStatus: `${state.playerNames[seat]} challenged ${state.playerNames[author]}'s answer for ${state.list[category]}`
    })
  };
}

function judgeAction(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const { category, seat: author, reject } = input;
  if (state.phase !== 'review') return { error: 'Answers are judged in review' };
  if (typeof author !== 'number' || typeof category !== 'number' || typeof reject !== 'boolean') return { error: 'Invalid vote' };
  if (!votersOf(state, author).includes(seat)) return { error: 'You do not vote on your own answer' };
  const challenge = state.challenges.find(c => c.category === category && c.seat === author && c.verdict === 'open');
  if (!challenge) return { error: 'No open challenge on that answer' };
  if (challenge.votes[seat] !== undefined) return { error: 'You already voted' };
  const voted = { ...challenge, votes: { ...challenge.votes, [seat]: reject } };
  return {
    state: settle({
      ...state,
      challenges: state.challenges.map(c => c === challenge ? voted : c),
      lastMove: { type: 'judge', playerNumber: seat, category, seat: author },
      gameStatus: `${state.playerNames[seat]} voted on ${state.playerNames[author]}'s answer for ${state.list[category]}`
    })
  };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, _random: Random, now: number): Result<GameState> {
  const input = asRecord(action);
  if (state.phaseStartedAt === null) return { error: 'Wait for everyone to agree to the house rules' };
  if (state.isGameOver) return { error: 'The game is over' };
  switch (input?.type) {
    case 'answers': case 'done': return answerAction(state, seat, input);
    case 'challenge': return challengeAction(state, seat, input);
    case 'judge': return judgeAction(state, seat, input);
    case 'continue':
      if (state.phase !== 'review') return { error: 'Nothing to continue' };
      if (!state.activePlayers.includes(seat)) return { error: 'You are not playing' };
      if (owes(state, seat)) return { error: 'Vote on the open challenges first' };
      return acknowledge(state, seat, ROUND, s => nextRound(s, now));
    default: return { error: 'Invalid action' };
  }
}

export function recordsAction(state: GameState, _seat: Seat, action: unknown): boolean {
  const type = asRecord(action)?.type;
  if (type === 'answers') return !state.started;
  return ['done', 'challenge', 'judge', 'continue'].includes(type as string) && state.phaseStartedAt !== null && !state.isGameOver;
}

export const allowsUndoVote = (): false => false;

export const deadline = (state: GameState): number | null => phaseDeadline(state);

export function onDeadline(state: GameState): GameState {
  return state.phase === 'answering' ? closeAnswers(state, 'timeUp') : state;
}

// The clock starts on the last agreement and restarts after a server restart
export function resumeClock(state: GameState, now: number): GameState {
  if (state.isGameOver || state.phase !== 'answering' || !(state.started || everyoneAgreed(categoriesInfo, state))) return state;
  return { ...state, phaseStartedAt: now };
}

// shortcut: hooks get no `now` and no turn moves to trigger resumeClock, so a round dealt here is stamped with Date.now(); pass the server clock if the platform ever hands one to these hooks
function recheck(state: GameState): GameState {
  return everyoneReady(state, ROUND) ? nextRound(state, Date.now()) : state;
}

export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const { [seat]: _gone, ...answers } = state.answers;
  const challenges = state.challenges
    .filter(c => c.seat !== seat)
    .map(c => ({ ...c, votes: Object.fromEntries(Object.entries(c.votes).filter(([s]) => Number(s) !== seat)) }));
  const dropped: GameState = {
    ...state, answers, challenges, done: state.done.filter(s => s !== seat),
    review: state.review && { acknowledged: state.review.acknowledged.filter(s => s !== seat) }
  };
  if (dropped.phase === 'answering') return allDone(dropped) ? closeAnswers(dropped, 'allDone') : dropped;
  return recheck(settle(dropped));
}

export const onPlayerDisconnected = (state: GameState): GameState => recheck(state);

export function waitingOn(state: GameState): Seat[] {
  if (state.isGameOver || state.phaseStartedAt === null) return [];
  if (state.phase === 'answering') return state.activePlayers.filter(seat => !state.done.includes(seat));
  const waiting = new Set([...state.activePlayers.filter(seat => owes(state, seat)), ...awaiting(state, ROUND)]);
  return [...waiting].sort((a, b) => a - b);
}

export function finalStandings(state: GameState): Standing[] {
  const score = (seat: Seat) => state.scores[seat] ?? 0;
  return rankStandings(state, (a, b) => score(b) - score(a), seat => pointsText(score(seat)));
}

// Answers stay hidden until the review: while answering a seat gets only its own, and `null` (History, a table screen) none
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { letters: _letters, pool: _pool, answers, ...rest } = state;
  const open = state.phase === 'review' || state.isGameOver;
  const checked = open ? verdictsOf(state) : {};
  return {
    ...rest,
    undoAvailable,
    answers: open ? answers : viewer !== null && answers[viewer] ? { [viewer]: answers[viewer] } : {},
    verdicts: checked,
    roundPoints: open ? roundPoints(checked) : {}
  };
}

export const privateSeatView = (state: GameState, seat: Seat): Pick<PublicGameState, 'answers'> =>
  seatFields(toPublicState(state, false, seat), ['answers']);
