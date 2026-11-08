import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseGameState } from '../../../shared/seating.ts';
import { withRules } from '../../../server/testing.ts';
import { cellOf } from '../checkered.ts';
import { checkeredMove, startCheckered } from '../checkeredRules.ts';
import { MID_FORK, ROAD } from '../road.ts';
import { roadMove, startRoad } from '../roadRules.ts';
import type { GameState, Move, RoadPhase, RoadPlayer } from '../types.ts';
import { describeMove } from './describeMove.ts';

// Spins 1, then low draws, so a shuffle offers the first two careers or houses
const ones = () => 0.05;

function table(board: 'road' | 'checkered'): GameState {
  const base: GameState = {
    ...baseGameState('g'), started: true, activePlayers: [1, 2], currentPlayer: 1, playerNames: { 1: 'Alice', 2: 'Bob' },
    houseRules: withRules({ board }), board, road: null, checkered: null, spin: null, lastMove: null
  };
  return board === 'road' ? startRoad(base) : startCheckered(base);
}

function atRoad(changes: Partial<RoadPlayer>, phase: RoadPhase = 'spin', offer: string[] = []): GameState {
  const state = table('road');
  const road = state.road!;
  return { ...state, road: { ...road, phase, offer, stepsLeft: phase === 'fork' ? 1 : 0, players: { ...road.players, 1: { ...road.players[1], ...changes } } } };
}

function play(state: GameState, move: Move): GameState {
  const result = (state.board === 'road' ? roadMove : checkeredMove)(state, 1, move, ones);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

test('a route choice', () => {
  assert.equal(describeMove(play(table('road'), { type: 'route', choice: 'college' })), 'Alice chose college. Alice took 2 loans of $20,000');
  assert.equal(describeMove(play(table('road'), { type: 'route', choice: 'work' })), 'Alice went straight to work');
});

test('a spin and everything it led to, the event text without its period', () => {
  const kitchen = ROAD.findIndex(s => s.text === 'A pipe bursts in the kitchen.');
  const state = play(atRoad({ space: kitchen - 1, cash: 100 }), { type: 'spin' });
  assert.equal(describeMove(state), 'Alice spun 1. Alice landed on an event: A pipe bursts in the kitchen (-$1,500). Alice took 1 loan of $20,000');
});

test('a fork, a career and a house', () => {
  const fork = play(atRoad({ space: MID_FORK.space, career: 'chef' }, 'fork'), { type: 'fork', road: 'fast' });
  assert.ok(describeMove(fork).startsWith('Alice took the fast lane. Alice '));
  assert.equal(describeMove(play(atRoad({}, 'career', ['chef']), { type: 'career', pick: 'chef' })), 'Alice became a Chef');
  assert.equal(describeMove(play(atRoad({}, 'career', ['electrician']), { type: 'career', pick: 'electrician' })), 'Alice became an Electrician');
  assert.equal(describeMove(play(atRoad({ career: 'chef' }, 'career', ['nurse']), { type: 'career', pick: null })), 'Alice kept their career');
  assert.equal(describeMove(play(atRoad({ cash: 50000 }, 'house', ['cabin']), { type: 'buyHouse', pick: 'cabin' })),
    'Alice bought the Lake Cabin for $40,000');
  assert.equal(describeMove(play(atRoad({}, 'house', ['cabin']), { type: 'buyHouse', pick: null })), 'Alice passed on the houses');
});

test('a step on the 1860 board, sent on once', () => {
  const state = table('checkered');
  const choosing = { ...state, checkered: { ...state.checkered!, phase: 'choose' as const, options: [cellOf('Bravery')] } };
  assert.equal(describeMove(play(choosing, { type: 'step', to: cellOf('Bravery') })), 'Alice landed on Bravery. Alice went on to Honor');
  assert.equal(describeMove(play(table('checkered'), { type: 'spin' })), 'Alice spun 1. Alice landed on Poverty');
});

test('a state without a move has no description', () => {
  assert.equal(describeMove({ lastMove: null, playerNames: {} }), '');
});
