import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { dice, game, played } from '../testing.ts';

test('describes an attack and its capture', () => {
  const state = game({ phase: 'attack', reinforcements: 0, armies: { ...game().armies, alaska: 5, kamchatka: 1 } });
  const won = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(6, 2, 1, 5));
  assert.equal(describeMove(won),
    'Alice attacked Kamchatka (Cara) from Alaska, rolled 6, 2, 1 against 5: the attacker lost 0, the defender 1. Alice captured Kamchatka');
});

test('describes placing armies and ending a turn without naming a drawn card', () => {
  const placed = played(game(), 1, { type: 'place', placements: { alaska: 3 } });
  assert.equal(describeMove(placed), 'Alice placed 3 on Alaska');
  const ended = played({ ...placed, conqueredThisTurn: true }, 1, { type: 'endTurn' });
  assert.equal(describeMove(ended), 'Alice drew a card. Alice ended their turn. Bob receives 4 armies');
});

test('a state without a move has no description', () => {
  assert.equal(describeMove({ lastMove: null }), '');
});
