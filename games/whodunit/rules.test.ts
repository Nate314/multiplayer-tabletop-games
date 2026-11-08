import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whodunit } from './index.ts';
import { canAccuse, holderOrder, nextTurn, settleEnd } from './rules.ts';
import { destinations } from './movement.ts';
import { STARTS } from './board.ts';
import { CARDS, kindOf } from './content.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import { seeded } from '../testStates.ts';
import type { Random, Result } from '../../shared/types.ts';
import type { GameState, Solution } from './types.ts';
import type { Cell } from './board.ts';

// Each value is one die face, read in order and then repeated
function dice(...faces: number[]): Random {
  let next = 0;
  return () => (faces[next++ % faces.length] - 0.5) / 6;
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];
function lobby(seats = 3): GameState {
  let state = whodunit.createGameState('g');
  for (const name of NAMES.slice(0, seats)) {
    const result = addPlayer(whodunit, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

const play = (state: GameState, seat: number, move: unknown, random: Random = dice(1)) => applyMove(whodunit, state, seat, move, random);
const SOLUTION: Solution = { suspect: 'commodore-brine', object: 'harpoon', room: 'boathouse' };

// Alice (seat 1, Commodore Brine) in the Galley, ready to suggest, with the hands given
function inRoom(hands: GameState['hands']): GameState {
  const state = lobby();
  return { ...state, solution: SOLUTION, hands, phase: 'room', positions: { ...state.positions, 'commodore-brine': { room: 'galley' } } };
}
const SUGGEST = { type: 'suggest', suspect: 'miss-gull', object: 'boat-oar' };

test('the deal hides one of each kind and deals the rest', () => {
  for (const [seats, sizes] of [[3, [6, 6, 6]], [4, [5, 5, 4, 4]]] as const) {
    const state = lobby(seats);
    const { suspect, object, room } = state.solution!;
    assert.deepEqual([kindOf(suspect), kindOf(object), kindOf(room)], ['suspect', 'object', 'room']);
    assert.deepEqual(state.activePlayers.map(seat => state.hands[seat].length), sizes);
    const all = [...Object.values(state.hands).flat(), suspect, object, room];
    assert.deepEqual([...all].sort(), [...CARDS].sort());
    assert.equal(state.phase, 'start');
    assert.equal(state.currentPlayer, 1);
    assert.equal(new Set(Object.values(state.objectRooms)).size, 6);
  }
});

test('a roll offers only reachable squares and a move must pick one', () => {
  const state = ok(play(lobby(), 1, { type: 'roll' }, dice(3, 4)));
  assert.deepEqual(state.dice, [3, 4]);
  assert.equal(state.phase, 'move');
  const others = Object.entries(STARTS).filter(([id]) => id !== 'commodore-brine').map(([, cell]) => cell);
  assert.deepEqual(state.destinations, destinations(STARTS['commodore-brine'], 7, others, null));
  assert.deepEqual(play(state, 1, { type: 'moveTo', to: { row: 99, col: 99 } }), { error: 'Not a square you can reach' });
  const to = state.destinations[0];
  const moved = ok(play(state, 1, { type: 'moveTo', to }));
  assert.deepEqual(moved.positions['commodore-brine'], to);
  assert.equal(moved.phase, 'room' in to ? 'room' : 'end');
  assert.deepEqual(play(lobby(), 1, { type: 'moveTo', to }), { error: 'Roll first' });
});

test('a passage goes to the opposite corner room', () => {
  const base = lobby();
  const state = ok(play({ ...base, positions: { ...base.positions, 'commodore-brine': { room: 'boathouse' } } }, 1, { type: 'passage' }));
  assert.deepEqual(state.positions['commodore-brine'], { room: 'wine-cellar' });
  assert.equal(state.phase, 'room');
});

test('no passage outside a corner room', () => {
  const base = lobby();
  assert.deepEqual(play(base, 1, { type: 'passage' }), { error: 'No secret passage here' });
  const inFoyer = { ...base, positions: { ...base.positions, 'commodore-brine': { room: 'grand-foyer' as const } } };
  assert.deepEqual(play(inFoyer, 1, { type: 'passage' }), { error: 'No secret passage here' });
});

test('a suggestion moves the suspect and object into the room', () => {
  const state = ok(play(inRoom({ 1: [], 2: [], 3: [] }), 1, SUGGEST));
  assert.deepEqual(state.positions['miss-gull'], { room: 'galley' });
  assert.equal(state.objectRooms['boat-oar'], 'galley');
  assert.deepEqual(state.movedIn, ['miss-gull']);
  assert.deepEqual(play(lobby(), 1, SUGGEST), { error: 'Suggest from inside a room' });
});

test('the first holder clockwise shows; one match is shown at once', () => {
  const state = ok(play(inRoom({ 1: [], 2: ['harpoon'], 3: ['boat-oar', 'salt-spa'] }), 1, SUGGEST));
  const suggestion = state.suggestions[0];
  assert.deepEqual(suggestion.passed, [2]);
  assert.equal(suggestion.shownBy, 3);
  assert.deepEqual(state.seen, [{ suggestion: 0, from: 3, to: 1, card: 'boat-oar' }]);
  assert.equal(state.phase, 'end');
  assert.equal(state.lastMove?.sealed, true);
  assert.ok(state.gameStatus.endsWith('Cara showed a card'));
});

test('a holder with two matches chooses', () => {
  const state = ok(play(inRoom({ 1: [], 2: ['boat-oar', 'galley', 'salt-spa'], 3: ['miss-gull'] }), 1, SUGGEST));
  assert.equal(state.phase, 'showing');
  assert.equal(state.suggestions[0].awaiting, 2);
  assert.deepEqual(whodunit.waitingOn!(state), [2]);
  assert.equal(state.lastMove?.sealed, undefined);
  assert.deepEqual(play(state, 3, { type: 'show', card: 'miss-gull' }), { error: 'Not your turn' });
  assert.deepEqual(play(state, 2, { type: 'show', card: 'salt-spa' }), { error: 'Show one of the cards asked about' });
  assert.deepEqual(play(state, 2, { type: 'show', card: 'miss-gull' }), { error: 'Show one of the cards asked about' });
  assert.deepEqual(play(state, 1, { type: 'endTurn' }), { error: 'Wait for the card to be shown' });
  const shown = ok(play(state, 2, { type: 'show', card: 'galley' }));
  assert.deepEqual(shown.seen, [{ suggestion: 0, from: 2, to: 1, card: 'galley' }]);
  assert.equal(shown.suggestions[0].shownBy, 2);
  assert.equal(shown.suggestions[0].awaiting, null);
  assert.equal(shown.phase, 'end');
  assert.equal(shown.currentPlayer, 1);
  assert.equal(shown.lastMove?.sealed, true);
  assert.ok(!shown.gameStatus.includes('Galley'));
  assert.deepEqual(whodunit.waitingOn!(shown), []);
});

test('nobody can show', () => {
  const state = ok(play(inRoom({ 1: ['miss-gull'], 2: [], 3: [] }), 1, SUGGEST));
  assert.equal(state.suggestions[0].shownBy, null);
  assert.deepEqual(state.suggestions[0].passed, [2, 3]);
  assert.deepEqual(state.seen, []);
  assert.equal(state.phase, 'end');
  assert.equal(state.lastMove?.sealed, undefined);
});

test('a token moved by a suggestion may stay and suggest there', () => {
  const suggested = ok(play(inRoom({ 1: [], 2: [], 3: [] }), 1, { type: 'suggest', suspect: 'madame-coral', object: 'harpoon' }));
  const bobsTurn = ok(play(suggested, 1, { type: 'endTurn' }));
  assert.equal(bobsTurn.currentPlayer, 2);
  const stayed = ok(play(bobsTurn, 2, { type: 'stay' }));
  assert.equal(stayed.phase, 'room');
  ok(play(stayed, 2, { type: 'suggest', suspect: 'miss-gull', object: 'harpoon' }));
  const later = nextTurn(ok(play(stayed, 2, { type: 'endTurn' })), 1);
  assert.equal(later.currentPlayer, 2);
  assert.deepEqual(play(later, 2, { type: 'stay' }), { error: 'You can stay only in a room a suggestion moved you into' });
  // Alice suggesting her own suspect does not let her stay next turn
  const own = ok(play(inRoom({ 1: [], 2: [], 3: [] }), 1, { type: 'suggest', suspect: 'commodore-brine', object: 'harpoon' }));
  assert.deepEqual(own.movedIn, []);
});

test('a wrong accusation puts the player out but they still show', () => {
  const base = inRoom({ 1: ['boat-oar'], 2: [], 3: [] });
  const accused = ok(play({ ...base, phase: 'start' }, 1, { type: 'accuse', suspect: 'miss-gull', object: 'harpoon', room: 'boathouse' }));
  assert.deepEqual(accused.out, [1]);
  assert.equal(accused.currentPlayer, 2);
  assert.equal(accused.gameStatus, 'Alice accused wrongly and is out of turns');
  assert.equal(accused.lastMove?.sealed, true);
  assert.deepEqual(accused.accusations, [{ suspect: 'miss-gull', object: 'harpoon', room: 'boathouse', by: 1, correct: false }]);
  assert.deepEqual(canAccuse(accused), [2, 3]);
  const carasTurn = ok(play({ ...accused, phase: 'end' }, 2, { type: 'endTurn' }));
  assert.equal(carasTurn.currentPlayer, 3);
  const backToBob = ok(play({ ...carasTurn, phase: 'end' }, 3, { type: 'endTurn' }));
  assert.equal(backToBob.currentPlayer, 2);
  assert.deepEqual(holderOrder(carasTurn, 3), [1, 2]);
  const cara = { ...carasTurn, phase: 'room' as const, positions: { ...carasTurn.positions, 'doctor-tidewell': { room: 'galley' as const } } };
  const shown = ok(play(cara, 3, SUGGEST));
  assert.equal(shown.suggestions[0].shownBy, 1);
  assert.deepEqual(play(accused, 1, { type: 'roll' }), { error: 'Not your turn' });
});

test('a right accusation wins and reveals', () => {
  const state = ok(play(inRoom({ 1: [], 2: [], 3: [] }), 1, { type: 'accuse', ...SOLUTION }));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.gameStatus, 'Alice solved it: Commodore Brine with the Harpoon in the Boathouse');
  assert.equal(state.lastMove?.sealed, true);
});

test('all but one out: the last one wins', () => {
  const wrong = { type: 'accuse', suspect: 'miss-gull', object: 'harpoon', room: 'boathouse' };
  const first = ok(play({ ...lobby(), solution: SOLUTION }, 1, wrong));
  const second = ok(play(first, 2, wrong));
  assert.equal(second.isGameOver, true);
  assert.deepEqual(second.winners, [3]);
  assert.equal(second.gameStatus, 'Cara wins: everyone else is out');
  const none = settleEnd({ ...second, isGameOver: false, winners: [], out: [1, 2, 3] });
  assert.equal(none.isGameOver, true);
  assert.deepEqual(none.winners, []);
  assert.equal(none.gameStatus, 'Nobody solved it');
});

test('Stay put only when the roll has nowhere to go', () => {
  const base = lobby();
  const door = (row: number, col: number): Cell => ({ row, col });
  // Both Boathouse doors are blocked, and the Boathouse has a passage but Alice rolls instead
  const boxed = { ...base, positions: { ...base.positions, 'commodore-brine': { room: 'boathouse' as const }, 'madame-coral': door(3, 6), 'doctor-tidewell': door(6, 3) } };
  const rolled = ok(play(boxed, 1, { type: 'roll' }, dice(2, 3)));
  assert.deepEqual(rolled.destinations, []);
  const stayed = ok(play(rolled, 1, { type: 'stayPut' }));
  assert.equal(stayed.phase, 'room');
  assert.deepEqual(stayed.positions['commodore-brine'], { room: 'boathouse' });
  const free = ok(play(base, 1, { type: 'roll' }, dice(2, 3)));
  assert.ok(free.destinations.length > 0);
  assert.deepEqual(play(free, 1, { type: 'stayPut' }), { error: 'Not now' });
});

test('notes are kept per seat', () => {
  const state = lobby();
  const noted = ok(whodunit.applyAction!(state, 1, { type: 'note', card: 'harpoon', mark: 'yes' }, dice(1), 0));
  assert.deepEqual(noted.notes[1], { harpoon: 'yes' });
  assert.deepEqual(noted.notes[2], {});
  const cleared = ok(whodunit.applyAction!(noted, 1, { type: 'note', card: 'harpoon', mark: null }, dice(1), 0));
  assert.deepEqual(cleared.notes[1], {});
  assert.deepEqual(whodunit.applyAction!(state, 1, { type: 'note', card: 'not-a-card', mark: 'yes' }, dice(1), 0), { error: 'Invalid action' });
  assert.deepEqual(whodunit.applyAction!(state, 9, { type: 'note', card: 'harpoon', mark: 'yes' }, dice(1), 0), { error: 'Invalid action' });
});
