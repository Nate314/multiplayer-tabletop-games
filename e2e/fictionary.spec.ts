import type { Page } from '@playwright/test';
import { agreeToHouseRules, dismiss, expect, headerButton, inHouseRules, joinGame, leave, newPlayer, openFaq, type Seat, type SeatOptions, tableScreen, test } from './fixtures.ts';
import type { GameState } from '../games/fictionary/types.ts';

// One test per rule, control and difference in games/fictionary/README.md. Alice, Bob and Cara define quillon.

const QUILLON = { word: 'quillon', definition: 'either arm of the cross guard of a sword' };
const MATCH = 'Either arm of the cross guard of a swrd.'; // capitals, a full stop and one letter missing

const word = (page: Page) => page.locator('.fictionary-word');
const round = (page: Page) => page.locator('.fictionary-round');
const turn = (page: Page) => page.locator('.turn-message');
const status = (page: Page) => page.locator('.game-status');
const timer = (page: Page) => page.getByRole('timer', { name: 'Time left' });
const box = (page: Page) => page.locator('#fictionary-definition');
const choices = (page: Page) => page.getByRole('radiogroup', { name: 'Which is the real definition?' }).getByRole('radio');
const choice = (page: Page, text: string) => choices(page).filter({ hasText: text });
const reveal = (page: Page, n = 1) => page.getByRole('dialog', { name: `Round ${n} reveal` });
const row = (page: Page, text: string, n = 1) => reveal(page, n).locator('.fictionary-choice', { hasText: text });
const points = (page: Page, name: string) => page.locator('.fictionary-layout > .score-list .score-row', { hasText: name }).locator('.score-points');
const roundPoints = (page: Page, name: string, n = 1) => reveal(page, n).getByRole('list', { name: 'Points this word' }).locator('.score-row', { hasText: name });

async function write(page: Page, text: string) {
  await box(page).fill(text);
  await page.locator('.fictionary-write').getByRole('button').click();
}

// Seats Alice, Bob and Cara writing a definition of quillon
async function seated(seat: Seat, options?: SeatOptions) {
  const table = await seat('fictionary', ['Alice', 'Bob', 'Cara'], options);
  await table.patch(QUILLON);
  const [alice, bob, cara] = table.pages;
  for (const page of table.pages) await expect(word(page)).toHaveText('quillon');
  return { table, alice, bob, cara };
}

// Everyone writes, so voting starts; `texts` are Alice's, Bob's and Cara's
async function voting(seat: Seat, texts = ['a small bird', 'a pointed hat', 'a kind of soup'], options?: SeatOptions) {
  const seats = await seated(seat, options);
  const pages = [seats.alice, seats.bob, seats.cara];
  for (const [index, page] of pages.entries()) await write(page, texts[index]);
  await expect(status(seats.alice)).toHaveText(/^Vote for the real definition/);
  return seats;
}

test.describe('Fictionary rules', () => {
  test('every page shows the word, the round and the clock', async ({ seat }) => {
    const { alice, bob, cara } = await seated(seat);
    for (const page of [alice, bob, cara]) {
      await expect(round(page)).toContainText('Round 1 of 8');
      await expect(timer(page)).toBeVisible();
      await expect(turn(page)).toHaveText('Write a believable definition');
    }
  });

  test('a submitted definition is not on another page, and Update changes it', async ({ seat }) => {
    const { alice, bob } = await seated(seat);
    await write(alice, 'a small bird');
    await expect(alice.locator('.fictionary-own')).toHaveText('You wrote: a small bird');
    await expect(turn(alice)).toHaveText('Waiting for the others to write');
    await expect(bob.locator('.fictionary-progress')).toHaveText('Written: Alice');
    await expect(bob.locator('body')).not.toContainText('small bird');
    await expect(alice.locator('.fictionary-write').getByRole('button')).toHaveText('Update');
    await write(alice, 'a pointed hat');
    await expect(alice.locator('.fictionary-own')).toHaveText('You wrote: a pointed hat');
    await expect(bob.locator('body')).not.toContainText('pointed hat');
  });

  test('writing ends early when all three have written', async ({ seat }) => {
    const { alice, bob, cara } = await voting(seat);
    for (const page of [alice, bob, cara]) {
      await expect(choices(page)).toHaveCount(4);
      await expect(choice(page, QUILLON.definition)).toHaveCount(1);
      await expect(turn(page)).toHaveText('Click the definition you think is real');
    }
  });

  test('the writing deadline moves to voting, which lasts 60 seconds', async ({ seat }) => {
    const { table, alice, bob, cara } = await seated(seat);
    await write(alice, 'a small bird');
    await expect(bob.locator('.fictionary-progress')).toHaveText('Written: Alice');
    await table.patch({ phaseStartedAt: Date.now() - 119_500 });
    for (const page of [alice, bob, cara]) await expect(choices(page)).toHaveCount(2, { timeout: 2000 });
    const { phaseStartedAt } = await table.state<GameState>();
    await expect.poll(async () => {
      const [minutes, seconds] = (await timer(bob).textContent())!.split(':').map(Number);
      return Math.abs(minutes * 60 + seconds - (60 - (Date.now() - phaseStartedAt!) / 1000));
    }).toBeLessThanOrEqual(2);
    // The vote ends on its own deadline too, and nobody scores
    await table.patch({ phaseStartedAt: Date.now() - 59_500 });
    await expect(reveal(bob)).toBeVisible({ timeout: 2000 });
    await expect(roundPoints(bob, 'Alice')).toContainText('+0');
  });

  test('house rules set the writing time', async ({ seat }) => {
    const { table, alice } = await seated(seat, { houseRules: { writingSeconds: 60 } });
    const { phaseStartedAt } = await table.state<GameState>();
    await expect.poll(async () => {
      const [minutes, seconds] = (await timer(alice).textContent())!.split(':').map(Number);
      return Math.abs(minutes * 60 + seconds - (60 - (Date.now() - phaseStartedAt!) / 1000));
    }).toBeLessThanOrEqual(2);
  });

  test('your own choice is disabled and marked Yours, and a vote can be changed', async ({ seat }) => {
    const { alice, bob } = await voting(seat);
    await expect(choice(alice, 'a small bird')).toBeDisabled();
    await expect(choice(alice, 'a small bird')).toContainText('Yours');
    await expect(alice.locator('.fictionary-tag')).toHaveCount(1);
    await expect(choice(bob, 'a small bird')).toBeEnabled();
    await choice(alice, 'a pointed hat').click();
    await expect(choice(alice, 'a pointed hat')).toHaveAttribute('aria-checked', 'true');
    await choice(alice, QUILLON.definition).click();
    await expect(choice(alice, QUILLON.definition)).toHaveAttribute('aria-checked', 'true');
    await expect(choice(alice, 'a pointed hat')).toHaveAttribute('aria-checked', 'false');
    await expect(bob.locator('.fictionary-progress')).toHaveText('Voted: Alice');
  });

  test('a matched player sees the notice and no buttons, and their entry is not a choice', async ({ seat }) => {
    const { alice, bob, cara } = await voting(seat, ['a small bird', 'a pointed hat', MATCH]);
    await expect(cara.locator('.fictionary-own')).toHaveText('You wrote the real definition. Waiting for the votes.');
    await expect(choices(cara)).toHaveCount(0);
    for (const page of [alice, bob]) {
      await expect(choices(page)).toHaveCount(3);
      await expect(choice(page, 'swrd')).toHaveCount(0);
      await expect(status(page)).toHaveText('Vote for the real definition (Cara wrote the real one)');
    }
  });

  test('identical fakes show once, credited to both authors', async ({ seat }) => {
    const { alice, bob, cara } = await voting(seat, ['A small bird.', 'a  small bird', 'a pointed hat']);
    for (const page of [alice, bob, cara]) await expect(choices(page)).toHaveCount(3);
    await expect(choice(bob, 'small bird')).toBeDisabled();
    await expect(choice(alice, 'small bird')).toBeDisabled();
    await choice(alice, QUILLON.definition).click();
    await choice(bob, QUILLON.definition).click();
    await choice(cara, 'small bird').click();
    await expect(row(cara, 'small bird')).toContainText('Written by Alice, Bob');
    await expect(roundPoints(cara, 'Alice')).toContainText('+3');
    await expect(roundPoints(cara, 'Bob')).toContainText('+3');
    await expect(roundPoints(cara, 'Cara')).toContainText('+0');
  });

  test('votes score 2 for the real one, 1 to a fake\'s author, and 3 for writing the real one', async ({ seat }) => {
    const { alice, bob, cara } = await voting(seat, ['a small bird', 'a pointed hat', MATCH]);
    await choice(alice, QUILLON.definition).click();
    await choice(bob, 'a small bird').click();
    for (const page of [alice, bob, cara]) {
      await expect(roundPoints(page, 'Alice')).toContainText('+3'); // 2 for the vote, 1 from Bob
      await expect(roundPoints(page, 'Bob')).toContainText('+0');
      await expect(roundPoints(page, 'Cara')).toContainText('+3');
      await expect(row(page, QUILLON.definition)).toContainText('Real definition, also written by Cara');
    }
    await expect(points(alice, 'Alice')).toHaveText('3');
    await expect(points(alice, 'Cara')).toHaveText('3');
  });

  test('the reveal lists authors and voters, and Continue starts word 2', async ({ seat }) => {
    const { table, alice, bob, cara } = await voting(seat);
    await choice(alice, QUILLON.definition).click();
    await choice(bob, 'a small bird').click();
    await choice(cara, 'a pointed hat').click();
    for (const page of [alice, bob, cara]) {
      await expect(reveal(page).locator('.fictionary-real')).toContainText(QUILLON.definition);
      await expect(row(page, QUILLON.definition)).toContainText('Voted for by Alice');
      await expect(row(page, 'a small bird')).toContainText('Written by Alice');
      await expect(row(page, 'a small bird')).toContainText('Voted for by Bob');
      await expect(row(page, 'a pointed hat')).toContainText('Voted for by Cara');
      await expect(row(page, 'a kind of soup')).not.toContainText('Voted for');
    }
    await expect(status(alice)).toHaveText(`The real definition of quillon: ${QUILLON.definition}`);
    const { deck } = await table.state<GameState>();
    for (const page of [alice, bob]) await reveal(page).getByRole('button', { name: 'Continue' }).click();
    await expect(word(cara)).toHaveText('quillon');
    await reveal(cara).getByRole('button', { name: 'Continue' }).click();
    for (const page of [alice, bob, cara]) {
      await expect(word(page)).toHaveText(deck[1].word);
      await expect(round(page)).toContainText('Round 2 of 8');
      await expect(box(page)).toHaveValue('');
    }
  });

  test('Number of words 5 ends after word 5', async ({ seat }) => {
    const { table, alice, bob, cara } = await seated(seat, { houseRules: { wordCount: 5 } });
    await table.patch({ round: 5 });
    await expect(round(alice)).toContainText('Round 5 of 5');
    await write(alice, 'a small bird');
    await write(bob, 'a pointed hat');
    await write(cara, MATCH);
    await choice(alice, QUILLON.definition).click();
    await choice(bob, 'a small bird').click();
    for (const page of [alice, bob, cara]) {
      const over = page.getByRole('dialog', { name: 'Game over' });
      await expect(over).toBeVisible();
      await expect(over).toContainText('Round 5: quillon');
      await expect(status(page)).toHaveText('Alice and Cara won with 3 points');
    }
  });

  test('a vote nobody can lose is skipped: no fakes written', async ({ seat }) => {
    const { table, alice, bob } = await seated(seat);
    await table.patch({ phaseStartedAt: Date.now() - 119_500 });
    for (const page of [alice, bob]) {
      await expect(reveal(page)).toBeVisible({ timeout: 2000 });
      await expect(reveal(page).locator('.fictionary-choice')).toHaveCount(1);
    }
    await expect(choices(alice)).toHaveCount(0);
  });

  test('a vote nobody can lose is skipped: the only voters wrote the only fake', async ({ seat }) => {
    const { alice, bob, cara } = await seated(seat);
    await write(alice, 'a small bird');
    await write(bob, 'A small bird!');
    await write(cara, MATCH);
    for (const page of [alice, bob, cara]) {
      await expect(row(page, 'small bird')).toContainText('Written by Alice, Bob');
      await expect(roundPoints(page, 'Cara')).toContainText('+3');
    }
  });

  test('History during voting holds no author next to a choice and no real definition marked', async ({ seat }) => {
    const { alice, bob } = await voting(seat);
    for (const page of [alice, bob]) {
      await (await headerButton(page, 'History')).click();
      const history = page.getByRole('dialog', { name: 'History' });
      const listed = history.getByRole('list', { name: 'Definitions' }).getByRole('listitem');
      await expect(listed).toHaveCount(4);
      for (const name of ['Alice', 'Bob', 'Cara']) await expect(listed.filter({ hasText: name })).toHaveCount(0);
      for (const text of ['Real definition', 'Written by', 'Yours', 'You wrote', 'The real definition of']) await expect(history).not.toContainText(text);
      await expect(history.locator('.fictionary-real')).toHaveCount(0);
      await history.getByRole('button', { name: 'Close' }).click();
    }
  });

  test('a table screen during voting shows only the choice texts', async ({ seat }) => {
    const { table } = await voting(seat);
    const tv = await tableScreen(table);
    try {
      await expect(tv.locator('.fictionary-choice')).toHaveCount(4);
      for (const text of ['Real definition', 'Written by', 'Yours']) await expect(tv.locator('body')).not.toContainText(text);
      await expect(tv.locator('.fictionary-real')).toHaveCount(0);
    } finally {
      await tv.context().close();
    }
  });

  test('the frames a player receives hide the definition while writing and the authors while voting', async ({ seat, browser, server }) => {
    test.slow(); // three hand-made joins
    // Bob joins by hand, so his page records from before he joins
    const table = await seat('fictionary', ['Alice'], { agree: false });
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames: string[] = [];
    bob.on('websocket', ws => ws.on('framereceived', frame => frames.push(String(frame.payload))));
    await joinGame(bob, 'fictionary', table.gameId, 'Bob');
    const cara = await newPlayer(browser, server);
    await joinGame(cara, 'fictionary', table.gameId, 'Cara');
    for (const page of [alice, bob, cara]) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(3));
    await agreeToHouseRules(alice, bob, cara);
    await table.patch(QUILLON);
    await expect(word(bob)).toHaveText('quillon');
    await write(alice, 'a small bird');
    await write(bob, 'a pointed hat');
    await write(cara, 'a kind of soup');
    await expect(choices(bob)).toHaveCount(4);
    await choice(alice, QUILLON.definition).click();
    await expect(bob.locator('.fictionary-progress')).toHaveText('Voted: Alice');
    const writing = frames.filter(frame => frame.includes('"phase":"writing"') && frame.includes('quillon'));
    const vote = frames.filter(frame => frame.includes('"phase":"voting"'));
    expect(writing.length).toBeGreaterThan(0);
    expect(vote.length).toBeGreaterThan(0);
    expect(writing.filter(frame => frame.includes('cross guard'))).toEqual([]);
    for (const secret of ['"authors"', '"real"', '"submissions"']) expect(vote.filter(frame => frame.includes(secret))).toEqual([]);
    // Once everyone has voted the reveal carries the authors
    const before = frames.length;
    await choice(bob, QUILLON.definition).click();
    await choice(cara, QUILLON.definition).click();
    await expect.poll(() => frames.slice(before).some(frame => frame.includes('"real":true'))).toBe(true);
    for (const page of [bob, cara]) await page.context().close();
  });

  test('a dismissal that completes writing starts the vote', async ({ seat }) => {
    test.slow(); // four players
    const table = await seat('fictionary', ['Alice', 'Bob', 'Cara', 'Dana']);
    await table.patch(QUILLON);
    const [alice, bob, cara, dana] = table.pages;
    await write(alice, 'a small bird');
    await write(bob, 'a pointed hat');
    await write(dana, 'a sharp spoon');
    await expect(alice.locator('.fictionary-progress')).toHaveText('Written: Alice, Bob, Dana');
    await leave(cara);
    await dismiss('Cara', alice, bob, dana);
    for (const page of [alice, bob, dana]) await expect(choices(page)).toHaveCount(4, { timeout: 5000 });
  });

  test('dismissing a player down to two ends the game with the scores as they stand', async ({ seat }) => {
    const { alice, bob, cara } = await voting(seat);
    await choice(alice, QUILLON.definition).click();
    await expect(bob.locator('.fictionary-progress')).toHaveText('Voted: Alice');
    await leave(cara);
    await dismiss('Cara', alice, bob);
    for (const page of [alice, bob]) {
      await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();
      await expect(status(page)).toHaveText('Not enough players left: Alice and Bob won with 0 points');
      await expect(turn(page)).toHaveText('Game over');
    }
  });

  test('there is no undo', async ({ seat }) => {
    const { alice, bob } = await seated(seat);
    await write(alice, 'a small bird');
    await expect(bob.locator('.fictionary-progress')).toHaveText('Written: Alice');
    for (const page of [alice, bob]) await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await seated(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I write a definition?');
    await expect(faq).toContainText('What if I write the real definition?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
