import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fictionaryInfo } from './info.ts';
import {
  applyAction, applyMove, createGameState, deadline, onDeadline, onPlayerLeft, recordsAction, resetLobby, waitingOn
} from './rules.ts';
import { addPlayer, removePlayer } from '../../shared/seating.ts';
import { withRules } from '../../server/testing.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import type { BasePublicState, Result } from '../../shared/types.ts';
import type { GameState } from './types.ts';

const NOW = 1_000_000;
const first = () => 0;
const QUILLON = { word: 'quillon', definition: 'either arm of the cross guard of a sword' };

// Enough of the definition for seating; index.ts comes with the views
const fictionary = { info: fictionaryInfo, createGameState, resetLobby, applyMove, onPlayerLeft, toPublicState: (state: GameState) => state } as unknown as GameDefinition<GameState, BasePublicState>;

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function lobby(names: string[], values: HouseRuleValues = {}): GameState {
  let state: GameState = { ...createGameState('g'), houseRules: withRules(values) };
  for (const name of names) {
    const result = addPlayer(fictionary, state, name, first);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// Alice, Bob and Cara writing a definition of quillon from NOW
function writing(names = ['Alice', 'Bob', 'Cara'], values: HouseRuleValues = {}): GameState {
  const state = lobby(names, values);
  return { ...state, deck: [QUILLON, ...state.deck.slice(1)], ...QUILLON, phaseStartedAt: NOW, started: true };
}

const write = (state: GameState, seat: number, text: string, now = NOW) => ok(applyAction(state, seat, { type: 'write', text }, first, now));
const vote = (state: GameState, seat: number, choice: number, now = NOW) => ok(applyAction(state, seat, { type: 'vote', choice }, first, now));
const cont = (state: GameState, seat: number, now = NOW) => ok(applyAction(state, seat, { type: 'continue' }, first, now));

const realIndex = (state: GameState) => state.choices.findIndex(choice => choice.real);
const indexOf = (state: GameState, text: string) => state.choices.findIndex(choice => choice.text === text);

// Three different fakes: Alice's, Bob's and Cara's
function voting(): GameState {
  return write(write(write(writing(), 1, 'a small bird'), 2, 'a kind of pastry'), 3, 'a river boat');
}

test('an action before the clock starts is refused', () => {
  const state = lobby(['Alice', 'Bob', 'Cara']);
  assert.equal(state.phaseStartedAt, null);
  assert.equal(state.phase, 'writing');
  assert.equal(state.word, state.deck[0].word);
  assert.deepEqual(applyAction(state, 1, { type: 'write', text: 'a bird' }, first, NOW), { error: 'Wait for everyone to agree to the house rules' });
  assert.deepEqual(applyAction(state, 1, { type: 'continue' }, first, NOW), { error: 'Wait for everyone to agree to the house rules' });
});

test('writing closes once everyone has written, and the choices are the fakes plus the real one', () => {
  let state = write(writing(), 1, 'a small bird');
  assert.equal(state.gameStatus, 'Alice wrote a definition');
  assert.deepEqual(waitingOn(state), [2, 3]);
  state = write(write(state, 2, 'a kind of pastry'), 3, 'a river boat');
  assert.equal(state.phase, 'voting');
  assert.equal(state.choices.length, 4);
  assert.equal(state.choices.filter(choice => choice.real).length, 1);
  assert.deepEqual(state.lastMove, { type: 'closeWriting', reason: 'allWritten' });
  assert.equal(state.gameStatus, 'Vote for the real definition');
  assert.deepEqual(applyAction(state, 1, { type: 'write', text: 'late' }, first, NOW), { error: 'Writing is over' });
});

test('a definition is 1 to 150 characters', () => {
  const state = writing();
  for (const text of ['   ', 'x'.repeat(151), 7]) {
    assert.deepEqual(applyAction(state, 1, { type: 'write', text }, first, NOW), { error: 'Definitions are 1 to 150 characters' });
  }
  assert.equal(write(state, 1, `  ${'x'.repeat(150)}  `).submissions[1], 'x'.repeat(150));
  assert.equal(write(write(state, 1, 'first'), 1, 'second').submissions[1], 'second');
});

test('a submission matching the real definition scores 3 and is not a choice', () => {
  let state = write(write(write(writing(), 1, 'a small bird'), 2, 'Either arm of the cross-guard of a sword.'), 3, 'a river boat');
  assert.deepEqual(state.matched, [2]);
  assert.equal(state.choices.length, 3);
  assert.equal(state.gameStatus, 'Vote for the real definition (Bob wrote the real one)');
  assert.deepEqual(applyAction(state, 2, { type: 'vote', choice: realIndex(state) }, first, NOW), { error: 'You already know the real definition' });
  state = vote(vote(state, 1, realIndex(state)), 3, indexOf(state, 'a small bird'));
  assert.equal(state.phase, 'reveal');
  assert.ok((state.roundPoints[2] ?? 0) >= 3);
});

test('identical fakes become one choice with both authors', () => {
  let state = write(write(write(writing(), 1, 'a small bird'), 2, 'a kind of pastry'), 3, 'a Small Bird.');
  assert.equal(state.choices.length, 3);
  const bird = state.choices.findIndex(choice => choice.authors.includes(1));
  assert.deepEqual(state.choices[bird].authors, [1, 3]);
  assert.deepEqual(applyAction(state, 3, { type: 'vote', choice: bird }, first, NOW), { error: 'You cannot vote for your own definition' });
  state = vote(vote(vote(state, 2, bird), 1, realIndex(state)), 3, realIndex(state));
  assert.equal(state.roundPoints[1], 3);
  assert.equal(state.roundPoints[3], 3);
});

test('fakes are shown in the style of the word list: lowercase, no closing period', () => {
  const state = write(write(write(writing(), 1, 'A Small Bird.'), 2, 'a kind of pastry'), 3, '...');
  assert.notEqual(indexOf(state, 'a small bird'), -1);
  assert.notEqual(indexOf(state, '...'), -1); // nothing left to style keeps the text as typed
  assert.equal(state.submissions[1], 'A Small Bird.');
});

test('scoring: 2 for the real one, 1 per vote to each author', () => {
  let state = voting();
  state = vote(vote(state, 1, realIndex(state)), 2, realIndex(state));
  state = vote(state, 3, indexOf(state, 'a small bird'));
  assert.equal(state.phase, 'reveal');
  assert.deepEqual(state.roundPoints, { 1: 3, 2: 2, 3: 0 });
  assert.deepEqual(state.scores, { 1: 3, 2: 2, 3: 0 });
  assert.deepEqual(state.reveal, { acknowledged: [] });
  assert.deepEqual(state.lastMove, { type: 'reveal', ...QUILLON });
  assert.equal(state.gameStatus, 'The real definition of quillon: either arm of the cross guard of a sword');
});

test('a vote for your own definition or a bad index is refused', () => {
  const state = voting();
  assert.deepEqual(applyAction(state, 1, { type: 'vote', choice: indexOf(state, 'a small bird') }, first, NOW), { error: 'You cannot vote for your own definition' });
  for (const choice of [-1, 4, 1.5, '0', undefined]) {
    assert.deepEqual(applyAction(state, 1, { type: 'vote', choice }, first, NOW), { error: 'Invalid choice' });
  }
  assert.deepEqual(applyAction(writing(), 1, { type: 'vote', choice: 0 }, first, NOW), { error: 'Voting is over' });
  // A changed mind replaces the vote
  const changed = vote(vote(state, 1, realIndex(state)), 1, indexOf(state, 'a river boat'));
  assert.equal(changed.votes[1], indexOf(state, 'a river boat'));
});

test('voting ends early once every voter has voted, else on its deadline', () => {
  assert.equal(deadline(writing()), NOW + 120_000);
  const later = NOW + 5_000;
  let state = write(write(write(writing(), 1, 'a small bird', later), 2, 'a kind of pastry', later), 3, 'a river boat', later);
  assert.equal(state.phaseStartedAt, later);
  assert.equal(deadline(state), later + 60_000);
  state = vote(state, 1, realIndex(state));
  assert.equal(state.phase, 'voting');
  assert.deepEqual(waitingOn(state), [2, 3]);
  const timedOut = onDeadline(state, later + 60_000, first);
  assert.equal(timedOut.phase, 'reveal');
  assert.deepEqual(timedOut.roundPoints, { 1: 2, 2: 0, 3: 0 });
  assert.equal(deadline(timedOut), null);
});

test('writing time ending with no fakes skips voting', () => {
  const state = onDeadline(writing(), NOW + 120_000, first);
  assert.equal(state.phase, 'reveal');
  assert.deepEqual(state.roundPoints, { 1: 0, 2: 0, 3: 0 });
  // Only the real one and Bob's matching entry: still nothing to vote between
  const matchedOnly = onDeadline(write(writing(), 2, 'either arm of the cross guard of a sword'), NOW + 120_000, first);
  assert.equal(matchedOnly.phase, 'reveal');
  assert.deepEqual(matchedOnly.roundPoints, { 1: 0, 2: 3, 3: 0 });
});

test('Continue waits for everyone, then the next word', () => {
  let state = onDeadline(writing(), NOW + 120_000, first);
  assert.deepEqual(waitingOn(state), [1, 2, 3]);
  state = cont(state, 1);
  assert.deepEqual(waitingOn(state), [2, 3]);
  const later = NOW + 200_000;
  state = cont(cont(state, 2, later), 3, later);
  assert.equal(state.round, 2);
  assert.equal(state.phase, 'writing');
  assert.equal(state.word, state.deck[1].word);
  assert.notEqual(state.word, 'quillon');
  assert.equal(state.phaseStartedAt, later);
  assert.deepEqual(state.submissions, {});
  assert.equal(state.reveal, null);
  assert.deepEqual(state.lastMove, { type: 'nextWord', round: 2 });
});

test('the last word ends the game at its reveal', () => {
  let state = writing(['Alice', 'Bob', 'Cara'], { wordCount: 5 });
  assert.equal(state.deck.length, 5);
  for (let round = 1; round <= 5; round++) {
    state = write(write(write(state, 1, `fake one ${round}`), 2, `fake two ${round}`), 3, `fake three ${round}`);
    state = vote(vote(vote(state, 1, realIndex(state)), 2, realIndex(state)), 3, indexOf(state, `fake one ${round}`));
    if (round < 5) state = cont(cont(cont(state, 1), 2), 3);
  }
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.reveal, null);
  assert.equal(state.gameStatus, 'Alice won with 15 points');
  assert.deepEqual(applyAction(state, 1, { type: 'continue' }, first, NOW), { error: 'The game is over' });
});

test('a dismissal down to two players ends the game with the scores as they stand', () => {
  const state = { ...voting(), scores: { 1: 4, 2: 6, 3: 1 } };
  const after = removePlayer(fictionary, state, 3, first);
  assert.equal(after.isGameOver, true);
  assert.deepEqual(after.winners, [2]);
  assert.equal(after.gameStatus, 'Not enough players left: Bob won with 6 points');
});

// onPlayerLeft gets no `now`, so a phase the dismissal completes falls due at once and onDeadline closes it on the server clock
test('a dismissal of the only seat still writing closes writing', () => {
  let state = writing(['Alice', 'Bob', 'Cara', 'Dan']);
  state = write(write(write(state, 1, 'a small bird'), 2, 'a kind of pastry'), 3, 'a river boat');
  state = removePlayer(fictionary, state, 4, first);
  assert.ok((deadline(state) ?? Infinity) <= NOW);
  state = onDeadline(state, NOW + 1, first);
  assert.equal(state.phase, 'voting');
  assert.deepEqual(state.lastMove, { type: 'closeWriting', reason: 'allWritten' });
  assert.equal(state.phaseStartedAt, NOW + 1);
});

test('a dismissal drops the leaver\'s vote, and the last vote missing falls due at once', () => {
  let state = writing(['Alice', 'Bob', 'Cara', 'Dan']);
  state = write(write(write(write(state, 1, 'a small bird'), 2, 'a kind of pastry'), 3, 'a river boat'), 4, 'a hat');
  state = vote(vote(vote(state, 1, realIndex(state)), 2, realIndex(state)), 4, realIndex(state));
  state = removePlayer(fictionary, state, 3, first);
  assert.equal(state.submissions[3], undefined);
  assert.equal(indexOf(state, 'a river boat') >= 0, true);
  assert.ok((deadline(state) ?? Infinity) <= NOW);
  assert.equal(onDeadline(state, NOW + 1, first).phase, 'reveal');
});

test('status and lastMove never hold the real definition or an author before the reveal', () => {
  const texts = ['a small bird', 'a kind of pastry', 'a river boat'];
  let state = writing();
  const seen: string[] = [];
  const look = () => seen.push(JSON.stringify({ gameStatus: state.gameStatus, lastMove: state.lastMove }));
  texts.forEach((text, i) => { state = write(state, i + 1, text); look(); });
  state = vote(state, 1, realIndex(state)); look();
  state = vote(state, 2, realIndex(state)); look();
  state = vote(state, 3, indexOf(state, 'a small bird')); // the reveal
  for (const json of seen) {
    assert.equal(json.includes('cross guard'), false, json);
    for (const text of texts) assert.equal(json.includes(text), false, json);
  }
});

const SWORD = 'either arm of the cross guard of a sword';

test('a vote whose only legal choice is the real one is skipped', () => {
  // Alice and Bob matched; Cara, the only voter, wrote the only fake
  const state = write(write(write(writing(), 1, SWORD), 2, SWORD), 3, 'a small bird');
  assert.equal(state.phase, 'reveal');
  assert.deepEqual(state.roundPoints, { 1: 3, 2: 3, 3: 0 });
});

test('every voter matched skips voting', () => {
  const state = write(write(write(writing(), 1, SWORD), 2, SWORD), 3, 'Either arm of the cross-guard of a sword.');
  assert.deepEqual(state.matched, [1, 2, 3]);
  assert.equal(state.phase, 'reveal');
  assert.deepEqual(state.roundPoints, { 1: 3, 2: 3, 3: 3 });
});

test('a write during voting is refused as over, whatever its length', () => {
  assert.deepEqual(applyAction(voting(), 1, { type: 'write', text: 'x'.repeat(151) }, first, NOW), { error: 'Writing is over' });
});

test('a leave during the reveal that makes everyone ready falls due at once', () => {
  let state = onDeadline(writing(['Alice', 'Bob', 'Cara', 'Dan']), NOW + 120_000, first);
  state = cont(cont(cont(state, 1), 2), 3);
  assert.equal(deadline(state), null);
  state = removePlayer(fictionary, state, 4, first);
  assert.equal(deadline(state), 0);
  state = onDeadline(state, NOW + 1, first);
  assert.equal(state.round, 2);
  assert.equal(state.phaseStartedAt, NOW + 1);
  // With nobody connected nothing falls due, so the words do not run on with nobody there
  const empty = { ...onDeadline(writing(), NOW + 120_000, first), disconnected: [1, 2, 3] };
  assert.equal(deadline(empty), null);
});

test('recordsAction: known actions once the clock runs, until the game ends', () => {
  const state = writing();
  assert.equal(recordsAction(state, 1, { type: 'write', text: 'a bird' }), true);
  assert.equal(recordsAction(state, 1, { type: 'continue' }), true);
  assert.equal(recordsAction(state, 1, { type: 'chat', text: 'hi' }), false);
  assert.equal(recordsAction(state, 1, null), false);
  assert.equal(recordsAction(lobby(['Alice', 'Bob', 'Cara']), 1, { type: 'write', text: 'a bird' }), false);
  assert.equal(recordsAction({ ...state, isGameOver: true }, 1, { type: 'vote', choice: 0 }), false);
});
