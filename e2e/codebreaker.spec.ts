import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import {
  agreeToHouseRules, dismiss, expect, inHouseRules, joinGame, leave, newPlayer, openFaq, setHouseRules, setPreference, test, undo,
  watch, type Seat
} from './fixtures.ts';
import { feedback } from '../games/codebreaker/feedback.ts';
import type { Color, Guess } from '../games/codebreaker/types.ts';

// One test per rule, control and difference in games/codebreaker/README.md. Seat 1 is Alice, seat 2 Bob, seat 3 Cara.
// Solo, Together and Race draw their code on the server, so each test patches in a known code before the first guess.

type Mode = 'solo' | 'classic' | 'together' | 'race';

const name = (color: Color) => color[0].toUpperCase() + color.slice(1);
const board = (page: Page, label = 'Guesses') => page.getByRole('group', { name: label, exact: true });
const row = (page: Page, n: number, label = 'Guesses') => board(page, label).getByRole('listitem', { name: `Guess ${n}`, exact: true });
const answer = (page: Page, n: number, label = 'Guesses') => row(page, n, label).locator('.cb-answer');
const codeRow = (page: Page, label = 'Guesses') => board(page, label).getByRole('group', { name: /^Code/ });
const colorButton = (page: Page, color: Color) => page.getByRole('group', { name: 'Colors' }).getByRole('button', { name: name(color), exact: true });
const draftSlots = (page: Page) => page.getByRole('group', { name: 'Your row' }).getByRole('button');
const turn = (page: Page) => page.locator('.cb-turn');
const status = (page: Page) => page.locator('.cb-status');
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const summary = (page: Page) => page.getByRole('dialog', { name: 'Round scoring' });
const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });

// Seats `names`, sets the Mode (and any other rule) once everyone is in, and everyone agrees.
// A code given is patched in place of the one the computer drew
async function start(seat: Seat, names: string[], { mode, code, codeRule }: { mode?: Mode; code?: Color[]; codeRule?: '4of6' | '5of8' } = {}) {
  const table = await seat('codebreaker', names, { agree: false });
  const pages = table.pages;
  for (const page of pages) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(pages.length));
  const values = { ...(mode ? { mode } : {}), ...(codeRule ? { code: codeRule } : {}) };
  if (Object.keys(values).length > 0) await setHouseRules(pages[0], 'codebreaker', values);
  await agreeToHouseRules(...pages);
  if (code) await table.patch({ code });
  return { table, pages };
}

// Builds `pegs` with the color buttons and presses `submit` (Submit guess, or Set code for a Classic maker)
async function enter(page: Page, pegs: Color[], submit = 'Submit guess'): Promise<void> {
  for (const color of pegs) await colorButton(page, color).click();
  await button(page, submit).click();
}

// Each element of `items` has the matching accessible name, in order
async function expectNames(items: Locator, names: string[]): Promise<void> {
  await expect(items).toHaveCount(names.length);
  for (const [index, label] of names.entries()) await expect(items.nth(index)).toHaveAccessibleName(label);
}

const pegNames = (page: Page, n: number, label = 'Guesses') => row(page, n, label).getByRole('img');

// `page` guesses `pegs` and waits for the guess to land as row `n` of the board labelled `label`
async function guess(page: Page, pegs: Color[], n: number, label = 'Guesses'): Promise<void> {
  await enter(page, pegs);
  await expect(row(page, n, label).locator('.cb-answer')).toHaveCount(1);
  await expectNames(pegNames(page, n, label), pegs.map(name));
}
const textOf = (code: Color[], pegs: Color[]) => {
  const { exact, colorOnly } = feedback(code, pegs);
  return `${exact} right place, ${colorOnly} right color`;
};

const CODE: Color[] = ['purple', 'orange', 'yellow', 'purple'];
const WRONG: Color[] = ['red', 'red', 'blue', 'blue'];

test.describe('Code Breaker modes', () => {
  test('one seat plays Solo, the only mode offered', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice']);
    await inHouseRules(alice, async dialog => {
      const mode = dialog.getByLabel('Mode', { exact: true });
      await expect(mode.locator('option')).toHaveText(['Solo']);
      await expect(mode).toHaveValue('solo');
      await expect(dialog.getByLabel('Code', { exact: true }).locator('option')).toHaveText(['4 pegs, 6 colors', '5 pegs, 8 colors']);
    });
    await expect(turn(alice)).toHaveText('Break the code');
  });

  test('two seats default to Classic and also offer Together and Race', async ({ seat }) => {
    const { pages } = await start(seat, ['Alice', 'Bob']);
    for (const page of pages) {
      await inHouseRules(page, async dialog => {
        const mode = dialog.getByLabel('Mode', { exact: true });
        await expect(mode.locator('option')).toHaveText(['Together', 'Race', 'Classic']);
        await expect(mode).toHaveValue('classic');
      });
    }
    await expect(turn(pages[0])).toHaveText('Your turn: set a code');
  });

  test('three seats default to Together, and Classic is not offered', async ({ seat }) => {
    const { pages } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await inHouseRules(pages[2], async dialog => {
      const mode = dialog.getByLabel('Mode', { exact: true });
      await expect(mode.locator('option')).toHaveText(['Together', 'Race']);
      await expect(mode).toHaveValue('together');
    });
    for (const page of pages) await expect(turn(page)).toHaveText('Anyone can guess at any time');
  });
});

test.describe('Code Breaker rules', () => {
  test('a guess earns a dark peg per right place and a light peg per other right color', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice'], { code: CODE });
    const guesses: Color[][] = [WRONG, ['purple', 'purple', 'orange', 'green'], ['purple', 'orange', 'yellow', 'green']];
    for (const [index, pegs] of guesses.entries()) {
      await guess(alice, pegs, index + 1);
      await expect(answer(alice, index + 1)).toHaveAttribute('title', textOf(CODE, pegs));
    }
    await expect(answer(alice, 1)).toHaveAttribute('title', '0 right place, 0 right color');
    await expect(answer(alice, 2)).toHaveAttribute('title', '1 right place, 2 right color');
    await expect(answer(alice, 3)).toHaveAttribute('title', '3 right place, 0 right color');
    await expect(answer(alice, 2).locator('.cb-key-exact')).toHaveCount(1);
    await expect(answer(alice, 2).locator('.cb-key-color')).toHaveCount(2);
  });

  test('with repeated colors each code peg counts once, right places first', async ({ seat }) => {
    const code: Color[] = ['red', 'red', 'green', 'green'];
    const { pages: [alice] } = await start(seat, ['Alice'], { code });
    await guess(alice, ['green', 'green', 'green', 'green'], 1);
    await expect(answer(alice, 1)).toHaveAttribute('title', '2 right place, 0 right color');
    await guess(alice, ['green', 'green', 'red', 'red'], 2);
    await expect(answer(alice, 2)).toHaveAttribute('title', '0 right place, 4 right color');
    await guess(alice, ['red', 'green', 'yellow', 'yellow'], 3);
    await expect(answer(alice, 3)).toHaveAttribute('title', '1 right place, 1 right color');
  });

  test('Solo: breaking the code wins and shows it, and the code stays covered until then', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice'], { code: CODE });
    await expect(codeRow(alice)).toHaveAccessibleName('Code, hidden');
    await expect(codeRow(alice).getByRole('img', { name: 'Hidden' })).toHaveCount(4);
    await guess(alice, WRONG, 1);
    await expect(codeRow(alice)).toHaveAccessibleName('Code, hidden');
    await guess(alice, CODE, 2);
    await expect(status(alice)).toHaveText('Broken in 2 guesses!');
    await expect(gameOver(alice)).toBeVisible();
    await expect(codeRow(alice)).toHaveAccessibleName('Code');
  });

  test('Solo: ten misses lose and reveal the code', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat, ['Alice'], { code: CODE });
    const misses: Guess[] = Array.from({ length: 9 }, () => ({ pegs: WRONG, feedback: feedback(CODE, WRONG), by: 1 }));
    await table.patch({ board: { guesses: misses, broken: false } });
    await expect(row(alice, 9).locator('.cb-answer')).toHaveCount(1);
    await guess(alice, WRONG, 10);
    await expect(status(alice)).toHaveText('The code was not broken');
    await expect(gameOver(alice)).toBeVisible();
    await expect(codeRow(alice)).toHaveAccessibleName('Code');
  });

  test('Classic: the maker sets the code, the breaker never receives it before the round ends, and the round is scored', async ({ seat, browser, server }) => {
    test.slow(); // a hand-made join with recorded frames
    // Bob joins by hand, so his page records every frame and API body from before he joins
    const table = await seat('codebreaker', ['Alice'], { agree: false });
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames: string[] = [];
    const bodies: string[] = [];
    bob.on('websocket', ws => ws.on('framereceived', frame => frames.push(String(frame.payload))));
    bob.on('response', response => { if (response.url().includes('/api/')) response.text().then(text => bodies.push(text), () => {}); });
    try {
      await joinGame(bob, 'codebreaker', table.gameId, 'Bob');
      for (const page of [alice, bob]) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(2));
      await agreeToHouseRules(alice, bob);
      await expect(turn(alice)).toHaveText('Your turn: set a code');
      await expect(turn(bob)).toHaveText('Waiting for Alice to set the code');
      await expect(bob.getByRole('group', { name: 'Colors' })).toHaveCount(0);
      await expect(alice.locator('.cb-classic-info')).toContainText('Round 1 of 4: Alice makes the code');
      await enter(alice, CODE, 'Set code');
      await expect(turn(bob)).toHaveText('Your turn: break the code');
      await expect(turn(alice)).toHaveText('Bob is breaking your code');
      await expect(codeRow(alice)).toHaveAccessibleName('Code');
      await expect(codeRow(bob)).toHaveAccessibleName('Code, hidden');
      const pegs: Color[] = ['purple', 'yellow', 'orange', 'red'];
      await guess(bob, pegs, 1);
      await expect(answer(bob, 1)).toHaveAttribute('title', textOf(CODE, pegs));
      await expect(answer(alice, 1)).toHaveAttribute('title', '1 right place, 2 right color');
      // History, read by the breaker mid-round, keeps the code covered too
      await bob.getByRole('button', { name: 'History' }).click();
      const history = bob.getByRole('dialog', { name: 'History' });
      await expect(history.getByRole('group', { name: 'Code, hidden' })).toBeVisible();
      await expect.poll(() => bodies.length).toBeGreaterThan(0);
      await history.getByRole('button', { name: 'Close' }).click();
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.filter(frame => /"code":\[/.test(frame))).toEqual([]);
      expect(bodies.filter(body => /"code":\[/.test(body))).toEqual([]);

      await guess(bob, CODE, 2);
      for (const page of [alice, bob]) {
        await expect(summary(page)).toBeVisible();
        await expect(summary(page)).toContainText('Round 1 of 4');
        await expect(summary(page)).toContainText('Bob scores 2 points');
        await expect(summary(page).locator('.cb-summary-code').getByRole('img')).toHaveCount(4);
      }
      await expectNames(summary(bob).locator('.cb-summary-code').getByRole('img'), ['Purple', 'Orange', 'Yellow', 'Purple']);
      await expect(codeRow(bob)).toHaveAccessibleName('Code');
    } finally {
      await bob.context().close();
    }
  });

  test('Classic: Continue from both players starts round 2 with the other player as maker', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await enter(alice, CODE, 'Set code');
    await guess(bob, CODE, 1);
    await summary(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(summary(alice)).toContainText('Waiting for Bob');
    await expect(summary(bob)).toBeVisible();
    await summary(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(summary(alice)).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Your turn: set a code');
    await expect(turn(alice)).toHaveText('Waiting for Bob to set the code');
    await expect(bob.locator('.cb-classic-info')).toContainText('Round 2 of 4: Bob makes the code');
    await expect(board(alice).locator('.cb-answer')).toHaveCount(0);
    await expect(alice.getByRole('list', { name: 'Points' })).toContainText(/Bob.*1 point/);
  });

  test('Classic: a breaker who fails all 10 guesses scores 11', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await enter(alice, CODE, 'Set code');
    await expect(turn(bob)).toHaveText('Your turn: break the code');
    const misses: Guess[] = Array.from({ length: 9 }, () => ({ pegs: WRONG, feedback: feedback(CODE, WRONG), by: 2 }));
    await table.patch({ board: { guesses: misses, broken: false } });
    await expect(row(bob, 9).locator('.cb-answer')).toHaveCount(1);
    await guess(bob, WRONG, 10);
    await expect(summary(alice)).toContainText('Bob scores 11 points');
    await expect(status(alice)).toHaveText('Bob ran out of guesses');
  });

  test('Classic: after four rounds, each player making the code twice, the lowest total wins', async ({ seat }) => {
    test.slow(); // four rounds played through the screen
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    const players = { alice, bob };
    // Round 1 Alice makes (Bob breaks in 1), 2 Bob makes (Alice breaks in 2), 3 Alice (Bob in 1), 4 Bob (Alice in 1)
    const rounds: { maker: keyof typeof players; breaker: keyof typeof players; misses: number }[] = [
      { maker: 'alice', breaker: 'bob', misses: 0 },
      { maker: 'bob', breaker: 'alice', misses: 1 },
      { maker: 'alice', breaker: 'bob', misses: 0 },
      { maker: 'bob', breaker: 'alice', misses: 0 }
    ];
    for (const [index, { maker, breaker, misses }] of rounds.entries()) {
      await expect(players[maker].locator('.cb-classic-info')).toContainText(`Round ${index + 1} of 4`);
      await enter(players[maker], CODE, 'Set code');
      for (let miss = 1; miss <= misses; miss++) await guess(players[breaker], WRONG, miss);
      await guess(players[breaker], CODE, misses + 1);
      for (const page of [alice, bob]) await summary(page).getByRole('button', { name: 'Continue' }).click();
    }
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(status(page)).toHaveText('Bob won with 2 points');
    }
    await expect(gameOver(alice).locator('.cb-round-row')).toHaveCount(4);
  });

  test('Classic: equal totals share the win', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    // Round 4: Bob makes the code, Alice breaks it; she has 2 points so far and Bob 3
    await table.patch({ round: 4, maker: 2, currentPlayer: 2, phase: 'setting', points: { 1: 2, 2: 3 }, gameStatus: 'Bob is setting the code' });
    await expect(turn(bob)).toHaveText('Your turn: set a code');
    await enter(bob, CODE, 'Set code');
    await guess(alice, CODE, 1);
    for (const page of [alice, bob]) await summary(page).getByRole('button', { name: 'Continue' }).click();
    await expect(gameOver(alice)).toBeVisible();
    await expect(status(alice)).toHaveText('Alice and Bob tied with 3 points');
  });

  test('Classic: a player who leaves makes the other the winner', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await enter(alice, CODE, 'Set code');
    await guess(bob, WRONG, 1);
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
    await expect(gameOver(alice)).toBeVisible();
  });

  test('Together: everyone guesses on one board, each row names its guesser, and breaking it wins for all', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'together', code: CODE });
    await guess(alice, WRONG, 1);
    await guess(bob, ['purple', 'red', 'red', 'red'], 2);
    for (const page of [alice, bob]) {
      await expect(row(page, 1).locator('.cb-guesser')).toHaveText('Alice');
      await expect(row(page, 2).locator('.cb-guesser')).toHaveText('Bob');
    }
    await expect(row(alice, 1).locator('.cb-guesser')).toHaveAttribute('title', 'Alice');
    await expect(answer(alice, 2)).toHaveAttribute('title', '1 right place, 0 right color');
    await guess(alice, CODE, 3);
    for (const page of [alice, bob]) await expect(gameOver(page)).toBeVisible();
    await expect(status(bob)).toHaveText('Broken in 3 guesses!');
  });

  test('Race: each page shows only its own rows and the others\' progress, and the race ends once nobody can match the best', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'race', code: CODE });
    await expect(turn(alice)).toHaveText('Break the code before the others');
    await guess(alice, ['purple', 'red', 'red', 'red'], 1, 'Your guesses');
    await guess(bob, WRONG, 1, 'Your guesses');
    await guess(bob, ['red', 'red', 'red', 'purple'], 2, 'Your guesses');
    // Alice sees her one row and Bob's count and progress, never his pegs
    await expect(board(alice, 'Your guesses').locator('.cb-answer')).toHaveCount(1);
    await expect(alice.getByRole('group', { name: /guesses/ })).toHaveCount(1);
    const bobRow = alice.getByRole('list', { name: 'Race progress' }).getByRole('listitem');
    await expect(bobRow).toHaveCount(1);
    await expect(bobRow).toContainText('Bob');
    await expect(bobRow).toContainText('2 of 10');
    await expect(bobRow).toContainText('25%');
    await expect(bob.getByRole('list', { name: 'Race progress' })).toContainText('1 of 10');
    // Alice breaks it in 2; Bob has used 2 already, so he cannot match it and the race ends
    await guess(alice, CODE, 2, "Alice's guesses");
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(status(page)).toHaveText('Alice wins, breaking the code in 2 guesses');
      // Once the race is over every page shows every board, each under its player's name
      await expect(page.locator('.cb-board-area .cb-board-title')).toHaveText(['Alice', 'Bob']);
      await expect(board(page, "Alice's guesses").locator('.cb-answer')).toHaveCount(2);
      await expect(board(page, "Bob's guesses").locator('.cb-answer')).toHaveCount(2);
      await expect(row(page, 2, "Bob's guesses").locator('.cb-answer')).toHaveAttribute('title', '1 right place, 0 right color');
      await expect(codeRow(page, "Bob's guesses")).toHaveAccessibleName('Code');
    }
  });

  test('Race: the race goes on while another player could still match the best', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'race', code: CODE });
    await guess(alice, WRONG, 1, 'Your guesses');
    await guess(alice, CODE, 2, 'Your guesses');
    await expect(turn(alice)).toHaveText('You broke the code. Waiting for the others');
    await expect(gameOver(alice)).toHaveCount(0);
    await expect(alice.getByRole('list', { name: 'Race progress' })).toContainText('0 of 10');
    await expect(bob.getByRole('list', { name: 'Race progress' })).toContainText('Broken');
    // Bob ties on 2 guesses, but Alice finished first
    await guess(bob, WRONG, 1, 'Your guesses');
    await guess(bob, CODE, 2, "Bob's guesses");
    await expect(status(bob)).toHaveText('Alice wins, breaking the code in 2 guesses');
    await expect(gameOver(bob)).toBeVisible();
  });

  test('Race: a spectator sees every board, and the code stays covered', async ({ seat, browser, server }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'race', code: CODE });
    await guess(alice, WRONG, 1, 'Your guesses');
    await guess(bob, ['purple', 'red', 'red', 'red'], 1, 'Your guesses');
    const dana = await watch(browser, server, 'codebreaker', table.gameId, 'Dana');
    try {
      await expect(row(dana, 1, "Alice's guesses").locator('.cb-answer')).toHaveCount(1);
      await expect(row(dana, 1, "Bob's guesses").locator('.cb-answer')).toHaveAttribute('title', '1 right place, 0 right color');
      await expect(codeRow(dana, "Alice's guesses")).toHaveAccessibleName('Code, hidden');
    } finally {
      await dana.context().close();
    }
  });

  test('Classic: a spectator does not see the maker\'s code', async ({ seat, browser, server }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await enter(alice, CODE, 'Set code');
    await guess(bob, WRONG, 1);
    const dana = await watch(browser, server, 'codebreaker', table.gameId, 'Dana');
    try {
      await expect(row(dana, 1).locator('.cb-answer')).toHaveCount(1);
      await expect(codeRow(dana)).toHaveAccessibleName('Code, hidden');
    } finally {
      await dana.context().close();
    }
  });
});

test.describe('Code Breaker endings, leaving and hidden code', () => {
  const misses = (count: number, by: number): Guess[] => Array.from({ length: count }, () => ({ pegs: WRONG, feedback: feedback(CODE, WRONG), by }));

  test('Together: ten misses lose for everyone', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'together', code: CODE });
    await table.patch({ board: { guesses: misses(9, 1), broken: false } });
    await expect(row(bob, 9).locator('.cb-answer')).toHaveCount(1);
    await guess(bob, WRONG, 10);
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(status(page)).toHaveText('The code was not broken');
      await expect(codeRow(page)).toHaveAccessibleName('Code');
    }
  });

  test('Race: if nobody breaks the code, nobody wins', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'race', code: CODE });
    await table.patch({ boards: { 1: { guesses: misses(9, 1), broken: false }, 2: { guesses: misses(9, 2), broken: false } } });
    await expect(row(alice, 9, 'Your guesses').locator('.cb-answer')).toHaveCount(1);
    await guess(alice, WRONG, 10, 'Your guesses');
    await expect(turn(alice)).toHaveText('Out of guesses. Waiting for the others');
    await expect(gameOver(alice)).toHaveCount(0);
    await guess(bob, WRONG, 10, "Bob's guesses");
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(status(page)).toHaveText('Nobody broke the code');
    }
  });

  test('Together: when a player leaves, the others play on', async ({ seat }) => {
    test.slow(); // three seats plus leave and dismiss flows
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await table.patch({ code: CODE });
    await guess(cara, WRONG, 1);
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(alice.locator('.presence-player[data-disconnected]')).toHaveCount(0);
    await expect(gameOver(alice)).toHaveCount(0);
    await expect(turn(alice)).toHaveText('Anyone can guess at any time');
    await guess(bob, WRONG, 2);
    await guess(alice, CODE, 3);
    for (const page of [alice, bob]) await expect(status(page)).toHaveText('Broken in 3 guesses!');
  });

  test('Race: a leaver\'s board is dropped, which can end the race', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'race', code: CODE });
    await guess(alice, WRONG, 1, 'Your guesses');
    await guess(alice, CODE, 2, 'Your guesses');
    await guess(bob, WRONG, 1, 'Your guesses');
    // Bob could still match Alice's 2, so the race waits for him until he is dismissed
    await expect(gameOver(alice)).toHaveCount(0);
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins, breaking the code in 2 guesses');
    await expect(gameOver(alice)).toBeVisible();
  });

  test('Classic: a spectator the maker allows sees the code', async ({ seat, browser, server }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await enter(alice, CODE, 'Set code');
    await guess(bob, WRONG, 1);
    const dana = await watch(browser, server, 'codebreaker', table.gameId, 'Dana');
    try {
      await expect(codeRow(dana)).toHaveAccessibleName('Code, hidden');
      await dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' }).click();
      await dana.getByRole('button', { name: "Ask to see Alice's hand" }).click();
      await expect(alice.getByText('Dana (watching) wants to see your hand')).toBeVisible();
      await alice.getByRole('button', { name: 'Allow', exact: true }).click();
      await expect(codeRow(dana)).toHaveAccessibleName('Code');
      await expectNames(codeRow(dana).getByRole('img'), CODE.map(name));
    } finally {
      await dana.context().close();
    }
  });

  test('Classic: the move descriptions, the game file and the pause file keep the code from the breaker mid-round', async ({ seat, server }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    const credentials: string[] = [];
    bob.on('request', request => {
      const auth = request.headers().authorization;
      if (request.url().includes('/api/history/') && auth) credentials.push(auth);
    });
    await enter(alice, CODE, 'Set code');
    await guess(bob, ['purple', 'yellow', 'orange', 'red'], 1);
    await bob.getByRole('button', { name: 'History' }).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    const move = history.locator('.history-move');
    await expect(move).toHaveText('Move 2 of 2: Bob guessed: 1 right place, 2 right color');
    await history.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(move).toHaveText('Move 1 of 2: Alice set a code');
    await expect(history.getByRole('group', { name: 'Code, hidden' })).toBeVisible();
    // The game file is offered only once the game is over, and the server refuses it before then
    await expect(history.getByRole('button', { name: 'Download game' })).toHaveCount(0);
    await history.getByRole('button', { name: 'Close' }).click();
    expect(credentials.length).toBeGreaterThan(0);
    const file = await bob.request.get(`${server.url}/api/game-file/codebreaker/${encodeURIComponent(table.gameId)}`, { headers: { authorization: credentials[0] } });
    expect(file.status()).toBe(409);
    expect(await file.text()).toContain('The game is not over yet');
    // Paused mid-round, the breaker's own pause file does not hold the code in the clear; the maker's does, in their hand,
    // which shows the checks below would see a leak
    await alice.locator('.game-header').getByRole('button', { name: 'Pause', exact: true }).click();
    await bob.getByRole('button', { name: 'Approve' }).click();
    type PauseFile = { seat: number; table: { code: unknown }; hand: { code: unknown }; history: { code: unknown }[] };
    const pauseFile = async (page: Page): Promise<{ text: string; file: PauseFile }> => {
      await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download my pause file' }).click();
      const text = await readFile(await (await downloading).path(), 'utf8');
      return { text, file: JSON.parse(text) as PauseFile };
    };
    const breaker = await pauseFile(bob);
    expect(breaker.file.seat).toBe(2);
    expect(breaker.file.table).toHaveProperty('code', null);
    expect(breaker.file.hand).toHaveProperty('code', null);
    expect(breaker.file.history.length).toBeGreaterThan(0);
    for (const step of breaker.file.history) expect(step).toHaveProperty('code', null);
    expect(breaker.text).not.toMatch(/"code":\s*\[/);
    const maker = await pauseFile(alice);
    expect(maker.file.seat).toBe(1);
    expect(maker.file.hand).toHaveProperty('code', CODE);
    expect(maker.text).toMatch(/"code":\s*\[/);
  });
});

test.describe('Code Breaker controls', () => {
  test('colors fill the first empty slot, a slot click empties it, Clear empties the row, and Submit waits for a full row', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice'], { code: CODE });
    await expect(button(alice, 'Submit guess')).toBeDisabled();
    await expect(button(alice, 'Clear')).toBeDisabled();
    for (const color of ['red', 'blue', 'green'] as Color[]) await colorButton(alice, color).click();
    await expectNames(draftSlots(alice), ['Slot 1: Red', 'Slot 2: Blue', 'Slot 3: Green', 'Slot 4: empty']);
    await expect(button(alice, 'Submit guess')).toBeDisabled();
    await draftSlots(alice).nth(1).click();
    await expect(draftSlots(alice).nth(1)).toHaveAccessibleName('Slot 2: empty');
    await colorButton(alice, 'yellow').click();
    await expect(draftSlots(alice).nth(1)).toHaveAccessibleName('Slot 2: Yellow');
    await colorButton(alice, 'orange').click();
    await expect(colorButton(alice, 'purple')).toBeDisabled();
    await expect(button(alice, 'Submit guess')).toBeEnabled();
    await button(alice, 'Clear').click();
    const empty = ['Slot 1: empty', 'Slot 2: empty', 'Slot 3: empty', 'Slot 4: empty'];
    await expectNames(draftSlots(alice), empty);
    // A guess that lands empties the row
    await guess(alice, WRONG, 1);
    await expectNames(draftSlots(alice), empty);
  });

  test('the Code rule of 5 pegs from 8 colors shows 5 slots, 8 colors and 5 pegs a row', async ({ seat }) => {
    const code: Color[] = ['pink', 'cyan', 'red', 'blue', 'green'];
    const { pages: [alice] } = await start(seat, ['Alice'], { codeRule: '5of8', code });
    await expect(draftSlots(alice)).toHaveCount(5);
    await expect(alice.getByRole('group', { name: 'Colors' }).getByRole('button')).toHaveCount(8);
    await expect(codeRow(alice).getByRole('img', { name: 'Hidden' })).toHaveCount(5);
    const pegs: Color[] = ['cyan', 'pink', 'red', 'red', 'red'];
    await guess(alice, pegs, 1);
    await expect(pegNames(alice, 1)).toHaveCount(5);
    await expect(answer(alice, 1)).toHaveAttribute('title', '1 right place, 2 right color');
    await guess(alice, code, 2);
    await expect(status(alice)).toHaveText('Broken in 2 guesses!');
  });

  test('Together with 5 pegs: the guesser name stays readable and the board fits, from phone to laptop widths', async ({ seat }) => {
    const code: Color[] = ['pink', 'cyan', 'red', 'blue', 'green'];
    const { pages: [alexandra] } = await start(seat, ['Alexandra', 'Bob'], { mode: 'together', codeRule: '5of8', code });
    await guess(alexandra, ['cyan', 'pink', 'red', 'red', 'red'], 1);
    const name = row(alexandra, 1).locator('.cb-guesser');
    await expect(name).toHaveAttribute('title', 'Alexandra');
    for (const width of [320, 390, 660, 1280]) {
      await alexandra.setViewportSize({ width, height: 800 });
      // The whole name shows, nothing is cut off, and the board stays inside its area and the page
      const fit = await name.evaluate(el => {
        const boardBox = el.closest('.cb-board')!.getBoundingClientRect();
        const area = el.closest('.cb-board-area')!.getBoundingClientRect();
        const page = document.documentElement;
        return {
          clipped: el.scrollWidth > el.clientWidth,
          inArea: boardBox.left >= area.left - 0.5 && boardBox.right <= area.right + 0.5,
          pageFits: page.scrollWidth <= page.clientWidth
        };
      });
      expect(fit, `at ${width}px`).toEqual({ clipped: false, inArea: true, pageFits: true });
    }
  });

  test('with Color-blind symbols on, every peg shows its shape', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice'], { code: CODE });
    await guess(alice, ['red', 'blue', 'green', 'yellow'], 1);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    await expect(board(alice).locator('.color-symbol')).toHaveCount(4);
    await expect(alice.getByRole('group', { name: 'Colors' }).locator('.color-symbol')).toHaveCount(6);
    await colorButton(alice, 'purple').click();
    await expect(alice.getByRole('group', { name: 'Your row' }).locator('.color-symbol')).toHaveCount(1);
    await setPreference(alice, 'Color-blind symbols', false);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
  });

  test('Solo: Undo takes back the last guess at once', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice'], { code: CODE });
    await guess(alice, WRONG, 1);
    await button(alice, 'Undo').click();
    await expect(board(alice).locator('.cb-answer')).toHaveCount(0);
    // The guess taken back does not come back into the row
    await expectNames(draftSlots(alice), ['Slot 1: empty', 'Slot 2: empty', 'Slot 3: empty', 'Slot 4: empty']);
    await guess(alice, CODE, 1);
    await expect(status(alice)).toHaveText('Broken in 1 guess!');
  });

  test('Classic: Undo takes back a guess once the other player approves', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await enter(alice, CODE, 'Set code');
    await guess(bob, WRONG, 1);
    await undo(bob, alice);
    for (const page of [alice, bob]) await expect(board(page).locator('.cb-answer')).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Your turn: break the code');
  });

  test('Together: Undo my last move takes back only your own latest guess, with no vote', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'together', code: CODE });
    await expect(button(alice, 'Undo my last move')).toBeDisabled();
    await guess(alice, WRONG, 1);
    await guess(bob, ['green', 'green', 'green', 'green'], 2);
    await button(alice, 'Undo my last move').click();
    for (const page of [alice, bob]) {
      await expect(board(page).locator('.cb-answer')).toHaveCount(1);
      await expect(row(page, 1).locator('.cb-guesser')).toHaveText('Bob');
    }
    await expect(bob.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(button(alice, 'Undo my last move')).toBeDisabled();
  });

  test('Race: Undo my last move takes back your own guess, but not once your board is finished', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'race', code: CODE });
    await guess(alice, WRONG, 1, 'Your guesses');
    await button(alice, 'Undo my last move').click();
    await expect(board(alice, 'Your guesses').locator('.cb-answer')).toHaveCount(0);
    // The guess taken back does not come back into the row
    await expectNames(draftSlots(alice), ['Slot 1: empty', 'Slot 2: empty', 'Slot 3: empty', 'Slot 4: empty']);
    await expect(bob.getByRole('list', { name: 'Race progress' })).toContainText('0 of 10');
    // Alice breaks it in 1; Bob has not guessed yet, so the race goes on, but her finished board cannot be undone
    await guess(alice, CODE, 1, 'Your guesses');
    await expect(turn(alice)).toHaveText('You broke the code. Waiting for the others');
    await expect(button(alice, 'Undo my last move')).toBeDisabled();
    await guess(bob, WRONG, 1, "Bob's guesses");
    await expect(gameOver(alice)).toBeVisible();
  });

  test('History during a Race shows no boards, only the progress', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { mode: 'race', code: CODE });
    await guess(alice, WRONG, 1, 'Your guesses');
    await guess(bob, ['purple', 'red', 'red', 'red'], 1, 'Your guesses');
    await alice.getByRole('button', { name: 'History' }).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await expect(history.getByRole('list', { name: 'Race progress' })).toBeVisible();
    await expect(history.getByRole('list', { name: 'Race progress' }).getByRole('listitem')).toHaveCount(2);
    await expect(history.getByRole('group', { name: /guesses/ })).toHaveCount(0);
    await expect(history.locator('.cb-answer')).toHaveCount(0);
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice']);
    const dialog = await openFaq(alice);
    await expect(dialog.getByText('What is the goal?')).toBeVisible();
    await expect(dialog.getByText('What do the answer pegs mean?')).toBeVisible();
  });
});
