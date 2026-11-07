import type { Page } from '@playwright/test';
import { agreeToHouseRules, dismiss, expect, headerButton, inHouseRules, joinGame, leave, newPlayer, openFaq, test, type Seat, type SeatOptions, type Table } from './fixtures.ts';
import type { GameState } from '../games/categories/types.ts';

// One test per rule, control and difference in games/categories/README.md. Seat 1 is Alice, seat 2 Bob, seat 3 Cara.
// Each table is patched to the letter B and a known list, so a test knows which answers are valid.

const LIST = ['Animals', 'Fruits', 'Colors', 'Cities', 'Countries', 'Foods', 'Sports', 'Jobs', 'Toys', 'Tools', 'Boys names', 'Birds'];

const inputs = (page: Page) => page.locator('.answer-field input');
const field = (page: Page, category: string) => page.getByLabel(category, { exact: true });
const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
const answers = (page: Page) => page.getByRole('list', { name: 'Answers' });
const cell = (page: Page, category: string, name: string) =>
  page.locator('.review-row').filter({ has: page.getByRole('heading', { name: category, exact: true }) }).locator('.review-cell').filter({ hasText: name });
const tag = (page: Page, category: string, name: string) => cell(page, category, name).locator('.review-tag');
const points = (page: Page, name: string) => page.locator('.score-row', { hasText: name }).locator('.score-points');
const waiting = (page: Page) => page.locator('.review-continue span');
const about = (name: string, category: string) => `${name}'s answer for ${category}`;
const answerOf = async (table: Table, seat: number, index: number) => (await table.state<GameState>()).answers[seat]?.[index];

async function fill(page: Page, values: Record<string, string>) {
  for (const [category, text] of Object.entries(values)) await field(page, category).fill(text);
}

// Seats the players with letter B and LIST patched in; the next letters are C, D and E
async function seated(seat: Seat, names: string[], options?: SeatOptions) {
  const table = await seat('categories', names, options);
  await table.patch({ letter: 'B', list: LIST.slice(0, 12), letters: ['C', 'D', 'E'] });
  await expect(table.pages[0].getByLabel('Letter B', { exact: true })).toBeVisible();
  return table;
}

// Everyone types their answers and presses Done, which opens the review
async function review(table: Table, sheets: Record<string, string>[]) {
  for (const [i, page] of table.pages.entries()) {
    await fill(page, sheets[i] ?? {});
    await button(page, 'Done').click();
  }
  for (const page of table.pages) await expect(answers(page)).toBeVisible();
}

async function continueAll(pages: Page[]) {
  for (const page of pages) await button(page, 'Continue').click();
}

test.describe('Categories rules', () => {
  test('the letter and 12 inputs show, one per category', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    await expect(inputs(table.pages[0])).toHaveCount(12);
    await expect(field(table.pages[0], 'Fruits')).toBeVisible();
    await expect(table.pages[0].getByRole('timer', { name: 'Time left' })).toBeVisible();
    await expect(table.pages[0].getByText('Round 1 of 3')).toBeVisible();
  });

  test('Categories per list sets the number of categories', async ({ seat }) => {
    const table = await seat('categories', ['Alice', 'Bob'], { houseRules: { listSize: 8 } });
    await expect(inputs(table.pages[0])).toHaveCount(8);
  });

  test('Hard letters off leaves out Q, U, V, X, Y and Z, on puts them in', async ({ seat }) => {
    const dealt = async (table: Table) => { const s = await table.state<GameState>(); return [s.letter, ...s.letters]; };
    const easy = await dealt(await seat('categories', ['Alice', 'Bob']));
    expect(easy).toHaveLength(20);
    expect(easy.join('')).not.toMatch(/[QUVXYZ]/);
    const hard = await dealt(await seat('categories', ['Cara', 'Dan'], { houseRules: { hardLetters: true } }));
    expect(hard).toHaveLength(26);
    for (const letter of 'QUVXYZ') expect(hard).toContain(letter);
  });

  test('Time per round sets the clock', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob'], { houseRules: { roundSeconds: 60 } });
    await expect(table.pages[0].getByRole('timer', { name: 'Time left' })).toHaveText(/^(0:5\d|1:00)$/);
  });

  test('another page never shows my answers while answering', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await field(alice, 'Fruits').fill('Banana');
    await expect.poll(() => answerOf(table, 1, 1)).toBe('Banana');
    await expect(field(bob, 'Fruits')).toHaveValue('');
    await expect(bob.locator('body')).not.toContainText('Banana');
    await expect(answers(bob)).toHaveCount(0);
  });

  test('History during answering shows no answers', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await field(alice, 'Fruits').fill('Banana');
    await expect.poll(() => answerOf(table, 1, 1)).toBe('Banana');
    await (await headerButton(bob, 'History')).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-layout')).toBeVisible();
    await expect(history).not.toContainText('Banana');
    await expect(history.getByRole('list', { name: 'Answers' })).toHaveCount(0);
  });

  test('the frames a player receives while answering never hold another answer', async ({ seat, browser, server }) => {
    test.slow(); // a hand-made join with recorded frames
    const table = await seat('categories', ['Alice', 'Cara'], { agree: false });
    const bob = await newPlayer(browser, server);
    const frames: string[] = [];
    bob.on('websocket', ws => ws.on('framereceived', frame => frames.push(String(frame.payload))));
    try {
      await joinGame(bob, 'categories', table.gameId, 'Bob');
      const pages = [...table.pages, bob];
      for (const page of pages) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(3));
      await agreeToHouseRules(...pages);
      await expect(inputs(bob)).toHaveCount(12);
      await table.patch({ letter: 'B', list: LIST });
      await expect(field(table.pages[0], 'Fruits')).toBeVisible();
      await field(table.pages[0], 'Fruits').fill('Zzyzxberry');
      await expect.poll(() => answerOf(table, 1, 1)).toBe('Zzyzxberry');
      await field(bob, 'Foods').fill('Bagel');
      await expect.poll(() => answerOf(table, 3, 5)).toBe('Bagel');
      await (await headerButton(bob, 'History')).click();
      await expect(bob.getByRole('dialog', { name: 'History' }).locator('.history-layout')).toBeVisible();
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.filter(frame => frame.includes('Zzyzxberry'))).toEqual([]);
    } finally {
      await bob.context().close();
    }
  });

  test('everyone pressing Done opens the review', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await fill(alice, { Fruits: 'Banana' });
    await button(alice, 'Done').click();
    await expect(bob.getByText('Done: Alice')).toBeVisible();
    await expect(answers(bob)).toHaveCount(0);
    await fill(bob, { Animals: 'Bear' });
    await button(bob, 'Done').click();
    for (const page of table.pages) await expect(answers(page)).toBeVisible();
    await expect(cell(bob, 'Fruits', 'Alice')).toContainText('Banana');
    await expect(cell(alice, 'Animals', 'Bob')).toContainText('Bear');
  });

  test('the timer ending opens the review with the answer typed just before', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await field(alice, 'Fruits').fill('Banana');
    await table.patch({ phaseStartedAt: Date.now() - 119_500 });
    for (const page of table.pages) await expect(answers(page)).toBeVisible();
    await expect(cell(bob, 'Fruits', 'Alice')).toContainText('Banana');
  });

  test('a wrong-letter answer is tagged Wrong letter, and a leading article is skipped', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    await review(table, [{ Animals: 'Zebra', Fruits: 'the Banana' }, {}]);
    await expect(tag(table.pages[0], 'Animals', 'Alice')).toHaveText('Wrong letter');
    await expect(tag(table.pages[0], 'Fruits', 'Alice')).toHaveText('+1');
  });

  test('a banana and Banana are both Duplicate, and a unique answer scores 1', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob', 'Cara']);
    await review(table, [{ Fruits: 'a banana', Animals: 'Bear' }, { Fruits: 'Banana' }, { Fruits: 'Bananas' }]);
    const [alice] = table.pages;
    await expect(tag(alice, 'Fruits', 'Alice')).toHaveText('Duplicate');
    await expect(tag(alice, 'Fruits', 'Bob')).toHaveText('Duplicate');
    await expect(tag(alice, 'Fruits', 'Cara')).toHaveText('+1');
    await expect(tag(alice, 'Animals', 'Alice')).toHaveText('+1');
    await expect(alice.getByRole('list', { name: 'Points this round' })).toContainText('Alice: 1');
  });

  test('a challenge rejected by a majority, and a split kept', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob', 'Cara']);
    await review(table, [{ Animals: 'Bear', Colors: 'Blue' }, {}, {}]);
    const [alice, bob, cara] = table.pages;
    await expect(alice.getByRole('button', { name: `Challenge ${about('Alice', 'Animals')}` })).toHaveCount(0);
    await bob.getByRole('button', { name: `Challenge ${about('Alice', 'Animals')}` }).click();
    await expect(tag(cara, 'Animals', 'Alice')).toHaveText('Challenged');
    await expect(alice.getByRole('button', { name: /^(Keep|Reject) / })).toHaveCount(0);
    await cara.getByRole('button', { name: `Reject ${about('Alice', 'Animals')}` }).click();
    await expect(tag(alice, 'Animals', 'Alice')).toHaveText('Rejected');
    await bob.getByRole('button', { name: `Challenge ${about('Alice', 'Colors')}` }).click();
    await cara.getByRole('button', { name: `Keep ${about('Alice', 'Colors')}` }).click();
    await expect(tag(alice, 'Colors', 'Alice')).toHaveText('+1');
    await expect(alice.getByRole('list', { name: 'Points this round' })).toContainText('Alice: 1');
  });

  test('a challenge clears Continue', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob', 'Cara']);
    await review(table, [{ Animals: 'Bear' }, {}, {}]);
    const [alice, bob, cara] = table.pages;
    await continueAll([alice, bob]);
    await expect(waiting(alice)).toHaveText('Waiting for Cara');
    await cara.getByRole('button', { name: `Challenge ${about('Alice', 'Animals')}` }).click();
    await expect(button(alice, 'Continue')).toBeEnabled();
    await expect(button(bob, 'Continue')).toBeEnabled();
    await expect(waiting(alice)).toContainText('Bob');
    await bob.getByRole('button', { name: `Reject ${about('Alice', 'Animals')}` }).click();
    await expect(tag(alice, 'Animals', 'Alice')).toHaveText('Rejected');
    await continueAll([alice, bob, cara]);
    await expect(alice.getByText('Round 2 of 3')).toBeVisible();
  });

  test('Continue starts round 2 with a new letter and the scores added', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    await review(table, [{ Animals: 'Bear' }, {}]);
    await continueAll(table.pages);
    for (const page of table.pages) {
      await expect(page.getByLabel('Letter C', { exact: true })).toBeVisible();
      await expect(inputs(page)).toHaveCount(12);
      await expect(inputs(page).first()).toHaveValue('');
    }
    await expect(points(table.pages[1], 'Alice')).toHaveText('1');
  });

  test('Rounds 1 ends the game and the top total wins', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob', 'Cara'], { houseRules: { rounds: 1 } });
    await review(table, [{ Animals: 'Bear', Colors: 'Blue' }, { Fruits: 'Banana', Colors: 'Blue' }, { Fruits: 'Banana' }]);
    const [alice] = table.pages;
    await continueAll(table.pages);
    await expect(alice.getByText('Game over').first()).toBeVisible();
    await expect(points(alice, 'Alice')).toHaveText('1');
    await expect(points(alice, 'Bob')).toHaveText('0');
    await expect(alice.locator('.score-winner')).toHaveCount(1);
    await expect(alice.locator('.score-winner')).toContainText('Alice');
  });

  test('a dismissed player is dropped from the scoring', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob', 'Cara']);
    await review(table, [{ Fruits: 'Banana' }, {}, { Fruits: 'Banana' }]);
    const [alice, bob, cara] = table.pages;
    await expect(tag(alice, 'Fruits', 'Alice')).toHaveText('Duplicate');
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(tag(alice, 'Fruits', 'Alice')).toHaveText('+1');
    await expect(cell(alice, 'Fruits', 'Cara')).toHaveCount(0);
  });

  test('Undo is never offered', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    await review(table, [{ Animals: 'Bear' }, {}]);
    for (const page of table.pages) await expect(button(page, 'Undo')).toHaveCount(0);
  });

  test('tied top totals share the win', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob'], { houseRules: { rounds: 1 } });
    await review(table, [{ Animals: 'Bear' }, { Colors: 'Blue' }]);
    await continueAll(table.pages);
    await expect(table.pages[0].locator('.score-winner')).toHaveCount(2);
  });

  test('a leading article is skipped for the letter: The Tiger is valid for T, The Eagle is not', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    await table.patch({ letter: 'T' });
    await expect(table.pages[0].getByLabel('Letter T', { exact: true })).toBeVisible();
    await review(table, [{ Animals: 'The Tiger', Birds: 'The Eagle' }, {}]);
    await expect(tag(table.pages[0], 'Animals', 'Alice')).toHaveText('+1');
    await expect(tag(table.pages[0], 'Birds', 'Alice')).toHaveText('Wrong letter');
  });

  test('an answer is capped at 40 characters', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    const box = field(table.pages[0], 'Fruits');
    await expect(box).toHaveAttribute('maxlength', '40');
    await box.fill('B'.repeat(45));
    await expect(box).toHaveValue('B'.repeat(40));
    await expect.poll(() => answerOf(table, 1, 1)).toBe('B'.repeat(40));
  });

  test('no letter or category repeats in the next round', async ({ seat }) => {
    const table = await seat('categories', ['Alice', 'Bob']);
    const before = await table.state<GameState>();
    for (const page of table.pages) await button(page, 'Done').click();
    await continueAll(table.pages);
    await expect(table.pages[0].getByText('Round 2 of 3')).toBeVisible();
    const after = await table.state<GameState>();
    expect(after.letter).not.toBe(before.letter);
    expect(after.list.filter(category => before.list.includes(category))).toEqual([]);
  });

  test('the FAQ opens', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob']);
    const faq = await openFaq(table.pages[0]);
    await expect(faq).toContainText('How do I challenge an answer?');
  });

  test('the review fits at phone size', async ({ seat }) => {
    const table = await seated(seat, ['Alice', 'Bob', 'Cara'], { touch: true });
    await review(table, [{ Animals: 'Bear', Fruits: 'Banana' }, { Fruits: 'Banana', Colors: 'Blue' }, { Cities: 'Boston' }]);
    const alice = table.pages[0];
    await expect(button(alice, 'Continue')).toBeVisible();
    const { scroll, inner } = await alice.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(scroll).toBeLessThanOrEqual(inner);
    for (const control of await alice.locator('.review button').all()) {
      const box = await control.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(inner);
    }
  });
});
