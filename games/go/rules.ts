// Go rules shared by the browser and the server (validation)
import { applyEndingAction, endGame, endingRefusal, otherSeat } from '../../shared/drawOffer.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { boardKey, chainAt, emptyBoard, isOnBoard, playStone, pointName } from './board.ts';
import { BOARD_SIZE } from './options.ts';
import { areaScore, scoreLine } from './scoring.ts';
import type { Standing } from '../../shared/types.ts';
import type { BoardSize, GameState, Point, PublicGameState, Result, Seat, Stone } from './types.ts';

// Seat 1 plays black and moves first
export function colorOf(seat: Seat): Stone {
  return seat === 1 ? 'black' : 'white';
}

// A fresh board at `size` with nothing played, drawn or marked
function freshPlay(size: BoardSize) {
  return {
    size,
    board: emptyBoard(size),
    phase: 'play' as const,
    previousKey: null,
    passes: 0,
    captures: { black: 0, white: 0 },
    dead: [],
    agreed: [],
    lastMove: null,
    score: null,
    drawOffer: null
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...freshPlay(19) };
}

// Before the first move, after anyone joins or leaves: an empty board at the chosen size
export function resetLobby(state: GameState): GameState {
  return { ...state, ...freshPlay(houseRule(state, BOARD_SIZE)) };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const projected = state.phase === 'marking' && !state.isGameOver ? areaScore(state.board, state.dead) : null;
  return { ...state, undoAvailable, projected };
}

// A point from untrusted input, or null unless both coordinates are integers on the board
function asPoint(input: Record<string, unknown>, size: number): Point | null {
  const { row, col } = input;
  if (typeof row !== 'number' || typeof col !== 'number') return null;
  const point = { row, col };
  return isOnBoard(point, size) ? point : null;
}

function place(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const point = asPoint(input, state.size);
  if (!point) return { error: 'Invalid move' };
  if (state.phase === 'marking') return { error: 'Agree to the dead stones or resume play first' };
  const color = colorOf(seat);
  const played = playStone(state.board, point, color);
  if ('error' in played) return played;
  if (boardKey(played.board) === state.previousKey) return { error: 'Ko: play elsewhere before retaking' };
  const captured = played.captured.length;
  return {
    state: {
      ...state,
      board: played.board,
      previousKey: boardKey(state.board),
      passes: 0,
      captures: { ...state.captures, [color]: state.captures[color] + captured },
      lastMove: { type: 'place', playerNumber: seat, point, captured },
      gameStatus: `${state.playerNames[seat]} played ${pointName(point, state.size)}${captured > 0 ? ` and captured ${captured}` : ''}`,
      currentPlayer: nextActivePlayer(state, seat)
    }
  };
}

function pass(state: GameState, seat: Seat): Result<GameState> {
  if (state.phase === 'marking') return { error: 'Agree to the dead stones or resume play first' };
  const passes = state.passes + 1;
  const next: GameState = {
    ...state,
    previousKey: boardKey(state.board),
    passes,
    lastMove: { type: 'pass', playerNumber: seat },
    gameStatus: `${state.playerNames[seat]} passed`,
    currentPlayer: nextActivePlayer(state, seat)
  };
  if (passes < 2) return { state: next };
  return {
    state: { ...next, phase: 'marking', dead: [], agreed: [], gameStatus: 'Both passed. Click stones to mark them dead, then Agree' }
  };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type === 'place') return place(state, seat, input);
  if (input?.type === 'pass') return pass(state, seat);
  return { error: 'Invalid move' };
}

const NOT_MARKING = 'Stones are marked only after both players pass';

// Toggles the whole chain at the point in the dead list, and clears every agreement
function mark(state: GameState, input: Record<string, unknown>): Result<GameState> {
  const point = asPoint(input, state.size);
  if (!point) return { error: 'Invalid move' };
  if (!state.board[point.row][point.col]) return { error: 'There is no stone there' };
  const chain = chainAt(state.board, point);
  const isDead = (p: Point) => state.dead.some(d => d.row === p.row && d.col === p.col);
  const dead = isDead(point) ? state.dead.filter(d => !chain.some(c => c.row === d.row && c.col === d.col)) : [...state.dead, ...chain.filter(p => !isDead(p))];
  return { state: { ...state, dead, agreed: [], gameStatus: 'Dead stones changed. Both players must agree again' } };
}

// The count happens when the second seat agrees: dead stones leave the board and the higher total wins
function agree(state: GameState, seat: Seat): Result<GameState> {
  if (state.agreed.includes(seat)) return { error: 'You have already agreed' };
  const agreed = [...state.agreed, seat];
  if (agreed.length < state.activePlayers.length) {
    return { state: { ...state, agreed, gameStatus: `${state.playerNames[seat]} agreed. Waiting for ${state.playerNames[otherSeat(state, seat)]}` } };
  }
  const score = areaScore(state.board, state.dead);
  const board = state.board.map(row => [...row]);
  for (const { row, col } of state.dead) board[row][col] = null;
  const winner: Seat = score.black.total > score.white.total ? 1 : 2;
  const margin = Math.abs(score.black.total - score.white.total);
  const status = `${state.playerNames[winner]} wins by ${margin} (${scoreLine(score)})`;
  return {
    state: {
      ...endGame(state, [winner], status),
      board, dead: [], agreed, score,
      lastMove: { type: 'score', playerNumber: seat, score }
    }
  };
}

function resume(state: GameState, seat: Seat): Result<GameState> {
  const next = state.currentPlayer;
  return {
    state: {
      ...state,
      phase: 'play', passes: 0, dead: [], agreed: [],
      gameStatus: `${state.playerNames[seat]} resumed play. ${next ? state.playerNames[next] : 'Nobody'} to move`
    }
  };
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  const type = input?.type;
  if (type === 'offerDraw' || type === 'answerDraw') return { error: 'Go has no draw offers' };
  if (type !== 'mark' && type !== 'agree' && type !== 'resume') return applyEndingAction(state, seat, action);
  const refusal = endingRefusal(state);
  if (refusal) return { error: refusal };
  if (state.phase !== 'marking') return { error: NOT_MARKING };
  if (type === 'mark') return mark(state, input ?? {});
  return type === 'agree' ? agree(state, seat) : resume(state, seat);
}

// Only the agreement that ends the game is a move for undo; marks, the first agreement and resuming are not
export function recordsAction(state: GameState, seat: Seat, action: unknown): boolean {
  return state.phase === 'marking' && asRecord(action)?.type === 'agree' && !state.agreed.includes(seat) && state.agreed.some(other => other !== seat);
}

export function waitingOn(state: GameState): Seat[] {
  return state.phase === 'marking' && !state.isGameOver ? state.activePlayers.filter(seat => !state.agreed.includes(seat)) : [];
}

export function finalStandings(state: GameState): Standing[] {
  const winner = state.winners[0];
  const loser = state.activePlayers.find(seat => seat !== winner) as Seat;
  const points = (seat: Seat) => (state.score ? { score: `${seat === 1 ? state.score.black.total : state.score.white.total} points` } : {});
  return [winner, loser].map((seat, index) => ({ seat, place: index + 1, ...points(seat) }));
}
