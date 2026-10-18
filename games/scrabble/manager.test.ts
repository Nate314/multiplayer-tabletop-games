import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { scrabble } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Result, Seat } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'scrabble/g1';

// Always draws the first tile left in the bag: Player 1 gets AAAAAAA and Player 2 AABBCCD
const first = () => 0;

// The first word, through the center, and a word down from its A that Player 2 can make next
const FIRST_WORD: Move = { type: 'play', tiles: [{ row: 7, col: 7, letter: 'A' }, { row: 7, col: 8, letter: 'A' }] };
const SECOND_WORD: Move = { type: 'play', tiles: [{ row: 8, col: 7, letter: 'B' }] };

function gameWith(...names: string[]): Manager {
  const manager = createGameManager([scrabble], first);
  for (const name of names) manager.join('scrabble', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Scrabble's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: Seat | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

test('each player sees only their own rack, and the bag only as a count', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, FIRST_WORD));

  const mine = viewOf(manager, 1);
  const theirs = viewOf(manager, 2);
  assert.deepEqual(mine.rack, ['A', 'A', 'A', 'A', 'A', 'D', 'D']);
  assert.deepEqual(theirs.rack, ['A', 'A', 'B', 'B', 'C', 'C', 'D']);
  assert.deepEqual(mine.rackCounts, { 1: 7, 2: 7 });
  assert.equal(mine.bagCount, 84);
  for (const view of [mine, theirs]) {
    assert.equal('racks' in view, false);
    assert.equal('bag' in view, false);
  }
});

test('the history shows no rack', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, FIRST_WORD));
  ok(manager.move(ROOM, 2, SECOND_WORD));
  const steps = manager.history('scrabble', 'g1') as unknown as PublicGameState[] | null;
  assert.equal(steps?.length, 3);
  for (const step of steps ?? []) {
    assert.deepEqual(step.rack, []);
    assert.equal('racks' in step, false);
    assert.equal('bag' in step, false);
  }
  assert.deepEqual(steps?.[2].lastMove, {
    type: 'play', playerNumber: 2, tiles: [{ row: 8, col: 7, letter: 'B', blank: false }],
    words: [{ word: 'AB', points: 4 }], bingo: false, points: 4
  });
});

test('moves are validated', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.move(ROOM, 2, FIRST_WORD), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, 1, { type: 'nonsense' }), { error: 'Invalid move' });
  assert.deepEqual(manager.move(ROOM, 1, SECOND_WORD), { error: 'You do not have those tiles' });
  const state = ok(manager.move(ROOM, 1, FIRST_WORD));
  assert.equal(state.started, true);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.scores, { 1: 4, 2: 0 });
});

test('an undo takes the word off the board and gives the tiles back', () => {
  const manager = gameWith('A', 'B');
  const before = viewOf(manager, 1);
  ok(manager.move(ROOM, 1, FIRST_WORD));
  ok(manager.requestUndo(ROOM, 2));
  const restored = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(restored.board[7][7], null);
  assert.deepEqual(restored.rack, before.rack);
  assert.equal(restored.bagCount, 86);
  assert.equal(restored.currentPlayer, 1);
});

test('a dismissed player puts their tiles back in the bag', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, FIRST_WORD));
  const bagBefore = viewOf(manager, 1).bagCount;
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  const state = ok(manager.voteDismiss(ROOM, 2, true));
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(state.bagCount, bagBefore + 7);
  assert.deepEqual(state.rackCounts, { 1: 7, 2: 7 });
});
