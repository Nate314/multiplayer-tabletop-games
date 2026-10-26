import type { Locator, Page } from '@playwright/test';
import {
  agreeToHouseRules, dismiss, drag, expect, joinGame, leave, newPlayer, openFaq, test, touchDrag, undo, type Seat, type SeatOptions
} from './fixtures.ts';
import type { GameState } from '../games/pictionary/types.ts';

// One test per rule and control in games/pictionary/README.md. Alice (seat 1) draws first; Bob and Cara guess.
// Each table's first choices are xylophone, quokka and zeppelin, so a test knows the word.

const CHOICES = ['xylophone', 'quokka', 'zeppelin'];

const turn = (page: Page) => page.locator('.turn-message');
const status = (page: Page) => page.locator('.game-status');
const timer = (page: Page) => page.getByRole('timer', { name: 'Time left' });
const canvas = (page: Page) => page.getByRole('img', { name: 'Drawing' });
const choices = (page: Page) => page.getByRole('group', { name: 'Choose a word' }).getByRole('button');
const chatLines = (page: Page) => page.locator('.pictionary-chat .chat-line');
const points = (page: Page, name: string) => page.locator('.score-row', { hasText: name }).locator('.score-points');
const tool = (page: Page, name: string) => page.getByRole('toolbar', { name: 'Drawing tools' }).getByRole('button', { name, exact: true });

async function say(page: Page, text: string) {
  await page.locator('#pictionary-chat-input').fill(text);
  await page.locator('#pictionary-chat-input').press('Enter');
}

// Seats Alice, Bob and Cara with the known choices offered to Alice
async function seated(seat: Seat, options?: SeatOptions) {
  const table = await seat('pictionary', ['Alice', 'Bob', 'Cara'], options);
  await table.patch({ wordChoices: CHOICES, deck: ['apple', 'banana', 'castle', 'dragon', 'ladder', 'rocket'] });
  const [alice, bob, cara] = table.pages;
  await expect(choices(alice)).toHaveText(CHOICES);
  return { table, alice, bob, cara };
}

// Alice picks xylophone, and everyone sees her drawing
async function start(seat: Seat, options?: SeatOptions) {
  const seats = await seated(seat, options);
  const { alice, bob, cara } = seats;
  await choices(alice).filter({ hasText: 'xylophone' }).click();
  await expect(turn(alice)).toHaveText('Draw xylophone');
  for (const page of [bob, cara]) await expect(turn(page)).toHaveText('Alice is drawing');
  return seats;
}

// The canvas pixel at (x, y) in canvas units, as [r, g, b, a]
function pixel(locator: Locator, x: number, y: number) {
  return locator.evaluate((element, [px, py]) => Array.from((element as HTMLCanvasElement).getContext('2d')!.getImageData(px, py, 1, 1).data), [x, y]);
}

const isInked = async (locator: Locator, x: number, y: number) => (await pixel(locator, x, y)).slice(0, 3).some(channel => channel < 200);

test.describe('Pictionary rules', () => {
  test('the drawer picks one of the offered words', async ({ seat }) => {
    const { alice, bob } = await seated(seat);
    await expect(choices(alice)).toHaveCount(3);
    await expect(choices(bob)).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Alice is choosing a word');
    await choices(alice).filter({ hasText: 'quokka' }).click();
    await expect(turn(alice)).toHaveText('Draw quokka');
    await expect(choices(alice)).toHaveCount(0);
  });

  test('house rules offer more word choices', async ({ seat }) => {
    const { pages: [alice] } = await seat('pictionary', ['Alice', 'Bob', 'Cara'], { houseRules: { wordChoices: 5 } });
    await expect(choices(alice)).toHaveCount(5);
  });

  test('guessers see blanks with spaces and hyphens', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const blanks = bob.locator('.pictionary-blanks');
    await table.patch({ word: 'ice cream' });
    await expect(blanks.locator('.blank-letter')).toHaveCount(8);
    await expect(blanks.locator('.blank-word')).toHaveCount(2);
    await expect(blanks).toHaveAccessibleName('Word: 8 letters');
    await expect(alice.locator('.pictionary-blanks')).toHaveAccessibleName('Word: ice cream');
    await table.patch({ word: 't-shirt' });
    await expect(blanks.locator('.blank-hyphen')).toHaveCount(1);
    await expect(blanks.locator('.blank-letter')).toHaveCount(6);
    await expect(blanks.locator('.blank-word')).toHaveCount(1);
  });

  test('a correct guess shows "Bob guessed the word!" and scores', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'is it a xylophone?');
    for (const page of [alice, bob, cara]) {
      await expect(chatLines(page).filter({ hasText: 'Bob guessed the word!' })).toHaveCount(1);
      await expect(chatLines(page).filter({ hasText: 'xylophone' })).toHaveCount(0);
      await expect(points(page, 'Alice')).toHaveText('25');
    }
    expect(Number(await points(cara, 'Bob').textContent())).toBeGreaterThan(10);
    await expect(bob.locator('.pictionary-blanks')).toHaveAccessibleName('Word: xylophone');
  });

  test('one letter off shows "So close!" only to the guesser', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'xylophon');
    await expect(chatLines(bob).filter({ hasText: 'xylophon: So close!' })).toHaveCount(1);
    await say(cara, 'drums'); // a later line, so the close line would have arrived by now
    for (const page of [alice, cara]) {
      await expect(chatLines(page).filter({ hasText: 'Cara: drums' })).toHaveCount(1);
      await expect(chatLines(page).filter({ hasText: 'xylophon' })).toHaveCount(0);
    }
    await expect(points(bob, 'Bob')).toHaveText('0');
  });

  test('players who guessed chat only with each other', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await expect(alice.locator('#pictionary-chat-input')).toBeDisabled();
    await say(bob, 'xylophone');
    await say(bob, 'nice drawing');
    for (const page of [alice, bob]) {
      await expect(chatLines(page).filter({ hasText: 'Bob: nice drawing' })).toContainText('Only players who guessed can see this');
    }
    await say(cara, 'a piano?');
    for (const page of [alice, bob, cara]) await expect(chatLines(page).filter({ hasText: 'Cara: a piano?' })).toHaveCount(1);
    await expect(chatLines(cara).filter({ hasText: 'nice drawing' })).toHaveCount(0);
  });

  test('when everyone has guessed, the word is revealed and the next player draws', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'xylophone');
    await say(cara, 'xylophone');
    for (const page of [alice, bob, cara]) {
      await expect(chatLines(page).filter({ hasText: 'The word was xylophone' })).toHaveCount(1);
      await expect(turn(page)).toHaveText('The word was xylophone');
    }
    await expect(turn(bob)).toHaveText('Choose a word to draw', { timeout: 10_000 });
    await expect(choices(bob)).toHaveCount(3);
    await expect(turn(alice)).toHaveText('Bob is choosing a word');
  });

  test('when time runs out the word is revealed', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch({ phaseStartedAt: Date.now() - 89_500 });
    for (const page of [alice, bob, cara]) {
      await expect(chatLines(page).filter({ hasText: 'The word was xylophone' })).toHaveCount(1, { timeout: 2000 });
    }
    await expect(bob.locator('.pictionary-blanks')).toHaveAccessibleName('Word: xylophone');
  });

  test('the word never reaches a guesser before they guess', async ({ seat, browser, server }) => {
    test.slow(); // three hand-made joins and a History load
    // Bob joins by hand, so his page records from before he joins
    const table = await seat('pictionary', ['Alice'], { agree: false });
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames: string[] = [];
    const bodies: string[] = [];
    bob.on('websocket', ws => ws.on('framereceived', frame => frames.push(String(frame.payload))));
    bob.on('response', response => { if (response.url().includes('/api/')) response.text().then(text => bodies.push(text), () => {}); });
    await joinGame(bob, 'pictionary', table.gameId, 'Bob');
    const cara = await newPlayer(browser, server);
    await joinGame(cara, 'pictionary', table.gameId, 'Cara');
    for (const page of [alice, bob, cara]) await expect(page.locator('.house-rules-list li')).toHaveCount(3);
    await agreeToHouseRules(alice, bob, cara);
    await table.patch({ wordChoices: CHOICES });
    await expect(turn(bob)).toHaveText('Alice is choosing a word');
    await choices(alice).filter({ hasText: 'xylophone' }).click();
    await expect(turn(bob)).toHaveText('Alice is drawing');
    await drag(alice, canvas(alice), canvas(alice), { x: 20, y: 20 });
    await say(bob, 'xylophon');
    await expect(chatLines(bob).filter({ hasText: 'So close!' })).toHaveCount(1);
    await say(cara, 'xylophone');
    await expect(chatLines(bob).filter({ hasText: 'Cara guessed the word!' })).toHaveCount(1);
    await say(cara, 'what a xylophone');
    await expect(chatLines(alice).filter({ hasText: 'what a xylophone' })).toHaveCount(1);
    await bob.getByRole('button', { name: 'History' }).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-layout')).toBeVisible();
    await expect.poll(() => bodies.some(body => body.includes('Cara guessed'))).toBe(true);
    await history.getByRole('button', { name: 'Close' }).click();
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter(frame => frame.includes('xylophone'))).toEqual([]);
    expect(bodies.filter(body => body.includes('xylophone'))).toEqual([]);

    const before = frames.length;
    await say(bob, 'xylophone');
    await expect.poll(() => frames.slice(before).some(frame => frame.includes('xylophone'))).toBe(true);
    for (const page of [bob, cara]) await page.context().close();
  });

  test('drawing with the mouse reaches the others live', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await canvas(alice).scrollIntoViewIfNeeded();
    const box = (await canvas(alice).boundingBox())!;
    await alice.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
    await alice.mouse.down();
    await alice.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 10 });
    await expect.poll(() => isInked(canvas(bob), 400, 300), { timeout: 300 }).toBe(true);
    await alice.mouse.up();
    await expect.poll(() => isInked(canvas(bob), 590, 300)).toBe(true);
    await expect.poll(() => isInked(canvas(bob), 400, 100)).toBe(false);
  });

  test('drawing with a finger', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, { touch: true });
    await canvas(alice).scrollIntoViewIfNeeded();
    const scrolled = await alice.evaluate(() => window.scrollY);
    await touchDrag(alice, canvas(alice), tool(alice, 'Clear'));
    await expect.poll(async () => (await table.state<GameState>()).strokes.length).toBe(1);
    const [stroke] = (await table.state<GameState>()).strokes;
    expect(stroke.kind === 'line' && stroke.points.length).toBeGreaterThan(4);
    await expect.poll(() => isInked(canvas(bob), 400, 300)).toBe(true);
    expect(await alice.evaluate(() => window.scrollY)).toBe(scrolled);
  });

  test('colors, sizes, eraser, fill, undo and clear', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const strokes = async () => (await table.state<GameState>()).strokes;
    const line = (x: number) => drag(alice, canvas(alice), canvas(alice), { x, y: 40 });

    await tool(alice, 'Red').click();
    await tool(alice, 'Large').click();
    await line(30);
    await expect.poll(async () => (await strokes()).length).toBe(1);
    expect((await strokes())[0]).toMatchObject({ kind: 'line', tool: 'pen', color: 2, size: 2 });

    await tool(alice, 'Eraser').click();
    await expect(tool(alice, 'Eraser')).toHaveAttribute('aria-pressed', 'true');
    await line(60);
    await expect.poll(async () => (await strokes()).length).toBe(2);
    expect((await strokes())[1]).toMatchObject({ kind: 'line', tool: 'eraser', color: 1 });

    await tool(alice, 'Blue').click();
    await expect(tool(alice, 'Eraser')).toHaveAttribute('aria-pressed', 'false');
    await tool(alice, 'Fill').click();
    await canvas(alice).click({ position: { x: 10, y: 10 } });
    await expect.poll(async () => (await strokes()).length).toBe(3);
    expect((await strokes())[2]).toMatchObject({ kind: 'fill', color: 6 });
    await expect.poll(() => isInked(canvas(alice), 5, 5)).toBe(true);

    await tool(alice, 'Take back').click();
    await expect.poll(async () => (await strokes()).map(stroke => stroke.kind)).toEqual(['line', 'line']);
    await tool(alice, 'Clear').click();
    await expect.poll(async () => (await strokes()).length).toBe(0);
    await expect(tool(alice, 'Clear')).toBeDisabled();
  });

  test('each player draws three times, then the game ends', async ({ seat }) => {
    test.slow(); // waits out the 5 second reveal
    const { table, alice, bob, cara } = await start(seat);
    await table.patch({ drawer: 3, currentPlayer: 3, draws: { 1: 3, 2: 3, 3: 2 }, scores: { 1: 50, 2: 0, 3: 0 }, phaseStartedAt: Date.now() });
    await expect(turn(cara)).toHaveText('Draw xylophone');
    await say(alice, 'xylophone');
    await expect(chatLines(bob).filter({ hasText: 'Alice guessed the word!' })).toHaveCount(1);
    await say(bob, 'xylophone');
    await expect(turn(alice)).toHaveText('The word was xylophone');
    for (const page of [alice, bob, cara]) await expect(status(page)).toHaveText(/^Alice won with \d+ points$/, { timeout: 10_000 });
    await expect(turn(cara)).toHaveText('Game over');
  });

  test('History shows the finished drawing and who guessed', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await drag(alice, canvas(alice), canvas(alice), { x: 20, y: 20 });
    await expect.poll(() => isInked(canvas(bob), 400, 300)).toBe(true);
    await say(bob, 'xylophone');
    await say(cara, 'xylophone');
    await expect(turn(alice)).toHaveText('The word was xylophone');
    await alice.getByRole('button', { name: 'History' }).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-move')).toContainText('Everyone guessed it: xylophone');
    await expect(history.locator('.history-layout .score-row', { hasText: 'Bob' })).toContainText('guessed');
    await expect(history.locator('.history-layout .score-row', { hasText: 'Cara' })).toContainText('guessed');
    await expect.poll(() => isInked(history.getByRole('img', { name: 'Drawing' }), 400, 300)).toBe(true);
  });

  test('house rules set the time per turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, { houseRules: { turnSeconds: 60 } });
    // Checked against the server's start time, so a slow machine that shows the drawing late still sees a full minute
    const { phaseStartedAt } = await table.state<GameState>();
    for (const page of [alice, bob]) {
      await expect.poll(async () => {
        const [minutes, seconds] = (await timer(page).textContent())!.split(':').map(Number);
        return Math.abs(minutes * 60 + seconds - (60 - (Date.now() - phaseStartedAt!) / 1000));
      }).toBeLessThanOrEqual(2);
    }
  });

  test('undo takes back a scored guess', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'xylophone');
    await expect(points(alice, 'Bob')).not.toHaveText('0');
    await undo(alice, bob, cara);
    for (const page of [alice, bob, cara]) {
      await expect(points(page, 'Bob')).toHaveText('0');
      await expect(points(page, 'Alice')).toHaveText('0');
      await expect(chatLines(page).filter({ hasText: 'Bob guessed the word!' })).toHaveCount(0);
    }
    await expect(bob.locator('.pictionary-blanks')).toHaveAccessibleName('Word: 9 letters');
    await expect(bob.locator('.chat-label')).toHaveText('Guess');
  });

  test('the drawer leaving reveals the word', async ({ seat }) => {
    test.slow(); // waits out the 5 second reveal
    const { bob, cara, alice } = await start(seat);
    await leave(alice);
    await dismiss('Alice', bob, cara);
    for (const page of [bob, cara]) await expect(chatLines(page).filter({ hasText: 'The word was xylophone' })).toHaveCount(1);
    await expect(turn(bob)).toHaveText('Choose a word to draw', { timeout: 10_000 });
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await seated(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I draw?');
    await expect(faq).toContainText('What does "So close!" mean?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
