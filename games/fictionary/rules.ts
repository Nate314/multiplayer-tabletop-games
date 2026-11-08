// Fictionary: everyone writes a fake definition of a rare word, then votes for the real one among the fakes
import { houseRule, minimumToStart } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, awaiting, everyoneReady, type RoundAccess } from '../../shared/rounds.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { pointsText, rankStandings } from '../../shared/standings.ts';
import type { Random, Result, Seat, Standing } from '../../shared/types.ts';
import { phaseDeadline } from './clock.ts';
import { fictionaryInfo } from './info.ts';
import { matchesDefinition, sameText } from './matching.ts';
import { WORD_COUNT } from './options.ts';
import type { Choice, GameState, Reveal } from './types.ts';
import { WORDS } from './words.ts';

const MAX_DEFINITION = 150;
const ACTIONS = ['write', 'vote', 'continue'];

const ROUND: RoundAccess<GameState, Reveal> = {
  get: state => state.reveal,
  set: (state, reveal) => ({ ...state, reveal }),
  noun: 'word'
};

const fresh = {
  submissions: {}, matched: [], choices: [], votes: {}, roundPoints: {}, reveal: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId), ...fresh,
    phase: 'writing', deck: [], round: 1, word: '', definition: '', phaseStartedAt: null, scores: {}, lastMove: null
  };
}

// A fresh deck, everyone at zero, and round 1 waiting for the house rules to be agreed
export function resetLobby(state: GameState, random: Random): GameState {
  const deck = shuffle(WORDS, random).slice(0, houseRule(state, WORD_COUNT));
  return {
    ...state, ...fresh, ...deck[0],
    phase: 'writing', deck, round: 1, phaseStartedAt: null, currentPlayer: null,
    scores: Object.fromEntries(state.activePlayers.map(seat => [seat, 0])), lastMove: null
  };
}

export function applyMove(): Result<GameState> {
  return { error: 'Fictionary has no turns' };
}

export function voters(state: GameState): Seat[] {
  return state.activePlayers.filter(seat => !state.matched.includes(seat));
}

const names = (state: GameState, seats: Seat[]) => seats.map(seat => state.playerNames[seat]).join(' and ');
const allWritten = (state: GameState) => state.activePlayers.every(seat => state.submissions[seat] !== undefined);
const allVoted = (state: GameState) => voters(state).every(seat => state.votes[seat] !== undefined);

function topScorers(state: GameState): { winners: Seat[]; text: string } {
  const top = Math.max(...state.activePlayers.map(seat => state.scores[seat] ?? 0));
  const winners = state.activePlayers.filter(seat => (state.scores[seat] ?? 0) === top);
  return { winners, text: `${names(state, winners)} won with ${pointsText(top)}` };
}

function revealRound(state: GameState): GameState {
  const roundPoints: Record<Seat, number> = Object.fromEntries(state.activePlayers.map(seat => [seat, 0]));
  const give = (seat: Seat, points: number) => { if (seat in roundPoints) roundPoints[seat] += points; };
  state.matched.forEach(seat => give(seat, 3));
  for (const [seat, index] of Object.entries(state.votes)) {
    const choice = state.choices[index as number];
    if (choice.real) give(Number(seat), 2);
    else choice.authors.forEach(author => give(author, 1));
  }
  const scores = { ...state.scores };
  for (const [seat, points] of Object.entries(roundPoints)) scores[Number(seat)] = (scores[Number(seat)] ?? 0) + points;
  const revealed: GameState = {
    ...state, phase: 'reveal', roundPoints, scores, reveal: { acknowledged: [] },
    lastMove: { type: 'reveal', word: state.word, definition: state.definition },
    gameStatus: `The real definition of ${state.word}: ${state.definition}`
  };
  if (state.round < state.deck.length) return revealed;
  const { winners, text } = topScorers(revealed);
  return { ...revealed, isGameOver: true, currentPlayer: null, winners, reveal: null, gameStatus: text };
}

function closeWriting(state: GameState, now: number, random: Random): GameState {
  const reason = allWritten(state) ? 'allWritten' : 'timeUp';
  const matched = state.activePlayers.filter(seat => matchesDefinition(state.submissions[seat] ?? '', state.definition));
  const fakes: Choice[] = [];
  for (const seat of state.activePlayers) {
    const text = state.submissions[seat];
    if (text === undefined || matched.includes(seat)) continue;
    const same = fakes.find(choice => sameText(choice.text, text));
    if (same) same.authors.push(seat);
    else fakes.push({ text, authors: [seat], real: false });
  }
  const choices = shuffle([...fakes, { text: state.definition, authors: [], real: true }], random);
  const closed: GameState = { ...state, matched, choices, lastMove: { type: 'closeWriting', reason } };
  // One choice would hand out free points, so the reveal follows at once
  if (fakes.length === 0 || voters(closed).length === 0) return revealRound(closed);
  const knew = matched.length ? ` (${names(state, matched)} wrote the real one)` : '';
  return { ...closed, phase: 'voting', phaseStartedAt: now, gameStatus: `Vote for the real definition${knew}` };
}

function nextWord(state: GameState, now: number): GameState {
  const round = state.round + 1;
  const entry = state.deck[round - 1];
  return {
    ...state, ...fresh, ...entry, round, phase: 'writing', phaseStartedAt: now,
    lastMove: { type: 'nextWord', round }, gameStatus: `Write a definition of ${entry.word}`
  };
}

function writeAction(state: GameState, seat: Seat, text: unknown, now: number, random: Random): Result<GameState> {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed.length < 1 || trimmed.length > MAX_DEFINITION) return { error: `Definitions are 1 to ${MAX_DEFINITION} characters` };
  if (state.phase !== 'writing') return { error: 'Writing is over' };
  const next: GameState = {
    ...state, submissions: { ...state.submissions, [seat]: trimmed },
    lastMove: { type: 'write', playerNumber: seat }, gameStatus: `${state.playerNames[seat]} wrote a definition`
  };
  return { state: allWritten(next) ? closeWriting(next, now, random) : next };
}

function voteAction(state: GameState, seat: Seat, choice: unknown): Result<GameState> {
  if (state.phase !== 'voting') return { error: 'Voting is over' };
  if (state.matched.includes(seat)) return { error: 'You already know the real definition' };
  if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 0 || choice >= state.choices.length) return { error: 'Invalid choice' };
  if (state.choices[choice].authors.includes(seat)) return { error: 'You cannot vote for your own definition' };
  const next: GameState = {
    ...state, votes: { ...state.votes, [seat]: choice },
    lastMove: { type: 'vote', playerNumber: seat }, gameStatus: `${state.playerNames[seat]} voted`
  };
  return { state: allVoted(next) ? revealRound(next) : next };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random, now: number): Result<GameState> {
  const input = asRecord(action);
  if (typeof input?.type !== 'string' || !ACTIONS.includes(input.type)) return { error: 'Invalid action' };
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.phaseStartedAt === null) return { error: 'Wait for everyone to agree to the house rules' };
  if (!state.activePlayers.includes(seat)) return { error: 'You are not playing' };
  if (input.type === 'write') return writeAction(state, seat, input.text, now, random);
  if (input.type === 'vote') return voteAction(state, seat, input.choice);
  return acknowledge(state, seat, ROUND, next => nextWord(next, now));
}

// An invalid action is refused by applyAction, so it is never recorded
export function recordsAction(state: GameState, _seat: Seat, action: unknown): boolean {
  const type = asRecord(action)?.type;
  return typeof type === 'string' && ACTIONS.includes(type) && state.phaseStartedAt !== null && !state.isGameOver;
}

// No turn move to undo, and undoing a reveal would hand voters the answer
export const allowsUndoVote = (): boolean => false;

// A phase that a leave or a disconnect completed falls due at once (0), since those hooks get no `now`, and onDeadline
// closes it on the server clock
export function deadline(state: GameState): number | null {
  if (state.isGameOver || state.phaseStartedAt === null) return null;
  if (state.phase === 'reveal') return everyoneReady(state, ROUND) ? 0 : null;
  if ((state.phase === 'writing' && allWritten(state)) || (state.phase === 'voting' && allVoted(state))) return 0;
  return phaseDeadline(state);
}

export function onDeadline(state: GameState, now: number, random: Random): GameState {
  if (state.phase === 'writing') return closeWriting(state, now, random);
  if (state.phase === 'voting') return revealRound(state);
  return everyoneReady(state, ROUND) ? nextWord(state, now) : state;
}

// The clock starts on the last agreement once the table is full enough, and restarts after a restart or a pause
export function resumeClock(state: GameState, now: number): GameState {
  if (state.isGameOver || (!state.started && state.activePlayers.length < minimumToStart(fictionaryInfo))) return state;
  return { ...state, phaseStartedAt: now };
}

// A dismissal: below 3 players the game ends with the scores as they stand; otherwise the leaver's submission and vote
// go (a choice they wrote stays), and deadline makes any phase this completes due at once
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  if (state.activePlayers.length < fictionaryInfo.minPlayers) {
    const { winners, text } = topScorers(state);
    return { ...state, isGameOver: true, currentPlayer: null, winners, reveal: null, gameStatus: `Not enough players left: ${text}` };
  }
  const { [seat]: _submission, ...submissions } = state.submissions;
  const { [seat]: _vote, ...votes } = state.votes;
  return { ...state, submissions, votes };
}

export function waitingOn(state: GameState): Seat[] {
  if (state.isGameOver || state.phaseStartedAt === null) return [];
  if (state.phase === 'writing') return state.activePlayers.filter(seat => state.submissions[seat] === undefined);
  if (state.phase === 'voting') return voters(state).filter(seat => state.votes[seat] === undefined);
  return awaiting(state, ROUND);
}

export function finalStandings(state: GameState): Standing[] {
  return rankStandings(state, (a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0), seat => pointsText(state.scores[seat] ?? 0));
}
