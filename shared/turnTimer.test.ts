import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampTurn, turnTimeLeft } from './turnTimer.ts';
import { withRules } from '../server/testing.ts';
import type { BaseGameState } from './types.ts';

function stateWith(seconds: number, extra: Partial<BaseGameState> = {}): BaseGameState {
  return {
    gameId: 'g', started: true, currentPlayer: 1, activePlayers: [1, 2], playerNames: { 1: 'A', 2: 'B' },
    gameStatus: '', isGameOver: false, winners: [], undoVote: null, disconnected: [], dismissVote: null,
    houseRules: withRules({ turnTimer: seconds }), ...extra
  };
}

const vote = { requester: 1, votes: {} } as unknown as BaseGameState['undoVote'];

test('a new current player starts a fresh turn', () => {
  const out = stampTurn(stateWith(60, { currentPlayer: 2, turnStartedAt: 1000 }), 1, true, 5000);
  assert.equal(out.state.turnStartedAt, 5000);
  assert.equal(out.clockSeat, 2);
});

test('the same player moving again keeps their clock', () => {
  const out = stampTurn(stateWith(60, { turnStartedAt: 1000 }), 1, true, 5000);
  assert.equal(out.state.turnStartedAt, 1000);
});

test('a vote pauses the clock and closing it resumes from where it was', () => {
  const running = stateWith(60, { turnStartedAt: 1000 });
  const paused = stampTurn({ ...running, undoVote: vote }, 1, true, 5000).state;
  assert.equal(paused.turnPausedAt, 5000);
  const resumed = stampTurn({ ...paused, undoVote: null }, 1, true, 9000).state;
  assert.equal(resumed.turnStartedAt, 5000);
  assert.equal(resumed.turnPausedAt, null);
  assert.equal(turnTimeLeft(resumed, 9000), turnTimeLeft(paused, 5000));
});

test('time left goes negative in overtime and freezes while paused', () => {
  assert.equal(turnTimeLeft(stateWith(30, { turnStartedAt: 0 }), 42_000), -12_000);
  assert.equal(turnTimeLeft(stateWith(30, { turnStartedAt: 0, turnPausedAt: 10_000 }), 99_000), 20_000);
});

test('off or not running clears the stamp and adds no keys', () => {
  const off = stateWith(0);
  assert.equal(stampTurn(off, null, false, 5000).state, off);
  const out = stampTurn(stateWith(60, { turnStartedAt: 1000, turnPausedAt: 2000 }), 1, false, 5000);
  assert.equal(out.state.turnStartedAt, null);
  assert.equal(out.state.turnPausedAt, null);
  assert.equal(out.clockSeat, null);
});
