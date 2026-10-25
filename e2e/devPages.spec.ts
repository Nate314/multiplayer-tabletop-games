import { test, expect, newPlayer } from './fixtures.ts';

type Listing = { name: string; params: string[]; samples: string[][] }[];

test('/dev/svgs shows every server SVG with each sample and its URL', async ({ browser, server }) => {
  const listing = (await (await fetch(`${server.url}/api/svg`)).json()) as Listing;
  const urls = listing.flatMap(({ name, samples }) =>
    (samples.length ? samples : [[]]).map(params => ['/api/svg', name, ...params.map(encodeURIComponent)].join('/')));
  expect(urls.length).toBeGreaterThan(0);

  const page = await newPlayer(browser, server);
  const errors: Error[] = [];
  page.on('pageerror', error => errors.push(error));
  await page.goto('/dev/svgs');
  const cards = page.locator('.dev-card');
  await expect(cards).toHaveCount(urls.length);
  await expect(page.locator('.dev-card-url')).toHaveText(urls);
  await expect(cards.locator('.server-svg svg')).toHaveCount(urls.length);
  expect(errors).toEqual([]);
});

test('/dev/sounds plays each of the five sounds without an error', async ({ browser, server }) => {
  const page = await newPlayer(browser, server);
  const errors: Error[] = [];
  page.on('pageerror', error => errors.push(error));
  await page.goto('/dev/sounds');
  const buttons = page.getByRole('button', { name: /^Play / });
  await expect(buttons).toHaveCount(5);
  for (const button of await buttons.all()) await button.click();
  expect(errors).toEqual([]);
});
