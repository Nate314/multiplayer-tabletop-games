import { expect, tableScreen, test } from './fixtures.ts';

// A table screen joins as a spectator that only ever sees the table

test('a table screen shows the QR code and link in the lobby', async ({ seat }) => {
  const table = await seat('hearts', ['Alice']);
  const tv = await tableScreen(table);
  await expect(tv.locator('.table-screen-qr svg')).toBeVisible();
  await expect(tv.locator('.table-screen-players li')).toHaveText(['Alice']);
  await expect(tv.locator('.table-screen-link')).toHaveText(new RegExp(`/join/hearts/${table.gameId}$`));
  await expect(table.pages[0].locator('.presence-watching')).toHaveText('Watching: Table screen');
});

test('the table screen shows the table and never a hand', async ({ seat }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan'], { agree: true });
  const tv = await tableScreen(table);
  await table.patch({ started: true }); // Hearts starts at the first pass
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await expect(tv.locator('.hand')).toHaveCount(0);
  await expect(tv.locator('.spectator-seats')).toHaveCount(0);
  await expect(tv.getByRole('button', { name: /^Ask to see/ })).toHaveCount(0);
});

test('the table screen rejoins after a refresh', async ({ seat }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan'], { agree: true });
  const tv = await tableScreen(table);
  await table.patch({ started: true });
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await tv.reload();
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await expect(tv.locator('.hand')).toHaveCount(0);
});

test('game over on the table screen has no Rematch', async ({ seat }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const tv = await tableScreen(table);
  await table.patch({ isGameOver: true, currentPlayer: null, winners: [1], gameStatus: 'Alice wins!' });
  const dialog = tv.getByRole('dialog', { name: 'Game over' });
  await expect(dialog.getByRole('button', { name: 'History', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Rematch' })).toHaveCount(0);
});

test('phones get the switch only while a table screen is connected', async ({ seat }) => {
  const table = await seat('hearts', ['Alice']);
  const phone = table.pages[0];
  await expect(phone.locator('.layout-switch')).toHaveCount(0);
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(0);
  const tv = await tableScreen(table);
  await expect(phone.getByRole('button', { name: 'Hand only' })).toHaveAttribute('aria-pressed', 'true');
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(1);
  await tv.context().close();
  await expect(phone.locator('.layout-switch')).toHaveCount(0);
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(0);
});

test('the choice is remembered', async ({ seat }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const phone = table.pages[0];
  await phone.getByRole('button', { name: 'Drop in column 1' }).click(); // a refresh rejoins only once the game started
  await tableScreen(table);
  await phone.getByRole('button', { name: 'Board and hand' }).click();
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(0);
  await phone.reload();
  await expect(phone.getByRole('button', { name: 'Board and hand' })).toHaveAttribute('aria-pressed', 'true');
});

test('pictionary: the table screen never shows the word', async ({ seat }) => {
  const table = await seat('pictionary', ['Alice', 'Bob', 'Cara']);
  const [alice, bob] = table.pages;
  await table.patch({ wordChoices: ['xylophone', 'quokka', 'zeppelin'] });
  await alice.getByRole('group', { name: 'Choose a word' }).getByRole('button', { name: 'xylophone' }).click();
  await table.patch({ word: 'red apple' });
  const tv = await tableScreen(table);
  const say = async (text: string) => {
    await bob.locator('#pictionary-chat-input').fill(text);
    await bob.locator('#pictionary-chat-input').press('Enter');
  };
  await say('blue pear'); // a public, wrong guess
  await say('red apple');
  await say('only for guessers');
  await expect(alice.locator('.chat-line', { hasText: 'only for guessers' })).toHaveCount(1); // delivered to those allowed
  await expect(tv.locator('.chat-line', { hasText: 'Bob: blue pear' })).toHaveCount(1);
  await expect(tv.locator('.pictionary-blanks')).toHaveAccessibleName('Word: 8 letters');
  await expect(tv.locator('.table-screen-status')).toContainText('Bob guessed the word');
  const shown = () => tv.locator('body').innerText();
  expect(await shown()).not.toContain('red apple');
  expect(await shown()).not.toContain('only for guessers');

  // When the turn runs out the reveal shows the word to everyone, the table screen included
  await table.patch({ phaseStartedAt: Date.now() - 89_500 });
  await expect(tv.locator('.pictionary-blanks')).toHaveAccessibleName('Word: red apple');
  expect(await shown()).toContain('red apple');
});
