import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { HOME, LAST_TRACK, NEST, TRACK_LENGTH, entryIndex, isOnTrack, trackIndex } from '../games/parchisi/rules.ts';
import type { Progress, Seat as SeatNumber } from '../games/parchisi/types.ts';

// One test per rule and control in games/parchisi/README.md. Seat 1 (Alice) is blue at the bottom and seat 2 (Bob)
// red at the top. A pawn's progress counts squares from its own entry square: NEST, 0 to 63 on the track,
// 64 to 70 up its home column and HOME at the center.

type Server = { url: string };
const N = NEST;
const HOME_COLUMN_LENGTH = HOME - LAST_TRACK - 1;

// Queues die faces before anyone joins, so the roll-off and first roll made when the second player sits down are known
async function queueDice(server: Server, ...faces: number[]): Promise<void> {
  const response = await fetch(`${server.url}/api/e2e/random`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values: faces.map(face => (face - 0.5) / 6) })
  });
  if (!response.ok) throw new Error(await response.text());
}

// By default Alice rolls the lowest in the roll-off, then 5 and 1 so she can enter a pawn. Each player who joins
// after the second starts the roll-off over, so it is queued once per join.
function defaultOpening(players: number): number[] {
  return Array.from({ length: players - 1 }, (_, joined) => [2, ...Array(joined + 1).fill(4), 5, 1]).flat();
}

async function start(seat: Seat, server: Server, names = ['Alice', 'Bob'], opening?: number[]) {
  await queueDice(server, ...(opening ?? defaultOpening(names.length)));
  const table = await seat('parchisi', names);
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1] };
}

// Bob's progress for a pawn on the square Alice reaches at `progress`
const bobAt = (progress: Progress) => (entryIndex(1) + progress - entryIndex(2) + TRACK_LENGTH) % TRACK_LENGTH;

type Craft = { used?: number[]; bonuses?: number[]; current?: SeatNumber; doublesRolled?: number };

const dieLabel = (value: number, index: number, used: boolean) => `${value}${index >= 2 ? ', underneath' : ''}${used ? ', used' : ''}`;

// A started game with these pawns and `current` to move with `dice`. Waits until every page shows the pawns and dice
async function craft(table: Table, pawns: Record<SeatNumber, Progress[]>, dice: number[], { used = [], bonuses = [], current = 1, doublesRolled = 0 }: Craft = {}) {
  await table.patch({
    pawns, dice: dice.map((value, index) => ({ value, used: used.includes(index) })), bonuses, roller: current, currentPlayer: current,
    doublesRolled, splitBlockades: [], lastMove: null, started: true
  });
  for (const page of table.pages) {
    if (page.isClosed()) continue;
    await expect.poll(() => diceLabels(page)).toEqual(dice.map((value, index) => dieLabel(value, index, used.includes(index))));
    for (const [seat, progresses] of Object.entries(pawns)) {
      for (const [pawn, progress] of progresses.entries()) await expect(pawnAt(page, Number(seat), pawn, progress)).toHaveCount(1);
    }
  }
}

// The square `seat` reaches at `progress`. The board draws the 68 track squares in order, then each color's home column
function square(page: Page, seat: SeatNumber, progress: Progress) {
  const squares = page.locator('.board > .square');
  if (isOnTrack(progress)) return squares.nth(trackIndex(seat, progress));
  if (progress > LAST_TRACK && progress < HOME) return squares.nth(TRACK_LENGTH + (seat - 1) * HOME_COLUMN_LENGTH + progress - LAST_TRACK - 1);
  throw new Error(`No square at ${progress}`);
}

function place(page: Page, seat: SeatNumber, progress: Progress) {
  if (progress === NEST) return page.locator(`.nest.player${seat}`);
  if (progress === HOME) return page.locator('.center');
  return square(page, seat, progress);
}

const pawn = (page: Page, seat: SeatNumber, index: number) => page.locator(`[data-anim-key="pawn-${seat}-${index}"]`);
const pawnAt = (page: Page, seat: SeatNumber, index: number, progress: Progress) =>
  place(page, seat, progress).locator(`[data-anim-key="pawn-${seat}-${index}"]`);
const badges = async (page: Page) => (await page.locator('.destination-badge').allTextContents()).sort();
const badge = (page: Page, seat: SeatNumber, progress: Progress) => place(page, seat, progress).locator('.destination-badge');
const diceLabels = (page: Page) => page.locator('.dice-tray .die').evaluateAll(dice => dice.map(die => die.getAttribute('aria-label')));
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const bonusChips = (page: Page) => page.locator('.dice-tray .bonus');

// Selects Alice's pawn and moves it to the square marked at `progress`
async function move(page: Page, index: number, progress: Progress, seat: SeatNumber = 1) {
  await pawn(page, seat, index).click();
  await expect(pawn(page, seat, index)).toHaveClass(/selected/);
  await place(page, seat, progress).click();
  await expect(pawnAt(page, seat, index, progress)).toHaveCount(1);
}

test.describe('Parchisi seating', () => {
  test('players sit bottom, top, right, left in join order, turns go clockwise, and the list is in turn order', async ({ seat, server }) => {
    const { pages } = await start(seat, server, ['Alice', 'Bob', 'Cara', 'Dan']);
    const [alice] = pages;
    for (const [number, name] of [[1, 'Alice'], [2, 'Bob'], [3, 'Cara'], [4, 'Dan']] as const) {
      await expect(alice.locator(`.nest.player${number} .nest-name`)).toHaveText(name);
    }
    // Bottom, left, top, right
    await expect(alice.locator('.player-row .player-name')).toHaveText(['Alice (you)', 'Dan', 'Bob', 'Cara']);
    const rgb = async (number: number) => {
      const color = await alice.locator(`.player-dot.player${number}`).evaluate(element => getComputedStyle(element).backgroundColor);
      return color.match(/\d+/g)!.slice(0, 3).map(Number);
    };
    const [blue, red, green, purple] = [await rgb(1), await rgb(2), await rgb(3), await rgb(4)];
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(red[0]).toBeGreaterThan(red[2]);
    expect(green[1]).toBeGreaterThan(green[0]);
    expect(purple[2]).toBeGreaterThan(purple[1]);
  });
});

test.describe('Parchisi rules', () => {
  test('four pawns each in the nest, 68 track squares with 12 safe, and a 7 square home column per color', async ({ seat, server }) => {
    const { alice } = await start(seat, server);
    await expect(alice.locator('.nest.player1 .pawn')).toHaveCount(4);
    await expect(alice.locator('.nest.player2 .pawn')).toHaveCount(4);
    await expect(alice.locator('.square.track')).toHaveCount(68);
    await expect(alice.locator('.square.track.safe')).toHaveCount(12);
    for (const number of [1, 2, 3, 4]) await expect(alice.locator(`.square.home-lane.player${number}`)).toHaveCount(7);
  });

  test('once two are seated each rolls one die, the lowest goes first, and players tied for lowest roll again', async ({ seat, server }) => {
    // Tied on 3, then Alice 4 against Bob 2; Bob then rolls 5 and 1
    const { alice, bob } = await start(seat, server, ['Alice', 'Bob'], [3, 3, 4, 2, 5, 1]);
    await expect(status(alice)).toContainText('Lowest roll goes first: Alice 3, Bob 3; tie: Alice 4, Bob 2. Bob goes first. Bob rolled 5 and 1');
    await expect(turn(bob)).toContainText('Your turn');
    await expect(turn(alice)).toContainText("Bob's turn");
  });

  test('dice are rolled for you; move one pawn per die in either order, or by the total one die at a time', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    // The total of 2 and 4 lands on Bob's pawn after the 2, capturing it on the way
    await craft(table, { 1: [0, N, N, N], 2: [bobAt(2), N, N, N] }, [2, 4]);
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['2', '2+4', '4']);
    await expect(badge(alice, 1, 6)).toHaveText('2+4');
    await square(alice, 1, 6).click();
    await expect(status(alice)).toHaveText("Alice moved a pawn 6 squares and captured Bob's pawn (+20)");
    await expect(pawnAt(alice, 2, 0, NEST)).toHaveCount(1);

    // The 4 first, then the 2; the next roll is made for Bob by itself
    await craft(table, { 1: [0, N, N, N], 2: [N, N, N, N] }, [2, 4]);
    await move(alice, 0, 4);
    await table.dice(5, 1);
    await move(alice, 0, 6);
    await expect(bob.locator('.dice-tray .panel-title')).toHaveText("Bob's roll");
    await expect.poll(() => diceLabels(bob)).toEqual(['5', '1']);

    // A blockade 3 squares ahead: the 4 and the total, which would land after the 4 first, are not offered
    await craft(table, { 1: [0, N, N, N], 2: [bobAt(3), bobAt(3), N, N] }, [2, 4]);
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['2']);
  });

  test('every usable die must be used, the larger when only one can be, and a roll with no move passes with a message', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    const blockade = bobAt(7);
    // Moving pawn 0 by 2 would strand the 6, so it may only take the 6, and pawn 1 the 2
    await craft(table, { 1: [0, 66, N, N], 2: [blockade, blockade, N, N] }, [6, 2]);
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['6']);
    await pawn(alice, 1, 1).click();
    expect(await badges(alice)).toEqual(['2']);
    await pawn(alice, 1, 1).click();
    await expect(alice.locator('.pawn.selected')).toHaveCount(0);

    // Either die alone fits but not both, so it must be the 6
    await craft(table, { 1: [0, N, N, N], 2: [blockade, blockade, N, N] }, [3, 6]);
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['6']);
    await pawn(alice, 1, 0).click();

    // Bob, all in his nest, rolls 1 and 2 and cannot move, so the turn passes on to Alice
    await craft(table, { 1: [0, N, N, N], 2: [N, N, N, N] }, [1, 2], { used: [0] });
    await table.dice(1, 2, 6, 1);
    await move(alice, 0, 2);
    await expect(status(bob)).toHaveText('Alice moved a pawn 2 squares. Bob rolled 1 and 2 and cannot move. Alice rolled 6 and 1');
    await expect(turn(alice)).toContainText('Your turn');
  });

  test('a 5 on one die, or two dice totalling 5, moves a pawn from the nest onto the entry square', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: [N, N, N, N], 2: [N, N, N, N] }, [5, 2]);
    await expect(alice.locator('.nest.player1 .pawn.movable')).toHaveCount(4);
    await alice.locator('.nest.player1').click();
    await expect(badge(alice, 1, 0)).toHaveText('5');
    await square(alice, 1, 0).click();
    await expect(pawnAt(alice, 1, 0, 0)).toHaveCount(1);
    await expect(status(alice)).toHaveText('Alice entered a pawn');
    await expect.poll(() => diceLabels(alice)).toEqual(['5, used', '2']);

    await craft(table, { 1: [N, N, N, N], 2: [N, N, N, N] }, [2, 3]);
    await alice.locator('.nest.player1').click();
    expect(await badges(alice)).toEqual(['2+3']);
    await square(alice, 1, 0).click();
    await expect(status(alice)).toContainText('Alice entered a pawn');
    await expect(pawnAt(alice, 1, 0, 0)).toHaveCount(1);
  });

  test('doubles move per die, add the faces underneath once all pawns are out, and roll again only if all were used', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    // Bob ends his turn, and Alice, with every pawn out, rolls 3 and 3
    await craft(table, { 1: [0, 10, 20, HOME], 2: [0, N, N, N] }, [1, 2], { used: [0], current: 2 });
    await table.dice(3, 3);
    await move(bob, 0, 2, 2);
    await expect.poll(() => diceLabels(alice)).toEqual(['3', '3', '4, underneath', '4, underneath']);
    await expect(status(alice)).toContainText('Alice rolled 3 and 3 with 4 and 4 underneath, doubles, and rolls again if every die is used');
    await move(alice, 0, 3);
    await move(alice, 0, 6);
    await move(alice, 1, 14);
    await table.dice(6, 1);
    await move(alice, 1, 18);
    await expect(status(alice)).toHaveText('Alice moved a pawn 4 squares. Alice rolled 6 and 1');
    await expect(turn(alice)).toContainText('Your turn');

    // Doubles that cannot all be used pass the turn: the second 2 would pass Bob's blockade
    await craft(table, { 1: [0, N, N, N], 2: [bobAt(3), bobAt(3), N, N] }, [2, 2]);
    await expect.poll(() => diceLabels(alice)).toEqual(['2', '2']); // a pawn in the nest, so nothing underneath
    await table.dice(6, 1);
    await move(alice, 0, 2);
    await expect(status(alice)).toHaveText('Alice moved a pawn 2 squares. Bob rolled 6 and 1');
    await expect(turn(bob)).toContainText('Your turn');
  });

  test('three doubles in a row send the pawn closest to home, even in the home column, to the nest and end the turn', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, { 1: [10, 30, 66, N], 2: [N, N, N, N] }, [1, 1], { doublesRolled: 2 });
    await move(alice, 0, 11);
    await table.dice(3, 3, 5, 1);
    await pawn(alice, 1, 0).click();
    await square(alice, 1, 12).click();
    await expect(status(alice)).toContainText('Alice rolled a third double in a row and lost the turn and a pawn to the nest. Bob rolled 5 and 1');
    await expect(pawnAt(alice, 1, 2, NEST)).toHaveCount(1);
    await expect(pawnAt(alice, 1, 0, 12)).toHaveCount(1);
    await expect(turn(bob)).toContainText('Your turn');
  });

  test('capturing a lone pawn off a safe square sends it home with a 20 bonus; safe squares are off limits except on entry', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, { 1: [0, 30, N, N], 2: [bobAt(3), N, N, N] }, [3, 1]);
    await move(alice, 0, 3);
    await expect(status(alice)).toHaveText("Alice moved a pawn 3 squares and captured Bob's pawn (+20)");
    await expect(pawnAt(bob, 2, 0, NEST)).toHaveCount(1);
    await expect(bonusChips(alice)).toHaveText(['+20']);

    // Bob's pawn on the safe square 12 ahead keeps it
    await craft(table, { 1: [9, N, N, N], 2: [bobAt(12), N, N, N] }, [3, 1]);
    await expect(square(alice, 1, 12)).toHaveClass(/safe/);
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['1', '3+1']);
    await expect(square(alice, 1, 12)).not.toHaveClass(/destination/);
    await pawn(alice, 1, 0).click(); // unselects it before the next position

    // Entering captures a lone pawn on the safe entry square
    await craft(table, { 1: [N, N, N, N], 2: [bobAt(0), N, N, N] }, [5, 1]);
    await expect(square(alice, 1, 0)).toHaveClass(/safe/);
    await alice.locator('.nest.player1').click();
    await square(alice, 1, 0).click();
    await expect(status(alice)).toHaveText("Alice entered a pawn and captured Bob's pawn (+20)");
    await expect(pawnAt(alice, 2, 0, NEST)).toHaveCount(1);
  });

  test('a pawn home earns a 10 bonus; bonuses come after the dice, whole, by a pawn out of the nest, or are lost', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: [68, 10, N, N], 2: [N, N, N, N] }, [4, 3]);
    await move(alice, 0, HOME);
    await expect(status(alice)).toHaveText('Alice moved a pawn home (+10)');
    await expect(bonusChips(alice)).toHaveText(['+10']);
    // The 4 is left, so the bonus waits
    await pawn(alice, 1, 1).click();
    expect(await badges(alice)).toEqual(['4']);
    await square(alice, 1, 14).click();
    await expect(pawnAt(alice, 1, 1, 14)).toHaveCount(1);
    await pawn(alice, 1, 1).click();
    expect(await badges(alice)).toEqual(['+10']);
    await square(alice, 1, 24).click();
    await expect(pawnAt(alice, 1, 1, 24)).toHaveCount(1);

    // Owed 20 and then 10: from 56 the 20 overshoots the center and is lost, but the 10 fits
    await craft(table, { 1: [55, 68, N, N], 2: [N, N, N, N] }, [3, 1], { bonuses: [20] });
    await expect(bonusChips(alice)).toHaveText(['+20']);
    await move(alice, 1, HOME);
    await expect(bonusChips(alice)).toHaveText(['+20', '+10']);
    await move(alice, 0, 56);
    await expect(bonusChips(alice)).toHaveText(['+10']);
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['+10']);
    await expect(badge(alice, 1, 66)).toHaveText('+10');
  });

  test('two pawns of one color form a blockade nobody passes, lands on or enters onto, and it never moves on together', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    // Bob's blockade 3 ahead of Alice's entry: her pawn on 1 can neither land on it nor pass it
    await craft(table, { 1: [1, 0, N, N], 2: [bobAt(3), bobAt(3), N, N] }, [4, 2]);
    await expect(pawn(alice, 1, 0)).not.toHaveClass(/movable/);
    await expect(pawn(alice, 1, 1)).toHaveClass(/movable/);
    await pawn(alice, 1, 1).click();
    expect(await badges(alice)).toEqual(['2']);

    // Her own blockade on 2 stops her pawn on 0 too, as a square holds at most two pawns
    await craft(table, { 1: [2, 2, 0, N], 2: [N, N, N, N] }, [2, 4]);
    await expect(pawn(alice, 1, 2)).not.toHaveClass(/movable/);
    await expect(pawn(alice, 1, 0)).toHaveClass(/movable/);

    // A blockade on her entry square keeps her pawns in the nest
    await craft(table, { 1: [N, N, N, N], 2: [bobAt(0), bobAt(0), N, N] }, [5, 1]);
    await expect(alice.locator('.pawn.movable')).toHaveCount(0);

    // On doubles, once one pawn leaves the blockade the other stays for the rest of the roll
    await craft(table, { 1: [2, 2, 20, N], 2: [N, N, N, N] }, [3, 3]);
    await move(alice, 0, 5);
    await expect(pawn(alice, 1, 1)).not.toHaveClass(/movable/);
    await expect(pawn(alice, 1, 0)).toHaveClass(/movable/);
    await expect(pawn(alice, 1, 2)).toHaveClass(/movable/);
  });

  test('reaching the center takes an exact roll, and the first with all four pawns home wins', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, { 1: [HOME, HOME, HOME, 70], 2: [N, N, N, N] }, [1, 2]);
    await pawn(alice, 1, 3).click();
    expect(await badges(alice)).toEqual(['1']); // the 2 and the total overshoot
    await alice.locator('.center').click();
    for (const page of [alice, bob]) {
      await expect(status(page)).toHaveText('Alice wins!');
      await expect(turn(page)).toHaveText('Game Over');
    }
    await expect(bob.locator('.player-row', { hasText: 'Alice' })).toContainText('(winner)');
    await expect(bob.locator('.player-row', { hasText: 'Alice' })).toContainText('4/4 home');
  });

  test('a player who leaves loses their pawns and turns, and the last player left wins', async ({ seat, server }) => {
    const { table, pages } = await start(seat, server, ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = pages;
    await craft(table, { 1: [0, N, N, N], 2: [0, N, N, N], 3: [N, N, N, N] }, [1, 2], { used: [0] });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.locator('.pawn.player2')).toHaveCount(0);
    await expect(alice.locator('.player-row', { hasText: 'Bob' })).toContainText('left');

    // Bob's turn, next after Alice's, is skipped
    await table.dice(5, 1);
    await move(alice, 0, 2);
    await expect(turn(cara)).toContainText('Your turn');
    await expect(status(cara)).toContainText('Cara rolled 5 and 1');

    await leave(cara);
    await dismiss('Cara', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo needs the approval of every player still in the game', async ({ seat, server }) => {
    const { table, pages } = await start(seat, server, ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = pages;
    await craft(table, { 1: [N, N, N, N], 2: [N, N, N, N], 3: [N, N, N, N] }, [5, 2]);
    await alice.locator('.nest.player1').click();
    await square(alice, 1, 0).click();
    await expect(pawnAt(alice, 1, 0, 0)).toHaveCount(1);

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(alice.locator('.undo-vote')).toHaveCount(0);
    await expect(pawnAt(alice, 1, 0, 0)).toHaveCount(1);

    await undo(alice, bob, cara);
    await expect(pawnAt(alice, 1, 0, NEST)).toHaveCount(1);
    await expect.poll(() => diceLabels(alice)).toEqual(['5', '2']);
  });
});

test.describe('Parchisi controls', () => {
  test('movable pawns glow, and the selected pawn\'s squares are marked with their dice: 4, 2+3 or +20', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: [0, N, N, N], 2: [N, N, N, N] }, [2, 4]);
    await expect(alice.locator('.pawn.movable')).toHaveCount(1);
    await expect(pawn(alice, 1, 0)).toHaveClass(/movable/);
    const glow = await pawn(alice, 1, 0).evaluate(element => getComputedStyle(element).boxShadow);
    expect(glow).not.toBe('none');
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['2', '2+4', '4']);
    await expect(badge(alice, 1, 6)).toHaveText('2+4');
    await pawn(alice, 1, 0).click();

    await craft(table, { 1: [0, N, N, N], 2: [N, N, N, N] }, [2, 4], { used: [0, 1], bonuses: [20] });
    await pawn(alice, 1, 0).click();
    await expect(badge(alice, 1, 20)).toHaveText('+20');
  });

  test('click a marked square to move, and click the selected pawn again to unselect it', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: [0, N, N, N], 2: [N, N, N, N] }, [2, 3]);
    await pawn(alice, 1, 0).click();
    await expect(pawn(alice, 1, 0)).toHaveClass(/selected/);
    await pawn(alice, 1, 0).click();
    await expect(alice.locator('.pawn.selected')).toHaveCount(0);
    await expect(alice.locator('.destination')).toHaveCount(0);
    await pawn(alice, 1, 0).click();
    await square(alice, 1, 3).click();
    await expect(pawnAt(alice, 1, 0, 3)).toHaveCount(1);
  });

  test('the dice show the roll, the faces underneath dashed, used dice faded and bonus moves beside them', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, { 1: [0, 10, 20, 30], 2: [N, N, N, N] }, [3, 3, 4, 4], { used: [0], bonuses: [20] });
    await expect(bob.locator('.dice-tray .panel-title')).toHaveText("Alice's roll");
    await expect(alice.locator('.dice-note')).toHaveText('underneath');
    const dice = alice.locator('.dice-tray .die');
    const style = (index: number) => dice.nth(index).evaluate(element => {
      const computed = getComputedStyle(element);
      return { border: computed.borderTopStyle, opacity: Number(computed.opacity) };
    });
    expect((await style(0)).opacity).toBeLessThan(1);
    expect((await style(1)).opacity).toBe(1);
    expect((await style(1)).border).not.toBe('dashed');
    expect((await style(2)).border).toBe('dashed');
    expect((await style(3)).border).toBe('dashed');
    await expect(bonusChips(alice)).toHaveText(['+20']);
  });

  test('the board is dimmed when it is not your turn, and the last move\'s squares are outlined', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await expect(alice.locator('.board')).not.toHaveClass(/not-your-turn/);
    await expect(bob.locator('.board')).toHaveClass(/not-your-turn/);
    await craft(table, { 1: [0, N, N, N], 2: [N, N, N, N] }, [2, 3]);
    await move(alice, 0, 2);
    for (const page of [alice, bob]) {
      await expect(square(page, 1, 0)).toHaveClass(/last-move-from/);
      await expect(square(page, 1, 2)).toHaveClass(/last-move-to/);
    }
    const styles = await bob.evaluate(() => [
      getComputedStyle(document.querySelector('.last-move-from')!).outlineStyle,
      getComputedStyle(document.querySelector('.last-move-to')!).outlineStyle
    ]);
    expect(styles).toEqual(['dashed', 'solid']);
  });

  test('clicking Undo asks everyone still in the game to approve', async ({ seat, server }) => {
    const { pages } = await start(seat, server, ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = pages;
    await alice.locator('.nest.player1').click();
    await square(alice, 1, 0).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    for (const page of [bob, cara]) {
      await expect(page.locator('.undo-vote-title')).toHaveText('Alice wants to undo the last turn');
      await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    }
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat, server }) => {
    const { alice } = await start(seat, server);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('blockade');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Parchisi differences from Wikipedia', () => {
  test('three doubles in a row send back the pawn closest to home on the track', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: [10, 40, N, N], 2: [N, N, N, N] }, [1, 1], { doublesRolled: 2 });
    await move(alice, 0, 11);
    await table.dice(3, 3, 5, 1);
    await pawn(alice, 1, 0).click();
    await square(alice, 1, 12).click();
    await expect(pawnAt(alice, 1, 1, NEST)).toHaveCount(1);
    await expect(pawnAt(alice, 1, 0, 12)).toHaveCount(1);
  });

  test('a blockade is broken only by its owner, even against double ones', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: [0, 20, N, N], 2: [bobAt(1), bobAt(1), N, N] }, [1, 1]);
    await expect(pawn(alice, 1, 0)).not.toHaveClass(/movable/);
    await expect(pawn(alice, 1, 1)).toHaveClass(/movable/);
  });

  test('a blockade may stay as long as its owner likes', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    // Bob moves his third pawn and keeps the blockade; Alice is still held behind it on her next roll
    await craft(table, { 1: [0, N, N, N], 2: [bobAt(2), bobAt(2), 0, N] }, [1, 2], { used: [0], current: 2 });
    await table.dice(1, 1);
    await move(bob, 2, 2, 2);
    await expect.poll(() => diceLabels(alice)).toEqual(['1', '1']);
    await expect(pawnAt(alice, 2, 0, bobAt(2))).toHaveCount(1);
    await expect(pawnAt(alice, 2, 1, bobAt(2))).toHaveCount(1);
    await pawn(alice, 1, 0).click();
    expect(await badges(alice)).toEqual(['1']); // up to the blockade, never past it
  });

  test('a pawn always turns into its home column after one lap', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: [62, N, N, N], 2: [N, N, N, N] }, [3, 1]);
    await pawn(alice, 1, 0).click();
    await expect(badge(alice, 1, 65)).toHaveText('3');
    await expect(square(alice, 1, 65)).toHaveClass(/home-lane/);
    // The track square the pawn would reach by going around again is not offered
    await expect(alice.locator('.square.track .destination-badge')).toHaveText(['1']);
  });

  test('the dice are rolled as soon as a turn starts, and the turn ends by itself once no move is left', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await expect(alice.getByRole('button', { name: /roll/i })).toHaveCount(0);
    await expect.poll(() => diceLabels(alice)).toEqual(['5', '1']);
    await craft(table, { 1: [0, N, N, N], 2: [N, N, N, N] }, [1, 2], { used: [0] });
    await table.dice(5, 3);
    await move(alice, 0, 2);
    await expect(turn(bob)).toContainText('Your turn');
    await expect.poll(() => diceLabels(bob)).toEqual(['5', '3']);
    await expect(bob.getByRole('button', { name: /roll/i })).toHaveCount(0);
  });
});
