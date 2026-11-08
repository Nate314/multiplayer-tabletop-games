import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, GROUPS, JAIL, groupSpaces, ownable, unmortgageCost } from './board.ts';
import { CHANCE, COMMUNITY_CHEST, DECK_NAMES } from './cards.ts';
import type { Space } from './types.ts';

test('the board has 40 spaces in the standard pattern', () => {
  assert.equal(BOARD.length, 40);
  assert.equal(BOARD[0].name, 'Start');
  assert.equal(BOARD[JAIL].kind, 'jail');
  assert.equal(BOARD[20].kind, 'parking');
  assert.equal(BOARD[30].kind, 'goToJail');
  assert.equal(BOARD[39].name, 'Skyline Crescent');
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
  assert.equal(unmortgageCost(1), 33); // Tanner Row, $30
  assert.equal(unmortgageCost(37), 193); // Summit Rise, $175
  assert.equal(unmortgageCost(39), 220);
});

test('every space and card keeps its rules when the names change', () => {
  // Saved games name spaces and cards by index, so each index keeps its kind, price, rents, group, deck and effect
  const rulesOf = (space: Space) => JSON.stringify({ ...space, name: undefined });
  assert.deepEqual(BOARD.map(rulesOf), [
    '{"kind":"go"}',
    '{"kind":"street","group":"brown","price":60,"mortgage":30,"houseCost":50,"rents":[2,10,30,90,160,250]}',
    '{"kind":"card","deck":"chest"}',
    '{"kind":"street","group":"brown","price":60,"mortgage":30,"houseCost":50,"rents":[4,20,60,180,320,450]}',
    '{"kind":"tax","amount":200}',
    '{"kind":"railroad","price":200,"mortgage":100}',
    '{"kind":"street","group":"lightBlue","price":100,"mortgage":50,"houseCost":50,"rents":[6,30,90,270,400,550]}',
    '{"kind":"card","deck":"chance"}',
    '{"kind":"street","group":"lightBlue","price":100,"mortgage":50,"houseCost":50,"rents":[6,30,90,270,400,550]}',
    '{"kind":"street","group":"lightBlue","price":120,"mortgage":60,"houseCost":50,"rents":[8,40,100,300,450,600]}',
    '{"kind":"jail"}',
    '{"kind":"street","group":"pink","price":140,"mortgage":70,"houseCost":100,"rents":[10,50,150,450,625,750]}',
    '{"kind":"utility","price":150,"mortgage":75}',
    '{"kind":"street","group":"pink","price":140,"mortgage":70,"houseCost":100,"rents":[10,50,150,450,625,750]}',
    '{"kind":"street","group":"pink","price":160,"mortgage":80,"houseCost":100,"rents":[12,60,180,500,700,900]}',
    '{"kind":"railroad","price":200,"mortgage":100}',
    '{"kind":"street","group":"orange","price":180,"mortgage":90,"houseCost":100,"rents":[14,70,200,550,750,950]}',
    '{"kind":"card","deck":"chest"}',
    '{"kind":"street","group":"orange","price":180,"mortgage":90,"houseCost":100,"rents":[14,70,200,550,750,950]}',
    '{"kind":"street","group":"orange","price":200,"mortgage":100,"houseCost":100,"rents":[16,80,220,600,800,1000]}',
    '{"kind":"parking"}',
    '{"kind":"street","group":"red","price":220,"mortgage":110,"houseCost":150,"rents":[18,90,250,700,875,1050]}',
    '{"kind":"card","deck":"chance"}',
    '{"kind":"street","group":"red","price":220,"mortgage":110,"houseCost":150,"rents":[18,90,250,700,875,1050]}',
    '{"kind":"street","group":"red","price":240,"mortgage":120,"houseCost":150,"rents":[20,100,300,750,925,1100]}',
    '{"kind":"railroad","price":200,"mortgage":100}',
    '{"kind":"street","group":"yellow","price":260,"mortgage":130,"houseCost":150,"rents":[22,110,330,800,975,1150]}',
    '{"kind":"street","group":"yellow","price":260,"mortgage":130,"houseCost":150,"rents":[22,110,330,800,975,1150]}',
    '{"kind":"utility","price":150,"mortgage":75}',
    '{"kind":"street","group":"yellow","price":280,"mortgage":140,"houseCost":150,"rents":[24,120,360,850,1025,1200]}',
    '{"kind":"goToJail"}',
    '{"kind":"street","group":"green","price":300,"mortgage":150,"houseCost":200,"rents":[26,130,390,900,1100,1275]}',
    '{"kind":"street","group":"green","price":300,"mortgage":150,"houseCost":200,"rents":[26,130,390,900,1100,1275]}',
    '{"kind":"card","deck":"chest"}',
    '{"kind":"street","group":"green","price":320,"mortgage":160,"houseCost":200,"rents":[28,150,450,1000,1200,1400]}',
    '{"kind":"railroad","price":200,"mortgage":100}',
    '{"kind":"card","deck":"chance"}',
    '{"kind":"street","group":"darkBlue","price":350,"mortgage":175,"houseCost":200,"rents":[35,175,500,1100,1300,1500]}',
    '{"kind":"tax","amount":100}',
    '{"kind":"street","group":"darkBlue","price":400,"mortgage":200,"houseCost":200,"rents":[50,200,600,1400,1700,2000]}'
  ]);
  assert.deepEqual(CHANCE.map(card => JSON.stringify(card.effect)), [
    '{"type":"advance","to":39}',
    '{"type":"advance","to":0}',
    '{"type":"advance","to":24}',
    '{"type":"advance","to":11}',
    '{"type":"nearest","kind":"railroad"}',
    '{"type":"nearest","kind":"railroad"}',
    '{"type":"nearest","kind":"utility"}',
    '{"type":"collect","amount":50}',
    '{"type":"jailCard"}',
    '{"type":"back","spaces":3}',
    '{"type":"goToJail"}',
    '{"type":"repairs","house":25,"hotel":100}',
    '{"type":"pay","amount":15}',
    '{"type":"advance","to":5}',
    '{"type":"payEach","amount":50}',
    '{"type":"collect","amount":150}'
  ]);
  assert.deepEqual(COMMUNITY_CHEST.map(card => JSON.stringify(card.effect)), [
    '{"type":"advance","to":0}',
    '{"type":"collect","amount":200}',
    '{"type":"pay","amount":50}',
    '{"type":"collect","amount":50}',
    '{"type":"jailCard"}',
    '{"type":"goToJail"}',
    '{"type":"collect","amount":100}',
    '{"type":"collect","amount":20}',
    '{"type":"collectEach","amount":10}',
    '{"type":"collect","amount":100}',
    '{"type":"pay","amount":100}',
    '{"type":"pay","amount":50}',
    '{"type":"collect","amount":25}',
    '{"type":"repairs","house":40,"hotel":115}',
    '{"type":"collect","amount":10}',
    '{"type":"collect","amount":100}'
  ]);
});

// The names on the board this one replaced, kept only to check none comes back
const OLD_NAMES = [
  'GO', 'Mediterranean Avenue', 'Community Chest', 'Baltic Avenue', 'Reading Railroad', 'Oriental Avenue', 'Chance',
  'Vermont Avenue', 'Connecticut Avenue', 'St. Charles Place', 'Electric Company', 'States Avenue', 'Virginia Avenue',
  'Pennsylvania Railroad', 'St. James Place', 'Tennessee Avenue', 'New York Avenue', 'Free Parking', 'Kentucky Avenue',
  'Indiana Avenue', 'Illinois Avenue', 'B. & O. Railroad', 'Atlantic Avenue', 'Ventnor Avenue', 'Water Works',
  'Marvin Gardens', 'Pacific Avenue', 'North Carolina Avenue', 'Pennsylvania Avenue', 'Short Line', 'Park Place', 'Boardwalk'
];

test('the board is a fictional city', () => {
  assert.equal(BOARD[0].name, 'Start');
  assert.equal(BOARD[10].name, 'Jail');
  assert.equal(BOARD[20].name, 'Town Square');
  assert.equal(BOARD[30].name, 'Go to Jail');
  for (const space of BOARD) assert.ok(!OLD_NAMES.includes(space.name), space.name);
  const names = BOARD.filter(space => space.kind !== 'card').map(space => space.name);
  assert.equal(new Set(names).size, names.length);
});

test('the decks are Fortune and Town Fund', () => {
  assert.deepEqual(DECK_NAMES, { chance: 'Fortune', chest: 'Town Fund' });
  for (const space of BOARD) {
    if (space.kind === 'card') assert.equal(space.name, space.deck === 'chance' ? 'Fortune' : 'Town Fund');
  }
  for (const card of [...CHANCE, ...COMMUNITY_CHEST]) {
    for (const old of [...OLD_NAMES.filter(name => name !== 'GO'), 'Get Out of Jail Free', 'Railroad']) {
      assert.ok(!card.text.includes(old), `${card.text} names ${old}`);
    }
    assert.doesNotMatch(card.text, /\bGO\b/);
  }
});

test('every card text names the space it moves to', () => {
  for (const card of [...CHANCE, ...COMMUNITY_CHEST]) {
    if (card.effect.type === 'advance') assert.ok(card.text.includes(BOARD[card.effect.to].name), card.text);
  }
});
