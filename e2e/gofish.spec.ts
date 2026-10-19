import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { standardDeck, type PlayingCard, type Rank, type Suit } from '../shared/playingCards.ts';
import type { Ask, GameState } from '../games/gofish/types.ts';

// One test per rule, control and difference in games/gofish/README.md. Players are seated in join order:
// Alice is seat 1, Bob seat 2, Cara seat 3. The stock's top card is its last one, as the server keeps it.

const card = (rank: Rank, suit: Suit): PlayingCard => ({ rank, suit });
// Leaves a shuffled 52-card deck in order: Fisher-Yates swaps each index with itself
const UNSHUFFLED = Array<number>(51).fill(0.999999);

type Deal = { hands: Record<number, PlayingCard[]>; stock?: PlayingCard[]; books?: Record<number, Rank[]>; current?: number; log?: Ask[] };

// Crafts a game under way: hands, stock and books, with no asks yet
async function deal(table: Table, { hands, stock = [], books, current = 1, log = [] }: Deal) {
  const seats = Object.keys(hands).map(Number);
  await table.patch({
    started: true,
    hands,
    stock,
    books: books ?? Object.fromEntries(seats.map(seat => [seat, []])),
    log,
    lastMove: null,
    fishedCard: null,
    currentPlayer: current
  });
}

async function start(seat: Seat, names = ['Alice', 'Bob']) {
  const table = await seat('gofish', names);
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1] };
}

const hand = (page: Page) => page.locator('section.hand');
// A card in the hand: a button on your turn, a picture otherwise
const handCard = (page: Page, name: string) => hand(page).locator(`.playing-card[aria-label="${name}"]`);
const handCards = (page: Page) => hand(page).locator('.playing-card');
const player = (page: Page, name: string) => page.locator('.players .player', { hasText: name });
const pick = (page: Page, name: string) => page.locator('.player-pick', { hasText: name });
const askButton = (page: Page) => page.locator('.ask-button');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const asks = (page: Page) => page.locator('.ask-log-list li');

// Clicks the rank group holding `cardName`; its cards overlap, so the last one is the one on top
const pickRank = (page: Page, cardName: string) =>
  hand(page).locator('.rank-group', { has: page.locator(`.playing-card[aria-label="${cardName}"]`) }).locator('.playing-card').last().click();

// Picks the rank of `cardName`, then `target` unless they are picked already, and asks
async function ask(page: Page, cardName: string, target?: string) {
  await pickRank(page, cardName);
  if (target) await pick(page, target).click();
  await askButton(page).click();
}

test.describe('Go Fish rules', () => {
  test('a 52-card deck deals 7 each to 2 or 3 players and 5 each to 4 to 6, and the rest is the face-down stock', async ({ seat }) => {
    const two = await seat('gofish', ['Alice']);
    await two.random(...UNSHUFFLED, 0);
    const bob = await two.join('Bob');
    await expect(handCards(bob)).toHaveCount(7);
    await expect(player(bob, 'Alice').locator('.player-count')).toHaveText('7 cards');
    await expect(bob.getByText('Stock: 38')).toBeVisible();
    await expect(bob.locator('.stock .playing-card-back')).toBeVisible();

    const four = await seat('gofish', ['Alice', 'Bob', 'Cara']);
    await four.random(...UNSHUFFLED, 0);
    const dan = await four.join('Dan');
    await expect(handCards(dan)).toHaveCount(5);
    for (const name of ['Alice', 'Bob', 'Cara']) await expect(player(dan, name).locator('.player-count')).toHaveText('5 cards');
    await expect(dan.getByText('Stock: 32')).toBeVisible();
  });

  test('a random player goes first, and play goes up the seats', async ({ seat }) => {
    // The number after the shuffle picks the first player: 0.5 of three seats is Bob
    const table = await seat('gofish', ['Alice', 'Bob']);
    await table.random(...UNSHUFFLED, 0.5);
    const cara = await table.join('Cara');
    const bob = table.pages[1];
    await expect(turn(bob)).toHaveText('You go first. Joining closes after the first ask.');
    await expect(turn(cara)).toHaveText('Bob goes first. Joining closes after the first ask.');
    // Unshuffled, Bob holds the 8 of clubs to the ace of diamonds and Alice the ace to 7 of clubs, so asking her for 8s
    // goes fish and the turn goes up to Cara
    await ask(bob, '8 of clubs', 'Alice');
    await expect(turn(cara)).toHaveText('Your turn');

    const other = await seat('gofish', ['Alice', 'Bob']);
    await other.random(...UNSHUFFLED, 0.9);
    const last = await other.join('Cara');
    await expect(turn(last)).toHaveText('You go first. Joining closes after the first ask.');
    await expect(turn(other.pages[0])).toHaveText('Cara goes first. Joining closes after the first ask.');
  });

  test('you ask one other player who still has cards, for a rank you hold', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, { hands: { 1: [card('7', 'clubs'), card('2', 'diamonds')], 2: [card('3', 'clubs')], 3: [] } });
    // Only the ranks in your hand can be picked, and only other players with cards can be asked
    await expect(hand(alice).getByRole('button')).toHaveCount(2);
    await expect(player(alice, 'Cara').locator('.player-count')).toHaveText('out of cards');
    await expect(pick(alice, 'Cara')).toHaveCount(0);
    await expect(pick(alice, 'Alice')).toHaveCount(0);
    await expect(pick(alice, 'Bob')).toHaveCount(1);
    await expect(askButton(alice)).toBeDisabled();
    await pickRank(alice, '7 of clubs');
    await expect(askButton(alice)).toHaveText('Ask Bob for 7s');
  });

  test('a player with the rank hands over every card of it, and you ask again', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: [card('7', 'clubs'), card('2', 'diamonds')], 2: [card('7', 'hearts'), card('7', 'spades'), card('3', 'clubs')] } });
    await ask(alice, '7 of clubs');
    await expect(status(bob)).toHaveText('Alice asked Bob for 7s and got 2. Alice goes again.');
    await expect(hand(alice).getByRole('group', { name: '3 7s' })).toBeVisible();
    await expect(handCards(bob)).toHaveCount(1);
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('on a miss you go fish: the asked rank asks again, any other card passes the turn, and an empty stock draws nothing', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, {
      hands: { 1: [card('7', 'clubs'), card('2', 'diamonds')], 2: [card('3', 'clubs'), card('4', 'clubs')] },
      stock: [card('9', 'spades'), card('7', 'hearts')]
    });
    await ask(alice, '7 of clubs');
    await expect(status(bob)).toHaveText('Alice asked Bob for 7s: go fish! Alice drew a 7. Alice goes again.');
    await expect(handCard(alice, '7 of hearts')).toBeVisible();
    await expect(turn(alice)).toHaveText('Your turn');

    await ask(alice, '2 of diamonds');
    await expect(status(bob)).toHaveText('Alice asked Bob for 2s: go fish! Alice drew a card.');
    await expect(handCard(alice, '9 of spades')).toBeVisible();
    await expect(turn(bob)).toHaveText('Your turn');

    await ask(bob, '3 of clubs');
    await expect(status(alice)).toHaveText('Bob asked Alice for 3s: go fish! The stock is empty.');
    await expect(bob.getByText('Stock: 0')).toBeVisible();
    await expect(handCards(bob)).toHaveCount(2);
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('four of a rank are laid down as a book at once, including books made by the deal', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: [card('7', 'clubs'), card('7', 'diamonds'), card('7', 'hearts'), card('2', 'clubs')], 2: [card('7', 'spades'), card('3', 'clubs')] } });
    await ask(alice, '7 of clubs');
    await expect(status(bob)).toHaveText('Alice asked Bob for 7s and got 1. Alice laid down the 7s. Alice goes again.');
    await expect(player(bob, 'Alice').locator('.player-books')).toHaveText('1 book');
    await expect(player(bob, 'Alice').getByTitle('Book of 7s')).toHaveText('7');
    await expect(handCards(alice)).toHaveCount(1);

    // An unshuffled deck deals Alice the ace to 7 of clubs: swap three aces into it and the deal makes a book
    const dealt = await seat('gofish', ['Alice']);
    const deck = standardDeck();
    const wanted = [card('A', 'clubs'), card('A', 'diamonds'), card('A', 'hearts'), card('A', 'spades'), ...deck.slice(1, 4)];
    const order = [...wanted, ...deck.filter(held => !wanted.some(other => other.rank === held.rank && other.suit === held.suit))];
    await dealt.random(...randomsFor(deck, order), 0);
    const late2 = await dealt.join('Bob');
    await expect(player(late2, 'Alice').locator('.player-books')).toHaveText('1 book');
    await expect(player(late2, 'Alice').getByTitle('Book of aces')).toBeVisible();
    await expect(player(late2, 'Alice').locator('.player-count')).toHaveText('3 cards');
  });

  test('an emptied hand draws one card at once, and with the stock empty the player is out: skipped and never asked', async ({ seat }) => {
    const refill = await start(seat);
    await deal(refill.table, { hands: { 1: [card('7', 'clubs')], 2: [card('7', 'hearts')] }, stock: [card('5', 'diamonds')] });
    await ask(refill.alice, '7 of clubs');
    await expect(player(refill.alice, 'Bob').locator('.player-count')).toHaveText('1 card');
    await expect(refill.alice.getByText('Stock: 0')).toBeVisible();
    await expect(handCard(refill.bob, '5 of diamonds')).toBeVisible();

    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, { hands: { 1: [card('7', 'clubs'), card('3', 'diamonds')], 2: [card('7', 'hearts')], 3: [card('4', 'spades'), card('9', 'diamonds')] } });
    await ask(alice, '7 of clubs', 'Bob');
    await expect(player(alice, 'Bob').locator('.player-count')).toHaveText('out of cards');
    await expect(hand(bob).locator('.hand-empty')).toHaveText('No cards');
    // Only Cara can be asked now, so she is picked already
    await expect(pick(alice, 'Bob')).toHaveCount(0);
    await ask(alice, '3 of diamonds');
    await expect(status(cara)).toHaveText('Alice asked Cara for 3s: go fish! The stock is empty.');
    // Bob, next up, is skipped
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(turn(bob)).toHaveText("Cara's turn");
  });

  test('the game ends when all 13 books are down: most books wins, and a tie for the most shares the win', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const six = (ranks: string) => ranks.split(' ') as Rank[];
    await deal(table, {
      hands: { 1: [card('K', 'clubs'), card('K', 'diamonds'), card('K', 'hearts')], 2: [card('K', 'spades')] },
      books: { 1: six('A 2 3 4 5 6'), 2: six('7 8 9 10 J Q') }
    });
    await ask(alice, 'king of clubs');
    await expect(status(bob)).toHaveText('Alice asked Bob for kings and got 1. Alice laid down the kings. Alice wins with 7 books!');
    await expect(turn(bob)).toHaveText('Game over');
    await expect(player(bob, 'Alice')).toHaveClass(/player-winner/);
    await expect(bob.getByText('Books: 13 of 13')).toBeVisible();

    const tie = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(tie.table, {
      hands: { 1: [card('K', 'clubs'), card('K', 'diamonds'), card('K', 'hearts')], 2: [card('K', 'spades')], 3: [card('2', 'clubs')] },
      books: { 1: six('A 2 3 4'), 2: six('5 6 7 8 9'), 3: six('10 J Q') }
    });
    await ask(tie.alice, 'king of clubs', 'Bob');
    await expect(status(tie.pages[2])).toHaveText(/Alice and Bob tie with 5 books each!$/);
    await expect(player(tie.pages[2], 'Alice')).toHaveClass(/player-winner/);
    await expect(player(tie.pages[2], 'Bob')).toHaveClass(/player-winner/);
    await expect(player(tie.pages[2], 'Cara')).not.toHaveClass(/player-winner/);
  });

  test('every ask is public, you see only your own hand and the counts, a drawn card shows to the drawer or to all when asked for, and the stock is hidden', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, {
      hands: { 1: [card('7', 'clubs'), card('2', 'diamonds')], 2: [card('3', 'clubs'), card('4', 'clubs')], 3: [card('5', 'hearts')] },
      stock: [card('9', 'spades'), card('7', 'hearts')]
    });
    for (const page of [bob, cara]) {
      await expect(page.getByRole('img', { name: '2 of diamonds' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '2 of diamonds' })).toHaveCount(0);
      await expect(player(page, 'Alice').locator('.player-count')).toHaveText('2 cards');
    }
    await expect(alice.locator('.stock .playing-card-back')).toBeVisible();

    // The asked rank drawn: everyone sees it
    await ask(alice, '7 of clubs', 'Bob');
    for (const page of [alice, bob, cara]) await expect(asks(page).first()).toHaveText('Alice asked Bob for 7s: go fish! Alice drew a 7. Alice goes again.');
    await expect(cara.locator('.fished')).toContainText('Alice drew this card');
    await expect(cara.locator('.fished').getByRole('img', { name: '7 of hearts' })).toBeVisible();

    // Any other card: only Alice sees it
    await ask(alice, '2 of diamonds', 'Cara');
    await expect(alice.locator('.fished')).toContainText('You drew this card');
    await expect(alice.locator('.fished').getByRole('img', { name: '9 of spades' })).toBeVisible();
    for (const page of [bob, cara]) {
      await expect(asks(page).first()).toHaveText('Alice asked Cara for 2s: go fish! Alice drew a card.');
      await expect(page.locator('.fished')).toHaveCount(0);
      await expect(page.getByRole('img', { name: '9 of spades' })).toHaveCount(0);
    }
    await expect(asks(cara)).toHaveCount(2);
  });

  test('a dismissed player\'s cards go into the stock and an out player draws, their books still count, the turn moves on, and the last player wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, {
      hands: { 1: [card('7', 'clubs')], 2: [card('5', 'spades'), card('6', 'spades')], 3: [] },
      books: { 1: [], 2: ['K'], 3: [] },
      current: 2
    });
    await expect(turn(alice)).toHaveText("Bob's turn");
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(player(alice, 'Bob (left)').locator('.player-books')).toHaveText('1 book');
    await expect(alice.getByText('Books: 1 of 13')).toBeVisible();
    // Cara was out and drew one of Bob's cards; the other is the stock. The turn was Bob's and passes to Cara
    await expect(player(alice, 'Cara').locator('.player-count')).toHaveText('1 card');
    await expect(alice.getByText('Stock: 1')).toBeVisible();
    await expect(turn(cara)).toHaveText('Your turn');

    const pair = await start(seat);
    await deal(pair.table, { hands: { 1: [card('7', 'clubs')], 2: [card('5', 'spades')] } });
    await leave(pair.bob);
    await dismiss('Bob', pair.alice);
    await expect(status(pair.alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('any player can ask to undo the last ask, and it is undone only if every player approves', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, { hands: { 1: [card('7', 'clubs')], 2: [card('7', 'hearts'), card('3', 'clubs')], 3: [card('5', 'hearts')] } });
    await ask(alice, '7 of clubs', 'Bob');
    await expect(handCards(bob)).toHaveCount(1);

    await bob.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(cara.locator('.undo-vote')).toHaveCount(0);
    await expect(handCards(bob)).toHaveCount(1);

    await undo(cara, alice, bob);
    await expect(status(alice)).toHaveText('Last turn undone');
    await expect(handCards(bob)).toHaveCount(2);
    await expect(handCard(bob, '7 of hearts')).toBeVisible();
    await expect(asks(alice)).toHaveCount(0);
  });
});

test.describe('Go Fish controls', () => {
  test('click a card to pick its rank, click a player, then Ask; with one other player holding cards they are picked for you', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, { hands: { 1: [card('7', 'clubs'), card('7', 'diamonds'), card('2', 'clubs')], 2: [card('3', 'clubs')], 3: [card('7', 'hearts')] } });
    await expect(alice.locator('.hint')).toHaveText('Click a card to pick the rank to ask for');
    await pickRank(alice, '7 of clubs');
    // Every card of the rank is raised
    await expect(handCard(alice, '7 of clubs')).toHaveAttribute('aria-pressed', 'true');
    await expect(handCard(alice, '7 of diamonds')).toHaveAttribute('aria-pressed', 'true');
    await expect(handCard(alice, '7 of diamonds')).toHaveClass(/playing-card-selected/);
    await expect(handCard(alice, '2 of clubs')).toHaveAttribute('aria-pressed', 'false');
    await expect(alice.locator('.hint')).toHaveText('Now pick the player to ask for 7s');
    await expect(askButton(alice)).toBeDisabled();
    await pick(alice, 'Cara').click();
    await expect(player(alice, 'Cara')).toHaveClass(/player-picked/);
    await expect(askButton(alice)).toHaveText('Ask Cara for 7s');
    await askButton(alice).click();
    await expect(status(bob)).toHaveText('Alice asked Cara for 7s and got 1. Alice goes again.');

    const pair = await start(seat);
    await deal(pair.table, { hands: { 1: [card('7', 'clubs')], 2: [card('3', 'clubs')] } });
    await pickRank(pair.alice, '7 of clubs');
    await expect(player(pair.alice, 'Bob')).toHaveClass(/player-picked/);
    await expect(askButton(pair.alice)).toHaveText('Ask Bob for 7s');
    await expect(askButton(pair.alice)).toBeEnabled();
    // Off your turn nothing can be picked
    await expect(handCards(pair.bob)).toHaveCount(1);
    await expect(hand(pair.bob).getByRole('button')).toHaveCount(0);
    await expect(pair.bob.locator('.player-pick')).toHaveCount(0);
  });

  test('the table lists every player in seat order with counts and books, outlines the current player, and shows the stock and the ask log newest first', async ({ seat }) => {
    const { table, pages: [alice, , cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, {
      hands: { 1: [card('7', 'clubs'), card('2', 'clubs')], 2: [card('3', 'clubs')], 3: [card('7', 'hearts'), card('4', 'spades'), card('4', 'hearts')] },
      stock: [card('9', 'spades'), card('8', 'spades')],
      books: { 1: [], 2: ['K'], 3: [] }
    });
    await expect(cara.locator('.players .player-name')).toHaveText(['Alice', 'Bob', 'Cara (you)']);
    await expect(cara.locator('.players .player-count')).toHaveText(['2 cards', '1 card', '3 cards']);
    await expect(cara.locator('.players .player-books')).toHaveText(['0 books', '1 book', '0 books']);
    await expect(player(cara, 'Alice')).toHaveClass(/player-current/);
    await expect(player(cara, 'Bob')).not.toHaveClass(/player-current/);
    await expect(cara.getByText('Stock: 2')).toBeVisible();
    await expect(cara.locator('.ask-log-empty')).toHaveText('No asks yet');
    await ask(alice, '7 of clubs', 'Cara');
    await ask(alice, '2 of clubs', 'Bob');
    await expect(asks(cara)).toHaveText([
      'Alice asked Bob for 2s: go fish! Alice drew a card.',
      'Alice asked Cara for 7s and got 1. Alice goes again.'
    ]);
    await expect(player(cara, 'Bob')).toHaveClass(/player-current/);
  });

  test('a card you just drew is shown in the status panel', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: [card('7', 'clubs')], 2: [card('3', 'clubs')] }, stock: [card('9', 'spades')] });
    await ask(alice, '7 of clubs');
    const panel = alice.locator('.game-info .fished');
    await expect(panel).toContainText('You drew this card');
    await expect(panel.getByRole('img', { name: '9 of spades' })).toBeVisible();
    await expect(bob.locator('.fished')).toHaveCount(0);
  });

  test('clicking Undo asks everyone to undo the last ask', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, { hands: { 1: [card('7', 'clubs')], 2: [card('3', 'clubs')], 3: [card('5', 'hearts')] }, stock: [card('9', 'spades')] });
    await ask(alice, '7 of clubs', 'Bob');
    await alice.getByRole('button', { name: 'Undo' }).click();
    for (const page of [bob, cara]) await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(alice.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('go fish');
    await expect(faq).toContainText('Asks so far');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Go Fish differences from Wikipedia', () => {
  test('the game runs until all 13 books are down, not when the first player runs out of cards', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: [card('7', 'clubs'), card('2', 'clubs')], 2: [card('7', 'hearts')] } });
    await ask(alice, '7 of clubs');
    await expect(player(alice, 'Bob').locator('.player-count')).toHaveText('out of cards');
    await expect(turn(bob)).toHaveText("Alice's turn");
    await expect(turn(alice)).not.toHaveText('Game over');
  });

  test('drawing the asked rank goes again, but completing a book with another drawn card does not', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, {
      hands: { 1: [card('7', 'clubs'), card('7', 'diamonds'), card('7', 'hearts'), card('2', 'clubs')], 2: [card('3', 'clubs')] },
      stock: [card('7', 'spades')]
    });
    await ask(alice, '2 of clubs');
    await expect(status(bob)).toHaveText('Alice asked Bob for 2s: go fish! Alice drew a card. Alice laid down the 7s.');
    await expect(player(bob, 'Alice').locator('.player-books')).toHaveText('1 book');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('after a go fish the turn passes to the next seat up, not to the player who was asked', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, { hands: { 1: [card('7', 'clubs')], 2: [card('3', 'clubs')], 3: [card('5', 'hearts')] }, stock: [card('9', 'spades')] });
    await ask(alice, '7 of clubs', 'Cara');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(turn(cara)).toHaveText("Bob's turn");
  });

  test('a random player starts', async ({ seat }) => {
    const table = await seat('gofish', ['Alice']);
    await table.random(...UNSHUFFLED, 0.9);
    const bob = await table.join('Bob');
    await expect(turn(bob)).toHaveText('You go first. Joining closes after the first ask.');
    await expect(turn(table.pages[0])).toHaveText('Bob goes first. Joining closes after the first ask.');
  });

  test('an empty hand draws one card straight away, so the current player always has someone to ask', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: [card('7', 'clubs'), card('2', 'clubs')], 2: [card('7', 'hearts')] }, stock: [card('5', 'diamonds')] });
    await ask(alice, '7 of clubs');
    await expect(handCard(bob, '5 of diamonds')).toBeVisible();
    await expect(player(alice, 'Bob').locator('.player-count')).toHaveText('1 card');
    await pickRank(alice, '2 of clubs');
    await expect(askButton(alice)).toHaveText('Ask Bob for 2s');
  });

  test('six players can play, dealt 5 cards each', async ({ seat }) => {
    const table = await seat('gofish', ['Alice', 'Bob', 'Cara', 'Dan', 'Eve']);
    await table.random(...UNSHUFFLED, 0);
    const finn = await table.join('Finn');
    await expect(finn.locator('.players .player')).toHaveCount(6);
    await expect(finn.locator('.players .player-count')).toHaveText(Array(6).fill('5 cards'));
    await expect(finn.getByText('Stock: 22')).toBeVisible();
  });

  test('a leaver\'s cards are shuffled into the stock and their books stay down', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, {
      hands: { 1: [card('7', 'clubs')], 2: [card('5', 'spades'), card('6', 'spades'), card('8', 'spades')], 3: [card('9', 'clubs')] },
      stock: [card('2', 'hearts')],
      books: { 1: [], 2: ['K', 'Q'], 3: [] }
    });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.getByText('Stock: 4')).toBeVisible();
    await expect(player(alice, 'Bob (left)').locator('.player-books')).toHaveText('2 books');
    await expect(alice.getByText('Books: 2 of 13')).toBeVisible();
  });
});

// The random numbers that make a Fisher-Yates shuffle of `items` come out as `order`
function randomsFor(items: PlayingCard[], order: PlayingCard[]): number[] {
  const deck = [...items];
  const values: number[] = [];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = deck.findIndex((held, index) => index <= i && held.rank === order[i].rank && held.suit === order[i].suit);
    [deck[i], deck[j]] = [deck[j], deck[i]];
    values.push((j + 0.5) / (i + 1));
  }
  return values;
}
