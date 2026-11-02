import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { fileOf, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { chinesecheckers } from './index.ts';
import { POINT_HOLES, holeKey, neighbors, parseHole } from './board.ts';
import { nextLandings } from './rules.ts';
import type { GameState, Hole, Move, PublicGameState, Result, Seat } from './types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'chinesecheckers/g1';

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([chinesecheckers], seeded(1)));
  for (const name of names) manager.join('chinesecheckers', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to this game's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager): PublicGameState {
  const state = manager.getState(ROOM, null);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

function rawOf(manager: Manager): GameState {
  return manager.rawState(ROOM) as GameState;
}

const move = (...path: Hole[]): Move => ({ type: 'move', path });

// Some legal single step for the seat
function aStep(state: GameState, seat: Seat): Move {
  for (const [key, owner] of Object.entries(state.holes)) {
    if (owner !== seat) continue;
    const from = parseHole(key);
    const [to] = nextLandings(state, [from]);
    if (to) return move(from, to);
  }
  return assert.fail('no move');
}

// Swaps the board for a crafted one, keeping everything else
function setHoles(manager: Manager, holes: Record<string, Seat>): void {
  assert.equal(manager.replaceState(ROOM, { ...rawOf(manager), holes } as GameState), true);
}

test('moves are validated and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.equal(manager.getState(ROOM)?.undoAvailable, false);
  assert.deepEqual(manager.move(ROOM, 2, aStep(rawOf(manager), 2)), { error: 'Not your turn' });
  const state = ok(manager.move(ROOM, 1, aStep(rawOf(manager), 1)));
  assert.equal(state.undoAvailable, true);
  assert.equal(state.currentPlayer, 2);
});

test('a chain of hops is one move and undo restores it', () => {
  const manager = gameWith('A', 'B');
  const holes = { ...rawOf(manager).holes };
  const [lifted] = Object.keys(holes).filter(key => holes[key] === 1);
  delete holes[lifted];
  Object.assign(holes, { '0,0': 1, '1,0': 2, '3,0': 2 });
  setHoles(manager, holes);

  const chained = ok(manager.move(ROOM, 1, move({ q: 0, r: 0 }, { q: 2, r: 0 }, { q: 4, r: 0 })));
  assert.equal(chained.holes['4,0'], 1);
  assert.equal(chained.holes['0,0'], undefined);

  ok(manager.requestUndo(ROOM, 2));
  const restored = ok(manager.voteUndo(ROOM, 1, true));
  assert.deepEqual(restored.holes, holes);
  assert.equal(restored.currentPlayer, 1);
});

test('a seventh player cannot join', () => {
  const manager = gameWith('A', 'B', 'C', 'D', 'E', 'F');
  assert.deepEqual(manager.join('chinesecheckers', 'g1', 'G'), { error: 'Game is full' });
});

test('five seated players cannot start', () => {
  const manager = gameWith('A', 'B', 'C', 'D', 'E');
  assert.deepEqual(manager.move(ROOM, 1, move({ q: 0, r: 5 }, { q: 0, r: 4 })), { error: 'Chinese Checkers needs 2, 3, 4 or 6 players' });
});

// Seat 1 plays one step, then the given seat drops out by a vote of the others
function dismissAfterAMove(manager: Manager, leaver: Seat, voters: Seat[]): PublicGameState {
  ok(manager.move(ROOM, 1, aStep(rawOf(manager), 1)));
  manager.disconnect(ROOM, leaver);
  ok(manager.requestDismiss(ROOM, 1, leaver));
  let state = viewOf(manager);
  for (const voter of voters) state = ok(manager.voteDismiss(ROOM, voter, true));
  return state;
}

test('dismissing a player mid-game removes their marbles and play goes on', () => {
  const manager = gameWith('A', 'B', 'C');
  const state = dismissAfterAMove(manager, 3, [2]);
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(Object.values(state.holes).includes(3), false);
  assert.equal(state.isGameOver, false);
});

test('a 6-player game that loses one player plays on with five', () => {
  const manager = gameWith('A', 'B', 'C', 'D', 'E', 'F');
  const state = dismissAfterAMove(manager, 6, [2, 3, 4, 5]);
  assert.deepEqual(state.activePlayers, [1, 2, 3, 4, 5]);
  assert.equal(state.isGameOver, false);
  assert.equal(state.currentPlayer, 2);
  const after = ok(manager.move(ROOM, 2, aStep(rawOf(manager), 2)));
  assert.equal(after.currentPlayer, 3);
});

test('a played-out game builds its history and game file', () => {
  const manager = gameWith('A', 'B');
  // Seat 1's target is full but for one hole, with a marble of theirs one step away
  const target = POINT_HOLES[3];
  const gap = target.find(hole => hole.r === -5) as Hole;
  const from = neighbors(gap).find(hole => !target.some(inTarget => holeKey(inTarget) === holeKey(hole))) as Hole;
  const holes: Record<string, Seat> = {};
  for (const hole of target) if (holeKey(hole) !== holeKey(gap)) holes[holeKey(hole)] = 1;
  holes[holeKey(from)] = 1;
  for (const hole of POINT_HOLES[0]) holes[holeKey(hole)] = 2;
  setHoles(manager, holes);

  const done = ok(manager.move(ROOM, 1, move(from, gap)));
  assert.equal(done.isGameOver, true);
  const standings = manager.getState(ROOM)?.standings;
  assert.equal(standings?.[0].seat, 1);
  assert.ok(stepsOf(manager, 'chinesecheckers')?.length);
  assert.ok('file' in (fileOf(manager, 'chinesecheckers', new Date()) ?? {}));
});
