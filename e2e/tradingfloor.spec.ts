import type { Locator, Page, WebSocketRoute } from '@playwright/test';
import { dismiss, expect, headerButton, inHouseRules, leave, openFaq, test, watch, type Seat, type SeatOptions } from './fixtures.ts';
import type { Card, GameState } from '../games/tradingfloor/types.ts';

// One test per rule, control and difference in games/tradingfloor/README.md. Seat 1 is Alice, 2 Bob, 3 Cara, 4 Dan.
// Three players play Saffron, Silver and Coffee: card ids 0 to 8, 9 to 17 and 18 to 26; with Bull and Bear, 27 is the Bull and 28 the Bear.

const run = (kind: Card['kind'], from: number, to: number): Card[] => Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i, kind }));
const BULL: Card = { id: 27, kind: 'bull' };
const BEAR: Card = { id: 28, kind: 'bear' };

// Nobody holds a corner
const MIXED = {
  1: [...run('saffron', 0, 4), ...run('silver', 9, 10), ...run('coffee', 18, 19)],
  2: [...run('saffron', 5, 6), ...run('silver', 11, 15), ...run('coffee', 20, 21)],
  3: [...run('saffron', 7, 8), ...run('silver', 16, 17), ...run('coffee', 22, 26)]
};
// Alice holds 8 Saffron and Bob the ninth
const NEAR = {
  1: [...run('saffron', 0, 7), ...run('silver', 9, 9)],
  2: [...run('saffron', 8, 8), ...run('silver', 10, 15), ...run('coffee', 20, 21)],
  3: [...run('silver', 16, 17), ...run('coffee', 18, 19), ...run('coffee', 22, 26)]
};
// Alice holds all 9 Saffron, and nobody else a corner
const CORNERED = {
  1: run('saffron', 0, 8),
  2: [...run('silver', 9, 13), ...run('coffee', 18, 21)],
  3: [...run('silver', 14, 17), ...run('coffee', 22, 26)]
};

async function start(seat: Seat, hands: object | null = MIXED, options?: SeatOptions, names = ['Alice', 'Bob', 'Cara']) {
  const table = await seat('tradingfloor', names, options);
  if (hands) await table.patch({ hands });
  const [alice, bob, cara] = table.pages;
  if (hands) for (const page of table.pages) await expect(myHand(page)).toHaveAccessibleName(/^Your hand/);
  return { table, pages: table.pages, alice, bob, cara };
}

const myHand = (page: Page) => page.getByRole('region', { name: /^Your hand/ });
const card = (page: Page, label: string) => myHand(page).getByRole('button', { name: label, exact: true });
const floor = (page: Page) => page.getByRole('region', { name: 'Trading floor' });
const bubbles = (page: Page) => floor(page).locator('.tf-bubble-text');
const seatRow = (page: Page, name: string) => floor(page).locator('.tf-seat', { has: page.locator('.tf-seat-name', { hasText: name }) });
const accept = (page: Page, name: string, count: number) => page.getByRole('button', { name: `Accept ${name}'s offer of ${count}`, exact: true });
const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
const status = (page: Page) => page.locator('.game-status');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Round scoring' });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const SAFFRON = 'Saffron 100';
const SILVER = 'Silver 85';
const COFFEE = 'Coffee 80';

// Clicks `count` unpicked cards named `label`, each on its left edge, the part the next card in the fan leaves showing
async function pick(page: Page, label: string, count = 1): Promise<void> {
  for (let i = 0; i < count; i++) {
    await myHand(page).getByRole('button', { name: label, exact: true, pressed: false }).first().click({ position: { x: 10, y: 42 } });
  }
}

// `page`, seated as `name`, offers the picks and waits for its offer to show
async function offer(page: Page, name: string, ...picks: [string, number][]): Promise<void> {
  for (const [label, count] of picks) await pick(page, label, count);
  const total = picks.reduce((sum, [, count]) => sum + count, 0);
  await button(page, `Offer ${total}`).click();
  await expect(bubbles(page).filter({ hasText: `${name}:` })).toHaveText(`${name}: ${total}!`);
}

async function holds(page: Page, counts: Record<string, number>): Promise<void> {
  for (const [label, count] of Object.entries(counts)) await expect(card(page, label)).toHaveCount(count);
}

test.describe('Trading Floor deal and house rules', () => {
  test('three players are each dealt 9 cards of Saffron, Silver and Coffee', async ({ seat }) => {
    const { table, alice } = await start(seat, null);
    const { hands } = await table.state<GameState>();
    const all = Object.values(hands).flatMap(hand => hand ?? []);
    expect(all.map(c => c.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 27 }, (_, i) => i));
    for (const kind of ['saffron', 'silver', 'coffee']) expect(all.filter(c => c.kind === kind)).toHaveLength(9);
    for (const hand of Object.values(hands)) expect(hand).toHaveLength(9);
    await expect(myHand(alice).getByRole('button')).toHaveCount(9);
    for (const name of ['Alice', 'Bob', 'Cara']) await expect(seatRow(alice, name).locator('.tf-seat-meta')).toHaveText('9 cards, 0 points');
    await expect(floor(alice).locator('.tf-heading')).toHaveText('First to 500 points wins');
  });

  test('four players add Cocoa', async ({ seat }) => {
    const { table } = await start(seat, null, undefined, ['Alice', 'Bob', 'Cara', 'Dan']);
    const kinds = new Set(Object.values((await table.state<GameState>()).hands).flatMap(hand => hand ?? []).map(c => c.kind));
    expect([...kinds].sort()).toEqual(['cocoa', 'coffee', 'saffron', 'silver']);
  });

  test('the house rules are Target score 500 or 250 and Bull and Bear, off', async ({ seat }) => {
    const { alice } = await start(seat, null);
    await inHouseRules(alice, async dialog => {
      const target = dialog.getByLabel('Target score', { exact: true });
      await expect(target.locator('option')).toHaveText(['250', '500']);
      await expect(target).toHaveValue('500');
      await expect(dialog.getByLabel('Bull and Bear', { exact: true })).not.toBeChecked();
    });
  });
});

test.describe('Trading Floor offers and swaps', () => {
  test('an offer shows only its count on the other pages', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await offer(alice, 'Alice', [SAFFRON, 2]);
    await expect(myHand(alice).locator('.tf-offered')).toHaveCount(2);
    for (const page of [bob, cara]) {
      await expect(bubbles(page)).toHaveText(['Alice: 2!']);
      await expect(status(page)).toHaveText('Alice offers 2!');
      await expect(floor(page)).not.toContainText(/Saffron|Silver|Coffee/);
    }
  });

  test('there is no bell: trading starts with the first offer', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    expect((await table.state<GameState>()).started).toBe(false);
    await expect(status(bob)).toHaveText('Cara joined (3/8 players)');
    await expect(button(bob, 'Corner!')).toBeVisible();
    await expect(bob.getByRole('button', { name: /bell|start/i })).toHaveCount(0);
    await offer(alice, 'Alice', [SAFFRON, 1]);
    await expect(status(bob)).toHaveText('Alice offers 1!');
    expect((await table.state<GameState>()).started).toBe(true);
  });

  test('an offer is 1 to 4 cards of one commodity', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(button(alice, 'Offer')).toBeDisabled();
    await expect(alice.locator('.tf-hint')).toHaveText('Pick 1 to 4 cards of one commodity to offer');
    await pick(alice, SAFFRON);
    await pick(alice, SILVER);
    await expect(alice.locator('.tf-hint')).toHaveText('Offer cards of one commodity');
    await expect(button(alice, 'Offer 2')).toBeDisabled();
    await card(alice, SILVER).and(alice.locator('[aria-pressed="true"]')).click({ position: { x: 10, y: 42 } });
    await pick(alice, SAFFRON, 3);
    await expect(alice.locator('.tf-hint')).toHaveText('Ready to offer 4');
    // A fifth card cannot be picked
    await expect(myHand(alice).getByRole('button', { pressed: false })).toHaveCount(5);
    for (const each of await myHand(alice).getByRole('button', { pressed: false }).all()) await expect(each).toBeDisabled();
    await expect(button(alice, 'Offer 4')).toBeEnabled();
  });

  test('Accept is enabled only with your own open offer of the same count', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await offer(alice, 'Alice', [SAFFRON, 2]);
    await expect(accept(alice, 'Alice', 2)).toHaveCount(0); // not on your own offer
    await expect(accept(bob, 'Alice', 2)).toBeDisabled();
    await offer(bob, 'Bob', [SILVER, 1]);
    await expect(accept(bob, 'Alice', 2)).toBeDisabled();
    await expect(accept(alice, 'Bob', 1)).toBeDisabled();
    await offer(bob, 'Bob', [SILVER, 2]);
    await expect(accept(bob, 'Alice', 2)).toBeEnabled();
    await expect(accept(alice, 'Bob', 2)).toBeEnabled();
  });

  test('a swap moves the cards blind on both pages', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await offer(alice, 'Alice', [SAFFRON, 2]);
    await offer(bob, 'Bob', [SILVER, 2]);
    await accept(bob, 'Alice', 2).click();
    for (const page of [alice, bob, cara]) {
      await expect(status(page)).toHaveText('Bob and Alice swapped 2 cards');
      await expect(bubbles(page)).toHaveCount(0);
    }
    await holds(alice, { [SAFFRON]: 3, [SILVER]: 4, [COFFEE]: 2 });
    await holds(bob, { [SAFFRON]: 4, [SILVER]: 3, [COFFEE]: 2 });
    await holds(cara, { [SAFFRON]: 2, [SILVER]: 2, [COFFEE]: 5 });
  });

  test('a new offer replaces your open one, and Withdraw takes it back', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(button(alice, 'Withdraw')).toBeDisabled();
    await offer(alice, 'Alice', [SAFFRON, 1]);
    await offer(alice, 'Alice', [COFFEE, 2]);
    await expect(bubbles(bob)).toHaveText(['Alice: 2!']);
    await button(alice, 'Withdraw').click();
    for (const page of [alice, bob]) await expect(bubbles(page)).toHaveCount(0);
    await expect(myHand(alice).locator('.tf-offered')).toHaveCount(0);
    await expect(button(alice, 'Withdraw')).toBeDisabled();
    await holds(alice, { [SAFFRON]: 5, [SILVER]: 2, [COFFEE]: 2 });
  });

  test('two accepts of one offer: the first swaps and the other sees Already taken and keeps its cards and offer', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await offer(alice, 'Alice', [SAFFRON, 2]); // the game has started, so a reload keeps Cara's seat
    // Cara's socket goes through a route that can hold the server's messages, so her page still shows Alice's offer
    // after Bob's swap, and her Accept reaches the server once the offer is gone
    let holding = false;
    const held: (string | Buffer)[] = [];
    let toCara: WebSocketRoute | undefined;
    await cara.routeWebSocket(/./, ws => {
      toCara = ws;
      ws.connectToServer().onMessage(message => { if (holding) held.push(message); else ws.send(message); });
    });
    await cara.reload();
    await expect(bubbles(cara)).toHaveText(['Alice: 2!']);
    await offer(bob, 'Bob', [SILVER, 2]);
    await offer(cara, 'Cara', [COFFEE, 2]);
    holding = true;
    await accept(bob, 'Alice', 2).click();
    await expect(status(alice)).toHaveText('Bob and Alice swapped 2 cards');
    await accept(cara, 'Alice', 2).click(); // still enabled: Cara has not heard of the swap
    await expect.poll(() => held.length).toBeGreaterThan(1); // the swap and the refusal of Cara's accept
    holding = false;
    for (const message of held.splice(0)) toCara!.send(message);
    await expect(status(cara)).toHaveText('Already taken');
    await expect(status(cara)).not.toHaveClass(/game-status-error/);
    await expect(bubbles(alice)).toHaveText(['Cara: 2!']);
    await holds(cara, { [SAFFRON]: 2, [SILVER]: 2, [COFFEE]: 5 });
    await expect(myHand(cara).locator('.tf-offered')).toHaveCount(2);
    // The quiet line gives way to the status after a few seconds
    await expect(status(cara)).toHaveText('Bob and Alice swapped 2 cards', { timeout: 6000 });
  });
});

test.describe('Trading Floor corners and rounds', () => {
  test('Corner! is disabled without a corner, and a corner ends the round with its scoring', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, NEAR);
    await expect(button(alice, 'Corner!')).toBeDisabled();
    await offer(alice, 'Alice', [SILVER, 1]);
    await offer(bob, 'Bob', [SAFFRON, 1]);
    await accept(alice, 'Bob', 1).click();
    await holds(alice, { [SAFFRON]: 9 });
    await offer(cara, 'Cara', [COFFEE, 1]);
    await button(alice, 'Corner!').click();
    for (const page of [alice, bob, cara]) {
      await expect(scoring(page)).toBeVisible();
      await expect(scoring(page).getByRole('heading')).toHaveText('Round 1 scoring');
      await expect(scoring(page).locator('.summary-result')).toHaveText('Alice cornered Saffron for 100 points');
      await expect(scoring(page).locator('.summary-winner')).toContainText('+100 for the corner');
      await expect(scoring(page).getByRole('region', { name: "Alice's corner" }).locator('.tf-hand-card')).toHaveCount(9);
      await expect(bubbles(page)).toHaveCount(0); // open offers are dropped
    }
    await expect(gameOver(alice)).toHaveCount(0);
  });

  test('a group of 9 fits at 320 px, in the hand and in the round summary', async ({ seat }) => {
    const { alice } = await start(seat, CORNERED);
    await alice.setViewportSize({ width: 320, height: 700 });
    const fits = (scope: Locator) => scope.locator('.tf-groups').evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    await expect(card(alice, SAFFRON).first()).toBeVisible();
    expect(await fits(myHand(alice))).toBe(true);
    await button(alice, 'Corner!').click();
    await expect(scoring(alice)).toBeVisible();
    expect(await fits(scoring(alice))).toBe(true);
  });

  test('Continue waits for everyone and then deals the next round', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, CORNERED);
    await button(alice, 'Corner!').click();
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice)).toContainText('Waiting for Bob, Cara');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await scoring(cara).getByRole('button', { name: 'Continue' }).click();
    for (const page of [alice, bob, cara]) {
      await expect(scoring(page)).toHaveCount(0);
      await expect(status(page)).toHaveText('Round 2: start trading!');
      await expect(myHand(page).getByRole('button')).toHaveCount(9);
    }
    await expect(seatRow(bob, 'Alice').locator('.tf-seat-meta')).toHaveText('9 cards, 100 points');
  });

  test('Target score 250 ends the game at 250', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, CORNERED, { houseRules: { targetScore: 250 } });
    await table.patch({ scores: { 1: 150, 2: 0, 3: 0 } });
    await expect(floor(alice).locator('.tf-heading')).toHaveText('First to 250 points wins');
    await button(alice, 'Corner!').click();
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(status(page)).toHaveText('Alice cornered Saffron for 100 points. Alice wins!');
    }
  });
});

test.describe('Trading Floor Bull and Bear', () => {
  const bullBear = { houseRules: { bullBear: true } };

  test('the Bull and the Bear join the deck, so two players get 10 cards', async ({ seat }) => {
    const { table, alice } = await start(seat, null, bullBear);
    const { hands } = await table.state<GameState>();
    expect(Object.values(hands).map(hand => hand?.length).sort()).toEqual([10, 10, 9]);
    const all = Object.values(hands).flatMap(hand => hand ?? []);
    expect(all.filter(c => c.kind === 'bull')).toHaveLength(1);
    expect(all.filter(c => c.kind === 'bear')).toHaveLength(1);
    await expect(floor(alice).locator('.tf-seat-meta', { hasText: '10 cards' })).toHaveCount(2);
  });

  test('the Bull or the Bear may be offered alone or ride along with one commodity', async ({ seat }) => {
    const { alice } = await start(seat, { 1: [...run('saffron', 0, 7), BULL], 2: [...run('silver', 9, 17), BEAR], 3: [...run('saffron', 8, 8), ...run('coffee', 18, 26)] }, bullBear);
    await pick(alice, 'Bull Wild');
    await expect(button(alice, 'Offer 1')).toBeEnabled();
    await pick(alice, SAFFRON, 3);
    await expect(button(alice, 'Offer 4')).toBeEnabled();
    await expect(myHand(alice).getByRole('button', { pressed: false }).first()).toBeDisabled(); // still at most 4
    await button(alice, 'Offer 4').click();
    await expect(myHand(alice).locator('.tf-offered')).toHaveCount(4);
  });

  test('8 plus the Bull corners, the Bear\'s holder cannot corner and loses 20', async ({ seat }) => {
    const { alice, bob } = await start(seat, {
      1: [...run('saffron', 0, 7), BULL, ...run('coffee', 18, 18)],
      2: [...run('silver', 9, 17), BEAR],
      3: [...run('saffron', 8, 8), ...run('coffee', 19, 26)]
    }, bullBear);
    await expect(button(bob, 'Corner!')).toBeDisabled(); // 9 Silver, but the Bear
    await button(alice, 'Corner!').click();
    await expect(scoring(bob).locator('.summary-result')).toHaveText('Alice cornered Saffron for 100 points');
    await expect(scoring(bob).locator('.summary-winner')).toContainText('100 points');
    await expect(scoring(bob).locator('.summary-seat', { hasText: 'Bob' })).toContainText('-20 points');
    await expect(scoring(bob).locator('.summary-seat', { hasText: 'Bob' })).toContainText('-20 for holding the Bull or Bear');
    await expect(scoring(bob).locator('.summary-seat', { hasText: 'Cara' })).toContainText('0 points');
  });

  test('all 9 plus the Bull corners for double', async ({ seat }) => {
    const { alice } = await start(seat, { 1: [...run('saffron', 0, 8), BULL], 2: [...run('silver', 9, 17), BEAR], 3: run('coffee', 18, 26) }, bullBear);
    await button(alice, 'Corner!').click();
    await expect(scoring(alice).locator('.summary-result')).toHaveText('Alice cornered Saffron with the Bull for 200 points');
    await expect(scoring(alice).locator('.summary-winner')).toContainText('+200 for the corner');
  });

  test('whoever holds the Bull without cornering loses 20, as does the Bear\'s holder', async ({ seat }) => {
    const { alice } = await start(seat, { 1: run('saffron', 0, 8), 2: [...run('silver', 9, 17), BULL], 3: [...run('coffee', 18, 26), BEAR] }, bullBear);
    await button(alice, 'Corner!').click();
    for (const name of ['Bob', 'Cara']) {
      await expect(scoring(alice).locator('.summary-seat', { hasText: name })).toContainText('-20 points-20 for holding the Bull or Bear');
    }
  });
});

test.describe('Trading Floor history, spectators, leaving and help', () => {
  test('History shows swaps and corners, but no offers and no hands', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, NEAR);
    await offer(cara, 'Cara', [COFFEE, 1]);
    await button(cara, 'Withdraw').click();
    await offer(alice, 'Alice', [SILVER, 1]);
    await offer(bob, 'Bob', [SAFFRON, 1]);
    await accept(alice, 'Bob', 1).click();
    await expect(status(alice)).toHaveText('Alice and Bob swapped 1 card');
    await button(alice, 'Corner!').click();
    for (const page of [alice, bob, cara]) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(status(alice)).toHaveText('Round 2: start trading!');
    await (await headerButton(alice, 'History')).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    const move = history.locator('.history-move');
    await expect(move).toHaveText('Move 2 of 2: Alice cornered Saffron for 100 points');
    await expect(history.locator('.tf-hand, .tf-card')).toHaveCount(0);
    await history.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(move).toHaveText('Move 1 of 2: Alice and Bob swapped 1 card');
    await expect(history.locator('.tf-seat-moved')).toHaveCount(2);
    await expect(history.locator('.tf-bubble')).toHaveCount(0);
    await expect(history.locator('.tf-hand, .tf-card')).toHaveCount(0);
    await expect(history).not.toContainText(/Saffron|Silver|Coffee/);
  });

  test('a spectator sees the counts and offers but no hand', async ({ seat, browser, server }) => {
    const { table, alice } = await start(seat);
    await offer(alice, 'Alice', [SAFFRON, 2]);
    const dana = await watch(browser, server, 'tradingfloor', table.gameId, 'Dana');
    try {
      await expect(bubbles(dana)).toHaveText(['Alice: 2!']);
      for (const name of ['Alice', 'Bob', 'Cara']) await expect(seatRow(dana, name).locator('.tf-seat-meta')).toHaveText('9 cards, 0 points');
      await expect(dana.locator('.tf-card')).toHaveCount(0);
      await expect(dana.getByRole('button', { name: /^Accept/ })).toHaveCount(0);
      expect(await dana.locator('body').innerText()).not.toMatch(/Saffron|Silver|Coffee/);
    } finally {
      await dana.context().close();
    }
  });

  test('a player leaving mid-round calls the round off and deals again for those left', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat, null, undefined, ['Alice', 'Bob', 'Cara', 'Dan']);
    await pick(alice, (await myHand(alice).getByRole('button').first().getAttribute('aria-label'))!);
    await button(alice, 'Offer 1').click();
    await expect(bubbles(bob)).toHaveText(['Alice: 1!']);
    await leave(dan);
    await dismiss('Dan', alice, bob, cara);
    await expect(status(alice)).toHaveText('Dan left, so round 2 is dealt for those left');
    await expect(floor(alice).locator('.tf-seat')).toHaveCount(3);
    await expect(bubbles(alice)).toHaveCount(0);
    for (const page of [alice, bob, cara]) await expect(myHand(page).getByRole('button')).toHaveCount(9);
    const kinds = new Set(Object.values((await table.state<GameState>()).hands).flatMap(hand => hand ?? []).map(c => c.kind));
    expect([...kinds].sort()).toEqual(['coffee', 'saffron', 'silver']);
  });

  test('below three players the game ends with the scores as they stand', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch({ scores: { 1: 100, 2: 0, 3: 0 } });
    await offer(alice, 'Alice', [SAFFRON, 1]);
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(gameOver(alice)).toBeVisible();
    await expect(status(bob)).toHaveText('Cara left. Alice wins!');
  });

  test('there is no Undo', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await offer(alice, 'Alice', [SAFFRON, 2]);
    await offer(bob, 'Bob', [SILVER, 2]);
    await accept(bob, 'Alice', 2).click();
    await expect(status(alice)).toHaveText('Bob and Alice swapped 2 cards');
    for (const page of [alice, bob]) await expect(page.getByRole('button', { name: /Undo/ })).toHaveCount(0);
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await start(seat, null);
    const dialog = await openFaq(alice);
    await expect(dialog.getByText('Whose turn is it?')).toBeVisible();
    await expect(dialog.getByText('What does "Already taken" mean?')).toBeVisible();
  });
});
