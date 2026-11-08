// The 1860 Checkered board's rules: teetotum spins, moves among the light squares, sends, points and the goal
import { pointsText, rankStandings } from '../../shared/standings.ts';
import type { Standing } from '../../shared/types.ts';
import { GOAL_POINTS, INFANCY, SQUARES, WIN_POINTS, cellOf, legalMoves } from './checkered.ts';
import type { Cell, CheckeredState, GameState, Move, Random, Result, Seat } from './types.ts';

export const teetotum = (random: Random): number => Math.floor(random() * 6) + 1;

const keyOf = (cell: Cell): string => `${cell.row},${cell.col}`;

export function startCheckered(state: GameState): GameState {
  const pieces = Object.fromEntries(state.activePlayers.map(seat => [seat, INFANCY]));
  const points = Object.fromEntries(state.activePlayers.map(seat => [seat, 0]));
  return { ...state, board: 'checkered', road: null, checkered: { pieces, points, skipNext: [], phase: 'spin', options: [] }, spin: null, lastMove: null };
}

const startTurn = (state: GameState, seat: Seat): GameState =>
  ({ ...state, currentPlayer: seat, checkered: { ...state.checkered!, phase: 'spin', options: [] } });

const nextSeat = (state: GameState, seat: Seat): Seat => state.activePlayers.find(s => s > seat) ?? state.activePlayers[0];

// One move in progress: the board changes in place and every event is noted in order
type Turn = { seat: Seat; board: CheckeredState; events: string[]; status?: string; won: boolean };

// Moves the piece to `cell` and applies the square; a send or Speculation moves on once, never twice
function arrive(turn: Turn, cell: Cell, random: Random, sends: boolean): void {
  const square = SQUARES[keyOf(cell)];
  const { seat, board } = turn;
  const points = board.points[seat] + (square.points ?? 0);
  board.pieces = { ...board.pieces, [seat]: cell };
  board.points = { ...board.points, [seat]: points };
  turn.events.push(`${sends ? 'landed on' : 'went on to'} ${square.name}`);
  if (square.loseTurn) {
    board.skipNext = [...board.skipNext, seat];
    turn.events.push('will lose the next turn');
  }
  if (square.despair) {
    board.pieces = { ...board.pieces, [seat]: INFANCY };
    board.points = { ...board.points, [seat]: 0 };
    turn.events.push('went back to Infancy and lost every point');
  }
  if (square.goal) {
    const total = points + GOAL_POINTS;
    turn.won = total >= WIN_POINTS;
    if (turn.won) board.points = { ...board.points, [seat]: total };
    turn.status = turn.won ? `reached Happy Old Age with ${total} points` : `reached Happy Old Age short of ${WIN_POINTS} points`;
  }
  if (!sends) return;
  if (square.speculation) {
    const spun = teetotum(random);
    turn.events.push(`spun ${spun} on Speculation`);
    arrive(turn, cellOf(spun === 3 || spun === 6 ? 'Wealth' : 'Ruin'), random, false);
  } else if (square.sendTo) arrive(turn, cellOf(square.sendTo), random, false);
}

// The move's board and line, then the next turn unless a choice is waiting or the game is won
function finish(state: GameState, turn: Turn, move: Move, spun?: number): GameState {
  const name = state.playerNames[turn.seat];
  const next: GameState = {
    ...state, checkered: turn.board, spin: spun ?? state.spin,
    lastMove: { type: move.type, playerNumber: turn.seat, ...(spun === undefined ? {} : { spin: spun }), events: turn.events },
    gameStatus: `${name} ${turn.status ?? turn.events.join(', ')}`
  };
  if (turn.won) return { ...next, isGameOver: true, currentPlayer: null, winners: [turn.seat] };
  return turn.board.phase === 'choose' ? next : startTurn(next, nextSeat(next, turn.seat));
}

export function checkeredMove(state: GameState, seat: Seat, move: Move, random: Random): Result<GameState> {
  const board = state.checkered;
  if (!board || !board.pieces[seat] || (move.type !== 'spin' && move.type !== 'step')) return { error: 'Not now' };
  if (board.phase === 'spin' && move.type !== 'spin') return { error: 'Spin first' };
  if (board.phase === 'choose' && (move.type !== 'step' || !board.options.some(c => c.row === move.to?.row && c.col === move.to.col))) {
    return { error: 'Pick one of the squares the spin allows' };
  }
  const turn: Turn = { seat, board: { ...board, phase: 'spin', options: [] }, events: [], won: false };
  if (move.type === 'step') {
    arrive(turn, move.to, random, true);
    return { state: finish(state, turn, move) };
  }
  if (board.skipNext.includes(seat)) {
    turn.board.skipNext = board.skipNext.filter(s => s !== seat);
    turn.events.push('lost this turn');
    return { state: finish(state, turn, move) };
  }
  const spun = teetotum(random);
  const options = legalMoves(board.pieces[seat], spun);
  turn.events.push(`spun ${spun}`);
  if (options.length === 0) turn.status = `spun ${spun} and cannot move`;
  else if (options.length === 1) arrive(turn, options[0], random, true);
  else [turn.board.phase, turn.board.options] = ['choose', options];
  return { state: finish(state, turn, move, spun) };
}

// The platform has removed `seat` and moved a turn it held to the next active seat. A current player
// waiting on their own choice keeps it; otherwise a fresh turn starts.
export function checkeredLeft(state: GameState, seat: Seat): GameState {
  const board = state.checkered!;
  const pieces = { ...board.pieces };
  const points = { ...board.points };
  delete pieces[seat];
  delete points[seat];
  const next = { ...state, checkered: { ...board, pieces, points, skipNext: board.skipNext.filter(s => s !== seat) } };
  const current = next.currentPlayer;
  if (next.isGameOver || current === null) return next;
  return board.phase === 'choose' && next.lastMove?.playerNumber === current ? next : startTurn(next, current);
}

export function checkeredStandings(state: GameState): Standing[] {
  const points = (seat: Seat): number => state.checkered?.points[seat] ?? 0;
  return rankStandings(state, (a, b) => points(b) - points(a), seat => pointsText(points(seat)));
}
