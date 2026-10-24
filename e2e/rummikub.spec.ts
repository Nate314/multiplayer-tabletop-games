import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat } from './fixtures.ts';
import { COLORS, JOKERS, tileName } from '../games/rummikub/rules.ts';
import type { GameState, TileColor } from '../games/rummikub/types.ts';

// One test per rule and control in games/rummikub/README.md. Tiles are ids, as on the server: t('red', 5) is the
// first red 5, t('red', 5, 1) its twin, and J1 and J2 the jokers. A page names each tile like "red 5" or "a joker".

const [J1, J2] = JOKERS;

function t(color: TileColor, value: number, copy = 0): number {
  return copy * 52 + COLORS.indexOf(color) * 13 + value - 1;
}

type Setup = Partial<Pick<GameState, 'table' | 'pool' | 'melded' | 'currentPlayer' | 'emptyPoolPasses'>> & {
  racks?: Record<number, number[]>;
};

// Seats the players, then sets up a game in progress on Alice's turn. Nobody has melded unless `melded` says so.
async function start(seat: Seat, setup: Setup = {}, names = ['Alice', 'Bob']) {
  const table = await seat('rummikub', names);
  const { racks, ...rest } = setup;
  const patch: Record<string, unknown> = { started: true, currentPlayer: 1, ...rest };
  // The patch replaces the whole of `racks`, so the racks not named keep the tiles they were dealt
  if (racks) patch.racks = { ...(await table.state<GameState>()).racks, ...racks };
  await table.patch(patch);
  const [alice, bob, cara] = table.pages;
  await expect(alice.locator('.rk-turn-message')).toHaveText(patch.currentPlayer === 1 ? 'Your turn' : /'s turn$/);
  return { table, alice, bob, cara };
}

const rackArea = (page: Page) => page.getByRole('region', { name: 'Your rack' });
const tableArea = (page: Page) => page.getByRole('region', { name: 'Table' });
const rackTile = (page: Page, id: number) => rackArea(page).getByRole('button', { name: tileName(id), exact: true }).first();
const tableTile = (page: Page, id: number) => tableArea(page).getByRole('button', { name: tileName(id), exact: true }).first();
const groups = (page: Page) => tableArea(page).locator('.rk-group');
const group = (page: Page, number: number) => groups(page).nth(number - 1);
const groupEnd = (page: Page, number: number) => page.getByRole('button', { name: `Put at the end of group ${number}`, exact: true });
const newGroup = (page: Page) => page.getByRole('button', { name: 'New group', exact: true });
const hint = (page: Page) => page.locator('.rk-hint');
const status = (page: Page) => page.locator('.rk-status');
const turn = (page: Page) => page.locator('.rk-turn-message');
const player = (page: Page, name: string) => page.locator('.rk-player', { hasText: name });
const pool = (page: Page) => page.locator('.rk-pool');
const playButton = (page: Page) => page.locator('.rk-play-button');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const rackHeader = (page: Page) => rackArea(page).locator('.rk-rack-header > span').first();

// What each tile in a group or on the rack shows as its title: "red 5", "a joker", or "Joker as red 5"
const titles = (tiles: ReturnType<Page['locator']>) => tiles.locator('.rk-tile').evaluateAll(elements => elements.map(e => e.getAttribute('title')));
const names = (...ids: number[]) => ids.map(tileName);

// Lays rack tiles down as a new group, in order
async function lay(page: Page, ...ids: number[]) {
  await rackTile(page, ids[0]).click();
  await newGroup(page).click();
  const number = await groups(page).count();
  for (const id of ids.slice(1)) {
    await rackTile(page, id).click();
    await groupEnd(page, number).click();
  }
}

test.describe('Rummikub rules', () => {
  test('106 tiles: 1 to 13 in black, blue, orange and red, two of each, and two jokers', async ({ seat }) => {
    const fresh = await seat('rummikub', ['Cara', 'Dan']);
    await expect(rackHeader(fresh.pages[0])).toHaveText('Your rack (14)');
    await expect(pool(fresh.pages[0])).toHaveText('Tiles in the pool: 78');
    const state = await fresh.state<GameState>();
    const all = [...state.pool, ...Object.values(state.racks).flat()].sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 106 }, (_, id) => id));

    const { alice } = await start(seat, {
      racks: { 1: [t('black', 1), t('black', 1, 1), t('blue', 1), t('orange', 1), t('red', 1), t('red', 13), J1, J2] }
    });
    const tiles = rackArea(alice).locator('.rk-tile');
    await expect(tiles).toHaveText(['1', '1', '1', '1', '1', '13', '☺', '☺']);
    const classes = await tiles.evaluateAll(elements => elements.map(e => e.className.replace('rk-tile ', '')));
    expect(classes).toEqual(['rk-black', 'rk-black', 'rk-blue', 'rk-orange', 'rk-red', 'rk-red', 'rk-joker', 'rk-joker']);
  });

  test('the highest draw goes first, a joker counts lowest, ties draw again, then 14 tiles each and play in seat order', async ({ seat }) => {
    const first = await seat('rummikub', ['Alice']);
    const [alice] = first.pages;
    // Alice draws the black 13, then Bob the black 5
    await first.random(12.5 / 106, 4.5 / 105);
    const [bob] = (await seat('rummikub', ['Bob'], { gameId: first.gameId })).pages;
    await expect(status(alice)).toContainText('Alice drew black 13, Bob drew black 5. Alice goes first.');
    await expect(turn(bob)).toHaveText('Alice goes first. Joining closes after the first move.');

    // Cara joins and the draw is redone. Bob's joker counts lowest; Alice and Cara tie on 1s and draw again
    await first.random(0, 104.5 / 105, 12.5 / 104, 0, 0);
    const [cara] = (await seat('rummikub', ['Cara'], { gameId: first.gameId })).pages;
    await expect(status(alice)).toContainText(
      'Alice drew black 1, Bob drew a joker, Cara drew blue 1; tie, so they draw again: Alice drew black 2, Cara drew black 3. Cara goes first.'
    );
    // The drawn tiles went back before everyone took 14
    await expect(rackHeader(cara)).toHaveText('Your rack (14)');
    await expect(pool(cara)).toHaveText('Tiles in the pool: 64');

    await button(cara, 'Draw a tile').click();
    await expect(turn(alice)).toHaveText('Your turn');
    await button(alice, 'Draw a tile').click();
    await expect(turn(bob)).toHaveText('Your turn');
    await button(bob, 'Draw a tile').click();
    await expect(turn(cara)).toHaveText('Your turn');
  });

  test('a set is 3 or 4 of one number in different colors, a run 3 or more in a row of one color, and 13 never runs to 1', async ({ seat }) => {
    const { alice } = await start(seat, {
      melded: [1, 2],
      racks: {
        1: [t('red', 5), t('blue', 5), t('black', 5), t('orange', 7), t('orange', 8), t('orange', 9), t('red', 12), t('red', 13),
          t('red', 1), t('blue', 4), t('black', 4), t('blue', 4, 1), t('orange', 5)]
      }
    });
    await lay(alice, t('red', 5), t('blue', 5), t('black', 5));
    await lay(alice, t('orange', 7), t('orange', 8), t('orange', 9));
    await lay(alice, t('red', 12), t('red', 13), t('red', 1));
    await lay(alice, t('blue', 4), t('black', 4), t('blue', 4, 1));
    await expect(group(alice, 1)).toHaveAttribute('aria-label', 'Group 1');
    await expect(group(alice, 2)).toHaveAttribute('aria-label', 'Group 2');
    await expect(group(alice, 3)).toHaveAttribute('aria-label', 'Group 3 (not a valid set or run)');
    await expect(group(alice, 4)).toHaveAttribute('aria-label', 'Group 4 (not a valid set or run)');
    await expect(hint(alice)).toHaveText('Group 3 is not a valid set or run');
    await expect(playButton(alice)).toBeDisabled();

    // A fourth color still makes a set
    await rackTile(alice, t('orange', 5)).click();
    await groupEnd(alice, 1).click();
    await expect(group(alice, 1)).toHaveAttribute('aria-label', 'Group 1');
  });

  test('a first meld is new groups from your own tiles worth 30 or more, a joker counting as its tile, and leaves the table alone', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [2],
      table: [[t('blue', 1), t('blue', 2), t('blue', 3)]],
      racks: { 1: [t('red', 1), t('red', 2), t('red', 3), t('red', 10), J1, t('red', 12), t('blue', 4)] }
    });
    await lay(alice, t('red', 1), t('red', 2), t('red', 3));
    await expect(hint(alice)).toHaveText('Your first meld must total at least 30 points (this one totals 6)');
    await expect(playButton(alice)).toBeDisabled();
    await button(alice, 'Reset').click();

    // 33 points, but the blue 4 was added to the table's run
    await lay(alice, t('red', 10), J1, t('red', 12));
    await rackTile(alice, t('blue', 4)).click();
    await groupEnd(alice, 1).click();
    await expect(hint(alice)).toHaveText('Your first meld may not use or change the tiles on the table');
    await expect(playButton(alice)).toBeDisabled();
    await button(alice, 'Reset').click();

    // Red 10, a joker as red 11, and red 12
    await lay(alice, t('red', 10), J1, t('red', 12));
    await expect(hint(alice)).toHaveText('First meld of 33 points: ready to play');
    await playButton(alice).click();
    await expect(status(bob)).toHaveText('Alice made their first meld of 33 points');
    await expect(player(bob, 'Alice')).toContainText('✓ melded');
  });

  test('later turns may rearrange the table freely, but must add a rack tile, and table tiles never go back to the rack', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [1, 2],
      table: [[t('black', 4), t('black', 5), t('black', 6), t('black', 7)], [t('red', 7), t('blue', 7), t('orange', 7)]],
      racks: { 1: [t('black', 3), t('red', 1)] }
    });
    // Moving the black 7 to the set leaves both groups valid, but adds nothing
    await tableTile(alice, t('black', 7)).click();
    await groupEnd(alice, 2).click();
    await expect(hint(alice)).toHaveText('Play at least one tile from your rack');
    await expect(playButton(alice)).toBeDisabled();

    await tableTile(alice, t('black', 4)).click();
    await rackTile(alice, t('red', 1)).click();
    await expect(hint(alice)).toHaveText('Tiles from the table must stay on the table');
    await expect(rackArea(alice).locator('.rk-tile')).toHaveCount(2);

    await rackTile(alice, t('black', 3)).click();
    await tableTile(alice, t('black', 4)).click();
    await expect(hint(alice)).toHaveText('Ready to play 1 tile');
    await playButton(alice).click();
    await expect(turn(bob)).toHaveText('Your turn');
    expect(await titles(group(bob, 1))).toEqual(names(t('black', 3), t('black', 4), t('black', 5), t('black', 6)));
    expect(await titles(group(bob, 2))).toEqual(names(t('red', 7), t('blue', 7), t('orange', 7), t('black', 7)));
  });

  test('a joker stands for its place, and is taken by putting its tile in its place, then used again that turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, {
      melded: [1, 2],
      table: [[t('red', 4), J1, t('red', 6)]],
      racks: { 1: [t('red', 5), t('blue', 9), t('orange', 9), t('black', 1)] }
    });
    await expect(group(bob, 1).locator('.rk-joker')).toHaveAttribute('title', 'Joker as red 5');
    await tableTile(alice, J1).click();
    await newGroup(alice).click();
    await rackTile(alice, t('red', 5)).click();
    await tableTile(alice, t('red', 6)).click();
    // The joker is off on its own, so it must be used again
    await expect(hint(alice)).toHaveText('Group 2 is not a valid set or run');
    await rackTile(alice, t('blue', 9)).click();
    await groupEnd(alice, 2).click();
    await rackTile(alice, t('orange', 9)).click();
    await groupEnd(alice, 2).click();
    await expect(hint(alice)).toHaveText('Ready to play 3 tiles');
    await playButton(alice).click();
    await expect(group(bob, 2).locator('.rk-joker')).toHaveAttribute('title', 'Joker as 9'); // in a set: a missing color

    // Without its red 5 the joker cannot be taken
    await table.patch({ currentPlayer: 1, table: [[t('red', 3), t('red', 4), J1]], racks: { ...(await table.state<GameState>()).racks, 1: [t('red', 2), t('blue', 9), t('orange', 9)] } });
    await expect(turn(alice)).toHaveText('Your turn');
    await tableTile(alice, J1).click();
    await newGroup(alice).click();
    await rackTile(alice, t('blue', 9)).click();
    await groupEnd(alice, 2).click();
    await rackTile(alice, t('orange', 9)).click();
    await groupEnd(alice, 2).click();
    await rackTile(alice, t('red', 2)).click();
    await tableTile(alice, t('red', 3)).click();
    await expect(hint(alice)).toHaveText('A joker taken from the table must be replaced by the tile it stands for');
    await expect(playButton(alice)).toBeDisabled();

    // In a set of three, either missing color takes the joker
    await table.patch({ table: [[t('red', 8), t('blue', 8), J2]], racks: { ...(await table.state<GameState>()).racks, 1: [t('orange', 8), t('black', 8), t('red', 11), t('red', 12)] } });
    for (const color of ['orange', 'black'] as const) {
      await expect(tableArea(alice).locator('.rk-group')).toHaveCount(1);
      await tableTile(alice, J2).click();
      await newGroup(alice).click();
      await rackTile(alice, t('red', 11)).click();
      await groupEnd(alice, 2).click();
      await rackTile(alice, t('red', 12)).click();
      await groupEnd(alice, 2).click();
      await rackTile(alice, t(color, 8)).click();
      await groupEnd(alice, 1).click();
      await expect(hint(alice)).toHaveText('Ready to play 3 tiles');
      await button(alice, 'Reset').click();
    }
  });

  test('a player who does not play draws one tile, which ends the turn, and with the pool empty it is a pass', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await expect(pool(alice)).toHaveText('Tiles in the pool: 78');
    await button(alice, 'Draw a tile').click();
    await expect(status(bob)).toHaveText('Alice drew a tile');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(rackHeader(alice)).toHaveText('Your rack (15)');
    await expect(player(bob, 'Alice')).toContainText('15 tiles');
    await expect(pool(bob)).toHaveText('Tiles in the pool: 77');

    await table.patch({ pool: [], currentPlayer: 1 });
    await expect(button(alice, 'Pass')).toBeEnabled();
    await button(alice, 'Pass').click();
    await expect(status(bob)).toHaveText('Alice passed (the pool is empty)');
    await expect(rackHeader(alice)).toHaveText('Your rack (15)');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('the tile you drew is outlined until your move on your next turn', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [1, 2],
      racks: { 1: [t('red', 10), t('red', 11), t('red', 12), t('black', 1)] }
    });
    await expect(rackArea(alice).locator('.newly-drawn')).toHaveCount(0);
    await button(alice, 'Draw a tile').click();
    await expect(rackArea(alice).locator('.rk-tile')).toHaveCount(5);
    await expect(rackArea(alice).locator('.newly-drawn')).toHaveCount(1);
    await button(bob, 'Draw a tile').click();
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(rackArea(alice).locator('.newly-drawn')).toHaveCount(1);
    await lay(alice, t('red', 10), t('red', 11), t('red', 12));
    await playButton(alice).click();
    await expect(rackArea(alice).locator('.newly-drawn')).toHaveCount(0);
  });

  test('the first to empty their rack wins the sum of the others\' racks, each losing their own with a joker worth 30', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [1, 2], racks: { 1: [t('red', 1), t('red', 2), t('red', 3)], 2: [t('blue', 5), J1] }
    });
    await lay(alice, t('red', 1), t('red', 2), t('red', 3));
    await playButton(alice).click();
    await expect(status(bob)).toHaveText('Alice went out and wins with 35 points!');
    await expect(player(bob, 'Alice').locator('.rk-player-points')).toHaveText('+35');
    await expect(player(bob, 'Bob').locator('.rk-player-points')).toHaveText('-35');
    await expect(player(bob, 'Alice')).toHaveClass(/rk-player-winner/);
  });

  test('when the pool is empty and everyone passes in turn, the lowest rack wins, and tied players share the win', async ({ seat }) => {
    const two = await start(seat, { pool: [], racks: { 1: [t('black', 2)], 2: [t('black', 9)] } });
    await button(two.alice, 'Pass').click();
    await expect(turn(two.bob)).toHaveText('Your turn'); // one pass is not enough
    await button(two.bob, 'Pass').click();
    await expect(status(two.alice)).toHaveText('The pool is empty and nobody can play. Alice wins with the lowest rack (2 points) and scores 9!');
    await expect(player(two.alice, 'Alice').locator('.rk-player-points')).toHaveText('+9');
    await expect(player(two.alice, 'Bob').locator('.rk-player-points')).toHaveText('-9');

    const three = await start(seat, {
      pool: [], racks: { 1: [t('black', 2)], 2: [t('blue', 2)], 3: [t('red', 10)] }
    }, ['Alice', 'Bob', 'Cara']);
    await button(three.alice, 'Pass').click();
    await button(three.bob, 'Pass').click();
    await button(three.cara, 'Pass').click();
    await expect(status(three.alice)).toHaveText(
      'The pool is empty and nobody can play. Alice and Bob share the win with the lowest rack (2 points) and score 10!'
    );
    for (const [name, points] of [['Alice', '+10'], ['Bob', '+10'], ['Cara', '-10']]) {
      await expect(player(three.cara, name).locator('.rk-player-points')).toHaveText(points);
    }
  });

  test('you see only your own rack and the others\' counts, never the pool, and a rearranging player\'s changes stay theirs', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [1, 2],
      racks: { 1: [J1, J2, t('red', 10), t('red', 11), t('red', 12)], 2: [t('blue', 1), t('blue', 2), t('blue', 3)] }
    });
    // The only tiles on Bob's screen are his own three
    await expect(bob.locator('.rk-tile')).toHaveCount(3);
    await expect(bob.locator('.rk-joker')).toHaveCount(0);
    await expect(player(bob, 'Alice')).toContainText('5 tiles');
    await expect(pool(bob)).toHaveText(/^Tiles in the pool: \d+$/);

    await lay(alice, t('red', 10), t('red', 11), t('red', 12));
    await expect(group(alice, 1)).toHaveAttribute('aria-label', 'Group 1');
    await expect(bob.getByText('No tiles on the table yet')).toBeVisible();
    await expect(tableArea(bob).locator('.rk-tile')).toHaveCount(0);
  });

  test('a dismissed player\'s tiles go back into the pool, shuffled, their turns are skipped, an empty pool is refilled, and the last player wins', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, { pool: [] }, ['Alice', 'Bob', 'Cara']);
    await button(alice, 'Pass').click();
    await expect(turn(bob)).toHaveText('Your turn');
    const caraRack = (await table.state<GameState>()).racks[3];
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(player(alice, 'Cara')).toContainText('Cara (left)');
    await expect(pool(alice)).toHaveText('Tiles in the pool: 14');
    const after = await table.state<GameState>();
    expect([...after.pool].sort((a, b) => a - b)).toEqual([...caraRack].sort((a, b) => a - b));
    expect(after.pool).not.toEqual(caraRack);
    expect(after.emptyPoolPasses).toBe(0); // the passes start again

    await button(bob, 'Draw a tile').click();
    await expect(turn(alice)).toHaveText('Your turn'); // Cara is skipped

    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo happens only if every player still in the game approves', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, {}, ['Alice', 'Bob', 'Cara']);
    await button(alice, 'Draw a tile').click();
    await expect(turn(bob)).toHaveText('Your turn');

    await bob.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(cara.locator('.undo-vote')).toHaveCount(0);
    await expect(rackHeader(alice)).toHaveText('Your rack (15)');

    await undo(bob, alice, cara);
    await expect(rackHeader(alice)).toHaveText('Your rack (14)');
    await expect(turn(alice)).toHaveText('Your turn');
  });
});

test.describe('Rummikub controls', () => {
  test('with Color-blind symbols on, every colored tile shows its color shape and a joker shows none', async ({ seat }) => {
    const { alice } = await start(seat, { racks: { 1: [t('black', 3), t('blue', 3), t('orange', 3), t('red', 3), J1] } });
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    for (const shape of ['diamond', 'square', 'hexagon', 'circle']) await expect(rackArea(alice).locator(`.color-symbol-${shape}`)).toHaveCount(1);
    await expect(rackArea(alice).locator('.color-symbol')).toHaveCount(4);
  });

  test('click a tile to pick it up, then a tile to go in front of, a group\'s +, or New group; click again to put it down; dragging works too', async ({ seat }) => {
    const { alice } = await start(seat, {
      melded: [1, 2],
      table: [[t('blue', 4), t('blue', 5), t('blue', 6)]],
      racks: { 1: [t('blue', 3), t('blue', 7), t('red', 9), t('black', 9), t('orange', 9)] }
    });
    await rackTile(alice, t('blue', 3)).click();
    await expect(rackTile(alice, t('blue', 3))).toHaveClass(/rk-held/);
    await rackTile(alice, t('blue', 3)).click();
    await expect(rackTile(alice, t('blue', 3))).not.toHaveClass(/rk-held/);

    await rackTile(alice, t('blue', 3)).click();
    await tableTile(alice, t('blue', 4)).click();
    await rackTile(alice, t('blue', 7)).click();
    await groupEnd(alice, 1).click();
    expect(await titles(group(alice, 1))).toEqual(names(t('blue', 3), t('blue', 4), t('blue', 5), t('blue', 6), t('blue', 7)));
    await rackTile(alice, t('red', 9)).click();
    await newGroup(alice).click();
    expect(await titles(group(alice, 2))).toEqual(names(t('red', 9)));

    // Drags: onto New group, onto a tile to go in front of it, and onto the end of a group
    await rackTile(alice, t('black', 9)).dragTo(newGroup(alice));
    await expect(groups(alice)).toHaveCount(3);
    await rackTile(alice, t('orange', 9)).dragTo(tableTile(alice, t('red', 9)));
    expect(await titles(group(alice, 2))).toEqual(names(t('orange', 9), t('red', 9)));
    const end = (await group(alice, 2).boundingBox())!;
    await tableTile(alice, t('black', 9)).dragTo(group(alice, 2), { targetPosition: { x: end.width - 6, y: end.height / 2 } });
    await expect(groups(alice)).toHaveCount(2);
    expect(await titles(group(alice, 2))).toEqual(names(t('orange', 9), t('red', 9), t('black', 9)));
    await expect(hint(alice)).toHaveText('Ready to play 5 tiles');
  });

  test('a group\'s handle picks up the whole group to merge it onto another, and the bar between two tiles splits a group', async ({ seat }) => {
    const { alice } = await start(seat, {
      melded: [1, 2],
      table: [[t('red', 1), t('red', 2), t('red', 3)], [t('red', 4), t('red', 5), t('red', 6)]],
      racks: { 1: [t('red', 7)] }
    });
    await button(alice, 'Pick up group 2').click();
    await expect(group(alice, 2)).toHaveClass(/rk-held/);
    await groupEnd(alice, 1).click();
    await expect(groups(alice)).toHaveCount(1);
    expect(await titles(group(alice, 1))).toHaveLength(6);

    await button(alice, `Split group 1 before ${tileName(t('red', 4))}`).click();
    await expect(groups(alice)).toHaveCount(2);
    expect(await titles(group(alice, 2))).toEqual(names(t('red', 4), t('red', 5), t('red', 6)));

    await rackTile(alice, t('red', 7)).click();
    await groupEnd(alice, 2).click();
    await expect(hint(alice)).toHaveText('Ready to play 1 tile');
  });

  test('tiles put down this turn can go back to the rack, before a rack tile or with End of rack, but table tiles cannot', async ({ seat }) => {
    const { alice } = await start(seat, {
      melded: [1, 2],
      table: [[t('black', 1), t('black', 2), t('black', 3)]],
      racks: { 1: [t('red', 10), t('red', 11), t('red', 12), t('blue', 1)] }
    });
    const endOfRack = rackArea(alice).locator('.rk-rack-end'); // hidden, not just disabled, when it cannot be used
    await rackTile(alice, t('red', 10)).click();
    await newGroup(alice).click();
    await expect(rackHeader(alice)).toHaveText('Your rack (3)');
    await tableTile(alice, t('red', 10)).click();
    await expect(endOfRack).not.toHaveClass(/rk-hidden/);
    await endOfRack.click();
    await expect(rackHeader(alice)).toHaveText('Your rack (4)');
    await expect(groups(alice)).toHaveCount(1);

    // A group of only new tiles goes back in front of the blue 1
    await lay(alice, t('red', 10), t('red', 11), t('red', 12));
    await button(alice, 'Pick up group 2').click();
    await rackTile(alice, t('blue', 1)).click();
    await expect(groups(alice)).toHaveCount(1);
    expect(await titles(rackArea(alice))).toEqual(names(t('red', 10), t('red', 11), t('red', 12), t('blue', 1)));

    await tableTile(alice, t('black', 1)).click();
    await expect(endOfRack).toHaveClass(/rk-hidden/);
    await rackTile(alice, t('blue', 1)).click();
    await expect(hint(alice)).toHaveText('Tiles from the table must stay on the table');
    await expect(rackHeader(alice)).toHaveText('Your rack (4)');
  });

  test('an invalid group has a dashed red border, the line under the rack says what is wrong or that it is ready, and Play sends it', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [1, 2], racks: { 1: [t('red', 10), t('red', 11), t('red', 12), t('blue', 1)] }
    });
    await lay(alice, t('red', 10), t('red', 11));
    await expect(group(alice, 1)).toHaveClass(/rk-group-invalid/);
    const border = await group(alice, 1).evaluate(element => {
      const style = getComputedStyle(element);
      return { style: style.borderTopStyle, rgb: style.borderTopColor.match(/\d+/g)!.map(Number) };
    });
    expect(border.style).toBe('dashed');
    expect(border.rgb[0]).toBeGreaterThan(border.rgb[1]);
    expect(border.rgb[0]).toBeGreaterThan(border.rgb[2]);
    await expect(hint(alice)).toHaveText('Group 1 is not a valid set or run');
    await expect(hint(alice)).toHaveClass(/rk-hint-error/);

    await rackTile(alice, t('red', 12)).click();
    await groupEnd(alice, 1).click();
    await expect(group(alice, 1)).not.toHaveClass(/rk-group-invalid/);
    await expect(hint(alice)).toHaveText('Ready to play 3 tiles');
    await playButton(alice).click();
    await expect(status(bob)).toHaveText('Alice played 3 tiles');
    expect(await titles(group(bob, 1))).toEqual(names(t('red', 10), t('red', 11), t('red', 12)));
  });

  test('Reset puts the table and rack back, and Draw a tile ends the turn and drops any changes', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [1, 2], racks: { 1: [t('red', 10), t('red', 11), t('red', 12), t('blue', 1)] }
    });
    await expect(button(alice, 'Reset')).toBeDisabled();
    await lay(alice, t('red', 10), t('red', 11), t('red', 12));
    await button(alice, 'Reset').click();
    await expect(groups(alice)).toHaveCount(0);
    await expect(rackHeader(alice)).toHaveText('Your rack (4)');

    await lay(alice, t('red', 10), t('red', 11), t('red', 12));
    await expect(button(alice, 'Draw a tile')).toHaveAttribute('title', 'Drawing puts the table back as it was');
    await button(alice, 'Draw a tile').click();
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(groups(alice)).toHaveCount(0);
    await expect(groups(bob)).toHaveCount(0);
    await expect(rackHeader(alice)).toHaveText('Your rack (5)');
  });

  test('Color and Number sort the rack, rack tiles move about even on others\' turns, and only you see the order, kept from turn to turn', async ({ seat }) => {
    const rack = [t('red', 2), t('blue', 1), t('black', 3), J1, t('orange', 2)];
    const { table, alice, bob } = await start(seat, { currentPlayer: 2, racks: { 1: rack } });
    await button(alice, 'Number').click();
    expect(await titles(rackArea(alice))).toEqual(names(t('blue', 1), t('orange', 2), t('red', 2), t('black', 3), J1));
    await button(alice, 'Color').click();
    expect(await titles(rackArea(alice))).toEqual(names(t('black', 3), t('blue', 1), t('orange', 2), t('red', 2), J1));

    // On Bob's turn, the joker goes to the front
    await expect(hint(alice)).toHaveText('Waiting for Bob. You can sort and arrange your rack.');
    await rackTile(alice, J1).click();
    await rackTile(alice, t('black', 3)).click();
    const arranged = names(J1, t('black', 3), t('blue', 1), t('orange', 2), t('red', 2));
    expect(await titles(rackArea(alice))).toEqual(arranged);
    expect((await table.state<GameState>()).racks[1]).toEqual(rack);

    await button(bob, 'Draw a tile').click();
    await expect(turn(alice)).toHaveText('Your turn');
    expect(await titles(rackArea(alice))).toEqual(arranged);
  });

  test('hovering a joker on the table shows what it stands for, and the last player\'s new tiles are outlined', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [1, 2],
      table: [[t('red', 4), J1, t('red', 6)]],
      // Bob's rack is fixed too, so the joker on the table is the only one on his page
      racks: { 1: [t('blue', 7), t('blue', 8), t('blue', 9), t('black', 1)], 2: [t('black', 2), t('black', 3)] }
    });
    await bob.locator('.rk-joker').hover();
    await expect(bob.locator('.rk-joker')).toHaveAttribute('title', 'Joker as red 5');

    await lay(alice, t('blue', 7), t('blue', 8), t('blue', 9));
    await playButton(alice).click();
    await expect(group(bob, 2).locator('.rk-tile-highlighted')).toHaveCount(3);
    await expect(group(bob, 1).locator('.rk-tile-highlighted')).toHaveCount(0);
  });

  test('the side panel shows tile counts, a check for those who have melded, the pool count and at the end the points', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      melded: [2], pool: [t('black', 1), t('black', 2)],
      racks: { 1: [t('red', 10), t('red', 11), t('red', 12)], 2: [t('blue', 4), t('blue', 5)] }
    });
    await expect(player(alice, 'Alice')).toContainText('3 tiles');
    await expect(player(alice, 'Bob')).toContainText('2 tiles');
    await expect(player(alice, 'Bob').locator('.rk-melded')).toHaveText('✓ melded');
    await expect(player(alice, 'Alice').locator('.rk-melded')).toHaveCount(0);
    await expect(pool(alice)).toHaveText('Tiles in the pool: 2');
    await expect(alice.locator('.rk-player-points')).toHaveCount(0);

    await lay(alice, t('red', 10), t('red', 11), t('red', 12));
    await playButton(alice).click();
    await expect(player(bob, 'Alice').locator('.rk-player-points')).toHaveText('+9');
    await expect(player(bob, 'Bob').locator('.rk-player-points')).toHaveText('-9');
  });

  test('Undo asks everyone to undo the last move, and FAQ shows a short guide', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await button(alice, 'Draw a tile').click();
    await expect(turn(bob)).toHaveText('Your turn');
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await bob.getByRole('button', { name: 'Approve' }).click();
    await expect(turn(alice)).toHaveText('Your turn');

    const faq = await openFaq(alice);
    await expect(faq).toContainText('What is the first meld?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Rummikub differences from Wikipedia', () => {
  test('the game is one round: once someone goes out it is over, with its scores shown', async ({ seat }) => {
    const { alice, bob } = await start(seat, { melded: [1, 2], racks: { 1: [t('red', 1), t('red', 2), t('red', 3)], 2: [t('blue', 13)] } });
    await lay(alice, t('red', 1), t('red', 2), t('red', 3));
    await playButton(alice).click();
    for (const page of [alice, bob]) {
      await expect(turn(page)).toHaveText('Game over');
      await expect(button(page, 'Draw a tile')).toBeDisabled();
    }
    await expect(player(bob, 'Bob').locator('.rk-player-points')).toHaveText('-13');
    await expect(rackHeader(bob)).toHaveText('Your rack (1)'); // nothing is dealt again
  });

  test('when nobody can play, the lowest rack total wins, not the fewest tiles', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      pool: [], racks: { 1: [t('black', 13)], 2: [t('black', 1), t('blue', 1), t('red', 2)] }
    });
    await button(alice, 'Pass').click();
    await button(bob, 'Pass').click();
    await expect(status(alice)).toHaveText('The pool is empty and nobody can play. Bob wins with the lowest rack (4 points) and scores 13!');
  });

  test('drawing for the first turn: a joker counts lowest', async ({ seat }) => {
    const first = await seat('rummikub', ['Alice']);
    // Alice draws the last tile, a joker, and Bob the black 1
    await first.random(105.5 / 106, 0);
    await seat('rummikub', ['Bob'], { gameId: first.gameId });
    await expect(status(first.pages[0])).toContainText('Alice drew a joker, Bob drew black 1. Bob goes first.');
  });

  test('one number and two jokers count as a run, and a joker that comes to stand for another tile counts as taken', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, { melded: [1, 2], table: [[J1, t('red', 5), J2]] });
    const jokers = group(bob, 1).locator('.rk-joker');
    await expect(jokers).toHaveCount(2);
    expect(await jokers.evaluateAll(elements => elements.map(e => e.getAttribute('title')))).toEqual(['Joker as red 4', 'Joker as red 6']);

    // Red 4, red 5 and a joker as red 6. Putting the red 6 at the end makes the joker a red 7, which takes it,
    // and the red 6 now sits with the tiles it was with, so the play is fine
    await table.patch({
      table: [[t('red', 4), t('red', 5), J1]],
      racks: { ...(await table.state<GameState>()).racks, 1: [t('red', 6), t('blue', 1)] }
    });
    await expect(group(bob, 1).locator('.rk-joker')).toHaveAttribute('title', 'Joker as red 6');
    await rackTile(alice, t('red', 6)).click();
    await groupEnd(alice, 1).click();
    await expect(hint(alice)).toHaveText('Ready to play 1 tile');
    await playButton(alice).click();
    await expect(group(bob, 1).locator('.rk-joker')).toHaveAttribute('title', 'Joker as red 7');
  });

  test('a freed joker may go into a group already on the table, and each taken joker needs its own tile', async ({ seat }) => {
    const { table, alice } = await start(seat, {
      melded: [1, 2],
      table: [[t('red', 4), J1, t('red', 6)], [t('blue', 7), t('blue', 8), t('blue', 9)]],
      racks: { 1: [t('red', 5)] }
    });
    await tableTile(alice, J1).click();
    await groupEnd(alice, 2).click();
    await rackTile(alice, t('red', 5)).click();
    await tableTile(alice, t('red', 6)).click();
    await expect(group(alice, 2).locator('.rk-joker')).toHaveAttribute('title', 'Joker as blue 10');
    await expect(hint(alice)).toHaveText('Ready to play 1 tile');

    // Two jokers in a set of 5s: the black 5 frees only one of them
    await table.patch({
      table: [[t('red', 5), t('blue', 5), J1, J2]],
      racks: { ...(await table.state<GameState>()).racks, 1: [t('black', 5), t('orange', 9), t('orange', 10)] }
    });
    await expect(groups(alice)).toHaveCount(1);
    await lay(alice, t('orange', 9), t('orange', 10));
    await tableTile(alice, J1).click();
    await groupEnd(alice, 2).click();
    await tableTile(alice, J2).click();
    await groupEnd(alice, 2).click();
    await rackTile(alice, t('black', 5)).click();
    await groupEnd(alice, 1).click();
    await expect(hint(alice)).toHaveText('A joker taken from the table must be replaced by the tile it stands for');
    await expect(playButton(alice)).toBeDisabled();
  });

  test('leaving: a dismissed player\'s tiles go back into the pool', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, { pool: [t('black', 1)] }, ['Alice', 'Bob', 'Cara']);
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(pool(alice)).toHaveText('Tiles in the pool: 15');
  });
});
