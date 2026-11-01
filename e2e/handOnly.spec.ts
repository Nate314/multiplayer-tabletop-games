import type { Page } from '@playwright/test';
import { expect, nameOf, tableScreen, test, type Table } from './fixtures.ts';
import { GAMES } from '../games/registry.ts';

// While a table screen is connected, a phone on Hand only keeps what the player acts on and hides what the TV shows.
// Each row lists CSS selectors: `keep` must be visible, `hide` must exist and be hidden, and `board` (a board you act on)
// is hidden off turn and visible on it. `move` makes one legal move for the page whose turn it is (any page if none is).

type Row = {
  keep: string[];
  hide: string[];
  board?: string;
  setup?: (table: Table) => Promise<void>;
  move: (page: Page) => Promise<void>;
};

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Fay'];
const you = (selector: string) => `${selector}:has-text("(you)")`;
const others = (selector: string) => `${selector}:not(:has-text("(you)"))`;
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

const TRICK_HIDE = ['.seats'];
const TRICK_KEEP = ['.hand', '.turn-message', '.scoreboard'];

const HAND_ONLY: Record<string, Row> = {
  hearts: {
    keep: [...TRICK_KEEP, '.action-buttons >> text=/^Pass \\d\\/3$/'], // passing is a private choice, open to everyone at once
    hide: TRICK_HIDE,
    move: async page => {
      for (let slot = 0; slot < 3; slot++) await page.getByRole('region', { name: 'Your hand' }).getByRole('button').nth(slot).click();
      await button(page, /^Pass \d\/3$/).click();
    }
  },
  spades: {
    keep: [...TRICK_KEEP, '.hint'],
    hide: TRICK_HIDE,
    move: async page => { await button(page, 'Bid 1').click(); }
  },
  euchre: {
    keep: TRICK_KEEP,
    hide: TRICK_HIDE,
    move: async page => { await button(page, 'Pass').click(); }
  },
  rook: {
    keep: TRICK_KEEP,
    hide: TRICK_HIDE,
    move: async page => { await button(page, 'Pass').click(); }
  },
  thecrew: {
    keep: ['.hand', '.turn-message', you('.seat'), '.task-pool'], // the open tasks and your own tasks are your goal
    hide: [others('.seat'), '.trick'],
    move: async page => { await button(page, /^Take task/).first().click(); }
  },
  war: {
    keep: ['.turn-message', '.flip-button', you('.war-seat'), you('.war-seat') + ' .war-seat-count'],
    hide: [others('.war-seat'), '.war-battle', '.war-summary'],
    move: async page => { await button(page, 'Flip').click(); }
  },
  gofish: {
    keep: ['.hand', '.turn-message', '.ask-button', you('.player')],
    hide: ['.table-middle', '.ask-log'],
    move: async page => {
      await page.locator('section.hand .rank-group').first().locator('.playing-card').last().click();
      await page.locator('.player-pick').first().click();
      await page.locator('.ask-button').click();
    }
  },
  holdem: {
    keep: ['.turn-message', you('.holdem-seat') + ' .playing-card', you('.holdem-seat') + ' .holdem-seat-chips', '.holdem-pots li', '.action-buttons >> text=Fold'],
    hide: [others('.holdem-seat'), '.holdem-board'],
    move: async page => { await button(page, /^(Check|Call)/).click(); }
  },
  uno: {
    keep: ['.hand', '.turn-message', '.uno-button', '.piles', you('.player')], // UNO! is open to everyone; the catch button shows only while a call is owed
    hide: [others('.player')],
    move: async page => { await button(page, 'Draw').click(); }
  },
  phase10: {
    keep: ['.my-hand', '.turn-message', '.piles', you('.seat')],
    hide: [others('.seat') + ' .seat-details'],
    board: '.table .groups', // Bob's laid set, which Alice can hit
    setup: async table => {
      const cards = [4, 16, 28].map(id => ({ id, kind: 'number', value: 5, color: 'red' }));
      await table.patch({ currentPlayer: 1, drawnBy: null, groups: [{ owner: 2, kind: 'set', value: 5, cards }] });
    },
    move: async page => { await page.locator('.piles .pile').first().click(); }
  },
  skipbo: {
    keep: ['.my-hand', '.turn-message', '.my-area .stock', '.my-area .discard-piles'],
    hide: ['.other-seats'],
    board: '.board',
    move: async page => {
      await page.locator('.my-hand .hand-cards button').first().click();
      await button(page, 'Choose discard pile 1').click();
      await button(page, 'Discard here on pile 1 and end your turn').click();
    }
  },
  racko: {
    keep: ['.my-rack', '.turn-message', '.piles .pile'],
    hide: ['.other-racks'],
    move: async page => { await button(page, /^Draw pile/).click(); }
  },
  rummikub: {
    keep: ['.rk-rack-area', '.rk-turn-message', '.rk-turn-buttons', you('.rk-player')],
    hide: [others('.rk-player'), '.rk-pool'],
    board: '.rk-table',
    move: async page => { await button(page, 'Draw a tile').click(); }
  },
  dominoes: {
    keep: ['.hand', '.turn-message', '.action-buttons', you('.player')],
    hide: [others('.player'), '.boneyard', '.line-ends'],
    board: '.board',
    move: async page => { await page.locator('.hand-tiles .tile-playable').first().click(); }
  },
  scrabble: {
    keep: ['.rack', '.turn-message', '.turn-buttons', you('.score-row')],
    hide: [others('.score-row'), '.bag-count'],
    board: '.board-wrap',
    move: async page => { await button(page, 'Pass').click(); }
  },
  catan: {
    keep: ['.turn-message', '.hand-panel', you('.player-row')],
    hide: [others('.player-row'), '.bank-line'],
    board: '.board-area', // setup: the board is there on your turn to place
    move: async page => { await page.getByRole('button', { name: /^Intersection \d+$/ }).first().click(); }
  },
  risk: {
    keep: ['.turn-message', '.phase-panel', you('.player-row'), '.deck-line'],
    hide: [others('.player-row')],
    board: '.map-area',
    move: async page => {
      await button(page, 'All').click();
      await page.locator('.territory.selectable .disc').first().click();
      await button(page, 'Place all').click();
    }
  },
  tickettoride: {
    keep: ['.turn-message', '.hand-panel', '.ticket-choice', you('.player-row')], // the ticket choice is open before your turn
    hide: [others('.player-row')],
    board: '.map-frame',
    move: async page => { await button(page, /^Keep \d+ tickets?$/).click(); }
  },
  splendor: {
    keep: ['.turn-message', '.player-me', '.player-me .player-tokens'],
    hide: ['.player:not(.player-me)'],
    board: 'section.table',
    move: async page => {
      for (const gem of ['white', 'blue', 'green']) await page.locator(`.supply .gem-${gem}`).click();
      await button(page, 'Take gems').click();
    }
  },
  monopoly: {
    keep: ['.turn-message', '.turn-panel', you('.player-row')],
    hide: [others('.player-row')],
    board: '.board-area',
    move: async page => { await button(page, 'Roll the dice').click(); }
  },
  carcassonne: {
    keep: ['.cc-turn-message', '.cc-turn', you('.cc-player')],
    hide: [others('.cc-player')],
    board: '.cc-board-area',
    move: async page => {
      await page.locator('.cc-cell').first().click();
      await button(page, 'Place tile').click();
    }
  },
  azul: {
    keep: ['.turn-message', '.board-mine'],
    hide: ['.board-other'],
    board: '.table',
    move: async page => {
      await page.locator('.factories .factory').getByRole('button', { name: /^Take / }).first().click();
      await button(page, 'Floor line').click();
    }
  },
  chess: {
    keep: ['.side-panel .player-list', you('.player-row'), 'button:has-text("Undo")', 'button:has-text("Offer draw")', 'button:has-text("Resign")'],
    hide: ['.captured'],
    board: '.board-frame',
    move: async page => {
      await page.locator('[data-anim-key="square-6-4"]').click();
      await page.locator('[data-anim-key="square-4-4"]').click();
    }
  },
  checkers: {
    keep: ['.turn-message', '.player-list', 'button:has-text("Undo")', 'button:has-text("Resign")'],
    hide: [],
    board: '.board-frame',
    move: async page => {
      await page.locator('[data-anim-key^="square-5-"] .piece.player1').first().click();
      await page.locator('.square.target').first().click();
    }
  },
  connectfour: {
    keep: ['.turn-message', '.player-list', 'button:has-text("Undo")', 'button:has-text("Resign")'],
    hide: [],
    board: '.board-frame',
    move: async page => { await button(page, 'Drop in column 1').click(); }
  },
  backgammon: {
    keep: ['.bg-turn', '.bg-players', '.bg-undo'],
    hide: [],
    board: '.bg-board',
    setup: async table => { // the opening roll is made for Alice, so start from the turn that begins with a roll
      await table.patch({ dice: [], remaining: [], currentPlayer: 1, started: true, cube: 1, cubeOwner: null, doubleOffer: null, lastMove: null });
    },
    move: async page => { await button(page, 'Roll').click(); }
  },
  mancala: {
    keep: ['.turn-message', '.undo-button'],
    hide: [],
    board: '.board-wrap',
    move: async page => { await page.locator('.pit-bottom').first().click(); }
  },
  parchisi: {
    keep: ['.turn-message', '.dice-tray', '.undo-button', '.player-list'],
    hide: [],
    board: '.board-area .board',
    setup: async table => {
      await table.patch({
        pawns: { 1: [0, -1, -1, -1], 2: [-1, -1, -1, -1] }, dice: [{ value: 2, used: false }, { value: 4, used: false }], bonuses: [],
        roller: 1, currentPlayer: 1, doublesRolled: 0, splitBlockades: [], lastMove: null, started: true
      });
    },
    move: async page => {
      await page.locator('[data-anim-key="pawn-1-0"]').click();
      await page.locator('.board > .square', { has: page.locator('.destination-badge') }).first().click();
    }
  },
  quoridor: {
    keep: ['.game-info', '.action-buttons', '.piece-tray'],
    hide: [],
    board: '.board-frame',
    move: async page => { await page.locator('.board-area .board .board-row').nth(7).locator('.square').nth(4).click(); }
  },
  farkle: {
    keep: ['.turn-message', '.action-buttons', '.farkle-dice', '.farkle-score:not(.hand-only-hide)'],
    hide: ['.farkle-score.hand-only-hide'],
    move: async page => { await button(page, 'Roll').click(); }
  },
  yahtzee: {
    keep: ['.turn-message', '.yz-turn', '.yz-sheet', '.yz-total td:not(.hand-only-hide)'],
    hide: ['.yz-player.hand-only-hide'],
    move: async page => { await button(page, /^Roll/).click(); }
  },
  pictionary: {
    keep: ['.turn-message', '.pictionary-chat', '#pictionary-chat-input', you('.score-row')],
    hide: [others('.score-row')],
    board: '.pictionary-paper', // the drawer's canvas and tools; the TV shows the picture to the guessers
    move: async page => { await page.getByRole('group', { name: 'Choose a word' }).getByRole('button').first().click(); }
  },
  jenga: {
    keep: ['.jenga-status', '.jenga-undo'],
    hide: [],
    board: '.jenga-controls',
    setup: async table => { // Alice has pulled block 49 out, so the move is placing it, which needs no physics from the test
      const { blocks } = await table.state<{ blocks: { id: number }[] }>();
      await table.patch({ started: true, blocks: blocks.filter(block => block.id !== 49), held: 49, phase: 'place', pull: { seat: 1, block: 49 } });
    },
    move: async page => { await button(page, /^Place on top/).first().click(); }
  }
};

const visibleCount = (page: Page, selector: string) => page.locator(`${selector} >> visible=true`).count();

for (const [id, row] of Object.entries(HAND_ONLY)) {
  test(`${nameOf(id)} in Hand only keeps what you act on and hides what the TV shows`, async ({ seat }) => {
    const minimum = GAMES.find(game => game.info.id === id)?.info.minPlayers ?? 2;
    const table = await seat(id, NAMES.slice(0, minimum));
    await row.setup?.(table);
    await tableScreen(table);
    const turnOf = async () => (await table.state<{ currentPlayer: number | null }>()).currentPlayer;

    // Hand only is on for every phone, and data-my-turn marks exactly the player whose turn it is
    const checkLayout = async (keep: boolean) => {
      const current = await turnOf();
      for (const [index, page] of table.pages.entries()) {
        await expect(page.locator('.game-root[data-hand-only]')).toHaveCount(1);
        await expect(page.locator('.game-root[data-my-turn]')).toHaveCount(current === index + 1 ? 1 : 0);
        for (const selector of row.hide) {
          await expect.poll(() => page.locator(selector).count(), { message: `${selector} exists` }).toBeGreaterThan(0);
          expect(await visibleCount(page, selector), `${selector} is hidden`).toBe(0);
        }
        if (keep) for (const selector of row.keep) {
          await expect.poll(() => visibleCount(page, selector), { message: `${selector} is visible` }).toBeGreaterThan(0);
        }
        if (row.board) {
          await expect.poll(() => visibleCount(page, row.board!)).toBe(current === index + 1 ? 1 : 0);
        }
      }
      return current;
    };

    const current = await checkLayout(true);
    const before = JSON.stringify(await table.state());
    await row.move(table.pages[(current ?? 1) - 1]);
    await expect.poll(async () => JSON.stringify(await table.state())).not.toBe(before);
    // The layout still holds after the move, and the turn marker followed the turn
    await checkLayout(false);
  });
}

test('History shows the whole table in Hand only', async ({ seat }) => {
  const table = await seat('scrabble', NAMES.slice(0, 2));
  await tableScreen(table);
  const current = (await table.state<{ currentPlayer: number }>()).currentPlayer;
  const page = table.pages[current - 1];
  await button(page, 'Pass').click();
  // This phone is now off turn, so both hiding rules apply outside History
  await expect(page.locator('.game-root[data-hand-only]:not([data-my-turn])')).toHaveCount(1);
  await expect(page.locator('.score-row >> visible=true')).toHaveCount(1);
  await button(page, 'History').click();
  const history = page.getByRole('dialog', { name: 'History' });
  await expect(history.locator('.board-wrap')).toBeVisible();
  await expect(history.locator('.score-row >> visible=true')).toHaveCount(2);
});

test('Catan trade offers and Monopoly auctions can be answered out of turn in Hand only', async ({ seat }) => {
  const catan = await seat('catan', NAMES.slice(0, 3));
  const noCards = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  await catan.patch({
    started: true, setup: null, rolled: true, turnHolder: 1, currentPlayer: 1,
    trade: { from: 1, to: null, give: { ...noCards, wood: 1 }, get: { ...noCards, ore: 1 }, declined: [] }
  });
  await tableScreen(catan);
  const bob = catan.pages[1];
  await expect(bob.locator('.game-root[data-hand-only]:not([data-my-turn])')).toHaveCount(1);
  await expect(bob.locator('.board-area >> visible=true')).toHaveCount(0);
  await expect(button(bob, 'Accept')).toBeVisible();
  await expect(button(bob, 'Decline')).toBeVisible();

  const monopoly = await seat('monopoly', NAMES.slice(0, 2));
  await tableScreen(monopoly);
  const first = (await monopoly.state<{ currentPlayer: number }>()).currentPlayer; // the roll-off picks who starts
  const roller = monopoly.pages[first - 1];
  await monopoly.dice(1, 2); // Baltic Avenue, which the roller declines
  await button(roller, 'Roll the dice').click();
  await button(roller, 'Decline and auction').click();
  const other = monopoly.pages[2 - first];
  await expect(other.locator('.game-root[data-hand-only]:not([data-my-turn])')).toHaveCount(1);
  await expect(other.locator('.board-area >> visible=true')).toHaveCount(0);
  await expect(other.getByRole('region', { name: 'Auction' })).toBeVisible();
  await expect(button(other, 'Pass')).toBeVisible();
});
