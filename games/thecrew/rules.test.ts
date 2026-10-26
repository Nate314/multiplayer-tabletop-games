import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, cardName, createGameState, dealMission, describeMove, totalTricks, toPublicState, trueTokens } from './rules.ts';
import { MISSIONS } from './missions.ts';
import { thecrew } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, GameState, OrderToken, PublicGameState, Result, Rule, Task } from './types.ts';

const p = (value: number): Card => ({ suit: 'pink', value });
const b = (value: number): Card => ({ suit: 'blue', value });
const g = (value: number): Card => ({ suit: 'green', value });
const y = (value: number): Card => ({ suit: 'yellow', value });
const r = (value: number): Card => ({ suit: 'rocket', value });

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve'];

function lobby(count = 4): GameState {
  let state = createGameState('g');
  for (const name of NAMES.slice(0, count)) {
    const result = addPlayer(thecrew, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Moves through the platform, which checks the turn first; actions go straight to the game
const move = (state: GameState, seat: number, m: unknown, random: Random = seeded(3)) => applyMove(thecrew, state, seat, m, random);
const act = (state: GameState, seat: number, a: unknown, random: Random = seeded(3)) =>
  thecrew.applyAction?.(state, seat, a, random, 0) ?? assert.fail('no actions');
const task = (card: Card, owner: number | null, token: OrderToken | null = null): Task => ({ card, token, owner, done: false });

// A mission under way with four players: Alice is commander and leads. Mission 1's rules unless `mission` says otherwise.
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3, 4],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' },
    commander: 1,
    phase: 'play',
    hands: { 1: [p(9), r(4), b(1)], 2: [p(1), g(2), b(2)], 3: [p(5), g(3), b(3)], 4: [y(2), p(3), b(4)] },
    tasks: [task(p(1), 1)],
    ...overrides
  };
}

// Plays the cards in turn, each from the seat whose turn it is
function playAll(state: GameState, cards: Card[], random: Random = seeded(3)): GameState {
  let next = state;
  for (const card of cards) {
    const seat = next.currentPlayer ?? assert.fail('nobody to play');
    next = ok(move(next, seat, { type: 'play', card }, random));
  }
  return next;
}

function allCards(state: GameState): string[] {
  return Object.values(state.hands).flat().map(cardName);
}

test('missions.ts has 50 missions numbered 1 to 50', () => {
  assert.equal(MISSIONS.length, 50);
  assert.deepEqual(MISSIONS.map(mission => mission.number), Array.from({ length: 50 }, (_, i) => i + 1));
  for (const mission of MISSIONS) {
    assert.ok(mission.tokens.length <= mission.tasks, `mission ${mission.number} has more tokens than tasks`);
    assert.ok(mission.tasks > 0 || mission.rule, `mission ${mission.number} has neither tasks nor a rule`);
  }
  // A few spot checks against the logbook
  assert.deepEqual(MISSIONS[2], { number: 3, tasks: 2, tokens: [1, 2] });
  assert.deepEqual(MISSIONS[47], { number: 48, tasks: 3, tokens: ['omega'], rule: { kind: 'omegaInLastTrick' } });
  assert.equal(MISSIONS[49].rule?.kind, 'relay');
});

test('40 colored cards 1 to 9 and 4 rockets', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 40);
  assert.equal(new Set(deck.map(cardName)).size, 40);
  for (const suit of ['pink', 'blue', 'green', 'yellow'] as const) {
    assert.deepEqual(deck.filter(card => card.suit === suit).map(card => card.value), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  assert.deepEqual(deck.filter(card => card.suit === 'rocket').map(card => card.value), [1, 2, 3, 4]);

  // Dealt out evenly; with three players one gets an extra card, which is never played
  for (const count of [3, 4, 5]) {
    const state = lobby(count);
    assert.equal(allCards(state).length, 40);
    const sizes = state.activePlayers.map(seat => state.hands[seat].length).sort();
    assert.deepEqual(sizes, count === 3 ? [13, 13, 14] : Array(count).fill(40 / count));
    assert.equal(totalTricks(count), Math.floor(40 / count));
  }
  assert.equal(allCards(lobby(2)).length, 0);
});

test('the holder of the 4 rocket is commander', () => {
  for (const seed of [1, 2, 3, 4]) {
    const state = dealMission(lobby(4), seeded(seed));
    const commander = state.commander ?? assert.fail('no commander');
    assert.ok(state.hands[commander].some(card => card.suit === 'rocket' && card.value === 4));
    assert.equal(state.currentPlayer, commander);
    // The commander takes the first task
    assert.equal(state.phase, 'choose');
    assert.equal(state.tasks.length, 1);
    assert.equal(state.tasks[0].card.suit === 'rocket', false);
  }
});

test('tasks are taken in turn from the commander', () => {
  let state = { ...dealMission({ ...lobby(4), mission: 4, startMission: 4 }, seeded(2)) };
  state = { ...state, commander: 3, currentPlayer: 3 };
  assert.equal(state.tasks.length, 3);
  state = ok(move(state, 3, { type: 'takeTask', task: 1 }));
  assert.equal(state.tasks[1].owner, 3);
  assert.equal(state.currentPlayer, 4);
  assert.ok('error' in move(state, 4, { type: 'takeTask', task: 1 }));
  state = ok(move(state, 4, { type: 'takeTask', task: 0 }));
  assert.equal(state.currentPlayer, 1);
  state = ok(move(state, 1, { type: 'takeTask', task: 2 }));
  // All taken: the commander leads the first trick
  assert.equal(state.phase, 'play');
  assert.equal(state.currentPlayer, 3);
  assert.match(describeMove(state.lastMove ?? assert.fail(), state.playerNames), /^Alice took the task (pink|blue|green|yellow) \d$/);
});

test('rockets are trump', () => {
  // Bob is out of pink and trumps with the 1 rocket
  let state = game({ hands: { 1: [p(9), b(9)], 2: [r(1), g(2)], 3: [p(5), b(3)], 4: [p(3), b(4)] }, tasks: [task(b(9), 2)] });
  state = playAll(state, [p(9), r(1), p(5), p(3)]);
  assert.equal(state.lastTrick?.winner, 2);
  assert.equal(state.currentPlayer, 2);
  // A rocket may only be played when the player cannot follow
  const follow = game({ hands: { 1: [p(9), r(4)], 2: [p(1), r(1)], 3: [p(5), g(3)], 4: [p(3), b(4)] }, tasks: [task(b(4), 2)] });
  const led = ok(move(follow, 1, { type: 'play', card: p(9) }));
  assert.deepEqual(move(led, 2, { type: 'play', card: r(1) }), { error: 'Follow suit: play pink' });
  // A rocket led must be followed with rockets; the highest rocket wins
  const rockets = game({ hands: { 1: [r(2), b(9)], 2: [r(3), g(2)], 3: [p(5), b(3)], 4: [r(1), b(4)] }, tasks: [task(b(9), 2)] });
  const next = playAll(rockets, [r(2), r(3), p(5), r(1)]);
  assert.equal(next.lastTrick?.winner, 2);
});

test('a task is done when its owner wins the trick with that card', () => {
  // Bob owns the pink 1 task; Alice wins it, so the mission fails
  const failing = playAll(game({ tasks: [task(p(1), 2)] }), [p(9), p(1), p(5), p(3)]);
  assert.equal(failing.phase, 'missionOver');
  assert.equal(failing.roundSummary?.success, false);
  assert.equal(failing.roundSummary?.reason, 'Alice won pink 1, which was Bob\'s task');
  // Alice owns it and wins it: the only task is done, so the mission succeeds
  const won = playAll(game(), [p(9), p(1), p(5), p(3)]);
  assert.equal(won.tasks[0].done, true);
  assert.equal(won.roundSummary?.success, true);
  assert.equal(won.lastCompleted, 1);
  assert.equal(won.currentPlayer, null);
  assert.deepEqual(won.lastMove, { type: 'play', playerNumber: 4, card: p(3), trickWinner: 1, result: 'success' });
  // A trick that holds no task card changes nothing
  const other = playAll(game({ hands: { 1: [b(1), p(9)], 2: [b(2), p(1)], 3: [b(3), p(5)], 4: [b(4), p(3)] } }), [b(1), b(2), b(3), b(4)]);
  assert.equal(other.phase, 'play');
  assert.equal(other.currentPlayer, 4);
  assert.equal(other.tasks[0].done, false);
});

test('a mission fails when the tricks run out with tasks left', () => {
  // Three players: one card is never played, and here it is the task card
  let state = game({
    activePlayers: [1, 2, 3], playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    hands: { 1: [b(1), p(1)], 2: [b(2)], 3: [b(3)] }, tasks: [task(p(1), 2)]
  });
  state = { ...state, tricks: Array.from({ length: totalTricks(3) - 1 }, () => ({ plays: [], winner: 1 })) };
  state = playAll(state, [b(1), b(2), b(3)]);
  assert.equal(state.roundSummary?.success, false);
  assert.equal(state.roundSummary?.reason, 'The tricks ran out before the mission was done');
});

test('task order tokens are enforced', () => {
  const hands = { 1: [p(9), b(9), g(9)], 2: [p(1), b(1), g(1)], 3: [p(2), b(2), g(2)], 4: [p(3), b(3), g(3)] };
  const ordered = (tokens: (OrderToken | null)[]) => game({ hands, tasks: [task(p(1), 1, tokens[0]), task(b(1), 1, tokens[1]), task(g(1), 1, tokens[2])] });
  const trick = (suit: (n: number) => Card) => [suit(9), suit(1), suit(2), suit(3)];

  // Numbers: 1 then 2; the blue one first breaks token 1's place
  let state = playAll(ordered([1, 2, null]), trick(p));
  assert.equal(state.phase, 'play');
  const wrong = playAll(ordered([1, 2, null]), trick(b));
  assert.equal(wrong.roundSummary?.reason, 'The tasks were not done in the order their tokens give');
  // An untokened task may not take a numbered task's place either
  assert.equal(playAll(ordered([null, 1, null]), trick(p)).roundSummary?.success, false);
  // Arrows only order the arrow tasks: green (no token) first is fine, blue before pink is not
  state = playAll(ordered(['>', '>>', null]), trick(g));
  assert.equal(state.phase, 'play');
  assert.equal(playAll(ordered(['>', '>>', null]), trick(b)).roundSummary?.success, false);
  // Omega must be last of all the tasks
  assert.equal(playAll(ordered([null, null, 'omega']), trick(g)).roundSummary?.success, false);
  state = playAll(playAll(ordered([null, null, 'omega']), trick(p)), [b(9), b(1), b(2), b(3)]);
  state = playAll(state, trick(g));
  assert.equal(state.roundSummary?.success, true);
  // Two tasks with consecutive tokens done in one trick are both fine, whichever card came first
  const both = game({ hands, tasks: [task(p(1), 1, 2), task(p(2), 1, 1)] });
  assert.equal(playAll(both, trick(p)).roundSummary?.success, true);
});

test('communication is allowed only between tricks, once per mission, and must be true', () => {
  const hands = { 1: [p(9), p(4), b(1), r(4)], 2: [p(1), g(2), g(7), b(2)], 3: [p(5), g(3), b(3), b(8)], 4: [y(2), p(3), b(4), b(5)] };
  const state = game({ hands, tasks: [task(p(1), 1)] });
  const say = (s: GameState, seat: number, card: Card, token: string) => act(s, seat, { type: 'communicate', card, token });

  assert.deepEqual(say(state, 1, p(4), 'highest'), { error: 'That is not true: pink 4 is not your highest pink' });
  assert.deepEqual(say(state, 1, p(9), 'lowest'), { error: 'That is not true: pink 9 is not your lowest pink' });
  assert.deepEqual(say(state, 1, p(9), 'only'), { error: 'That is not true: pink 9 is not your only pink' });
  assert.deepEqual(say(state, 1, r(4), 'only'), { error: 'Rockets are never communicated' });
  assert.deepEqual(say(state, 1, g(2), 'only'), { error: 'You do not have that card' });

  let next = ok(say(state, 1, p(9), 'highest'));
  assert.deepEqual(next.communications[1], { card: p(9), token: 'highest', beforeTrick: 1 });
  assert.equal(next.gameStatus, 'Alice communicated pink 9: their highest pink');
  assert.deepEqual(say(next, 1, b(1), 'only'), { error: 'You have already communicated in this mission' });
  next = ok(say(next, 2, g(2), 'lowest'));
  next = ok(say(next, 3, p(5), 'only'));
  // Not during a trick
  next = ok(move(next, 1, { type: 'play', card: b(1) }));
  assert.deepEqual(say(next, 4, y(2), 'only'), { error: 'Communicate between tricks, not during one' });
  next = playAll(next, [b(2), b(3), b(4)]);
  // Between tricks again
  next = ok(say(next, 4, y(2), 'only'));
  // A played communicated card is no longer held
  const view = toPublicState(next, false, null);
  assert.equal(view.communications[1].held, true);
  // Not before the tasks are shared out, and not after the mission
  assert.ok('error' in say({ ...state, phase: 'choose' }, 1, p(9), 'highest'));
  assert.ok('error' in say({ ...state, phase: 'missionOver' }, 1, p(9), 'highest'));
});

test('an only card is communicated as only, not as highest or lowest', () => {
  const hands = { 1: [p(9), y(4), b(1)], 2: [p(1), g(2), b(2)], 3: [p(5), g(3), b(3)], 4: [y(2), p(3), b(4)] };
  assert.deepEqual(trueTokens(hands[1], y(4)), ['only']);
  assert.deepEqual(trueTokens([p(9), p(4)], p(9)), ['highest']);
  const state = game({ hands, tasks: [task(p(1), 1)] });
  for (const token of ['highest', 'lowest']) {
    assert.deepEqual(act(state, 1, { type: 'communicate', card: y(4), token }), { error: `That is not true: yellow 4 is not your ${token} yellow` });
  }
  assert.ok('state' in act(state, 1, { type: 'communicate', card: y(4), token: 'only' }));
});

test('undo reshuffles', () => {
  // A commander's decision: undoing it puts other face-down tasks on the table, so the crew cannot learn them
  const decision = dealMission({ ...lobby(4), mission: 20, startMission: 20 }, seeded(1));
  const undone = thecrew.onUndo?.(decision, seeded(9)) ?? assert.fail('no onUndo');
  assert.equal(undone.tasks.length, 2);
  assert.notDeepEqual(undone.tasks.map(t => cardName(t.card)), decision.tasks.map(t => cardName(t.card)));
  for (const t of undone.tasks) assert.ok(!decision.tasks.some(old => cardName(old.card) === cardName(t.card)));

  // A distribution: the task on show and those already handed out stay, the face-down rest is redrawn, tokens kept by place
  let dealt = dealMission({ ...lobby(4), mission: 36, startMission: 36 }, seeded(1));
  dealt = ok(move({ ...dealt, commander: 1, currentPlayer: 1 }, 1, { type: 'assignTask', seat: 2 }));
  const again = thecrew.onUndo?.(dealt, seeded(9)) ?? assert.fail('no onUndo');
  assert.deepEqual(again.tasks.slice(0, 2), dealt.tasks.slice(0, 2));
  assert.deepEqual(again.tasks.map(t => t.token), dealt.tasks.map(t => t.token));
  const names = again.tasks.map(t => cardName(t.card));
  assert.equal(new Set(names).size, 7);
  assert.notDeepEqual(names.slice(2), dealt.tasks.slice(2).map(t => cardName(t.card)));

  // Anywhere else nothing face down is left, so nothing changes
  const playing = game();
  assert.equal(thecrew.onUndo?.(playing, seeded(9)), playing);
});

test('a dead spot shows no token, and a disruption holds communication off until its trick', () => {
  const hands = { 1: [p(9), p(4), b(1)], 2: [p(1), g(2), b(2)], 3: [p(5), g(3), b(3)], 4: [y(2), p(3), b(4)] };
  const dead = game({ mission: 6, hands });
  // The card must still be the highest, lowest or only; the token stays hidden
  assert.ok('error' in act(dead, 1, { type: 'communicate', card: p(5) }));
  const said = ok(act(dead, 1, { type: 'communicate', card: p(4) }));
  assert.deepEqual(said.communications[1], { card: p(4), token: null, beforeTrick: 1 });
  assert.equal(said.gameStatus, 'Alice communicated pink 4');

  const disrupted = game({ mission: 18, hands });
  assert.deepEqual(act(disrupted, 1, { type: 'communicate', card: p(9), token: 'highest' }),
    { error: 'Communication is disrupted until trick 2' });
  const later = playAll(disrupted, [b(1), b(2), b(3), b(4)]);
  assert.ok('state' in act(later, 4, { type: 'communicate', card: p(3), token: 'only' }));
});

test('success deals the next mission and failure retries it with the attempt count up', () => {
  // Success: Continue from everyone deals mission 2
  let state = playAll(game(), [p(9), p(1), p(5), p(3)]);
  assert.equal(state.gameStatus, 'Mission 1 complete!');
  for (const seat of [1, 2, 3]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  assert.equal(state.phase, 'missionOver');
  state = ok(act(state, 4, { type: 'acknowledgeRound' }));
  assert.equal(state.mission, 2);
  assert.equal(state.attempt, 1);
  assert.equal(state.phase, 'choose');
  assert.equal(state.tasks.length, 2);
  assert.equal(allCards(state).length, 40);
  assert.equal(state.gameStatus, 'Mission 2, attempt 1');

  // Failure: the same mission again, attempt 2
  let failed = playAll(game({ mission: 7, attempt: 1, tasks: [task(p(1), 2)] }), [p(9), p(1), p(5), p(3)]);
  assert.equal(failed.gameStatus, 'Mission 7 failed: Alice won pink 1, which was Bob\'s task');
  for (const seat of [1, 2, 3, 4]) failed = ok(act(failed, seat, { type: 'acknowledgeRound' }));
  assert.equal(failed.mission, 7);
  assert.equal(failed.attempt, 2);
  assert.equal(failed.tasks.length, 3);
  assert.deepEqual(failed.communications, {});
  assert.equal(failed.gameStatus, 'Mission 7, attempt 2');
});

test('the next mission does not wait for disconnected players', () => {
  let state = playAll(game(), [p(9), p(1), p(5), p(3)]);
  for (const seat of [1, 2, 3]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  state = disconnectPlayer(thecrew, state, 4, seeded(1));
  assert.equal(state.mission, 2);
});

test('completing mission 50 ends the game with the whole crew as winners', () => {
  // Mission 50: Bob wins tricks 1 to 4 only, Cara only the last; with two tricks in a crafted hand, trick 2 is the last
  let state = game({
    mission: 50, tasks: [], chosen: [2, 3],
    hands: { 1: [p(1), b(1)], 2: [p(9), b(2)], 3: [p(2), b(9)], 4: [p(3), b(3)] },
    tricks: Array.from({ length: totalTricks(4) - 2 }, (_, i) => ({ plays: [], winner: i < 4 ? 2 : 1 }))
  });
  state = { ...state, tricks: state.tricks.slice(0, 4).concat(state.tricks.slice(4).map(t => ({ ...t, winner: 4 }))) };
  state = playAll(state, [p(1), p(9), p(2), p(3)]);
  assert.equal(state.roundSummary?.success, false);
  assert.equal(state.isGameOver, false);

  let won = game({
    mission: 50, tasks: [], chosen: [2, 3],
    hands: { 1: [p(1), b(1)], 2: [p(2), b(2)], 3: [p(9), b(9)], 4: [p(3), b(3)] },
    tricks: Array.from({ length: totalTricks(4) - 1 }, (_, i) => ({ plays: [], winner: i < 4 ? 2 : 4 }))
  });
  won = playAll(won, [p(1), p(2), p(9), p(3)]);
  assert.equal(won.roundSummary?.success, true);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 2, 3, 4]);
  assert.equal(won.gameStatus, 'Mission 50 complete! The crew has finished the logbook');
  assert.deepEqual(act(won, 1, { type: 'acknowledgeRound' }), { error: 'The game is over' });
});

test('the end vote ends the game naming the last mission done', () => {
  const state = playAll(game({ mission: 12, attempt: 2, lastCompleted: 11, tasks: [task(p(1), 2)] }), [p(9), p(1), p(5), p(3)]);
  assert.deepEqual(act(game(), 1, { type: 'voteEnd', yes: true }), { error: 'Vote to end only between missions' });
  let next = ok(act(state, 1, { type: 'voteEnd', yes: true }));
  next = ok(act(next, 2, { type: 'voteEnd', yes: false }));
  next = ok(act(next, 3, { type: 'voteEnd', yes: true }));
  assert.equal(next.isGameOver, false);
  next = ok(act(next, 2, { type: 'voteEnd', yes: true }));
  assert.equal(next.isGameOver, false);
  next = ok(act(next, 4, { type: 'voteEnd', yes: true }));
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [1, 2, 3, 4]);
  assert.equal(next.gameStatus, 'The crew ended the game. Last mission completed: 11');

  // A disconnected player is not waited for, and a new mission clears the votes
  let partial = ok(act(state, 1, { type: 'voteEnd', yes: true }));
  partial = ok(act(partial, 2, { type: 'voteEnd', yes: true }));
  for (const seat of [1, 2, 3, 4]) partial = ok(act(partial, seat, { type: 'acknowledgeRound' }));
  assert.deepEqual(partial.endVotes, {});
  const none = ok(act(playAll(game({ tasks: [task(p(1), 2)] }), [p(9), p(1), p(5), p(3)]), 1, { type: 'voteEnd', yes: true }));
  const ended = disconnectPlayer(thecrew, ok(act(ok(act(none, 2, { type: 'voteEnd', yes: true })), 3, { type: 'voteEnd', yes: true })), 4, seeded(1));
  assert.equal(ended.isGameOver, true);
  assert.equal(ended.gameStatus, 'The crew ended the game before completing a mission');
});

test('a player leaving ends the game', () => {
  const state = removePlayer(thecrew, game({ lastCompleted: 4 }), 3, seeded(1));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 2, 4]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'Cara left, so the crew cannot go on. Last mission completed: 4');
});

test('lobby choice is kept across joins and refused after the first move', () => {
  let state = lobby(2);
  assert.deepEqual(act(state, 9, { type: 'chooseMission', mission: 5 }), { error: 'Only a seated player can choose the mission' });
  for (const bad of [0, 51, 2.5, '5', null]) assert.ok('error' in act(state, 1, { type: 'chooseMission', mission: bad }));
  state = ok(act(state, 2, { type: 'chooseMission', mission: 8 }));
  assert.equal(state.startMission, 8);
  assert.equal(state.gameStatus, 'Bob chose mission 8');
  const joined = addPlayer(thecrew, state, 'Cara', seeded(1));
  if ('error' in joined) assert.fail(joined.error);
  state = joined.state;
  assert.equal(state.mission, 8);
  assert.equal(state.tasks.length, 3);
  assert.deepEqual(state.tasks.map(t => t.token), [1, 2, 3]);
  // Changing it with three seated deals that mission
  state = ok(act(state, 3, { type: 'chooseMission', mission: 13 }));
  assert.equal(state.tasks.length, 0);
  assert.equal(state.phase, 'play');
  const commander = state.commander ?? assert.fail('no commander');
  state = ok(move(state, commander, { type: 'play', card: state.hands[commander][0] }));
  assert.equal(state.started, true);
  assert.deepEqual(act(state, 1, { type: 'chooseMission', mission: 2 }), { error: 'The mission is chosen before the first move' });
});

// One test per kind of special rule, all named in the next test
const RULE_TESTS = new Set<Rule['kind']>();
function ruleTest(kind: Rule['kind'], name: string, body: () => void) {
  RULE_TESTS.add(kind);
  test(`special rule ${kind}: ${name}`, body);
}

test('every mission\'s special rule has a test', () => {
  const kinds = new Set(MISSIONS.flatMap(mission => mission.rule ? [mission.rule.kind] : []));
  assert.deepEqual([...kinds].filter(kind => !RULE_TESTS.has(kind)), []);
});

const four = { 1: [p(9), b(1)], 2: [p(1), b(2)], 3: [p(5), b(3)], 4: [p(3), b(4)] };

ruleTest('sick', 'the commander names a sick crew member, who must not win a trick', () => {
  let state = dealMission({ ...lobby(4), mission: 5, startMission: 5 }, seeded(1));
  assert.equal(state.phase, 'decision');
  const commander = state.commander ?? assert.fail();
  assert.ok('error' in move(state, commander, { type: 'choosePlayer', seat: 9 }));
  state = ok(move(state, commander, { type: 'choosePlayer', seat: 2 }));
  assert.deepEqual(state.chosen, [2]);
  assert.equal(state.phase, 'play');
  assert.equal(state.currentPlayer, commander);
  assert.equal(state.gameStatus, `${state.playerNames[commander]} chose Bob as the sick crew member, who must not win a trick`);
  // Bob wins a trick: failed
  const sick = game({ mission: 5, tasks: [], chosen: [2], hands: four });
  assert.equal(playAll(sick, [b(1), b(2), b(3), b(4)]).phase, 'play');
  const lost = playAll({ ...sick, hands: { ...four, 1: [p(1), b(1)], 2: [p(9), b(2)] } }, [p(1), p(9), p(5), p(3)]);
  assert.equal(lost.roundSummary?.reason, 'Bob is sick and must not win a trick');
  // Without winning any trick through the last one: success
  const last = { ...sick, tricks: Array.from({ length: totalTricks(4) - 1 }, () => ({ plays: [], winner: 1 })) };
  assert.equal(playAll(last, [p(9), p(1), p(5), p(3)]).roundSummary?.success, true);
});

ruleTest('oneWins', 'a 1 must win a trick (two tricks in mission 26)', () => {
  const state = game({ mission: 9, tasks: [], hands: { 1: [p(1), b(1)], 2: [g(1), b(2)], 3: [y(1), b(3)], 4: [g(3), b(4)] } });
  // Pink 1 led, nobody follows: it wins, and that is the mission
  assert.equal(playAll(state, [p(1), g(1), y(1), g(3)]).roundSummary?.success, true);
  const twice = playAll({ ...state, mission: 26 }, [p(1), g(1), y(1), g(3)]);
  assert.equal(twice.phase, 'play');
  assert.equal(playAll({ ...twice, hands: { 1: [b(1)], 2: [b(2)], 3: [b(3)], 4: [g(9)] } }, [b(1), b(2), b(3), g(9)]).phase, 'play');
});

ruleTest('mute', 'the commander names another crew member, who may not communicate', () => {
  let state = dealMission({ ...lobby(4), mission: 11, startMission: 11 }, seeded(1));
  const commander = state.commander ?? assert.fail();
  assert.equal(state.phase, 'decision');
  assert.deepEqual(move(state, commander, { type: 'choosePlayer', seat: commander }), { error: 'Choose a crew member other than the commander' });
  const other = state.activePlayers.find(seat => seat !== commander) ?? assert.fail();
  state = ok(move(state, commander, { type: 'choosePlayer', seat: other }));
  assert.equal(state.phase, 'choose');
  assert.equal(state.currentPlayer, commander);
  state = { ...state, phase: 'play', tasks: state.tasks.map(t => ({ ...t, owner: commander })) };
  const card = state.hands[other].find(c => c.suit !== 'rocket') ?? assert.fail();
  assert.deepEqual(act(state, other, { type: 'communicate', card, token: 'only' }), { error: 'You may not communicate in this mission' });
});

ruleTest('drawFromRight', 'after the first trick each player draws a random card from the player on their right', () => {
  const state = game({
    mission: 12, tasks: [task(g(9), 1, 'omega')],
    hands: { 1: [p(9), b(1), g(1)], 2: [p(1), b(2), g(2)], 3: [p(5), b(3), g(3)], 4: [p(3), b(4), g(4)] }
  });
  const next = playAll(state, [p(9), p(1), p(5), p(3)], () => 0);
  // Alice draws from Dan, Bob from Alice and so on; first card each time with random 0
  assert.deepEqual(next.hands, { 1: [g(1), b(4)], 2: [g(2), b(1)], 3: [g(3), b(2)], 4: [g(4), b(3)] });
  assert.equal(playAll(next, [b(4), b(1), b(2), b(3)]).hands[1].length, 1);
});

ruleTest('rocketsWin', 'each rocket must win a trick, in order in mission 44', () => {
  const hands = { 1: [r(1), r(3)], 2: [p(1), b(2)], 3: [p(5), b(3)], 4: [y(4), b(4)] };
  const state = game({ mission: 13, tasks: [], hands });
  // Two rockets in one trick: the lower can no longer win
  assert.equal(playAll({ ...state, hands: { ...hands, 2: [r(2), p(1)] } }, [r(1), r(2), p(5), b(4)]).roundSummary?.reason,
    'Every rocket must win a trick');
  const one = playAll(state, [r(3), p(1), p(5), b(4)]);
  assert.equal(one.phase, 'play');
  // Mission 44: rocket 3 first is out of order
  assert.equal(playAll({ ...state, mission: 44 }, [r(3), p(1), p(5), b(4)]).roundSummary?.reason, 'The rockets must win in order: 1, 2, 3, then 4');
  const first = playAll({ ...state, mission: 44 }, [r(1), p(1), p(5), b(4)]);
  assert.equal(first.phase, 'play');
  // All four done: success
  const done = game({ mission: 13, tasks: [], hands: { 1: [r(4)], 2: [p(1)], 3: [p(5)], 4: [p(3)] },
    tricks: [1, 2, 3].map(value => ({ plays: [{ seat: 1, card: r(value) }], winner: 1 })) });
  assert.equal(playAll(done, [r(4), p(1), p(5), p(3)]).roundSummary?.success, true);
});

ruleTest('noNines', 'no trick may be won by a 9', () => {
  const state = game({ mission: 16, tasks: [], hands: four });
  assert.equal(playAll(state, [p(9), p(1), p(5), p(3)]).roundSummary?.reason, 'A 9 won a trick');
  // Mission 17 has tasks; they finish the mission early
  const tasks = game({ mission: 17, tasks: [task(b(4), 4)], hands: four });
  assert.equal(playAll(tasks, [b(1), b(2), b(3), b(4)]).roundSummary?.success, true);
  // Mission 16 runs to the last trick
  assert.equal(playAll(state, [b(1), b(2), b(3), b(4)]).phase, 'play');
});

ruleTest('takesAll', 'the commander gives every face-down task to another crew member', () => {
  let state = dealMission({ ...lobby(4), mission: 20, startMission: 20 }, seeded(1));
  const commander = state.commander ?? assert.fail();
  assert.equal(state.phase, 'decision');
  // Face down until the commander decides
  assert.deepEqual(toPublicState(state, false, commander).tasks.map(t => t.card), [null, null]);
  assert.deepEqual(move(state, commander, { type: 'choosePlayer', seat: commander }), { error: 'Choose a crew member other than the commander' });
  const other = state.activePlayers.find(seat => seat !== commander) ?? assert.fail();
  state = ok(move(state, commander, { type: 'choosePlayer', seat: other }));
  assert.deepEqual(state.tasks.map(t => t.owner), [other, other]);
  assert.equal(state.phase, 'play');
  assert.deepEqual(toPublicState(state, false, null).tasks.map(t => t.card), state.tasks.map(t => t.card));
});

ruleTest('distribution', 'the commander hands out the tasks one at a time, evenly', () => {
  let state = dealMission({ ...lobby(4), mission: 24, startMission: 24 }, seeded(1));
  state = { ...state, commander: 1, currentPlayer: 1 };
  assert.equal(state.phase, 'distribute');
  // Only the task being handed out shows
  assert.deepEqual(toPublicState(state, false, 1).tasks.map(t => t.card !== null), [true, false, false, false, false, false]);
  state = ok(move(state, 1, { type: 'assignTask', seat: 1 }));
  state = ok(move(state, 1, { type: 'assignTask', seat: 1 }));
  // Six tasks for four: nobody may get a third
  assert.deepEqual(move(state, 1, { type: 'assignTask', seat: 1 }), { error: 'Nobody may end up with two tasks more than another' });
  state = ok(move(state, 1, { type: 'assignTask', seat: 2 }));
  state = ok(move(state, 1, { type: 'assignTask', seat: 2 }));
  // Two left for Cara and Dan, who have none: each must get one
  assert.ok('error' in move(state, 1, { type: 'assignTask', seat: 2 }));
  state = ok(move(state, 1, { type: 'assignTask', seat: 3 }));
  state = ok(move(state, 1, { type: 'assignTask', seat: 4 }));
  assert.deepEqual(state.tasks.map(t => t.owner), [1, 1, 2, 2, 3, 4]);
  assert.equal(state.phase, 'play');
  assert.match(state.gameStatus, /^Alice gave Dan the task /);
  // Mission 36: the tokens go with the first tasks
  const tokens = dealMission({ ...lobby(4), mission: 36, startMission: 36 }, seeded(1));
  assert.deepEqual(tokens.tasks.map(t => t.token), [1, 2, null, null, null, null, null]);
});

ruleTest('swapTokens', 'before the tasks are taken, two order tokens may swap places', () => {
  let state = dealMission({ ...lobby(4), mission: 23, startMission: 23 }, seeded(1));
  const commander = state.commander ?? assert.fail();
  assert.equal(state.phase, 'tokens');
  assert.ok('error' in move(state, commander, { type: 'moveToken', from: 0, to: 0 }));
  assert.ok('error' in move(state, commander, { type: 'moveToken', from: 0, to: 5 }));
  assert.ok('error' in move(state, commander, { type: 'takeTask', task: 0 }));
  state = ok(move(state, commander, { type: 'moveToken', from: 0, to: 4 }));
  assert.deepEqual(state.tasks.map(t => t.token), [5, 2, 3, 4, 1]);
  assert.equal(state.phase, 'choose');
  assert.equal(state.lastMove?.type === 'moveToken' && state.lastMove.swap, true);
  const kept = ok(move(dealMission({ ...lobby(4), mission: 23, startMission: 23 }, seeded(1)), commander, { type: 'keepTokens' }));
  assert.deepEqual(kept.tasks.map(t => t.token), [1, 2, 3, 4, 5]);
});

ruleTest('moveToken', 'before the tasks are taken, one order token may move to a task without one', () => {
  let state = dealMission({ ...lobby(4), mission: 40, startMission: 40 }, seeded(1));
  const commander = state.commander ?? assert.fail();
  assert.equal(state.phase, 'tokens');
  assert.deepEqual(move(state, commander, { type: 'moveToken', from: 0, to: 1 }), { error: 'Move the token to a task without one' });
  assert.deepEqual(move(state, commander, { type: 'moveToken', from: 5, to: 6 }), { error: 'That task has no order token' });
  state = ok(move(state, commander, { type: 'moveToken', from: 1, to: 7 }));
  assert.deepEqual(state.tasks.map(t => t.token), [1, null, 3, null, null, null, null, 2]);
});

ruleTest('balanced', 'nobody may have won two tricks more than another; in mission 34 the commander wins the first and last', () => {
  const state = game({ mission: 29, tasks: [], hands: four, tricks: [{ plays: [], winner: 1 }] });
  assert.equal(playAll(state, [p(9), p(1), p(5), p(3)]).roundSummary?.reason, 'Nobody may win two tricks more than another');
  assert.equal(playAll(state, [b(1), b(2), b(3), b(4)]).phase, 'play');
  // Mission 34: the commander must win the first trick
  const first = game({ mission: 34, tasks: [], hands: four });
  assert.equal(playAll(first, [b(1), b(2), b(3), b(4)]).roundSummary?.reason, 'The commander must win the first and the last trick');
  assert.equal(playAll(first, [p(9), p(1), p(5), p(3)]).phase, 'play');
});

ruleTest('exactlyOneTrick', 'the chosen crew member wins exactly one trick, not with a rocket', () => {
  const hands = { 1: [p(9), b(1)], 2: [p(1), b(9)], 3: [p(5), b(3)], 4: [r(1), b(4)] };
  const state = game({ mission: 33, tasks: [], chosen: [4], hands });
  assert.equal(playAll(state, [p(9), p(1), p(5), r(1)]).roundSummary?.reason, 'Dan must win exactly one trick, and not with a rocket');
  const once = game({ mission: 33, tasks: [], chosen: [2], hands, tricks: Array.from({ length: totalTricks(4) - 2 }, () => ({ plays: [], winner: 1 })) });
  const after = playAll(once, [b(1), b(9), b(3), b(4)]);
  assert.equal(after.phase, 'play');
  assert.equal(playAll({ ...after, hands: { 1: [p(9)], 2: [p(1)], 3: [p(5)], 4: [p(3)] } }, [p(1), p(5), p(3), p(9)]).roundSummary?.success, true);
});

ruleTest('firstAndLastOnly', 'the chosen crew member wins only the first and last tricks, neither with a rocket', () => {
  const state = game({ mission: 41, tasks: [], chosen: [1], hands: four });
  assert.equal(playAll(state, [b(1), b(2), b(3), b(4)]).roundSummary?.reason, 'Alice must win only the first and the last trick, neither with a rocket');
  const next = playAll(state, [p(9), p(1), p(5), p(3)]);
  assert.equal(next.phase, 'play');
  // A middle trick for Alice fails
  assert.equal(playAll({ ...next, hands: { 1: [b(9)], 2: [b(2)], 3: [b(3)], 4: [b(4)] } }, [b(9), b(2), b(3), b(4)]).roundSummary?.success, false);
});

ruleTest('allPink', 'the player left of the pink 9 must win every pink card', () => {
  const dealt = dealMission({ ...lobby(4), mission: 46, startMission: 46 }, seeded(1));
  const holder = dealt.activePlayers.find(seat => dealt.hands[seat].some(c => c.suit === 'pink' && c.value === 9)) ?? assert.fail();
  assert.deepEqual(dealt.chosen, [holder % 4 + 1]);
  assert.equal(dealt.phase, 'play');
  const state = game({ mission: 46, tasks: [], chosen: [2], hands: { 1: [p(1), b(1)], 2: [p(9), b(2)], 3: [p(5), b(3)], 4: [g(3), b(4)] } });
  assert.equal(playAll(state, [b(1), b(2), b(3), b(4)]).phase, 'play');
  assert.equal(playAll({ ...state, chosen: [3] }, [p(1), p(9), p(5), g(3)]).roundSummary?.reason, 'Bob won a pink card, but only Cara may');
  // The ninth pink: success
  const tricks = [{ plays: [2, 3, 4, 6, 7, 8].map(value => ({ seat: 1, card: p(value) })), winner: 2 }];
  assert.equal(playAll({ ...state, tricks }, [p(1), p(9), p(5), g(3)]).roundSummary?.success, true);
});

ruleTest('omegaInLastTrick', 'the omega task must be won in the last trick', () => {
  const state = game({ mission: 48, tasks: [task(p(1), 1, 'omega')], hands: four });
  assert.equal(playAll(state, [p(9), p(1), p(5), p(3)]).roundSummary?.success, false);
  const last = { ...state, tricks: Array.from({ length: totalTricks(4) - 1 }, () => ({ plays: [], winner: 1 })) };
  assert.equal(playAll(last, [p(9), p(1), p(5), p(3)]).roundSummary?.success, true);
});

ruleTest('relay', 'the commander names who wins the first four tricks and who wins the last', () => {
  let state = dealMission({ ...lobby(4), mission: 50, startMission: 50 }, seeded(1));
  const commander = state.commander ?? assert.fail();
  assert.equal(state.phase, 'decision');
  state = ok(move(state, commander, { type: 'choosePlayer', seat: 2 }));
  assert.equal(state.phase, 'decision');
  assert.deepEqual(move(state, commander, { type: 'choosePlayer', seat: 2 }), { error: 'Choose a different crew member for the last trick' });
  state = ok(move(state, commander, { type: 'choosePlayer', seat: 3 }));
  assert.deepEqual(state.chosen, [2, 3]);
  assert.equal(state.phase, 'play');
  assert.equal(state.gameStatus, `${state.playerNames[commander]} chose Cara to win the last trick`);
  // Bob must win the first trick
  const play = game({ mission: 50, tasks: [], chosen: [2, 3], hands: four });
  assert.equal(playAll(play, [p(9), p(1), p(5), p(3)]).roundSummary?.reason,
    'Bob must win only tricks 1 to 4, Cara only the last trick, and the others every trick between');
});

test('the distress signal: everyone passes a card the same way, and the mission counts one more attempt', () => {
  const hands = { 1: [p(9), r(4), b(1)], 2: [p(1), g(2), b(2)], 3: [p(5), g(3), b(3)], 4: [y(2), p(3), b(4)] };
  let state = game({ hands });
  state = ok(move(state, 1, { type: 'distress', direction: 'left' }));
  assert.equal(state.phase, 'distress');
  assert.equal(state.distressUsed, true);
  assert.equal(state.gameStatus, 'Alice sent a distress signal: everyone passes a card to the left');
  assert.deepEqual(move(state, 1, { type: 'play', card: p(9) }), { error: 'Wait for everyone to pass a card' });
  assert.deepEqual(act(state, 1, { type: 'passCard', card: r(4) }), { error: 'Rockets are never passed' });
  state = ok(act(state, 1, { type: 'passCard', card: b(1) }));
  assert.deepEqual(thecrew.waitingOn?.(state), [2, 3, 4]);
  assert.deepEqual(act(state, 1, { type: 'passCard', card: p(9) }), { error: 'You have already passed a card' });
  // Each sees only their own pass
  assert.deepEqual(toPublicState(state, false, 1).distress, { direction: 'left', passed: [1], mine: b(1) });
  assert.deepEqual(toPublicState(state, false, 2).distress, { direction: 'left', passed: [1], mine: null });
  state = ok(act(state, 2, { type: 'passCard', card: b(2) }));
  state = ok(act(state, 3, { type: 'passCard', card: b(3) }));
  state = ok(act(state, 4, { type: 'passCard', card: b(4) }));
  assert.equal(state.phase, 'play');
  assert.deepEqual(state.hands, { 1: [p(9), r(4), b(4)], 2: [p(1), g(2), b(1)], 3: [p(5), g(3), b(2)], 4: [y(2), p(3), b(3)] });
  assert.equal(state.gameStatus, 'Everyone passed a card to the left');
  // Once per attempt, and never after a communication or a trick
  assert.deepEqual(move(state, 1, { type: 'distress', direction: 'right' }), { error: 'The distress signal was already used in this attempt' });
  const said = ok(act(game({ hands }), 2, { type: 'communicate', card: p(1), token: 'only' }));
  assert.deepEqual(move(said, 1, { type: 'distress', direction: 'right' }), { error: 'Send the distress signal before anyone communicates' });

  // The attempt count in the logbook goes up by one
  const done = playAll({ ...state, tasks: [task(p(1), 1)] }, [p(9), p(1), p(5), p(3)]);
  assert.equal(done.roundSummary?.distress, true);
  assert.equal(done.gameStatus, 'Mission 1 complete! The distress signal counts one more attempt');
});

test('with five players a task may be handed to another crew member before the first trick, from mission 25 on', () => {
  const five = {
    activePlayers: [1, 2, 3, 4, 5], playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan', 5: 'Eve' },
    hands: { 1: [p(9)], 2: [p(1)], 3: [p(5)], 4: [p(3)], 5: [p(2)] }, tasks: [task(p(1), 2), task(p(2), 3)]
  };
  assert.deepEqual(move(game({ ...five, mission: 24 }), 1, { type: 'handOverTask', task: 0, to: 1 }),
    { error: 'A task may be handed over only with five players, from mission 25 on' });
  let state = game({ ...five, mission: 25 });
  assert.deepEqual(move(state, 1, { type: 'handOverTask', task: 0, to: 2 }), { error: 'Hand the task to another crew member' });
  state = ok(move(state, 1, { type: 'handOverTask', task: 0, to: 1 }));
  assert.deepEqual(state.tasks.map(t => t.owner), [1, 3]);
  assert.equal(state.gameStatus, 'Bob handed the task pink 1 to Alice');
  assert.deepEqual(move(state, 1, { type: 'handOverTask', task: 1, to: 1 }), { error: 'Only one task may be handed over in each attempt' });
});

test('invalid moves', () => {
  const state = game();
  const bad: unknown[] = [
    null, 'play', 7, {}, { type: 'shout' }, { type: 'play' }, { type: 'play', card: { suit: 'pink', value: 10 } },
    { type: 'play', card: { suit: 'rocket', value: 5 } }, { type: 'play', card: { suit: 'red', value: 1 } },
    { type: 'play', card: { suit: 'pink', value: 1.5 } }, { type: 'play', card: g(9) },
    { type: 'takeTask', task: 0 }, { type: 'takeTask', task: 'a' }, { type: 'choosePlayer', seat: 2 }, { type: 'assignTask', seat: 2 },
    { type: 'moveToken', from: 0, to: 1 }, { type: 'keepTokens' }, { type: 'distress', direction: 'up' },
    { type: 'handOverTask', task: 0, to: 2 }
  ];
  for (const m of bad) assert.ok('error' in move(state, 1, m), `expected an error for ${JSON.stringify(m)}`);
  assert.deepEqual(move(state, 1, { type: 'play', card: g(9) }), { error: 'You do not have that card' });
  assert.deepEqual(move(state, 2, { type: 'play', card: p(1) }), { error: 'Not your turn' });

  const choosing = dealMission({ ...lobby(4), mission: 4, startMission: 4 }, seeded(1));
  const commander = choosing.commander ?? assert.fail();
  for (const index of [-1, 3, 1.5, null]) assert.ok('error' in move(choosing, commander, { type: 'takeTask', task: index }));
  assert.deepEqual(move(choosing, commander, { type: 'play', card: choosing.hands[commander][0] }), { error: 'Take the tasks first' });

  const badActions: unknown[] = [null, {}, { type: 'other' }, { type: 'communicate' }, { type: 'communicate', card: p(9), token: 'middle' },
    { type: 'passCard', card: p(9) }, { type: 'voteEnd', yes: 'yes' }, { type: 'acknowledgeRound' }];
  for (const a of badActions) assert.ok('error' in act(state, 1, a), `expected an error for ${JSON.stringify(a)}`);
  assert.deepEqual(act(state, 1, { type: 'acknowledgeRound' }), { error: 'Nothing to continue' });
  assert.deepEqual(act(state, 1, { type: 'other' }), { error: 'Unknown action' });
});

test('dismissed player mid-turn', () => {
  // Dismissed while choosing a task on their own turn, and while the crew waits for their distress pass
  const choosing = dealMission({ ...lobby(4), mission: 4, startMission: 4 }, seeded(1));
  const commander = choosing.commander ?? assert.fail();
  const gone = removePlayer(thecrew, disconnectPlayer(thecrew, { ...choosing, started: true }, commander, seeded(1)), commander, seeded(1));
  assert.equal(gone.isGameOver, true);
  assert.equal(gone.currentPlayer, null);

  let passing = ok(move(game(), 1, { type: 'distress', direction: 'right' }));
  passing = ok(act(passing, 1, { type: 'passCard', card: b(1) }));
  const ended = removePlayer(thecrew, disconnectPlayer(thecrew, passing, 2, seeded(1)), 2, seeded(1));
  assert.equal(ended.isGameOver, true);
  assert.deepEqual(move(ended, 1, { type: 'play', card: p(9) }), { error: 'The game is over' });
  assert.deepEqual(act(ended, 3, { type: 'passCard', card: b(3) }), { error: 'The game is over' });
});

test('table view hides hands', () => {
  // Every step of a short game: choosing tasks, a distress pass and a few tricks
  let state = dealMission({ ...lobby(4), mission: 4, startMission: 4 }, seeded(5));
  const steps: GameState[] = [state];
  while (state.phase === 'choose') {
    const seat = state.currentPlayer ?? assert.fail();
    steps.push(state = ok(move(state, seat, { type: 'takeTask', task: state.tasks.findIndex(t => t.owner === null) })));
  }
  const commander = state.commander ?? assert.fail();
  steps.push(state = ok(move(state, commander, { type: 'distress', direction: 'left' })));
  for (const seat of state.activePlayers) {
    const card = state.hands[seat].find(c => c.suit !== 'rocket') ?? assert.fail();
    steps.push(state = ok(act(state, seat, { type: 'passCard', card })));
  }
  for (let i = 0; i < 8 && state.phase === 'play'; i++) {
    const seat = state.currentPlayer ?? assert.fail();
    const hand = state.hands[seat];
    const led = state.trick[0]?.card.suit;
    const card = hand.find(c => c.suit === led) ?? hand[0];
    steps.push(state = ok(move(state, seat, { type: 'play', card })));
  }
  for (const step of steps) {
    const table: PublicGameState = toPublicState(step, false, null) as PublicGameState;
    const text = JSON.stringify(table);
    assert.deepEqual(table.hand, []);
    for (const key of ['hands', 'tricks']) assert.equal(key in table, false);
    assert.equal(table.distress?.mine ?? null, null);
    const shown = [...step.trick, ...(step.lastTrick?.plays ?? [])].map(play => JSON.stringify(play.card));
    for (const card of [...Object.values(step.hands).flat()]) {
      // Task cards are public, and so are the cards in the trick
      if (!shown.includes(JSON.stringify(card)) && !step.tasks.some(t => JSON.stringify(t.card) === JSON.stringify(card))) {
        assert.equal(text.includes(JSON.stringify(card)), false, `${cardName(card)} leaked`);
      }
    }
    for (const seat of step.activePlayers) {
      const own = toPublicState(step, false, seat);
      assert.deepEqual(own.hand, step.hands[seat]);
      assert.equal(own.handCounts[seat], step.hands[seat].length);
    }
  }
});

test('describes moves for the status line', () => {
  const names = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
  assert.equal(describeMove({ type: 'takeTask', playerNumber: 1, card: p(3), token: 1 }, names), 'Alice took the task pink 3, order token 1');
  assert.equal(describeMove({ type: 'takeTask', playerNumber: 1, card: p(3), token: 'omega' }, names), 'Alice took the task pink 3, order token Ω');
  assert.equal(describeMove({ type: 'play', playerNumber: 2, card: r(2), trickWinner: null, result: null }, names), 'Bob played rocket 2');
  assert.equal(describeMove({ type: 'play', playerNumber: 2, card: r(2), trickWinner: 2, result: null }, names), 'Bob played rocket 2 and won the trick');
  assert.equal(describeMove({ type: 'play', playerNumber: 2, card: b(2), trickWinner: 3, result: 'failure' }, names),
    'Bob played blue 2; Cara won the trick. The mission failed');
  assert.equal(describeMove({ type: 'keepTokens', playerNumber: 1 }, names), 'Alice left the order tokens where they were');
});
