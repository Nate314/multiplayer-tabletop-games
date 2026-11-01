import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { jigsaw } from './index.ts';
import { gridOf, homeOf } from './cut.ts';
import type { GameState, Seat } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'jigsaw/g1';

function table(names: string[]) {
  const manager = rememberingKeys(createGameManager([jigsaw], seeded(1)));
  for (const name of names) manager.join('jigsaw', 'g1', name);
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  const moves = () => manager.getState(ROOM, 1)?.moveCount;
  const snap = (seat: Seat, piece: number) => {
    const { x, y } = homeOf(gridOf(raw().count), piece);
    ok(manager.action(ROOM, seat, { type: 'pickUp', piece }));
    ok(manager.action(ROOM, seat, { type: 'drop', piece, x, y }));
  };
  return { manager, raw, moves, snap };
}

function ok(result: Result<unknown>): void {
  if ('error' in result) assert.fail(result.error);
}

test('one player plays Solo, snaps and undoes at once', () => {
  const { manager, raw, moves, snap } = table(['Alice']);
  assert.equal(raw().houseRules?.values.mode, 'solo');
  const move = (piece: number, x: number, y: number) => {
    ok(manager.action(ROOM, 1, { type: 'pickUp', piece }));
    ok(manager.action(ROOM, 1, { type: 'drop', piece, x, y }));
  };
  move(10, 10, 1400); // before the snap: stays
  const lifted = { ...raw().board.pieces[4] };
  const before11 = { ...raw().board.pieces[11] };
  snap(1, 4);
  move(11, 20, 1400); // after the snap: goes back
  ok(manager.action(ROOM, 1, { type: 'pickUp', piece: 6 }));
  assert.equal(moves(), 1);
  ok(manager.requestUndo(ROOM, 1));
  assert.equal(moves(), 0);
  assert.equal(raw().undoVote, null);
  const pieces = raw().board.pieces;
  assert.deepEqual([pieces[10].x, pieces[10].y], [10, 1400]);
  assert.deepEqual([pieces[11].x, pieces[11].y], [before11.x, before11.y]);
  assert.deepEqual(pieces[4], { ...lifted, heldBy: null });
  assert.equal(pieces[4].placed, false);
  assert.ok(pieces.every(piece => piece.heldBy === null));
});

test('Together keeps going when one player leaves', () => {
  const { manager, raw, snap } = table(['Alice', 'Bob']);
  assert.equal(raw().houseRules?.values.mode, 'together');
  assert.ok('error' in manager.requestUndo(ROOM, 1));
  ok(manager.action(ROOM, 2, { type: 'pickUp', piece: 0 }));
  manager.disconnect(ROOM, 2);
  assert.equal(raw().board.pieces[0].heldBy, null);
  ok(manager.requestDismiss(ROOM, 1, 2));
  assert.deepEqual(raw().activePlayers, [1]);
  assert.equal(raw().isGameOver, false);
  for (let piece = 0; piece < raw().count; piece++) snap(1, piece);
  assert.equal(raw().isGameOver, true);
  assert.deepEqual(raw().winners, [1]);
});

test('only snaps add to moveCount', () => {
  const { manager, raw, moves, snap } = table(['Alice', 'Bob']);
  for (let i = 0; i < 10; i++) {
    ok(manager.action(ROOM, 1, { type: 'pickUp', piece: i }));
    ok(manager.action(ROOM, 1, { type: 'drop', piece: i, x: 1900 - i, y: 1700 }));
  }
  assert.equal(moves(), 0);
  assert.equal(raw().started, true);
  snap(2, 3);
  assert.equal(moves(), 1);
});

test('own-move undo is recorded as a step', () => {
  const { manager, raw, moves, snap } = table(['Alice', 'Bob']);
  snap(1, 2);
  assert.equal(moves(), 1);
  ok(manager.undoOwn(ROOM, 1));
  assert.equal(moves(), 2);
  assert.equal(raw().board.pieces[2].placed, false);
  assert.deepEqual(manager.undoOwn(ROOM, 1), { error: 'Nothing of yours to undo' });
});
