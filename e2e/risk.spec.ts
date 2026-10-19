import type { Page } from '@playwright/test';
import { dismiss, expect, joinGame, leave, newPlayer, openFaq, test as base, type Table } from './fixtures.ts';
import { ALL_CARDS, cardSymbol, territoriesOf } from '../games/risk/map.ts';
import { game, ownership } from '../games/risk/testing.ts';
import type { ContinentId, GameState } from '../games/risk/types.ts';

// One test per rule, control and difference in games/risk/README.md. Alice, Bob and Cara sit in seats 1, 2 and 3.
// Most tests patch in the unit tests' map: the territories are dealt in map order (Alaska to Alice, Northwest Territory
// to Bob, Greenland to Cara, Alberta to Alice and so on) with 3 armies each, and the deck is in card order. Card n
// shows territory n, with the symbols in turn (infantry, cavalry, artillery), and cards 42 and 43 are the wilds.

type Seat = (gameType: string, names: string[]) => Promise<Table>;

// `join` seats one more player after the table was made, so a test can queue the random numbers the deal uses first
// `visitor` is a browser that has joined nothing, as a player's own page goes back to their game
const test = base.extend<{ join: (table: Table, name: string) => Promise<Page>; visitor: Page }>({
  visitor: async ({ browser, server }, use) => {
    const page = await newPlayer(browser, server);
    await use(page);
    await page.context().close();
  },
  join: async ({ browser, server }, use) => {
    const pages: Page[] = [];
    await use(async (table, name) => {
      const page = await newPlayer(browser, server);
      pages.push(page);
      await joinGame(page, 'risk', table.gameId, name);
      return page;
    });
    for (const page of pages) await page.context().close().catch(() => {});
  }
});

const WILD = 42;
const PLATFORM_FIELDS = ['gameId', 'activePlayers', 'playerNames', 'disconnected', 'undoVote', 'dismissVote', 'seatKeys'] as const;

// The unit tests' game, without the fields the platform owns, to merge over a live table
function crafted(overrides: Partial<GameState> = {}): Partial<GameState> {
  const state: Partial<GameState> = game(overrides);
  for (const key of PLATFORM_FIELDS) delete state[key];
  return state;
}

// Alice in her attack phase
const attacking = (overrides: Partial<GameState> = {}) => crafted({ phase: 'attack', reinforcements: 0, ...overrides });
// The default 3 armies everywhere, with some territories changed
const armiesWith = (changes: Record<string, number>) => ({ ...game().armies, ...changes });

async function start(seat: Seat) {
  const table = await seat('risk', ['Alice', 'Bob', 'Cara']);
  const [alice, bob, cara] = table.pages;
  return { table, alice, bob, cara };
}

// A territory on the map, its disc and its army count
const land = (page: Page, id: string) => page.locator(`[data-anim-key="territory-${id}"]`);
const disc = (page: Page, id: string) => land(page, id).locator('.disc');
const armiesOn = (page: Page, id: string) => land(page, id).locator('.army-count');
const panel = (page: Page) => page.locator('.phase-panel');
const panelTitle = (page: Page) => page.locator('.phase-panel .panel-title');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const turn = (page: Page) => page.locator('.turn-message');
const playerRow = (page: Page, name: string) => page.locator('.player-row', { has: page.locator('.player-name', { hasText: new RegExp(`^${name}`) }) });
const cards = (page: Page) => page.locator('.card-hand .risk-card');
const card = (page: Page, text: string) => page.locator('.card-hand .risk-card', { hasText: text });
const battle = (page: Page) => page.getByRole('region', { name: 'Last battle' });
const slider = (page: Page) => page.locator('.army-slider input[type="range"]');
const events = (page: Page) => page.getByRole('region', { name: 'Recent events' }).locator('li');

async function diceShown(page: Page, side: 'attack' | 'defend'): Promise<string[]> {
  return page.locator(`.battle .die-${side}`).evaluateAll(dice => dice.map(die => die.getAttribute('aria-label') ?? ''));
}

// Chooses an attack (or fortify) from one territory to another. A source stays chosen between moves, and clicking it
// again would drop it, so it is clicked only if it is not chosen already.
async function choose(page: Page, from: string, to: string) {
  if (!/\bsource\b/.test(await land(page, from).getAttribute('class') ?? '')) await disc(page, from).click();
  await expect(land(page, from)).toHaveClass(/\bsource\b/);
  await disc(page, to).click();
  await expect(land(page, to)).toHaveClass(/\btarget\b/);
}

// Picks how many dice to roll and rolls them
async function rollDice(page: Page, count: number) {
  await page.getByRole('group', { name: 'Dice' }).getByRole('button', { name: String(count), exact: true }).click();
  await button(page, `Roll ${count} ${count === 1 ? 'die' : 'dice'}`).click();
}

// Picks exactly these cards (by the text they show) and trades them
async function trade(page: Page, ...texts: string[]) {
  for (const text of texts) await card(page, text).click();
  await page.getByRole('button', { name: /^Trade for/ }).click();
}

// The setup: All, a territory of yours, Place all
async function placeAllStarting(page: Page) {
  await button(page, 'All').click();
  await page.locator('.territory.selectable .disc').first().click();
  await button(page, 'Place all').click();
}

const rgb = (page: Page, selector: string) => page.locator(selector).first().evaluate(element => {
  const style = getComputedStyle(element);
  return element.tagName === 'circle' ? style.fill : style.backgroundColor;
});

test.describe('Risk rules', () => {
  test('the map has 42 territories in six continents with their bonuses and 83 borders, sea lanes included', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await expect(alice.locator('.territory')).toHaveCount(42);
    await expect(alice.locator('.continent-label')).toHaveText([
      'North America +5', 'South America +2', 'Europe +5', 'Africa +3', 'Asia +7', 'Australia +2'
    ]);
    await expect(alice.locator('.border')).toHaveCount(83);

    // Holding exactly one whole continent shows its territory count and adds its bonus to the next turn
    const continents: [ContinentId, string, number, number][] = [
      ['northAmerica', 'N. America', 9, 5], ['southAmerica', 'S. America', 4, 2], ['europe', 'Europe', 7, 5],
      ['africa', 'Africa', 6, 3], ['asia', 'Asia', 12, 7], ['australia', 'Australia', 4, 2]
    ];
    for (const [id, chip, count, bonus] of continents) {
      await table.patch(crafted({ owners: ownership(2, Object.fromEntries(territoriesOf(id).map(territory => [territory, 1]))) }));
      const row = playerRow(alice, 'Alice');
      await expect(row.locator('.player-stats')).toContainText(`${count} territories`);
      await expect(row.locator('.chip')).toHaveText([chip]);
      await expect(row.locator('.player-stats')).toContainText(`+${Math.max(3, Math.floor(count / 3)) + bonus} a turn`);
    }

    // The named borders: Alice's territory can attack across each one
    const pairs = [['alaska', 'kamchatka'], ['brazil', 'northAfrica'], ['greenland', 'iceland'], ['eastAfrica', 'middleEast'], ['siam', 'indonesia']];
    await table.patch(attacking({ owners: ownership(2, Object.fromEntries(pairs.map(([from]) => [from, 1]))) }));
    for (const [from, to] of pairs) {
      await disc(alice, from).click();
      await expect(land(alice, to)).toHaveClass(/can-target/);
      await button(alice, 'Clear choice').click();
    }
  });

  test('the deck holds 42 territory cards, 14 of each symbol, and 2 wilds, and the traded cards are reshuffled when it runs out', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await expect(alice.locator('.deck-line')).toContainText('Cards in the deck: 44');
    const { deck } = await table.state<GameState>();
    expect([...deck].sort((a, b) => a - b)).toEqual(ALL_CARDS);
    const symbols = deck.map(cardSymbol);
    for (const symbol of ['infantry', 'cavalry', 'artillery']) expect(symbols.filter(each => each === symbol)).toHaveLength(14);
    expect(symbols.filter(each => each === 'wild')).toHaveLength(2);

    // An empty deck: Alice earned a card, and the three traded cards make the new deck
    await table.patch(attacking({ conqueredThisTurn: true, deck: [], discard: [5, 6, 7] }));
    await button(alice, 'End turn').click();
    await expect(cards(alice)).toHaveCount(1);
    await expect(alice.locator('.deck-line')).toContainText('Cards in the deck: 2');
    expect((await table.state<GameState>()).discard).toEqual([]);
  });

  test('setup: each player has 35 armies with 3 players, 30 with 4, 25 with 5 and 20 with 6', async ({ seat }) => {
    test.slow();
    const names = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn'];
    for (const [count, armies] of [[3, 35], [4, 30], [5, 25], [6, 20]]) {
      const table = await seat('risk', names.slice(0, count));
      await expect(table.pages[0].locator('.game-status')).toContainText(`Each player has ${armies} armies`);
    }
  });

  test('setup: a random player goes first and the territories are dealt from them, one army each, the first players getting one more', async ({ seat, join }) => {
    const table = await seat('risk', ['Alice', 'Bob', 'Cara']);
    await table.random(0.99); // the last of four seats
    const dan = await join(table, 'Dan');
    await expect(turn(dan)).toHaveText('You place first. Joining closes after the first move.');
    await expect(turn(table.pages[0])).toHaveText('Dan places first. Joining closes after the first move.');
    await expect(dan.locator('.game-status')).toContainText('Dan was drawn to go first');
    for (const [name, held] of [['Dan', 11], ['Alice', 11], ['Bob', 10], ['Cara', 10]] as const) {
      await expect(playerRow(dan, name).locator('.player-stats')).toContainText(`${held} territories`);
    }
    await expect(dan.locator('.army-count')).toHaveText(Array(42).fill('1'));
    await expect(dan.locator('.territory[aria-label*="unclaimed"]')).toHaveCount(0);
  });

  test('setup: in turn order each player places all their starting armies in one move, then the first player starts and turns go up the seats', async ({ seat, join }) => {
    const table = await seat('risk', ['Alice', 'Bob']);
    await table.random(0.5); // the second of three seats
    const cara = await join(table, 'Cara');
    const [alice, bob] = table.pages;

    await expect(panel(alice)).toHaveText('Waiting for Bob to place their starting armies');
    await expect(bob.locator('.armies-left')).toHaveText('21 of 21 armies left to place'); // 35 less 14 territories
    await expect(button(bob, 'Place all')).toBeDisabled();
    await placeAllStarting(bob);
    await expect(bob.locator('.army-count', { hasText: '22' })).toHaveCount(1);

    await expect(turn(cara)).toHaveText('Place your starting armies');
    await placeAllStarting(cara);
    await expect(turn(alice)).toHaveText('Place your starting armies');
    await placeAllStarting(alice);

    // Bob drew the first turn
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(panelTitle(bob)).toHaveText('Reinforce');
    await button(bob, 'All').click();
    await bob.locator('.territory.selectable .disc').first().click();
    await button(bob, 'Place and attack').click();
    await button(bob, 'End turn').click();
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(turn(alice)).toHaveText("Cara's turn");
  });

  test('reinforce: a third of your territories, at least 3, plus whole continents, placed in one go or a few at a time', async ({ seat }) => {
    const { table, alice, cara } = await start(seat);
    // 17 territories with South America: 5 + 2. Cara ends her turn, and Alice's begins
    const seventeen = [...territoriesOf('southAmerica'), ...territoriesOf('asia').filter(id => id !== 'siam'), 'egypt', 'congo'];
    await table.patch(attacking({ currentPlayer: 3, turnHolder: 3, owners: ownership(3, Object.fromEntries(seventeen.map(id => [id, 1]))) }));
    await button(cara, 'End turn').click();
    await expect(alice.locator('.armies-left')).toHaveText('7 of 7 armies left to place');

    await disc(alice, 'venezuela').click();
    await button(alice, 'Place').click();
    await expect(armiesOn(alice, 'venezuela')).toHaveText('4');
    await expect(alice.locator('.armies-left')).toHaveText('6 of 6 armies left to place');
    await button(alice, 'All').click();
    await disc(alice, 'peru').click();
    await button(alice, 'Place and attack').click();
    await expect(armiesOn(alice, 'peru')).toHaveText('9');
    await expect(panelTitle(alice)).toHaveText('Attack');

    // Two territories still get 3
    await table.patch(attacking({ currentPlayer: 3, turnHolder: 3, owners: ownership(3, { alaska: 1, peru: 1 }) }));
    await button(cara, 'End turn').click();
    await expect(alice.locator('.armies-left')).toHaveText('3 of 3 armies left to place');
  });

  test('card sets: three alike, one of each, or two with a wild', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // Alaska and Alberta (infantry), Northwest Territory (cavalry), Greenland (artillery), Western United States (infantry), a wild
    await table.patch(crafted({ hands: { 1: [0, 1, 2, 3, 6, WILD], 2: [], 3: [] } }));
    const tradeButton = alice.getByRole('button', { name: /^Trade for/ });
    const pick = async (...texts: string[]) => {
      const picked = alice.locator('.card-hand .risk-card[aria-pressed="true"]');
      while (await picked.count() > 0) await picked.first().click();
      for (const text of texts) await card(alice, text).click();
    };
    await pick('Alaska', 'Alberta', 'Northwest Territory');
    await expect(tradeButton).toBeDisabled();
    await expect(alice.locator('.trade-row .note')).toHaveText('Not a set');
    await pick('Alaska', 'Alberta', 'Western United States');
    await expect(tradeButton).toBeEnabled();
    await pick('Alaska', 'Northwest Territory', 'Greenland');
    await expect(tradeButton).toBeEnabled();
    await pick('Alaska', 'Northwest Territory', 'Wild');
    await expect(tradeButton).toBeEnabled();
  });

  test('card sets: worth 4, 6, 8, 10, 12, 15, then 5 more each; a held territory on a card gets 2 armies once a turn; 5 cards must be traded first', async ({ seat }) => {
    const { table, alice } = await start(seat);
    for (const [traded, value] of [[0, 4], [1, 6], [2, 8], [3, 10], [4, 12], [5, 15], [6, 20], [7, 25]]) {
      await table.patch({ tradeCount: traded });
      await expect(alice.locator('.deck-line')).toContainText(`Next set: ${value} armies`);
    }

    // Six infantry, all on Alice's territories: Alaska, Alberta, Western United States, Venezuela, Argentina, Great Britain
    await table.patch(crafted({ tradeCount: 5, hands: { 1: [0, 3, 6, 9, 12, 15], 2: [], 3: [] } }));
    await expect(panel(alice)).toContainText('You hold 6 cards: trade a set below before placing.');
    await expect(button(alice, 'Place')).toHaveCount(0);
    await trade(alice, 'Alaska', 'Alberta', 'Western United States');
    await expect(armiesOn(alice, 'alaska')).toHaveText('5');
    await expect(armiesOn(alice, 'alberta')).toHaveText('3');
    await expect(alice.locator('.armies-left')).toHaveText('18 of 18 armies left to place');
    await expect(alice.getByRole('button', { name: /^Trade for/ })).toHaveText('Trade for 20 armies');

    await trade(alice, 'Venezuela', 'Argentina', 'Great Britain');
    await expect(alice.locator('.armies-left')).toHaveText('38 of 38 armies left to place');
    await expect(armiesOn(alice, 'venezuela')).toHaveText('3'); // no second bonus this turn
  });

  test('attack: from 2 or more armies into a bordering enemy, dice up to one fewer than the armies, highest pairs compared, ties to the defender', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alberta: 1 }) }));
    await expect(land(alice, 'alaska')).toHaveClass(/selectable/);
    await expect(land(alice, 'alberta')).not.toHaveClass(/selectable/);

    await disc(alice, 'alaska').click();
    await expect(land(alice, 'kamchatka')).toHaveClass(/can-target/);
    await expect(land(alice, 'northwestTerritory')).toHaveClass(/can-target/);
    await expect(land(alice, 'alberta')).not.toHaveClass(/can-target/); // her own
    await expect(land(alice, 'greenland')).not.toHaveClass(/can-target/); // not a neighbor
    await disc(alice, 'kamchatka').click();
    await expect(alice.getByRole('group', { name: 'Dice' }).getByRole('button')).toHaveText(['1', '2']); // 3 armies

    // 5, 3 against 5, 4: a tie and a loss, both the attacker's
    await table.dice(3, 5, 4, 5);
    await rollDice(alice, 2);
    await expect.poll(() => diceShown(alice, 'attack')).toEqual(['5', '3']);
    expect(await diceShown(alice, 'defend')).toEqual(['5', '4']);
    await expect(battle(alice).locator('.battle-lost')).toHaveText(['lost 2', 'lost 0']);
    await expect(armiesOn(alice, 'alaska')).toHaveText('1');
    await expect(armiesOn(alice, 'kamchatka')).toHaveText('3');

    // 6, 2, 1 against 5, 1 from Alberta's 4 armies: the defender loses both
    await table.patch(attacking({ armies: armiesWith({ alberta: 4 }) }));
    await expect(armiesOn(alice, 'alberta')).toHaveText('4');
    await choose(alice, 'alberta', 'northwestTerritory');
    await table.dice(6, 2, 1, 5, 1);
    await rollDice(alice, 3);
    await expect(battle(alice).locator('.battle-lost')).toHaveText(['lost 0', 'lost 2']);
    await expect(armiesOn(alice, 'northwestTerritory')).toHaveText('1');

    // A single defending army rolls 1 die
    await table.dice(6, 1, 1, 6);
    await rollDice(alice, 3);
    await expect.poll(() => diceShown(alice, 'defend')).toEqual(['6']);
    expect(await diceShown(alice, 'attack')).toEqual(['6', '1', '1']);
  });

  test('blitz attacks with the most dice until the territory falls or 1 army is left', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 4, kamchatka: 5 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    // 3 dice against 2, all ties, then 1 die against 2
    await table.dice(1, 1, 1, 1, 1, 1, 1, 1);
    await button(alice, 'Blitz').click();
    await expect(battle(alice)).toContainText('(blitz, 2 rolls, last roll shown)');
    await expect(battle(alice).locator('.battle-lost')).toHaveText(['lost 3', 'lost 0']);
    await expect(armiesOn(alice, 'alaska')).toHaveText('1');
    await expect(panelTitle(alice)).toHaveText('Attack');

    await table.patch(attacking({ armies: armiesWith({ alberta: 10, northwestTerritory: 2 }) }));
    await expect(armiesOn(alice, 'alberta')).toHaveText('10');
    await choose(alice, 'alberta', 'northwestTerritory');
    await table.dice(6, 6, 6, 1, 1);
    await button(alice, 'Blitz').click();
    await expect(battle(alice)).toContainText('Northwest Territory was captured');
    await expect(panelTitle(alice)).toHaveText('Move into Northwest Territory');
  });

  test('capture: move in at least as many armies as the dice rolled, leaving at least one behind', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 5, kamchatka: 1 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    await alice.getByRole('group', { name: 'Dice' }).getByRole('button', { name: '2', exact: true }).click();
    await table.dice(6, 6, 1);
    await rollDice(alice, 2);
    await expect(panelTitle(alice)).toHaveText('Move into Kamchatka');
    await expect(slider(alice)).toHaveAttribute('min', '2');
    await expect(slider(alice)).toHaveAttribute('max', '4');
    await slider(alice).fill('2');
    await button(alice, 'Move 2').click();
    await expect(land(alice, 'kamchatka')).toHaveAttribute('aria-label', 'Kamchatka: Alice, 2 armies');
    await expect(armiesOn(alice, 'alaska')).toHaveText('3');
    await expect(panelTitle(alice)).toHaveText('Attack');
  });

  test('fortify: one move through your own connected territories, leaving one behind, ends the turn; so does End turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Alice holds North America but Greenland, and Iceland beyond it
    const owners = ownership(2, Object.fromEntries([...territoriesOf('northAmerica').filter(id => id !== 'greenland'), 'iceland'].map(id => [id, 1])));
    await table.patch(attacking({ owners }));
    await button(alice, 'Stop attacking and fortify').click();
    await expect(panelTitle(alice)).toHaveText('Fortify');
    await disc(alice, 'alaska').click();
    await expect(land(alice, 'quebec')).toHaveClass(/can-target/); // through Alberta and Ontario
    await expect(land(alice, 'iceland')).not.toHaveClass(/can-target/);
    await expect(land(alice, 'kamchatka')).not.toHaveClass(/can-target/);
    await disc(alice, 'quebec').click();
    await expect(slider(alice)).toHaveAttribute('max', '2');
    await button(alice, 'Move 2 and end turn').click();
    await expect(armiesOn(alice, 'alaska')).toHaveText('1');
    await expect(armiesOn(alice, 'quebec')).toHaveText('5');
    await expect(turn(bob)).toHaveText('Your turn');

    await table.patch(attacking({ owners }));
    await button(alice, 'End turn').click();
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('earning cards: a turn with a capture ends with one card drawn, and a turn without none', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 5, kamchatka: 1 }) }));
    await button(alice, 'End turn').click();
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(alice.locator('.card-hand .panel-title')).toHaveText('Your cards (0)');

    await table.patch(attacking({ armies: armiesWith({ alaska: 5, kamchatka: 1 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 6, 1);
    await rollDice(alice, 3);
    await button(alice, 'Move 4').click();
    await button(alice, 'End turn').click();
    await expect(alice.locator('.card-hand .panel-title')).toHaveText('Your cards (1)');
    await expect(card(alice, 'Alaska')).toHaveCount(1); // the top card of the ordered deck
    await expect(playerRow(bob, 'Alice').locator('.player-stats')).toContainText('1 card');
  });

  test('elimination: the player who took the last territory takes the cards, and with 6 or more trades down to 4 at once, places them and attacks on', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch(attacking({
      owners: ownership(1, { kamchatka: 2, greenland: 3 }),
      armies: armiesWith({ alaska: 6, kamchatka: 1 }),
      hands: { 1: [0, 3], 2: [6, 9, 12, WILD], 3: [] }
    }));
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 6, 1);
    await rollDice(alice, 3);
    await expect(playerRow(alice, 'Bob').locator('.player-status')).toHaveText('eliminated');
    await expect(playerRow(bob, 'Alice').locator('.player-stats')).toContainText('6 cards');
    await expect(cards(alice)).toHaveCount(6);

    await button(alice, 'Move 5').click();
    await expect(panelTitle(alice)).toHaveText('Trade the cards you took');
    await expect(panel(alice)).toContainText('You hold 6 cards: trade a set below before placing.');
    await trade(alice, 'Alaska', 'Alberta', 'Western United States');
    await expect(cards(alice)).toHaveCount(3);
    await expect(alice.getByRole('button', { name: /^Trade for/ })).toHaveCount(0); // 4 or fewer: no more trading
    await expect(alice.locator('.armies-left')).toHaveText('4 of 4 armies left to place');
    await button(alice, 'All').click();
    await disc(alice, 'kamchatka').click();
    await button(alice, 'Place and attack').click();
    await expect(armiesOn(alice, 'kamchatka')).toHaveText('9');
    await expect(panelTitle(alice)).toHaveText('Attack');
  });

  test('winning: control all 42 territories, or be the only player left holding any', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch(attacking({ owners: ownership(1, { kamchatka: 2 }), armies: armiesWith({ alaska: 4, kamchatka: 1 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 1);
    await rollDice(alice, 2);
    await expect(turn(bob)).toHaveText('Game over: Alice wins');
    await expect(bob.locator('.game-status')).toContainText('Alice wins: they control the whole world');

    // Cara is out and Greenland is neutral: taking Bob's last territory leaves Alice the only one holding any
    const other = await start(seat);
    await other.table.patch(attacking({
      owners: ownership(1, { kamchatka: 2, greenland: null }), eliminated: [3], armies: armiesWith({ alaska: 4, kamchatka: 1 })
    }));
    await choose(other.alice, 'alaska', 'kamchatka');
    await other.table.dice(6, 6, 1);
    await rollDice(other.alice, 2);
    await expect(turn(other.bob)).toHaveText('Game over: Alice wins');
    await expect(other.bob.locator('.game-status')).toContainText('Alice wins: no other player holds a territory');
  });

  test('hidden: others see only how many cards a player holds, a traded set is shown to everyone, and the History dialog shows no cards', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch(crafted({ hands: { 1: [0, 3, 6], 2: [1], 3: [] } }));
    await expect(cards(alice)).toHaveCount(3);
    await expect(cards(bob)).toHaveCount(1);
    await expect(card(bob, 'Northwest Territory')).toHaveCount(1);
    await expect(bob.locator('.risk-card', { hasText: 'Alaska' })).toHaveCount(0);
    await expect(playerRow(bob, 'Alice').locator('.player-stats')).toContainText('3 cards');
    await expect(bob.locator('.deck-line')).toHaveText('Next set: 4 armies. Cards in the deck: 44'); // a count, not the order

    await trade(alice, 'Alaska', 'Alberta', 'Western United States');
    await expect(events(bob).first()).toHaveText('Alice put 2 more armies on Alaska, shown on a traded card');
    await expect(events(bob).nth(1)).toHaveText('Alice traded Alaska (infantry), Alberta (infantry), Western United States (infantry) for 4 armies');

    await table.patch({ hands: { 1: [9], 2: [1], 3: [] } });
    await button(bob, 'History').click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.world-map')).toBeVisible();
    await expect(history.locator('.risk-card')).toHaveCount(0);
    await expect(history.getByLabel('View as')).toHaveCount(0);
  });

  test('hidden: a saved game viewed as a player shows that player\'s cards, and the table view shows none', async ({ seat, visitor }) => {
    const { table, alice } = await start(seat);
    await table.patch(attacking({ owners: ownership(1, { kamchatka: 2 }), armies: armiesWith({ alaska: 4, kamchatka: 1 }), hands: { 1: [0, 3], 2: [1], 3: [2] } }));
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 1);
    await rollDice(alice, 2);
    await expect(turn(alice)).toHaveText('Game over: Alice wins');
    await expect(cards(alice)).toHaveCount(3); // Bob's card came with his last territory

    await button(alice, 'History').click();
    const [download] = await Promise.all([alice.waitForEvent('download'), button(alice, 'Download game').click()]);
    const file = test.info().outputPath('risk-game.json');
    await download.saveAs(file);

    await visitor.goto('/');
    await visitor.locator('input[type="file"]').setInputFiles(file);
    const saved = visitor.getByRole('dialog', { name: 'History' });
    await expect(saved).toContainText(`Saved game: ${table.gameId}`);
    await expect(saved.locator('.risk-card')).toHaveCount(0);
    await saved.getByLabel('View as').selectOption({ label: 'Alice' });
    await expect(saved.locator('.risk-card')).toHaveCount(3);
    await saved.getByLabel('View as').selectOption({ label: 'Cara' });
    await expect(saved.locator('.risk-card')).toHaveText([/Greenland/]);
    await saved.getByLabel('View as').selectOption({ label: 'Table only' });
    await expect(saved.locator('.risk-card')).toHaveCount(0);
  });

  test('dismissed on their turn: the territories turn neutral (grey) with their armies, the cards are discarded, the next player starts, and two play on', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch(attacking({ currentPlayer: 3, turnHolder: 3, armies: armiesWith({ greenland: 4 }), hands: { 1: [], 2: [], 3: [7, 8] } }));
    await expect(playerRow(alice, 'Cara').locator('.player-stats')).toContainText('2 cards');
    await leave(cara);
    await dismiss('Cara', alice, bob);

    await expect(land(alice, 'greenland')).toHaveAttribute('aria-label', 'Greenland: neutral, 4 armies');
    await expect(land(alice, 'greenland')).toHaveClass(/seat-neutral/);
    const [red, green, blue] = (await rgb(alice, '[data-anim-key="territory-greenland"] .disc')).match(/\d+/g)!.map(Number);
    expect(red === green && green === blue).toBe(true);
    await expect(playerRow(alice, 'Cara').locator('.player-status')).toHaveText('left');
    await expect(playerRow(alice, 'Cara').locator('.player-stats')).toContainText('0 cards');
    await expect(playerRow(alice, 'Neutral').locator('.player-stats')).toContainText('14 territories');
    expect((await table.state<GameState>()).discard).toEqual([7, 8]);

    await expect(turn(alice)).toHaveText('Your turn');
    await expect(panelTitle(alice)).toHaveText('Reinforce');
    await expect(turn(bob)).toHaveText("Alice's turn");
  });

  test('neutral armies never attack or move and count for nobody, but defend with the usual dice and can be captured', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 5, kamchatka: 2 }) }));
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(land(alice, 'kamchatka')).toHaveAttribute('aria-label', 'Kamchatka: neutral, 2 armies');
    await expect(panelTitle(alice)).toHaveText('Attack'); // Alice's turn goes on
    await expect(playerRow(alice, 'Neutral').locator('.player-stats')).not.toContainText('a turn');

    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 6, 1, 1);
    await rollDice(alice, 3);
    await expect.poll(() => diceShown(alice, 'defend')).toEqual(['1', '1']);
    await expect(battle(alice).locator('.battle-who')).toHaveText(['Alice', 'Neutral']);
    await expect(battle(alice)).toContainText('Kamchatka was captured');
    await button(alice, 'Move 4').click();
    await button(alice, 'End turn').click();
    // Neutral never takes a turn: Bob, then Alice again
    await expect(turn(bob)).toHaveText('Your turn');
    await button(bob, 'All').click();
    await bob.locator('.territory.selectable .disc').first().click();
    await button(bob, 'Place and attack').click();
    await button(bob, 'End turn').click();
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('dismissed during the setup: the next player places', async ({ seat, join }) => {
    const table = await seat('risk', ['Alice', 'Bob']);
    await table.random(0); // Alice goes first
    const cara = await join(table, 'Cara');
    const [alice, bob] = table.pages;
    await placeAllStarting(alice);
    await expect(turn(bob)).toHaveText('Place your starting armies');
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(turn(cara)).toHaveText('Place your starting armies');
    await placeAllStarting(cara);
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('dismissed while moving into a captured territory: the dice they rolled move in first', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 5, kamchatka: 1 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 6, 1);
    await rollDice(alice, 3);
    await expect(panelTitle(alice)).toHaveText('Move into Kamchatka');
    await leave(alice);
    await dismiss('Alice', bob, cara);
    await expect(land(bob, 'kamchatka')).toHaveAttribute('aria-label', 'Kamchatka: neutral, 3 armies');
    await expect(land(bob, 'alaska')).toHaveAttribute('aria-label', 'Alaska: neutral, 2 armies');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('dismissed: the game ends when only one player still holds territory', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch(attacking({ owners: ownership(1, { greenland: 3 }), eliminated: [2] }));
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(turn(alice)).toHaveText('Game over: Alice wins');
  });

  test('undo needs every player\'s approval, and an attack played again rolls new dice', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 4 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(1, 1, 1, 6, 6);
    await rollDice(alice, 3);
    await expect(armiesOn(alice, 'alaska')).toHaveText('2');

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(armiesOn(alice, 'alaska')).toHaveText('2');

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Approve' }).click();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(armiesOn(alice, 'alaska')).toHaveText('2'); // Cara has not approved yet
    await cara.getByRole('button', { name: 'Approve' }).click();
    await expect(armiesOn(alice, 'alaska')).toHaveText('4');
    await expect(armiesOn(alice, 'kamchatka')).toHaveText('3');

    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 6, 1, 1);
    await rollDice(alice, 3);
    await expect(armiesOn(alice, 'kamchatka')).toHaveText('1');
    await expect(armiesOn(alice, 'alaska')).toHaveText('4');
  });
});

test.describe('Risk controls', () => {
  test('each territory is a disc in its owner\'s color with its army count, borders are lines and sea lanes dashed, and Alaska\'s lane runs off both edges', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(crafted({ armies: armiesWith({ alaska: 7 }) }));
    await expect(armiesOn(alice, 'alaska')).toHaveText('7');
    await expect(land(alice, 'alaska')).toHaveAttribute('aria-label', 'Alaska: Alice, 7 armies');
    const aliceColor = await rgb(alice, '[data-anim-key="territory-alaska"] .disc');
    expect(aliceColor).toBe(await rgb(alice, '.player-row:has(.player-name:text-matches("^Alice")) .swatch'));
    expect(await rgb(alice, '[data-anim-key="territory-alberta"] .disc')).toBe(aliceColor);
    expect(await rgb(alice, '[data-anim-key="territory-northwestTerritory"] .disc')).not.toBe(aliceColor);

    const dashes = (selector: string) => alice.locator(selector).evaluateAll(lines => [...new Set(lines.map(line => getComputedStyle(line).strokeDasharray))]);
    expect(await dashes('line.border:not(.sea-lane)')).toEqual(['none']);
    const sea = await dashes('.sea-lane line, line.sea-lane');
    expect(sea).toHaveLength(1);
    expect(sea[0]).not.toBe('none');

    const lane = alice.locator('g.sea-lane line');
    await expect(lane).toHaveCount(2);
    await expect(lane.nth(0)).toHaveAttribute('x2', '1000');
    await expect(lane.nth(1)).toHaveAttribute('x1', '0');
  });

  test('on a narrow window the map scrolls sideways in its own box', async ({ seat }) => {
    const { alice } = await start(seat);
    await alice.setViewportSize({ width: 400, height: 800 });
    const box = alice.locator('.risk-layout .map-area');
    await expect.poll(() => box.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await box.evaluate(element => getComputedStyle(element).overflowX)).toBe('auto');
    expect(await box.evaluate(element => { element.scrollLeft = 120; return element.scrollLeft; })).toBeGreaterThan(0);
  });

  test('placing: each click adds 1, 5 or all that are left, -1 takes one back, then Place', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(crafted({ reinforcements: 7 }));
    await expect(alice.locator('.armies-left')).toHaveText('7 of 7 armies left to place');
    await button(alice, '5').click();
    await expect(button(alice, '5')).toHaveAttribute('aria-pressed', 'true');
    await disc(alice, 'alaska').click();
    await expect(land(alice, 'alaska').locator('.draft-badge')).toHaveText('+5');
    await button(alice, '1').click();
    await disc(alice, 'alberta').click();
    await expect(alice.locator('.draft-list li span')).toHaveText(['5 on Alaska', '1 on Alberta']);
    await expect(alice.locator('.armies-left')).toHaveText('1 of 7 armies left to place');
    await alice.getByRole('button', { name: 'Take one back from Alaska' }).click();
    await expect(alice.locator('.draft-list li span')).toHaveText(['4 on Alaska', '1 on Alberta']);
    await button(alice, 'All').click();
    await disc(alice, 'westernUnitedStates').click();
    await expect(land(alice, 'westernUnitedStates').locator('.draft-badge')).toHaveText('+2');
    await expect(alice.locator('.armies-left')).toHaveText('0 of 7 armies left to place');
    await expect(land(alice, 'quebec')).not.toHaveClass(/selectable/);
    await button(alice, 'Place and attack').click();
    await expect(armiesOn(alice, 'alaska')).toHaveText('7');
    await expect(armiesOn(alice, 'alberta')).toHaveText('4');
    await expect(armiesOn(alice, 'westernUnitedStates')).toHaveText('5');
  });

  test('attacking: click an outlined territory, then a highlighted enemy, choose dice and Roll or Blitz; the choice stays and everyone sees the dice', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 4, alberta: 1 }) }));
    await expect(land(alice, 'alaska')).toHaveClass(/selectable/);
    await expect(land(alice, 'alberta')).not.toHaveClass(/selectable/);
    await choose(alice, 'alaska', 'kamchatka');
    await expect(panel(alice)).toContainText('Alaska (4) attacks Kamchatka (3).');
    await expect(button(alice, 'Blitz')).toBeVisible();
    const one = alice.getByRole('group', { name: 'Dice' }).getByRole('button', { name: '1', exact: true });
    await one.click();
    await expect(one).toHaveAttribute('aria-pressed', 'true');

    await table.dice(6, 1, 1);
    await button(alice, 'Roll 1 die').click();
    await expect(armiesOn(alice, 'kamchatka')).toHaveText('2');
    await expect(panel(alice)).toContainText('Alaska (4) attacks Kamchatka (2).');
    await expect(button(alice, 'Roll 1 die')).toBeVisible();
    await expect(land(alice, 'alaska')).toHaveClass(/\bsource\b/);
    await expect(land(alice, 'kamchatka')).toHaveClass(/\btarget\b/);

    await expect(battle(bob)).toContainText('Alaska attacked Kamchatka');
    await expect.poll(() => diceShown(bob, 'attack')).toEqual(['6']);
    expect(await diceShown(bob, 'defend')).toEqual(['1', '1']);
  });

  test('after a capture, choose the armies with the slider and click Move', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 8, kamchatka: 1 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 6, 1);
    await rollDice(alice, 3);
    await expect(button(alice, 'Move 7')).toBeVisible();
    await slider(alice).fill('5');
    await expect(alice.locator('.army-slider output')).toHaveText('5');
    await expect(panel(alice)).toContainText('3 stay in Alaska');
    await button(alice, 'Move 5').click();
    await expect(armiesOn(alice, 'kamchatka')).toHaveText('5');
    await expect(armiesOn(alice, 'alaska')).toHaveText('3');
  });

  test('Stop attacking and fortify, pick two territories, choose the armies with the slider and Move to end the turn, or End turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const owners = ownership(2, { alaska: 1, alberta: 1, ontario: 1 });
    await table.patch(attacking({ owners, armies: armiesWith({ alaska: 6 }) }));
    await button(alice, 'Stop attacking and fortify').click();
    await choose(alice, 'alaska', 'ontario');
    await slider(alice).fill('1');
    await button(alice, 'Move 1 and end turn').click();
    await expect(armiesOn(alice, 'ontario')).toHaveText('4');
    await expect(armiesOn(alice, 'alaska')).toHaveText('5');
    await expect(turn(bob)).toHaveText('Your turn');

    await table.patch(attacking({ owners }));
    await button(alice, 'Stop attacking and fortify').click();
    await button(alice, 'End turn').click();
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('your cards are listed with their symbol and territory; while placing, pick three and click Trade', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(crafted({ hands: { 1: [0, 1, 2, WILD], 2: [], 3: [] } }));
    await expect(alice.locator('.card-hand .card-symbol')).toHaveText(['I', 'C', 'A', 'W']);
    await expect(alice.locator('.card-hand .card-territory')).toHaveText(['Alaska', 'Northwest Territory', 'Greenland', 'Wild']);
    await expect(alice.locator('.card-hand .card-kind')).toHaveText(['infantry, yours', 'cavalry', 'artillery', 'wild']);
    await trade(alice, 'Alaska', 'Northwest Territory', 'Greenland');
    await expect(cards(alice)).toHaveCount(1);
    await expect(alice.locator('.armies-left')).toHaveText('7 of 7 armies left to place'); // 3 and a set of 4
  });

  test('the player list shows territories, armies, cards, whole continents and next turn\'s armies, the next set and the deck; Recent events are newest first', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const base = game();
    await table.patch(crafted({
      owners: { ...base.owners, indonesia: 1, westernAustralia: 1, easternAustralia: 1 },
      hands: { 1: [0, 3], 2: [1], 3: [] },
      tradeCount: 2,
      deck: ALL_CARDS.slice(10),
      log: ['An older event']
    }));
    const stats = playerRow(alice, 'Alice').locator('.player-stats span');
    await expect(stats).toHaveText(['17 territories', '51 armies', '2 cards', '+7 a turn']); // 5 for 17, 2 for Australia
    await expect(playerRow(alice, 'Alice').locator('.chip')).toHaveText(['Australia']);
    await expect(playerRow(alice, 'Bob').locator('.player-stats span')).toHaveText(['13 territories', '39 armies', '1 card', '+4 a turn']);
    await expect(alice.locator('.deck-line')).toHaveText('Next set: 8 armies. Cards in the deck: 34');

    await button(alice, 'All').click();
    await disc(alice, 'alaska').click();
    await button(alice, 'Place and attack').click();
    await expect(events(alice)).toHaveText(['Alice placed 3 on Alaska', 'An older event']);
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch(crafted());
    await expect(button(alice, 'Undo')).toBeDisabled(); // nothing to undo yet
    await button(alice, 'All').click();
    await disc(alice, 'alaska').click();
    await button(alice, 'Place and attack').click();
    await button(alice, 'Undo').click();
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Blitz');
    await expect(faq).toContainText('42 territories');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Risk differences from Wikipedia', () => {
  test('the territories are dealt at random with one army each, and each player places all their starting armies in a single move', async ({ seat, join }) => {
    const table = await seat('risk', ['Alice', 'Bob']);
    await table.random(0); // Alice goes first
    await join(table, 'Cara');
    const [alice, bob] = table.pages;
    await expect(alice.locator('.army-count')).toHaveText(Array(42).fill('1'));
    await expect(alice.locator('.territory[aria-label*="unclaimed"]')).toHaveCount(0);
    await alice.locator('.territory.selectable .disc').first().click();
    await expect(alice.locator('.armies-left')).toHaveText('20 of 21 armies left to place');
    await expect(button(alice, 'Place all')).toBeDisabled(); // 1 of 21 is not all
    await button(alice, 'Clear').click();
    await placeAllStarting(alice);
    await expect(turn(bob)).toHaveText('Place your starting armies');
  });

  test('who goes first is drawn at random', async ({ seat, join }) => {
    const table = await seat('risk', ['Alice', 'Bob']);
    await table.random(0.99); // the last of three seats
    const cara = await join(table, 'Cara');
    await expect(cara.locator('.game-status')).toContainText('Cara was drawn to go first');
    await expect(turn(cara)).toHaveText('You place first. Joining closes after the first move.');
  });

  test('the defender always rolls the most dice allowed and never chooses', async ({ seat }) => {
    const { table, alice, cara } = await start(seat);
    await table.patch(attacking());
    await expect(panel(cara)).toHaveText('Waiting for Alice to attack');
    await expect(cara.getByRole('group', { name: 'Dice' })).toHaveCount(0);
    await choose(alice, 'alaska', 'kamchatka');
    await alice.getByRole('group', { name: 'Dice' }).getByRole('button', { name: '1', exact: true }).click();
    await table.dice(1, 6, 6);
    await button(alice, 'Roll 1 die').click();
    await expect.poll(() => diceShown(cara, 'defend')).toEqual(['6', '6']); // 2 dice against 1
  });

  test('Blitz repeats attacks with the most dice, each roll still random', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(attacking({ armies: armiesWith({ alaska: 5, kamchatka: 2 }) }));
    await choose(alice, 'alaska', 'kamchatka');
    await expect(button(alice, 'Blitz')).toHaveAttribute('title', 'Attack with the most dice until the territory falls or 1 army is left');
    // First roll: 3 dice lose 2 on ties; second: 2 dice (3 armies left) win both
    await table.dice(1, 1, 1, 1, 1, 6, 6, 1, 1);
    await button(alice, 'Blitz').click();
    await expect(battle(alice)).toContainText('(blitz, 2 rolls, last roll shown)');
    expect(await diceShown(alice, 'attack')).toEqual(['6', '6']);
    await expect(panelTitle(alice)).toHaveText('Move into Kamchatka');
  });

  test('card symbols are assigned in turn around the map', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(crafted({ hands: { 1: [0, 1, 2, 3, 4], 2: [], 3: [] } }));
    await expect(alice.locator('.card-hand .card-territory')).toHaveText(['Alaska', 'Northwest Territory', 'Greenland', 'Alberta', 'Ontario']);
    await expect(alice.locator('.card-hand .card-symbol')).toHaveText(['I', 'C', 'A', 'I', 'C']);
  });

  test('the 2 bonus armies go to the first card in the set that shows a territory you hold, once a turn', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // Alberta, Alaska and Western United States are all Alice's; Alberta is picked first
    await table.patch(crafted({ hands: { 1: [0, 3, 6], 2: [], 3: [] } }));
    await trade(alice, 'Alberta', 'Alaska', 'Western United States');
    await expect(armiesOn(alice, 'alberta')).toHaveText('5');
    await expect(armiesOn(alice, 'alaska')).toHaveText('3');
    await expect(armiesOn(alice, 'westernUnitedStates')).toHaveText('3');
  });

  test('trading is done only while placing armies', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch(attacking({ hands: { 1: [0, 3, 6], 2: [], 3: [] } }));
    await expect(cards(alice)).toHaveCount(3);
    await expect(alice.locator('.card-hand button')).toHaveCount(0);
    await table.patch({ phase: 'reinforce', reinforcements: 3 });
    await expect(alice.getByRole('button', { name: /^Trade for/ })).toBeVisible();
  });

  test('fortify may move armies through any chain of your own territories', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const chain = ['alaska', 'alberta', 'westernUnitedStates', 'easternUnitedStates', 'quebec'];
    await table.patch(attacking({ phase: 'fortify', owners: ownership(2, Object.fromEntries(chain.map(id => [id, 1]))) }));
    await disc(alice, 'alaska').click();
    for (const id of chain.slice(1)) await expect(land(alice, id)).toHaveClass(/can-target/);
    await expect(alice.locator('.territory.can-target')).toHaveCount(4);
  });

  test('two players cannot play: the deal waits for a third', async ({ seat }) => {
    const table = await seat('risk', ['Alice', 'Bob']);
    const [alice] = table.pages;
    await expect(turn(alice)).toHaveText('Waiting for 1 more player (3 to 6 play)');
    await expect(alice.locator('.territory[aria-label*="unclaimed"]')).toHaveCount(42);
    await expect(alice.locator('.phase-panel')).toHaveCount(0);
  });

  test('the only player left holding territory wins, even with neutral territories on the map', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    // Cara leaves first; then Alice takes Bob's last territory, with Cara's neutral ones still standing
    await table.patch(attacking({ owners: ownership(1, { kamchatka: 2, greenland: 3, iceland: 3 }), armies: armiesWith({ alaska: 4, kamchatka: 1 }) }));
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(land(alice, 'greenland')).toHaveClass(/seat-neutral/);
    await choose(alice, 'alaska', 'kamchatka');
    await table.dice(6, 6, 1);
    await rollDice(alice, 2);
    await expect(turn(bob)).toHaveText('Game over: Alice wins');
    await expect(land(bob, 'greenland')).toHaveClass(/seat-neutral/);
  });

  test('leaving: a dismissed player\'s territories turn neutral, their cards are discarded, and play goes on with 2', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch(attacking({ hands: { 1: [], 2: [], 3: [5, 8] } }));
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(land(alice, 'greenland')).toHaveAttribute('aria-label', 'Greenland: neutral, 3 armies');
    await expect(playerRow(alice, 'Cara').locator('.player-stats')).toContainText('0 cards');
    expect((await table.state<GameState>()).discard).toEqual([5, 8]);
    await button(alice, 'End turn').click();
    await expect(turn(bob)).toHaveText('Your turn');
  });
});
