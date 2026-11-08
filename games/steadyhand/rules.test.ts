import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import type { Seat } from '../../shared/types.ts';
import { PARTS } from './board.ts';
import {
  applyAction, applyMove, buzzesLeft, createGameState, finalStandings, inSlot, onPlayerDisconnected, onPlayerLeft, resetLobby, resumeClock
} from './rules.ts';
import type { GameState, Point } from './types.ts';

const NAMES = ['Alice', 'Bob', 'Cara'];

// A table of `seats` players with the given Buzzes rule, everyone agreed
function table(seats = 2, buzzes: 0 | 1 | 3 | 5 = 3): GameState {
  const activePlayers = Array.from({ length: seats }, (_, i) => i + 1);
  const state: GameState = {
    ...createGameState('g1'),
    activePlayers,
    playerNames: Object.fromEntries(activePlayers.map(s => [s, NAMES[s - 1]])),
    currentPlayer: 1,
    houseRules: { ...withRules({ buzzes, tolerance: 'normal' }), agreed: activePlayers }
  };
  return resetLobby(state);
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = applyAction(state, seat, action);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function move(state: GameState, seat: Seat, m: unknown): GameState {
  const result = applyMove(state, seat, m);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const refusal = (result: { error: string } | { state: GameState }) => 'error' in result ? result.error : 'accepted';
const AT: Point = [500, 300];
const buzz = (state: GameState, seat: Seat, part = 4) => move(state, seat, { type: 'buzz', part, at: AT });
const out = (state: GameState, seat: Seat, part: number) => move(state, seat, { type: 'out', part });

test('pick, drag and drop move only the live part and change no score', () => {
  let state = act(table(), 1, { type: 'pick', part: 1 });
  assert.deepEqual(state.live, { seat: 1, part: 1, at: PARTS[1].path[0] });
  state = act(state, 1, { type: 'drag', at: [300, 200] });
  assert.deepEqual(state.live, { seat: 1, part: 1, at: [300, 200] });
  state = act(state, 1, { type: 'drop' });
  assert.equal(state.live, null);
  assert.deepEqual(state.scores, { 1: 0, 2: 0 });
  assert.deepEqual(state.buzzes, { 1: 0, 2: 0 });
  assert.deepEqual(inSlot(state), PARTS.map(p => p.id));
  assert.equal(state.currentPlayer, 1);
});

test('drag from anyone but the dragger is refused', () => {
  const held = act(table(), 1, { type: 'pick', part: 1 });
  assert.equal(refusal(applyAction(held, 2, { type: 'drag', at: [300, 200] })), 'Not your turn');
  assert.equal(refusal(applyAction(held, 2, { type: 'pick', part: 2 })), 'Not your turn');
  const passed = buzz(held, 1, 1);
  assert.equal(passed.live, null);
  assert.equal(refusal(applyAction(passed, 1, { type: 'drag', at: [300, 200] })), 'Not your turn');
  // Bob's own turn: a late drag from him before he picks moves nothing either
  assert.equal(refusal(applyAction(passed, 2, { type: 'drag', at: [300, 200] })), 'You are not holding a part');
  for (const at of [[NaN, 200], [300, Infinity], [-1, 200], [1001, 200], [300, 641], [300], 'x', [300, '200']]) {
    assert.equal(refusal(applyAction(held, 1, { type: 'drag', at })), 'Invalid position', JSON.stringify(at));
  }
  assert.deepEqual(held.live?.at, PARTS[1].path[0]);
});

test('bringing a part out scores its value and passes the turn', () => {
  const state = out(act(table(), 1, { type: 'pick', part: 1 }), 1, 1);
  assert.equal(state.scores[1], 15);
  assert.equal(state.outBy[1], 1);
  assert.equal(state.live, null);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.lastMove, { type: 'out', playerNumber: 1, part: 1, value: 15 });
  assert.equal(state.gameStatus, 'Alice brought out the Gear for 15 points');
  assert.equal(refusal(applyMove(state, 2, { type: 'out', part: 1 })), 'That part is already out');
  assert.equal(refusal(applyAction(state, 2, { type: 'pick', part: 1 })), 'That part is already out');
});

test('a buzz uses one buzz, returns the part and passes the turn', () => {
  const state = buzz(act(table(), 1, { type: 'pick', part: 4 }), 1);
  assert.equal(state.buzzes[1], 1);
  assert.equal(buzzesLeft(state, 1), 2);
  assert.equal(state.scores[1], 0);
  assert.equal(state.live, null);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.lastMove, { type: 'buzz', playerNumber: 1, part: 4, at: AT });
  assert.equal(state.gameStatus, 'Alice buzzed on the Coil');
  assert.equal(refusal(applyMove(state, 2, { type: 'buzz', part: 4, at: [NaN, 1] })), 'Invalid position');
});

test('a buzzed part stays for anyone to try', () => {
  const state = buzz(table(), 1, 4);
  assert.ok(inSlot(state).includes(4));
  assert.equal(out(state, 2, 4).scores[2], 40);
});

test('a player out of buzzes is skipped; nobody left with buzzes ends the game', () => {
  let state = table(3, 1);
  state = buzz(state, 1);
  assert.equal(buzzesLeft(state, 1), 0);
  state = out(state, 2, 0);
  state = out(state, 3, 1);
  assert.equal(state.currentPlayer, 2, 'Alice is skipped');
  state = buzz(state, 2);
  assert.equal(state.currentPlayer, 3);
  state = buzz(state, 3);
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.winners, [3]);
  assert.equal(state.gameStatus, 'Cara wins with 15 points');
});

test('Unlimited never runs out', () => {
  let state = table(2, 0);
  for (let i = 0; i < 20; i++) state = buzz(state, state.currentPlayer!);
  assert.equal(state.isGameOver, false);
  assert.equal(buzzesLeft(state, 1), null);
  assert.equal(state.buzzes[1], 10);
});

test('the game ends when every part is out, highest score wins, ties share', () => {
  // Alice takes the even parts (8 + 26 + 40 + 12 + 32 = 118), Bob the odd ones (15 + 20 + 5 + 22 + 35 = 97)
  let state = table();
  for (const part of PARTS) state = out(state, state.currentPlayer!, part.id);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.scores, { 1: 118, 2: 97 });
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.gameStatus, 'Alice wins with 118 points');
  assert.deepEqual(finalStandings(state), [{ seat: 1, place: 1, score: '118 points' }, { seat: 2, place: 2, score: '97 points' }]);

  // Buzzes 1: Alice brings out the Spring (20), Bob the Bolt and the Servo (8 + 12)
  let tie = table(2, 1);
  tie = out(tie, 1, 3);
  tie = out(tie, 2, 0);
  tie = buzz(tie, 1);
  tie = out(tie, 2, 6);
  tie = buzz(tie, 2);
  assert.equal(tie.isGameOver, true);
  assert.deepEqual(tie.winners, [1, 2]);
  assert.equal(tie.gameStatus, 'Alice and Bob share the win with 20 points');
  assert.deepEqual(finalStandings(tie).map(s => s.place), [1, 1]);
});

test('solo: the bonus counts each buzz left after clearing the board', () => {
  let state = buzz(table(1, 3), 1);
  for (const part of PARTS) state = out(state, 1, part.id);
  assert.equal(state.isGameOver, true);
  assert.equal(state.scores[1], 215 + 20);
  assert.equal(state.gameStatus, 'Alice wins with 235 points');

  let unlimited = table(1, 0);
  for (const part of PARTS) unlimited = out(unlimited, 1, part.id);
  assert.equal(unlimited.scores[1], 215, 'no bonus under Unlimited');
});

test('resumeClock lets go of the part', () => {
  const held = act(act(table(), 1, { type: 'pick', part: 2 }), 1, { type: 'drag', at: [550, 200] });
  assert.equal(resumeClock(held).live, null);
  const idle = table();
  assert.equal(resumeClock(idle), idle);
});

test('a disconnect of the dragger lets go', () => {
  const held = act(table(), 1, { type: 'pick', part: 2 });
  assert.equal(onPlayerDisconnected(held, 2), held);
  assert.equal(onPlayerDisconnected(held, 1).live, null);
});

test('a player leaving mid-drag lets go and the turn moves to someone with buzzes', () => {
  // Buzzes 1, three seats: Bob has used his, Cara is dragging and leaves; the platform moves the turn on to Alice, who has none either
  let state = table(3, 1);
  state = buzz(state, 1);
  state = buzz(state, 2);
  state = act(state, 3, { type: 'pick', part: 0 });
  const left: GameState = { ...state, activePlayers: [1, 2], currentPlayer: 1 };
  const after = onPlayerLeft(left, 3);
  assert.equal(after.live, null);
  assert.equal(after.isGameOver, true, 'nobody left has buzzes');

  let longer = table(3, 3);
  longer = buzz(longer, 1); longer = buzz(longer, 2); longer = buzz(longer, 3);
  longer = buzz(longer, 1); longer = buzz(longer, 2); longer = buzz(longer, 3);
  longer = buzz(longer, 1); // Alice is out
  longer = act(longer, 2, { type: 'pick', part: 0 });
  const moved = onPlayerLeft({ ...longer, activePlayers: [1, 3], currentPlayer: 3 }, 2);
  assert.equal(moved.live, null);
  assert.equal(moved.currentPlayer, 3);
  const skipped = onPlayerLeft({ ...longer, activePlayers: [1, 3], currentPlayer: 1 }, 2);
  assert.equal(skipped.currentPlayer, 3, 'Alice has no buzzes left');
  assert.equal(skipped.isGameOver, false);
});

test('pick before everyone agreed is refused', () => {
  const state = table();
  const waiting: GameState = { ...state, houseRules: { ...state.houseRules!, agreed: [1] } };
  assert.equal(refusal(applyAction(waiting, 1, { type: 'pick', part: 0 })), 'Everyone must agree to the house rules first');
  assert.equal(refusal(applyAction({ ...waiting, started: true }, 1, { type: 'pick', part: 0 })), 'accepted');
});

test('live input waits on votes, but letting go does not', () => {
  const held = act(table(), 1, { type: 'pick', part: 0 });
  const undo = { ...held, undoVote: { requestedBy: 2, votes: {} } } as GameState;
  const dismiss = { ...held, dismissVote: { requestedBy: 2, target: 1, votes: {} } } as GameState;
  for (const voting of [undo, dismiss]) {
    assert.match(refusal(applyAction(voting, 1, { type: 'drag', at: [60, 200] })), /vote is in progress/);
    assert.match(refusal(applyAction({ ...voting, live: null }, 1, { type: 'pick', part: 0 })), /vote is in progress/);
    assert.equal(act(voting, 1, { type: 'drop' }).live, null);
  }
  const over = { ...held, isGameOver: true };
  assert.equal(refusal(applyAction(over, 1, { type: 'drop' })), 'The game is over');
  assert.equal(refusal(applyAction(held, 1, { type: 'pick', part: 99 })), 'Invalid part');
  assert.equal(refusal(applyAction(held, 1, { type: 'spin' })), 'Unknown action type');
  assert.equal(refusal(applyMove(held, 1, { type: 'out', part: 1.5 })), 'Invalid part');
});
