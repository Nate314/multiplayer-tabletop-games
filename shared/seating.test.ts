import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayer, removePlayer, nextActivePlayer, applyMove, baseGameState,
  connectedPlayers, findSeatByName, disconnectPlayer, reconnectPlayer, resolveDismissVote
} from './seating.ts';
import { rulesGame, testGame, timedGame, type TestState, type TimedState } from './testGame.ts';
import { setHouseRules, agreeToHouseRules } from './houseRules.ts';

function join(state: TestState, ...names: string[]): TestState {
  let current = state;
  for (const name of names) {
    const result = addPlayer(testGame, current, name);
    if ('error' in result) throw new Error(result.error);
    current = result.state;
  }
  return current;
}

function move(state: TestState, seat: number): TestState {
  const result = applyMove(testGame, state, seat, { type: 'tick' });
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

test('nextActivePlayer wraps and skips missing seats', () => {
  assert.equal(nextActivePlayer({ activePlayers: [1, 3, 4] }, 4), 1);
  assert.equal(nextActivePlayer({ activePlayers: [1, 3, 4] }, 1), 3);
  assert.equal(nextActivePlayer({ activePlayers: [] }, 1), null);
});

test('seats fill the lowest free seat and the lobby resets', () => {
  let state = join(testGame.createGameState('g'), 'A', 'B', 'C');
  state = removePlayer(testGame, state, 2);
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.equal(state.playerNames[2], undefined);
  const result = addPlayer(testGame, state, 'D');
  assert.ok('seat' in result);
  assert.equal(result.seat, 2);
  assert.deepEqual(result.state.activePlayers, [1, 2, 3]);
  assert.equal(result.state.gameStatus, 'D joined (3/4 players)');
  assert.equal(result.state.currentPlayer, 1);
});

test('join is refused when full or started', () => {
  const full = join(testGame.createGameState('g'), 'A', 'B', 'C', 'D');
  assert.deepEqual(addPlayer(testGame, full, 'E'), { error: 'Game is full' });
  const started = move(join(testGame.createGameState('g'), 'A', 'B'), 1);
  assert.deepEqual(addPlayer(testGame, started, 'C'), { error: 'Game already in progress' });
});

test('move guards', () => {
  const alone = join(testGame.createGameState('g'), 'A');
  assert.deepEqual(applyMove(testGame, alone, 1, { type: 'tick' }), { error: 'Waiting for more players' });

  const ready = join(testGame.createGameState('g'), 'A', 'B');
  assert.deepEqual(applyMove(testGame, ready, 2, { type: 'tick' }), { error: 'Not your turn' });

  const voting = { ...ready, undoVote: { requestedBy: 1, votes: {} } };
  assert.deepEqual(applyMove(testGame, voting, 1, { type: 'tick' }), { error: 'An undo vote is in progress' });

  const over = { ...ready, isGameOver: true };
  assert.deepEqual(applyMove(testGame, over, 1, { type: 'tick' }), { error: 'The game is over' });

  assert.equal(ready.started, false);
  assert.equal(move(ready, 1).started, true);
});

test('leaving mid-game passes the turn and keeps the name', () => {
  let state = move(join(testGame.createGameState('g'), 'A', 'B', 'C'), 1);
  state = { ...state, currentPlayer: 1 };
  state = removePlayer(testGame, state, 1);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.activePlayers, [2, 3]);
  assert.equal(state.playerNames[1], 'A');
  assert.equal(state.gameStatus, 'A was dismissed');
});

test('the last player left wins', () => {
  let state = move(join(testGame.createGameState('g'), 'A', 'B'), 1);
  state = removePlayer(testGame, state, 2);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.isGameOver, true);
  assert.equal(state.gameStatus, 'A wins! Everyone else left.');
});

test('baseGameState starts empty', () => {
  assert.deepEqual(baseGameState('g'), {
    gameId: 'g',
    started: false,
    currentPlayer: null,
    activePlayers: [],
    playerNames: {},
    gameStatus: '',
    isGameOver: false,
    winners: [],
    undoVote: null,
    disconnected: [],
    dismissVote: null
  });
});

function threeStarted(): TestState {
  return move(join(testGame.createGameState('g'), 'A', 'B', 'C'), 1); // seat 2 to move
}

test('a lobby disconnect frees the seat', () => {
  const state = disconnectPlayer(testGame, join(testGame.createGameState('g'), 'A', 'B'), 2);
  assert.deepEqual(state.activePlayers, [1]);
  assert.deepEqual(state.disconnected, []);
});

test('a mid-game disconnect holds the seat and the turn waits', () => {
  const before = { ...threeStarted(), currentPlayer: 3 };
  const state = disconnectPlayer(testGame, before, 3);
  assert.deepEqual(state.activePlayers, [1, 2, 3]);
  assert.deepEqual(state.disconnected, [3]);
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.gameStatus, 'C disconnected');
  assert.deepEqual(connectedPlayers(state), [1, 2]);
  assert.equal(disconnectPlayer(testGame, state, 3), state);
});

test('the disconnect hook runs after the seat is held', () => {
  const seen: number[][] = [];
  const game = { ...testGame, onPlayerDisconnected: (s: TestState) => { seen.push(s.disconnected); return s; } };
  disconnectPlayer(game, threeStarted(), 3);
  assert.deepEqual(seen, [[3]]);
});

test('findSeatByName ignores case and spaces', () => {
  const state = join(testGame.createGameState('g'), 'A', 'Bob');
  assert.equal(findSeatByName(state, '  a '), 1);
  assert.equal(findSeatByName(state, 'BOB'), 2);
  assert.equal(findSeatByName(state, 'Zed'), undefined);
});

test('findSeatByName also finds dismissed players', () => {
  const state = removePlayer(testGame, threeStarted(), 3);
  assert.equal(findSeatByName(state, 'c'), 3);
});

test('reconnecting clears the seat and a dismiss vote against it', () => {
  let state = disconnectPlayer(testGame, threeStarted(), 3);
  state = { ...state, dismissVote: { target: 3, requestedBy: 1, votes: { 1: true } } };
  const back = reconnectPlayer(state, 3);
  assert.deepEqual(back.disconnected, []);
  assert.equal(back.dismissVote, null);
  assert.equal(back.gameStatus, 'C is back');
  assert.deepEqual(back.activePlayers, [1, 2, 3]);
});

test('reconnecting a seat that is not held changes nothing', () => {
  const state = threeStarted();
  assert.equal(reconnectPlayer(state, 3), state);
});

test('reconnecting keeps a dismiss vote against someone else', () => {
  let state = disconnectPlayer(testGame, disconnectPlayer(testGame, threeStarted(), 3), 2);
  const vote = { target: 3, requestedBy: 1, votes: { 1: true } as Record<number, boolean> };
  state = { ...state, dismissVote: vote };
  assert.deepEqual(reconnectPlayer(state, 2).dismissVote, vote);
});

test('a dismiss vote passes only when every connected player approves', () => {
  let state = disconnectPlayer(testGame, threeStarted(), 3);
  state = { ...state, dismissVote: { target: 3, requestedBy: 1, votes: { 1: true } } };
  const waiting = resolveDismissVote(testGame, state);
  assert.deepEqual(waiting.activePlayers, [1, 2, 3]);
  assert.notEqual(waiting.dismissVote, null);

  const approved = { ...state, dismissVote: { target: 3, requestedBy: 1, votes: { 1: true, 2: true } } };
  const done = resolveDismissVote(testGame, approved);
  assert.deepEqual(done.activePlayers, [1, 2]);
  assert.deepEqual(done.disconnected, []);
  assert.equal(done.dismissVote, null);
  assert.equal(done.gameStatus, 'C was dismissed');
});

test('a lone connected player can dismiss alone', () => {
  let state = disconnectPlayer(testGame, disconnectPlayer(testGame, threeStarted(), 3), 2);
  state = { ...state, dismissVote: { target: 3, requestedBy: 1, votes: { 1: true } } };
  const done = resolveDismissVote(testGame, state);
  assert.deepEqual(done.activePlayers, [1, 2]);
  assert.deepEqual(done.disconnected, [2]);
});

test('a voter disconnecting re-resolves the dismiss vote', () => {
  let state = disconnectPlayer(testGame, threeStarted(), 3);
  state = { ...state, dismissVote: { target: 3, requestedBy: 1, votes: { 1: true } } };
  const done = disconnectPlayer(testGame, state, 2);
  assert.deepEqual(done.activePlayers, [1, 2]);
  assert.equal(done.dismissVote, null);
});

test('dismissing the last opponent wins', () => {
  let state = move(join(testGame.createGameState('g'), 'A', 'B'), 1);
  state = disconnectPlayer(testGame, state, 2);
  state = { ...state, dismissVote: { target: 2, requestedBy: 1, votes: { 1: true } } };
  const done = resolveDismissVote(testGame, state);
  assert.equal(done.gameStatus, 'A wins! Everyone else left.');
  assert.deepEqual(done.winners, [1]);
  assert.equal(done.isGameOver, true);
});

test('moves are refused during a dismiss vote', () => {
  let state = disconnectPlayer(testGame, threeStarted(), 3);
  state = { ...state, dismissVote: { target: 3, requestedBy: 1, votes: { 1: true } } };
  assert.deepEqual(applyMove(testGame, state, 2, { type: 'tick' }), { error: 'A dismiss vote is in progress' });
});

test('the undo requester disconnecting cancels the undo vote', () => {
  const started = threeStarted();
  const byThree = { ...started, undoVote: { requestedBy: 3, votes: { 3: true } } };
  assert.equal(disconnectPlayer(testGame, byThree, 3).undoVote, null);
  const byOne = { ...started, undoVote: { requestedBy: 1, votes: { 1: true } } };
  assert.notEqual(disconnectPlayer(testGame, byOne, 3).undoVote, null);
});

function joinRules(state: TestState, ...names: string[]): TestState {
  let current = state;
  for (const name of names) {
    const result = addPlayer(rulesGame, current, name);
    if ('error' in result) throw new Error(result.error);
    current = result.state;
  }
  return current;
}

function okState(result: { state: TestState } | { error: string }): TestState {
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

const proposal = (values: Record<string, boolean | number>, override = false, maxPlayers: number | null = null) =>
  ({ values, override, maxPlayers });

test('the first player to join is the host', () => {
  const state = joinRules(rulesGame.createGameState('g'), 'A', 'B');
  assert.equal(state.houseRules?.host, 1);
});

test('a join or a leave before the first move clears every agreement', () => {
  let state = joinRules(rulesGame.createGameState('g'), 'A', 'B');
  state = okState(agreeToHouseRules(rulesGame.info, state, 1, state.houseRules?.revision));
  assert.deepEqual(state.houseRules?.agreed, [1]);
  const revision = state.houseRules?.revision ?? 0;
  const joined = joinRules(state, 'C');
  assert.deepEqual(joined.houseRules?.agreed, []);
  assert.equal(joined.houseRules?.revision, revision + 1);
  const agreed = okState(agreeToHouseRules(rulesGame.info, joined, 2, joined.houseRules?.revision));
  const after = removePlayer(rulesGame, agreed, 3);
  assert.deepEqual(after.houseRules?.agreed, []);
  assert.equal(after.houseRules?.revision, (agreed.houseRules?.revision ?? 0) + 1);
});

test('the host leaving before the first move passes the host to the next seat and keeps the choices', () => {
  let state = joinRules(rulesGame.createGameState('g'), 'A', 'B', 'C');
  state = okState(setHouseRules(rulesGame.info, state, 1, proposal({ fast: true, goal: 5 })));
  const after = removePlayer(rulesGame, state, 1);
  assert.equal(after.houseRules?.host, 2);
  assert.equal(after.houseRules?.values.fast, true);
  assert.equal(after.houseRules?.values.goal, 5);
});

test('the table is full at the chosen most players', () => {
  let state = joinRules(rulesGame.createGameState('g'), 'A', 'B');
  state = okState(setHouseRules(rulesGame.info, state, 1, proposal({}, true, 5)));
  state = joinRules(state, 'C', 'D');
  const fifth = addPlayer(rulesGame, state, 'E');
  assert.ok('seat' in fifth);
  assert.equal(fifth.state.gameStatus, 'E joined (5/5 players)');
  assert.deepEqual(addPlayer(rulesGame, fifth.state, 'F'), { error: 'Game is full' });
});

test('with the override a game starts at the stretched minimum', () => {
  const stretched = { ...rulesGame, info: { ...rulesGame.info, stretchedPlayers: { min: 1, max: 6 } } };
  let state = okState(addPlayer(stretched, stretched.createGameState('g'), 'A') as { state: TestState });
  assert.deepEqual(applyMove(stretched, state, 1, { type: 'tick' }), { error: 'Waiting for more players' });
  state = okState(setHouseRules(stretched.info, state, 1, proposal({}, true, 4)));
  assert.equal(okState(applyMove(stretched, state, 1, { type: 'tick' })).started, true);
});

test('an out-of-turn move needs the game to allow it', () => {
  const ready = join(testGame.createGameState('g'), 'A', 'B');
  assert.deepEqual(applyMove(testGame, ready, 2, { type: 'tick' }), { error: 'Not your turn' });
  const allowing = { ...testGame, allowsOutOfTurn: (_state: TestState, _seat: number, m: unknown) => (m as { type: string }).type === 'tick' };
  assert.equal(okState(applyMove(allowing, ready, 2, { type: 'tick' })).started, true);
  const refusing = { ...testGame, allowsOutOfTurn: () => false };
  assert.deepEqual(applyMove(refusing, ready, 2, { type: 'tick' }), { error: 'Not your turn' });
});

test('applyMove hands the game the server time, which defaults to now', () => {
  const state: TimedState = { ...join(testGame.createGameState('g1'), 'A', 'B'), turnEndsAt: null };
  const at = (now?: number) => {
    const result = applyMove(timedGame, state, 1, { type: 'tick' }, Math.random, now);
    if ('error' in result) throw new Error(result.error);
    return result.state.turnEndsAt;
  };
  assert.equal(at(5000), 6000);
  const before = Date.now();
  assert.ok((at() ?? 0) >= before + 1000);
});
