import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE, applyAction, claimableAfterMove, claimableDraw, isDeadPosition, isInCheck, isInsufficientMaterial, legalMoves,
  pieceAt, positionKey, squareName
} from './rules.ts';
import { chess } from './index.ts';
import { describeHouseRules, houseRulesOf } from '../../shared/houseRules.ts';
import { withRules } from '../../server/testing.ts';
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

function act(state: GameState, seat: Seat, action: unknown) {
  return applyAction(state, seat, action);
}

function actOk(state: GameState, seat: Seat, action: unknown): GameState {
  const result = act(state, seat, action);
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
  assert.deepEqual(state.lastMove, { playerNumber: 1, from: sq('e2'), to: sq('e4'), notation: 'e4' });
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
  assert.equal(state.lastMove?.notation, 'Qh4#');
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
  assert.equal(state.lastMove?.notation, 'exd5');
});

test('castling moves the rook and needs empty squares that are not attacked', () => {
  const rights: CastlingRights = { white: { kingSide: true, queenSide: true }, black: { kingSide: false, queenSide: false } };
  const open = position({ e1: 'K', a1: 'R', h1: 'R', e8: 'k' }, { castling: rights });
  assert.deepEqual(destinations(open, 'e1'), ['c1', 'd1', 'd2', 'e2', 'f1', 'f2', 'g1']);

  const castled = play(open, 1, mv('e1', 'g1'));
  assert.deepEqual(at(castled, 'f1'), { color: 'white', type: 'rook' });
  assert.equal(at(castled, 'h1'), null);
  assert.deepEqual(castled.castling.white, { kingSide: false, queenSide: false });
  assert.equal(castled.lastMove?.notation, 'O-O');

  const long = play(open, 1, mv('e1', 'c1'));
  assert.deepEqual(at(long, 'd1'), { color: 'white', type: 'rook' });
  assert.equal(long.lastMove?.notation, 'O-O-O');

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
  assert.equal(taken.lastMove?.notation, 'exd6');

  const late = playAll(ready, mv('h2', 'h3'), mv('h7', 'h6'));
  assert.deepEqual(destinations(late, 'e5'), ['e6']);
});

test('a pawn on the last rank promotes to the chosen piece', () => {
  const state = position({ a7: 'P', e1: 'K', h8: 'k' });
  assert.deepEqual(applyMove(chess, state, 1, mv('a7', 'a8')), { error: 'Choose a piece to promote to' });
  assert.deepEqual(applyMove(chess, state, 1, mv('a7', 'a8', 'king' as PromotionType)), { error: 'Choose a piece to promote to' });
  const knighted = play(state, 1, mv('a7', 'a8', 'knight'));
  assert.deepEqual(at(knighted, 'a8'), { color: 'white', type: 'knight' });
  assert.equal(knighted.lastMove?.notation, 'a8=N');
  const queened = play(state, 1, mv('a7', 'a8', 'queen'));
  assert.equal(queened.lastMove?.notation, 'a8=Q+');
});

test('notation names the file or rank when two pieces could move', () => {
  const knights = play(position({ b1: 'N', f1: 'N', e3: 'K', h8: 'k' }), 1, mv('b1', 'd2'));
  assert.equal(knights.lastMove?.notation, 'Nbd2');
  const rooks = play(position({ a1: 'R', a5: 'R', h1: 'K', h8: 'k' }), 1, mv('a1', 'a3'));
  assert.equal(rooks.lastMove?.notation, 'R1a3');
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

// Knights out and back: four half-moves that bring back the starting position
const SHUFFLE = [mv('g1', 'f3'), mv('g8', 'f6'), mv('f3', 'g1'), mv('f6', 'g8')];

test('threefold repetition is a draw only when claimed, by the player to move', () => {
  const twice = playAll(lobby('A', 'B'), ...SHUFFLE);
  assert.equal(claimableDraw(twice), null);
  assert.deepEqual(act(twice, 1, { type: 'claimDraw' }), { error: 'There is no draw to claim' });

  const thrice = playAll(twice, ...SHUFFLE);
  assert.equal(thrice.isGameOver, false);
  assert.equal(claimableDraw(thrice), 'threefold repetition');
  assert.deepEqual(act(thrice, 2, { type: 'claimDraw' }), { error: 'You can claim a draw only on your turn' });

  const claimed = actOk(thrice, 1, { type: 'claimDraw' });
  assert.equal(claimed.isGameOver, true);
  assert.deepEqual(claimed.winners, []);
  assert.equal(claimed.gameStatus, 'A claimed a draw by threefold repetition');
});

test('a draw can be claimed with the move that produces the third repetition', () => {
  const state = playAll(lobby('A', 'B'), ...SHUFFLE, ...SHUFFLE.slice(0, 3));
  assert.equal(claimableAfterMove(state, sq('f6'), sq('g8')), 'threefold repetition');
  assert.equal(claimableAfterMove(state, sq('f6'), sq('h5')), null);
  assert.deepEqual(applyMove(chess, state, 2, { ...mv('f6', 'h5'), claimDraw: true }), { error: 'That move gives no draw to claim' });

  const claimed = play(state, 2, { ...mv('f6', 'g8'), claimDraw: true });
  assert.equal(claimed.isGameOver, true);
  assert.deepEqual(claimed.winners, []);
  assert.equal(claimed.gameStatus, 'B played Ng8 and claimed a draw by threefold repetition');
});

test('fivefold repetition ends the game at once', () => {
  const four = playAll(lobby('A', 'B'), ...SHUFFLE, ...SHUFFLE, ...SHUFFLE, ...SHUFFLE.slice(0, 3));
  assert.equal(four.isGameOver, false);
  const five = play(four, 2, mv('f6', 'g8'));
  assert.equal(five.isGameOver, true);
  assert.deepEqual(five.winners, []);
  assert.equal(five.gameStatus, 'Draw by fivefold repetition');
});

// `plies` half-moves have passed without a capture or pawn move, counting the one that reached `start`
function quietFor(start: GameState, plies: number): GameState {
  const history = Array.from({ length: plies }, (_, index) => `earlier ${index}`);
  return { ...start, positions: [...history, ...start.positions] };
}

test('fifty moves each without a capture or pawn move may be claimed; a pawn move starts the count over', () => {
  const state = quietFor(position({ e1: 'K', a1: 'R', e8: 'k', h7: 'p' }), 99);
  const fifty = play(state, 1, mv('a1', 'a2'));
  assert.equal(fifty.isGameOver, false);
  assert.equal(claimableDraw(fifty), 'the 50-move rule');
  const claimed = actOk(fifty, 2, { type: 'claimDraw' });
  assert.deepEqual(claimed.winners, []);
  assert.equal(claimed.gameStatus, 'B claimed a draw by the 50-move rule');

  const reset = playAll({ ...state, currentPlayer: 2 }, mv('h7', 'h6'));
  assert.equal(reset.positions.length, 1);
  assert.equal(claimableDraw(reset), null);
});

test('seventy-five moves each without a capture or pawn move ends the game, unless the last move mates', () => {
  const drawn = play(quietFor(position({ e1: 'K', a1: 'R', e8: 'k', h7: 'p' }), 149), 1, mv('a1', 'a2'));
  assert.equal(drawn.isGameOver, true);
  assert.deepEqual(drawn.winners, []);
  assert.equal(drawn.gameStatus, 'Draw by the 75-move rule');

  const mated = play(quietFor(position({ g6: 'K', a1: 'R', g8: 'k' }), 149), 1, mv('a1', 'a8'));
  assert.deepEqual(mated.winners, [1]);
  assert.equal(mated.gameStatus, 'Checkmate! A wins!');
});

// Interlocked pawns across the whole board; every king square below and above the wall is cut off
const WALL = {
  a3: 'P', b4: 'P', c3: 'P', d4: 'P', e3: 'P', f4: 'P', g3: 'P', h4: 'P',
  a4: 'p', b5: 'p', c4: 'p', d5: 'p', e4: 'p', f5: 'p', g4: 'p', h5: 'p'
};

test('locked pawns that no king can reach are a dead position, and the game ends at once', () => {
  assert.equal(isDeadPosition(position({ ...WALL, e1: 'K', e8: 'k' })), true);
  const drawn = play(position({ ...WALL, d1: 'K', e8: 'k' }), 1, mv('d1', 'e1'));
  assert.equal(drawn.isGameOver, true);
  assert.deepEqual(drawn.winners, []);
  assert.equal(drawn.gameStatus, 'Draw by dead position: the pawns are locked and neither king can reach one');
});

test('a dead position is never declared while a pawn or a king can still make progress', () => {
  // The white king is behind the black pawns and can take h5
  assert.equal(isDeadPosition(position({ ...WALL, f6: 'K', e8: 'k' })), false);
  // Without e4 the e3 pawn can advance
  const { e4: _e4, ...open } = WALL;
  assert.equal(isDeadPosition(position({ ...open, e1: 'K', e8: 'k' })), false);
  // A pawn that can capture is not locked
  assert.equal(isDeadPosition(position({ e4: 'P', e5: 'p', d5: 'p', a1: 'K', a8: 'k' })), false);
  // Any other piece can still help to mate
  assert.equal(isDeadPosition(position({ ...WALL, e1: 'K', e8: 'k', h1: 'N' })), false);
  // An en passant capture on offer is not looked into
  assert.equal(isDeadPosition({ ...position({ ...WALL, e1: 'K', e8: 'k' }), enPassant: sq('h3') }), false);
});

test("a player may resign at any time, even on the opponent's turn", () => {
  const state = play(lobby('A', 'B'), 1, mv('e2', 'e4'));
  const resigned = actOk({ ...state, currentPlayer: 2 }, 1, { type: 'resign' });
  assert.equal(resigned.isGameOver, true);
  assert.deepEqual(resigned.winners, [2]);
  assert.equal(resigned.currentPlayer, null);
  assert.equal(resigned.gameStatus, 'A resigned. B wins!');
  assert.deepEqual(act(lobby('A', 'B'), 1, { type: 'resign' }), { error: 'The game has not started' });
  assert.deepEqual(act(resigned, 2, { type: 'resign' }), { error: 'The game is over' });
});

test('resigning is a draw when the opponent could never checkmate', () => {
  const loneKing = { ...position({ e1: 'K', a2: 'Q', e8: 'k' }), started: true };
  const drawn = actOk(loneKing, 1, { type: 'resign' });
  assert.deepEqual(drawn.winners, []);
  assert.equal(drawn.gameStatus, 'A resigned, but B could never checkmate. Draw.');

  // A knight can still help to mate a king boxed in by its own queen, so this resignation loses
  const knight = { ...position({ e1: 'K', a2: 'Q', e8: 'k', b8: 'n' }), started: true };
  assert.deepEqual(actOk(knight, 1, { type: 'resign' }).winners, [2]);
});

test('a draw offer is accepted, declined, or lapses when the opponent moves', () => {
  const state = play(lobby('A', 'B'), 1, mv('e2', 'e4'));
  const offered = actOk(state, 2, { type: 'offerDraw' });
  assert.equal(offered.drawOffer, 2);
  assert.equal(offered.gameStatus, 'B offers a draw');

  const agreed = actOk(offered, 1, { type: 'answerDraw', accept: true });
  assert.equal(agreed.isGameOver, true);
  assert.deepEqual(agreed.winners, []);
  assert.equal(agreed.gameStatus, 'Draw by agreement');

  const declined = actOk(offered, 1, { type: 'answerDraw', accept: false });
  assert.equal(declined.drawOffer, null);
  assert.equal(declined.isGameOver, false);

  const ownMove = play(offered, 2, mv('e7', 'e5'));
  assert.equal(ownMove.drawOffer, 2);
  const lapsed = play(ownMove, 1, mv('g1', 'f3'));
  assert.equal(lapsed.drawOffer, null);
});

test('the player left after a dismissal wins', () => {
  const state = removePlayer(chess, play(lobby('A', 'B'), 1, mv('e2', 'e4')), 2);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

// Chess clock

const clocked = (minutes: 'off' | 5 | 10 | 15 = 5, increment = 0): GameState =>
  ({ ...lobby('A', 'B'), houseRules: withRules({ clockMinutes: minutes, incrementSeconds: increment }) });
const T0 = 1_000_000;
const FIVE_MINUTES = 300_000;
const withMove = (state: GameState, seat: Seat, move: Move, now: number) => {
  const result = applyMove(chess, state, seat, move, Math.random, now);
  if ('error' in result) assert.fail(result.error);
  return result.state;
};

test('with the clock off there is no deadline', () => {
  const state = chess.resumeClock?.(clocked('off'), T0) as GameState;
  assert.equal(state.clock, null);
  assert.equal(chess.deadline?.(state), null);
  assert.equal(chess.deadline?.(chess.createGameState('g1')), null);
});

test("the clock starts with White's time when everyone has agreed", () => {
  const state = chess.resumeClock?.(clocked(), T0) as GameState;
  assert.deepEqual(state.clock, { remainingMs: { 1: FIVE_MINUTES, 2: FIVE_MINUTES }, runningSince: T0 });
  assert.equal(state.currentPlayer, 1);
  assert.equal(chess.deadline?.(state), T0 + FIVE_MINUTES);
  assert.equal(chess.deadline?.(chess.resetLobby(state, Math.random)), null); // a seat change stops it
});

test('a move charges the mover and adds the increment', () => {
  const started = chess.resumeClock?.(clocked(5, 2), T0) as GameState;
  const afterWhite = withMove(started, 1, mv('e2', 'e4'), T0 + 10_000);
  assert.equal(afterWhite.clock?.remainingMs[1], 300_000 - 10_000 + 2_000);
  assert.equal(afterWhite.clock?.remainingMs[2], FIVE_MINUTES);
  assert.equal(afterWhite.clock?.runningSince, T0 + 10_000);
  assert.equal(chess.deadline?.(afterWhite), T0 + 10_000 + FIVE_MINUTES);
});

test('running out of time loses', () => {
  const started = chess.resumeClock?.(clocked(), T0) as GameState;
  const lost = chess.onDeadline?.(started, T0 + FIVE_MINUTES, Math.random) as GameState;
  assert.equal(lost.isGameOver, true);
  assert.deepEqual(lost.winners, [2]);
  assert.equal(lost.gameStatus, 'A ran out of time. B wins!');
  assert.equal(chess.deadline?.(lost), null);
});

test('running out of time loses even when the opponent could not checkmate', () => {
  const alone = { ...position({ e1: 'K', e8: 'k', a2: 'P' }), houseRules: withRules({ clockMinutes: 5, incrementSeconds: 0 }) };
  const state = chess.resumeClock?.({ ...alone, started: true, clock: { remainingMs: { 1: 5, 2: 5 }, runningSince: null } }, T0) as GameState;
  const lost = chess.onDeadline?.({ ...state, currentPlayer: 2 }, T0 + 5, Math.random) as GameState;
  assert.deepEqual(lost.winners, [1]);
});

test('a move after the time ran out is refused as a loss on time', () => {
  const started = chess.resumeClock?.(clocked(), T0) as GameState;
  const lost = withMove(started, 1, mv('e2', 'e4'), T0 + FIVE_MINUTES + 1);
  assert.equal(lost.isGameOver, true);
  assert.deepEqual(lost.winners, [2]);
  assert.equal(lost.board[4][4], null);
  assert.equal(lost.gameStatus, 'A ran out of time. B wins!');
});

test('the increment is offered only with the clock on', () => {
  const labels = (state: GameState) => describeHouseRules(chess.info, houseRulesOf(chess.info, state), 2).map(line => line.label);
  const off = { ...lobby('A', 'B'), houseRules: withRules({ clockMinutes: 'off' }) }; // the platform leaves out a rule that is not offered
  assert.deepEqual(labels(off), ['Clock']);
  assert.deepEqual(labels(clocked(5)), ['Clock', 'Increment per move']);
});

test('a game over stops the clock', () => {
  let state = chess.resumeClock?.(clocked(), T0) as GameState;
  const mated = [mv('f2', 'f3'), mv('e7', 'e5'), mv('g2', 'g4'), mv('d8', 'h4')]
    .reduce((current, move, index) => withMove(current, index % 2 === 0 ? 1 : 2, move, T0 + 1000 * (index + 1)), state);
  assert.equal(mated.isGameOver, true);
  assert.equal(chess.deadline?.(mated), null);
  assert.equal(mated.clock?.runningSince, null);

  state = withMove(state, 1, mv('e2', 'e4'), T0 + 1000);
  const resigned = actOk(state, 2, { type: 'resign' });
  assert.equal(chess.deadline?.(resigned), null);
  assert.equal(resigned.clock?.runningSince, null);
});

test('a restart does not charge the downtime', () => {
  const started = withMove(chess.resumeClock?.(clocked(), T0) as GameState, 1, mv('e2', 'e4'), T0 + 10_000);
  const loaded = chess.resumeClock?.(started, T0 + 9_999_999) as GameState;
  assert.deepEqual(loaded.clock?.remainingMs, started.clock?.remainingMs);
  assert.equal(chess.deadline?.(loaded), T0 + 9_999_999 + FIVE_MINUTES);
});
