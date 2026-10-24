import type { Page } from '@playwright/test';
import {
  agreeToHouseRules, dismiss, expect, leave, openFaq, setHouseRules, test, undo, type Seat, type Table
} from './fixtures.ts';
import { boardFromLine } from '../games/dominoes/board.ts';
import { pipsName, tilesOf } from '../games/dominoes/rules.ts';
import type { GameState, SetSize } from '../games/dominoes/types.ts';
import type { HouseRuleValues } from '../shared/houseRules.ts';

// One test per rule, control and difference in games/dominoes/README.md. Players are seated in join order:
// Alice is seat 1, Bob seat 2, Cara seat 3. A tile is written as its two pip counts.

type Pips = [number, number];
const id = (a: number, b: number, set: SetSize = 6) =>
  tilesOf(set).findIndex(([low, high]) => low === Math.min(a, b) && high === Math.max(a, b));
const ids = (...tiles: Pips[]) => tiles.map(([a, b]) => id(a, b));
const laid = (...tiles: Pips[]) => tiles.map(([left, right]) => ({ tile: id(left, right), left, right }));

type Deal = {
  hands: Record<number, Pips[]>;
  boneyard?: Pips[];
  line?: Pips[]; // as laid, left to right
  current?: number;
  scores?: Record<number, number>;
};

// Crafts a round under way
async function deal(table: Table, { hands, boneyard = [], line = [[3, 4]], current = 1, scores }: Deal) {
  const seats = Object.keys(hands).map(Number);
  await table.patch({
    started: true,
    set: 6,
    roundNumber: 1,
    hands: Object.fromEntries(seats.map(seat => [seat, ids(...hands[seat])])),
    boneyard: ids(...boneyard),
    board: boardFromLine(laid(...line)),
    openTrains: [],
    drewThisTurn: false,
    leadTile: null,
    lastWinner: null,
    roundSummary: null,
    lastMove: null,
    currentPlayer: current,
    scores: scores ?? Object.fromEntries(seats.map(seat => [seat, 0]))
  });
}

// These tests play the single line unless they say otherwise
async function start(seat: Seat, names = ['Alice', 'Bob', 'Cara'], houseRules: HouseRuleValues = { branching: 'none' }) {
  const table = await seat('dominoes', names, { houseRules });
  return { table, pages: table.pages };
}

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handTile = (page: Page, a: number, b: number) => hand(page).getByRole('button', { name: pipsName([Math.min(a, b), Math.max(a, b)]), exact: true });
const play = (page: Page, a: number, b: number) => handTile(page, a, b).click();
const lineTiles = (page: Page) => page.locator('.line .tile');
const lineTitles = (page: Page) => lineTiles(page).evaluateAll(tiles => tiles.map(tile => tile.getAttribute('title')));
const player = (page: Page, name: string) => page.locator('.players .player', { hasText: name });
const countOf = (page: Page, name: string) => player(page, name).locator('.player-count');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Round scoring' });
const boneyard = (page: Page) => page.locator('.boneyard-label');

test.describe('Dominoes rules', () => {
  test('double-six has 28 tiles and double-nine 55, dealt 7 and 9 each, and the highest double leads with it', async ({ seat }) => {
    for (const [set, size, total] of [[6, 7, 28], [9, 9, 55]] as const) {
      const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { branching: 'none', set });
      const state = await table.state<GameState>();
      const all = [...Object.values(state.hands).flat(), ...state.boneyard];
      expect(new Set(all).size).toBe(total);
      expect(all).toHaveLength(total);
      await expect(hand(alice).getByRole('button')).toHaveCount(size);
      await expect(countOf(alice, 'Bob')).toHaveText(`${size} tiles`);
      await expect(boneyard(bob)).toHaveText(`Boneyard: ${total - 2 * size}`);

      // The leader may play only the lead tile, a double when anyone holds one
      const leader = state.currentPlayer as number;
      const page = table.pages[leader - 1];
      const [low, high] = tilesOf(set)[state.leadTile as number];
      if (Object.values(state.hands).flat().some(tile => tilesOf(set)[tile][0] === tilesOf(set)[tile][1])) expect(low).toBe(high);
      await expect(hand(page).locator('button:not([disabled])')).toHaveCount(1);
      await expect(handTile(page, low, high)).toBeEnabled();
      await expect(turn(page)).toHaveText('You go first. Joining closes after the first move.');
    }
  });

  test('the host\'s set is dealt, kept across joins, and locked by the first move', async ({ seat }) => {
    const table = await seat('dominoes', ['Alice', 'Bob'], { agree: false });
    const [alice, bob] = table.pages;
    await setHouseRules(alice, 'dominoes', { branching: 'none', set: 9 });
    const bobsSet = bob.getByLabel('Set', { exact: true });
    await expect(bobsSet).toHaveValue('9');
    await expect(bobsSet).toBeDisabled();
    await expect(bobsSet.locator('option:checked')).toHaveText('Double-nine (55 tiles)');

    const cara = await table.join('Cara');
    await expect(hand(cara).getByRole('button')).toHaveCount(9);
    await agreeToHouseRules(alice, bob, cara);

    const state = await table.state<GameState>();
    const leader = [alice, bob, cara][(state.currentPlayer as number) - 1];
    const [low, high] = tilesOf(9)[state.leadTile as number];
    await play(leader, low, high);
    await expect(alice.locator('.house-rules-panel')).toHaveCount(0);
    expect((await table.state<GameState>()).set).toBe(9);
  });

  test('a tile must match the open end it is played on and is flipped to fit; a double lies in the line without branching', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await deal(table, {
      hands: { 1: [[4, 5], [1, 1], [4, 4]], 2: [[3, 6], [2, 2]] },
      boneyard: [[0, 0]]
    });
    await expect(alice.locator('.line-ends')).toHaveText('Open ends: 3 and 4');
    // Only the tiles with a 3 or a 4 can be played
    await expect(handTile(alice, 4, 5)).toBeEnabled();
    await expect(handTile(alice, 4, 4)).toBeEnabled();
    await expect(handTile(alice, 1, 1)).toBeDisabled();
    // 4-5 goes on the right end 4 with the 5 facing out
    await play(alice, 4, 5);
    expect(await lineTitles(bob)).toEqual(['3-4', '4-5']);
    await expect(status(bob)).toHaveText('Alice played 4-5 on the right');
    // 3-6 goes on the left end 3 and is flipped so the 3 touches the line
    await play(bob, 3, 6);
    expect(await lineTitles(alice)).toEqual(['6-3', '3-4', '4-5']);
    await expect(alice.locator('.line-ends')).toHaveText('Open ends: 6 and 5');
    await expect(status(alice)).toHaveText('Bob played 6-3 on the left');
  });

  test('a tile that fits both ends asks for an end', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await deal(table, { hands: { 1: [[2, 4], [1, 1]], 2: [[4, 6]] }, line: [[2, 3], [3, 4]] });
    await play(alice, 2, 4);
    const choice = alice.getByRole('group', { name: 'Choose an end' });
    await expect(choice).toBeVisible();
    // Cancel puts the tile back
    await choice.getByRole('button', { name: 'Cancel' }).click();
    await expect(choice).toHaveCount(0);
    await play(alice, 2, 4);
    await choice.getByRole('button', { name: 'Left end (2)' }).click();
    expect(await lineTitles(bob)).toEqual(['4-2', '2-3', '3-4']);
    await expect(status(bob)).toHaveText('Alice played 4-2 on the left');
  });

  test('draw is allowed only when nothing fits', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await deal(table, { hands: { 1: [[0, 1], [2, 2]], 2: [[3, 6]] }, boneyard: [[6, 6], [0, 0], [3, 5]] });
    await expect(button(alice, 'Draw')).toBeEnabled();
    await expect(button(alice, 'Pass')).toBeDisabled();
    await expect(button(bob, 'Draw')).toBeDisabled();
    await expect(alice.locator('.hint')).toHaveText('Nothing fits: draw from the boneyard');
    await button(alice, 'Draw').click();
    await expect(hand(alice).getByRole('button')).toHaveCount(3);
    await expect(countOf(bob, 'Alice')).toHaveText('3 tiles');
    await expect(boneyard(bob)).toHaveText('Boneyard: 2');
    await expect(status(bob)).toHaveText('Alice drew a tile');
    // The 3-5 fits, so no more drawing, and it is still Alice's turn
    await expect(button(alice, 'Draw')).toBeDisabled();
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(handTile(alice, 3, 5)).toBeEnabled();
    await play(alice, 3, 5);
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('the boneyard is a button to draw while nothing fits, and an undo of a draw restores the hand', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await deal(table, { hands: { 1: [[0, 1], [2, 2]], 2: [[3, 6]] }, boneyard: [[6, 6], [0, 0], [3, 5]] });
    await alice.getByRole('button', { name: 'Draw a tile' }).click();
    await expect(hand(alice).getByRole('button')).toHaveCount(3);
    await undo(alice, bob);
    await expect(hand(alice).getByRole('button')).toHaveCount(2);
    await expect(boneyard(alice)).toHaveText('Boneyard: 3');
    // The boneyard keeps the same tiles, though not necessarily in the same order
    const state = await table.state<GameState>();
    expect([...state.boneyard].sort((a, b) => a - b)).toEqual(ids([6, 6], [0, 0], [3, 5]).sort((a, b) => a - b));
  });

  test('pass is allowed only when nothing fits and the boneyard is empty', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await deal(table, { hands: { 1: [[0, 1], [2, 2]], 2: [[3, 6]] }, boneyard: [] });
    await expect(button(alice, 'Draw')).toBeDisabled();
    await expect(button(alice, 'Pass')).toBeEnabled();
    await expect(alice.locator('.hint')).toHaveText('Nothing fits and the boneyard is empty: pass');
    await button(alice, 'Pass').click();
    await expect(status(bob)).toHaveText('Alice passed');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('playing out the hand scores the other hands and the boneyard; Continue deals the next round led by the winner; the game ends at the target score', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [[4, 5]], 2: [[3, 6], [2, 2]], 3: [[1, 1], [5, 5]] },
      boneyard: [[6, 6], [0, 0]]
    });
    await play(alice, 4, 5);
    const dialog = scoring(bob);
    await expect(dialog.locator('h2')).toHaveText('Round 1 scoring');
    // Bob 9 + 4, Cara 2 + 10, and the boneyard 12
    await expect(dialog.locator('.summary-result')).toHaveText('Alice went out and scores 37 points');
    await expect(dialog.locator('.summary-seat', { hasText: 'Alice' })).toContainText('37 pts');
    await expect(dialog.locator('.summary-seat', { hasText: 'Bob' })).toContainText('2 tiles left, 13 pips');
    await expect(dialog.locator('.summary-seat', { hasText: 'Cara' })).toContainText('2 tiles left, 12 pips');
    await expect(dialog).toContainText('The boneyard held 12 pips');
    await expect(turn(bob)).toHaveText('Round 1 is over');

    await button(alice, 'Continue').click();
    await expect(scoring(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob, Cara');
    await leave(cara);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(bob)).toHaveCount(0);
    await expect(bob.locator('.round')).toHaveText('Round 2: first to 61 points wins (double-six)');
    // The winner leads with any tile
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(hand(alice).locator('button:not([disabled])')).toHaveCount(7);
    await expect(player(alice, 'Alice').locator('.player-score')).toHaveText('37 pts');

    const final = await start(seat, ['Dan', 'Eve']);
    await deal(final.table, { hands: { 1: [[4, 5]], 2: [[3, 6], [2, 2]] }, boneyard: [[6, 6]], scores: { 1: 90, 2: 20 } });
    await play(final.pages[0], 4, 5);
    await expect(scoring(final.pages[1]).locator('h2')).toHaveText('Final scoring');
    await expect(scoring(final.pages[1]).locator('.summary-result')).toHaveText('Dan wins with 115 points!');
    await expect(turn(final.pages[1])).toHaveText('Game over: Dan wins');
    await scoring(final.pages[0]).getByRole('button', { name: 'Close' }).click();
    await expect(button(final.pages[0], 'Show Scoring')).toBeVisible();
  });

  test('a blocked round goes to the lowest pip total, and a tie scores nothing', async ({ seat }) => {
    const first = await start(seat);
    await deal(first.table, {
      hands: { 1: [[0, 1], [1, 1]], 2: [[2, 2]], 3: [[5, 5], [0, 0]] },
      line: [[6, 6]],
      current: 3
    });
    await button(first.pages[2], 'Pass').click();
    const dialog = scoring(first.pages[0]);
    await expect(dialog.locator('.summary-result')).toHaveText('Alice has the lowest total in a blocked round and scores 14 points');
    await expect(dialog.locator('.summary-seat', { hasText: 'Alice' })).toContainText('14 pts');
    await expect(dialog).not.toContainText('The boneyard held');

    const tied = await start(seat);
    await deal(tied.table, {
      hands: { 1: [[0, 2]], 2: [[1, 1]], 3: [[5, 5]] },
      line: [[6, 6]],
      current: 3
    });
    await button(tied.pages[2], 'Pass').click();
    await expect(scoring(tied.pages[0]).locator('.summary-result')).toHaveText('The round is blocked and tied: nobody scores');
    await expect(player(tied.pages[0], 'Alice').locator('.player-score')).toHaveText('0 pts');
  });

  test('a play that blocks the game ends the round at once', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await deal(table, {
      hands: { 1: [[5, 6], [0, 1]], 2: [[1, 1]], 3: [[2, 2]] },
      line: [[6, 4]]
    });
    await play(alice, 5, 6);
    await expect(scoring(alice).locator('.summary-result')).toHaveText('Alice has the lowest total in a blocked round and scores 6 points');
  });

  test('you see only your own tiles, the others\' counts and the boneyard count', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [[4, 5], [1, 2]], 2: [[3, 6], [2, 2], [0, 6]], 3: [[1, 1]] },
      boneyard: [[5, 5]]
    });
    for (const page of [bob, cara]) {
      await expect(countOf(page, 'Alice')).toHaveText('2 tiles');
      await expect(page.locator('[title="4-5"]')).toHaveCount(0);
      await expect(page.locator('[title="1-2"]')).toHaveCount(0);
    }
    await expect(alice.locator('[title="3-6"]')).toHaveCount(0);
    await expect(alice.locator('[title="5-5"]')).toHaveCount(0);
    await expect(boneyard(alice)).toHaveText('Boneyard: 1');
    await expect(hand(cara).getByRole('button')).toHaveCount(1);
  });

  test('a dismissed player\'s tiles return to the boneyard and play moves on', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [[4, 5]], 2: [[3, 6], [2, 2]], 3: [[3, 5], [1, 1]] },
      boneyard: [[0, 0], [6, 6]],
      current: 2
    });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.locator('.players .player')).toHaveCount(2);
    await expect(boneyard(cara)).toHaveText('Boneyard: 4');
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(handTile(cara, 3, 5)).toBeEnabled();
  });

  test('History steps through the moves, and the FAQ explains the rules', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await deal(table, { hands: { 1: [[4, 5], [1, 1]], 2: [[3, 6]] } });
    await play(alice, 4, 5);
    await expect(status(bob)).toHaveText('Alice played 4-5 on the right');
    await bob.getByRole('button', { name: 'History' }).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history).toContainText('Alice played 4-5 on the right');
    await expect(history.locator('.line .tile-highlighted')).toHaveCount(1);
    await bob.keyboard.press('Escape');

    const faq = await openFaq(bob);
    await expect(faq).toContainText('Double-six (28 tiles) or double-nine (55 tiles)');
    await expect(faq).toContainText('Click Draw, or the boneyard');
  });
});
