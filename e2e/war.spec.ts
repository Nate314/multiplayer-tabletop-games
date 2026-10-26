import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { dismiss, expect, joinGame, leave, newPlayer, openFaq, seeTable, test, undo, type Seat } from './fixtures.ts';
import { sameCard, standardDeck, type PlayingCard, type Rank, type Suit } from '../shared/playingCards.ts';
import type { GameState } from '../games/war/types.ts';

// One test per rule, control and difference in games/war/README.md. Seat 1 is Alice and seat 2 is Bob.
// Piles are given top card first, as the server keeps them.

const card = (rank: Rank, suit: Suit): PlayingCard => ({ rank, suit });

async function start(seat: Seat, motion = false) {
  const table = await seat('war', ['Alice', 'Bob'], { motion });
  const [alice, bob] = table.pages;
  // Crafts both piles and clears any battle on the table
  const piles = (mine: PlayingCard[], theirs: PlayingCard[]) =>
    table.patch({ piles: { 1: mine, 2: theirs }, battle: null, lastBattle: null, lastMove: null });
  return { table, alice, bob, piles };
}

const side = (page: Page, name: string) => page.getByRole('region', { name: `${name}'s side` });
const battleCards = (page: Page, name: string) => page.locator(`[aria-label="${name}'s battle cards"] .playing-card`);
const countOf = (page: Page, name: string) => side(page, name).locator('.war-seat-count');
const flipButton = (page: Page) => page.getByRole('button', { name: 'Flip', exact: true });
const flip = (page: Page) => flipButton(page).click();
const status = (page: Page) => page.locator('.game-status');
const summary = (page: Page) => page.locator('.war-summary');
// The names of a player's battle cards in order, face-down cards included
const battleNames = (page: Page, name: string) =>
  battleCards(page, name).evaluateAll(cards => cards.map(element => element.getAttribute('aria-label')));

// Flips for each page in turn, waiting each time until the status line describes the new flip
async function flips(...pages: Page[]) {
  for (const page of pages) {
    await expect(flipButton(page)).toBeEnabled();
    const before = await status(page).textContent();
    await flip(page);
    await expect(status(page)).not.toHaveText(before ?? '');
  }
}

test.describe('War rules', () => {
  test('the 52 cards are dealt 26 to each face-down pile, and nobody sees the order of any pile', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    for (const page of [alice, bob]) {
      await expect(countOf(page, 'Alice')).toHaveText('26 cards');
      await expect(countOf(page, 'Bob')).toHaveText('26 cards');
      // Only card backs: no face of any pile is on the page
      await expect(page.locator('.playing-card:not(.playing-card-back)')).toHaveCount(0);
      await expect(page.locator('.war-pile .playing-card-back')).toHaveCount(2);
    }
    const state = await table.state<GameState>();
    const dealt = [...state.piles[1], ...state.piles[2]];
    expect(dealt).toHaveLength(52);
    for (const wanted of standardDeck()) expect(dealt.filter(held => sameCard(held, wanted))).toHaveLength(1);
  });

  test('in a battle the higher card takes both, aces are high and suits do not matter', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles([card('K', 'spades'), card('7', 'spades')], [card('A', 'hearts'), card('7', 'hearts')]);
    await flips(alice, bob);
    await expect(status(alice)).toHaveText('Bob turned up the ace of hearts and wins the battle, taking 2 cards');
    await expect(countOf(alice, 'Bob')).toHaveText('3 cards');
    await expect(countOf(alice, 'Alice')).toHaveText('1 card');
    // Two sevens of different suits tie
    await flips(bob, alice);
    await expect(status(bob)).toHaveText('Alice turned up the 7 of spades: a tie, so it is war!');
  });

  test('each player flips their own card in turn, the second flip settles the battle and that player starts the next', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles([card('5', 'clubs'), card('9', 'clubs')], [card('3', 'hearts'), card('2', 'hearts')]);
    // Seat 1 flips first
    await expect(flipButton(alice)).toBeEnabled();
    await expect(flipButton(bob)).toBeDisabled();
    await flip(alice);
    await expect(battleCards(bob, 'Alice')).toHaveCount(1);
    await expect(summary(bob)).toHaveText('Battle under way');
    await expect(flipButton(alice)).toBeDisabled();
    await expect(flipButton(bob)).toBeEnabled();
    await flip(bob);
    await expect(summary(alice)).toHaveText('Alice won the battle and took 2 cards');
    // Bob flipped second, so Bob starts the next battle
    await expect(flipButton(bob)).toBeEnabled();
    await expect(flipButton(alice)).toBeDisabled();
    await expect(bob.locator('.turn-message')).toHaveText('Your turn: flip');
  });

  test('a tie is war: one flip puts in a face-down and a face-up card, and the higher face-up card takes every card', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles(
      [card('7', 'spades'), card('2', 'clubs'), card('Q', 'clubs'), card('4', 'hearts')],
      [card('7', 'hearts'), card('3', 'diamonds'), card('J', 'diamonds'), card('5', 'hearts')]
    );
    await flips(alice, bob);
    await expect(summary(alice)).toHaveText('War! One tie so far');
    // Bob flipped second in the tied round, so Bob starts the war
    await expect(flipButton(bob)).toBeEnabled();
    await expect(bob.locator('.turn-message')).toHaveText('Your turn: put in your war cards');
    await flip(bob);
    await expect.poll(() => battleNames(alice, 'Bob')).toEqual(['7 of hearts', 'face-down card', 'jack of diamonds']);
    await expect(countOf(alice, 'Bob')).toHaveText('1 card');
    await flip(alice);
    await expect(status(bob)).toHaveText('Alice put a card face down and turned up the queen of clubs and wins the war, taking 6 cards');
    await expect(countOf(bob, 'Alice')).toHaveText('7 cards');
    await expect(countOf(bob, 'Bob')).toHaveText('1 card');
  });

  test('another tie in a war is another war', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles(
      [card('7', 'spades'), card('2', 'clubs'), card('Q', 'clubs'), card('2', 'hearts'), card('9', 'hearts')],
      [card('7', 'hearts'), card('3', 'diamonds'), card('Q', 'diamonds'), card('4', 'spades'), card('8', 'hearts')]
    );
    await flips(alice, bob, bob, alice);
    await expect(summary(alice)).toHaveText('War! 2 ties so far');
    // Alice flipped second in the tied war, so she starts the next one
    await flips(alice, bob);
    await expect(status(alice)).toHaveText(/wins the war, taking 10 cards/);
  });

  test('running out in a war: a last card goes face up, no cards left keeps the last face-up card, and both out takes back their own', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles(
      [card('7', 'spades'), card('9', 'clubs')],
      [card('7', 'hearts'), card('2', 'diamonds'), card('9', 'hearts'), card('3', 'spades'), card('5', 'spades'), card('6', 'spades')]
    );
    await flips(alice, bob, bob, alice);
    // Alice's one card went face up, with no face-down card
    await expect.poll(() => battleNames(bob, 'Alice')).toEqual(['7 of spades', '9 of clubs']);
    await expect(status(bob)).toHaveText('Alice turned up the last card in the pile, the 9 of clubs: a tie, so it is war!');
    await expect(alice.locator('.turn-message')).toHaveText('Your turn: you have no cards left, so your last card stands. Click Flip');
    await flip(alice);
    await expect(status(bob)).toHaveText('Alice has no cards left, so the 9 of clubs stands');
    await flip(bob);
    await expect(status(alice)).toHaveText(/^Bob put a card face down and turned up the 5 of spades and Alice wins the war, taking 7 cards/);
    await expect(countOf(alice, 'Alice')).toHaveText('7 cards');
    await expect(countOf(alice, 'Bob')).toHaveText('1 card');

    const both = await start(seat);
    await both.piles([card('7', 'spades'), card('9', 'clubs')], [card('7', 'hearts'), card('9', 'hearts')]);
    await flips(both.alice, both.bob, both.bob, both.alice);
    await expect(status(both.bob)).toHaveText(/both players are out of cards, so each takes their own cards back$/);
    await expect(summary(both.bob)).toHaveText('Tied with no cards left: each player took their own cards back');
    await expect(countOf(both.bob, 'Alice')).toHaveText('2 cards');
    await expect(countOf(both.bob, 'Bob')).toHaveText('2 cards');
    await expect(flipButton(both.alice)).toBeEnabled(); // play goes on
  });

  test('won cards go under the winner\'s pile in random order', async ({ seat }) => {
    // The two cards won are shuffled with one random number: 0 swaps them, 0.99 leaves them
    for (const [random, top] of [[0, 'king of spades'], [0.99, 'ace of spades']] as const) {
      const { table, alice, bob, piles } = await start(seat);
      await piles([card('A', 'spades'), card('2', 'clubs')], [card('K', 'spades'), card('3', 'clubs')]);
      await flip(alice);
      await expect(flipButton(bob)).toBeEnabled();
      await table.random(random);
      await flip(bob);
      await expect(countOf(alice, 'Alice')).toHaveText('3 cards');
      // Alice's 2 of clubs is still on top, and the won cards are under it
      await flips(bob, alice);
      await expect(countOf(alice, 'Alice')).toHaveText('2 cards');
      await flip(alice);
      await expect(battleCards(bob, 'Alice')).toHaveAttribute('aria-label', top);
    }
  });

  test('a player with no cards left loses, and the player with all 52 cards wins', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    const rest = standardDeck().filter(held => !sameCard(held, card('A', 'spades')) && !sameCard(held, card('K', 'spades')));
    await piles([card('A', 'spades'), ...rest], [card('K', 'spades')]);
    await flips(alice, bob);
    await expect(status(bob)).toHaveText('Bob turned up the king of spades and Alice wins the battle, taking 2 cards. Alice has all 52 cards and wins!');
    await expect(bob.locator('.turn-message')).toHaveText('Game over: Alice wins');
    await expect(countOf(bob, 'Alice')).toHaveText('52 cards');
    await expect(countOf(bob, 'Bob')).toHaveText('0 cards');
    await expect(side(bob, 'Bob').getByLabel('Empty pile')).toBeVisible();
    await expect(flipButton(alice)).toBeDisabled();
    await expect(flipButton(bob)).toBeDisabled();
  });

  test('face-down war cards stay hidden on the table, in History and in the saved game file, while counts and face-up cards show', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    const hidden = [card('2', 'clubs'), card('3', 'diamonds'), card('2', 'hearts'), card('4', 'spades')];
    const hiddenNames = ['2 of clubs', '3 of diamonds', '2 of hearts', '4 of spades'];
    await piles(
      [card('7', 'spades'), hidden[0], card('Q', 'clubs'), hidden[2], card('9', 'hearts')],
      [card('7', 'hearts'), hidden[1], card('Q', 'diamonds'), hidden[3], card('8', 'hearts')]
    );
    await flips(alice, bob, bob, alice);
    for (const page of [alice, bob]) {
      await expect.poll(() => battleNames(page, 'Alice')).toEqual(['7 of spades', 'face-down card', 'queen of clubs']);
      await expect.poll(() => battleNames(page, 'Bob')).toEqual(['7 of hearts', 'face-down card', 'queen of diamonds']);
      await expect(countOf(page, 'Alice')).toHaveText('2 cards');
      await expect(countOf(page, 'Bob')).toHaveText('2 cards');
    }
    await flips(alice, bob); // Alice wins the second war, and Bob is out of cards
    await expect(alice.locator('.turn-message')).toHaveText('Game over: Alice wins');

    await seeTable(alice);
    await alice.getByRole('button', { name: 'History' }).click();
    const dialog = alice.getByRole('dialog', { name: 'History' });
    const slider = dialog.getByRole('slider', { name: 'Step' });
    const steps = Number(await slider.getAttribute('max'));
    expect(steps).toBe(6);
    for (let step = 0; step <= steps; step++) {
      await slider.fill(String(step));
      await expect(dialog.locator('.history-move')).toHaveText(step === 0 ? 'Start of the game' : new RegExp(`^Move ${step} of 6`));
      for (const name of hiddenNames) await expect(dialog.getByRole('img', { name, exact: true })).toHaveCount(0);
    }
    await expect(dialog.getByRole('img', { name: 'face-down card' }).first()).toBeVisible();

    const downloading = alice.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download game' }).click();
    const download = await downloading;
    const file: unknown = JSON.parse(await readFile(await download.path(), 'utf8'));
    // Every card anywhere in the file
    const cards: PlayingCard[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.rank === 'string' && typeof record.suit === 'string') cards.push(record as PlayingCard);
        Object.values(record).forEach(walk);
      }
    };
    walk(file);
    expect(cards.some(held => sameCard(held, card('Q', 'clubs')))).toBe(true);
    for (const secret of hidden) expect(cards.filter(held => sameCard(held, secret))).toEqual([]);
  });

  test('a dismissed player loses, and the other player wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await flip(alice);
    await expect(flipButton(bob)).toBeEnabled();
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
    await expect(alice.locator('.turn-message')).toHaveText('Game over: Alice wins');
  });

  test('either player can ask to undo the last flip, and it is undone only if both approve', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles([card('5', 'clubs'), card('9', 'clubs')], [card('3', 'hearts'), card('2', 'hearts')]);
    await flip(alice);
    await expect(battleCards(bob, 'Alice')).toHaveCount(1);

    await bob.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Decline' }).click();
    await expect(battleCards(bob, 'Alice')).toHaveCount(1);
    await expect(countOf(bob, 'Alice')).toHaveText('1 card');

    await undo(alice, bob);
    await expect(status(alice)).toHaveText('Last turn undone');
    await expect(battleCards(alice, 'Alice')).toHaveCount(0);
    await expect(countOf(alice, 'Alice')).toHaveText('2 cards');
    await expect(flipButton(alice)).toBeEnabled();
  });
});

test.describe('War controls', () => {
  test('on your turn, click Flip or click your own pile at the bottom of the table', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    // Your own side is the last one, under the summary; only your own pile is a button, and only on your turn
    await expect(alice.locator('.war-seat').last()).toHaveAttribute('aria-label', "Alice's side");
    await expect(bob.locator('.war-seat').last()).toHaveAttribute('aria-label', "Bob's side");
    await expect(side(alice, 'Bob').getByRole('button')).toHaveCount(0);
    await expect(side(bob, 'Bob').getByRole('button')).toHaveCount(0);
    await side(alice, 'Alice').getByRole('button', { name: 'face-down card' }).click();
    await expect(battleCards(bob, 'Alice')).toHaveCount(1);
    await flip(bob);
    await expect(battleCards(alice, 'Bob')).toHaveCount(1);
    await expect(countOf(alice, 'Bob')).not.toHaveText('26 cards');
  });

  test('Auto-flip flips your card one second after your turn comes up, only in your own tab, and is off after a reload', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    const auto = (page: Page) => page.getByRole('checkbox', { name: 'Auto-flip' });
    await auto(bob).check();
    const flippedAt = Date.now();
    await flip(alice);
    // Bob never clicks: his card turns up on its own, and as he flipped second he starts the next battle too
    await expect(battleCards(alice, 'Bob')).toHaveCount(1, { timeout: 10000 });
    expect(Date.now() - flippedAt).toBeGreaterThanOrEqual(1000);
    await expect(status(alice)).toHaveText(/^Bob turned up/);
    await expect(flipButton(alice)).toBeEnabled({ timeout: 10000 });
    // Alice's tab has its own setting, so her turn waits for her
    await expect(auto(alice)).not.toBeChecked();
    await expect(flipButton(alice)).toBeEnabled();

    await bob.reload();
    await expect(bob.getByRole('button', { name: 'Back to games' })).toBeVisible();
    await expect(auto(bob)).not.toBeChecked();
  });

  test('the table shows piles, counts and battle cards in order, then the highlighted winner until the next flip, and outlines the current player', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles(
      [card('7', 'spades'), card('2', 'clubs'), card('Q', 'clubs'), card('4', 'hearts')],
      [card('7', 'hearts'), card('3', 'diamonds'), card('J', 'diamonds'), card('5', 'hearts')]
    );
    await expect(side(bob, 'Alice')).toHaveClass(/war-seat-current/);
    await expect(side(bob, 'Bob')).not.toHaveClass(/war-seat-current/);
    await expect(countOf(bob, 'Alice')).toHaveText('4 cards');
    await flips(alice, bob, bob, alice);
    // War cards face down, then face up
    await expect.poll(() => battleNames(bob, 'Alice')).toEqual(['7 of spades', 'face-down card', 'queen of clubs']);
    await expect(battleCards(bob, 'Alice').nth(1)).toHaveClass(/playing-card-back/);
    // The cards stay on the table after the battle, with Alice's side highlighted
    await expect(side(bob, 'Alice')).toHaveClass(/war-seat-winner/);
    await expect(side(bob, 'Bob')).not.toHaveClass(/war-seat-winner/);
    await expect(summary(bob)).toHaveText('Alice won the war and took 6 cards');
    await expect(side(bob, 'Alice')).toHaveClass(/war-seat-current/);
    // The next flip clears them
    await flip(alice);
    await expect(battleCards(bob, 'Bob')).toHaveCount(0);
    await expect(battleCards(bob, 'Alice')).toHaveCount(1);
    await expect(side(bob, 'Alice')).not.toHaveClass(/war-seat-winner/);
    await expect(side(bob, 'Bob')).toHaveClass(/war-seat-current/);
    const borders = await bob.evaluate(() => [...document.querySelectorAll('.war-seat')].map(element => getComputedStyle(element).borderTopColor));
    expect(borders[0]).not.toEqual(borders[1]);
  });

  test('clicking Undo asks the other player to undo the last flip', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await flip(alice);
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('History steps through every flip, and FAQ shows the rules and controls', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles([card('5', 'clubs'), card('9', 'clubs')], [card('3', 'hearts'), card('2', 'hearts')]);
    await flips(alice, bob);
    await alice.getByRole('button', { name: 'History' }).click();
    const dialog = alice.getByRole('dialog', { name: 'History' });
    await expect(dialog.locator('.history-move')).toHaveText('Move 2 of 2: Bob turned up the 3 of hearts and Alice wins the battle, taking 2 cards');
    await dialog.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(dialog.locator('.history-move')).toHaveText('Move 1 of 2: Alice turned up the 5 of clubs');
    await expect(dialog.getByRole('img', { name: '5 of clubs' })).toBeVisible();
    await dialog.getByRole('slider', { name: 'Step' }).fill('0');
    await expect(dialog.locator('.history-move')).toHaveText('Start of the game');
    await dialog.getByRole('button', { name: 'Close' }).click();

    const faq = await openFaq(alice);
    await expect(faq).toContainText('Auto-flip');
    await expect(faq).toContainText('Click Flip, or click your own pile');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });

  test('a flip slides the card from the pile, and nothing animates with reduced motion', async ({ seat }) => {
    const animated = await start(seat, true);
    await flip(animated.alice);
    await expect.poll(() => animated.bob.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);

    const still = await start(seat);
    await flip(still.alice);
    await expect(battleCards(still.bob, 'Alice')).toHaveCount(1);
    expect(await still.bob.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe('War differences from Wikipedia', () => {
  test('players flip one after the other rather than at once, and the battle settles on the second flip', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await flip(alice);
    await expect(summary(bob)).toHaveText('Battle under way');
    await expect(battleCards(bob, 'Bob')).toHaveCount(0);
    await flip(bob);
    await expect(summary(alice)).toHaveText(/won the battle and took 2 cards|War! One tie so far/);
  });

  test('out of cards in a war, the last card stands; both out on a tie take their own cards back', async ({ seat }) => {
    const { alice, bob, piles } = await start(seat);
    await piles([card('7', 'spades'), card('9', 'clubs')], [card('7', 'hearts'), card('9', 'hearts')]);
    await flips(alice, bob, bob, alice);
    await expect(summary(alice)).toHaveText('Tied with no cards left: each player took their own cards back');

    const stands = await start(seat);
    await stands.piles([card('7', 'spades'), card('9', 'clubs')], [card('7', 'hearts'), card('2', 'diamonds'), card('9', 'hearts'), card('3', 'spades'), card('5', 'spades')]);
    await flips(stands.alice, stands.bob, stands.bob, stands.alice, stands.alice);
    await expect(status(stands.bob)).toHaveText('Alice has no cards left, so the 9 of clubs stands');
  });

  test('won cards go under the winner\'s pile in random order, not a fixed one', async ({ seat }) => {
    const { table, alice, bob, piles } = await start(seat);
    await piles([card('A', 'spades'), card('2', 'clubs')], [card('K', 'spades'), card('3', 'clubs')]);
    await flip(alice);
    await expect(flipButton(bob)).toBeEnabled();
    await table.random(0);
    await flip(bob);
    await expect(countOf(alice, 'Alice')).toHaveText('3 cards');
    const state = await table.state<GameState>();
    // Taken as Alice's ace then Bob's king, the shuffle put the king first
    expect(state.piles[1]).toEqual([card('2', 'clubs'), card('K', 'spades'), card('A', 'spades')]);
  });

  test('the game is for two players only', async ({ seat, browser, server }) => {
    const { table } = await start(seat);
    const third = await newPlayer(browser, server);
    try {
      await expect(joinGame(third, 'war', table.gameId, 'Cara')).rejects.toThrow();
      await expect(third.locator('.lobby-error')).toHaveText('Game is full');
    } finally {
      await third.context().close();
    }
  });

  test('Auto-flip only flips your own card', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await alice.getByRole('checkbox', { name: 'Auto-flip' }).check();
    await expect(battleCards(bob, 'Alice')).toHaveCount(1, { timeout: 10000 });
    // Bob's card waits for Bob
    await expect(flipButton(bob)).toBeEnabled();
    await expect(battleCards(alice, 'Bob')).toHaveCount(0);
    await flip(bob);
    await expect(battleCards(alice, 'Bob')).toHaveCount(1);
  });

  test('a dismissed player loses', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await flip(alice);
    await expect(flipButton(bob)).toBeEnabled();
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(alice.locator('.turn-message')).toHaveText('Game over: Alice wins');
    await expect(side(alice, 'Alice')).toHaveClass(/war-seat-winner/);
  });
});
