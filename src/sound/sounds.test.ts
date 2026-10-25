import test from 'node:test';
import assert from 'node:assert/strict';
import { soundsFor, audible } from './sounds.ts';
import { unlockAudio, playSounds, loadSounds } from './synth.ts';
import { SOUNDS } from '../../shared/sounds.ts';
import { DEFAULT_PREFERENCES, type SoundName } from '../services/settings.ts';
import type { BasePublicState } from '../../shared/types.ts';

function state(overrides: Record<string, unknown> = {}): BasePublicState {
  return {
    gameId: 'g', started: true, currentPlayer: 2, activePlayers: [1, 2], playerNames: { 1: 'Alice', 2: 'Bob' },
    gameStatus: '', isGameOver: false, winners: [], undoVote: null, disconnected: [], dismissVote: null,
    undoAvailable: false, moveCount: 3, ...overrides,
  };
}

test('the first state after a join, rejoin or reload plays nothing', () => {
  assert.deepEqual(soundsFor(null, state({ currentPlayer: 1 }), 1), []);
});
test('a move by anyone clicks', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4 }), 1), ['move']);
});
test('a roll rattles instead of clicking', () => {
  for (const type of ['roll', 'attack', 'blitz'])
    assert.deepEqual(soundsFor(state(), state({ moveCount: 4, lastMove: { type } }), 1), ['dice']);
});
test("Parchisi's automatic roll after a move clicks and rattles", () => {
  const before = state({ dice: [{ value: 3, used: true }, { value: 5, used: true }] });
  const after = state({ moveCount: 4, dice: [{ value: 2, used: false }, { value: 6, used: false }] });
  assert.deepEqual(soundsFor(before, after, 1), ['move', 'dice']);
});
test('your turn arriving chimes after the move sound', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4, currentPlayer: 1 }), 1), ['move', 'turn']);
});
test('the second player joining gives the first player their turn', () => {
  assert.deepEqual(soundsFor(state({ moveCount: 0, currentPlayer: 1, activePlayers: [1] }), state({ moveCount: 0, currentPlayer: 1 }), 1), ['turn']);
});
test('a dismissal that hands you the turn chimes', () => {
  assert.deepEqual(soundsFor(state(), state({ currentPlayer: 1 }), 1), ['turn']);
});
test('an undo that gives the turn back plays nothing', () => {
  assert.deepEqual(soundsFor(state({ moveCount: 4 }), state({ moveCount: 3, currentPlayer: 1 }), 1), []);
});
test('a vote opening or being declined while it is already your turn does not chime', () => {
  const mine = state({ currentPlayer: 1 });
  assert.deepEqual(soundsFor(mine, { ...mine, undoVote: { requestedBy: 2, votes: {} } }, 1), []);
  assert.deepEqual(soundsFor({ ...mine, undoVote: { requestedBy: 2, votes: {} } }, mine, 1), []);
});
test('the game ending flourishes once, by a move or a resignation, and never chimes the turn', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4, isGameOver: true, currentPlayer: 1 }), 1), ['move', 'gameOver']);
  assert.deepEqual(soundsFor(state(), state({ isGameOver: true }), 1), ['gameOver']);
  assert.deepEqual(soundsFor(state({ isGameOver: true }), state({ isGameOver: true }), 1), []);
});
test('without a viewer (the History dialog) the turn never chimes', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4, currentPlayer: 1 }), null), ['move']);
});
test('a History jump or a step back plays nothing, not even the flourish', () => {
  assert.deepEqual(soundsFor(state({ moveCount: 0 }), state({ moveCount: 9, isGameOver: true }), null), []);
  assert.deepEqual(soundsFor(state({ moveCount: 9, isGameOver: true }), state({ moveCount: 8 }), null), []);
});
test('mute or a volume of 0 silences everything, and an unchecked group is left out', () => {
  const all: SoundName[] = ['move', 'dice', 'gameOver', 'turn', 'timer'];
  assert.deepEqual(audible(all, { ...DEFAULT_PREFERENCES, muted: true }), []);
  assert.deepEqual(audible(all, { ...DEFAULT_PREFERENCES, volume: 0 }), []);
  assert.deepEqual(audible(all, { ...DEFAULT_PREFERENCES, sounds: { ...DEFAULT_PREFERENCES.sounds, turn: false } }), ['move', 'dice', 'gameOver', 'timer']);
});
test('playing sounds without Web Audio or before a click does nothing and does not throw', () => {
  assert.doesNotThrow(() => { unlockAudio(); playSounds(['turn', 'dice']); });
});
test('a suspended or interrupted context is resumed and the sound plays once it runs', async () => {
  let oscillators = 0;
  let resumes = 0;
  class FakeAudioContext {
    static last: FakeAudioContext;
    state = 'running';
    currentTime = 0;
    destination = {};
    constructor() {
      FakeAudioContext.last = this;
    }
    resume() {
      resumes++;
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      oscillators++;
      const node = { type: '', frequency: { value: 0 }, connect: () => node, start() {}, stop() {} };
      return node;
    }
    createGain() {
      const node = { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => node };
      return node;
    }
  }
  const globals = globalThis as unknown as { AudioContext?: unknown; fetch: unknown };
  const original = globals.AudioContext;
  const originalFetch = globals.fetch;
  globals.AudioContext = FakeAudioContext;
  try {
    unlockAudio();
    playSounds(['move']);
    assert.equal(oscillators, 0, 'nothing plays before the sound data has loaded');
    globals.fetch = () => Promise.reject(new Error('offline'));
    await loadSounds();
    playSounds(['move']);
    assert.equal(oscillators, 0, 'a failed load stays silent');
    globals.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(SOUNDS) });
    await loadSounds();
    playSounds(['move']);
    assert.equal(oscillators, 1);
    // The browser suspends the context (Safari also "interrupts" it): the next sound revives it
    for (const state of ['suspended', 'interrupted']) {
      FakeAudioContext.last.state = state;
      const before = oscillators;
      playSounds(['move']);
      await Promise.resolve();
      assert.equal(oscillators, before + 1, state);
    }
    assert.equal(resumes, 2);
  } finally {
    globals.AudioContext = original;
    globals.fetch = originalFetch;
  }
});
