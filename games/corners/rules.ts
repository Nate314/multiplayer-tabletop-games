// Corners rules shared by the browser (legal spot hints) and the server (validation).
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { pointsText, rankStandings } from '../../shared/standings.ts';
import type { Standing } from '../../shared/types.ts';
import {
  PIECES, SQUARE_STARTS, TRIANGLE_STARTS, boardCells, cellKey, cornerTouch, edgeTouch, orientations,
  type BoardKind, type Cell, type Shape
} from './geometry.ts';
import { BOARD_RULE } from './options.ts';
import type { Color, GameState, Owner, PublicGameState, Result, Seat } from './types.ts';

export const COLOR_NAMES = ['Blue', 'Yellow', 'Red', 'Green'] as const;
const COLORS: Color[] = [0, 1, 2, 3];

const ON_BOARD: Record<BoardKind, Set<string>> = {
  squares: new Set(boardCells('squares').map(cellKey)),
  triangles: new Set(boardCells('triangles').map(cellKey))
};
const SHAPES: Record<BoardKind, Shape[][]> = {
  squares: PIECES.squares.map(shape => orientations('squares', shape)),
  triangles: PIECES.triangles.map(shape => orientations('triangles', shape))
};

// Two seats play two colors each, three share the last color, four play one each
export function ownersFor(seats: Seat[]): Record<Color, Owner> {
  const owner = (color: Color): Owner => seats.length === 3 && color === 3 ? 'shared' : seats[color % seats.length];
  return { 0: owner(0), 1: owner(1), 2: owner(2), 3: owner(3) };
}

// The owner of turnColor; the shared color goes round the seated players
export function seatToPlace(state: GameState): Seat {
  const owner = state.owners[state.turnColor];
  return owner === 'shared' ? state.activePlayers[state.sharedTurn % state.activePlayers.length] : owner;
}

export function cellsOf(state: GameState, piece: number, orientation: number, dx: number, dy: number): Cell[] {
  return SHAPES[state.board][piece][orientation].map(([x, y, t]): Cell => [x + dx, y + dy, t]);
}

// Every cell that could share a corner point with `cell`
function around(kind: BoardKind, [x, y]: Cell): Cell[] {
  const out: Cell[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    out.push([x + i, y + j, 0]);
    if (kind === 'triangles') out.push([x + i, y + j, 1]);
  }
  return out;
}

const occupancy = (state: GameState): Map<string, Color> =>
  new Map(state.placed.flatMap(p => p.cells.map(c => [cellKey(c), p.color] as const)));

function errorIn(state: GameState, taken: Map<string, Color>, color: Color, cells: Cell[]): string | null {
  const kind = state.board;
  if (cells.some(c => !ON_BOARD[kind].has(cellKey(c)))) return 'That spot is not on the board';
  if (cells.some(c => taken.has(cellKey(c)))) return 'That space is taken';
  const touches = (touch: typeof edgeTouch) =>
    cells.some(c => around(kind, c).some(n => taken.get(cellKey(n)) === color && touch(kind, c, n)));
  if (touches(edgeTouch)) return 'Pieces of one color may only touch at corners';
  if (state.used[color].length === 0) {
    const keys = new Set(cells.map(cellKey));
    if (kind === 'squares') return keys.has(cellKey(SQUARE_STARTS[color])) ? null : 'Your first piece must cover your corner';
    return TRIANGLE_STARTS.some(s => keys.has(cellKey(s))) ? null : 'Your first piece must cover a starting point';
  }
  return touches(cornerTouch) ? null : 'A piece must touch your color at a corner';
}

export function placementError(state: GameState, color: Color, cells: Cell[]): string | null {
  return errorIn(state, occupancy(state), color, cells);
}

// Empty cells a new piece of `color` could cover: its start cells for a first piece, else cells at its corners
function anchors(state: GameState, taken: Map<string, Color>, color: Color): Cell[] {
  const kind = state.board;
  if (state.used[color].length === 0) {
    return (kind === 'squares' ? [SQUARE_STARTS[color]] : TRIANGLE_STARTS).filter(c => !taken.has(cellKey(c)));
  }
  const found = new Map<string, Cell>();
  for (const p of state.placed) {
    if (p.color !== color) continue;
    for (const c of p.cells) {
      for (const n of around(kind, c)) {
        const key = cellKey(n);
        if (ON_BOARD[kind].has(key) && !taken.has(key) && cornerTouch(kind, c, n)) found.set(key, n);
      }
    }
  }
  return [...found.values()];
}

// Each legal offset once, found by laying every cell of the orientation on every anchor
function* spots(state: GameState, taken: Map<string, Color>, color: Color, piece: number, orientation: number) {
  const shape = SHAPES[state.board][piece]?.[orientation];
  if (!shape || state.used[color].includes(piece)) return;
  const seen = new Set<string>();
  for (const anchor of anchors(state, taken, color)) {
    for (const c of shape) {
      if (c[2] !== anchor[2]) continue;
      const dx = anchor[0] - c[0];
      const dy = anchor[1] - c[1];
      const key = `${dx},${dy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!errorIn(state, taken, color, cellsOf(state, piece, orientation, dx, dy))) yield { dx, dy };
    }
  }
}

export function legalSpots(state: GameState, color: Color, piece: number, orientation: number): { dx: number; dy: number }[] {
  return [...spots(state, occupancy(state), color, piece, orientation)];
}

export function hasLegalPlacement(state: GameState, color: Color): boolean {
  const taken = occupancy(state);
  return SHAPES[state.board].some((shapes, piece) =>
    shapes.some((_, orientation) => !spots(state, taken, color, piece, orientation).next().done));
}

export function colorScore(state: GameState, color: Color): number {
  const used = state.used[color];
  const pieces = PIECES[state.board];
  if (used.length === pieces.length) return used[used.length - 1] === 0 ? 20 : 15;
  return -pieces.reduce((sum, shape, piece) => used.includes(piece) ? sum : sum + shape.length, 0);
}

// The shared color is owned by no seat, so it scores for nobody
function seatScores(state: GameState): Partial<Record<Seat, number>> {
  return Object.fromEntries(state.activePlayers.map(seat => [seat,
    COLORS.reduce<number>((sum, color) => state.owners[color] === seat ? sum + colorScore(state, color) : sum, 0)]));
}

function gameOver(state: GameState): GameState {
  const scores = seatScores(state);
  const top = Math.max(...state.activePlayers.map(seat => scores[seat] ?? 0));
  const winners = state.activePlayers.filter(seat => scores[seat] === top);
  const names = winners.map(seat => state.playerNames[seat]);
  const gameStatus = names.length === 1
    ? `${names[0]} wins with ${pointsText(top)}`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} tie with ${pointsText(top)}`;
  return { ...state, isGameOver: true, currentPlayer: null, winners, gameStatus };
}

// The turn passes to the next color that can still place; one that cannot goes out for good
function advance(state: GameState, status: string[]): GameState {
  const out = [...state.out];
  let sharedTurn = state.sharedTurn;
  for (let step = 1; step <= COLORS.length; step++) {
    const color = ((state.turnColor + step) % COLORS.length) as Color;
    if (out.includes(color)) continue;
    if (hasLegalPlacement(state, color)) {
      const next = { ...state, out, sharedTurn, turnColor: color, gameStatus: status.join('. ') };
      return { ...next, currentPlayer: seatToPlace(next) };
    }
    out.push(color);
    if (state.owners[color] === 'shared') sharedTurn++;
    status.push(`${COLOR_NAMES[color]} cannot place any more`);
  }
  return gameOver({ ...state, out, sharedTurn });
}

function freshBoard(board: BoardKind, seats: Seat[]) {
  return {
    board, owners: ownersFor(seats), turnColor: 0 as Color, sharedTurn: 0,
    used: { 0: [], 1: [], 2: [], 3: [] }, placed: [], out: [], lastMove: null
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...freshBoard(BOARD_RULE.standard, []) };
}

export function resetLobby(state: GameState): GameState {
  return { ...state, ...freshBoard(houseRule(state, BOARD_RULE), state.activePlayers) };
}

// A dismissed player's colors stop; the shared color keeps going round whoever is left
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const next = { ...state, out: [...state.out, ...COLORS.filter(c => state.owners[c] === seat && !state.out.includes(c))] };
  if (next.out.includes(state.turnColor)) return advance(next, [state.gameStatus]);
  return { ...next, currentPlayer: seatToPlace(next) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'place') return { error: 'Unknown move type' };
  const { piece, orientation, dx, dy } = input;
  if (![piece, orientation, dx, dy].every(Number.isInteger)) return { error: 'Invalid move' };
  const [p, o, x, y] = [piece, orientation, dx, dy] as number[];
  const shapes = SHAPES[state.board];
  if (p < 0 || p >= shapes.length || o < 0 || o >= shapes[p].length) return { error: 'Invalid move' };

  const color = state.turnColor;
  if (state.used[color].includes(p)) return { error: 'That piece is already played' };
  const cells = cellsOf(state, p, o, x, y);
  const error = placementError(state, color, cells);
  if (error) return { error };

  const next: GameState = {
    ...state,
    placed: [...state.placed, { color, piece: p, cells }],
    used: { ...state.used, [color]: [...state.used[color], p] },
    sharedTurn: state.sharedTurn + (state.owners[color] === 'shared' ? 1 : 0),
    lastMove: { type: 'place', playerNumber: seat, color, piece: p, cells }
  };
  return { state: advance(next, [`${state.playerNames[seat]} placed a piece in ${COLOR_NAMES[color]}`]) };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const colorScores = { 0: colorScore(state, 0), 1: colorScore(state, 1), 2: colorScore(state, 2), 3: colorScore(state, 3) };
  return { ...state, undoAvailable, scores: seatScores(state), colorScores };
}

export function finalStandings(state: GameState): Standing[] {
  const scores = seatScores(state);
  const score = (seat: Seat) => scores[seat] ?? 0;
  return rankStandings(state, (a, b) => score(b) - score(a), seat => pointsText(score(seat)));
}
