import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, boardResult, boardResults, moveSummary, playableBoards } from './rules.ts';
import { ultimatetictactoe } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Cells } from '../tictactoe/lines.ts';
import type { GameState, Seat } from './types.ts';

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(...names: string[]): GameState {
  let state = ultimatetictactoe.createGameState('g1');
  for (const name of names) state = seated(addPlayer(ultimatetictactoe, state, name)).state;
  return state;
}

function place(state: GameState, seat: Seat, board: number, cell: number): GameState {
  const result = applyMove(ultimatetictactoe, state, seat, { type: 'place', board, cell });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = applyAction(state, seat, action);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Nine boards from strings of nine characters each: '.', '1' and '2'. Missing boards are empty.
function boardsOf(...boards: string[]): Cells[] {
  return Array.from({ length: 9 }, (_, i) =>
    [...(boards[i] ?? '.........')].map(cell => cell === '.' ? null : Number(cell) as Seat));
}

const EMPTY = '.........';
const WON_BY_1 = '111......';
const WON_BY_2 = '222......';
const FULL_DRAWN = '121212212';

function withBoards(boards: Cells[], extra: Partial<GameState> = {}): GameState {
  return { ...lobby('Alice', 'Bob'), boards, ...extra };
}

test('nine empty boards, X to move anywhere', () => {
  const state = lobby('Alice', 'Bob');
  assert.equal(state.boards.length, 9);
  assert.ok(state.boards.every(cells => cells.length === 9 && cells.every(cell => cell === null)));
  assert.equal(state.forcedBoard, null);
  assert.equal(playableBoards(state).length, 9);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.xSeat, 1);
  assert.equal(ultimatetictactoe.createGameState('g1').xSeat, 1);
});

test('boardResult says who holds a board, with a line beating full', () => {
  assert.equal(boardResult(boardsOf(WON_BY_1)[0]), 1);
  assert.equal(boardResult(boardsOf(FULL_DRAWN)[0]), 'draw');
  assert.equal(boardResult(boardsOf(EMPTY)[0]), null);
  assert.equal(boardResult(boardsOf('111222121')[0]), 1);
  assert.deepEqual(boardResults(withBoards(boardsOf(WON_BY_1, FULL_DRAWN))).slice(0, 3), [1, 'draw', null]);
});

test('the cell played sends the opponent to the matching board', () => {
  const state = place(lobby('Alice', 'Bob'), 1, 4, 2);
  assert.equal(state.forcedBoard, 2);
  assert.deepEqual(playableBoards(state), [2]);
  assert.deepEqual(state.lastMove, { playerNumber: 1, board: 4, cell: 2, claimed: false });
  assert.equal(state.gameStatus, 'Alice placed X in the top right of the center board');
  assert.deepEqual(applyMove(ultimatetictactoe, state, 2, { type: 'place', board: 5, cell: 0 }), { error: 'Play in the highlighted board' });
  const next = place(state, 2, 2, 7);
  assert.equal(next.forcedBoard, 7);
  assert.equal(next.gameStatus, 'Bob placed O in the bottom middle of the top right board');
});

test('sent to a won board, the player may play in any open board', () => {
  const state = withBoards(boardsOf(EMPTY, EMPTY, WON_BY_1), { currentPlayer: 1 });
  const sent = place(state, 1, 4, 2);
  assert.equal(sent.forcedBoard, null);
  assert.equal(playableBoards(sent).length, 8);
  assert.ok(!playableBoards(sent).includes(2));
  assert.equal(place(sent, 2, 5, 0).boards[5][0], 2);
});

test('sent to a full board, the player may play in any open board', () => {
  const state = withBoards(boardsOf(EMPTY, EMPTY, FULL_DRAWN), { currentPlayer: 1 });
  const sent = place(state, 1, 4, 2);
  assert.equal(sent.forcedBoard, null);
  assert.equal(place(sent, 2, 0, 0).boards[0][0], 2);
});

test('a won board takes no more marks, even on a free choice', () => {
  // Board 2 is won by seat 1 but still has empty cells; seat 1 sends seat 2 there
  const state = withBoards(boardsOf(EMPTY, EMPTY, WON_BY_1), { currentPlayer: 1 });
  const sent = place(state, 1, 4, 2);
  assert.equal(sent.forcedBoard, null);
  assert.deepEqual(applyMove(ultimatetictactoe, sent, 2, { type: 'place', board: 2, cell: 5 }), { error: 'That board is decided' });
  const full = withBoards(boardsOf(EMPTY, EMPTY, FULL_DRAWN));
  assert.deepEqual(applyMove(ultimatetictactoe, full, 1, { type: 'place', board: 2, cell: 5 }), { error: 'That board is decided' });
});

test('a taken cell is refused', () => {
  const state = place(lobby('Alice', 'Bob'), 1, 4, 4);
  assert.deepEqual(applyMove(ultimatetictactoe, state, 2, { type: 'place', board: 4, cell: 4 }), { error: 'That cell is taken' });
});

test('three in a row in a small board claims it', () => {
  const state = withBoards(boardsOf('11.......'), { currentPlayer: 1 });
  const claimed = place(state, 1, 0, 2);
  assert.equal(claimed.lastMove?.claimed, true);
  assert.ok(claimed.gameStatus.endsWith(' and claimed it'));
  assert.equal(claimed.gameStatus, 'Alice placed X in the top right of the top left board and claimed it');
  assert.equal(claimed.isGameOver, false);
  assert.equal(claimed.forcedBoard, 2);
  assert.equal(moveSummary('Alice', 'X', 4, 0, true), 'Alice placed X in the top left of the center board and claimed it');
  assert.equal(moveSummary('Alice', 'X', 4, 0, false), 'Alice placed X in the top left of the center board');
});

test('three claimed boards in a row win', () => {
  const state = withBoards(boardsOf(WON_BY_1, EMPTY, EMPTY, EMPTY, WON_BY_1, EMPTY, EMPTY, EMPTY, '11.......'), { currentPlayer: 1, forcedBoard: 8 });
  const won = place(state, 1, 8, 2);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.deepEqual(won.winningLine, [0, 4, 8]);
  assert.equal(won.gameStatus, 'Alice wins with three boards in a row!');
  assert.equal(won.currentPlayer, null);
});

test('a drawn small board counts for nobody', () => {
  // Boards 0 and 4 are X's and board 8 ends drawn: no line of three claimed boards
  const state = withBoards(boardsOf(WON_BY_1, EMPTY, EMPTY, EMPTY, WON_BY_1, EMPTY, EMPTY, EMPTY, '12112221.'), { currentPlayer: 1, forcedBoard: 8 });
  const next = place(state, 1, 8, 8);
  assert.equal(boardResult(next.boards[8]), 'draw');
  assert.equal(next.isGameOver, false);
  assert.equal(next.winningLine, null);
  assert.equal(next.lastMove?.claimed, false);
  assert.equal(next.forcedBoard, null);
});

test('every board decided with no line is a draw', () => {
  // X holds 0, 2, 3, 7; O holds 1, 4, 5, 6; board 8 ends drawn. No line of claimed boards.
  const boards = boardsOf(WON_BY_1, WON_BY_2, WON_BY_1, WON_BY_1, WON_BY_2, WON_BY_2, WON_BY_2, WON_BY_1, '12112221.');
  const state = withBoards(boards, { currentPlayer: 1, forcedBoard: 8 });
  const drawn = place(state, 1, 8, 8);
  assert.equal(drawn.isGameOver, true);
  assert.deepEqual(drawn.winners, []);
  assert.equal(drawn.winningLine, null);
  assert.equal(drawn.gameStatus, 'Every board is decided with no line. Draw.');
});

test('a mark that claims the last open board and makes a line is a win, not a draw', () => {
  // Boards 0 and 1 are X's; board 2 is the last open board and X claims it, making the top row.
  // Before the move no line exists for either seat, and the top row is the only line after it.
  const boards = boardsOf(WON_BY_1, WON_BY_1, '11.......', WON_BY_2, WON_BY_2, WON_BY_1, WON_BY_1, FULL_DRAWN, WON_BY_2);
  const state = withBoards(boards, { currentPlayer: 1, forcedBoard: 2 });
  const won = place(state, 1, 2, 2);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.deepEqual(won.winningLine, [0, 1, 2]);
  assert.equal(won.gameStatus, 'Alice wins with three boards in a row!');
});

test('bad payloads are refused and change nothing', () => {
  const state = lobby('Alice', 'Bob');
  const refused = (move: unknown) => applyMove(ultimatetictactoe, state, 1, move);
  assert.deepEqual(refused({ type: 'drop', board: 0, cell: 0 }), { error: 'Unknown move type' });
  assert.deepEqual(refused(null), { error: 'Unknown move type' });
  for (const board of ['4', 4.5, -1, 9, undefined, null, NaN]) {
    assert.deepEqual(refused({ type: 'place', board, cell: 0 }), { error: 'Invalid board' });
  }
  assert.deepEqual(refused({ type: 'place', cell: 0 }), { error: 'Invalid board' });
  for (const cell of ['4', 4.5, -1, 9, undefined, null, NaN]) {
    assert.deepEqual(refused({ type: 'place', board: 4, cell }), { error: 'Invalid cell' });
  }
  assert.deepEqual(refused({ type: 'place', board: 4 }), { error: 'Invalid cell' });
  assert.deepEqual(state, lobby('Alice', 'Bob'));
});

test('resign and draw by agreement end the game', () => {
  const state = place(lobby('Alice', 'Bob'), 1, 4, 4);
  const resigned = act(state, 1, { type: 'resign' });
  assert.equal(resigned.isGameOver, true);
  assert.deepEqual(resigned.winners, [2]);

  const offered = act(state, 1, { type: 'offerDraw' });
  assert.deepEqual(ultimatetictactoe.waitingOn?.(offered), [2]);
  const agreed = act(offered, 2, { type: 'answerDraw', accept: true });
  assert.equal(agreed.isGameOver, true);
  assert.deepEqual(agreed.winners, []);

  // A move by the opponent declines the offer
  assert.equal(place(offered, 2, 4, 0).drawOffer, null);
});

test('exactly two players can sit; a dismissed player mid-game leaves the other the winner', () => {
  let state = lobby('Alice', 'Bob');
  assert.deepEqual(addPlayer(ultimatetictactoe, state, 'Cy'), { error: 'Game is full' });
  state = place(state, 1, 4, 4);
  state = removePlayer(ultimatetictactoe, state, 2);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

test('in game 2 seat 2 plays X and moves first', () => {
  let state: GameState = { ...ultimatetictactoe.createGameState('g1'), gameNumber: 2 };
  for (const name of ['Alice', 'Bob']) state = seated(addPlayer(ultimatetictactoe, state, name)).state;
  assert.equal(state.xSeat, 2);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(applyMove(ultimatetictactoe, state, 1, { type: 'place', board: 0, cell: 0 }), { error: 'Not your turn' });
  const moved = place(state, 2, 0, 0);
  assert.equal(moved.gameStatus, 'Bob placed X in the top left of the top left board');
});
