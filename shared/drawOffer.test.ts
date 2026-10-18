import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEndingAction, lapseDrawOffer } from './drawOffer.ts';
import type { DrawOfferState } from './drawOffer.ts';
import { baseGameState } from './seating.ts';
import type { BaseGameState, Seat } from './types.ts';

type State = BaseGameState & DrawOfferState;

// A two-player game after its first move, seat 2 to move
function running(): State {
  return {
    ...baseGameState('g1'),
    started: true,
    activePlayers: [1, 2],
    playerNames: { 1: 'A', 2: 'B' },
    currentPlayer: 2,
    drawOffer: null
  };
}

function act(state: State, seat: Seat, action: unknown): State {
  const result = applyEndingAction(state, seat, action);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

test('resigning ends the game for the opponent, or in a draw when the game says so', () => {
  const lost = act(running(), 1, { type: 'resign' });
  assert.equal(lost.isGameOver, true);
  assert.deepEqual(lost.winners, [2]);
  assert.equal(lost.currentPlayer, null);
  assert.equal(lost.gameStatus, 'A resigned. B wins!');

  const drawn = applyEndingAction(running(), 1, { type: 'resign' }, () => true);
  assert.ok('state' in drawn);
  assert.deepEqual(drawn.state.winners, []);
  assert.equal(drawn.state.gameStatus, 'A resigned, but B could never checkmate. Draw.');
});

test('an offer waits for the opponent, who accepts or declines it', () => {
  const offered = act(running(), 1, { type: 'offerDraw' });
  assert.equal(offered.drawOffer, 1);
  assert.equal(offered.gameStatus, 'A offers a draw');
  assert.deepEqual(applyEndingAction(offered, 1, { type: 'offerDraw' }), { error: 'You have already offered a draw' });
  assert.deepEqual(applyEndingAction(offered, 1, { type: 'answerDraw', accept: true }), { error: 'There is no draw offer to answer' });

  const declined = act(offered, 2, { type: 'answerDraw', accept: false });
  assert.equal(declined.drawOffer, null);
  assert.equal(declined.isGameOver, false);
  assert.equal(declined.gameStatus, 'B declined the draw');

  const agreed = act(offered, 2, { type: 'answerDraw', accept: true });
  assert.equal(agreed.isGameOver, true);
  assert.deepEqual(agreed.winners, []);
  assert.equal(agreed.drawOffer, null);
  assert.equal(agreed.gameStatus, 'Draw by agreement');
});

test('offering back when the opponent has offered is an agreement', () => {
  const agreed = act(act(running(), 1, { type: 'offerDraw' }), 2, { type: 'offerDraw' });
  assert.equal(agreed.isGameOver, true);
  assert.equal(agreed.gameStatus, 'Draw by agreement');
});

test("an offer lapses when the offerer's opponent moves, not when the offerer does", () => {
  const offered = act(running(), 1, { type: 'offerDraw' });
  assert.equal(lapseDrawOffer(offered, 1).drawOffer, 1);
  assert.equal(lapseDrawOffer(offered, 2).drawOffer, null);
  assert.equal(lapseDrawOffer(running(), 2).drawOffer, null);
});

test('nothing ends a game that has not started, is over, or is holding a vote', () => {
  const refused = (state: State) => applyEndingAction(state, 1, { type: 'resign' });
  assert.deepEqual(refused({ ...running(), started: false }), { error: 'The game has not started' });
  assert.deepEqual(refused({ ...running(), isGameOver: true }), { error: 'The game is over' });
  assert.deepEqual(refused({ ...running(), undoVote: { requestedBy: 2, votes: { 2: true } } }), { error: 'A vote is in progress' });
  assert.deepEqual(refused({ ...running(), dismissVote: { target: 2, requestedBy: 1, votes: { 1: true } } }), { error: 'A vote is in progress' });
  assert.deepEqual(applyEndingAction(running(), 1, { type: 'dance' }), { error: 'Unknown action' });
  assert.deepEqual(applyEndingAction(running(), 1, null), { error: 'Unknown action' });
});
