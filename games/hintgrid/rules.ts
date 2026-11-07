// Hint Grid rules: two teams, one clue-giver each, 25 words and a hidden key
import { normalize } from '../../shared/guess.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { rankStandings } from '../../shared/standings.ts';
import type { Random, Result, Seat, Standing } from '../../shared/types.ts';
import { TEAM_NAMES, clueGiverOf, dealKey, evenOut, guessersOf, otherTeam, teamsReady } from './teams.ts';
import type { GameState, Team } from './types.ts';
import { WORDS } from './words.ts';

const TEAMS: Team[] = ['red', 'blue'];

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    roles: {},
    words: [],
    key: [],
    revealed: [],
    startingTeam: 'red',
    turn: 'red',
    phase: 'clue',
    clue: null,
    guessesLeft: 0,
    guessesThisTurn: 0,
    clues: [],
    lastMove: null
  };
}

export const wordsLeft = (state: GameState, team: Team): number =>
  state.key.filter((kind, i) => kind === team && !state.revealed[i]).length;

// The clue-giver of `turn` while a clue is due, else its lowest guesser; nobody until the teams are set
export function turnHolder(state: GameState): Seat | null {
  if (!teamsReady(state.roles, state.activePlayers)) return null;
  if (state.phase === 'clue') return clueGiverOf(state.roles, state.turn);
  return guessersOf(state.roles, state.turn, state.activePlayers)[0] ?? null;
}

const seatsOf = (state: GameState, team: Team): Seat[] => state.activePlayers.filter(seat => state.roles[seat]?.team === team);

// Before the start: a fresh grid and key, keeping the roles of the seats still seated
export function resetLobby(state: GameState, random: Random): GameState {
  const roles = Object.fromEntries(Object.entries(state.roles).filter(([seat]) => state.activePlayers.includes(Number(seat))));
  const { startingTeam, key } = dealKey(random);
  const fresh: GameState = {
    ...state, roles, words: shuffle(WORDS, random).slice(0, 25), key, revealed: Array<boolean>(25).fill(false),
    startingTeam, turn: startingTeam, phase: 'clue', clue: null, guessesLeft: 0, guessesThisTurn: 0, clues: [], lastMove: null
  };
  return { ...fresh, currentPlayer: turnHolder(fresh) };
}

function lobbyState(state: GameState, roles: GameState['roles']): GameState {
  const next = { ...state, roles };
  const holder = turnHolder(next);
  return {
    ...next, currentPlayer: holder,
    gameStatus: holder === null
      ? 'Pick teams: each team needs a clue-giver and a guesser'
      : `${TEAM_NAMES[state.startingTeam]} starts: ${state.playerNames[holder]} gives the first clue`
  };
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const a = asRecord(action);
  if (state.started || state.isGameOver) return { error: 'Teams are set once the game starts' };
  if (!state.activePlayers.includes(seat)) return { error: 'Invalid move' };
  if (a?.type === 'evenOut') return { state: lobbyState(state, evenOut(state.roles, state.activePlayers)) };
  if (a?.type !== 'pickRole' || !TEAMS.includes(a.team as Team) || typeof a.clueGiver !== 'boolean') return { error: 'Invalid move' };
  const team = a.team as Team;
  const holder = clueGiverOf(state.roles, team);
  if (a.clueGiver && holder !== null && holder !== seat) return { error: `${TEAM_NAMES[team]} already has a clue-giver` };
  return { state: lobbyState(state, { ...state.roles, [seat]: { team, clueGiver: a.clueGiver } }) };
}

export function allowsOutOfTurn(state: GameState, seat: Seat, move: unknown): boolean {
  const type = asRecord(move)?.type;
  return state.phase === 'guessing' && (type === 'guess' || type === 'endGuessing')
    && guessersOf(state.roles, state.turn, state.activePlayers).includes(seat);
}

const over = (winners: Seat[], gameStatus: string): Partial<GameState> => ({ isGameOver: true, currentPlayer: null, winners, gameStatus });

function endTurn(state: GameState): GameState {
  const next: GameState = { ...state, turn: otherTeam(state.turn), phase: 'clue', clue: null, guessesLeft: 0 };
  return { ...next, currentPlayer: turnHolder(next), gameStatus: `${TEAM_NAMES[next.turn]}'s clue-giver is thinking` };
}

function giveClue(state: GameState, seat: Seat, m: Record<string, unknown>): Result<GameState> {
  if (state.phase !== 'clue') return { error: 'Invalid move' };
  const word = typeof m.word === 'string' ? m.word.trim() : '';
  if (word.length < 1 || word.length > 30 || !/^[a-z]+(-[a-z]+)*$/i.test(word)) return { error: 'Give one word' };
  const count = m.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 9) return { error: 'The number is 1 to 9' };
  if (state.words.some(w => normalize(w) === normalize(word))) return { error: 'Your clue is a word on the grid' };
  const clue = { team: state.turn, word, count };
  const next: GameState = {
    ...state, clue, clues: [...state.clues, clue], guessesLeft: count + 1, guessesThisTurn: 0, phase: 'guessing',
    lastMove: { type: 'clue', playerNumber: seat, clue }
  };
  return { state: { ...next, currentPlayer: turnHolder(next), gameStatus: `${TEAM_NAMES[state.turn]}'s clue: ${word} ${count}` } };
}

function guess(state: GameState, seat: Seat, m: Record<string, unknown>): Result<GameState> {
  const index = m.index;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 24) return { error: 'Invalid card' };
  if (state.revealed[index]) return { error: 'That word is already turned over' };
  const kind = state.key[index];
  const team = state.turn;
  const moved: GameState = {
    ...state, revealed: state.revealed.map((r, i) => r || i === index), guessesThisTurn: state.guessesThisTurn + 1,
    lastMove: { type: 'guess', playerNumber: seat, index, kind }
  };
  if (kind === 'trap') {
    const other = otherTeam(team);
    return { state: { ...moved, ...over(seatsOf(state, other), `${TEAM_NAMES[team]} turned over the trap. ${TEAM_NAMES[other]} wins!`) } };
  }
  const done = TEAMS.find(t => wordsLeft(moved, t) === 0);
  if (done) return { state: { ...moved, ...over(seatsOf(state, done), `${TEAM_NAMES[done]} found all its words!`) } };
  if (kind !== team) return { state: endTurn(moved) };
  const guessesLeft = state.guessesLeft - 1;
  return { state: guessesLeft === 0 ? endTurn({ ...moved, guessesLeft }) : { ...moved, guessesLeft } };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const m = asRecord(move);
  if (!m || state.isGameOver) return { error: 'Invalid move' };
  if (m.type === 'clue') return giveClue(state, seat, m);
  if (state.phase !== 'guessing') return { error: 'Invalid move' };
  if (m.type === 'guess') return guess(state, seat, m);
  if (m.type !== 'endGuessing') return { error: 'Invalid move' };
  if (state.guessesThisTurn === 0) return { error: 'Make at least one guess first' };
  return { state: endTurn({ ...state, lastMove: { type: 'endGuessing', playerNumber: seat } }) };
}

// A dismissal: the leaver's role goes, and a team without a clue-giver or a guesser ends the game
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const roles = { ...state.roles };
  delete roles[seat];
  const next = { ...state, roles };
  if (teamsReady(roles, state.activePlayers)) return { ...next, currentPlayer: turnHolder(next) };
  const [red, blue] = TEAMS.map(t => wordsLeft(state, t));
  if (red === blue) return { ...next, ...over([], 'Not enough players left: a draw') };
  const winner: Team = red < blue ? 'red' : 'blue';
  return { ...next, ...over(seatsOf(next, winner), `Not enough players left: ${TEAM_NAMES[winner]} wins`) };
}

export function finalStandings(state: GameState): Standing[] {
  return rankStandings(state, () => 0, seat => `${TEAM_NAMES[state.roles[seat]?.team ?? 'red']} team`);
}
