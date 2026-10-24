import type { Page } from '@playwright/test';
import { dismiss, drag, expect, leave, lift, nameOf, newPlayer, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { at, START } from '../games/carcassonne/testing.ts';
import { TILES, TILE_TYPES } from '../games/carcassonne/tiles.ts';
import type { FeatureKind, GameState, Meeple } from '../games/carcassonne/types.ts';

// One test per rule and control in games/carcassonne/README.md. Seats are filled in join order: Alice is seat 1, Bob 2,
// Cara 3. The start tile (D) sits at column 0, row 0 with its city to the north, its road running east to west and a
// field to the south. Tests lay out the board, the tile to place and the draw pile (drawn from its end).

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve'];

const on = (seat: number, kind: FeatureKind, index = 0): Meeple => ({ seat, feature: { kind, index } });

let crafted = 0;

// Merges `fields` over the server state and waits until every player's page shows it
async function craft(table: Table, fields: Partial<GameState>): Promise<void> {
  const status = `Board set ${++crafted}`;
  await table.patch({ ...fields, gameStatus: status });
  for (const page of table.pages) await expect(page.locator('.cc-status')).toHaveText(status);
}

const board = (page: Page) => page.locator('.cc-board-svg');
const cells = (page: Page) => page.locator('.cc-cell');
const cell = (page: Page, x: number, y: number) => page.getByRole('button', { name: `Place the tile at column ${x}, row ${y}` });
const spot = (page: Page, kind: FeatureKind) => page.getByRole('button', { name: `Put a meeple on the ${kind}` });
const boardMeeples = (page: Page, seat: number) => page.locator(`.cc-board-svg .cc-meeple.cc-seat${seat}`);
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('.cc-status');
const turnMessage = (page: Page) => page.locator('.cc-turn-message');
const tilesLeft = (page: Page) => page.locator('.cc-tiles-left');
const tilePicture = (page: Page) => page.getByRole('img', { name: /^The tile to place: / });
const playerRow = (page: Page, name: string) => page.locator('.cc-player', { hasText: name });
const score = (page: Page, name: string) => playerRow(page, name).locator('.cc-player-score');
const meeplesInHand = (page: Page, name: string) => playerRow(page, name).locator('.cc-player-meeples');

async function placeTile(page: Page, x: number, y: number) {
  await cell(page, x, y).click();
  await button(page, 'Place tile').click();
}

// Places the tile on the first highlighted square and no meeple
async function anyTurn(page: Page) {
  await cells(page).first().click();
  await button(page, 'Place tile').click();
  await button(page, 'No meeple').click();
}

async function start(seat: Seat, count = 2, motion = false) {
  const table = await seat('carcassonne', NAMES.slice(0, count), { motion });
  const [alice, bob, cara] = table.pages;
  return { table, alice, bob, cara };
}

// Two road ends (three-way junctions) west and east of the start tile, with a gap at column 1 for a straight road
const ROAD_GAP = (west: Meeple | null, east: Meeple | null) => [START, at(-1, 0, 'W', 0, west), at(2, 0, 'W', 0, east)];

test.describe('Carcassonne rules', () => {
  test('the 72 base tiles in their published counts: the start tile on the board and the other 71 face down', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await expect(board(alice)).toHaveAttribute('aria-label', 'Board with 1 tiles');
    await expect(tilesLeft(alice)).toHaveText('Tiles left: 70'); // and the one drawn to place
    const state = await table.state<GameState>();
    const dealt = [...state.drawPile, state.currentTile];
    for (const type of TILE_TYPES) {
      expect(dealt.filter(tile => tile === type).length, type).toBe(TILES[type].count - (type === 'D' ? 1 : 0));
    }
    expect(TILE_TYPES.reduce((total, type) => total + TILES[type].count, 0)).toBe(72);
  });

  test('the first player to join goes first, and turns go up through the seats', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, 3);
    await expect(turnMessage(alice)).toHaveText('You go first. Joining closes after the first move.');
    await expect(turnMessage(bob)).toHaveText('Alice goes first. Joining closes after the first move.');
    await anyTurn(alice);
    await expect(turnMessage(bob)).toHaveText('Your turn');
    await expect(turnMessage(cara)).toHaveText("Bob's turn");
    await anyTurn(bob);
    await expect(turnMessage(cara)).toHaveText('Your turn');
    await anyTurn(cara);
    await expect(turnMessage(alice)).toHaveText('Your turn');
  });

  test('the drawn tile is shown to everyone and goes next to a tile, turned any way, with every touching side matching', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // A monastery is field on every side, so it only fits south of the start tile, whose other sides are city and road
    await craft(table, { board: [START], currentTile: 'B', drawPile: ['U'] });
    await expect(tilePicture(bob)).toHaveAccessibleName('The tile to place: a monastery');
    await expect(cells(alice)).toHaveCount(1);
    await expect(cell(alice, 0, 1)).toBeVisible();
    await placeTile(alice, 0, 1);
    await expect(board(bob)).toHaveAttribute('aria-label', 'Board with 2 tiles');

    // A city on one side fits north of the start tile only turned with its city facing south
    await button(alice, 'No meeple').click();
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U'], currentPlayer: 1 });
    await expect(cells(alice)).toHaveCount(2);
    await cell(alice, 0, -1).click();
    await expect(alice.locator('.cc-preview > g').first()).toHaveAttribute('transform', 'rotate(180 50 50)');
    await button(alice, 'Turn right').click();
    await expect(alice.locator('.cc-preview > g').first()).toHaveAttribute('transform', 'rotate(180 50 50)');
  });

  test('a tile that fits nowhere is set aside out of the game, another is drawn, and the count set aside is shown', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Monasteries only: every open side is field, so a city on every side (C) fits nowhere
    await craft(table, { board: [at(0, 0, 'B')], currentTile: 'B', drawPile: ['U', 'C'] });
    await placeTile(alice, 0, 1);
    await button(alice, 'No meeple').click();
    await expect(status(bob)).toContainText('A tile fit nowhere and left the game');
    await expect(tilesLeft(bob)).toHaveText('Tiles left: 0 (1 set aside)');
    await expect(tilePicture(bob)).toHaveAccessibleName('The tile to place: a straight road');
  });

  test('each player has 7 meeples and may put one on the placed tile, only on a feature with no meeple anywhere on it', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [START], currentTile: 'U', drawPile: ['U', 'U'] });
    await expect(meeplesInHand(bob, 'Alice')).toHaveText('7 meeples');
    await placeTile(alice, 1, 0); // extends the start tile's road east
    await spot(alice, 'road').click();
    await button(alice, 'Place meeple').click();
    await expect(meeplesInHand(bob, 'Alice')).toHaveText('6 meeples');
    await expect(boardMeeples(bob, 1)).toHaveCount(1);

    // Bob extends the same road west: Alice's meeple holds it, so only the two fields are offered
    await placeTile(bob, -1, 0);
    await expect(spot(bob, 'field')).toHaveCount(2);
    await expect(spot(bob, 'road')).toHaveCount(0);
  });

  test('a road finished by both ends stopping scores 1 a tile; features claimed apart and then joined are shared, ties scoring in full', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: ROAD_GAP(on(1, 'road', 0), on(2, 'road', 2)), currentTile: 'U', drawPile: ['U'] });
    await placeTile(alice, 1, 0);
    await expect(spot(alice, 'road')).toHaveCount(0);
    await button(alice, 'No meeple').click();
    await expect(status(bob)).toContainText('Alice and Bob each score 4 for a road');
    await expect(score(bob, 'Alice')).toHaveText('4');
    await expect(score(bob, 'Bob')).toHaveText('4');
    // The meeples go back to their players
    await expect(meeplesInHand(bob, 'Alice')).toHaveText('7 meeples');
    await expect(meeplesInHand(bob, 'Bob')).toHaveText('7 meeples');
    await expect(bob.locator('.cc-board-svg .cc-meeple')).toHaveCount(0);
  });

  test('a city finished by closing its walls scores 2 a tile and 2 a pennant, for the players with the most meeples on it', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // The start city runs north into a corner city with a pennant (M), east into a plain corner city (N), and the
    // tile to place (K, a city with a curved road) closes it from the south: 4 tiles and 1 pennant.
    // Alice has two meeples on it and Bob one.
    await craft(table, {
      board: [at(0, 0, 'D', 0, on(1, 'city')), at(0, -1, 'M', 2, on(1, 'city')), at(1, -1, 'N', 3, on(2, 'city'))],
      currentTile: 'K',
      drawPile: ['U']
    });
    await placeTile(alice, 1, 0);
    await button(alice, 'No meeple').click();
    await expect(status(bob)).toContainText('Alice scores 10 for a city');
    await expect(score(bob, 'Alice')).toHaveText('10');
    await expect(score(bob, 'Bob')).toHaveText('0');
    await expect(meeplesInHand(bob, 'Alice')).toHaveText('7 meeples');
    await expect(meeplesInHand(bob, 'Bob')).toHaveText('7 meeples');
  });

  test('a monastery finished by tiles on all eight squares around it scores 9', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const around = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]].map(([x, y]) => at(x, y, 'B'));
    await craft(table, { board: [at(0, 0, 'B', 0, on(1, 'monastery')), ...around], currentTile: 'B', drawPile: ['B'] });
    await placeTile(alice, 1, 1);
    await button(alice, 'No meeple').click();
    await expect(status(bob)).toContainText('Alice scores 9 for a monastery');
    await expect(score(bob, 'Alice')).toHaveText('9');
    await expect(boardMeeples(bob, 1)).toHaveCount(0);
  });

  test('after the last tile every claimed feature scores at the end rate, fields 3 a finished city, and the highest total wins or ties share', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Alice: the start road (1 tile), a lone corner city with a pennant (M), and the monastery she places last south
    // of the start tile (1 and 1 neighbour). Bob: a farmer on a field that touches the finished city north of the start.
    await craft(table, {
      board: [at(0, 0, 'D', 0, on(1, 'road')), at(0, -1, 'E', 2, on(2, 'field')), at(1, -1, 'M', 1, on(1, 'city'))],
      currentTile: 'B',
      drawPile: [],
      scores: { 1: 10, 2: 12 }
    });
    await expect(tilesLeft(alice)).toHaveText('Tiles left: 0');
    await placeTile(alice, 0, 1);
    await spot(alice, 'monastery').click();
    await button(alice, 'Place meeple').click();

    await expect(status(bob)).toContainText('The last tile is placed. Alice and Bob share the win with 15 points');
    await expect(turnMessage(bob)).toHaveText('Game over: Alice and Bob share the win');
    const final = bob.locator('table.cc-final');
    await expect(final.locator('caption')).toHaveText('Added at the end of the game');
    await expect(final.locator('tbody tr').nth(0).locator('th, td')).toHaveText(['Alice', '1', '2', '2', '0']);
    await expect(final.locator('tbody tr').nth(1).locator('th, td')).toHaveText(['Bob', '0', '0', '0', '3']);

    const win = await start(seat);
    await craft(win.table, { board: [START], currentTile: 'B', drawPile: [], scores: { 1: 0, 2: 5 } });
    await anyTurn(win.alice);
    await expect(turnMessage(win.alice)).toHaveText('Game over: Bob wins');
    await expect(status(win.alice)).toContainText('Bob wins with 5 points');
  });

  test('nothing is hidden but the tile order: everyone sees the board, the tile, every score and meeple count, and the tiles left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, {
      board: [at(0, 0, 'D', 0, on(1, 'road'))],
      currentTile: 'E',
      drawPile: ['U', 'V', 'W'],
      scores: { 1: 3, 2: 0 }
    });
    for (const page of [alice, bob]) {
      await expect(board(page)).toHaveAttribute('aria-label', 'Board with 1 tiles');
      await expect(tilePicture(page)).toHaveAccessibleName('The tile to place: a city on one side');
      await expect(page.locator('.cc-current-tile')).toHaveCount(1); // only the drawn tile, never the next ones
      await expect(tilesLeft(page)).toHaveText('Tiles left: 3');
      await expect(score(page, 'Alice')).toHaveText('3');
      await expect(meeplesInHand(page, 'Alice')).toHaveText('6 meeples');
      await expect(meeplesInHand(page, 'Bob')).toHaveText('7 meeples');
      await expect(boardMeeples(page, 1)).toHaveCount(1);
    }
  });

  test('a dismissed player scores nothing more, and their meeples hold their features, count for nobody and go back when scored', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3);
    await craft(table, { board: ROAD_GAP(on(2, 'road', 0), null), currentTile: 'U', drawPile: ['U'], started: true });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(playerRow(alice, 'Bob')).toContainText('left');
    await expect(boardMeeples(alice, 2)).toHaveCount(1);

    await placeTile(alice, 1, 0);
    await expect(spot(alice, 'road')).toHaveCount(0); // Bob's meeple still holds the road
    await button(alice, 'No meeple').click();
    await expect(status(cara)).toContainText('A road was completed');
    await expect(boardMeeples(cara, 2)).toHaveCount(0);
    for (const name of ['Alice', 'Bob', 'Cara']) await expect(score(cara, name)).toHaveText('0');
  });

  test('a player dismissed after placing their tile ends their turn with no meeple, the tile still scores for the others, and the next player draws', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3);
    // Bob has closed Alice's city and not chosen a meeple
    await craft(table, {
      board: [at(0, 0, 'D', 0, on(1, 'city')), { ...at(0, -1, 'E', 2), by: 2 }],
      currentTile: 'E',
      placed: true,
      drawPile: ['U', 'U'],
      currentPlayer: 2,
      started: true
    });
    await expect(button(bob, 'No meeple')).toBeVisible();
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(status(alice)).toContainText('Bob left before choosing a meeple');
    await expect(status(alice)).toContainText('Alice scores 4 for a city');
    await expect(score(alice, 'Alice')).toHaveText('4');
    await expect(turnMessage(cara)).toHaveText('Your turn');
    await expect(tilePicture(cara)).toHaveAccessibleName('The tile to place: a straight road');
    await expect(tilesLeft(cara)).toHaveText('Tiles left: 1');
  });

  test('a player dismissed before placing their tile leaves that same tile for the next player', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3);
    await craft(table, { board: [START], currentTile: 'B', drawPile: ['U'], currentPlayer: 2, started: true });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(turnMessage(cara)).toHaveText('Your turn');
    await expect(tilePicture(cara)).toHaveAccessibleName('The tile to place: a monastery');
    await expect(tilesLeft(cara)).toHaveText('Tiles left: 1');
    await placeTile(cara, 0, 1);
    await expect(board(alice)).toHaveAttribute('aria-label', 'Board with 2 tiles');
  });

  test('the last player left wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await anyTurn(alice);
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
    await expect(turnMessage(alice)).toHaveText('Game over: Alice wins');
  });

  test('placing a tile and choosing a meeple are separate moves, each undone only if every player still in the game approves', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3);
    await craft(table, { board: [START], currentTile: 'B', drawPile: ['U', 'U'] });
    await placeTile(alice, 0, 1);
    await button(alice, 'No meeple').click();
    await expect(turnMessage(bob)).toHaveText('Your turn');

    await button(alice, 'Undo').click();
    await button(bob, 'Approve').click();
    await button(cara, 'Decline').click();
    await expect(status(alice)).toHaveText('Cara declined the undo');
    await expect(turnMessage(bob)).toHaveText('Your turn');

    // The first undo takes back only the meeple step, the second the tile
    await undo(alice, bob, cara);
    await expect(button(alice, 'No meeple')).toBeVisible();
    await expect(board(alice)).toHaveAttribute('aria-label', 'Board with 2 tiles');
    await undo(alice, bob, cara);
    await expect(button(alice, 'Place tile')).toBeVisible();
    await expect(board(alice)).toHaveAttribute('aria-label', 'Board with 1 tiles');
  });
});

test.describe('Carcassonne controls', () => {
  test('the board highlights where the tile fits; Turn tries only the turns that fit a picked square, or turns the panel tile before one is picked', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // A city on one side fits north of the start tile with its city facing south, or south of it facing any way but north
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U'] });
    await expect(cells(alice)).toHaveCount(2);
    await expect(cells(bob)).toHaveCount(0);
    const panelTile = alice.locator('svg.cc-current-tile > g');
    const preview = alice.locator('.cc-preview > g').first();
    await button(alice, 'Turn right').click();
    await expect(panelTile).toHaveAttribute('transform', 'rotate(90 50 50)');
    await button(alice, 'Turn left').click();
    await button(alice, 'Turn left').click();
    await expect(panelTile).toHaveAttribute('transform', 'rotate(270 50 50)');

    await cell(alice, 0, 1).click();
    await expect(preview).toHaveAttribute('transform', 'rotate(270 50 50)');
    await button(alice, 'Turn right').click(); // past the turn with the city facing north, which does not fit
    await expect(preview).toHaveAttribute('transform', 'rotate(90 50 50)');
    await cell(alice, 0, -1).click();
    await expect(preview).toHaveAttribute('transform', 'rotate(180 50 50)');
    await button(alice, 'Turn left').click();
    await expect(preview).toHaveAttribute('transform', 'rotate(180 50 50)');
    await button(alice, 'Place tile').click();
    await expect(board(bob)).toHaveAttribute('aria-label', 'Board with 2 tiles');
  });

  test('the placed tile is shown up close with a circle on every free feature; click one, click again to undo it, then Place meeple or No meeple; farmers lie down', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U', 'U'] });
    await placeTile(alice, 0, -1);
    // A view five squares across, centred on the placed tile
    await expect(board(alice)).toHaveAttribute('viewBox', '-200 -300 500 500');
    await expect(alice.locator('.cc-spot')).toHaveCount(2);
    await spot(alice, 'city').click();
    await expect(alice.locator('.cc-spot-selected')).toHaveCount(1);
    await expect(button(alice, 'Place meeple')).toBeEnabled();
    await spot(alice, 'city').click();
    await expect(alice.locator('.cc-spot-selected')).toHaveCount(0);
    await expect(button(alice, 'Place meeple')).toBeDisabled();
    await spot(alice, 'field').click();
    await button(alice, 'Place meeple').click();
    await expect(boardMeeples(bob, 1)).toHaveAttribute('transform', /rotate\(-90\)/);
  });

  test('the tile dragged onto a highlighted square is shown there, ready to turn and place', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U'] });
    await drag(alice, tilePicture(alice), cell(alice, 0, -1));
    await expect(cell(alice, 0, -1)).toHaveClass(/cc-cell-selected/);
    await expect(button(alice, 'Place tile')).toBeEnabled();
    await button(alice, 'Place tile').click();
    await expect(board(bob)).toHaveAttribute('aria-label', 'Board with 2 tiles');
  });

  test('a meeple dragged from the tray onto a circle is chosen there, ready to place', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U', 'U'] });
    await placeTile(alice, 0, -1);
    await expect(button(alice, 'Meeple, 7 left')).toBeVisible();
    await drag(alice, button(alice, 'Meeple, 7 left'), spot(alice, 'field'));
    await expect(alice.locator('.cc-spot-selected')).toHaveCount(1);
    await expect(button(alice, 'Place meeple')).toBeEnabled();
    await button(alice, 'Place meeple').click();
    await expect(boardMeeples(bob, 1)).toHaveCount(1);
    await expect(meeplesInHand(bob, 'Alice')).toHaveText('6 meeples');
    await expect(boardMeeples(alice, 1)).toHaveCount(1);
  });

  test('a tile dropped on the board away from a highlighted square goes back, and the view does not pan', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U'] });
    const before = await board(alice).getAttribute('viewBox');
    await lift(alice, tilePicture(alice));
    await expect(alice.locator('.drag-ghost')).toBeVisible();
    const box = (await board(alice).boundingBox())!;
    await alice.mouse.move(box.x + 20, box.y + 60, { steps: 8 });
    await alice.mouse.up();
    await expect(alice.locator('.drag-ghost')).toHaveCount(0);
    await expect(alice.locator('.cc-cell-selected')).toHaveCount(0);
    await expect(board(alice)).toHaveAttribute('viewBox', before!);
    await expect(button(alice, 'Place tile')).toBeDisabled();
  });

  test('after a refresh the placed tile stays and the meeple step is still waiting', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, { board: [START], currentTile: 'B', drawPile: ['U'] });
    await placeTile(alice, 0, 1);
    await alice.reload();
    await expect(board(alice)).toHaveAttribute('aria-label', 'Board with 2 tiles');
    await expect(button(alice, 'No meeple')).toBeVisible();
    await expect(spot(alice, 'monastery')).toBeVisible();
  });

  test('drag pans the board, the wheel and the + and − buttons zoom, and Fit shows the whole board again', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U'] });
    const view = async () => (await board(alice).getAttribute('viewBox'))!.split(' ').map(Number);
    const fitted = await view();

    await button(alice, 'Zoom out').click();
    await expect.poll(async () => (await view())[2]).toBeGreaterThan(fitted[2]);
    const out = (await view())[2];
    await button(alice, 'Zoom in').click();
    await expect.poll(async () => (await view())[2]).toBeLessThan(out);

    const box = (await board(alice).boundingBox())!;
    const beforeWheel = (await view())[2];
    await alice.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await alice.mouse.wheel(0, 100);
    await expect.poll(async () => (await view())[2]).toBeGreaterThan(beforeWheel);
    const beforeDrag = await view();
    await alice.mouse.move(box.x + 20, box.y + 20);
    await alice.mouse.down();
    await alice.mouse.move(box.x + 120, box.y + 80, { steps: 5 });
    await alice.mouse.up();
    await expect.poll(async () => (await view())[0]).toBeLessThan(beforeDrag[0]);

    await button(alice, 'Fit').click();
    await expect.poll(view).toEqual(fitted);
  });

  test('the tile placed last is outlined while its meeple is chosen', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U'] });
    await placeTile(alice, 0, -1);
    for (const page of [alice, bob]) {
      await expect(page.locator('.cc-highlight')).toHaveAttribute('x', '2');
      await expect(page.locator('.cc-highlight')).toHaveAttribute('y', '-98');
    }
  });

  test('the tile placed last stays outlined after the turn ends', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [START], currentTile: 'E', drawPile: ['U'] });
    await placeTile(alice, 0, -1);
    await button(alice, 'No meeple').click();
    await expect(turnMessage(bob)).toHaveText('Your turn');
    await expect(bob.locator('.cc-highlight')).toHaveCount(1);
  });

  test('the side panel shows the tile being placed, the tiles left and the scores highest first with each player\'s meeples in hand', async ({ seat }) => {
    const { table, alice } = await start(seat, 3);
    await craft(table, {
      board: [at(0, 0, 'D', 0, on(1, 'road'))],
      currentTile: 'B',
      drawPile: ['U', 'U', 'U'],
      scores: { 1: 3, 2: 10, 3: 5 }
    });
    await expect(tilePicture(alice)).toHaveAccessibleName('The tile to place: a monastery');
    await expect(tilesLeft(alice)).toHaveText('Tiles left: 3');
    await expect(alice.locator('.cc-player-name')).toHaveText(['Bob', 'Cara', 'Alice (you)']);
    await expect(alice.locator('.cc-player-score')).toHaveText(['10', '5', '3']);
    await expect(alice.locator('.cc-player-meeples')).toHaveText(['7 meeples', '7 meeples', '6 meeples']);
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, 3);
    await cells(alice).first().click();
    await button(alice, 'Place tile').click();
    await button(alice, 'Undo').click();
    await expect(button(bob, 'Approve')).toBeVisible();
    await expect(button(cara, 'Approve')).toBeVisible();
    await expect(button(alice, 'Approve')).toHaveCount(0);
  });

  test('FAQ at the top of the page shows a short guide to the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Where can a meeple go?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Carcassonne differences from Wikipedia', () => {
  test('base game only: no sixth player', async ({ seat, browser, server }) => {
    const { table } = await start(seat, 5);
    const sixth = await newPlayer(browser, server);
    await sixth.goto('/');
    await sixth.locator('.lobby-game').filter({ has: sixth.locator('.lobby-game-name', { hasText: new RegExp(`^${nameOf('carcassonne')}$`) }) }).click();
    await sixth.getByLabel('Your name').fill('Fay');
    await sixth.getByLabel('Game ID').fill(table.gameId);
    await sixth.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(sixth.locator('.lobby-error')).toHaveText('Game is full');
    await sixth.context().close();
  });

  test('the first player to join goes first, not the youngest', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(button(alice, 'Place tile')).toBeVisible();
    await expect(button(bob, 'Place tile')).toHaveCount(0);
    await expect(turnMessage(bob)).toHaveText('Alice goes first. Joining closes after the first move.');
  });

  test('a tile that fits nowhere is always set aside and the next drawn, without asking the players', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [at(0, 0, 'B')], currentTile: 'B', drawPile: ['U', 'C'] });
    await placeTile(alice, 0, 1);
    await button(alice, 'No meeple').click();
    await expect(tilesLeft(alice)).toHaveText('Tiles left: 0 (1 set aside)');
    // Straight to Bob's turn with the next tile: no vote or question for anyone
    await expect(button(bob, 'Place tile')).toBeVisible();
    for (const page of [alice, bob]) await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('every player has the 7 meeples that can be played, and the score is in the side panel', async ({ seat }) => {
    const { alice } = await start(seat);
    for (const name of ['Alice', 'Bob']) {
      await expect(meeplesInHand(alice, name)).toHaveText('7 meeples');
      await expect(meeplesInHand(alice, name)).toHaveAttribute('title', '7 of 7 meeples in hand');
      await expect(score(alice, name)).toHaveText('0');
    }
  });

  test('placing the tile and choosing the meeple are two moves: each can be undone on its own', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { board: [START], currentTile: 'B', drawPile: ['U'] });
    await placeTile(alice, 0, 1);
    await expect(button(bob, 'Undo')).toBeEnabled(); // the placed tile is already a move
    await expect(alice.locator('.cc-hint')).toHaveText('Click a circle on your tile to put a meeple there, or place none');
    await undo(bob, alice);
    await expect(button(alice, 'Place tile')).toBeVisible();
    await expect(board(alice)).toHaveAttribute('aria-label', 'Board with 1 tiles');
  });
});
