import type { Locator, Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat, type Table } from './fixtures.ts';
import { CARDS, GEMS, NOBLES } from '../games/splendor/cards.ts';
import type { GameState, Gem, Level, PlayerState, Reserved, Token, Tokens } from '../games/splendor/types.ts';

// One test per rule and control in games/splendor/README.md. Seats are filled in join order: Alice is seat 1, Bob 2,
// Cara 3 and Dan 4. Card ids are places in the published list in games/splendor/cards.ts: level 1 is 0-39, level 2
// 40-69 and level 3 70-89. Tests lay out the market, the nobles and each player's holdings so the numbers are known.

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];
const LEVELS: Level[] = [1, 2, 3];

function tokens(partial: Partial<Tokens> = {}): Tokens {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0, ...partial };
}

function player(change: Partial<PlayerState> = {}): PlayerState {
  return { tokens: tokens(), cards: [], reserved: [], nobles: [], ...change };
}

const faceUp = (...cards: number[]): Reserved[] => cards.map(card => ({ card, fromDeck: false }));

// Every seat of a `count` player game, with the given holdings
function players(count: number, holdings: Record<number, Partial<PlayerState>> = {}): Record<number, PlayerState> {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [index + 1, player(holdings[index + 1])]));
}

type Deal = { faceUp?: Partial<Record<Level, number[]>>; top?: Partial<Record<Level, number[]>>; owned?: number[] };

// The market and decks: the `faceUp` cards in the first slots of their level, the lowest other ids in the rest, and
// the `top` cards (listed from the top down) on top of their decks. `owned` cards are left out of both.
function deal({ faceUp: shown = {}, top = {}, owned = [] }: Deal = {}): Pick<GameState, 'market' | 'decks'> {
  const market = { 1: [], 2: [], 3: [] } as GameState['market'];
  const decks = { 1: [], 2: [], 3: [] } as GameState['decks'];
  for (const level of LEVELS) {
    const wanted = shown[level] ?? [];
    const onTop = top[level] ?? [];
    const rest = CARDS.filter(card => card.level === level && ![...wanted, ...onTop, ...owned].includes(card.id)).map(card => card.id);
    market[level] = [0, 1, 2, 3].map(slot => (slot < wanted.length ? wanted[slot] : rest.shift()!));
    decks[level] = [...rest, ...[...onTop].reverse()];
  }
  return { market, decks };
}

// A known table for `count` players: a full supply, nobles nobody qualifies for and empty-handed players
function fresh(count: number, deck: Deal = {}): Partial<GameState> {
  const each = count === 2 ? 4 : count === 3 ? 5 : 7;
  return {
    ...deal(deck),
    supply: { white: each, blue: each, green: each, red: each, black: each, gold: 5 },
    nobles: [0, 1, 2, 3, 4].slice(0, count + 1),
    players: players(count)
  };
}

let crafted = 0;

// Merges `fields` over the server state and waits until every player's page shows it
async function craft(table: Table, fields: Partial<GameState>): Promise<void> {
  const status = `Table set ${++crafted}`;
  await table.patch({ ...fields, gameStatus: status });
  for (const page of table.pages) await expect(page.locator('.game-status')).toHaveText(status);
}

function cardLabel(id: number): string {
  const card = CARDS[id];
  const cost = GEMS.filter(gem => card.cost[gem] > 0).map(gem => `${card.cost[gem]} ${gem}`).join(', ');
  return `Level ${card.level} ${card.bonus} card, ${card.points} prestige, costs ${cost}`;
}

function nobleLabel(id: number): string {
  const { cost, points } = NOBLES[id];
  return `Noble, ${points} prestige, needs ${GEMS.filter(gem => cost[gem] > 0).map(gem => `${cost[gem]} ${gem}`).join(', ')} bonuses`;
}

const tableArea = (page: Page) => page.getByRole('region', { name: 'Table', exact: true });
const supplyGem = (page: Page, token: Token) => page.locator(`.supply .gem-${token}`);
const levelRow = (page: Page, level: Level) => page.locator(`.level-row[aria-label="Level ${level}"]`);
const slot = (page: Page, level: Level, index: number) => levelRow(page, level).locator('> .dev-card').nth(index);
const deck = (page: Page, level: Level) => levelRow(page, level).locator('.deck .dev-card');
const deckCount = (page: Page, level: Level) => levelRow(page, level).locator('.deck-count');
const marketCard = (page: Page, id: number) => tableArea(page).getByLabel(cardLabel(id), { exact: true });
const panel = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const held = (page: Page, name: string, token: Token) => panel(page, name).locator(`.player-tokens .gem-${token}`);
const gemsHeld = (page: Page, name: string) => panel(page, name).locator('.player-row-label').first();
const bonus = (page: Page, name: string, gem: Gem) => panel(page, name).locator(`.bonus.gem-${gem}`);
const reservedOf = (page: Page, name: string) => panel(page, name).getByLabel('Reserved cards', { exact: true });
const noblesOf = (page: Page, name: string) => panel(page, name).getByLabel('Nobles', { exact: true });
const turnPanel = (page: Page) => page.locator('.turn-panel');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('.game-status');
const turnMessage = (page: Page) => page.locator('.turn-message');

async function expectSupply(page: Page, counts: Partial<Tokens>) {
  for (const [token, count] of Object.entries(counts)) {
    await expect(supplyGem(page, token as Token)).toHaveAccessibleName(`${count} ${token} in the supply`);
  }
}

async function expectHeld(page: Page, name: string, counts: Partial<Tokens>) {
  for (const [token, count] of Object.entries(counts)) {
    await expect(held(page, name, token as Token)).toHaveAccessibleName(`${count} ${token}`);
  }
}

async function takeGems(page: Page, ...gems: Gem[]) {
  for (const gem of gems) await supplyGem(page, gem).click();
  await button(page, 'Take gems').click();
}

async function start(seat: Seat, count = 2, motion = false) {
  const table = await seat('splendor', NAMES.slice(0, count), { motion });
  const [alice, bob, cara, dan] = table.pages;
  return { table, alice, bob, cara, dan };
}

test.describe('Splendor rules', () => {
  test('components: 7 gems a color with 4 players, 5 with 3 and 4 with 2, 5 gold, 90 cards in three levels, nobles worth 3', async ({ seat }) => {
    for (const [count, each] of [[2, 4], [3, 5], [4, 7]]) {
      const { alice } = await start(seat, count);
      await expectSupply(alice, { white: each, blue: each, green: each, red: each, black: each, gold: 5 });
      // 40, 30 and 20 cards: four face up beside each deck
      for (const [level, inDeck] of [[1, 36], [2, 26], [3, 16]] as const) {
        await expect(levelRow(alice, level).locator('> .dev-card')).toHaveCount(4);
        await expect(deckCount(alice, level)).toHaveText(`${inDeck} left`);
      }
      for (const noble of await tableArea(alice).locator('.noble').all()) await expect(noble).toHaveAccessibleName(/^Noble, 3 prestige,/);
    }
  });

  test('setup: one noble more than the players, four face-up cards a level, the first seat starts and play goes up the seats', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, 3);
    await expect(tableArea(alice).locator('.nobles .noble')).toHaveCount(4);
    for (const level of LEVELS) await expect(levelRow(alice, level).locator('> .dev-card')).toHaveCount(4);
    await expect(turnMessage(bob)).toHaveText('Alice goes first. Joining closes after the first move.');

    await takeGems(alice, 'white', 'blue', 'green');
    await expect(turnMessage(bob)).toHaveText('Your turn');
    await expect(turnMessage(cara)).toHaveText("Bob's turn");
    await takeGems(bob, 'white', 'blue', 'green');
    await expect(turnMessage(cara)).toHaveText('Your turn');
    await takeGems(cara, 'white', 'blue', 'green');
    await expect(turnMessage(alice)).toHaveText('Your turn');
  });

  test('a turn can take 3 gems of different colors, or one of each color left when fewer than three remain', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, fresh(2));
    await takeGems(alice, 'white', 'blue', 'green');
    await expectHeld(alice, 'Alice', { white: 1, blue: 1, green: 1 });
    await expectSupply(alice, { white: 3, blue: 3, green: 3, red: 4 });

    await craft(table, { supply: tokens({ red: 2, black: 1, gold: 5 }), players: players(2) });
    await supplyGem(bob, 'red').click();
    await supplyGem(bob, 'black').click();
    await expect(turnPanel(bob)).toContainText('Take red, black');
    await button(bob, 'Take gems').click();
    await expectHeld(bob, 'Bob', { red: 1, black: 1 });
    await expectSupply(bob, { red: 1, black: 0 });
  });

  test('a turn can take 2 gems of one color only when at least 4 of it are left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, fresh(2));
    await supplyGem(alice, 'white').click();
    await supplyGem(alice, 'white').click();
    await expect(turnPanel(alice)).toContainText('Take 2 white');
    await button(alice, 'Take gems').click();
    await expectHeld(alice, 'Alice', { white: 2 });
    await expectSupply(alice, { white: 2 });

    await craft(table, { supply: { ...fresh(2).supply!, blue: 3 } });
    await supplyGem(bob, 'blue').click();
    await supplyGem(bob, 'blue').click(); // with only 3 left the second click puts it back
    await expect(supplyGem(bob, 'blue')).toHaveAttribute('aria-pressed', 'false');
    await expect(turnPanel(bob)).not.toContainText('Take 2 blue');
    await expect(button(bob, 'Take gems')).toHaveCount(0);
  });

  test('a turn can reserve a face-up card or the unseen top of a deck, taking a gold while any is left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, fresh(2, { faceUp: { 1: [0, 1] }, top: { 1: [5], 2: [45] } }));
    await marketCard(alice, 0).click();
    await button(alice, 'Reserve and take a gold').click();
    await expect(reservedOf(alice, 'Alice').getByLabel(cardLabel(0), { exact: true })).toBeVisible();
    await expectHeld(alice, 'Alice', { gold: 1 });
    await expectSupply(alice, { gold: 4 });
    await expect(slot(alice, 1, 0)).toHaveAccessibleName(cardLabel(5)); // refilled from the deck

    await deck(bob, 2).click();
    await expect(turnPanel(bob)).toContainText('Reserve the top level 2 card unseen and take a gold.');
    await button(bob, 'Reserve').click();
    await expect(reservedOf(bob, 'Bob').getByLabel(cardLabel(45), { exact: true })).toBeVisible();
    await expect(deckCount(bob, 2)).toHaveText('25 left');
    await expectHeld(bob, 'Bob', { gold: 1 });

    // With no gold left a reserve takes none
    await craft(table, { supply: { ...fresh(2).supply!, gold: 0 } });
    await marketCard(alice, 1).click();
    await button(alice, 'Reserve').click();
    await expect(status(alice)).toHaveText(`Alice reserved a level 1 ${CARDS[1].bonus} card`);
    await expectHeld(alice, 'Alice', { gold: 1 });
  });

  test('a player holds at most 3 reserved cards, and a reserved card can only leave by being bought', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, { ...fresh(2, { owned: [10, 11, 12] }), players: players(2, { 1: { reserved: faceUp(10, 11, 12) } }) });
    await slot(alice, 1, 0).click();
    await expect(button(alice, 'Reserve and take a gold')).toBeDisabled();
    await button(alice, 'Cancel').click();
    await deck(alice, 1).click();
    await expect(button(alice, 'Reserve')).toBeDisabled();
    await expect(turnPanel(alice)).toContainText('You already have 3 reserved cards.');
    await button(alice, 'Cancel').click();

    await reservedOf(alice, 'Alice').getByLabel(cardLabel(10), { exact: true }).click();
    await expect(turnPanel(alice).getByRole('button')).toHaveText(['Buy', 'Cancel']);
  });

  test('a turn can buy a face-up card or one of your reserved cards', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Card 6 costs 3 blue and card 30 costs 3 white
    await craft(table, {
      ...fresh(2, { faceUp: { 1: [6] }, owned: [30] }),
      players: players(2, { 1: { tokens: tokens({ blue: 3, white: 3 }), reserved: faceUp(30) } })
    });
    await marketCard(alice, 6).click();
    await button(alice, 'Buy').click();
    await expect(panel(alice, 'Alice')).toContainText('Cards 1');
    await expect(bonus(alice, 'Alice', 'white')).toHaveText('1');

    await takeGems(bob, 'white', 'blue', 'green');
    await reservedOf(alice, 'Alice').getByLabel(cardLabel(30), { exact: true }).click();
    await button(alice, 'Buy').click();
    await expect(panel(alice, 'Alice')).toContainText('Cards 2');
    await expect(bonus(alice, 'Alice', 'red')).toHaveText('1');
    await expect(reservedOf(alice, 'Alice')).toHaveCount(0);
  });

  test('buying: bonuses lower costs, gold pays what is missing, spent tokens return, and a bought card is replaced while its deck lasts', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Alice owns two white bonuses, so card 30 (3 white) costs her 1 white; Bob pays card 6 (3 blue) with 1 blue and 2 gold
    await craft(table, {
      ...fresh(2, { faceUp: { 1: [30, 6] }, top: { 1: [7] }, owned: [1, 2] }),
      players: players(2, { 1: { cards: [1, 2], tokens: tokens({ white: 1 }) }, 2: { tokens: tokens({ blue: 1, gold: 2 }) } })
    });
    await marketCard(alice, 30).click();
    await expect(turnPanel(alice)).toContainText('Buying pays 1 white.');
    await button(alice, 'Buy').click();
    await expectHeld(alice, 'Alice', { white: 0 });
    await expectSupply(alice, { white: 5 });
    await expect(slot(alice, 1, 0)).toHaveAccessibleName(cardLabel(7));

    const state = await table.state<GameState>();
    await craft(table, { decks: { ...state.decks, 1: [] } });
    await expect(deckCount(bob, 1)).toHaveText('0 left');
    await marketCard(bob, 6).click();
    await expect(turnPanel(bob)).toContainText('Buying pays 1 blue, 2 gold.');
    await button(bob, 'Buy').click();
    await expectHeld(bob, 'Bob', { blue: 0, gold: 0 });
    await expectSupply(bob, { blue: 5, gold: 7 });
    await expect(slot(bob, 1, 1)).toHaveClass(/dev-card-empty/);
    await expect(levelRow(bob, 1).locator('.deck')).toContainText('Empty');
  });

  test('a player ending their turn with more than 10 tokens gives back tokens of their choice down to 10', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { ...fresh(2), players: players(2, { 1: { tokens: tokens({ white: 2, blue: 2, green: 2, red: 2, black: 1 }) } }) });
    await takeGems(alice, 'white', 'blue', 'green');
    await expect(turnPanel(alice)).toContainText('You have 12 tokens. Return 2 to get back to 10.');
    await expect(turnMessage(bob)).toHaveText("Alice's turn");
    await alice.getByRole('button', { name: 'Return one red' }).click();
    await alice.getByRole('button', { name: 'Return one red' }).click();
    await button(alice, 'Return 2 red').click();
    await expect(gemsHeld(alice, 'Alice')).toHaveText('Gems 10/10');
    await expectHeld(alice, 'Alice', { red: 0 });
    await expectSupply(alice, { red: 6 });
    await expect(turnMessage(bob)).toHaveText('Your turn');
  });

  test('a noble whose cost your bonuses meet visits at the end of your turn; one a turn, you choose among several, the rest come later', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // White bonuses from cards 0-3, blue from 8-10, green from 16-18; card 14 (3 black) adds the fourth blue.
    // Noble 2 needs 4 white and 4 blue, noble 6 needs 3 white, 3 blue and 3 green.
    const owned = [0, 1, 2, 3, 8, 9, 10];
    await craft(table, {
      ...fresh(2, { faceUp: { 1: [14] }, owned: [...owned, 16, 17, 18] }),
      nobles: [2, 0, 1],
      players: players(2, { 1: { cards: owned, tokens: tokens({ black: 3 }) } })
    });
    await marketCard(alice, 14).click();
    await button(alice, 'Buy').click();
    await expect(noblesOf(alice, 'Alice').getByLabel(nobleLabel(2), { exact: true })).toBeVisible();
    await expect(tableArea(alice).locator('.nobles .noble')).toHaveCount(2);
    await expect(panel(alice, 'Alice').locator('.player-prestige')).toHaveText('3 prestige');
    await expect(status(bob)).toHaveText('Alice bought a level 1 blue card for 3 black, and a noble visited');
    await expect(turnMessage(bob)).toHaveText('Your turn');

    // Two nobles qualify: Alice picks one, and the other visits at the end of her next turn
    const several = await start(seat);
    await craft(several.table, {
      ...fresh(2, { faceUp: { 1: [14] }, owned: [...owned, 16, 17, 18] }),
      nobles: [2, 6, 0],
      players: players(2, { 1: { cards: [...owned, 16, 17, 18], tokens: tokens({ black: 3 }) } })
    });
    await marketCard(several.alice, 14).click();
    await button(several.alice, 'Buy').click();
    await expect(turnPanel(several.alice)).toContainText('Several nobles want to visit.');
    // The only choices are the nobles: a visit cannot be refused
    await expect(turnPanel(several.alice).getByRole('button')).toHaveCount(2);
    await expect(turnMessage(several.bob)).toHaveText("Alice's turn");
    await several.alice.getByRole('button', { name: `Choose: ${nobleLabel(6)}` }).click();
    await expect(noblesOf(several.alice, 'Alice').locator('.noble')).toHaveCount(1);
    await expect(tableArea(several.alice).getByLabel(nobleLabel(2), { exact: true })).toBeVisible();

    await takeGems(several.bob, 'white', 'blue', 'green');
    await takeGems(several.alice, 'white', 'blue', 'green');
    await expect(noblesOf(several.alice, 'Alice').locator('.noble')).toHaveCount(2);
    await expect(panel(several.alice, 'Alice').locator('.player-prestige')).toHaveText('6 prestige');
  });

  test('reaching 15 prestige finishes the round so everyone has the same number of turns, then the most prestige wins', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3);
    await takeGems(alice, 'white', 'blue', 'green');
    // Bob holds 10 prestige (cards 73 and 77) and buys card 85 (5 prestige, 7 green and 3 red)
    await craft(table, {
      ...fresh(3, { faceUp: { 3: [85] }, owned: [73, 77] }),
      players: players(3, { 1: { tokens: tokens({ white: 1, blue: 1, green: 1 }) }, 2: { cards: [73, 77], tokens: tokens({ green: 7, red: 3 }) } })
    });
    await marketCard(bob, 85).click();
    await button(bob, 'Buy').click();
    await expect(status(alice)).toContainText('Bob has 15 prestige: the round finishes, then the game ends.');
    await expect(turnMessage(cara)).toHaveText('Final round: Your turn');
    await expect(turnMessage(alice)).toHaveText("Final round: Cara's turn");

    await takeGems(cara, 'white', 'blue', 'green');
    for (const page of [alice, bob, cara]) await expect(turnMessage(page)).toHaveText('Game over');
    await expect(status(alice)).toHaveText('Bob wins with 15 prestige!');
    await expect(panel(alice, 'Bob')).toHaveClass(/player-winner/);
  });

  test('a tie goes to the fewest development cards, then the fewest reserved cards, and a tie on all three is shared', async ({ seat }) => {
    // Bob plays the last turn of the final round; Alice and Bob both have 10 prestige
    async function finish(alice: Partial<PlayerState>, bob: Partial<PlayerState>) {
      const game = await start(seat);
      await craft(game.table, {
        ...fresh(2, { owned: [...alice.cards ?? [], ...bob.cards ?? [], ...(alice.reserved ?? []).map(held => held.card)] }),
        players: players(2, { 1: alice, 2: bob }),
        started: true,
        finalRound: true,
        currentPlayer: 2,
        turnHolder: 2
      });
      await takeGems(game.bob, 'white', 'blue', 'green');
      return status(game.alice);
    }
    // Alice: cards 73 and 77, 5 prestige each. Bob: 71 and 75 (4 each) and 7 and 15 (1 each).
    await expect(await finish({ cards: [73, 77] }, { cards: [71, 75, 7, 15] })).toHaveText('Alice wins with 10 prestige!');
    await expect(await finish({ cards: [73, 77], reserved: faceUp(0) }, { cards: [81, 85] })).toHaveText('Bob wins with 10 prestige!');
    await expect(await finish({ cards: [73, 77] }, { cards: [81, 85] })).toHaveText('Alice and Bob share the win with 10 prestige!');
  });

  test('nobody sees the deck order, and a card reserved from a deck shows to others only as a back of its level', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, fresh(2, { top: { 1: [5, 6], 2: [45, 46], 3: [75, 76] } }));
    for (const id of [5, 6, 45, 46, 75, 76]) {
      for (const page of [alice, bob]) await expect(page.getByLabel(cardLabel(id), { exact: true })).toHaveCount(0);
    }
    await deck(alice, 1).click();
    await button(alice, 'Reserve').click();
    await expect(reservedOf(alice, 'Alice').getByLabel(cardLabel(5), { exact: true })).toBeVisible();
    await expect(reservedOf(bob, 'Alice').getByLabel('Face-down level 1 card', { exact: true })).toBeVisible();
    await expect(bob.getByLabel(cardLabel(5), { exact: true })).toHaveCount(0);
    await expect(status(bob)).toHaveText('Alice reserved the top level 1 card and took a gold');
  });

  test('a dismissed player returns their tokens, loses their reserved cards, keeps cards and nobles on show, and their turn ends and is skipped', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3);
    await takeGems(alice, 'white', 'blue', 'green');
    // Bob is part way through his turn, owing 2 tokens back
    await craft(table, {
      ...fresh(3, { owned: [8, 9, 20] }),
      supply: tokens({ white: 1, blue: 1, green: 1, red: 1, black: 1, gold: 1 }),
      players: players(3, {
        1: { tokens: tokens({ white: 1, blue: 1, green: 1 }) },
        2: { tokens: tokens({ white: 4, blue: 2, red: 3, black: 2, gold: 1 }), cards: [8, 9], reserved: faceUp(20), nobles: [5] }
      }),
      pending: { kind: 'returnTokens', count: 2 }
    });
    await expect(turnPanel(bob)).toContainText('Return 2 to get back to 10.');
    await leave(bob);
    await dismiss('Bob', alice, cara);

    await expect(turnMessage(cara)).toHaveText('Your turn');
    await expect(turnMessage(alice)).toHaveText("Cara's turn");
    await expectSupply(alice, { white: 5, blue: 3, green: 1, red: 4, black: 3, gold: 2 });
    await expect(panel(alice, 'Bob')).toContainText('Bob (left)');
    await expect(gemsHeld(alice, 'Bob')).toHaveText('Gems 0/10');
    await expect(reservedOf(alice, 'Bob')).toHaveCount(0);
    await expect(bonus(alice, 'Bob', 'blue')).toHaveText('2');
    await expect(noblesOf(alice, 'Bob').getByLabel(nobleLabel(5), { exact: true })).toBeVisible();

    await takeGems(cara, 'white', 'blue', 'red');
    await expect(turnMessage(alice)).toHaveText('Your turn');
  });

  test('a dismissal that ends the last turn of the final round ends the game', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3);
    await craft(table, {
      ...fresh(3, { owned: [73] }),
      players: players(3, { 1: { cards: [73] }, 3: { tokens: tokens({ white: 4, blue: 4, green: 3 }) } }),
      pending: { kind: 'returnTokens', count: 1 },
      started: true,
      finalRound: true,
      currentPlayer: 3,
      turnHolder: 3
    });
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(turnMessage(alice)).toHaveText('Game over');
    await expect(status(bob)).toHaveText('Alice wins with 5 prestige!');
  });

  test('the last player left wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await takeGems(alice, 'white', 'blue', 'green');
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
    await expect(turnMessage(alice)).toHaveText('Game over');
  });

  test('an undo needs every player still in the game to approve', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, 3);
    await takeGems(alice, 'white', 'blue', 'green');
    await expect(gemsHeld(alice, 'Alice')).toHaveText('Gems 3/10');

    await button(alice, 'Undo').click();
    await button(bob, 'Approve').click();
    await button(cara, 'Decline').click();
    await expect(status(alice)).toHaveText('Cara declined the undo');
    await expect(gemsHeld(alice, 'Alice')).toHaveText('Gems 3/10');

    await undo(alice, bob, cara);
    await expect(gemsHeld(alice, 'Alice')).toHaveText('Gems 0/10');
    await expect(turnMessage(alice)).toHaveText('Your turn');
  });

  test('giving back tokens and choosing a noble are moves of their own for undo', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, { ...fresh(2), players: players(2, { 1: { tokens: tokens({ white: 2, blue: 2, green: 2, red: 2, black: 1 }) } }) });
    await takeGems(alice, 'white', 'blue', 'green');
    await alice.getByRole('button', { name: 'Return one red' }).click();
    await alice.getByRole('button', { name: 'Return one red' }).click();
    await button(alice, 'Return 2 red').click();
    await expect(turnMessage(bob)).toHaveText('Your turn');
    await undo(alice, bob);
    // Back to the return, with the three gems still taken
    await expect(turnPanel(alice)).toContainText('You have 12 tokens. Return 2 to get back to 10.');
    await expect(gemsHeld(alice, 'Alice')).toHaveText('Gems 12/10');

    const nobles = await start(seat);
    const owned = [0, 1, 2, 3, 8, 9, 10, 16, 17, 18];
    await craft(nobles.table, {
      ...fresh(2, { faceUp: { 1: [14] }, owned }),
      nobles: [2, 6, 0],
      players: players(2, { 1: { cards: owned, tokens: tokens({ black: 3 }) } })
    });
    await marketCard(nobles.alice, 14).click();
    await button(nobles.alice, 'Buy').click();
    await nobles.alice.getByRole('button', { name: `Choose: ${nobleLabel(6)}` }).click();
    await expect(turnMessage(nobles.bob)).toHaveText('Your turn');
    await undo(nobles.alice, nobles.bob);
    // Back to the choice, with the card still bought
    await expect(turnPanel(nobles.alice)).toContainText('Several nobles want to visit.');
    await expect(panel(nobles.alice, 'Alice')).toContainText('Cards 11');
  });

  test('the host can set a lower prestige to win', async ({ seat }) => {
    const table = await seat('splendor', NAMES.slice(0, 2), { houseRules: { targetScore: 10 } });
    const [alice, bob] = table.pages;
    // Bob holds 10 prestige (cards 73 and 77) and ends the round
    await craft(table, { ...fresh(2, { owned: [73, 77] }), players: players(2, { 2: { cards: [73, 77] } }) });
    await takeGems(alice, 'white', 'blue', 'green');
    await takeGems(bob, 'white', 'blue', 'green');
    for (const page of [alice, bob]) await expect(turnMessage(page)).toHaveText('Game over');
    await expect(status(alice)).toHaveText('Bob wins with 10 prestige!');
  });
});

test.describe('Splendor controls', () => {
  test('with Color-blind symbols on, gem tokens, card bonuses and card costs show a shape, and gold a star', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, fresh(2, { faceUp: { 1: [0] } }));
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    const shapes: Record<Token, string> = { white: 'ring', blue: 'square', green: 'triangle', red: 'circle', black: 'diamond', gold: 'star' };
    for (const token of Object.keys(shapes) as Token[]) await expect(supplyGem(alice, token).locator(`.color-symbol-${shapes[token]}`)).toHaveCount(1);
    const card = CARDS[0];
    const first = alice.getByLabel(cardLabel(0), { exact: true });
    await expect(first.locator('.dev-card-bonus').locator(`.color-symbol-${shapes[card.bonus]}`)).toHaveCount(1);
    const costs = GEMS.filter(gem => card.cost[gem] > 0);
    await expect(first.locator('.cost-pip .color-symbol')).toHaveCount(costs.length);
    for (const gem of costs) await expect(first.locator(`.cost-pip.gem-${gem} .color-symbol-${shapes[gem]}`)).toHaveCount(1);
    for (const gem of GEMS) await expect(panel(alice, 'Alice').locator(`.bonus.gem-${gem} .color-symbol-${shapes[gem]}`)).toHaveCount(1);
    const noble = alice.locator('.nobles .noble').first();
    for (const gem of GEMS.filter(gem => NOBLES[0].cost[gem] > 0)) await expect(noble.locator(`.noble-pip.gem-${gem} .color-symbol-${shapes[gem]}`)).toHaveCount(1);
  });

  test('click gems to pick them and Take gems to take them; a color clicked twice takes two, and clicking a picked gem puts it back', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, fresh(2));
    await supplyGem(alice, 'white').click();
    await supplyGem(alice, 'blue').click();
    await expect(supplyGem(alice, 'blue')).toHaveAttribute('aria-pressed', 'true');
    await supplyGem(alice, 'blue').click();
    await expect(supplyGem(alice, 'blue')).toHaveAttribute('aria-pressed', 'false');
    await expect(turnPanel(alice)).toContainText('Take white');
    await supplyGem(alice, 'white').click();
    await expect(turnPanel(alice)).toContainText('Take 2 white');
    await supplyGem(alice, 'white').click();
    await expect(turnPanel(alice).locator('.turn-panel-title')).toHaveText(/^Take white \(/);
    await supplyGem(alice, 'green').click();
    await supplyGem(alice, 'red').click();
    await expect(turnPanel(alice)).toContainText('Take white, green, red');
    await button(alice, 'Take gems').click();
    await expectHeld(alice, 'Alice', { white: 1, green: 1, red: 1, blue: 0 });
  });

  test('click a face-up card then Buy or Reserve, click a deck to reserve its top card, and click your reserved card to buy it', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, {
      ...fresh(2, { faceUp: { 1: [6, 30] }, top: { 2: [45] } }),
      players: players(2, { 1: { tokens: tokens({ blue: 3, white: 3 }) } })
    });
    await marketCard(alice, 6).click();
    await expect(marketCard(alice, 6)).toHaveAttribute('aria-pressed', 'true');
    await button(alice, 'Buy').click();
    await expect(bonus(alice, 'Alice', 'white')).toHaveText('1');

    await deck(bob, 2).click();
    await button(bob, 'Reserve').click();
    await expect(reservedOf(bob, 'Bob').getByLabel(cardLabel(45), { exact: true })).toBeVisible();

    await marketCard(alice, 30).click();
    await button(alice, 'Reserve and take a gold').click();
    await takeGems(bob, 'white', 'blue', 'green');
    await reservedOf(alice, 'Alice').getByLabel(cardLabel(30), { exact: true }).click();
    await button(alice, 'Buy').click();
    await expect(bonus(alice, 'Alice', 'red')).toHaveText('1');
  });

  test('cards you can afford have a gold outline, and the panel says what a purchase costs after bonuses and gold', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // Card 6 costs 3 blue: with a blue bonus Alice pays 1 blue and 1 gold. Card 30 costs 3 white, more than her 2 gold.
    await craft(table, {
      ...fresh(2, { faceUp: { 1: [6, 30] }, owned: [8] }),
      players: players(2, { 1: { cards: [8], tokens: tokens({ blue: 1, gold: 2 }) } })
    });
    await expect(marketCard(alice, 6)).toHaveClass(/dev-card-affordable/);
    await expect(marketCard(alice, 30)).not.toHaveClass(/dev-card-affordable/);
    const [shadow, gold] = await marketCard(alice, 6).evaluate(element => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--gem-gold)';
      element.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(element).boxShadow, color];
    });
    expect(shadow).toContain(gold);

    await marketCard(alice, 6).click();
    await expect(turnPanel(alice)).toContainText('Buying pays 1 blue, 1 gold.');
    await marketCard(alice, 30).click();
    await expect(turnPanel(alice)).toContainText('You cannot afford this card yet.');
    await expect(button(alice, 'Buy')).toBeDisabled();
  });

  test('with more than 10 tokens the panel lets you pick which to give back, then Return', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, { ...fresh(2), players: players(2, { 1: { tokens: tokens({ white: 3, blue: 3, black: 3 }) } }) });
    await takeGems(alice, 'white', 'blue', 'green');
    await expect(button(alice, 'Return')).toBeDisabled();
    await alice.getByRole('button', { name: 'Return one black' }).click();
    await alice.getByRole('button', { name: 'Return one white' }).click();
    await alice.getByRole('button', { name: 'Keep one white' }).click();
    await expect(button(alice, 'Return 1 black')).toBeDisabled();
    await alice.getByRole('button', { name: 'Return one blue' }).click();
    await button(alice, 'Return 1 blue, 1 black').click();
    await expectHeld(alice, 'Alice', { white: 4, blue: 3, green: 1, black: 2 });
  });

  test('when several nobles qualify, click the one you want', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const owned = [0, 1, 2, 3, 8, 9, 10, 16, 17, 18];
    await craft(table, {
      ...fresh(2, { faceUp: { 1: [14] }, owned }),
      nobles: [2, 6, 0],
      players: players(2, { 1: { cards: owned, tokens: tokens({ black: 3 }) } })
    });
    await marketCard(alice, 14).click();
    await button(alice, 'Buy').click();
    await alice.getByRole('button', { name: `Choose: ${nobleLabel(2)}` }).click();
    await expect(noblesOf(alice, 'Alice').getByLabel(nobleLabel(2), { exact: true })).toBeVisible();
    await expect(tableArea(alice).getByLabel(nobleLabel(6), { exact: true })).toBeVisible();
  });

  test('a Pass button appears when you cannot take, reserve or buy anything', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, {
      ...fresh(2, { owned: [10, 11, 12] }),
      supply: tokens(),
      players: players(2, { 1: { reserved: faceUp(10, 11, 12) } })
    });
    await expect(turnPanel(alice)).toContainText('You cannot take, reserve or buy anything.');
    await button(alice, 'Pass').click();
    await expect(status(bob)).toHaveText('Alice could not act and passed');
    await expect(turnMessage(bob)).toHaveText('Your turn');
    await expect(button(bob, 'Pass')).toHaveCount(0); // Bob can still reserve
  });

  test('each panel shows prestige, tokens, bonuses by color, reserved cards and nobles, and the player whose turn it is is outlined', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, {
      ...fresh(2, { owned: [0, 1, 8, 20] }),
      players: players(2, { 2: { tokens: tokens({ white: 2, gold: 1 }), cards: [0, 1, 8], reserved: faceUp(20), nobles: [5] } })
    });
    const bob = panel(alice, 'Bob');
    await expect(bob.locator('.player-prestige')).toHaveText('3 prestige');
    await expect(gemsHeld(alice, 'Bob')).toHaveText('Gems 3/10');
    await expectHeld(alice, 'Bob', { white: 2, gold: 1, blue: 0 });
    await expect(bob).toContainText('Cards 3');
    await expect(bonus(alice, 'Bob', 'white')).toHaveText('2');
    await expect(bonus(alice, 'Bob', 'white')).toHaveAttribute('title', '2 white bonus');
    await expect(bonus(alice, 'Bob', 'blue')).toHaveText('1');
    await expect(reservedOf(alice, 'Bob').getByLabel(cardLabel(20), { exact: true })).toBeVisible();
    await expect(noblesOf(alice, 'Bob').getByLabel(nobleLabel(5), { exact: true })).toBeVisible();

    await expect(panel(alice, 'Alice')).toHaveClass(/player-current/);
    await expect(bob).not.toHaveClass(/player-current/);
    await expect(panel(alice, 'Alice')).toHaveCSS('border-top-style', 'solid');
  });

  test('the last move is outlined: a reserved card among the player reserved cards, a bought card by its bonus', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Card 6 costs 3 blue and gives a white bonus
    await craft(table, { ...fresh(2, { faceUp: { 1: [0, 6] } }), players: players(2, { 2: { tokens: tokens({ blue: 3 }) } }) });
    await marketCard(alice, 0).click();
    await button(alice, 'Reserve and take a gold').click();
    for (const page of [alice, bob]) {
      await expect(page.locator('.dev-card-highlighted')).toHaveCount(1);
      await expect(reservedOf(page, 'Alice').locator('.dev-card-highlighted')).toHaveCount(1);
    }

    await marketCard(bob, 6).click();
    await button(bob, 'Buy').click();
    for (const page of [alice, bob]) {
      await expect(page.locator('.dev-card-highlighted')).toHaveCount(0);
      await expect(page.locator('.bonus-highlighted')).toHaveCount(1);
      await expect(bonus(page, 'Bob', 'white')).toHaveClass(/bonus-highlighted/);
    }
  });

  test('pieces slide to where they went, and nothing animates with reduced motion', async ({ seat }) => {
    const animated = await start(seat, 2, true);
    await takeGems(animated.alice, 'white', 'blue', 'green');
    await expect.poll(() => animated.bob.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);

    const still = await start(seat);
    await takeGems(still.alice, 'white', 'blue', 'green');
    await expect(turnMessage(still.bob)).toHaveText('Your turn');
    expect(await still.bob.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, 3);
    await takeGems(alice, 'white', 'blue', 'green');
    await button(alice, 'Undo').click();
    await expect(button(bob, 'Approve')).toBeVisible();
    await expect(button(cara, 'Approve')).toBeVisible();
    await expect(button(alice, 'Approve')).toHaveCount(0);
  });

  test('FAQ at the top of the page shows a short guide to the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What can I do on my turn?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Splendor differences from Wikipedia', () => {
  test('2 players use 4 gems of each color and 3 players use 5', async ({ seat }) => {
    const two = await start(seat, 2);
    await expectSupply(two.alice, { white: 4, red: 4 });
    const three = await start(seat, 3);
    await expectSupply(three.alice, { white: 5, red: 5 });
  });

  test('taking different colors takes exactly three while three or more colors are left', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await craft(table, fresh(2));
    await supplyGem(alice, 'white').click();
    await supplyGem(alice, 'blue').click();
    await expect(turnPanel(alice)).toContainText('(pick three different colors, or click a color twice for two)');
    await expect(button(alice, 'Take gems')).toBeDisabled();
    await supplyGem(alice, 'green').click();
    await expect(button(alice, 'Take gems')).toBeEnabled();
  });

  test('the player in the first seat goes first', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(turnMessage(alice)).toHaveText('Alice goes first. Joining closes after the first move.');
    await expect(supplyGem(bob, 'white')).toHaveRole('img'); // not clickable for Bob
    await expect(supplyGem(alice, 'white')).toHaveRole('button');
  });

  test('the game pays with your colored gems first and gold only for what you are short', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // Card 30 costs 3 white; Alice holds 3 white and 1 gold
    await craft(table, { ...fresh(2, { faceUp: { 1: [30] } }), players: players(2, { 1: { tokens: tokens({ white: 3, gold: 1 }) } }) });
    await marketCard(alice, 30).click();
    await expect(turnPanel(alice)).toContainText('Buying pays 3 white.');
    await button(alice, 'Buy').click();
    await expectHeld(alice, 'Alice', { white: 0, gold: 1 });
  });

  test('a player who can do nothing passes', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await craft(table, {
      ...fresh(2, { owned: [10, 11, 12] }),
      supply: tokens(),
      players: players(2, { 1: { reserved: faceUp(10, 11, 12) } })
    });
    await expect(turnPanel(alice).getByRole('button')).toHaveText(['Pass']);
    await button(alice, 'Pass').click();
    await expect(turnMessage(bob)).toHaveText('Your turn');
  });
});
