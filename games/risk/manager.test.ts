import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { isSet } from './cards.ts';
import { NEIGHBORS } from './map.ts';
import { territoriesHeld } from './state.ts';
import { risk } from './index.ts';
import type { Card, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'risk/g1';

// The same rolls on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(seed: number, ...names: string[]): Manager {
  const manager = createGameManager([risk], seeded(seed));
  for (const name of names) manager.join('risk', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Risk's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null = null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

function firstSet(hand: Card[]): Card[] | null {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) if (isSet([hand[i], hand[j], hand[k]])) return [hand[i], hand[j], hand[k]];
    }
  }
  return null;
}

// A simple player: trades a set whenever it holds one, piles every army on its strongest border territory,
// blitzes the weakest neighbour while it has the most armies there, moves everything in, and ends the turn
function step(manager: Manager): PublicGameState {
  const state = viewOf(manager);
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  const send = (move: unknown) => ok(manager.move(ROOM, seat, move));
  const mine = territoriesHeld(state, seat);
  const enemies = (id: string) => NEIGHBORS[id].filter(neighbor => state.owners[neighbor] !== seat);
  const front = mine.filter(id => enemies(id).length > 0).sort((a, b) => state.armies[b] - state.armies[a])[0];
  switch (state.phase) {
    case 'setup':
      return send({ type: 'place', placements: { [front]: state.setupLeft[seat] } });
    case 'reinforce': {
      const hand = viewOf(manager, seat).hand ?? [];
      const set = firstSet(hand);
      if (set && (!state.midTurnTrade || hand.length >= 5)) return send({ type: 'trade', cards: set });
      return send({ type: 'place', placements: { [front]: state.reinforcements } });
    }
    case 'conquer': {
      const { from } = state.conquest ?? assert.fail('no conquest');
      return send({ type: 'occupy', armies: state.armies[from] - 1 });
    }
    default: {
      const target = enemies(front).sort((a, b) => state.armies[a] - state.armies[b])[0];
      if (state.phase === 'attack' && state.armies[front] > state.armies[target] + 1) return send({ type: 'blitz', from: front, to: target });
      return send({ type: 'endTurn' });
    }
  }
}

test('a seeded game plays to a world conqueror, and no step shows a hand or the deck', () => {
  const manager = gameWith(7, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; !state.isGameOver && moves < 5000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
  assert.equal(territoriesHeld(state, state.winners[0]).length, 42);
  assert.equal(state.eliminated.length, 2);

  const steps = manager.history('risk', 'g1') ?? assert.fail('no history');
  assert.ok(steps.length > 20);
  for (const past of steps) {
    assert.equal('hands' in past, false);
    assert.equal('deck' in past, false);
    assert.equal((past as unknown as PublicGameState).hand, null);
  }
  const file = manager.gameFile('risk', 'g1', new Date());
  if (!file || !('file' in file)) assert.fail('no game file');
  const last = file.file.steps.at(-1) as unknown as PublicGameState & { views: Record<string, PublicGameState> };
  assert.equal(last.hand, null);
  const winner = state.winners[0];
  assert.deepEqual(last.views[winner].hand?.length, last.handCounts[winner]);
});

test('a rejoin mid-turn shows the same captured territory waiting to be moved into', () => {
  const manager = gameWith(3, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; state.phase !== 'conquer' && moves < 500; moves++) state = step(manager);
  const conquest = state.conquest ?? assert.fail('nobody captured anything');
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  manager.disconnect(ROOM, seat);
  const rejoined = manager.join('risk', 'g1', state.playerNames[seat], true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(view.phase, 'conquer');
  assert.deepEqual(view.conquest, conquest);
  assert.equal(view.currentPlayer, seat);
  ok(manager.move(ROOM, seat, { type: 'occupy', armies: conquest.minimum }));
  assert.equal(viewOf(manager).armies[conquest.to], conquest.minimum);
});

test('undo takes back an attack and its dice', () => {
  const manager = gameWith(5, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; state.phase !== 'attack' && moves < 50; moves++) state = step(manager);
  const before = state;
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  state = step(manager);
  assert.notEqual(state.moveCount, before.moveCount);
  ok(manager.requestUndo(ROOM, seat));
  for (const voter of [1, 2, 3].filter(other => other !== seat)) state = ok(manager.voteUndo(ROOM, voter, true));
  assert.deepEqual(state.armies, before.armies);
  assert.deepEqual(state.owners, before.owners);
  assert.equal(state.phase, 'attack');
});

test('dismissing the player whose turn it is leaves their territories neutral and moves the turn on', () => {
  const manager = gameWith(11, 'A', 'B', 'C', 'D');
  let state = viewOf(manager);
  for (let moves = 0; state.phase === 'setup' && moves < 10; moves++) state = step(manager);
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  const theirs = territoriesHeld(state, seat);
  manager.disconnect(ROOM, seat);
  const voters = [1, 2, 3, 4].filter(other => other !== seat);
  ok(manager.requestDismiss(ROOM, voters[0], seat));
  for (const voter of voters.slice(1)) state = ok(manager.voteDismiss(ROOM, voter, true));
  assert.equal(state.activePlayers.includes(seat), false);
  assert.notEqual(state.currentPlayer, seat);
  assert.equal(state.phase, 'reinforce');
  assert.ok(theirs.every(id => state.owners[id] === null));
  assert.equal(state.handCounts[seat], 0);
  // the game goes on
  state = step(manager);
  assert.equal(state.isGameOver, false);
});
