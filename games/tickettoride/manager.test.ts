import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { anyMove, seeded } from './testing.ts';
import { tickettoride } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'tickettoride/g1';

function gameWith(seed: number, ...names: string[]): Manager {
  const manager = createGameManager([tickettoride], seeded(seed));
  for (const name of names) manager.join('tickettoride', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Ticket to Ride's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null = null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// The player to move plays the simple player's move from their own view
function step(manager: Manager): PublicGameState {
  const seat = viewOf(manager).currentPlayer ?? assert.fail('nobody to move');
  return ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), seat)));
}

test('a seeded game plays from the first tickets to the final scoring, and no step shows a hand or a deck', () => {
  const manager = gameWith(2, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; !state.isGameOver && moves < 3000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.ok(state.final);
  assert.ok(state.winners.length >= 1);
  const best = Math.max(...Object.values(state.final).map(score => score.total));
  assert.ok(state.winners.every(seat => state.final?.[seat].total === best));

  const steps = manager.history('tickettoride', 'g1') ?? assert.fail('no history');
  assert.ok(steps.length > 20);
  for (const past of steps as unknown as PublicGameState[]) {
    assert.equal('deck' in past, false);
    assert.equal('ticketDeck' in past, false);
    for (const player of Object.values(past.players)) {
      assert.equal(player.hand, null);
      assert.equal(player.offered, null);
      if (!past.isGameOver) assert.equal(player.tickets, null);
    }
  }
  const file = manager.gameFile('tickettoride', 'g1', new Date());
  assert.ok(file && 'file' in file);
});

test('a rejoin mid-turn shows the same half-drawn turn and the same ticket choice', () => {
  const manager = gameWith(5, 'A', 'B');
  // Both keep their first tickets, then A draws one card
  for (let moves = 0; viewOf(manager).phase === 'setup'; moves++) step(manager);
  ok(manager.move(ROOM, 1, { type: 'drawCard', source: 'deck' }));
  const before = viewOf(manager, 1);
  assert.equal(before.drawing, 1);
  manager.disconnect(ROOM, 1);
  const rejoined = manager.join('tickettoride', 'g1', 'A', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(view.drawing, 1);
  assert.deepEqual(view.players[1].hand, before.players[1].hand);
  assert.deepEqual(manager.move(ROOM, 1, { type: 'drawTickets' }), { error: 'Draw your second card' });
  ok(manager.move(ROOM, 1, { type: 'drawCard', source: 'deck' }));

  // B draws tickets and refreshes before choosing
  const offered = ok(manager.move(ROOM, 2, { type: 'drawTickets' }));
  assert.equal(offered.players[2].offeredCount, 3);
  const mine = viewOf(manager, 2).players[2].offered ?? assert.fail('no offer');
  manager.disconnect(ROOM, 2);
  const back = manager.join('tickettoride', 'g1', 'B', true);
  if ('error' in back) assert.fail(back.error);
  assert.deepEqual((back.state as PublicGameState).players[2].offered, mine);
  assert.equal(viewOf(manager, 1).players[2].offered, null);
  const kept = ok(manager.move(ROOM, 2, { type: 'keepTickets', tickets: [mine[0]] }));
  assert.equal(kept.currentPlayer, 1);
});

test('undo takes back a claimed route', () => {
  const manager = gameWith(7, 'A', 'B');
  let state = viewOf(manager);
  for (let moves = 0; state.lastMove?.type !== 'claim' && moves < 500; moves++) state = step(manager);
  const claimer = state.lastMove?.seat ?? assert.fail('nobody claimed');
  const route = state.lastMove?.type === 'claim' ? state.lastMove.route : assert.fail('not a claim');
  ok(manager.requestUndo(ROOM, claimer));
  const restored = ok(manager.voteUndo(ROOM, claimer === 1 ? 2 : 1, true));
  assert.equal(restored.claimed[route], undefined);
  assert.equal(restored.currentPlayer, claimer);
});

test('dismissing a player mid-turn keeps their routes and drops them from the scoring', () => {
  const manager = gameWith(11, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; moves < 400 && !Object.values(state.claimed).includes(3); moves++) state = step(manager);
  assert.ok(Object.values(state.claimed).includes(3), 'C never claimed anything');
  while (state.currentPlayer !== 3) state = step(manager);
  ok(manager.move(ROOM, 3, { type: 'drawTickets' }));
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  state = ok(manager.voteDismiss(ROOM, 2, true));
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.players[3].offeredCount, 0);
  assert.equal(state.players[3].cardCount, 0);
  assert.ok(Object.values(state.claimed).includes(3));
  for (let moves = 0; !state.isGameOver && moves < 3000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(Object.keys(state.final ?? {}).map(Number), [1, 2]);
});

test('an undone blind draw is reshuffled, so undo cannot show the next card', () => {
  const manager = gameWith(5, 'A', 'B');
  for (let moves = 0; viewOf(manager).phase === 'setup'; moves++) step(manager);
  const drawn = new Set<string>();
  for (let tries = 0; tries < 6; tries++) {
    drawn.add(JSON.stringify(ok(manager.move(ROOM, 1, { type: 'drawCard', source: 'deck' })).players[1].hand));
    ok(manager.requestUndo(ROOM, 1));
    ok(manager.voteUndo(ROOM, 2, true));
  }
  assert.ok(drawn.size > 1);
});
