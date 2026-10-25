import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterSeatChange } from '../../shared/houseRules.ts';
import { boardOf } from './board.ts';
import { catan } from './index.ts';
import { allowsOutOfTurn, onPlayerDisconnected, onPlayerLeft, toPublicState } from './rules.ts';
import { SPECIAL_BUILD } from './specialBuild.ts';
import { FIVE_SIX_LAYOUT, act, dice, fiveSixGame, holding, move, played } from './testing.ts';
import type { GameState, Seat } from './types.ts';

const board = boardOf(FIVE_SIX_LAYOUT);

const withRule = (state: GameState): GameState => ({
  ...state,
  houseRules: { host: 1, values: { specialBuild: true }, override: false, maxPlayers: null, agreed: [1, 2, 3, 4, 5], revision: 1 }
});

// Every seat holds two of each resource
function stocked(state: GameState): GameState {
  let next = state;
  for (const seat of next.activePlayers) next = holding(next, seat, { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 2 });
  return next;
}

// A settlement of `seat` on `vertex` with a road from it, and the far end of a second path from there:
// building a road on `second` and a settlement on `spot` is allowed
function outpost(state: GameState, seat: Seat, vertex: number) {
  const first = board.vertexEdges[vertex][0];
  const middle = board.edges[first].find(other => other !== vertex) as number;
  const second = board.vertexEdges[middle].find(edge => edge !== first) as number;
  const spot = board.edges[second].find(other => other !== middle) as number;
  return {
    state: {
      ...state,
      buildings: { ...state.buildings, [vertex]: { seat, city: false } },
      roads: { ...state.roads, [first]: seat }
    },
    second,
    spot
  };
}

// Alice ended her turn with the rule on: builders Bob, Cara, Dan, Eve and Bob's turn
const aliceEnded = (overrides: Partial<GameState> = {}) =>
  played(withRule(stocked(fiveSixGame({ rolled: true, ...overrides }))), 1, { type: 'endTurn' });

// Nine points for `seat`: one settlement (from outpost) and eight Victory Point cards
const nineVictoryPoints = (state: GameState, seat: Seat): GameState =>
  ({ ...state, devCards: { ...state.devCards, [seat]: Array(8).fill('victoryPoint') } });

const passAll = (state: GameState): GameState => {
  let next = state;
  while (next.specialBuild) next = played(next, next.specialBuild.builders[0], { type: 'passBuild' });
  return next;
};

test('the rule is offered only with five or more seated', () => {
  assert.equal(SPECIAL_BUILD.offered?.(4, {}), false);
  assert.equal(SPECIAL_BUILD.offered?.(5, {}), true);
  assert.equal('specialBuild' in afterSeatChange(catan.info, undefined, [1, 2, 3, 4]).values, false);
  assert.equal(afterSeatChange(catan.info, undefined, [1, 2, 3, 4, 5]).values.specialBuild, false);
  const five = afterSeatChange(catan.info, undefined, [1, 2, 3, 4, 5]);
  const on = { ...five, values: { specialBuild: true } };
  assert.equal('specialBuild' in afterSeatChange(catan.info, on, [1, 2, 3, 4]).values, false);
});

test('with the rule off, ending a turn starts the next turn as before', () => {
  const next = played(stocked(fiveSixGame({ rolled: true })), 1, { type: 'endTurn' });
  assert.equal(next.specialBuild, null);
  assert.equal(next.currentPlayer, 2);
});

test('with the rule on, every other player gets a build chance in turn order, starting with the next player', () => {
  const next = played(withRule(stocked(fiveSixGame({ turnHolder: 3, currentPlayer: 3, rolled: true }))), 3, { type: 'endTurn' });
  assert.deepEqual(next.specialBuild, { builders: [4, 5, 1, 2] });
  assert.equal(next.currentPlayer, 4);
  assert.equal(next.turnHolder, 4);
  assert.match(next.gameStatus, /Special build phase: Dan, Eve, Alice, Bob/);
});

test('a builder may build and buy until Done building, which passes the chance on', () => {
  const { state, second } = outpost(fiveSixGame({ rolled: true }), 2, 0);
  let next = played(withRule(stocked(state)), 1, { type: 'endTurn' });
  assert.deepEqual(next.specialBuild, { builders: [2, 3, 4, 5] });
  next = played(next, 2, { type: 'buildRoad', edge: second });
  assert.equal(next.roads[second], 2);
  next = played(next, 2, { type: 'buyDevCard' });
  assert.deepEqual(next.specialBuild, { builders: [2, 3, 4, 5] });
  next = played(next, 2, { type: 'passBuild' });
  assert.deepEqual(next.specialBuild, { builders: [3, 4, 5] });
  assert.equal(next.gameStatus, 'Bob is done building');
});

test('nobody may trade or play development cards during the phase', () => {
  const state = aliceEnded({ devCards: { 1: [], 2: ['knight'], 3: [], 4: [], 5: [] } });
  assert.deepEqual(move(state, 2, { type: 'bankTrade', give: 'wood', get: 'ore' }),
    { error: 'No trading during the special build phase' });
  const offer = { type: 'offerTrade', to: null, give: { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 }, get: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 1 } };
  assert.deepEqual(act(state, 2, offer), { error: 'No trading during the special build phase' });
  assert.deepEqual(move(state, 2, { type: 'playKnight' }), { error: 'No development cards during the special build phase' });
  assert.deepEqual(move(state, 2, { type: 'playMonopoly', resource: 'ore' }), { error: 'No development cards during the special build phase' });
});

test('only the builder whose chance it is may move, and the next player cannot roll until the phase ends', () => {
  const state = withRule(stocked(fiveSixGame({ turnHolder: 2, currentPlayer: 2, specialBuild: { builders: [3, 4, 5, 1] } })));
  assert.deepEqual(move(state, 2, { type: 'roll' }), { error: 'Wait for Cara to build' });
  assert.deepEqual(move(state, 3, { type: 'roll' }), { error: 'Click Done building first' });
  assert.deepEqual(move(state, 3, { type: 'endTurn' }), { error: 'Click Done building first' });
});

test('allowsOutOfTurn admits only the builder\'s build moves', () => {
  const state = withRule(stocked(fiveSixGame({ turnHolder: 2, currentPlayer: 2, specialBuild: { builders: [3, 4] } })));
  const edge = board.vertexEdges[0][0];
  assert.equal(allowsOutOfTurn(state, 3, { type: 'buildRoad', edge }), true);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'buildSettlement', vertex: 0 }), true);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'buildCity', vertex: 0 }), true);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'buyDevCard' }), true);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'passBuild' }), true);
  assert.equal(allowsOutOfTurn(state, 4, { type: 'passBuild' }), false);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'bankTrade', give: 'wood', get: 'ore' }), false);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'roll' }), false);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'buildRoad', edge: 999 }), false);
  assert.equal(allowsOutOfTurn(state, 3, 'nonsense'), false);
  assert.equal(allowsOutOfTurn(fiveSixGame(), 3, { type: 'passBuild' }), false);
});

test('when the last builder is done the next player rolls', () => {
  const state = withRule(stocked(fiveSixGame({ turnHolder: 2, currentPlayer: 2, specialBuild: { builders: [1] } })));
  const next = played(state, 1, { type: 'passBuild' });
  assert.equal(next.specialBuild, null);
  assert.equal(next.currentPlayer, 2);
  assert.equal(next.rolled, false);
  assert.match(next.gameStatus, /Bob's turn$/);
  assert.equal(played(next, 2, { type: 'roll' }, dice(3, 3)).rolled, true);
});

test('players with fewer than 2 cards and disconnected players are skipped', () => {
  const state = withRule(holding(stocked(fiveSixGame({ rolled: true, disconnected: [4] })), 3, { wood: 1 }));
  const next = played(state, 1, { type: 'endTurn' });
  assert.deepEqual(next.specialBuild, { builders: [2, 5] });
  assert.match(next.gameStatus, /Special build phase: Bob, Eve$/);
});

test('nobody able to build means no phase', () => {
  let state = withRule(fiveSixGame({ rolled: true }));
  state = holding(state, 2, { wood: 5 });
  const next = played(state, 1, { type: 'endTurn' });
  assert.deepEqual(next.specialBuild, { builders: [2] });
  const none = played(withRule(fiveSixGame({ rolled: true })), 1, { type: 'endTurn' });
  assert.equal(none.specialBuild, null);
  assert.equal(none.currentPlayer, 2);
});

test('a builder who disconnects has their chance skipped at once', () => {
  const state = withRule(stocked(fiveSixGame({ turnHolder: 2, currentPlayer: 2, specialBuild: { builders: [3, 4] }, disconnected: [3] })));
  const next = onPlayerDisconnected(state, 3, dice());
  assert.deepEqual(next.specialBuild, { builders: [4] });
  assert.equal(next.gameStatus, 'Cara is away, so their build chance is skipped');
  const later = onPlayerDisconnected({ ...state, disconnected: [4] }, 4, dice());
  assert.deepEqual(later.specialBuild, { builders: [3, 4] });
  // When Cara is done, Dan is away, so his chance is skipped and the phase ends
  const after = played(later, 3, { type: 'passBuild' });
  assert.equal(after.specialBuild, null);
  assert.match(after.gameStatus, /Bob's turn$/);
});

test('a dismissed builder is dropped, and the turn holder leaving ends the phase', () => {
  const state = withRule(stocked(fiveSixGame({ turnHolder: 2, currentPlayer: 2, specialBuild: { builders: [3, 4] } })));
  const without = (seat: Seat) => ({ ...state, activePlayers: state.activePlayers.filter(other => other !== seat) });
  assert.deepEqual(onPlayerLeft(without(4), 4).specialBuild, { builders: [3] });
  const leftHolder = onPlayerLeft({ ...without(2), currentPlayer: 3 }, 2);
  assert.equal(leftHolder.specialBuild, null);
  assert.equal(leftHolder.turnHolder, 3);
  assert.equal(leftHolder.currentPlayer, 3);
  const lastBuilder = onPlayerLeft(without(3), 3);
  assert.deepEqual(lastBuilder.specialBuild, { builders: [4] });
});

test('a card bought in a build chance is hidden from others and playable from the buyer\'s next turn', () => {
  const state = withRule(stocked(fiveSixGame({ turnHolder: 2, currentPlayer: 2, specialBuild: { builders: [5, 1] } })));
  const bought = played(state, 5, { type: 'buyDevCard' });
  assert.deepEqual(bought.devCards[5], ['knight']);
  assert.deepEqual(bought.boughtThisTurn, state.boughtThisTurn);
  const view = toPublicState(bought, false, 1);
  assert.equal(view.devCounts[5], 1);
  assert.deepEqual(view.myDevCards, []);
  assert.deepEqual(view.myNewDevCards, []);
  assert.deepEqual(move(bought, 5, { type: 'playKnight' }), { error: 'No development cards during the special build phase' });
  const evesTurn: GameState = { ...passAll(bought), turnHolder: 5, currentPlayer: 5 };
  assert.equal(played(evesTurn, 5, { type: 'playKnight' }).knights[5], 1);
});

test('the next player reaching 10 in their own build chance wins when the phase ends', () => {
  const { state, second, spot } = outpost(fiveSixGame({ rolled: true }), 2, 0);
  let next = played(withRule(stocked(nineVictoryPoints(state, 2))), 1, { type: 'endTurn' });
  next = played(next, 2, { type: 'buildRoad', edge: second });
  next = played(next, 2, { type: 'buildSettlement', vertex: spot });
  assert.equal(next.isGameOver, false);
  next = played(next, 2, { type: 'passBuild' });
  next = played(next, 3, { type: 'passBuild' });
  next = played(next, 4, { type: 'passBuild' });
  assert.equal(next.isGameOver, false);
  next = played(next, 5, { type: 'passBuild' });
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [2]);
});

test('a later player reaching 10 in a build chance wins only when their own turn begins', () => {
  const { state, second, spot } = outpost(fiveSixGame({ rolled: true }), 3, 0);
  let next = played(withRule(stocked(nineVictoryPoints(state, 3))), 1, { type: 'endTurn' });
  next = played(next, 2, { type: 'passBuild' });
  next = played(next, 3, { type: 'buildRoad', edge: second });
  next = played(next, 3, { type: 'buildSettlement', vertex: spot });
  next = passAll(next);
  assert.equal(next.isGameOver, false);
  assert.equal(next.turnHolder, 2);
  next = played(next, 2, { type: 'roll' }, dice(3, 3));
  assert.equal(next.isGameOver, false);
  next = played(next, 2, { type: 'endTurn' });
  assert.equal(next.turnHolder, 3);
  assert.equal(next.isGameOver, false);
  next = passAll(next);
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [3]);
});

test('a game saved without the specialBuild field plays on with no phase', () => {
  const saved = stocked(fiveSixGame({ rolled: true })) as Partial<GameState>;
  delete saved.specialBuild;
  const next = played(saved as GameState, 1, { type: 'endTurn' });
  assert.equal(next.specialBuild, null);
  assert.equal(next.currentPlayer, 2);
  assert.equal(allowsOutOfTurn(saved as GameState, 2, { type: 'passBuild' }), false);
});
