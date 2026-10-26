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

const TRICK_HIDE = ['.game-id', '.seats'];
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
    hide: [others('.seat'), '.trick', '.game-id'],
    move: async page => { await button(page, /^Take task/).first().click(); }
  },
  war: {
    keep: ['.turn-message', '.flip-button', you('.war-seat'), you('.war-seat') + ' .war-seat-count'],
    hide: [others('.war-seat'), '.war-battle', '.war-summary', '.game-id'],
    move: async page => { await button(page, 'Flip').click(); }
  },
  gofish: {
    keep: ['.hand', '.turn-message', '.ask-button', you('.player')],
    hide: ['.table-middle', '.ask-log', '.game-id'],
    move: async page => {
      await page.locator('section.hand .rank-group').first().locator('.playing-card').last().click();
      await page.locator('.player-pick').first().click();
      await page.locator('.ask-button').click();
    }
  },
  holdem: {
    keep: ['.turn-message', you('.holdem-seat') + ' .playing-card', you('.holdem-seat') + ' .holdem-seat-chips', '.holdem-pots li', '.action-buttons >> text=Fold'],
    hide: [others('.holdem-seat'), '.holdem-board', '.game-id'],
    move: async page => { await button(page, /^(Check|Call)/).click(); }
  },
  uno: {
    keep: ['.hand', '.turn-message', '.uno-button', '.piles', you('.player')], // UNO! is open to everyone; the catch button shows only while a call is owed
    hide: [others('.player'), '.game-id'],
    move: async page => { await button(page, 'Draw').click(); }
  },
  phase10: {
    keep: ['.my-hand', '.turn-message', '.piles', you('.seat')],
    hide: [others('.seat') + ' .seat-details', '.game-id'],
    board: '.table .groups', // Bob's laid set, which Alice can hit
    setup: async table => {
      const cards = [4, 16, 28].map(id => ({ id, kind: 'number', value: 5, color: 'red' }));
      await table.patch({ currentPlayer: 1, drawnBy: null, groups: [{ owner: 2, kind: 'set', value: 5, cards }] });
    },
    move: async page => { await page.locator('.piles .pile').first().click(); }
  },
  skipbo: {
    keep: ['.my-hand', '.turn-message', '.my-area .stock', '.my-area .discard-piles'],
    hide: ['.other-seats', '.game-id'],
    board: '.board',
    move: async page => {
      await page.locator('.my-hand .hand-cards button').first().click();
      await button(page, 'Choose discard pile 1').click();
      await button(page, 'Discard here on pile 1 and end your turn').click();
    }
  },
  racko: {
    keep: ['.my-rack', '.turn-message', '.piles .pile'],
    hide: ['.other-racks', '.game-id'],
    move: async page => { await button(page, /^Draw pile/).click(); }
  },
  rummikub: {
    keep: ['.rk-rack-area', '.rk-turn-message', '.rk-turn-buttons', you('.rk-player')],
    hide: [others('.rk-player'), '.rk-pool', '.game-id'],
    board: '.rk-table',
    move: async page => { await button(page, 'Draw a tile').click(); }
  },
  dominoes: {
    keep: ['.hand', '.turn-message', '.action-buttons', you('.player')],
    hide: [others('.player'), '.boneyard', '.line-ends', '.game-id'],
    board: '.board',
    move: async page => { await page.locator('.hand-tiles .tile-playable').first().click(); }
  },
  scrabble: {
    keep: ['.rack', '.turn-message', '.turn-buttons', you('.score-row')],
    hide: [others('.score-row'), '.bag-count', '.game-id'],
    board: '.board-wrap',
    move: async page => { await button(page, 'Pass').click(); }
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
