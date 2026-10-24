import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat } from './fixtures.ts';
import { BLANK, emptyBoard } from '../games/scrabble/rules.ts';
import type { GameState, Placement } from '../games/scrabble/types.ts';

// One test per rule and control in games/scrabble/README.md. Rows and columns here count from 0, as the server
// does; the squares' labels count from 1. Racks are written as strings, with ? for a blank.

type Setup = Partial<Pick<GameState, 'bag' | 'scores' | 'scorelessTurns' | 'currentPlayer'>> & {
  racks?: Record<number, string>;
  words?: Placement[]; // tiles already on the board
};

// Tiles spelling `word` from (row, col), across or down
function spell(word: string, row: number, col: number, down = false): Placement[] {
  return word.split('').map((letter, index) => ({ row: down ? row + index : row, col: down ? col : col + index, letter }));
}

// The board with `words` on it
function boardOf(words: Placement[]) {
  const board = emptyBoard();
  for (const tile of words) board[tile.row][tile.col] = { letter: tile.letter, blank: tile.blank === true };
  return board;
}

// Seats the players, then sets up a game in progress on Alice's turn
async function start(seat: Seat, setup: Setup = {}, names = ['Alice', 'Bob']) {
  const table = await seat('scrabble', names);
  const { racks, words = [], ...rest } = setup;
  const patch: Record<string, unknown> = { started: true, currentPlayer: 1, board: boardOf(words), ...rest };
  // The patch replaces the whole of `racks`, so the racks not named keep the tiles they were dealt
  if (racks) {
    const dealt = (await table.state<GameState>()).racks;
    patch.racks = { ...dealt, ...Object.fromEntries(Object.entries(racks).map(([at, letters]) => [at, letters.split('')])) };
  }
  await table.patch(patch);
  const [alice, bob, cara] = table.pages;
  await expect(alice.locator('.turn-message')).toHaveText(patch.currentPlayer === 1 ? 'Your turn' : /'s turn$/);
  return { table, alice, bob, cara };
}

const rack = (page: Page) => page.getByLabel('Your rack');
const freeSlots = (page: Page) => rack(page).locator('.rack-slot:not(.rack-slot-placed)');
// A tile still on the rack: a letter, or ? for a blank
const rackTile = (page: Page, letter: string) => letter === BLANK
  ? freeSlots(page).filter({ has: page.locator('.tile-blank') }).first()
  : freeSlots(page).filter({ hasText: new RegExp(`^${letter}\\d*$`) }).first();
const square = (page: Page, row: number, col: number) =>
  page.getByRole('button', { name: `Row ${row + 1}, column ${col + 1}`, exact: true });
const rackLetters = (page: Page) => rack(page).locator('.tile-letter').allTextContents();
const hint = (page: Page) => page.locator('.hint');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const scoreRow = (page: Page, name: string) => page.locator('.score-row', { hasText: name });
const points = (page: Page, name: string) => scoreRow(page, name).locator('.score-points');
const playButton = (page: Page) => page.locator('.play-button');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

// Clicks a rack tile, then a square; a blank also needs its letter picked
async function place(page: Page, letter: string, row: number, col: number, blankAs?: string) {
  await rackTile(page, letter).click();
  await square(page, row, col).click();
  if (blankAs) await page.getByRole('group', { name: 'Letter for the blank' }).getByRole('button', { name: blankAs, exact: true }).click();
}

async function placeWord(page: Page, tiles: Placement[]) {
  for (const tile of tiles) await place(page, tile.letter, tile.row, tile.col);
}

test.describe('Scrabble rules', () => {
  test('a 15x15 board with premium squares, a double-word center star, and 100 tiles with their usual values', async ({ seat }) => {
    const { alice } = await start(seat, { racks: { 1: 'QZXJKE?' } });
    await expect(alice.locator('.board .square')).toHaveCount(225);
    await expect(alice.locator('.square-tw')).toHaveCount(8);
    await expect(alice.locator('.square-dw')).toHaveCount(17);
    await expect(alice.locator('.square-tl')).toHaveCount(12);
    await expect(alice.locator('.square-dl')).toHaveCount(24);
    await expect(square(alice, 7, 7)).toHaveClass(/square-dw/);
    await expect(square(alice, 7, 7)).toHaveText('★');

    // Q and Z are worth 10, X and J 8, K 5, E 1, and the blank 0 (it shows no value)
    await expect(rack(alice).locator('.tile-value')).toHaveText(['10', '10', '8', '8', '5', '1']);
    await expect(rackTile(alice, BLANK).locator('.tile-value')).toHaveCount(0);

    const fresh = await seat('scrabble', ['Cara', 'Dan']);
    await expect(fresh.pages[0].locator('.bag-count')).toHaveText('Tiles in the bag: 86');
    const state = await fresh.state<GameState>();
    const tiles = [...state.bag, ...Object.values(state.racks).flat()];
    expect(tiles).toHaveLength(100);
    expect(tiles.filter(tile => tile === BLANK)).toHaveLength(2);
  });

  test('each player draws a tile, closest to A goes first, a blank beats every letter, ties draw again, redone on every join and leave', async ({ seat }) => {
    const first = await seat('scrabble', ['Alice']);
    const [alice] = first.pages;
    // Alice draws the bag's first tile, an A; Bob the ninth of what is left, a B
    await first.random(0, 8.5 / 99);
    const bob = await first.join('Bob');
    await expect(status(alice)).toContainText('Alice drew A, Bob drew B. Alice goes first.');
    await expect(turn(bob)).toHaveText('Alice goes first. Joining closes after the first move.');
    // The drawn tiles went back before the racks were dealt
    await expect(alice.locator('.bag-count')).toHaveText('Tiles in the bag: 86');

    // Cara joins and the draw is redone: she draws the last tile, a blank, and beats the two As
    await first.random(0, 0, 97.5 / 98);
    const cara = await first.join('Cara');
    await expect(status(alice)).toContainText('Alice drew A, Bob drew A, Cara drew a blank. Cara goes first.');
    await expect(turn(cara)).toHaveText('Cara goes first. Joining closes after the first move.');

    // Cara leaves and the draw is redone: two As tie, so they draw again
    await first.random(0, 0, 0, 6.5 / 97);
    await leave(cara);
    await expect(status(alice)).toContainText('Alice drew A, Bob drew A; tie, so they draw again: Alice drew A, Bob drew B. Alice goes first.');
    await expect(alice.locator('.bag-count')).toHaveText('Tiles in the bag: 86');
  });

  test('play passes in seat order from whoever goes first', async ({ seat }) => {
    const first = await seat('scrabble', ['Alice', 'Bob']);
    // Alice draws a B, Bob an A and Cara a C, so Bob (seat 2) goes first
    await first.random(9.5 / 100, 0, 9.5 / 98);
    const cara = await first.join('Cara');
    const [alice, bob] = first.pages;
    await expect(turn(bob)).toHaveText('Bob goes first. Joining closes after the first move.');
    await button(bob, 'Pass').click();
    await expect(turn(cara)).toHaveText('Your turn');
    await button(cara, 'Pass').click();
    await expect(turn(alice)).toHaveText('Your turn');
    await button(alice, 'Pass').click();
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('everyone holds 7 tiles and draws back up to 7 after each play', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'CATSXYZ' }, bag: Array(20).fill('E') });
    await expect(rack(alice).locator('.rack-slot')).toHaveCount(7);
    await expect(scoreRow(bob, 'Alice')).toContainText('7 tiles');
    await expect(scoreRow(alice, 'Bob')).toContainText('7 tiles');
    await placeWord(alice, spell('CAT', 7, 6));
    await playButton(alice).click();
    await expect(turn(bob)).toHaveText('Your turn');
    expect((await rackLetters(alice)).sort()).toEqual(['E', 'E', 'E', 'S', 'X', 'Y', 'Z']);
    await expect(scoreRow(bob, 'Alice')).toContainText('7 tiles');
    await expect(bob.locator('.bag-count')).toHaveText('Tiles in the bag: 17');
  });

  test('on your turn you can play tiles, exchange tiles or pass, and not on anyone else\'s', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'CATSXYZ' } });
    await expect(button(alice, 'Exchange')).toBeEnabled();
    await expect(button(alice, 'Pass')).toBeEnabled();
    await placeWord(alice, spell('CAT', 7, 6));
    await expect(playButton(alice)).toBeEnabled();

    await expect(button(bob, 'Exchange')).toBeDisabled();
    await expect(button(bob, 'Pass')).toBeDisabled();
    await expect(playButton(bob)).toBeDisabled();
    for (const slot of await rack(bob).locator('.rack-slot').all()) await expect(slot).toBeDisabled();
  });

  test('tiles go in one row or column as one unbroken run; the first word covers the star with two tiles, later ones touch the board', async ({ seat }) => {
    const { table, alice } = await start(seat, { racks: { 1: 'ABCDEFG' } });
    // A lone tile on the star is too short
    await place(alice, 'A', 7, 7);
    await expect(hint(alice)).toHaveText('The first word needs at least two letters');
    await expect(playButton(alice)).toBeDisabled();
    await button(alice, 'Recall').click();

    // Two tiles off the star
    await place(alice, 'A', 3, 3);
    await place(alice, 'B', 3, 4);
    await expect(hint(alice)).toHaveText('The first word must cover the center star');
    await expect(playButton(alice)).toBeDisabled();
    await button(alice, 'Recall').click();

    // Not in one line
    await place(alice, 'A', 7, 7);
    await place(alice, 'B', 8, 8);
    await expect(hint(alice)).toHaveText('Place your tiles in one row or one column');
    await button(alice, 'Recall').click();

    // A gap in the line
    await place(alice, 'A', 7, 7);
    await place(alice, 'B', 7, 9);
    await expect(hint(alice)).toHaveText('Your tiles must form one unbroken line');
    await expect(playButton(alice)).toBeDisabled();
    await button(alice, 'Recall').click();

    // Later words: CAT is on the board
    await table.patch({ board: boardOf(spell('CAT', 7, 6)) });
    await expect(square(alice, 7, 6)).toContainText('C');
    await place(alice, 'A', 2, 2);
    await place(alice, 'B', 2, 3);
    await expect(hint(alice)).toHaveText('Your word must connect to tiles on the board');
    await expect(playButton(alice)).toBeDisabled();
    await button(alice, 'Recall').click();

    // Tiles on both sides of the board's tiles make one run with them: B + CAT + D
    await place(alice, 'B', 7, 5);
    await place(alice, 'D', 7, 9);
    await expect(hint(alice)).toHaveText('BCATD: 10 points');
    await expect(playButton(alice)).toBeEnabled();
  });

  test('every word formed is scored, premiums count only when covered, all seven tiles add 50, and a blank scores 0', async ({ seat }) => {
    // Seven tiles across the star, the blank as G: (1+3+3+2+1+4+0) doubled is 28, plus 50
    const bingo = await start(seat, { racks: { 1: 'ABCDEF?' } });
    const { alice } = bingo;
    for (const [index, letter] of [...'ABCDEF'].entries()) await place(alice, letter, 7, 4 + index);
    await place(alice, BLANK, 7, 10, 'G');
    await expect(hint(alice)).toHaveText('ABCDEFG 28, bingo 50: 78 points');
    await playButton(alice).click();
    await expect(points(alice, 'Alice')).toHaveText('78');
    await expect(status(alice)).toHaveText('Alice played ABCDEFG for 78 points (bingo!)');

    // CAT is already on the board. O on a double letter makes OX across and TO down: OX 2+8, TO 1+2
    const crossing = await start(seat, { racks: { 1: 'OXEEEEE', 2: 'AEEEEEE' }, words: spell('CAT', 7, 6) });
    await place(crossing.alice, 'O', 8, 8);
    await place(crossing.alice, 'X', 8, 9);
    await expect(hint(crossing.alice)).toHaveText('OX 10, TO 3: 13 points');
    await playButton(crossing.alice).click();
    await expect(points(crossing.bob, 'Alice')).toHaveText('13');

    // A on the double letter above the T makes ATO: 2+1+1, as the O's double letter was used last turn
    await place(crossing.bob, 'A', 6, 8);
    await expect(hint(crossing.bob)).toHaveText('ATO: 4 points');
    await playButton(crossing.bob).click();
    await expect(points(crossing.alice, 'Bob')).toHaveText('4');
  });

  test('there is no dictionary, and a disputed word is taken back only if every player still in the game approves the Undo', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, { racks: { 1: 'QXZJKVW' } }, ['Alice', 'Bob', 'Cara']);
    await placeWord(alice, spell('QXZ', 7, 6));
    await expect(hint(alice)).toHaveText('QXZ: 56 points');
    await playButton(alice).click();
    await expect(status(bob)).toHaveText('Alice played QXZ for 56 points');

    await bob.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await expect(cara.locator('.undo-vote')).toContainText('Alice: approved');
    await expect(square(bob, 7, 7)).toContainText('X'); // Cara has not approved yet
    await cara.getByRole('button', { name: 'Approve' }).click();
    await expect(square(bob, 7, 7)).not.toContainText('X');
    await expect(points(bob, 'Alice')).toHaveText('0');
  });

  test('exchanging swaps tiles while the bag holds 7 or more, uses the turn and scores nothing', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'QZXJKVW' }, bag: Array(7).fill('E') });
    await button(alice, 'Exchange').click();
    await rackTile(alice, 'Q').click();
    await rackTile(alice, 'Z').click();
    await button(alice, 'Exchange 2').click();
    await expect(status(bob)).toHaveText('Alice exchanged 2 tiles');
    await expect(turn(bob)).toHaveText('Your turn');
    expect((await rackLetters(alice)).sort()).toEqual(['E', 'E', 'J', 'K', 'V', 'W', 'X']);
    await expect(points(bob, 'Alice')).toHaveText('0');
    await expect(bob.locator('.bag-count')).toHaveText('Tiles in the bag: 7');

    // With 6 in the bag, Exchange is off
    const low = await start(seat, { bag: Array(6).fill('E') });
    await expect(button(low.alice, 'Exchange')).toBeDisabled();
    await expect(button(low.alice, 'Exchange')).toHaveAttribute('title', 'The bag needs at least 7 tiles');
  });

  test('using your last tile with the bag empty ends the game: you gain every other rack and they lose theirs', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'AB', 2: 'QZ' }, bag: [] });
    await place(alice, 'A', 7, 7);
    await place(alice, 'B', 7, 8);
    await playButton(alice).click(); // AB on the star: 8
    await expect(turn(bob)).toHaveText('Game over');
    await expect(points(bob, 'Alice')).toHaveText('28 (+20)');
    await expect(points(bob, 'Bob')).toHaveText('-20 (-20)');
    await expect(status(bob)).toHaveText('Alice wins with 28 points!');
  });

  test('after six scoreless turns any player may end the game, everyone losing their rack, and until then play goes on', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      racks: { 1: 'AAAAAAA', 2: 'QAAAAAA' }, scores: { 1: 20, 2: 30 }, scorelessTurns: 5
    });
    await expect(button(alice, 'End game')).toHaveCount(0);
    await button(alice, 'Pass').click();
    await expect(status(bob)).toContainText('6 scoreless turns in a row: any player may end the game.');
    await expect(button(alice, 'End game')).toBeVisible();
    await expect(turn(bob)).toHaveText('Your turn'); // play goes on

    await button(bob, 'End game').click();
    await expect(turn(alice)).toHaveText('Game over');
    await expect(points(alice, 'Alice')).toHaveText('13 (-7)');
    await expect(points(alice, 'Bob')).toHaveText('14 (-16)');
    await expect(status(alice)).toHaveText('Bob ended the game. Bob wins with 14 points!');
  });

  test('the highest score wins, and tied players share the win', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      racks: { 1: 'AAAAAAA', 2: 'EEEEEEE' }, scores: { 1: 10, 2: 10 }, scorelessTurns: 6
    });
    await button(alice, 'End game').click();
    await expect(status(bob)).toHaveText('Alice ended the game. Alice and Bob share the win with 3 points!');
    await expect(scoreRow(bob, 'Alice')).toHaveClass(/score-winner/);
    await expect(scoreRow(bob, 'Bob')).toHaveClass(/score-winner/);
  });

  test('nobody sees another player\'s tiles, only how many each holds and how many are in the bag', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'QZXJKVW', 2: 'AEIOUNR' }, bag: Array(30).fill('E') });
    expect(await rackLetters(alice)).toEqual(['Q', 'Z', 'X', 'J', 'K', 'V', 'W']);
    expect(await rackLetters(bob)).toEqual(['A', 'E', 'I', 'O', 'U', 'N', 'R']);
    // The only tiles on Bob's screen are his own seven
    await expect(bob.locator('.tile')).toHaveCount(7);
    await expect(alice.locator('.tile')).toHaveCount(7);
    await expect(scoreRow(bob, 'Alice')).toContainText('7 tiles');
    await expect(bob.locator('.bag-count')).toHaveText('Tiles in the bag: 30');
  });

  test('a player who leaves puts their tiles back in the bag and is skipped, and the last player left wins', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, { currentPlayer: 2, bag: Array(30).fill('E') }, ['Alice', 'Bob', 'Cara']);
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(scoreRow(alice, 'Cara')).toContainText('Cara (left)');
    await expect(alice.locator('.bag-count')).toHaveText('Tiles in the bag: 37');
    await button(bob, 'Pass').click();
    await expect(turn(alice)).toHaveText('Your turn'); // Cara's turn was skipped

    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo happens only if every player still in the game approves', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, { racks: { 1: 'CATSXYZ' } }, ['Alice', 'Bob', 'Cara']);
    await placeWord(alice, spell('CAT', 7, 6));
    await playButton(alice).click();
    await expect(turn(bob)).toHaveText('Your turn');

    await bob.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(cara.locator('.undo-vote')).toHaveCount(0);
    await expect(square(cara, 7, 7)).toContainText('A');

    await undo(bob, alice, cara);
    await expect(square(cara, 7, 7)).toContainText('★');
    await expect(turn(alice)).toHaveText('Your turn');
    expect(await rackLetters(alice)).toEqual(['C', 'A', 'T', 'S', 'X', 'Y', 'Z']);
  });
});

test.describe('Scrabble controls', () => {
  test('click a rack tile then a square to place it; click it again to take it back, or Recall them all', async ({ seat }) => {
    const { alice } = await start(seat, { racks: { 1: 'CATSXYZ' } });
    await rackTile(alice, 'C').click();
    await expect(rack(alice).locator('.rack-slot-selected')).toHaveText('C3');
    await expect(hint(alice)).toHaveText('Now click an empty square');
    await square(alice, 7, 6).click();
    await expect(square(alice, 7, 6).locator('.tile-pending')).toHaveText('C3');
    await expect(rack(alice).locator('.rack-slot-placed')).toHaveCount(1);

    await square(alice, 7, 6).click();
    await expect(square(alice, 7, 6).locator('.tile')).toHaveCount(0);
    await expect(rack(alice).locator('.rack-slot-placed')).toHaveCount(0);

    await placeWord(alice, spell('CAT', 7, 6));
    await expect(alice.locator('.board .tile-pending')).toHaveCount(3);
    await button(alice, 'Recall').click();
    await expect(alice.locator('.board .tile-pending')).toHaveCount(0);
    await expect(rack(alice).locator('.rack-slot-placed')).toHaveCount(0);
  });

  test('placing a blank shows a row of letters under the rack to pick what it stands for', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: '?ATSXYZ' } });
    await rackTile(alice, BLANK).click();
    await square(alice, 7, 6).click();
    const picker = alice.getByRole('group', { name: 'Letter for the blank' });
    await expect(picker.getByRole('button')).toHaveCount(27); // A to Z and Cancel
    await expect(hint(alice)).toHaveText('Pick the letter for your blank');
    await picker.getByRole('button', { name: 'C', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const blank = square(alice, 7, 6).locator('.tile');
    await expect(blank).toHaveClass(/tile-blank/);
    await expect(blank).toHaveText('C');

    await place(alice, 'A', 7, 7);
    await place(alice, 'T', 7, 8);
    await expect(hint(alice)).toHaveText('CAT: 4 points');
    await playButton(alice).click();
    await expect(square(bob, 7, 6).locator('.tile')).toHaveClass(/tile-blank/);
  });

  test('the line under the rack shows the words and their score, or why not, and Play plays them', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'OXEEEEE' }, words: spell('CAT', 7, 6) });
    await expect(hint(alice)).toHaveText('Your turn: click a tile on your rack');
    await place(alice, 'O', 9, 9);
    await expect(hint(alice)).toHaveText('Your word must connect to tiles on the board');
    await expect(hint(alice)).toHaveClass(/hint-error/);
    await square(alice, 9, 9).click();
    await place(alice, 'O', 8, 8);
    await place(alice, 'X', 8, 9);
    await expect(hint(alice)).toHaveText('OX 10, TO 3: 13 points');
    await expect(playButton(alice)).toHaveText('Play (13)');
    await playButton(alice).click();
    await expect(square(bob, 8, 9)).toContainText('X');
    await expect(status(bob)).toHaveText('Alice played OX for 13 points');
  });

  test('Exchange, select the tiles, then Exchange again to confirm, or Cancel', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'QZXJKVW' }, bag: Array(20).fill('E') });
    await button(alice, 'Exchange').click();
    await expect(hint(alice)).toHaveText('Select the tiles to put back in the bag');
    await expect(button(alice, 'Exchange 0')).toBeDisabled();
    await rackTile(alice, 'Q').click();
    await expect(rack(alice).locator('.rack-slot-selected')).toHaveCount(1);
    await button(alice, 'Cancel').click();
    await expect(button(alice, 'Exchange')).toBeEnabled();
    await expect(rack(alice).locator('.rack-slot-selected')).toHaveCount(0);
    await expect(turn(alice)).toHaveText('Your turn');

    await button(alice, 'Exchange').click();
    await rackTile(alice, 'W').click();
    await button(alice, 'Exchange 1').click();
    await expect(turn(bob)).toHaveText('Your turn');
    expect(await rackLetters(alice)).toEqual(['Q', 'Z', 'X', 'J', 'K', 'V', 'E']);
  });

  test('Pass skips your turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await button(alice, 'Pass').click();
    await expect(status(bob)).toHaveText('Alice passed');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(points(bob, 'Alice')).toHaveText('0');
  });

  test('Shuffle mixes the order of your rack, and only you see it', async ({ seat }) => {
    const { table, alice } = await start(seat, { racks: { 1: 'ABCDEFG' } });
    const before = await rackLetters(alice);
    expect(before.join('')).toBe('ABCDEFG');
    await expect.poll(async () => {
      await button(alice, 'Shuffle').click();
      return (await rackLetters(alice)).join('');
    }).not.toBe('ABCDEFG');
    expect((await rackLetters(alice)).sort()).toEqual(before);
    // Nothing went to the server
    expect((await table.state<GameState>()).racks[1].join('')).toBe('ABCDEFG');
  });

  test('after six scoreless turns everyone sees an End game button next to Undo, which ends the game at once', async ({ seat }) => {
    const { alice, bob } = await start(seat, { scorelessTurns: 5 });
    await button(alice, 'Pass').click();
    for (const page of [alice, bob]) {
      await expect(page.locator('.action-buttons').getByRole('button')).toHaveText(['Undo', 'End game']);
    }
    await button(alice, 'End game').click();
    await expect(turn(bob)).toHaveText('Game over');
    await expect(button(bob, 'End game')).toHaveCount(0);
  });

  test('the last play\'s tiles are outlined, and the board and rack are dimmed when it is not your turn', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'CATSXYZ' } });
    await expect(alice.locator('.play-area')).not.toHaveClass(/play-area-waiting/);
    await expect(bob.locator('.play-area')).toHaveClass(/play-area-waiting/);
    expect(await bob.locator('.rack').evaluate(element => getComputedStyle(element).opacity)).toBe('0.7');

    await placeWord(alice, spell('CAT', 7, 6));
    await playButton(alice).click();
    await expect(bob.locator('.tile-last')).toHaveCount(3);
    await expect(alice.locator('.tile-last')).toHaveCount(3);
    await expect(square(bob, 7, 6).locator('.tile')).toHaveClass(/tile-last/);
    await expect(alice.locator('.play-area')).toHaveClass(/play-area-waiting/);
    await expect(bob.locator('.play-area')).not.toHaveClass(/play-area-waiting/);
  });

  test('clicking Undo asks everyone else to approve undoing the last turn', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, {}, ['Alice', 'Bob', 'Cara']);
    await button(alice, 'Pass').click();
    await expect(turn(bob)).toHaveText('Your turn');
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Is there a dictionary?');
    await expect(faq).toContainText('What does Shuffle do?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Scrabble differences from Wikipedia', () => {
  test('no dictionary: an approved Undo takes a disputed word back and nobody loses a turn', async ({ seat }) => {
    const { alice, bob } = await start(seat, { racks: { 1: 'QXZJKVW' } });
    await placeWord(alice, spell('ZQX', 7, 6));
    await playButton(alice).click();
    await expect(turn(bob)).toHaveText('Your turn');
    await undo(bob, alice);
    await expect(status(bob)).toHaveText('Last turn undone');
    await expect(points(bob, 'Alice')).toHaveText('0');
    // Alice plays again, then it is Bob's turn as before
    await expect(turn(alice)).toHaveText('Your turn');
    await button(alice, 'Pass').click();
    await expect(turn(bob)).toHaveText('Your turn');
  });
});

test.describe('Scrabble turn timer', () => {
  test('tiles placed when the time runs out go back to the rack and the turn passes', async ({ seat }) => {
    const table = await seat('scrabble', ['Alice', 'Bob'], { houseRules: { turnMinutes: 1 } });
    const [alice, bob] = table.pages;
    const dealt = (await table.state<GameState>()).racks;
    await table.patch({ started: true, currentPlayer: 1, racks: { ...dealt, 1: 'CATAAAA'.split('') }, turnStartedAt: Date.now() + 5000 });
    await expect(alice.locator('.turn-timer')).toHaveText(/^[01]:\d\d$/);
    await placeWord(alice, spell('CAT', 7, 6));
    await expect(freeSlots(alice)).toHaveCount(4);
    await table.patch({ turnStartedAt: Date.now() - 61_000 });
    await expect(status(bob)).toHaveText('Alice ran out of time');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(freeSlots(alice)).toHaveCount(7);
    expect(await rackLetters(alice)).toEqual('CATAAAA'.split(''));
    await expect(points(alice, 'Alice')).toHaveText('0');
  });
});
