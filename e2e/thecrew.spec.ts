import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import type { Card, GameState, OrderToken, Task } from '../games/thecrew/types.ts';

// One test per rule, control and difference in games/thecrew/README.md. Seats join in order: Alice 1, Bob 2, Cara 3
// (Dan 4 and Eve 5 where a test needs them). Crafted states make Alice the commander, so she leads, and play runs
// Alice, Bob, Cara.

const p = (value: number): Card => ({ suit: 'pink', value });
const b = (value: number): Card => ({ suit: 'blue', value });
const g = (value: number): Card => ({ suit: 'green', value });
const y = (value: number): Card => ({ suit: 'yellow', value });
const r = (value: number): Card => ({ suit: 'rocket', value });
const label = (card: Card) => `${card.suit} ${card.value}`;
const task = (card: Card, owner: number | null, token: OrderToken | null = null): Task => ({ card, token, owner, done: false });
const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve'];

async function start(seat: Seat, count = 3): Promise<{ table: Table; pages: Page[] }> {
  const table = await seat('thecrew', NAMES.slice(0, count));
  return { table, pages: table.pages };
}

// An attempt under way: Alice is commander and leads the first trick of `mission`
async function playing(table: Table, fields: Partial<GameState>): Promise<void> {
  await table.patch({
    started: true,
    mission: 1,
    attempt: 1,
    phase: 'play',
    commander: 1,
    currentPlayer: 1,
    tasks: [],
    chosen: [],
    communications: {},
    distress: null,
    passedThisAttempt: false,
    handedOver: false,
    trick: [],
    lastTrick: null,
    tricks: [],
    roundSummary: null,
    endVotes: {},
    lastMove: null,
    ...fields
  });
}

// Tricks already played, so the next one is the last with `players` at the table
const tricksBefore = (count: number, winner = 1) => Array.from({ length: count }, () => ({ plays: [], winner }));

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCard = (page: Page, card: Card) => hand(page).getByRole('button', { name: label(card), exact: true });
const seatOf = (page: Page, name: string) => page.getByLabel(`Seat of ${name}`);
const turn = (page: Page) => page.locator('.turn-message');
const status = (page: Page) => page.locator('.game-status');
const result = (page: Page) => page.getByRole('dialog', { name: 'Mission result' });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const rules = (page: Page) => page.getByRole('list', { name: 'Mission rules' });

async function playTrick(pages: Page[], cards: Card[]): Promise<void> {
  for (const [index, card] of cards.entries()) await handCard(pages[index], card).click();
}

test.describe('The Crew rules', () => {
  test('40 cards, four colors 1 to 9 and rockets 1 to 4, all dealt out; with three players one gets an extra card', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    const state = await table.state<GameState>();
    const all = Object.values(state.hands).flat().map(label);
    expect(new Set(all).size).toBe(40);
    for (const suit of ['pink', 'blue', 'green', 'yellow']) for (let v = 1; v <= 9; v++) expect(all).toContain(`${suit} ${v}`);
    for (let v = 1; v <= 4; v++) expect(all).toContain(`rocket ${v}`);
    const counts = await alice.locator('.seat-count').allTextContents();
    expect(counts.map(text => text.split(' ')[0]).sort()).toEqual(['13', '13', '14']);
    await expect(alice.locator('.mission-info')).toContainText('Trick 1 of 13');
  });

  test('the holder of the 4 rocket is commander and takes the first task, then the others take tasks in turn to the left', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const state = await table.state<GameState>();
    const commander = state.commander ?? 0;
    expect(state.hands[commander].map(label)).toContain('rocket 4');
    const page = pages[commander - 1];
    await expect(seatOf(page, NAMES[commander - 1]).locator('.seat-badge')).toHaveText('Commander');
    await expect(turn(page)).toHaveText(/^Your turn/);

    // Mission 4: three tasks, taken commander first then to the left
    await playing(table, { started: false, mission: 4, phase: 'choose', tasks: [task(p(1), null), task(b(2), null), task(g(3), null)] });
    const [alice, bob, cara] = pages;
    await expect(alice.locator('.hint')).toHaveText('Take a task');
    await button(alice, 'Take task blue 2').click();
    await expect(turn(bob)).toHaveText('Your turn');
    await button(bob, 'Take task pink 1').click();
    await button(cara, 'Take task green 3').click();
    await expect(seatOf(alice, 'Bob').getByLabel('task pink 1')).toBeVisible();
    await expect(status(alice)).toHaveText('Cara took the task green 3');
    await expect(turn(alice)).toHaveText('Your turn'); // the commander leads the first trick
  });

  test('follow suit if you can; rockets are trump and the highest rocket wins, else the highest of the suit led; the winner leads', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, {
      hands: { 1: [p(5), b(1)], 2: [p(9), r(1), b(2)], 3: [g(4), r(2), b(3)] },
      tasks: [task(b(3), 1)]
    });
    await handCard(alice, p(5)).click();
    await expect(handCard(bob, r(1))).toBeDisabled(); // Bob holds pink
    await handCard(bob, p(9)).click();
    // Cara has no pink: anything goes, and her rocket wins
    await expect(handCard(cara, g(4))).toBeEnabled();
    await handCard(cara, r(2)).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Cara won the trick');
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(seatOf(alice, 'Cara').locator('.seat-count')).toHaveText('2 cards, 1 trick');
  });

  test('a task is done when its owner wins its card; anyone else winning it fails the mission at once', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    const hands = { 1: [p(9), b(9)], 2: [p(1), b(1)], 3: [p(2), b(2)] };
    await playing(table, { hands, tasks: [task(p(1), 1), task(b(1), 1)] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(seatOf(alice, 'Alice').locator('.task-done')).toHaveCount(1);
    await expect(result(alice)).toHaveCount(0);

    await playing(table, { hands, tasks: [task(p(1), 2)] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(result(alice).getByRole('heading')).toHaveText('Mission 1 failed');
    await expect(status(alice)).toHaveText('Mission 1 failed: Alice won pink 1, which was Bob\'s task');
  });

  test('the mission succeeds when every task is done, and fails if the tricks run out first', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tasks: [task(p(1), 1)] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(result(alice).getByRole('heading')).toHaveText('Mission 1 complete');
    await expect(status(alice)).toHaveText('Mission 1 complete!');

    // Three players: the last trick is the 13th, and the task card was the unplayed one
    await playing(table, { hands: { 1: [b(9), p(1)], 2: [b(1)], 3: [b(2)] }, tasks: [task(p(1), 2)], tricks: tricksBefore(12) });
    await playTrick(pages, [b(9), b(1), b(2)]);
    await expect(status(alice)).toHaveText('Mission 1 failed: The tricks ran out before the mission was done');
  });

  test('order tokens: numbers fix a task\'s place among all tasks, arrows only order the arrow tasks, omega is last', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    const hands = { 1: [p(9), b(9), g(9)], 2: [p(1), b(1), g(1)], 3: [p(2), b(2), g(2)] };
    await playing(table, { mission: 3, hands, tasks: [task(p(1), 1, 1), task(b(1), 1, 2)] });
    await expect(seatOf(alice, 'Alice').locator('.task-token')).toHaveText(['1', '2']);
    await playTrick(pages, [b(9), b(1), b(2)]);
    await expect(status(alice)).toHaveText('Mission 3 failed: The tasks were not done in the order their tokens give');

    // Arrows: an untokened task may come first
    await playing(table, { mission: 6, hands, tasks: [task(p(1), 1, '>'), task(b(1), 1, '>>'), task(g(1), 1)] });
    await playTrick(pages, [g(9), g(1), g(2)]);
    await expect(result(alice)).toHaveCount(0);

    // Omega first fails
    await playing(table, { mission: 7, hands, tasks: [task(p(1), 1), task(b(1), 1), task(g(1), 1, 'omega')] });
    await expect(seatOf(alice, 'Alice').locator('.task-token')).toHaveText('Ω');
    await playTrick(pages, [g(9), g(1), g(2)]);
    await expect(result(alice)).toBeVisible();
  });

  test('communication: once per mission, between tricks only, a true highest, lowest or only card, never a rocket', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, {
      hands: { 1: [p(9), p(4), p(6), r(4), b(1)], 2: [p(1), g(2), b(2)], 3: [p(5), g(3), b(3)] },
      tasks: [task(p(1), 1)]
    });
    await button(alice, 'Communicate').click();
    await expect(alice.locator('.hint')).toHaveText('Pick the card to communicate: your highest, lowest or only card of its color');
    await expect(handCard(alice, p(6))).toBeDisabled(); // neither highest, lowest nor only
    await expect(handCard(alice, r(4))).toBeDisabled();
    await handCard(alice, p(9)).click();
    await expect(alice.locator('.action-buttons button').filter({ hasText: 'is my' })).toHaveText(['pink 9 is my highest']);
    await button(alice, 'pink 9 is my highest').click();
    await expect(status(bob)).toHaveText('Alice communicated pink 9: their highest pink');
    await expect(bob.getByLabel('Alice\'s communication')).toContainText('highest');
    await expect(button(alice, 'Communicate')).toHaveCount(0); // once per mission
    // During a trick nobody may communicate
    await handCard(alice, b(1)).click();
    await expect(button(bob, 'Communicate')).toHaveCount(0);
    await handCard(bob, b(2)).click();
    await handCard(cara, b(3)).click();
    await expect(button(bob, 'Communicate')).toBeVisible();
  });

  test('a dead spot shows no token, and a disruption holds communication off until its trick', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    const hands = { 1: [p(9), p(4), b(1)], 2: [p(1), g(2), b(2)], 3: [p(5), g(3), b(3)] };
    await playing(table, { mission: 6, hands, tasks: [task(p(1), 1, '>')] });
    await expect(rules(alice)).toContainText('Dead spot: a communicated card shows no radio token');
    await button(alice, 'Communicate').click();
    await handCard(alice, p(4)).click();
    await button(alice, 'Communicate pink 4').click();
    await expect(bob.getByLabel('Alice\'s communication')).toContainText('no token (dead spot)');

    await playing(table, { mission: 18, hands, tasks: [task(p(1), 1)] });
    await expect(rules(alice)).toContainText('Disruption: nobody may communicate before trick 2');
    await expect(button(alice, 'Communicate')).toHaveCount(0);
    await playTrick(pages, [b(1), b(2), b(3)]);
    await expect(button(cara, 'Communicate')).toBeVisible();
  });

  test('the distress signal: everyone passes a non-rocket card the same way, and the logbook counts one more attempt', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { hands: { 1: [p(9), r(4), b(1)], 2: [p(1), g(2), b(2)], 3: [p(5), g(3), b(3)] }, tasks: [task(p(1), 1)] });
    await button(alice, 'Distress signal: pass left').click();
    await expect(status(bob)).toHaveText('Alice sent a distress signal: everyone passes a card to the left');
    await expect(handCard(alice, r(4))).toBeDisabled();
    for (const [page, card] of [[alice, b(1)], [bob, b(2)], [cara, b(3)]] as const) {
      await handCard(page, card).click();
      await button(page, `Pass ${label(card)}`).click();
    }
    await expect(status(alice)).toHaveText('Everyone passed a card to the left');
    // Left is the next seat: Alice's blue 1 went to Bob, Cara's blue 3 to Alice
    await expect(handCard(alice, b(3))).toBeVisible();
    await expect(handCard(bob, b(1))).toBeVisible();
    await expect(button(alice, 'Distress signal: pass left')).toHaveCount(0);
    await playTrick(pages, [p(9), p(1), p(5)]);
    await expect(result(alice).locator('.summary-detail')).toHaveText('Attempts for the logbook: 2 (the distress signal adds one)');
  });

  test('success deals the next mission, failure retries it with the attempt count up, and the next attempt waits for every connected player', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tasks: [task(p(1), 2)] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await button(alice, 'Continue').click();
    await expect(result(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob, Cara');
    await button(bob, 'Continue').click();
    await leave(cara);
    await expect(alice.locator('.mission-info')).toContainText('Mission 1Attempt 2');
    await expect(status(alice)).toHaveText('Mission 1, attempt 2');
  });

  test('a successful mission is followed by the next one', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 4, hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tasks: [task(p(1), 1)] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    for (const page of pages) await button(page, 'Continue').click();
    await expect(alice.locator('.mission-number')).toHaveText('Mission 5');
    await expect(rules(alice)).toContainText('The commander names a sick crew member, who must not win a single trick');
  });

  test('with five players, from mission 25 on, the commander can hand one task to another crew member before the first trick', async ({ seat }) => {
    const { table, pages } = await start(seat, 5);
    const [alice] = pages;
    const hands = { 1: [p(9)], 2: [p(1)], 3: [p(5)], 4: [p(3)], 5: [p(2)] };
    await playing(table, { mission: 24, hands, tasks: [task(p(1), 2), task(p(2), 3)] });
    await expect(alice.getByRole('group', { name: 'Hand over a task' })).toHaveCount(0);
    await playing(table, { mission: 25, hands, tasks: [task(p(1), 2), task(p(2), 3)] });
    await expect(rules(alice)).toContainText('Five players: before the first trick, one task may be handed to another crew member');
    await alice.getByLabel('Task to hand over').selectOption({ label: 'pink 1 (Bob)' });
    await alice.getByLabel('Hand it to').selectOption({ label: 'Alice' });
    await button(alice, 'Hand over').click();
    await expect(status(alice)).toHaveText('Bob handed the task pink 1 to Alice');
    await expect(seatOf(alice, 'Alice').getByLabel('task pink 1')).toBeVisible();
    await expect(alice.getByRole('group', { name: 'Hand over a task' })).toHaveCount(0);
  });

  test('any seated player chooses the starting mission before the first move; it is kept across joins and shown to everyone', async ({ seat }) => {
    const table = await seat('thecrew', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await expect(turn(alice)).toHaveText('The Crew needs 3 to 5 players (2 seated)');
    await bob.getByLabel('Starting mission').selectOption('8');
    await expect(status(alice)).toHaveText('Bob chose mission 8');
    await expect(alice.getByLabel('Starting mission')).toHaveValue('8');
    const cara = await table.join('Cara');
    await expect(cara.locator('.mission-number')).toHaveText('Mission 8');
    await expect(rules(cara)).toContainText('3 tasks, order tokens 1 2 3');
    const state = await table.state<GameState>();
    const commander = state.commander ?? 0;
    await button([alice, bob, cara][commander - 1], `Take task ${label(state.tasks[0].card)}`).click();
    await expect(alice.getByLabel('Starting mission')).toHaveCount(0);
  });

  test('completing mission 50 ends the game with the whole crew as winners', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    // Bob won tricks 1 to 4, Alice the ones between; Cara must win the last
    const tricks = [...tricksBefore(4, 2), ...tricksBefore(8, 1)];
    await playing(table, { mission: 50, chosen: [2, 3], hands: { 1: [p(1)], 2: [p(2)], 3: [p(9)] }, tricks });
    await expect(seatOf(alice, 'Bob').locator('.seat-role')).toHaveText('must win tricks 1 to 4 only');
    await expect(seatOf(alice, 'Cara').locator('.seat-role')).toHaveText('must win only the last trick');
    await playTrick(pages, [p(1), p(2), p(9)]);
    await expect(status(alice)).toHaveText('Mission 50 complete! The crew has finished the logbook');
    await expect(turn(alice)).toHaveText('Game over');
    await expect(alice.locator('.seat-winner')).toHaveCount(3);
    await button(alice, 'Close').click();
    await button(alice, 'Show the mission').click();
    await expect(result(alice)).toBeVisible();
  });

  test('between missions the crew can vote to end the game; it ends when everyone connected votes yes, naming the last mission completed', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { mission: 12, lastCompleted: 11, hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tasks: [task(p(1), 2)] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await button(alice, 'Vote to end').click();
    await button(bob, 'Vote to play on').click();
    await expect(result(cara).locator('.end-vote-list')).toContainText('Alice: yes');
    await expect(result(cara).locator('.end-vote-list')).toContainText('Bob: no');
    await button(bob, 'Vote to end').click();
    await button(cara, 'Vote to end').click();
    await expect(status(alice)).toHaveText('The crew ended the game. Last mission completed: 11');
    await expect(alice.locator('.seat-winner')).toHaveCount(3);
  });

  test('you see only your own hand; tasks and communicated cards are public, and only the last trick stays in view', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { hands: { 1: [p(9), b(1)], 2: [p(1), b(2)], 3: [p(2), b(3)] }, tasks: [task(b(1), 2)] });
    await expect(hand(alice).getByRole('button')).toHaveCount(2);
    await expect(alice.getByLabel('pink 1', { exact: true })).toHaveCount(0);
    await expect(alice.getByLabel('task blue 1')).toBeVisible();
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(bob.locator('.trick .crew-card[aria-label]')).toHaveCount(3);
    await handCard(alice, b(1)).click();
    await expect(cara.locator('.trick .crew-card[aria-label]')).toHaveCount(1);
  });

  test('a dismissed player ends the game: the remaining crew are listed as winners', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { lastCompleted: 3, hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tasks: [task(p(1), 1)] });
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(status(alice)).toHaveText('Cara left, so the crew cannot go on. Last mission completed: 3');
    await expect(turn(bob)).toHaveText('Game over');
  });

  test('undo needs everyone; communicating is not a move, so undoing the move before it takes it back', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { hands: { 1: [p(9), b(1)], 2: [p(1), b(2)], 3: [p(2), b(3)] }, tasks: [task(b(1), 2)] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await button(bob, 'Communicate').click();
    await handCard(bob, b(2)).click();
    await button(bob, 'blue 2 is my only').click();
    await expect(alice.getByLabel('Bob\'s communication')).toBeVisible();
    await undo(alice, bob, cara);
    await expect(alice.getByLabel('Bob\'s communication')).toHaveCount(0);
    await expect(handCard(cara, p(2))).toBeEnabled();
  });
});

test.describe('The Crew mission rules', () => {
  test('mission 5: the commander names the sick crew member, who must not win a trick', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { started: false, mission: 5, phase: 'decision', hands: { 1: [p(1), b(1)], 2: [p(9), b(2)], 3: [p(2), b(3)] } });
    await expect(alice.locator('.hint')).toHaveText('Who is sick? Ask everyone "good" or "bad", then choose');
    await button(alice, 'Choose Bob').click();
    await expect(status(cara)).toHaveText('Alice chose Bob as the sick crew member, who must not win a trick');
    await expect(seatOf(cara, 'Bob').locator('.seat-role')).toHaveText('sick: must not win a trick');
    await playTrick(pages, [p(1), p(9), p(2)]);
    await expect(status(bob)).toHaveText('Mission 5 failed: Bob is sick and must not win a trick');
  });

  test('missions 9 and 26: a trick won by a 1', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 9, hands: { 1: [p(1)], 2: [g(1)], 3: [y(1)] } });
    await expect(rules(alice)).toContainText('A color card of value 1 must win a trick');
    await playTrick(pages, [p(1), g(1), y(1)]);
    await expect(status(alice)).toHaveText('Mission 9 complete!');
  });

  test('mission 11: the commander names another crew member, who may not communicate', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    await playing(table, { mission: 11, phase: 'decision', hands: { 1: [p(1)], 2: [g(1)], 3: [y(1)] }, tasks: [task(p(1), null, 1)] });
    await expect(button(alice, 'Choose Alice')).toHaveCount(0);
    await button(alice, 'Choose Bob').click();
    await button(alice, 'Take task pink 1').click();
    await expect(button(alice, 'Communicate')).toBeVisible();
    await expect(button(bob, 'Communicate')).toHaveCount(0);
    await expect(seatOf(alice, 'Bob').locator('.seat-role')).toHaveText('may not communicate');
  });

  test('mission 12: right after the first trick everyone draws a random card from the player on their right', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara] = pages;
    await playing(table, { mission: 12, hands: { 1: [p(9), b(1)], 2: [p(1), b(2)], 3: [p(2), b(3)] }, tasks: [task(g(9), 1, 'omega')] });
    await table.random(0, 0, 0);
    await playTrick(pages, [p(9), p(1), p(2)]);
    // Alice draws Cara's blue 3, Bob Alice's blue 1, Cara Bob's blue 2
    await expect(handCard(alice, b(3))).toBeVisible();
    await expect(handCard(bob, b(1))).toBeVisible();
    await expect(handCard(cara, b(2))).toBeVisible();
  });

  test('missions 13 and 44: each rocket must win a trick, in order in 44', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 44, hands: { 1: [r(3), r(1)], 2: [p(1), b(1)], 3: [p(2), b(2)] } });
    await expect(rules(alice)).toContainText('Each rocket must win a trick: first the 1, then the 2, the 3 and the 4');
    await playTrick(pages, [r(3), p(1), p(2)]);
    await expect(status(alice)).toHaveText('Mission 44 failed: The rockets must win in order: 1, 2, 3, then 4');
  });

  test('missions 16 and 17: no trick may be won by a 9', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 16, hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] } });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(status(alice)).toHaveText('Mission 16 failed: A 9 won a trick');
  });

  test('commander\'s decision (missions 20, 27, 37): the tasks lie face down until the commander names who takes them all', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    await playing(table, { mission: 20, phase: 'decision', hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tasks: [task(p(1), null), task(b(1), null)] });
    await expect(bob.getByLabel('face-down task')).toHaveCount(2);
    await expect(button(alice, 'Choose Alice')).toHaveCount(0);
    await button(alice, 'Choose Bob').click();
    await expect(seatOf(alice, 'Bob').getByLabel('task pink 1')).toBeVisible();
    await expect(seatOf(alice, 'Bob').getByLabel('task blue 1')).toBeVisible();
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('missions 23 and 40: the commander may move order tokens before the tasks are taken', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, {
      mission: 40, phase: 'tokens', hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] },
      tasks: [task(p(1), null, 1), task(b(1), null, 2), task(g(1), null, 3), task(y(1), null)]
    });
    await button(alice, 'Move the token of task blue 1').click();
    await button(alice, 'Move to task yellow 1').click();
    await expect(status(alice)).toHaveText('Alice moved the order token from blue 1 to yellow 1');
    await expect(alice.locator('.hint')).toHaveText('Take a task');

    await playing(table, {
      mission: 23, phase: 'tokens', hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] },
      tasks: [task(p(1), null, 1), task(b(1), null, 2)]
    });
    await button(alice, 'Keep the tokens').click();
    await expect(status(alice)).toHaveText('Alice left the order tokens where they were');
  });

  test('commander\'s distribution (missions 24, 32, 36, 43): tasks shown one at a time, nobody ends with two more than another', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    await playing(table, {
      mission: 24, phase: 'distribute', hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] },
      tasks: [task(p(1), null), task(b(1), null), task(g(1), null)]
    });
    await expect(bob.getByLabel('face-down task')).toHaveCount(2);
    await button(alice, 'Give to Alice').click();
    await button(alice, 'Give to Alice').click();
    await expect(status(alice)).toHaveText('Nobody may end up with two tasks more than another');
    await button(alice, 'Give to Bob').click();
    await button(alice, 'Give to Cara').click();
    await expect(seatOf(bob, 'Cara').getByLabel('task green 1')).toBeVisible();
  });

  test('missions 29 and 34: nobody may have won two tricks more than another', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 29, hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tricks: tricksBefore(1, 1) });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(status(alice)).toHaveText('Mission 29 failed: Nobody may win two tricks more than another');
  });

  test('mission 33: the chosen crew member wins exactly one trick, not with a rocket', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 33, phase: 'decision', hands: { 1: [p(9)], 2: [p(1)], 3: [r(1)] } });
    await button(alice, 'Choose Cara').click();
    await playTrick(pages, [p(9), p(1), r(1)]);
    await expect(status(alice)).toHaveText('Mission 33 failed: Cara must win exactly one trick, and not with a rocket');
  });

  test('mission 41: the chosen crew member wins only the first and the last trick, neither with a rocket', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 41, phase: 'decision', hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] } });
    await button(alice, 'Choose Bob').click();
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(status(alice)).toHaveText('Mission 41 failed: Bob must win only the first and the last trick, neither with a rocket');
  });

  test('mission 46: the player left of the pink 9\'s holder is named at once and must win every pink', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 46, chosen: [3], hands: { 1: [p(1)], 2: [p(9)], 3: [p(2)] } });
    await expect(seatOf(alice, 'Cara').locator('.seat-role')).toHaveText('must win every pink card');
    await playTrick(pages, [p(1), p(9), p(2)]);
    await expect(status(alice)).toHaveText('Mission 46 failed: Bob won a pink card, but only Cara may');
  });

  test('mission 48: the omega task must be won in the last trick', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { mission: 48, hands: { 1: [p(9), b(9)], 2: [p(1), b(1)], 3: [p(2), b(2)] }, tasks: [task(p(1), 1, 'omega')] });
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(status(alice)).toHaveText('Mission 48 failed: The tasks were not done in the order their tokens give');
  });

  test('mission 50: the commander names who wins tricks 1 to 4 and who wins only the last trick', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    await playing(table, { mission: 50, phase: 'decision', hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] } });
    await expect(alice.locator('.hint')).toHaveText('Decide together, then choose who wins tricks 1 to 4');
    await button(alice, 'Choose Bob').click();
    await expect(button(alice, 'Choose Bob')).toHaveCount(0);
    await button(alice, 'Choose Cara').click();
    await expect(status(bob)).toHaveText('Alice chose Cara to win the last trick');
    await playTrick(pages, [p(9), p(1), p(2)]);
    await expect(status(alice)).toHaveText('Mission 50 failed: Bob must win only tricks 1 to 4, Cara only the last trick, and the others every trick between');
  });
});

test.describe('The Crew controls', () => {
  test('the table shows the mission, attempt, trick and rules, and the FAQ opens', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await playing(table, { mission: 19, attempt: 3, hands: { 1: [p(9)], 2: [p(1)], 3: [p(2)] }, tasks: [task(p(1), 1, 1)], tricks: tricksBefore(2) });
    await expect(alice.locator('.mission-info')).toHaveText('Mission 19Attempt 3Trick 3 of 13');
    await expect(rules(alice).locator('li')).toHaveText(['5 tasks, order tokens 1', 'Disruption: nobody may communicate before trick 3']);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Who is the commander?');
  });
});
