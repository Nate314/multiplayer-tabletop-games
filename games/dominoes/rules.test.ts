import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_SIZES, dealRound, layoutOf, legalPlays, openingTile, pipTotal, standardTarget, stuckMove, targetScore, tilesOf, toPublicState, usableEnds
} from './rules.ts';
import { EMPTY_BOARD, boardFromLine, boardOf, lay, lineOf, openEnds } from './board.ts';
import type { ArmName, Board, Branching } from './board.ts';
import { dominoes } from './index.ts';
import { setHouseRules } from '../../shared/houseRules.ts';
import type { HouseRulesState, HouseRuleValues } from '../../shared/houseRules.ts';
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

// The host's proposal, as the manager applies it: the rules change and the tiles are dealt again
function propose(state: GameState, values: HouseRuleValues, random: Random = noShuffle): Result<GameState> {
  const result = setHouseRules(dominoes.info, state, 1, { values, override: false, maxPlayers: null });
  return 'error' in result ? result : { state: dominoes.resetLobby(result.state, random) };
}

function lobby(count: number, set?: SetSize, random: Random = seeded(count)): GameState {
  let state = dominoes.createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan'].slice(0, count)) {
    const result = addPlayer(dominoes, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return set ? ok(propose(state, { set }, random)) : state;
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
    board: boardFromLine(laid([3, 4])),
    openTrains: [],
    drewThisTurn: false,
    ...overrides
  };
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// House rules as a joined lobby would have them, everyone agreed
const rules = (values: HouseRuleValues): HouseRulesState => ({
  host: 1, values: { set: 6, branching: 'every', chickenfoot: false, trains: false, ...values },
  override: false, maxPlayers: null, agreed: [1, 2, 3], revision: 1
});
const withBranching = (branching: Branching) => rules({ branching });

const move = (state: GameState, seat: number, made: unknown) => applyMove(dominoes, state, seat, made, noShuffle);
// Plays on the newest open arm with that name; the first tile of a round goes on end 0
function play(state: GameState, seat: number, tile: number, side: ArmName['kind']) {
  const board = boardOf(state);
  const open = openEnds(board).filter(({ arm }) => board.arms[arm].name.kind === side);
  const end = board.start ? (open.at(-1)?.arm ?? -1) : 0;
  return move(state, seat, { type: 'play', tile, end });
}
const pipsOfEnds = (state: GameState) => openEnds(boardOf(state)).map(({ pips }) => pips);
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
  assert.deepEqual(two.board, EMPTY_BOARD);
});

test('the first tile must be the lead tile, and either end takes it', () => {
  const start = game({ board: EMPTY_BOARD, leadTile: t(2, 2), hands: { 1: [t(2, 2), t(4, 5)], 2: [t(3, 6)], 3: [t(1, 1)] } });
  assert.ok('error' in play(start, 1, t(4, 5), 'left'));
  const next = ok(play(start, 1, t(2, 2), 'right'));
  assert.deepEqual(lineOf(next.board), laid([2, 2]));
  assert.equal(next.leadTile, null);
  assert.equal(next.currentPlayer, 2);
  assert.equal(next.lastMove?.type === 'play' && next.lastMove.where, null);
});

test('a tile must match the open end it is played on and is flipped to fit', () => {
  const state = game({ board: boardFromLine(laid([3, 4])) });
  // 4-5 matches the right end 4; the 5 faces out
  const right = ok(play(state, 1, t(4, 5), 'right'));
  assert.deepEqual(lineOf(right.board), laid([3, 4], [4, 5]));
  assert.equal(right.lastMove?.type === 'play' && right.lastMove.where, 'on the right');
  // It does not match the left end 3
  assert.ok('error' in play(state, 1, t(4, 5), 'left'));
  // 3-6 matches the left end 3 and is flipped so the 3 touches the line
  const left = ok(play({ ...state, currentPlayer: 2 }, 2, t(3, 6), 'left'));
  assert.deepEqual(lineOf(left.board), laid([6, 3], [3, 4]));
  assert.ok('error' in play({ ...state, currentPlayer: 2 }, 2, t(3, 6), 'right'));
  // A tile that matches neither end, and one not in the hand
  assert.ok('error' in play({ ...state, currentPlayer: 2 }, 2, t(2, 2), 'left'));
  assert.ok('error' in play(state, 1, t(1, 1), 'left'));
  assert.equal(legalPlays(state, 1, [t(3, 4)]).length, 2);
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
  const state = game({
    board: boardFromLine(laid([6, 6])),
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
    board: boardFromLine(laid([6, 4])),
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
  assert.equal(standardTarget(2), 100);
  assert.equal(standardTarget(3), 61);
  assert.equal(standardTarget(4), 61);
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
  assert.deepEqual(next.board, EMPTY_BOARD);
  assert.equal(next.hands[1].length, 7);
  assert.ok('error' in act(next, 1, { type: 'acknowledgeRound' }));
});

test('a new game plays every double branching, double-six, no Chickenfoot and no trains', () => {
  const state = lobby(2);
  assert.deepEqual(layoutOf(state), { branching: 'every', chickenfoot: false, trains: false });
  assert.equal(state.set, 6);
});

test('the set is a house rule: the host\'s choice is dealt and the first move locks it', () => {
  const state = ok(propose(lobby(2), { set: 9 }, seeded(2)));
  assert.equal(state.set, 9);
  assert.equal(state.hands[1].length, 9);
  assert.equal(state.hands[2].length, 9);
  assert.equal(state.boneyard.length, 55 - 18);
  // A join and a leave deal again from the same set
  const joined = addPlayer(dominoes, state, 'Cara', seeded(3));
  if ('error' in joined) assert.fail(joined.error);
  assert.equal(joined.state.set, 9);
  assert.equal(joined.state.hands[3].length, 9);
  assert.equal(removePlayer(dominoes, joined.state, 3, seeded(3)).set, 9);
  const first = ok(applyMove(dominoes, state, state.currentPlayer as number,
    { type: 'play', tile: state.leadTile, end: 0 }, noShuffle));
  assert.deepEqual(setHouseRules(dominoes.info, first, 1, { values: { set: 6 }, override: false, maxPlayers: null }),
    { error: 'The house rules are locked once play starts' });
  assert.equal(first.set, 9);
});

test('chooseSet is no longer an action', () => {
  assert.deepEqual(act(lobby(2), 1, { type: 'chooseSet', set: 9 }), { error: 'Unknown action' });
});

test('a game saved before layouts plays on as a single line', () => {
  const { houseRules: _houseRules, ...rest } = {
    ...game({ hands: { 1: [t(4, 4), t(3, 4)], 2: [t(3, 6)], 3: [t(1, 1)] } }),
    board: undefined, line: laid([3, 4]), openTrains: undefined, drewThisTurn: undefined
  };
  const saved = rest as unknown as GameState;
  assert.deepEqual(legalPlays(saved, 1, [t(3, 4)]).map(({ end }) => end), [0, 1]);
  const next = ok(play(saved, 1, t(4, 4), 'right'));
  assert.deepEqual(lineOf(next.board), laid([3, 4], [4, 4]));
  assert.equal(openEnds(next.board).length, 2);
});

test('starter only: the starting double opens four ends, a later double continues its arm', () => {
  const start = game({
    board: EMPTY_BOARD, leadTile: t(6, 6), houseRules: withBranching('starter'),
    hands: { 1: [t(6, 6), t(0, 1)], 2: [t(6, 3), t(0, 2)], 3: [t(3, 3), t(0, 4)] }
  });
  const led = ok(play(start, 1, t(6, 6), 'left'));
  assert.equal(usableEnds(led, 2).length, 4);
  const top = ok(play(led, 2, t(6, 3), 'top'));
  const doubled = ok(play(top, 3, t(3, 3), 'top'));
  assert.equal(usableEnds(doubled, 1).length, 4);
  assert.deepEqual(pipsOfEnds(doubled), [6, 6, 6, 3]);
});

test('every double: a double on an end opens three ends that each take its pips', () => {
  const state = game({ houseRules: withBranching('every'), hands: { 1: [t(4, 4), t(0, 1)], 2: [t(4, 6), t(0, 2)], 3: [t(1, 1)] } });
  const next = ok(play(state, 1, t(4, 4), 'right'));
  assert.deepEqual(pipsOfEnds(next), [3, 4, 4, 4]);
  const fours = openEnds(next.board).filter(({ pips }) => pips === 4).map(({ arm }) => arm);
  assert.deepEqual(legalPlays(next, 2, [t(4, 6)]).map(({ end }) => end), fours);
  for (const end of fours) assert.ok(!('error' in move(next, 2, { type: 'play', tile: t(4, 6), end })));
});

test('a play on a missing, fractional or closed end is refused and changes nothing', () => {
  const state = game({ hands: { 1: [t(4, 4), t(3, 5)], 2: [t(4, 6)], 3: [t(1, 1)] } });
  const frozen = JSON.stringify(state);
  for (const end of [-1, 1.5, 99, '1']) assert.ok('error' in move(state, 1, { type: 'play', tile: t(3, 5), end }), String(end));
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(3, 5), end: 99 }), { error: 'There is no such end' });
  assert.equal(JSON.stringify(state), frozen);
  // The double closes the right arm it was played on; the line goes on from a new arm
  const next = ok(play(state, 1, t(4, 4), 'right'));
  const before = JSON.stringify(next);
  assert.deepEqual(move(next, 2, { type: 'play', tile: t(4, 6), end: 1 }), { error: 'That end is closed' });
  assert.deepEqual(move(next, 2, { type: 'play', tile: t(4, 6), end: 0 }), { error: 'That tile does not match that end' });
  assert.equal(JSON.stringify(next), before);
});

test('invalid moves leave the state unchanged', () => {
  const state = game();
  const frozen = JSON.stringify(state);
  const bad: unknown[] = [
    null, 'play', {}, { type: 'play' }, { type: 'play', tile: 1.5, end: 'left' }, { type: 'play', tile: '3', end: 'left' },
    { type: 'play', tile: -1, end: 0 }, { type: 'play', tile: 99, end: 0 }, { type: 'play', tile: t(4, 5), end: 'up' },
    { type: 'play', tile: t(4, 5), end: 'right' }, { type: 'play', tile: t(4, 5) }, { type: 'play', tile: t(3, 6), end: 0 },
    { type: 'play', tile: t(0, 1), end: 0 },
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
  const board = boardFromLine(laid([6, 6]));
  // Bob, who held the only way to unblock, leaves: his tile goes to the boneyard, so nobody is blocked
  const state = game({ board, boneyard: [], hands: { 1: [t(0, 1)], 2: [t(2, 2)], 3: [t(5, 5)] }, currentPlayer: 1 });
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
    const options = legalPlays(state, seat, hand);
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
  const dealt = dealRound({ ...game(), lastWinner: 2, board: EMPTY_BOARD }, seeded(2));
  assert.equal(dealt.currentPlayer, 2);
  assert.equal(dealt.leadTile, null);
  const any = dealt.hands[2][3];
  assert.ok(!('error' in play(dealt, 2, any, 'left')));
});

test('a dismissed leader who held the lead tile hands the opening to the tile now highest', () => {
  // After a tied round the first-round lead rule applies; Bob must lead with 6-6, then he is dismissed
  const state = game({
    board: EMPTY_BOARD,
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

test('the game ends at the chosen target', () => {
  const finish = (mine: number, target: string | number) => ok(play(game({
    scores: { 1: mine, 2: 0, 3: 0 },
    hands: { 1: [t(4, 5)], 2: [t(3, 6), t(2, 2)], 3: [t(1, 1), t(5, 5)] },
    houseRules: rules({ branching: 'none', targetScore: target })
  }), 1, t(4, 5), 'right'));
  const over = finish(23, 60); // the round is worth 37
  assert.equal(over.isGameOver, true);
  assert.equal(over.scores[1], 60);
  assert.equal(finish(22, 60).isGameOver, false);
  assert.equal(finish(23, 100).isGameOver, false);
  assert.equal(finish(23, 'standard').isGameOver, false);
});

test('the standard target is still 100 for two players and 61 for three', () => {
  const seated = (players: number[], values: Record<string, string | number> = { targetScore: 'standard' }) =>
    ({ activePlayers: players, houseRules: rules(values) });
  assert.equal(targetScore(seated([1, 2])), 100);
  assert.equal(targetScore(seated([1, 2, 3])), 61);
  assert.equal(targetScore(seated([1, 2, 3, 4])), 61);
  assert.equal(targetScore({ activePlayers: [1, 2] }), 100);
  assert.equal(targetScore(seated([1, 2], { targetScore: 150 })), 150);
});

// Chickenfoot and Trains. `withRules` writes the house rule values straight into the state, everyone agreed
const withRules = (state: GameState, values: HouseRuleValues): GameState => ({ ...state, houseRules: rules(values) });
const layoutFor = (values: HouseRuleValues) => layoutOf({ houseRules: rules(values) });
const TRAINS = { trains: true };
const TRAIN_ERROR = { error: 'You can play only on your own train, the Mexican train or an open train' };
// A round whose 6-6 hub is down: one train per seat and the Mexican train, Alice to move
function hub(values: HouseRuleValues, overrides: Partial<GameState> = {}): GameState {
  return withRules(game({ board: lay(EMPTY_BOARD, layoutFor(values), t(6, 6), [6, 6], 0, [1, 2, 3]).board, ...overrides }), values);
}
// Lays tiles on a board by hand, each as [pips, arm]
const built = (board: Board, values: HouseRuleValues, ...tiles: [[number, number], number][]) =>
  tiles.reduce((next, [pips, arm]) => lay(next, layoutFor(values), t(...pips), pips, arm, [1, 2, 3]).board, board);
const owners = (state: GameState) => boardOf(state).arms.map(arm => arm.owner);

test('Chickenfoot: after a double the next three tiles must go on it', () => {
  const state = withRules(game({
    hands: { 1: [t(4, 4), t(4, 0), t(6, 6)], 2: [t(3, 1), t(4, 5), t(2, 2)], 3: [t(4, 6), t(1, 1), t(0, 0)] }
  }), { branching: 'every', chickenfoot: true });
  let next = ok(play(state, 1, t(4, 4), 'right'));
  const foot = openEnds(next.board).filter(({ pips }) => pips === 4).map(({ arm }) => arm);
  assert.equal(foot.length, 3);
  for (const seat of [1, 2, 3]) assert.deepEqual(usableEnds(next, seat), foot);
  const frozen = JSON.stringify(next);
  assert.deepEqual(play(next, 2, t(3, 1), 'left'), { error: 'Finish the 4-4 first' });
  assert.equal(JSON.stringify(next), frozen);
  next = ok(move(next, 2, { type: 'play', tile: t(4, 5), end: foot[0] }));
  next = ok(move(next, 3, { type: 'play', tile: t(4, 6), end: foot[1] }));
  assert.deepEqual(usableEnds(next, 1), [foot[2]]);
  next = ok(move(next, 1, { type: 'play', tile: t(4, 0), end: foot[2] }));
  assert.ok(usableEnds(next, 2).includes(0));
  next = ok(play(next, 2, t(3, 1), 'left'));
  assert.equal(next.currentPlayer, 3);
});

test('Chickenfoot with no branches: a double must be covered before anyone plays elsewhere', () => {
  const state = withRules(game({
    hands: { 1: [t(4, 4), t(0, 0)], 2: [t(3, 1), t(4, 5), t(2, 2)], 3: [t(1, 1)] }
  }), { branching: 'none', chickenfoot: true });
  let next = ok(play(state, 1, t(4, 4), 'right'));
  const forward = usableEnds(next, 2);
  assert.equal(forward.length, 1);
  assert.deepEqual(play(next, 2, t(3, 1), 'left'), { error: 'Finish the 4-4 first' });
  next = ok(move(next, 2, { type: 'play', tile: t(4, 5), end: forward[0] }));
  assert.equal(usableEnds(next, 3).length, 2);
  next = ok(play({ ...next, currentPlayer: 2 }, 2, t(3, 1), 'left'));
  assert.deepEqual(lineOf(next.board).map(({ left, right }) => [left, right]), [[1, 3], [3, 4], [4, 4], [4, 5]]);
});

test('Chickenfoot with starter only: all four ends of the starting double before any arm grows', () => {
  const start = withRules(game({
    board: EMPTY_BOARD, leadTile: t(6, 6),
    hands: { 1: [t(6, 6), t(6, 3), t(0, 0)], 2: [t(6, 1), t(6, 4), t(0, 2)], 3: [t(6, 2), t(1, 1), t(0, 3)] }
  }), { branching: 'starter', chickenfoot: true });
  let next = ok(play(start, 1, t(6, 6), 'left'));
  assert.deepEqual(usableEnds(next, 2), [0, 1, 2, 3]);
  next = ok(move(next, 2, { type: 'play', tile: t(6, 1), end: 0 }));
  const frozen = JSON.stringify(next);
  assert.deepEqual(move(next, 3, { type: 'play', tile: t(1, 1), end: 0 }), { error: 'Finish the 6-6 first' });
  assert.equal(JSON.stringify(next), frozen);
  next = ok(move(next, 3, { type: 'play', tile: t(6, 2), end: 1 }));
  next = ok(move(next, 1, { type: 'play', tile: t(6, 3), end: 2 }));
  next = ok(move(next, 2, { type: 'play', tile: t(6, 4), end: 3 }));
  next = ok(move(next, 3, { type: 'play', tile: t(1, 1), end: 0 }));
  // The 1-1 is a later double: it opens one end, which must be covered next
  assert.deepEqual(usableEnds(next, 1), [4]);
});

test('Trains: the starting double opens one train per player and the Mexican train', () => {
  const start = withRules(game({
    board: EMPTY_BOARD, leadTile: t(6, 6), hands: { 1: [t(6, 6), t(0, 1)], 2: [t(6, 3)], 3: [t(1, 1)] }
  }), TRAINS);
  const led = ok(play(start, 1, t(6, 6), 'left'));
  assert.deepEqual(owners(led), [1, 2, 3, 'mexican']);
  assert.ok(led.board.arms.every(arm => arm.name.kind === 'train' && arm.base === 6));
  // Bob may use his own train and the Mexican train
  assert.deepEqual(usableEnds(led, 2), [1, 3]);
  assert.deepEqual(usableEnds(led, 2, true), [0, 1, 2, 3]);
});

test('Trains: you may play only on your own train, the Mexican train or an open train', () => {
  const state = hub(TRAINS, { hands: { 1: [t(6, 2), t(0, 1)], 2: [t(3, 6)], 3: [t(1, 1)] } });
  const frozen = JSON.stringify(state);
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(6, 2), end: 1 }), TRAIN_ERROR);
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(6, 2), end: 2 }), TRAIN_ERROR);
  assert.equal(JSON.stringify(state), frozen);
  assert.deepEqual(legalPlays(state, 1, state.hands[1]).map(({ end }) => end), [0, 3]);
  const mexican = ok(move(state, 1, { type: 'play', tile: t(6, 2), end: 3 }));
  assert.equal(mexican.lastMove?.type === 'play' && mexican.lastMove.where, 'on the Mexican train');
  ok(move(state, 1, { type: 'play', tile: t(6, 2), end: 0 }));
  const open = ok(move({ ...state, openTrains: [2] }, 1, { type: 'play', tile: t(6, 2), end: 1 }));
  assert.equal(open.lastMove?.type === 'play' && open.lastMove.where, 'on Bob\'s train');
  assert.deepEqual(open.openTrains, [2]);
});

test('Trains: with nothing to play you draw one tile, then pass and your train opens', () => {
  const state = hub(TRAINS, { hands: { 1: [t(0, 1), t(2, 3)], 2: [t(3, 6)], 3: [t(1, 1)] }, boneyard: [t(0, 0), t(4, 5)] });
  assert.equal(stuckMove(state, 1, state.hands[1], state.boneyard.length), 'draw');
  assert.deepEqual(move(state, 1, { type: 'pass' }), { error: 'Draw from the boneyard first' });
  const drawn = ok(move(state, 1, { type: 'draw' }));
  assert.equal(drawn.drewThisTurn, true);
  assert.equal(drawn.currentPlayer, 1);
  assert.deepEqual(drawn.hands[1], [t(0, 1), t(2, 3), t(4, 5)]);
  assert.equal(stuckMove(drawn, 1, drawn.hands[1], drawn.boneyard.length), 'pass');
  assert.deepEqual(move(drawn, 1, { type: 'draw' }), { error: 'You have already drawn this turn' });
  const passed = ok(move(drawn, 1, { type: 'pass' }));
  assert.deepEqual(passed.openTrains, [1]);
  assert.equal(passed.gameStatus, 'Alice passed: Alice\'s train is open');
  assert.deepEqual(passed.lastMove, { type: 'pass', playerNumber: 1, trainOpened: true });
  assert.equal(passed.currentPlayer, 2);
  assert.equal(passed.drewThisTurn, false);
  // A drawn tile that fits may be played at once
  const fits = ok(move({ ...state, boneyard: [t(0, 0), t(6, 5)] }, 1, { type: 'draw' }));
  const played = ok(move(fits, 1, { type: 'play', tile: t(6, 5), end: 0 }));
  assert.equal(played.drewThisTurn, false);
  assert.equal(played.currentPlayer, 2);
  // Without Trains drawing goes on until a tile fits
  const plain = withRules(game({ hands: { 1: [t(0, 1), t(2, 2)], 2: [t(3, 6)], 3: [t(1, 1)] }, boneyard: [t(0, 0), t(5, 6)] }), {});
  const once = ok(move(plain, 1, { type: 'draw' }));
  assert.equal(stuckMove(once, 1, once.hands[1], once.boneyard.length), 'draw');
  assert.ok(!('error' in move(once, 1, { type: 'draw' })));
});

test('Trains: playing on your own train closes it', () => {
  const state = hub(TRAINS, { hands: { 1: [t(6, 2), t(6, 1), t(0, 0)], 2: [t(3, 6)], 3: [t(1, 1)] }, openTrains: [1, 3] });
  const mexican = ok(move(state, 1, { type: 'play', tile: t(6, 2), end: 3 }));
  assert.deepEqual(mexican.openTrains, [1, 3]);
  const own = ok(move(state, 1, { type: 'play', tile: t(6, 2), end: 0 }));
  assert.deepEqual(own.openTrains, [3]);
});

test('Trains: every round opens with the highest double, and the last winner does not lead', () => {
  // Without shuffling, Alice holds 0-0, Bob 1-1 and 2-2, and Cara 3-3
  const trains = dealRound(withRules({ ...game(), lastWinner: 2, board: EMPTY_BOARD }, TRAINS), noShuffle);
  assert.equal(trains.leadTile, t(3, 3));
  assert.equal(trains.currentPlayer, 3);
  const plain = dealRound(withRules({ ...game(), lastWinner: 2, board: EMPTY_BOARD }, {}), noShuffle);
  assert.equal(plain.leadTile, null);
  assert.equal(plain.currentPlayer, 2);
});

// A Random that makes `shuffle` deal the set in exactly this order
function arranged(order: number[]): Random {
  const items = order.map((_, i) => i);
  const values: number[] = [];
  for (let i = items.length - 1; i > 0; i--) {
    const j = items.indexOf(order[i]);
    values.push((j + 0.5) / (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  let next = 0;
  return () => values[next++] ?? 0.999999;
}

test('Trains: when nobody holds a double, players draw in seat order until one does', () => {
  const doubles = tilesOf(6).flatMap(([a, b], tile) => (a === b ? [tile] : []));
  const others = tilesOf(6).flatMap(([a, b], tile) => (a === b || tile === t(0, 1) ? [] : [tile]));
  // Two hands of seven with no double; the boneyard's top tiles are 0-1 (drawn by Alice), then 4-4 (drawn by Bob)
  const order = [...others, ...doubles.filter(tile => tile !== t(4, 4)), t(4, 4), t(0, 1)];
  const state = withRules({ ...game(), activePlayers: [1, 2], board: EMPTY_BOARD }, TRAINS);
  const dealt = dealRound(state, arranged(order));
  assert.deepEqual(dealt.hands[1], [...others.slice(0, 7), t(0, 1)]);
  assert.deepEqual(dealt.hands[2], [...others.slice(7, 14), t(4, 4)]);
  assert.equal(dealt.currentPlayer, 2);
  assert.equal(dealt.leadTile, t(4, 4));
  assert.equal(dealt.boneyard.length, 12);
  assert.ok(!('error' in move(dealt, 2, { type: 'play', tile: t(4, 4), end: 0 })));
});

test('Trains with Chickenfoot: the hub is exempt, and anyone may finish a double on a train', () => {
  const values = { trains: true, chickenfoot: true, branching: 'every' };
  const start = hub(values);
  assert.deepEqual(usableEnds(start, 2), [1, 3]);
  // A 2-2 on Bob's train opens three ends of Bob's train, which Cara must finish first
  const board = built(start.board, values, [[6, 2], 1], [[2, 2], 1]);
  const state = { ...start, board, currentPlayer: 3, hands: { 1: [t(0, 0)], 2: [t(1, 1)], 3: [t(6, 1), t(2, 5), t(0, 3)] } };
  assert.deepEqual(owners(state).slice(4), [2, 2, 2]);
  assert.deepEqual(usableEnds(state, 3), [4, 5, 6]);
  assert.deepEqual(move(state, 3, { type: 'play', tile: t(6, 1), end: 2 }), { error: 'Finish the 2-2 first' });
  const finished = ok(move(state, 3, { type: 'play', tile: t(2, 5), end: 4 }));
  assert.deepEqual(finished.openTrains, []);
  assert.deepEqual(usableEnds(finished, 1), [5, 6]);
});

test('Trains: a dismissed player\'s train is open to everyone', () => {
  const state = hub(TRAINS, { hands: { 1: [t(6, 2), t(0, 1)], 2: [t(3, 3)], 3: [t(1, 1)] } });
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(6, 2), end: 1 }), TRAIN_ERROR);
  const gone = removePlayer(dominoes, state, 2, noShuffle);
  assert.deepEqual(owners(gone), [1, 2, 3, 'mexican']);
  assert.deepEqual(usableEnds(gone, 1), [0, 1, 3]);
  const next = ok(move(gone, 1, { type: 'play', tile: t(6, 2), end: 1 }));
  assert.equal(next.currentPlayer, 3);
  // A leaver dismissed after drawing on their turn: the next player may still draw
  const drew = hub(TRAINS, { currentPlayer: 2, hands: { 1: [t(0, 1)], 2: [t(1, 2)], 3: [t(1, 1)] }, boneyard: [t(0, 0), t(2, 3)] });
  const drawn = ok(move(drew, 2, { type: 'draw' }));
  const left = removePlayer(dominoes, drawn, 2, noShuffle);
  assert.equal(left.currentPlayer, 3);
  assert.equal(left.drewThisTurn, false);
  assert.equal(removePlayer(dominoes, drawn, 1, noShuffle).drewThisTurn, true);
});

test('Trains: a dismissed leader who held the lead double opens the round again', () => {
  // Bob must lead with 6-6 and is dismissed. His tiles go on top of the boneyard, and nobody left holds a double, so
  // Alice draws 2-3, then Cara draws 6-6 and leads with it
  const state = withRules(game({
    board: EMPTY_BOARD, leadTile: t(6, 6), currentPlayer: 2,
    hands: { 1: [t(0, 1)], 2: [t(6, 6), t(2, 3)], 3: [t(1, 2)] },
    boneyard: [t(0, 5)]
  }), TRAINS);
  const gone = removePlayer(dominoes, state, 2, noShuffle);
  assert.equal(gone.leadTile, t(6, 6));
  assert.equal(gone.currentPlayer, 3);
  assert.deepEqual(gone.hands[1], [t(0, 1), t(2, 3)]);
  assert.deepEqual(gone.hands[3], [t(1, 2), t(6, 6)]);
  assert.deepEqual(gone.boneyard, [t(0, 5)]);
  const led = ok(move(gone, 3, { type: 'play', tile: t(6, 6), end: 0 }));
  assert.deepEqual(owners(led), [1, 3, 'mexican']);
});

test('Trains: a round is not blocked while a pass would open a train someone can use', () => {
  // Alice's train ends in 5, Bob's in 3, Cara's in 4 and the Mexican train in 0. Only Bob can play, on Alice's train
  const board = built(hub(TRAINS).board, TRAINS, [[6, 5], 0], [[6, 3], 1], [[6, 4], 2], [[6, 0], 3]);
  const state = hub(TRAINS, { board, boneyard: [], currentPlayer: 3, hands: { 1: [t(1, 2)], 2: [t(5, 1), t(1, 1)], 3: [t(2, 2)] } });
  assert.deepEqual(legalPlays(state, 2, state.hands[2]), []);
  const cara = ok(move(state, 3, { type: 'pass' }));
  assert.equal(cara.roundSummary, null);
  assert.equal(cara.gameStatus, 'Cara passed: Cara\'s train is open');
  const alice = ok(move(cara, 1, { type: 'pass' }));
  assert.equal(alice.roundSummary, null);
  assert.deepEqual(alice.openTrains, [3, 1]);
  assert.equal(alice.currentPlayer, 2);
  const bob = ok(move(alice, 2, { type: 'play', tile: t(5, 1), end: 0 }));
  assert.equal(bob.roundSummary, null);
  // Blocked: nobody could play even with every train open
  const stuck = ok(move({ ...state, hands: { ...state.hands, 2: [t(1, 1), t(2, 6)] } }, 3, { type: 'pass' }));
  assert.equal(stuck.roundSummary?.blocked, true);
});

test('a double nobody can finish with the boneyard empty ends the round as blocked', () => {
  // Nobody holds another 4, so the 4-4's foot can never be finished, though Bob's 3-1 would fit the left end
  const state = withRules(game({
    boneyard: [], hands: { 1: [t(4, 4), t(0, 0)], 2: [t(3, 1)], 3: [t(1, 1)] }
  }), { branching: 'every', chickenfoot: true });
  const blocked = ok(play(state, 1, t(4, 4), 'right'));
  assert.equal(blocked.roundSummary?.blocked, true);
  assert.equal(blocked.currentPlayer, null);
  // The same under Trains, on Alice's own train
  const trains = hub({ trains: true, chickenfoot: true }, { boneyard: [], hands: { 1: [t(6, 4), t(4, 4), t(0, 0)], 2: [t(1, 6)], 3: [t(2, 2)] } });
  const four = ok(move(trains, 1, { type: 'play', tile: t(6, 4), end: 0 }));
  assert.equal(four.roundSummary, null);
  const dead = ok(move({ ...four, currentPlayer: 1 }, 1, { type: 'play', tile: t(4, 4), end: 0 }));
  assert.equal(dead.roundSummary?.blocked, true);
});

test('Trains without branching, with starter only and with every double all keep the hub', () => {
  for (const [branching, added] of [['none', 1], ['starter', 1], ['every', 3]] as const) {
    const start = withRules(game({
      board: EMPTY_BOARD, leadTile: t(6, 6), hands: { 1: [t(6, 6), t(0, 1)], 2: [t(6, 3), t(3, 3), t(0, 2)], 3: [t(1, 1)] }
    }), { trains: true, branching });
    const led = ok(play(start, 1, t(6, 6), 'left'));
    assert.deepEqual(owners(led), [1, 2, 3, 'mexican'], branching);
    const next = ok(move(led, 2, { type: 'play', tile: t(6, 3), end: 1 }));
    const doubled = ok(move({ ...next, currentPlayer: 2 }, 2, { type: 'play', tile: t(3, 3), end: 1 }));
    assert.equal(doubled.board.arms.length, 4 + added, branching);
    assert.ok(doubled.board.arms.slice(4).every(arm => arm.owner === 2), branching);
  }
});

test('hand-crafted moves under Trains and Chickenfoot are refused with the state unchanged', () => {
  const values = { trains: true, chickenfoot: true, branching: 'every' };
  const start = hub(values);
  // Cara's train ends in 5; Bob's ends in an unfinished 2-2
  const board = built(start.board, values, [[6, 5], 2], [[6, 2], 1], [[2, 2], 1]);
  const state = { ...start, board, hands: { 1: [t(2, 4), t(5, 4), t(6, 1)], 2: [t(1, 1)], 3: [t(0, 0)] } };
  const frozen = JSON.stringify(state);
  for (const end of [-1, 1.5, 99, '1']) assert.ok('error' in move(state, 1, { type: 'play', tile: t(2, 4), end }), String(end));
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(2, 4), end: 1 }), { error: 'That end is closed' });
  // Ends outside the unfinished double: Cara's train and Alice's own
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(5, 4), end: 2 }), { error: 'Finish the 2-2 first' });
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(6, 1), end: 0 }), { error: 'Finish the 2-2 first' });
  assert.equal(JSON.stringify(state), frozen);
  // Once the 2-2 is finished, Cara's closed train is refused
  const finished = { ...state, board: built(board, values, [[2, 0], 4], [[2, 1], 5], [[2, 3], 6]) };
  const before = JSON.stringify(finished);
  assert.deepEqual(move(finished, 1, { type: 'play', tile: t(5, 4), end: 2 }), TRAIN_ERROR);
  assert.equal(JSON.stringify(finished), before);
});
