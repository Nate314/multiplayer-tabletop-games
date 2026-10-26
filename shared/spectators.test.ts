import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openHandRequests, spectatorView } from './spectators.ts';
import { handGame, testGame } from './testGame.ts';
import type { Spectator } from './types.ts';

const dana = (allowedSeats: number[]): Spectator => ({ id: 's1', name: 'Dana', tableScreen: false, allowedSeats });
const twoSeats = () => handGame.resetLobby(
  { ...handGame.createGameState('g'), activePlayers: [1, 2], playerNames: { 1: 'A', 2: 'B' } }, Math.random
);

describe('spectatorView', () => {
  it('spectator view with no permissions is the table view', () => {
    const state = twoSeats();
    const view = spectatorView(handGame, state, dana([]));
    assert.deepEqual(view, { ...handGame.toPublicState(state, false, null), seatViews: {} });
    assert.ok(!JSON.stringify(view).includes('card1') && !JSON.stringify(view).includes('card2'));
  });

  it('spectatorState is used when a game has it', () => {
    const game = { ...testGame, spectatorState: (_state: unknown, _undo: boolean, tableScreen: boolean) => ({ extra: tableScreen ? null : 'x' }) };
    const state = game.createGameState('g');
    assert.equal((spectatorView(game as never, state, dana([])) as Record<string, unknown>).extra, 'x');
    assert.equal((spectatorView(game as never, state, { ...dana([]), tableScreen: true }) as Record<string, unknown>).extra, null);
  });

  it("an allowed seat adds only that seat's hand", () => {
    const view = spectatorView(handGame, twoSeats(), dana([2]));
    assert.deepEqual(view.seatViews, { 2: { hand: 'card2' } });
    assert.ok(!JSON.stringify(view).includes('card1'));
  });

  it('a seat that left is dropped from seatViews', () => {
    const view = spectatorView(handGame, { ...twoSeats(), activePlayers: [1] }, dana([2]));
    assert.deepEqual(view.seatViews, {});
  });

  it('a game whose spectators already see every seat offers no seat to ask for', () => {
    const open = { ...handGame, spectatorsSeeEverySeat: true };
    assert.ok(!('seatViews' in spectatorView(open, twoSeats(), dana([]))));
    assert.ok('seatViews' in spectatorView(handGame, twoSeats(), dana([])));
  });

  it('a game without privateSeatView gives no seat views', () => {
    const view = spectatorView(testGame, testGame.createGameState('g'), dana([1]));
    assert.ok(!('seatViews' in view));
  });
});

describe('openHandRequests', () => {
  it('drops left seats, gone spectators and finished games', () => {
    const state = {
      ...twoSeats(),
      handRequests: [{ spectator: 's1', seat: 2 }, { spectator: 's1', seat: 3 }, { spectator: 's9', seat: 1 }]
    };
    assert.deepEqual(openHandRequests(state, new Set(['s1'])), [{ spectator: 's1', seat: 2 }]);
    assert.deepEqual(openHandRequests({ ...state, isGameOver: true }, new Set(['s1'])), []);
  });
});
