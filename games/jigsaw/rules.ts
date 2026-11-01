// Jigsaw rules shared by the browser and the server (validation). No drawing code: that is svg.ts, on the server only
import { isImageId } from '../../shared/gameFile.ts';
import { houseRule, houseRulesOf } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { MODE_RULE, addContribution, modeOf, raceProgress, visibleBoards } from '../../shared/puzzleModes.ts';
import { baseGameState } from '../../shared/seating.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { clampToTable, gridOf, homeOf, scatter, snaps } from './cut.ts';
import { jigsawInfo } from './info.ts';
import { PIECES_RULE } from './options.ts';
import { PICTURES, isPictureName } from './pictures.ts';
import type { Board, GameState, Picture, Piece, PublicGameState, Result, Seat } from './types.ts';

// An action's result, and whether it snapped a piece (the only kind of action that is recorded)
type Outcome = { state: GameState; snapped: boolean } | { error: string };

const isRace = (state: GameState) => modeOf(state, MODE_RULE) === 'race';
const loose = (x: number, y: number): Piece => ({ x, y, placed: false, heldBy: null, placedBy: null });

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    picture: { kind: 'builtin', name: PICTURES[0].name },
    seed: 0,
    count: PIECES_RULE.standard,
    board: { pieces: [] },
    boards: {},
    snaps: {},
    contributions: {},
    lastMove: null
  };
}

// Before the first pick-up, after anyone joins or leaves: a new cut scattered once, the same for every Race seat
export function resetLobby(state: GameState, random: Random): GameState {
  const count = houseRule(state, PIECES_RULE);
  const grid = gridOf(count);
  const seed = Math.floor(random() * 2 ** 32);
  const board: Board = { pieces: scatter(grid, random).map(spot => loose(spot.x, spot.y)) };
  const race = isRace(state);
  return {
    ...state,
    seed,
    count,
    board: race ? { pieces: [] } : board,
    boards: race ? Object.fromEntries(state.activePlayers.map(seat => [seat, board])) : {},
    snaps: {},
    contributions: {},
    lastMove: null
  };
}

// The board `seat` plays on: its own in Race, else the shared one
export function boardOf(state: GameState, seat: Seat): Board | undefined {
  return isRace(state) ? state.boards[seat] : state.board;
}

function withBoard(state: GameState, seat: Seat, board: Board): GameState {
  return isRace(state) ? { ...state, boards: { ...state.boards, [seat]: board } } : { ...state, board };
}

function eachBoard(state: GameState, change: (board: Board) => Board): GameState {
  const boards = Object.fromEntries(Object.entries(state.boards).map(([seat, board]) => [seat, change(board!)]));
  return { ...state, board: change(state.board), boards };
}

// Lets go of what `seat` holds where it lies, or of every hold with no seat
function letGo(board: Board, seat?: Seat): Board {
  const pieces = board.pieces.map(piece =>
    piece.heldBy !== null && (seat === undefined || piece.heldBy === seat) ? { ...piece, heldBy: null } : piece);
  return { pieces };
}

const complete = (board: Board) => board.pieces.every(piece => piece.placed);
const percentPlaced = (board: Board) =>
  board.pieces.length === 0 ? 0 : (100 * board.pieces.filter(piece => piece.placed).length) / board.pieces.length;

function asPicture(value: unknown): Picture | null {
  const input = asRecord(value);
  if (input?.kind === 'builtin' && isPictureName(input.name)) return { kind: 'builtin', name: input.name };
  if (input?.kind === 'photo' && isImageId(input.id)) return { kind: 'photo', id: input.id };
  return null;
}

function setPicture(state: GameState, seat: Seat, value: unknown): Result<GameState> {
  if (seat !== houseRulesOf(jigsawInfo, state).host) return { error: 'Only the host can choose the picture' };
  if (state.started) return { error: 'The picture is fixed once play starts' };
  const picture = asPicture(value);
  if (!picture) return { error: 'That picture is not available' };
  return { state: { ...state, picture } };
}

// The seat's board and a valid piece index on it
function target(state: GameState, seat: Seat, value: unknown): { board: Board; piece: number } | { error: string } {
  const board = boardOf(state, seat);
  if (!board || typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= board.pieces.length) {
    return { error: 'No such piece' };
  }
  return { board, piece: value };
}

function pickUp(state: GameState, seat: Seat, value: unknown): Result<GameState> {
  const found = target(state, seat, value);
  if ('error' in found) return found;
  const { board, piece } = found;
  const { placed, heldBy } = board.pieces[piece];
  if (placed) return { error: 'That piece is locked in place' };
  if (heldBy !== null && heldBy !== seat) return { error: `${state.playerNames[heldBy]} is holding that piece` };
  const pieces = letGo(board, seat).pieces.map((each, index) => index === piece ? { ...each, heldBy: seat } : each);
  return { state: { ...withBoard(state, seat, { pieces }), started: true } };
}

function drop(state: GameState, seat: Seat, input: Record<string, unknown>): Outcome {
  const found = target(state, seat, input.piece);
  if ('error' in found) return found;
  const { board, piece } = found;
  if (board.pieces[piece].heldBy !== seat) return { error: 'You are not holding that piece' };
  const { x, y } = input;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { error: 'That is not a spot on the table' };
  }
  const grid = gridOf(state.count);
  const spot = clampToTable(grid, x, y);
  const snapped = snaps(grid, piece, spot.x, spot.y);
  const home = homeOf(grid, piece);
  const landed: Piece = snapped ? { ...home, placed: true, heldBy: null, placedBy: seat } : loose(spot.x, spot.y);
  const next = withBoard(state, seat, { pieces: board.pieces.map((each, index) => index === piece ? landed : each) });
  if (!snapped) return { state: next, snapped };

  const placed: GameState = {
    ...next,
    snaps: { ...state.snaps, [seat]: [...(state.snaps[seat] ?? []), piece] },
    contributions: addContribution(state.contributions, seat),
    lastMove: { type: 'snap', playerNumber: seat, piece }
  };
  if (!complete(boardOf(placed, seat)!)) return { state: placed, snapped };
  const race = isRace(state);
  return {
    state: {
      ...placed,
      isGameOver: true,
      currentPlayer: null,
      winners: race ? [seat] : [...state.activePlayers],
      gameStatus: race ? `${state.playerNames[seat]} finished first!` : 'The puzzle is done!'
    },
    snapped
  };
}

function attempt(state: GameState, seat: Seat, action: unknown): Outcome {
  if (state.isGameOver) return { error: 'The puzzle is finished' };
  const input = asRecord(action);
  const unrecorded = (result: Result<GameState>): Outcome => 'error' in result ? result : { state: result.state, snapped: false };
  switch (input?.type) {
    case 'setPicture': return unrecorded(setPicture(state, seat, input.picture));
    case 'pickUp': return unrecorded(pickUp(state, seat, input.piece));
    case 'drop': return drop(state, seat, input);
    default: return { error: 'Unknown action' };
  }
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const outcome = attempt(state, seat, action);
  return 'error' in outcome ? outcome : { state: outcome.state };
}

// Only a snap is a step on the timeline
export function recordsAction(state: GameState, seat: Seat, action: unknown): boolean {
  const outcome = attempt(state, seat, action);
  return 'snapped' in outcome && outcome.snapped;
}

export function applyMove(): Result<GameState> {
  return { error: 'Use the pieces on the table' };
}

// The restored state is from before the snap, while the piece was still held, and nobody is holding it now
export function onUndo(state: GameState): GameState {
  return eachBoard(state, board => letGo(board));
}

// Takes back `seat`'s last snap: the piece comes loose half a cell right of and below its home
export function undoOwn(state: GameState, seat: Seat): Result<GameState> {
  const mine = state.snaps[seat] ?? [];
  const board = boardOf(state, seat);
  if (mine.length === 0 || !board) return { error: 'Nothing of yours to undo' };
  const piece = mine[mine.length - 1];
  const grid = gridOf(state.count);
  const home = homeOf(grid, piece);
  const spot = clampToTable(grid, home.x + grid.w / 2, home.y + grid.h / 2);
  const pieces = board.pieces.map((each, index) => index === piece ? loose(spot.x, spot.y) : each);
  return {
    state: {
      ...withBoard(state, seat, { pieces }),
      snaps: { ...state.snaps, [seat]: mine.slice(0, -1) },
      contributions: addContribution(state.contributions, seat, -1),
      lastMove: { type: 'unsnap', playerNumber: seat, piece }
    }
  };
}

// The room-wide undo vote is Solo's; Together and Race take back their own snaps
export function allowsUndoVote(state: GameState): boolean {
  return modeOf(state, MODE_RULE) === 'solo';
}

export function onPlayerDisconnected(state: GameState, seat: Seat): GameState {
  return eachBoard(state, board => letGo(board, seat));
}

// The leaver lets go of their piece; their Race board and their snaps go with them, and the rest play on
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const released = onPlayerDisconnected(state, seat);
  const boards = { ...released.boards };
  const snapsLeft = { ...released.snaps };
  delete boards[seat];
  delete snapsLeft[seat];
  return { ...released, boards, snaps: snapsLeft };
}

export function imagesOf(state: GameState): string[] {
  return state.picture.kind === 'photo' ? [state.picture.id] : [];
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  return {
    ...state,
    undoAvailable,
    boards: visibleBoards(state.boards, viewer, state.isGameOver),
    progress: raceProgress(state.boards, percentPlaced)
  };
}

// A stand-in until the views task: the winners first, everyone else after
export function finalStandings(state: GameState): Standing[] {
  const winners = state.activePlayers.filter(seat => state.winners.includes(seat));
  const rest = state.activePlayers.filter(seat => !state.winners.includes(seat));
  return [...winners.map(seat => ({ seat, place: 1 })), ...rest.map(seat => ({ seat, place: 2 }))];
}
