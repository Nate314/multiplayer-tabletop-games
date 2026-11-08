import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove, PublicGameState, Suggestion } from '../types.ts';

const suggestion = (extra: Partial<Suggestion>): Suggestion =>
  ({ suspect: 'miss-gull', object: 'harpoon', room: 'galley', by: 1, passed: [], shownBy: null, awaiting: null, ...extra });

// Only the fields describeMove reads; Alice plays Commodore Brine
function state(lastMove: LastMove | null, extra: Partial<PublicGameState> = {}): PublicGameState {
  return {
    lastMove,
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    suspectOf: { 1: 'commodore-brine', 2: 'madame-coral', 3: 'doctor-tidewell' },
    positions: { 'commodore-brine': { room: 'galley' } },
    suggestions: [],
    accusations: [],
    ...extra
  } as PublicGameState;
}

test('a roll names both dice', () => {
  assert.equal(describeMove(state({ type: 'roll', playerNumber: 1, dice: [4, 3] })), 'Alice rolled 4 and 3');
});

test('moves, passages and staying name the room', () => {
  assert.equal(describeMove(state({ type: 'moveTo', playerNumber: 1, to: { room: 'salt-spa' } })), 'Alice moved to the Salt Spa');
  assert.equal(describeMove(state({ type: 'moveTo', playerNumber: 1, to: { row: 0, col: 4 } })), 'Alice moved to row 1, column 5');
  assert.equal(describeMove(state({ type: 'passage', playerNumber: 1, to: { room: 'wine-cellar' } })), 'Alice took the secret passage to the Wine Cellar');
  assert.equal(describeMove(state({ type: 'stay', playerNumber: 1 })), 'Alice stayed in the Galley');
  assert.equal(describeMove(state({ type: 'stayPut', playerNumber: 1 })), 'Alice stayed put');
});

test('a suggestion says who showed, without the card', () => {
  const said = 'Alice suggested Miss Gull with the Harpoon in the Galley';
  assert.equal(describeMove(state({ type: 'suggest', playerNumber: 1 }, { suggestions: [suggestion({ awaiting: 2 })] })), said);
  assert.equal(describeMove(state({ type: 'suggest', playerNumber: 1, sealed: true }, { suggestions: [suggestion({ shownBy: 2 })] })), `${said}. Bob showed Alice a card`);
  assert.equal(describeMove(state({ type: 'suggest', playerNumber: 1 }, { suggestions: [suggestion({ passed: [2, 3] })] })), `${said}. Nobody could show Alice a card`);
  assert.equal(describeMove(state({ type: 'suggest', playerNumber: 1 }, { suggestions: [suggestion({ endedBy: 'dismissal' })] })), `${said}. Alice was dismissed before a card was shown`);
});

test('a chosen card shown names both players', () => {
  assert.equal(describeMove(state({ type: 'show', playerNumber: 2, sealed: true }, { suggestions: [suggestion({ shownBy: 2 })] })), 'Bob showed Alice a card');
});

test('an accusation says whether it was right', () => {
  const accused = { suspect: 'miss-gull', object: 'harpoon', room: 'galley', by: 1 } as const;
  const said = 'Alice accused Miss Gull with the Harpoon in the Galley';
  assert.equal(describeMove(state({ type: 'accuse', playerNumber: 1, sealed: true }, { accusations: [{ ...accused, correct: true }] })), `${said} and was right`);
  assert.equal(describeMove(state({ type: 'accuse', playerNumber: 1, sealed: true }, { accusations: [{ ...accused, correct: false }] })), `${said} and was wrong`);
});

test('ending the turn, and no move', () => {
  assert.equal(describeMove(state({ type: 'endTurn', playerNumber: 1 })), 'Alice ended the turn');
  assert.equal(describeMove(state(null)), '');
});
