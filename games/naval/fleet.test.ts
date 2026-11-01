import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../testStates.ts';
import { cellName, fleetError, randomFleet, shipCells, shotsText } from './fleet.ts';
import type { Ship } from './types.ts';

const FLEET_REFUSAL = 'Place one ship of each length: 5, 4, 3, 3 and 2';

function validFleet(): Ship[] {
  return [5, 4, 3, 3, 2].map((length, row) => ({ length, row, col: 1, orientation: 'across' }) as Ship);
}

test('cellName names rows A to J and columns 1 to 10', () => {
  assert.equal(cellName({ row: 0, col: 0 }), 'A1');
  assert.equal(cellName({ row: 1, col: 6 }), 'B7');
  assert.equal(cellName({ row: 9, col: 9 }), 'J10');
});

test('shipCells runs across or down from the top left end', () => {
  const cells = shipCells({ length: 3, row: 2, col: 4, orientation: 'down' });
  assert.equal(cells.map(cellName).join(', '), 'C5, D5, E5');
});

test('a valid fleet passes, and touching ships are allowed', () => {
  assert.equal(fleetError(validFleet()), null);
});

test('fleetError refuses a wrong fleet', () => {
  const fleet = validFleet();
  assert.equal(fleetError(fleet.slice(0, 4)), FLEET_REFUSAL);
  assert.equal(fleetError([{ ...fleet[0] }, { ...fleet[0], row: 5 }, fleet[2], fleet[3], fleet[4]]), FLEET_REFUSAL);
  assert.equal(fleetError([{ ...fleet[0], length: 1 }, ...fleet.slice(1)]), FLEET_REFUSAL);
  assert.equal(fleetError('ships'), FLEET_REFUSAL);
  assert.equal(fleetError([{ ...fleet[0], orientation: 'diagonal' }, ...fleet.slice(1)]), FLEET_REFUSAL);
  assert.equal(fleetError([{ ...fleet[0], row: 0, col: 6 }, ...fleet.slice(1)]), 'A ship goes off the grid');
  assert.equal(fleetError([{ ...fleet[0], row: 0.5 }, ...fleet.slice(1)]), 'A ship goes off the grid');
  assert.equal(fleetError([fleet[0], { ...fleet[1], row: 0, col: 2 }, ...fleet.slice(2)]), 'Ships cannot overlap');
});

test('randomFleet always makes a valid fleet', () => {
  for (let seed = 0; seed < 200; seed++) assert.equal(fleetError(randomFleet(seeded(seed))), null);
});

test('shotsText names every result and the sunk length', () => {
  assert.equal(shotsText([{ row: 1, col: 6, result: 'miss' }]), 'B7: miss');
  assert.equal(
    shotsText([
      { row: 1, col: 6, result: 'hit' },
      { row: 2, col: 6, result: 'miss' },
      { row: 3, col: 6, result: 'sunk', sunkLength: 3 },
    ]),
    'B7, C7 and D7: hit, miss, sank a ship of length 3',
  );
});
