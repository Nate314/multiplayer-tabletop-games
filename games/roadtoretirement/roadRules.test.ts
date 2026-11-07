import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseGameState } from '../../shared/seating.ts';
import { withRules } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import { HOUSES, careerOf, houseOf } from './content.ts';
import { MID_FORK, ROAD, START_FORK, type SpaceKind } from './road.ts';
import { CHILD_BONUS, LOAN_REPAY, charge, roadLeft, roadMove, roadStandings, startRoad } from './roadRules.ts';
import type { GameState, Move, Random, RoadPhase, RoadPlayer, Seat } from './types.ts';

const NAMES: Record<Seat, string> = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };

// A random that spins the given numbers in order, then 1s (and low draws for shuffles)
const spins = (...values: number[]): Random => {
  let i = 0;
  return () => ((values[i++] ?? 1) - 0.5) / 10;
};

// The game is not registered yet, so tests build the table directly rather than through `dealt`
function game(seats = 2, values: HouseRuleValues = {}): GameState {
  const activePlayers = Array.from({ length: seats }, (_, i) => i + 1);
  return startRoad({
    ...baseGameState('g'), started: true, activePlayers, currentPlayer: 1,
    playerNames: Object.fromEntries(activePlayers.map(seat => [seat, NAMES[seat]])),
    houseRules: withRules(values), board: 'road', road: null, checkered: null, spin: null, lastMove: null
  });
}

const road = (state: GameState) => state.road!;
const player = (state: GameState, seat: Seat): RoadPlayer => road(state).players[seat];
const indexOf = (kind: SpaceKind): number => ROAD.findIndex(s => s.kind === kind);

function patch(state: GameState, seat: Seat, changes: Partial<RoadPlayer>, phase: RoadPhase = 'spin'): GameState {
  const r = road(state);
  return { ...state, currentPlayer: seat, road: { ...r, phase, players: { ...r.players, [seat]: { ...r.players[seat], ...changes } } } };
}

function play(state: GameState, seat: Seat, move: Move, random: Random = spins()): GameState {
  const result = roadMove(state, seat, move, random);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const refused = (state: GameState, seat: Seat, move: Move): string => {
  const result = roadMove(state, seat, move, spins());
  assert.ok('error' in result);
  return result.error;
};

const SALARY = careerOf('chef')!.salary;

test('college costs money and leads to better careers', () => {
  let state = game();
  assert.equal(road(state).phase, 'route');
  assert.equal(refused(state, 1, { type: 'spin' }), 'Choose college or work first');
  state = play(state, 1, { type: 'route', choice: 'college' });
  // 25000 - 50000 is -25000, so two loans of 20000
  assert.equal(player(state, 1).cash, 15000);
  assert.equal(player(state, 1).loans, 2);
  assert.equal(road(state).phase, 'spin');
  assert.equal(state.currentPlayer, 1);
  state = play(state, 1, { type: 'spin' }, spins(2));
  assert.equal(player(state, 1).space, START_FORK.college + 1);

  state = patch(game(), 1, { space: indexOf('graduation') - 1 });
  state = play(state, 1, { type: 'spin' }, spins(5));
  assert.equal(player(state, 1).space, indexOf('graduation'));
  assert.equal(player(state, 1).degree, true);
  assert.equal(road(state).phase, 'career');
  assert.equal(road(state).offer.length, 2);
  assert.ok(road(state).offer.every(id => careerOf(id)!.degree));
  assert.equal(refused(state, 1, { type: 'career', pick: null }), 'Pick one of the careers offered');
  assert.equal(refused(state, 1, { type: 'career', pick: 'cashier' }), 'Pick one of the careers offered');
  const pick = road(state).offer[0];
  state = play(state, 1, { type: 'career', pick });
  assert.equal(player(state, 1).career, pick);
  assert.equal(state.currentPlayer, 2);
  assert.equal(road(state).phase, 'route');
});

test('straight to work offers two careers at once', () => {
  let state = play(game(), 1, { type: 'route', choice: 'work' });
  assert.equal(player(state, 1).cash, 25000);
  assert.equal(road(state).phase, 'career');
  assert.equal(road(state).offer.length, 2);
  assert.ok(road(state).offer.every(id => !careerOf(id)!.degree));
  assert.equal(refused(state, 1, { type: 'spin' }), 'Pick one of the careers offered');
  assert.equal(refused(state, 1, { type: 'career', pick: null }), 'Pick one of the careers offered');
  const pick = road(state).offer[1];
  state = play(state, 1, { type: 'career', pick });
  assert.equal(state.currentPlayer, 1);
  assert.equal(road(state).phase, 'spin');
  assert.equal(refused(state, 1, { type: 'route', choice: 'college' }), 'Not now');
  // The first space of the work road is a job: keeping the career is allowed now
  state = play(state, 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).space, START_FORK.work);
  assert.equal(road(state).phase, 'career');
  assert.ok(road(state).offer.every(id => !careerOf(id)!.degree && id !== pick));
  state = play(state, 1, { type: 'career', pick: null });
  assert.equal(player(state, 1).career, pick);
  assert.equal(state.currentPlayer, 2);
});

test('a payday is paid when passed and when landed on', () => {
  const start = patch(game(), 1, { space: START_FORK.work, career: 'chef' });
  let state = play(start, 1, { type: 'spin' }, spins(1));
  assert.equal(ROAD[player(state, 1).space].kind, 'payday');
  assert.equal(player(state, 1).cash, 25000 + SALARY);
  assert.deepEqual(state.lastMove, { type: 'spin', playerNumber: 1, spin: 1, events: ['spun 1', 'collected $35,000 on payday'] });
  assert.equal(state.gameStatus, 'Alice spun 1, collected $35,000 on payday');
  state = play(start, 1, { type: 'spin' }, spins(2));
  const event = ROAD[START_FORK.work + 2];
  assert.equal(player(state, 1).cash, 25000 + SALARY + event.amount!);
  assert.deepEqual(state.lastMove!.events, ['spun 2', 'collected $35,000 on payday', `landed on an event: ${event.text!.slice(0, -1)}`]);
});

test('a stop space stops the move', () => {
  const marriage = indexOf('marriage');
  let state = patch(game(), 1, { space: marriage - 3, career: 'chef' });
  state = play(state, 1, { type: 'spin' }, spins(9));
  assert.equal(player(state, 1).space, marriage);
  assert.equal(player(state, 1).partner, true);
  assert.equal(player(state, 1).cash, 25000);
  assert.equal(state.currentPlayer, 2);
});

test('the mid fork pauses and continues with the steps left', () => {
  let state = patch(game(), 1, { space: MID_FORK.space - 2, career: 'chef' });
  state = play(state, 1, { type: 'spin' }, spins(5));
  assert.equal(player(state, 1).space, MID_FORK.space);
  assert.equal(road(state).phase, 'fork');
  assert.equal(road(state).stepsLeft, 3);
  assert.equal(state.currentPlayer, 1);
  assert.equal(refused(state, 1, { type: 'spin' }), 'Choose a road');
  state = play(state, 1, { type: 'fork', road: 'safe' });
  // safe road: payday, gain, gain; the third step lands on the second gain
  assert.equal(player(state, 1).space, MID_FORK.safe + 2);
  assert.equal(player(state, 1).cash, 25000 + SALARY + ROAD[MID_FORK.safe + 2].amount!);
  assert.equal(road(state).stepsLeft, 0);
  assert.equal(state.currentPlayer, 2);

  // Arriving on the fork with no steps left: the next spin pauses there with all of its steps
  state = patch(game(), 1, { space: MID_FORK.space - 1, career: 'chef' });
  state = play(state, 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).space, MID_FORK.space);
  assert.equal(state.currentPlayer, 2);
  state = play(patch(state, 1, {}), 1, { type: 'spin' }, spins(4));
  assert.equal(road(state).phase, 'fork');
  assert.equal(road(state).stepsLeft, 4);
  state = play(state, 1, { type: 'fork', road: 'fast' });
  assert.equal(player(state, 1).space, MID_FORK.fast + 3);
});

test('money below zero takes whole loans', () => {
  const broke = player(game(), 1);
  const once = charge({ ...broke, cash: 5000 }, 50000);
  assert.equal(once.cash, 15000);
  assert.equal(once.loans, 3);
  const twice = charge(once, 30000);
  assert.equal(twice.cash, 5000);
  assert.equal(twice.loans, 4);
  assert.deepEqual(charge(twice, -1000), { ...twice, cash: 6000 });
  // In a move: a loss with too little cash takes a loan and says so
  const loss = ROAD.findIndex(s => s.kind === 'event' && s.amount! < 0 && !s.fullOnly && ROAD[ROAD.indexOf(s) - 1].kind !== 'payday');
  let state = patch(game(), 1, { space: loss - 1, career: 'chef', cash: 100, loans: 1 });
  state = play(state, 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).cash, 100 + ROAD[loss].amount! + 20000);
  assert.equal(player(state, 1).loans, 2);
  assert.ok(state.lastMove!.events.includes('took 1 loan of $20,000'));
});

test('a house can be bought or skipped and sells at retirement', () => {
  const house = indexOf('house');
  // Everyone else owns all but two houses, so those two are the offer
  const owned = HOUSES.slice(2).map(h => h.id);
  let start = patch(game(), 2, { houses: owned });
  start = patch(start, 1, { space: house - 1, cash: 200000 });
  let state = play(start, 1, { type: 'spin' }, spins(1));
  assert.equal(road(state).phase, 'house');
  assert.deepEqual([...road(state).offer].sort(), ['cabin', 'cottage']);
  assert.equal(refused(state, 1, { type: 'buyHouse', pick: 'villa' }), 'Pick one of the houses offered');
  assert.equal(refused(state, 1, { type: 'spin' }), 'Pick one of the houses offered');
  const skipped = play(state, 1, { type: 'buyHouse', pick: null });
  assert.deepEqual(player(skipped, 1).houses, []);
  assert.equal(skipped.currentPlayer, 2);
  state = play(state, 1, { type: 'buyHouse', pick: 'cottage' });
  assert.deepEqual(player(state, 1).houses, ['cottage']);
  assert.equal(player(state, 1).cash, 200000 - houseOf('cottage')!.price);
  assert.equal(state.currentPlayer, 2);

  state = patch(state, 1, { space: ROAD.length - 2 });
  state = play(state, 1, { type: 'spin' }, spins(3));
  assert.equal(player(state, 1).retired, true);
  assert.equal(player(state, 1).worth, 200000 - houseOf('cottage')!.price + houseOf('cottage')!.saleValue);
});

test('family adds a partner first, then children', () => {
  const family = ROAD.findIndex(s => s.kind === 'family' && !s.fullOnly);
  let state = patch(game(), 1, { space: family - 1 });
  state = play(state, 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).partner, true);
  assert.equal(player(state, 1).children, 0);
  state = play(patch(state, 1, { space: family - 1 }), 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).children, 1);
  state = play(patch(state, 1, { space: family - 1 }), 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).children, 2);
  // marriage adds a partner only if there is none
  const marriage = indexOf('marriage');
  state = play(patch(state, 1, { space: marriage - 1 }), 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).children, 2);
  assert.equal(player(state, 1).partner, true);
});

test('risk pays by the table', () => {
  const risk = ROAD.findIndex(s => s.kind === 'risk' && !s.fullOnly && ROAD[ROAD.indexOf(s) - 1].kind !== 'payday');
  const start = patch(game(), 1, { space: risk - 1, cash: 30000 });
  for (const [spun, change] of [[3, -20000], [6, 0], [9, 50000]]) {
    const state = play(start, 1, { type: 'spin' }, spins(1, spun));
    assert.equal(player(state, 1).space, risk);
    assert.equal(player(state, 1).cash, 30000 + change, `risk spin ${spun}`);
    assert.ok(state.lastMove!.events.includes(`spun ${spun} on a risk`));
  }
});

test('retirement counts houses and children and repays loans', () => {
  const end = ROAD.length - 1;
  assert.equal(ROAD[end].kind, 'retirement');
  let state = game(3);
  state = patch(state, 2, { retired: true, worth: 10000 });
  state = patch(state, 1, { space: end - 1, cash: 30000, houses: ['cabin'], children: 2, loans: 1 });
  state = play(state, 1, { type: 'spin' }, spins(1));
  assert.equal(player(state, 1).worth, 30000 + houseOf('cabin')!.saleValue + 2 * CHILD_BONUS - LOAN_REPAY);
  assert.equal(player(state, 1).retired, true);
  assert.equal(state.currentPlayer, 3);
  state = play(patch(state, 3, { space: end - 1, cash: 5000, loans: 4 }), 3, { type: 'spin' }, spins(1));
  assert.equal(player(state, 3).worth, 5000 - 4 * LOAN_REPAY);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(roadStandings(state), [
    { seat: 1, place: 1, score: '$105,000' },
    { seat: 2, place: 2, score: '$10,000' },
    { seat: 3, place: 3, score: '-$95,000' }
  ]);
});

test('the game ends when everyone has retired and the richest wins', () => {
  const end = ROAD.length - 1;
  let state = game(3);
  state = patch(state, 3, { retired: true, worth: 40000 });
  state = patch(state, 2, { retired: true, worth: 50000 });
  state = play(patch(state, 1, { space: end - 1, cash: 50000 }), 1, { type: 'spin' }, spins(1));
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.winners, [1, 2]);
  assert.equal(state.gameStatus, 'Alice and Bob retired the richest with $50,000');
  assert.deepEqual(roadStandings(state).map(s => s.place), [1, 1, 2]); // rankStandings numbers the rest after the shared first place
});

test('retired players are skipped', () => {
  let state = game(3);
  state = patch(state, 2, { retired: true, worth: 1 });
  state = patch(state, 1, { space: START_FORK.work + 1, career: 'chef' });
  state = play(state, 1, { type: 'spin' }, spins(1));
  assert.equal(state.currentPlayer, 3);
  assert.equal(road(state).phase, 'route');
  state = play(patch(state, 3, { space: START_FORK.work + 1, career: 'chef' }), 3, { type: 'spin' }, spins(1));
  assert.equal(state.currentPlayer, 1);
});

test('a short road skips the fullOnly spaces', () => {
  // work road: job, payday, gain, *loss, payday
  const from = START_FORK.work + 2;
  assert.ok(ROAD[from + 1].fullOnly);
  const short = play(patch(game(2, { length: 'short' }), 1, { space: from, career: 'chef' }), 1, { type: 'spin' }, spins(1));
  assert.equal(player(short, 1).space, from + 2);
  assert.equal(player(short, 1).cash, 25000 + SALARY);
  const full = play(patch(game(2, { length: 'full' }), 1, { space: from, career: 'chef' }), 1, { type: 'spin' }, spins(1));
  assert.equal(player(full, 1).space, from + 1);
  assert.equal(startRoad({ ...game(2, { startingCash: 50000 }), road: null }).road!.players[2].cash, 50000);
});

// What the platform does before onPlayerLeft: the seat is gone and a turn it held moved to the next active seat
const dismissed = (state: GameState, seat: Seat): GameState => {
  const activePlayers = state.activePlayers.filter(s => s !== seat);
  const currentPlayer = state.currentPlayer === seat ? activePlayers.find(s => s > seat) ?? activePlayers[0] : state.currentPlayer;
  return roadLeft({ ...state, activePlayers, currentPlayer }, seat);
};

test('dismissing the player at a choice starts the next turn', () => {
  // Alice is waiting on a career choice after the work route
  let state = play(game(3), 1, { type: 'route', choice: 'work' });
  let left = dismissed(state, 1);
  assert.equal(road(left).players[1], undefined);
  assert.equal(left.currentPlayer, 2);
  assert.equal(road(left).phase, 'route');
  assert.deepEqual(road(left).offer, []);

  // Alice paused at the fork; Bob is on the road, so he spins
  state = patch(game(3), 2, { space: 30, career: 'chef' });
  state = patch(state, 1, { space: MID_FORK.space - 1, career: 'chef' });
  state = play(state, 1, { type: 'spin' }, spins(4));
  assert.equal(road(state).phase, 'fork');
  left = dismissed(state, 1);
  assert.equal(left.currentPlayer, 2);
  assert.equal(road(left).phase, 'spin');
  assert.equal(road(left).stepsLeft, 0);

  // Someone else leaves: Alice's pending choice stays
  left = dismissed(state, 3);
  assert.equal(left.currentPlayer, 1);
  assert.equal(road(left).phase, 'fork');
  assert.equal(road(left).stepsLeft, 3);

  // The turn moved to a retired seat: it goes on to the next one still playing
  state = patch(play(game(3), 1, { type: 'route', choice: 'work' }), 2, { retired: true, worth: 5 });
  left = dismissed({ ...state, currentPlayer: 1 }, 1);
  assert.equal(left.currentPlayer, 3);
  assert.equal(road(left).phase, 'route');

  // Everyone left has retired: the game ends
  state = patch(game(3), 3, { retired: true, worth: 9000 });
  state = patch(state, 2, { retired: true, worth: 7000 });
  state = play(patch(state, 1, { space: indexOf('house') - 1 }), 1, { type: 'spin' }, spins(1));
  assert.equal(road(state).phase, 'house');
  left = dismissed(state, 1);
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [3]);
  assert.equal(left.currentPlayer, null);
  assert.equal(left.gameStatus, 'Cara retired the richest with $9,000');
});
