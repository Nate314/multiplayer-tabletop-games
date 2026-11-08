import type { Page } from '@playwright/test';
import { agreeToHouseRules, dismiss, expect, headerButton, inHouseRules, joinGame, leave, newPlayer, openFaq, type Seat, type SeatOptions, tableScreen, test, undo, watch } from './fixtures.ts';
import type { GameState } from '../games/charades/types.ts';

// One test per rule, control and difference in games/charades/README.md. Alice (seat 1) acts first; Bob and Cara guess.
// Each table's first choices are juggling, riding a horse and blow-drying hair, so a test knows the prompt.

const CHOICES = ['juggling', 'riding a horse', 'blow-drying hair'];

const turn = (page: Page) => page.locator('.turn-message');
const status = (page: Page) => page.locator('.game-status');
const timer = (page: Page) => page.getByRole('timer', { name: 'Time left' });
const choices = (page: Page) => page.getByRole('group', { name: 'Choose a prompt' }).getByRole('button');
const card = (page: Page) => page.getByRole('status', { name: 'Your prompt' });
const blanks = (page: Page) => page.locator('.charades-blanks');
const input = (page: Page) => page.locator('#charades-chat-input');
const chatLines = (page: Page) => page.locator('.chat-line');
const points = (page: Page, name: string) => page.locator('.score-row', { hasText: name }).locator('.score-points');

async function say(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press('Enter');
}

// Seats Alice, Bob and Cara with the known choices offered to Alice
async function seated(seat: Seat, options?: SeatOptions) {
  const table = await seat('charades', ['Alice', 'Bob', 'Cara'], options);
  await table.patch({ wordChoices: CHOICES, deck: ['waving goodbye', 'swimming', 'skiing', 'yawning', 'sneezing', 'clapping'] });
  const [alice, bob, cara] = table.pages;
  await expect(choices(alice)).toHaveText(CHOICES);
  return { table, alice, bob, cara };
}

// Alice picks juggling, and everyone else guesses
async function start(seat: Seat, options?: SeatOptions) {
  const seats = await seated(seat, options);
  const { alice, bob, cara } = seats;
  await choices(alice).filter({ hasText: 'juggling' }).click();
  await expect(turn(alice)).toHaveText('Act out juggling');
  for (const page of [bob, cara]) await expect(turn(page)).toHaveText('Alice is acting');
  return seats;
}

test.describe('Charades rules', () => {
  test('the actor picks one of the offered prompts and guessers see none', async ({ seat }) => {
    const { alice, bob } = await seated(seat);
    await expect(choices(alice)).toHaveCount(3);
    await expect(choices(bob)).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Alice is choosing a prompt');
    await choices(alice).filter({ hasText: 'riding a horse' }).click();
    await expect(turn(alice)).toHaveText('Act out riding a horse');
    await expect(choices(alice)).toHaveCount(0);
  });

  test('house rules offer 5 prompt choices', async ({ seat }) => {
    const { pages: [alice] } = await seat('charades', ['Alice', 'Bob', 'Cara'], { houseRules: { promptChoices: 5 } });
    await expect(choices(alice)).toHaveCount(5);
  });

  test('the actor sees the prompt card, guessers see blanks with spaces and hyphens, and there is no video', async ({ seat }) => {
    const { alice, bob } = await seated(seat);
    await choices(alice).filter({ hasText: 'blow-drying hair' }).click();
    await expect(card(alice)).toHaveText('blow-drying hair');
    await expect(card(bob)).toHaveCount(0);
    await expect(blanks(bob)).toHaveAccessibleName('Prompt: 14 letters');
    await expect(blanks(bob).locator('.blank-letter')).toHaveCount(14);
    await expect(blanks(bob).locator('.blank-word')).toHaveCount(2);
    await expect(blanks(bob).locator('.blank-hyphen')).toHaveCount(1);
    await expect(blanks(bob)).not.toContainText('blow');
    for (const page of [alice, bob]) await expect(page.locator('video')).toHaveCount(0);
  });

  test('a correct guess shows "Bob guessed the prompt!" and scores', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'are you juggling?');
    for (const page of [alice, bob, cara]) {
      await expect(chatLines(page).filter({ hasText: 'Bob guessed the prompt!' })).toHaveCount(1);
      await expect(chatLines(page).filter({ hasText: 'juggling' })).toHaveCount(0);
      await expect(points(page, 'Alice')).toHaveText('25');
    }
    expect(Number(await points(cara, 'Bob').textContent())).toBeGreaterThan(10);
    await expect(blanks(bob)).toHaveAccessibleName('Prompt: juggling');
  });

  test('one letter off shows "So close!" only to the guesser', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'jugling');
    await expect(chatLines(bob).filter({ hasText: 'jugling: So close!' })).toHaveCount(1);
    await say(cara, 'dancing'); // a later line, so the close line would have arrived by now
    for (const page of [alice, cara]) {
      await expect(chatLines(page).filter({ hasText: 'Cara: dancing' })).toHaveCount(1);
      await expect(chatLines(page).filter({ hasText: 'jugling' })).toHaveCount(0);
    }
    await expect(points(bob, 'Bob')).toHaveText('0');
  });

  test('players who guessed chat only with each other', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'juggling');
    await say(bob, 'great acting');
    for (const page of [alice, bob]) {
      await expect(chatLines(page).filter({ hasText: 'Bob: great acting' })).toContainText('Only players who guessed can see this');
    }
    await say(cara, 'a clown?');
    for (const page of [alice, bob, cara]) await expect(chatLines(page).filter({ hasText: 'Cara: a clown?' })).toHaveCount(1);
    await expect(chatLines(cara).filter({ hasText: 'great acting' })).toHaveCount(0);
  });

  test('the actor cannot chat while acting', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(input(alice)).toBeDisabled();
    await expect(input(alice)).toHaveAttribute('placeholder', 'You are acting');
    await expect(input(bob)).toBeEnabled();
    await expect(bob.locator('.chat-label')).toHaveText('Guess');
  });

  test('when time runs out the prompt is revealed', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch({ phaseStartedAt: Date.now() - 89_500 });
    for (const page of [alice, bob, cara]) {
      await expect(chatLines(page).filter({ hasText: 'The prompt was juggling' })).toHaveCount(1, { timeout: 2000 });
    }
    await expect(blanks(bob)).toHaveAccessibleName('Prompt: juggling');
  });

  test('when everyone has guessed, the prompt is revealed and the next player chooses', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'juggling');
    await say(cara, 'juggling');
    for (const page of [alice, bob, cara]) {
      await expect(chatLines(page).filter({ hasText: 'The prompt was juggling' })).toHaveCount(1);
      await expect(turn(page)).toHaveText('The prompt was juggling');
    }
    await expect(turn(bob)).toHaveText('Choose a prompt to act', { timeout: 10_000 });
    await expect(choices(bob)).toHaveCount(3);
    await expect(turn(alice)).toHaveText('Bob is choosing a prompt');
  });

  test('a prompt is picked when the actor does not choose in time', async ({ seat }) => {
    test.slow(); // waits out the 5 second reveal
    const { table, alice, bob, cara } = await start(seat);
    await say(bob, 'juggling');
    await say(cara, 'juggling');
    await expect(turn(alice)).toHaveText('Bob is choosing a prompt', { timeout: 10_000 });
    // The first turn has no choosing clock, so the second turn is timed
    await table.patch({ phaseStartedAt: Date.now() - 19_500 });
    await expect(status(alice)).toHaveText('Bob ran out of time, so a prompt was chosen for them', { timeout: 2000 });
    await expect(turn(alice)).toHaveText('Bob is acting');
    await expect(card(bob)).toHaveText(/^(waving goodbye|swimming|skiing)$/);
  });

  test('house rules set the time per turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, { houseRules: { turnSeconds: 60 } });
    // Checked against the server's start time, so a slow machine that shows the acting late still sees a full minute
    const { phaseStartedAt } = await table.state<GameState>();
    for (const page of [alice, bob]) {
      await expect.poll(async () => {
        const [minutes, seconds] = (await timer(page).textContent())!.split(':').map(Number);
        return Math.abs(minutes * 60 + seconds - (60 - (Date.now() - phaseStartedAt!) / 1000));
      }).toBeLessThanOrEqual(2);
    }
  });

  test('each player acts three times, then the highest score wins', async ({ seat }) => {
    test.slow(); // waits out the 5 second reveal
    const { table, alice, bob, cara } = await start(seat);
    await table.patch({ drawer: 3, currentPlayer: 3, draws: { 1: 3, 2: 3, 3: 2 }, scores: { 1: 50, 2: 0, 3: 0 }, phaseStartedAt: Date.now() });
    await expect(turn(cara)).toHaveText('Act out juggling');
    await say(alice, 'juggling');
    await expect(chatLines(bob).filter({ hasText: 'Alice guessed the prompt!' })).toHaveCount(1);
    await say(bob, 'juggling');
    await expect(turn(alice)).toHaveText('The prompt was juggling');
    for (const page of [alice, bob, cara]) await expect(status(page)).toHaveText(/^Alice won with \d+ points$/, { timeout: 10_000 });
    await expect(turn(cara)).toHaveText('Game over');
  });

  test('undo takes back a scored guess', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'juggling');
    await expect(points(alice, 'Bob')).not.toHaveText('0');
    await undo(alice, bob, cara);
    for (const page of [alice, bob, cara]) {
      await expect(points(page, 'Bob')).toHaveText('0');
      await expect(points(page, 'Alice')).toHaveText('0');
      await expect(chatLines(page).filter({ hasText: 'Bob guessed the prompt!' })).toHaveCount(0);
    }
    await expect(blanks(bob)).toHaveAccessibleName('Prompt: 8 letters');
    await expect(bob.locator('.chat-label')).toHaveText('Guess');
  });

  test('dismissing the actor reveals the prompt', async ({ seat }) => {
    test.slow(); // waits out the 5 second reveal
    const { alice, bob, cara } = await start(seat);
    await leave(alice);
    await dismiss('Alice', bob, cara);
    for (const page of [bob, cara]) await expect(chatLines(page).filter({ hasText: 'The prompt was juggling' })).toHaveCount(1);
    await expect(turn(bob)).toHaveText('Choose a prompt to act', { timeout: 10_000 });
  });

  test('dismissing the last guesser ends the turn', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await say(bob, 'juggling');
    await leave(cara);
    await dismiss('Cara', alice, bob);
    for (const page of [alice, bob]) await expect(chatLines(page).filter({ hasText: 'The prompt was juggling' })).toHaveCount(1, { timeout: 5000 });
  });

  test('the last player left wins', async ({ seat }) => {
    const table = await seat('charades', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await table.patch({ wordChoices: CHOICES });
    await choices(alice).filter({ hasText: 'juggling' }).click(); // a move, so Bob keeps his seat when he leaves
    await expect(turn(bob)).toHaveText('Alice is acting');
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('a spectator sees the prompt and every line, a table screen only the blanks', async ({ seat, browser, server }) => {
    const { table, bob, cara } = await start(seat);
    await say(bob, 'jugling');
    await say(cara, 'juggling');
    await say(cara, 'well acted');
    await expect(chatLines(bob).filter({ hasText: 'Cara guessed the prompt!' })).toHaveCount(1);
    const dana = await watch(browser, server, 'charades', table.gameId, 'Dana');
    const tv = await tableScreen(table);
    try {
      await expect(blanks(dana)).toHaveAccessibleName('Prompt: juggling');
      await expect(chatLines(dana).filter({ hasText: 'jugling: So close!' })).toHaveCount(1);
      await expect(chatLines(dana).filter({ hasText: 'Cara: well acted' })).toHaveCount(1);
      await expect(blanks(tv)).toHaveAccessibleName('Prompt: 8 letters');
      await expect(chatLines(tv).filter({ hasText: 'Cara guessed the prompt!' })).toHaveCount(1);
      await expect(tv.locator('body')).not.toContainText('jugling');
      await expect(tv.locator('body')).not.toContainText('juggling');
    } finally {
      await dana.context().close();
      await tv.context().close();
    }
  });

  test('History during the acting holds no prompt', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    for (const page of [alice, bob]) {
      await (await headerButton(page, 'History')).click();
      const history = page.getByRole('dialog', { name: 'History' });
      await expect(history.locator('.history-move')).toContainText('Alice chose a prompt');
      await expect(history.locator('.charades-blanks')).toHaveAccessibleName('Prompt: 8 letters');
      for (const prompt of CHOICES) await expect(history).not.toContainText(prompt);
      await history.getByRole('button', { name: 'Close' }).click();
    }
  });

  test('the prompt never reaches a guesser before they guess', async ({ seat, browser, server }) => {
    test.slow(); // three hand-made joins
    // Bob joins by hand, so his page records from before he joins
    const table = await seat('charades', ['Alice'], { agree: false });
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames: string[] = [];
    bob.on('websocket', ws => ws.on('framereceived', frame => frames.push(String(frame.payload))));
    await joinGame(bob, 'charades', table.gameId, 'Bob');
    const cara = await newPlayer(browser, server);
    await joinGame(cara, 'charades', table.gameId, 'Cara');
    for (const page of [alice, bob, cara]) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(3));
    await agreeToHouseRules(alice, bob, cara);
    await table.patch({ wordChoices: CHOICES });
    await expect(turn(bob)).toHaveText('Alice is choosing a prompt');
    await choices(alice).filter({ hasText: 'juggling' }).click();
    await expect(turn(bob)).toHaveText('Alice is acting');
    await say(bob, 'jugling');
    await expect(chatLines(bob).filter({ hasText: 'So close!' })).toHaveCount(1);
    await say(cara, 'juggling');
    await expect(chatLines(bob).filter({ hasText: 'Cara guessed the prompt!' })).toHaveCount(1);
    await say(cara, 'what juggling');
    await expect(chatLines(alice).filter({ hasText: 'what juggling' })).toHaveCount(1);
    await say(bob, 'still guessing'); // a later frame, so Cara's line would have reached Bob by now
    await expect(chatLines(cara).filter({ hasText: 'Bob: still guessing' })).toHaveCount(1);
    expect(frames.length).toBeGreaterThan(0);
    for (const prompt of CHOICES) expect(frames.filter(frame => frame.includes(prompt))).toEqual([]);

    const before = frames.length;
    await say(bob, 'juggling');
    await expect.poll(() => frames.slice(before).some(frame => frame.includes('juggling'))).toBe(true);
    for (const page of [bob, cara]) await page.context().close();
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await seated(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I act?');
    await expect(faq).toContainText('What does "So close!" mean?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
