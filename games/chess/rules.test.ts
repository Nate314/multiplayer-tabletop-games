import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, isInCheck, isInsufficientMaterial, legalMoves, pieceAt, positionKey, squareName } from './rules.ts';
import { chess } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Board, CastlingRights, GameState, Move, Piece, PieceType, PromotionType, Seat, Square } from './types.ts';

// 'e4' is row 4, col 4
function sq(name: string): Square {
  return { row: BOARD_SIZE - Number(name[1]), col: name.charCodeAt(0) - 'a'.charCodeAt(0) };
}

const mv = (from: string, to: string, promotion?: PromotionType): Move => ({ type: 'move', from: sq(from), to: sq(to), promotion });

const TYPES: Record<string, PieceType> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

// Uppercase letters are white pieces and lowercase are black, e.g. { e1: 'K', e8: 'k' }
function boardOf(pieces: Record<string, string>): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  for (const [name, letter] of Object.entries(pieces)) {
    const { row, col } = sq(name);
    board[row][col] = { color: letter === letter.toUpperCase() ? 'white' : 'black', type: TYPES[letter.toUpperCase()] };
  }
  return board;
}

const NO_CASTLING: CastlingRights = { white: { kingSide: false, queenSide: false }, black: { kingSide: false, queenSide: false } };

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(...names: string[]): GameState {
  let state = chess.createGameState('g1');
  for (const name of names) state = seated(addPlayer(chess, state, name)).state;
  return state;
}

// A two-player game set up with only the given pieces, `seat` to move
function position(pieces: Record<string, string>, { seat = 1, castling = NO_CASTLING }: { seat?: Seat; castling?: CastlingRights } = {}): GameState {
  const state = { ...lobby('A', 'B'), board: boardOf(pieces), castling, enPassant: null, currentPlayer: seat };
  return { ...state, positions: [positionKey(state, seat === 1 ? 'white' : 'black')] };
}

function play(state: GameState, seat: Seat, move: Move): GameState {
  const result = applyMove(chess, state, seat, move);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Plays moves in turn starting with whoever is to move
function playAll(state: GameState, ...moves: Move[]): GameState {
  return moves.reduce((current, move) => play(current, current.currentPlayer as Seat, move), state);
}

function at(state: GameState, name: string): Piece | null {
  return pieceAt(state.board, sq(name));
}

function destinations(state: GameState, from: string): string[] {
  return legalMoves(state, sq(from)).map(squareName).sort();
}

test('two players take seats and white moves first', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(at(state, 'e1'), { color: 'white', type: 'king' });
  assert.deepEqual(at(state, 'd8'), { color: 'black', type: 'queen' });
  assert.deepEqual(at(state, 'a7'), { color: 'black', type: 'pawn' });
  assert.deepEqual(addPlayer(chess, state, 'C'), { error: 'Game is full' });
});

test('every white piece has its standard opening moves', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(destinations(state, 'e2'), ['e3', 'e4']);
  assert.deepEqual(destinations(state, 'g1'), ['f3', 'h3']);
  assert.deepEqual(destinations(state, 'a1'), []);
  assert.deepEqual(destinations(state, 'e1'), []);
});

test('rejects malformed and illegal moves', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(applyMove(chess, state, 2, mv('e7', 'e5')), { error: 'Not your turn' });
  assert.deepEqual(applyMove(chess, state, 1, mv('e7', 'e5')), { error: 'Invalid move' });
  assert.deepEqual(applyMove(chess, state, 1, mv('e2', 'e5')), { error: 'Invalid move' });
  assert.deepEqual(applyMove(chess, state, 1, mv('e3', 'e4')), { error: 'Invalid move' });
  assert.deepEqual(applyMove(chess, state, 1, { type: 'move', from: { row: '6', col: 4 }, to: sq('e4') }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(chess, state, 1, { type: 'move', from: { row: 9, col: 4 }, to: sq('e4') }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(chess, state, 1, { type: 'move' }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(chess, state, 1, { type: 'castle' }), { error: 'Unknown move type' });
  assert.deepEqual(applyMove(chess, state, 1, null), { error: 'Unknown move type' });
  assert.deepEqual(applyMove(chess, state, 1, 'e4'), { error: 'Unknown move type' });
});

test('a move updates the board, last move, status and turn', () => {
  const state = play(lobby('A', 'B'), 1, mv('e2', 'e4'));
  assert.equal(at(state, 'e2'), null);
  assert.deepEqual(at(state, 'e4'), { color: 'white', type: 'pawn' });
  assert.deepEqual(state.lastMove, { type: 'move', playerNumber: 1, from: sq('e2'), to: sq('e4'), notation: 'e4' });
  assert.equal(state.gameStatus, 'A played e4');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.started, true);
  assert.deepEqual(state.enPassant, sq('e3'));
});

test("fool's mate ends the game with a win for black", () => {
  const state = playAll(lobby('A', 'B'), mv('f2', 'f3'), mv('e7', 'e5'), mv('g2', 'g4'), mv('d8', 'h4'));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.gameStatus, 'Checkmate! B wins!');
  assert.equal(state.lastMove?.type === 'move' && state.lastMove.notation, 'Qh4#');
  assert.deepEqual(applyMove(chess, state, 1, mv('a2', 'a3')), { error: 'The game is over' });
});

test('a check is announced and must be answered', () => {
  const state = playAll(lobby('A', 'B'), mv('e2', 'e4'), mv('f7', 'f6'), mv('d1', 'h5'));
  assert.equal(state.gameStatus, 'A played Qh5+. B is in check');
  assert.equal(isInCheck(state.board, 'black'), true);
  assert.deepEqual(destinations(state, 'a7'), []);
  assert.deepEqual(destinations(state, 'g7'), ['g6']);
  assert.deepEqual(destinations(state, 'e8'), []);
});

test('a pinned piece cannot expose its king', () => {
  const state = position({ e1: 'K', e2: 'N', e8: 'r', a8: 'k' });
  assert.deepEqual(destinations(state, 'e2'), []);
  assert.deepEqual(applyMove(chess, state, 1, mv('e2', 'c3')), { error: 'Invalid move' });
});

test('captures are recorded for the captured color', () => {
  const state = playAll(lobby('A', 'B'), mv('e2', 'e4'), mv('d7', 'd5'), mv('e4', 'd5'));
  assert.deepEqual(state.captured, { white: [], black: ['pawn'] });
  assert.equal(state.lastMove?.type === 'move' && state.lastMove.notation, 'exd5');
});

test('castling moves the rook and needs empty squares that are not attacked', () => {
  const rights: CastlingRights = { white: { kingSide: true, queenSide: true }, black: { kingSide: false, queenSide: false } };
  const open = position({ e1: 'K', a1: 'R', h1: 'R', e8: 'k' }, { castling: rights });
  assert.deepEqual(destinations(open, 'e1'), ['c1', 'd1', 'd2', 'e2', 'f1', 'f2', 'g1']);

  const castled = play(open, 1, mv('e1', 'g1'));
  assert.deepEqual(at(castled, 'f1'), { color: 'white', type: 'rook' });
  assert.equal(at(castled, 'h1'), null);
  assert.deepEqual(castled.castling.white, { kingSide: false, queenSide: false });
  assert.equal(castled.lastMove?.type === 'move' && castled.lastMove.notation, 'O-O');

  const long = play(open, 1, mv('e1', 'c1'));
  assert.deepEqual(at(long, 'd1'), { color: 'white', type: 'rook' });
  assert.equal(long.lastMove?.type === 'move' && long.lastMove.notation, 'O-O-O');

  // Through check (f1), into check (c1), out of check, and with a piece in the way (b1)
  assert.deepEqual(destinations(position({ e1: 'K', h1: 'R', e8: 'k', f8: 'r' }, { castling: rights }), 'e1').includes('g1'), false);
  assert.deepEqual(destinations(position({ e1: 'K', a1: 'R', e8: 'k', c8: 'r' }, { castling: rights }), 'e1').includes('c1'), false);
  assert.deepEqual(destinations(position({ e1: 'K', h1: 'R', a1: 'R', a8: 'k', e7: 'r' }, { castling: rights }), 'e1'), ['d1', 'd2', 'f1', 'f2']);
  assert.deepEqual(destinations(position({ e1: 'K', a1: 'R', b1: 'N', e8: 'k' }, { castling: rights }), 'e1').includes('c1'), false);
});

test('moving or losing a rook gives up castling on that side only', () => {
  const rights: CastlingRights = { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } };
  const state = position({ e1: 'K', a1: 'R', h1: 'R', e8: 'k', a8: 'r', h8: 'r' }, { castling: rights });
  const rookMoved = play(state, 1, mv('h1', 'h2'));
  assert.deepEqual(rookMoved.castling.white, { kingSide: false, queenSide: true });
  const rookTaken = play(state, 1, mv('a1', 'a8'));
  assert.deepEqual(rookTaken.castling.black, { kingSide: true, queenSide: false });
});

test('en passant captures the pawn that just moved two squares, only right away', () => {
  const ready = playAll(lobby('A', 'B'), mv('e2', 'e4'), mv('a7', 'a6'), mv('e4', 'e5'), mv('d7', 'd5'));
  assert.deepEqual(destinations(ready, 'e5'), ['d6', 'e6']);
  const taken = play(ready, 1, mv('e5', 'd6'));
  assert.equal(at(taken, 'd5'), null);
  assert.deepEqual(at(taken, 'd6'), { color: 'white', type: 'pawn' });
  assert.deepEqual(taken.captured.black, ['pawn']);
  assert.equal(taken.lastMove?.type === 'move' && taken.lastMove.notation, 'exd6');

  const late = playAll(ready, mv('h2', 'h3'), mv('h7', 'h6'));
  assert.deepEqual(destinations(late, 'e5'), ['e6']);
});

test('a pawn on the last rank promotes to the chosen piece', () => {
  const state = position({ a7: 'P', e1: 'K', h8: 'k' });
  assert.deepEqual(applyMove(chess, state, 1, mv('a7', 'a8')), { error: 'Choose a piece to promote to' });
  assert.deepEqual(applyMove(chess, state, 1, mv('a7', 'a8', 'king' as PromotionType)), { error: 'Choose a piece to promote to' });
  const knighted = play(state, 1, mv('a7', 'a8', 'knight'));
  assert.deepEqual(at(knighted, 'a8'), { color: 'white', type: 'knight' });
  assert.equal(knighted.lastMove?.type === 'move' && knighted.lastMove.notation, 'a8=N');
  const queened = play(state, 1, mv('a7', 'a8', 'queen'));
  assert.equal(queened.lastMove?.type === 'move' && queened.lastMove.notation, 'a8=Q+');
});

test('notation names the file or rank when two pieces could move', () => {
  const knights = play(position({ b1: 'N', f1: 'N', e3: 'K', h8: 'k' }), 1, mv('b1', 'd2'));
  assert.equal(knights.lastMove?.type === 'move' && knights.lastMove.notation, 'Nbd2');
  const rooks = play(position({ a1: 'R', a5: 'R', h1: 'K', h8: 'k' }), 1, mv('a1', 'a3'));
  assert.equal(rooks.lastMove?.type === 'move' && rooks.lastMove.notation, 'R1a3');
});

test('stalemate is a draw', () => {
  const state = play(position({ f7: 'K', g5: 'Q', h8: 'k' }), 1, mv('g5', 'g6'));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, []);
  assert.equal(state.gameStatus, 'Draw by stalemate');
});

test('taking the last piece that could mate is a draw', () => {
  const state = play(position({ e1: 'K', d2: 'n', h8: 'k' }), 1, mv('e1', 'd2'));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, []);
  assert.equal(state.gameStatus, 'Draw by insufficient material');
});

test('insufficient material covers lone minor pieces and same-colored bishops', () => {
  assert.equal(isInsufficientMaterial(boardOf({ e1: 'K', e8: 'k' })), true);
  assert.equal(isInsufficientMaterial(boardOf({ e1: 'K', e8: 'k', c1: 'B' })), true);
  assert.equal(isInsufficientMaterial(boardOf({ e1: 'K', e8: 'k', c1: 'B', f8: 'b' })), true);
  assert.equal(isInsufficientMaterial(boardOf({ e1: 'K', e8: 'k', c1: 'B', c8: 'b' })), false);
  assert.equal(isInsufficientMaterial(boardOf({ e1: 'K', e8: 'k', b1: 'N', g1: 'N' })), false);
  assert.equal(isInsufficientMaterial(boardOf({ e1: 'K', e8: 'k', a2: 'P' })), false);
});

test('the same position three times is a draw', () => {
  const shuffle = [mv('g1', 'f3'), mv('g8', 'f6'), mv('f3', 'g1'), mv('f6', 'g8')];
  const twice = playAll(lobby('A', 'B'), ...shuffle);
  assert.equal(twice.isGameOver, false);
  const thrice = playAll(twice, ...shuffle);
  assert.equal(thrice.isGameOver, true);
  assert.deepEqual(thrice.winners, []);
  assert.equal(thrice.gameStatus, 'Draw by threefold repetition');
});

test('fifty moves each without a capture or pawn move is a draw', () => {
  const start = position({ e1: 'K', a1: 'R', e8: 'k', h7: 'p' });
  const history = Array.from({ length: 99 }, (_, index) => `earlier ${index}`);
  const state = { ...start, positions: [...history, ...start.positions] };
  const drawn = play(state, 1, mv('a1', 'a2'));
  assert.equal(drawn.gameStatus, 'Draw by the 50-move rule');
  assert.deepEqual(drawn.winners, []);

  const reset = playAll({ ...state, currentPlayer: 2 }, mv('h7', 'h6'));
  assert.equal(reset.positions.length, 1);
  assert.equal(reset.isGameOver, false);
});

test('a player may resign on their turn', () => {
  const state = play(play(lobby('A', 'B'), 1, mv('e2', 'e4')), 2, { type: 'resign' });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.deepEqual(state.lastMove, { type: 'resign', playerNumber: 2 });
  assert.equal(state.gameStatus, 'B resigned. A wins!');
});

test('the player left after a dismissal wins', () => {
  const state = removePlayer(chess, play(lobby('A', 'B'), 1, mv('e2', 'e4')), 2);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});
