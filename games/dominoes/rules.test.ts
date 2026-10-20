import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_SIZES, dealRound, legalPlays, openingTile, pipTotal, place, targetScore, tilesOf, toPublicState
} from './rules.ts';
import { dominoes } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, Placed, Result, SetSize } from './types.ts';

// The same numbers on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noShuffle = () => 0.999999;

// The id of the double-six tile with these pips
const t = (a: number, b: number, set: SetSize = 6) =>
  tilesOf(set).findIndex(([low, high]) => low === Math.min(a, b) && high === Math.max(a, b));

function lobby(count: number, set?: SetSize, random: Random = seeded(count)): GameState {
  let state = dominoes.createGameState('g');
  if (set) state = { ...state, set };
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan'].slice(0, count)) {
    const result = addPlayer(dominoes, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

const laid = (...pips: [number, number][]): Placed[] => pips.map(([left, right]) => ({ tile: t(left, right), left, right }));

// A three-player round under way: 3-4 is on the table, and every hand is small and known
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...dominoes.createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    scores: { 1: 0, 2: 0, 3: 0 },
    hands: { 1: [t(4, 5), t(0, 1)], 2: [t(3, 6), t(2, 2)], 3: [t(1, 1), t(5, 5)] },
    boneyard: [t(6, 6), t(0, 0)],
    line: laid([3, 4]),
    ...overrides
  };
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const move = (state: GameState, seat: number, made: unknown) => applyMove(dominoes, state, seat, made, noShuffle);
const play = (state: GameState, seat: number, tile: number, end: 'left' | 'right') => move(state, seat, { type: 'play', tile, end });
const act = (state: GameState, seat: number, action: unknown, random: Random = noShuffle) =>
  dominoes.applyAction?.(state, seat, action, random) ?? assert.fail('Dominoes has actions');

test('double-six has 28 tiles and double-nine 55', () => {
  assert.equal(tilesOf(6).length, 28);
  assert.equal(tilesOf(9).length, 55);
  // Each tile once, low pips first
  assert.equal(new Set(tilesOf(9).map(([a, b]) => `${a}-${b}`)).size, 55);
  assert.ok(tilesOf(9).every(([a, b]) => a <= b && b <= 9));
  assert.equal(pipTotal(6, tilesOf(6).map((_, tile) => tile)), 168);
});

// Wikipedia, Dominoes, section "Blocking game" (Middle Eastern version): the holder of the double-six starts, and the
// article's hands are seven tiles. Its sections are silent on the Draw game's sizes, so they follow Pagat's Draw Dominoes
// (see HAND_SIZES): 7 tiles, or 6 with four players, from double-six, and 9 from double-nine.
test('hand size and first lead follow the article for each set and player count', () => {
  for (const set of [6, 9] as const) {
    for (const count of [2, 3, 4]) {
      const state = lobby(count, set);
      const size = HAND_SIZES[set][count];
      assert.equal(size, set === 9 ? 9 : count === 4 ? 6 : 7);
      for (const seat of state.activePlayers) assert.equal(state.hands[seat].length, size);
      const all = [...Object.values(state.hands).flat(), ...state.boneyard];
      assert.equal(new Set(all).size, set === 6 ? 28 : 55);
      assert.equal(all.length, set === 6 ? 28 : 55);
      // The holder of the highest double leads, and must open with it
      const doubles = Object.entries(state.hands).flatMap(([seat, hand]) =>
        hand.filter(tile => tilesOf(set)[tile][0] === tilesOf(set)[tile][1]).map(tile => ({ seat: Number(seat), tile })));
      if (doubles.length > 0) {
        const top = doubles.reduce((a, b) => (b.tile > a.tile ? b : a));
        assert.equal(state.leadTile, top.tile);
        assert.equal(state.currentPlayer, top.seat);
      }
      assert.ok(state.hands[state.currentPlayer as number].includes(state.leadTile as number));
    }
  }
  // Double-six leads over every other tile; with no double the heaviest tile leads
  assert.deepEqual(openingTile(6, { 1: [t(6, 6), t(5, 5)], 2: [t(6, 5)] }), { seat: 1, tile: t(6, 6) });
  assert.deepEqual(openingTile(6, { 1: [t(6, 5), t(0, 1)], 2: [t(6, 4), t(5, 4)] }), { seat: 1, tile: t(6, 5) });
});

test('one player waits with nothing dealt, and joining deals the tiles afresh', () => {
  const one = lobby(1);
  assert.deepEqual(one.hands, { 1: [] });
  assert.equal(one.currentPlayer, 1);
  const two = lobby(2);
  assert.equal(two.hands[1].length, 7);
  assert.equal(two.boneyard.length, 14);
  assert.equal(two.line.length, 0);
});

test('the first tile must be the lead tile, and either end takes it', () => {
  const start = game({ line: [], leadTile: t(2, 2), hands: { 1: [t(2, 2), t(4, 5)], 2: [t(3, 6)], 3: [t(1, 1)] } });
  assert.ok('error' in play(start, 1, t(4, 5), 'left'));
  const next = ok(play(start, 1, t(2, 2), 'right'));
  assert.deepEqual(next.line, laid([2, 2]));
  assert.equal(next.leadTile, null);
  assert.equal(next.currentPlayer, 2);
  assert.equal(next.lastMove?.type === 'play' && next.lastMove.end, null);
});

test('a tile must match the open end it is played on and is flipped to fit', () => {
  const state = game({ line: laid([3, 4]) });
  // 4-5 matches the right end 4; the 5 faces out
  const right = ok(play(state, 1, t(4, 5), 'right'));
  assert.deepEqual(right.line, laid([3, 4], [4, 5]));
  // It does not match the left end 3
  assert.ok('error' in play(state, 1, t(4, 5), 'left'));
  // 3-6 matches the left end 3 and is flipped so the 3 touches the line
  const left = ok(play({ ...state, currentPlayer: 2 }, 2, t(3, 6), 'left'));
  assert.deepEqual(left.line, laid([6, 3], [3, 4]));
  assert.ok('error' in play({ ...state, currentPlayer: 2 }, 2, t(3, 6), 'right'));
  // A tile that matches neither end, and one not in the hand
  assert.ok('error' in play({ ...state, currentPlayer: 2 }, 2, t(2, 2), 'left'));
  assert.ok('error' in play(state, 1, t(1, 1), 'left'));
  assert.deepEqual(place(6, t(5, 5), 'right', laid([2, 5])), { tile: t(5, 5), left: 5, right: 5 });
  assert.equal(legalPlays(6, [t(3, 4)], laid([3, 4]), null).length, 2);
});

test('draw is allowed only when nothing fits', () => {
  const fits = game();
  assert.ok('error' in move(fits, 1, { type: 'draw' }));
  const stuck = game({ hands: { 1: [t(0, 1), t(2, 2)], 2: [t(3, 6)], 3: [t(1, 1)] }, boneyard: [t(6, 6), t(0, 0), t(3, 5)] });
  const drawn = ok(move(stuck, 1, { type: 'draw' }));
  assert.deepEqual(drawn.hands[1], [t(0, 1), t(2, 2), t(3, 5)]);
  assert.deepEqual(drawn.boneyard, [t(6, 6), t(0, 0)]);
  // The turn stays, and the drawn tile may be played at once
  assert.equal(drawn.currentPlayer, 1);
  assert.ok('error' in move(drawn, 1, { type: 'draw' }));
  assert.equal(ok(play(drawn, 1, t(3, 5), 'left')).currentPlayer, 2);
  // An empty boneyard cannot be drawn from
  assert.ok('error' in move({ ...stuck, boneyard: [] }, 1, { type: 'draw' }));
});

test('pass is allowed only when nothing fits and the boneyard is empty', () => {
  const stuck = game({ hands: { 1: [t(0, 1), t(2, 2)], 2: [t(3, 6)], 3: [t(1, 1)] }, boneyard: [] });
  const passed = ok(move(stuck, 1, { type: 'pass' }));
  assert.equal(passed.currentPlayer, 2);
  assert.equal(passed.lastMove?.type, 'pass');
  assert.equal(passed.gameStatus, 'Alice passed');
  assert.ok('error' in move({ ...stuck, boneyard: [t(0, 0)] }, 1, { type: 'pass' }));
  assert.ok('error' in move(game({ boneyard: [] }), 1, { type: 'pass' }));
});

test('playing out the hand ends the round with the article\'s scoring', () => {
  // Alice goes out; she scores the pips left in Bob's and Cara's hands and in the boneyard
  const state = game({ hands: { 1: [t(4, 5)], 2: [t(3, 6), t(2, 2)], 3: [t(1, 1), t(5, 5)] }, boneyard: [t(6, 6), t(0, 0)] });
  const done = ok(play(state, 1, t(4, 5), 'right'));
  const bob = 9 + 4;
  const cara = 2 + 10;
  const boneyard = 12;
  assert.equal(done.scores[1], bob + cara + boneyard);
  assert.equal(done.roundSummary?.winner, 1);
  assert.equal(done.roundSummary?.points, 37);
  assert.deepEqual(done.roundSummary?.pipsLeft, { 1: 0, 2: 13, 3: 12 });
  assert.equal(done.roundSummary?.boneyardPips, 12);
  assert.equal(done.currentPlayer, null);
  assert.equal(done.isGameOver, false);
  assert.equal(done.lastWinner, 1);
  assert.equal(done.lastMove?.type === 'play' && done.lastMove.wentOut, true);
  assert.ok('error' in move(done, 2, { type: 'draw' }));
});

test('a blocked round goes to the lowest pip total', () => {
  // 6 is gone from both ends: the line is 6-6 with 6s out, and nobody holds another 6
  const line = laid([6, 6]);
  const state = game({
    line,
    boneyard: [],
    hands: { 1: [t(0, 1), t(1, 1)], 2: [t(2, 2)], 3: [t(5, 5), t(0, 0)] },
    currentPlayer: 1
  });
  // Cara's last move leaves everyone stuck: a pass by the last seat that cannot play
  const blocked = ok(move({ ...state, currentPlayer: 3 }, 3, { type: 'pass' }));
  assert.equal(blocked.roundSummary?.blocked, true);
  assert.equal(blocked.roundSummary?.winner, 1);
  // Alice has 3 pips, Bob 4, Cara 10: Alice scores the other hands
  assert.equal(blocked.scores[1], 14);
  assert.equal(blocked.lastWinner, 1);
  assert.equal(blocked.currentPlayer, null);

  // A tie for the lowest total scores nothing
  const tied = ok(move({ ...state, hands: { 1: [t(0, 2)], 2: [t(1, 1)], 3: [t(5, 5)] }, currentPlayer: 3 }, 3, { type: 'pass' }));
  assert.equal(tied.roundSummary?.winner, null);
  assert.deepEqual(tied.scores, { 1: 0, 2: 0, 3: 0 });
  assert.equal(tied.lastWinner, null);
});

test('a play that blocks the game ends the round at once', () => {
  const state = game({
    line: laid([6, 4]),
    boneyard: [],
    hands: { 1: [t(5, 6), t(0, 1)], 2: [t(1, 1)], 3: [t(2, 2)] }
  });
  // Playing 5-6 on the left end 6 leaves ends 5 and 4, and nobody else holds either
  const blocked = ok(play(state, 1, t(5, 6), 'left'));
  assert.equal(blocked.roundSummary?.blocked, true);
  assert.equal(blocked.roundSummary?.winner, 1);
  assert.equal(blocked.scores[1], 6);
});

test('the game ends at the article\'s target score', () => {
  assert.equal(targetScore(2), 100);
  assert.equal(targetScore(3), 61);
  assert.equal(targetScore(4), 61);
  const state = game({
    scores: { 1: 90, 2: 0, 3: 0 },
    hands: { 1: [t(4, 5)], 2: [t(3, 6), t(2, 2)], 3: [t(1, 1), t(5, 5)] }
  });
  const won = ok(play(state, 1, t(4, 5), 'right'));
  assert.equal(won.scores[1], 90 + 37);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.equal(won.gameStatus, 'Alice wins with 127 points!');
  // Below the target the next round waits for Continue
  const short = ok(play({ ...state, scores: { 1: 10, 2: 0, 3: 0 } }, 1, t(4, 5), 'right'));
  assert.equal(short.isGameOver, false);
  assert.ok(short.roundSummary);
  assert.ok('error' in act(won, 1, { type: 'acknowledgeRound' }));
});

test('Continue waits for every connected player, then the winner leads with any tile', () => {
  const state = game({ hands: { 1: [t(4, 5)], 2: [t(3, 6)], 3: [t(1, 1)] }, boneyard: [] });
  let done = ok(play(state, 1, t(4, 5), 'right'));
  done = ok(act(done, 1, { type: 'acknowledgeRound' }));
  done = ok(act(done, 2, { type: 'acknowledgeRound' }));
  assert.ok(done.roundSummary, 'still waiting for Cara');
  const next = ok(act(done, 3, { type: 'acknowledgeRound' }, seeded(5)));
  assert.equal(next.roundSummary, null);
  assert.equal(next.roundNumber, 2);
  assert.equal(next.currentPlayer, 1);
  assert.equal(next.leadTile, null);
  assert.equal(next.line.length, 0);
  assert.equal(next.hands[1].length, 7);
  assert.ok('error' in act(next, 1, { type: 'acknowledgeRound' }));
});

test('lobby choice is kept across joins and refused after the first move', () => {
  let state = lobby(2);
  assert.equal(state.set, 6);
  state = ok(act(state, 2, { type: 'chooseSet', set: 9 }, seeded(2)));
  assert.equal(state.set, 9);
  assert.equal(state.hands[1].length, 9);
  assert.equal(state.boneyard.length, 55 - 18);
  const joined = addPlayer(dominoes, state, 'Cara', seeded(3));
  assert.ok(!('error' in joined));
  if ('error' in joined) return;
  assert.equal(joined.state.set, 9);
  assert.equal(joined.state.hands[3].length, 9);
  const left = removePlayer(dominoes, joined.state, 3, seeded(3));
  assert.equal(left.set, 9);
  assert.ok('error' in act(state, 1, { type: 'chooseSet', set: 7 }));
  assert.ok('error' in act(state, 1, { type: 'chooseSet' }));
  assert.ok('error' in act(state, 9, { type: 'chooseSet', set: 6 }), 'only a seated player');
  const first = ok(applyMove(dominoes, state, state.currentPlayer as number,
    { type: 'play', tile: state.leadTile, end: 'left' }, noShuffle));
  assert.ok('error' in act(first, 1, { type: 'chooseSet', set: 6 }));
  assert.equal(first.set, 9);
});

test('invalid moves leave the state unchanged', () => {
  const state = game();
  const frozen = JSON.stringify(state);
  const bad: unknown[] = [
    null, 'play', {}, { type: 'play' }, { type: 'play', tile: 1.5, end: 'left' }, { type: 'play', tile: '3', end: 'left' },
    { type: 'play', tile: -1, end: 'left' }, { type: 'play', tile: 99, end: 'left' }, { type: 'play', tile: t(4, 5), end: 'up' },
    { type: 'play', tile: t(4, 5) }, { type: 'play', tile: t(3, 6), end: 'left' }, { type: 'play', tile: t(0, 1), end: 'left' },
    { type: 'draw' }, { type: 'pass' }, { type: 'bogus' }
  ];
  for (const made of bad) assert.ok('error' in move(state, 1, made), JSON.stringify(made));
  assert.equal(JSON.stringify(state), frozen);
  for (const action of [null, {}, { type: 'chooseSet', set: 6 }, { type: 'acknowledgeRound' }, { type: 'nope' }]) {
    assert.ok('error' in act(state, 1, action), JSON.stringify(action));
  }
  // Nobody moves while a round is waiting to be scored
  const over = ok(play(game({ hands: { 1: [t(4, 5)], 2: [t(3, 6)], 3: [t(1, 1)] } }), 1, t(4, 5), 'right'));
  assert.ok('error' in move(over, 1, { type: 'pass' }));
});

test('dismissed player mid-turn: their tiles go back to the boneyard and the next player moves', () => {
  const state = game({ currentPlayer: 2 });
  const gone = removePlayer(dominoes, state, 2, seeded(1));
  assert.equal(gone.currentPlayer, 3);
  assert.equal(gone.hands[2], undefined);
  assert.deepEqual([...gone.boneyard].sort(), [t(3, 6), t(2, 2), t(6, 6), t(0, 0)].sort());

  // The last seat dismissed while it was Alice's turn wraps to the first seat
  const wrap = removePlayer(dominoes, game({ currentPlayer: 3 }), 3, seeded(1));
  assert.equal(wrap.currentPlayer, 1);
  assert.equal(wrap.hands[1].length, 2);

  // A leaver who was the round's last winner no longer leads
  const leader = removePlayer(dominoes, { ...game({ currentPlayer: 1 }), lastWinner: 3 }, 3, seeded(1));
  assert.equal(leader.lastWinner, null);

  // A dismissal that leaves one player ends the game
  const two = removePlayer(dominoes, game({ activePlayers: [1, 2], currentPlayer: 1 }), 2, seeded(1));
  assert.equal(two.isGameOver, true);
  assert.deepEqual(two.winners, [1]);
});

test('a dismissed player can leave the others blocked, and the round ends', () => {
  const line = laid([6, 6]);
  // Bob, who held the only way to unblock, leaves: his tile goes to the boneyard, so nobody is blocked
  const state = game({ line, boneyard: [], hands: { 1: [t(0, 1)], 2: [t(2, 2)], 3: [t(5, 5)] }, currentPlayer: 1 });
  const gone = removePlayer(dominoes, state, 2, seeded(1));
  assert.equal(gone.roundSummary, null);
  assert.equal(gone.boneyard.length, 1);
  // Not blocked yet if the boneyard has a tile; with the leaver's hand empty and nothing to draw it is
  const empty = removePlayer(dominoes, { ...state, hands: { ...state.hands, 2: [] } }, 2, seeded(1));
  assert.equal(empty.roundSummary?.blocked, true);
  assert.equal(empty.roundSummary?.winner, 1);
});

test('a disconnected player is not waited for after a round', () => {
  const state = game({ hands: { 1: [t(4, 5)], 2: [t(3, 6)], 3: [t(1, 1)] } });
  let done = ok(play(state, 1, t(4, 5), 'right'));
  done = ok(act(done, 1, { type: 'acknowledgeRound' }));
  done = ok(act(done, 2, { type: 'acknowledgeRound' }));
  assert.ok(done.roundSummary);
  const after = disconnectPlayer(dominoes, done, 3, seeded(9));
  assert.equal(after.roundSummary, null);
  assert.equal(after.roundNumber, 2);
});

test('table view hides hands over every step of a short game', () => {
  let state = lobby(3, 6, seeded(11));
  const everyone = [...state.activePlayers];
  const check = (current: GameState) => {
    const table = toPublicState(current, false, null);
    assert.deepEqual(table.hand, []);
    assert.equal('hands' in table, false);
    assert.equal('boneyard' in table, false);
    assert.equal(JSON.stringify(table).includes('"boneyard"'), false);
    for (const seat of everyone) {
      const view = toPublicState(current, false, seat);
      assert.deepEqual(view.hand, current.hands[seat] ?? []);
      assert.equal('hands' in view, false);
      assert.equal('boneyard' in view, false);
      for (const other of everyone.filter(o => o !== seat)) assert.equal(view.handCounts[other], current.hands[other].length);
    }
    assert.equal(table.boneyardCount, current.boneyard.length);
  };
  check(state);
  for (let step = 0; step < 60 && !state.isGameOver && !state.roundSummary; step++) {
    const seat = state.currentPlayer as number;
    const hand = state.hands[seat];
    const options = legalPlays(state.set, hand, state.line, state.leadTile);
    const made = options.length > 0 ? { type: 'play', ...options[0] } : state.boneyard.length > 0 ? { type: 'draw' } : { type: 'pass' };
    state = ok(applyMove(dominoes, state, seat, made, seeded(step)));
    check(state);
  }
});

test('undo reshuffles the boneyard', () => {
  const state = game({ boneyard: [1, 2, 3, 4, 5, 6, 7, 8] });
  const undone = dominoes.onUndo?.(state, seeded(4)) ?? assert.fail('Dominoes has onUndo');
  assert.deepEqual([...undone.boneyard].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notDeepEqual(undone.boneyard, state.boneyard);
  assert.deepEqual(undone.hands, state.hands);
});

test('dealing again with a winner leads that winner, who may play any tile', () => {
  const dealt = dealRound({ ...game(), lastWinner: 2, line: [] }, seeded(2));
  assert.equal(dealt.currentPlayer, 2);
  assert.equal(dealt.leadTile, null);
  const any = dealt.hands[2][3];
  assert.ok(!('error' in play(dealt, 2, any, 'left')));
});

test('a dismissed leader who held the lead tile hands the opening to the tile now highest', () => {
  // After a tied round the first-round lead rule applies; Bob must lead with 6-6, then he is dismissed
  const state = game({
    line: [],
    leadTile: t(6, 6),
    currentPlayer: 2,
    hands: { 1: [t(5, 5), t(0, 1)], 2: [t(6, 6), t(2, 2)], 3: [t(3, 4), t(1, 1)] },
    boneyard: [t(0, 0)]
  });
  const gone = removePlayer(dominoes, state, 2, seeded(1));
  assert.equal(gone.leadTile, t(5, 5));
  assert.equal(gone.currentPlayer, 1);
  assert.ok(!('error' in play(gone, 1, t(5, 5), 'left')));
  assert.ok('error' in play(gone, 1, t(0, 1), 'left'));
  // A leader who is not the lead tile's holder leaves it alone
  const other = removePlayer(dominoes, { ...state, currentPlayer: 2 }, 3, seeded(1));
  assert.equal(other.leadTile, t(6, 6));
  assert.equal(other.currentPlayer, 2);
});
