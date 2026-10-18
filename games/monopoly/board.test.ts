import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, GROUPS, JAIL, groupSpaces, ownable, unmortgageCost } from './board.ts';

test('the board has the 40 standard US spaces', () => {
  assert.equal(BOARD.length, 40);
  assert.equal(BOARD[0].name, 'GO');
  assert.equal(BOARD[JAIL].kind, 'jail');
  assert.equal(BOARD[20].kind, 'parking');
  assert.equal(BOARD[30].kind, 'goToJail');
  assert.equal(BOARD[39].name, 'Boardwalk');
  const kinds = (kind: string) => BOARD.filter(space => space.kind === kind).length;
  assert.equal(kinds('street'), 22);
  assert.equal(kinds('railroad'), 4);
  assert.equal(kinds('utility'), 2);
  assert.equal(BOARD.filter(space => space.kind === 'card' && space.deck === 'chance').length, 3);
  assert.equal(BOARD.filter(space => space.kind === 'card' && space.deck === 'chest').length, 3);
  assert.deepEqual(BOARD.flatMap(space => space.kind === 'tax' ? [space.amount] : []), [200, 100]);
});

test('every property mortgages for half its price and streets have six rents', () => {
  const properties = BOARD.flatMap((space, index) => ownable(index) ? [space] : []);
  assert.equal(properties.length, 28);
  for (const space of properties) {
    if (!('price' in space)) assert.fail('not ownable');
    assert.equal(space.mortgage, space.price / 2);
    if (space.kind === 'street') assert.equal(space.rents.length, 6);
  }
  assert.equal(properties.reduce((sum, space) => sum + ('price' in space ? space.price : 0), 0), 5690);
});

test('color groups have two or three streets', () => {
  assert.deepEqual(Object.fromEntries(GROUPS.map(group => [group, groupSpaces(group).length])), {
    brown: 2, lightBlue: 3, pink: 3, orange: 3, red: 3, yellow: 3, green: 3, darkBlue: 2
  });
  assert.deepEqual(groupSpaces('darkBlue'), [37, 39]);
});

test('lifting a mortgage costs the mortgage plus 10%, rounded up', () => {
  assert.equal(unmortgageCost(1), 33); // Mediterranean, $30
  assert.equal(unmortgageCost(37), 193); // Park Place, $175
  assert.equal(unmortgageCost(39), 220);
});
