# Storage Prefix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `localStorage` and `sessionStorage` key the app writes is stored as `multiplayer-tabletop-games:<key>`, and a value saved under the old bare key is moved to the new key the first time it is read.

**Architecture:** `src/services/storage.ts` already holds `readJson`, `writeJson` and `removeKey`, which every service uses. It gains `STORAGE_PREFIX` and two string helpers, `readText` and `writeText`, that add the prefix and do the migration; the JSON helpers and `removeKey` are rebuilt on them, so `settings.ts`, `session.ts` and `device.ts` keep passing bare keys and need no change. `ThemeToggle.tsx` stops calling `localStorage` directly and uses `writeText`. The inline theme script in `index.html` cannot import a module, so it repeats the prefixed key and the same migration, and a unit test pins its key to `STORAGE_PREFIX`.

**Tech Stack:** TypeScript, React 19, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-pause-resume-jenga-and-fixes-design.md`, section 1. Index plan: `docs/superpowers/plans/2026-10-31-pause-resume-jenga-and-fixes.md` (Shared contracts, ports, combining). Branch `storage-prefix` from `pause-resume-jenga-and-fixes`. Server PORT 3201, E2E_PORT_BASE 6410.

## Global Constraints

All of the index plan's Global Constraints, plus:

- The prefix is exactly `STORAGE_PREFIX = 'multiplayer-tabletop-games:'`, exported from `src/services/storage.ts`. No other file builds a prefixed key, except the inline script in `index.html` (pinned by a test).
- Callers keep passing bare keys (`'deviceId'`, `'preferences'`, `'inGame'`, `'theme'`...). No key constant in `settings.ts`, `session.ts`, `device.ts` or `ThemeToggle.tsx` changes.
- Stored value formats do not change: JSON keys stay JSON, `theme` stays the raw string `light` or `dark`.
- **Override from plan review (wins over anything below that says otherwise):** migration never removes or writes a bare key, since a bare key may belong to another app on the same domain. It is copy-only and runs once per storage: the first `readText` on a storage where the marker `multiplayer-tabletop-games:migrated` is absent copies each bare key from the list of keys this app uses (the `*_KEY` constants in `settings.ts`, `session.ts`, `device.ts` and `theme`) to its prefixed name when the prefixed one is missing, then sets the marker. After the marker exists, bare keys are never read. `removeKey` removes only the prefixed key. The `index.html` script reads the prefixed theme and falls back to bare `theme` only while the marker is absent. Rewrite the affected tests and Review Focus items to match (a bare key is never removed; a removed key is never resurrected because bare keys are not read after the marker).
- Every storage access still swallows errors (blocked or full storage), as today.
- Contract additions: `readText(storage: () => Storage, key: string): string | null` and `writeText(storage: () => Storage, key: string, value: string): void` in `src/services/storage.ts`, for a value that is not JSON. Other plans adding a key use `readJson` / `writeJson` / `removeKey` (or these) with the bare key.

## Review Focus

1. A device ID saved under the bare `deviceId` key before the update: the same ID comes back and is stored under the prefixed key, so the player keeps their stats and seats (Task 1, device test).
2. A dark theme saved under the bare `theme` key: the first paint after the update is still dark, because the inline script in `index.html` reads and moves the key before React loads (Task 2, e2e).
3. Storage that reads but refuses writes (quota full) during migration: the old value is still returned and the bare key is not removed, so nothing is lost (Task 1).
4. Both keys present (an old tab wrote the bare key after the move): the prefixed value wins and the bare key is left alone (Task 1).
5. `removeKey` on a key never read since the update (for example `saveSession` removing `inGame` in a fresh tab): both the prefixed and the bare key go, so a stale bare value is never migrated back later (Task 1).

---

### Task 1: Prefix and migration in `storage.ts`

**Files:**
- Modify: `src/services/storage.ts`
- Create: `src/services/storage.test.ts`
- Modify: `src/services/device.test.ts` (stub gains `removeItem`; expected write key becomes prefixed)
- Modify: `src/services/session.test.ts`, `src/services/settings.test.ts` (one migration test each)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const STORAGE_PREFIX = 'multiplayer-tabletop-games:'`
  - `export function readText(storage: () => Storage, key: string): string | null`: reads `STORAGE_PREFIX + key`; when that is `null`, reads the bare `key` and, if found, `setItem`s it under the prefixed key and then `removeItem`s the bare key (the remove only after the write succeeded). Any error gives `null` (or the bare value if only the write failed).
  - `export function writeText(storage: () => Storage, key: string, value: string): void`: writes `STORAGE_PREFIX + key`, swallowing errors.
  - `readJson`, `writeJson`, `removeKey`: same signatures as today. `readJson` parses `readText`; `writeJson` calls `writeText` with `JSON.stringify(value)`; `removeKey` removes both `STORAGE_PREFIX + key` and the bare `key`, each in its own try so one failure does not skip the other.

- [ ] **Step 1: Write the failing tests in `src/services/storage.test.ts`**

Use a Map-backed stub like `device.test.ts`'s (`getItem`, `setItem`, `removeItem`), exposing `items` so tests can inspect raw keys, and an option for `setItem` to throw.

```ts
test('a write is stored under the prefixed key', () => {
  writeJson(storage, 'preferences', { muted: true })
  assert.equal(items.get('multiplayer-tabletop-games:preferences'), '{"muted":true}')
  assert.equal(items.has('preferences'), false)
})

test('a read uses the prefixed key', () => {
  // items: { 'multiplayer-tabletop-games:historySpeed': '2' }
  assert.equal(readJson(storage, 'historySpeed'), 2)
})

test('a bare key is moved to the prefixed key once', () => {
  // items: { deviceId: '"<32 hex>"' }
  assert.equal(readJson(storage, 'deviceId'), '<32 hex>')
  assert.equal(items.get('multiplayer-tabletop-games:deviceId'), '"<32 hex>"')
  assert.equal(items.has('deviceId'), false)
  // a second read finds the prefixed key: count setItem calls, still 1
})

test('when both keys exist the prefixed one wins and the bare one is left', () => {
  // items: { theme: 'light', 'multiplayer-tabletop-games:theme': 'dark' }
  assert.equal(readText(storage, 'theme'), 'dark')
  assert.equal(items.get('theme'), 'light')
})

test('if the move cannot be written the old value is returned and kept', () => {
  // setItem throws; items: { joinForm: '{"playerName":"Ann"}' }
  assert.deepEqual(readJson(storage, 'joinForm'), { playerName: 'Ann' })
  assert.equal(items.get('joinForm'), '{"playerName":"Ann"}')
})

test('removeKey removes the prefixed and the bare key', () => {
  // items: { inGame: '{}', 'multiplayer-tabletop-games:inGame': '{}' }
  removeKey(storage, 'inGame')
  assert.equal(items.size, 0)
})

test('readText and writeText keep a raw string', () => {
  writeText(storage, 'theme', 'dark')
  assert.equal(items.get('multiplayer-tabletop-games:theme'), 'dark')
  assert.equal(readText(storage, 'theme'), 'dark')
})

test('blocked storage reads null and writes do not throw', () => {
  const blocked = (() => { throw new Error('blocked') }) as () => Storage
  assert.equal(readText(blocked, 'theme'), null)
  assert.equal(readJson(blocked, 'theme'), null)
  writeText(blocked, 'theme', 'dark'); writeJson(blocked, 'x', 1); removeKey(blocked, 'x')
})
```

Also in this step:
- `device.test.ts`: add `removeItem` to `stubStorage`; in 'the ID is 32 hex characters, saved once and reused' expect `writes` to equal `['multiplayer-tabletop-games:deviceId']`; add `test('a device ID saved under the old key is kept and moved')` with `stubStorage({ deviceId: JSON.stringify(id) })`, asserting `deviceId(storage) === id` and `writes` equals `['multiplayer-tabletop-games:deviceId']`.
- `session.test.ts`: add `test('a last game saved under the old key is still offered')`: `installStorage('localStorage', { lastGame: JSON.stringify({ gameType: 'gofish', gameId: 'abc', playerName: 'Ann' }) })`, empty sessionStorage, `loadSession()` has `playerName: 'Ann'` and `inGame: false`.
- `settings.test.ts`: add `test('preferences saved under the old key are kept')`: `installStorage({ preferences: JSON.stringify({ ...DEFAULT_PREFERENCES, muted: true }) })`, `loadPreferences().muted === true`.

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --test src/services/`
Expected: the prefixed-key tests in `storage.test.ts` and the device write-key test FAIL (`readText` / `writeText` not exported, writes are `['deviceId']`). The session and settings migration tests already pass (bare keys are read today); that is expected and they guard the change.

- [ ] **Step 3: Implement `STORAGE_PREFIX`, `readText`, `writeText` and rebuild `readJson`, `writeJson`, `removeKey` in `src/services/storage.ts`**

Keep the file's existing one-line "why" comments; add one line on why the prefix exists (other apps on the same domain) and one on the migration.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/services/`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add src/services/storage.ts src/services/storage.test.ts src/services/device.test.ts src/services/session.test.ts src/services/settings.test.ts
git commit -m "Prefix storage keys with the repository name and move old keys on first read"
```

---

### Task 2: Theme through `storage.ts` and the inline script

**Files:**
- Modify: `src/components/ThemeToggle.tsx:25-29` (the `localStorage.setItem` try block)
- Modify: `index.html:13-25` (the inline theme script)
- Modify: `src/services/storage.test.ts` (one test pinning `index.html`)
- Modify: `e2e/settings.spec.ts` (one test)

**Interfaces:**
- Consumes: `writeText(storage, key, value)` and `STORAGE_PREFIX` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

In `src/services/storage.test.ts`:

```ts
test('the inline theme script in index.html reads the prefixed theme key', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  assert.ok(html.includes(`'${STORAGE_PREFIX}theme'`))
})
```

In `e2e/settings.spec.ts`, inside the `Settings` describe:

```ts
test('a theme saved before the storage prefix is kept and moved', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('theme', 'dark'); });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('multiplayer-tabletop-games:theme'))).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  await page.getByRole('button', { name: 'Switch to light mode' }).first().click();
  expect(await page.evaluate(() => localStorage.getItem('multiplayer-tabletop-games:theme'))).toBe('light');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test src/services/storage.test.ts`
Expected: FAIL on the `index.html` test.
Run (after `npx vite build`): `E2E_PORT_BASE=6410 npx playwright test e2e/settings.spec.ts -g "storage prefix"`
Expected: FAIL (the prefixed key is null).

- [ ] **Step 3: Implement**

- `ThemeToggle.tsx`: replace the try/catch with `writeText(() => localStorage, STORAGE_KEY, theme)` (import from `../services/storage.ts`); `STORAGE_KEY` stays `'theme'`. Keep the comment that the theme lasts until the page goes away when storage is blocked, moved next to the call or dropped since `storage.ts` already says it.
- `index.html`: the script mirrors `readText`, since it runs before any module loads. Keep the existing default and theme-color lines; the read becomes:

```js
// Same key and migration as readText in src/services/storage.ts, which this script cannot import
const key = 'multiplayer-tabletop-games:theme';
let saved = localStorage.getItem(key);
if (saved === null) {
  saved = localStorage.getItem('theme');
  if (saved !== null) {
    localStorage.setItem(key, saved);
    localStorage.removeItem('theme');
  }
}
theme = saved || 'light';
```

All of it stays inside the existing `try`, so blocked storage keeps the default. A failed `setItem` throws before the remove, so the bare key is kept, matching `readText`.

- [ ] **Step 4: Run them to verify they pass**

Run: `node --test src/services/storage.test.ts`
Expected: PASS.
Run: `npx vite build && E2E_PORT_BASE=6410 npx playwright test e2e/settings.spec.ts`
Expected: PASS, all Settings tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThemeToggle.tsx index.html src/services/storage.test.ts e2e/settings.spec.ts
git commit -m "Read and save the theme under the prefixed key, moving the old one before first paint"
```

---

### Task 3: E2E keys, docs, gates and PR

**Files:**
- Modify: `e2e/alerts.spec.ts:135` (`'preferences'`), `e2e/rematch.spec.ts:39` (`'inGame'` in `sessionStorage`), `e2e/sharing.spec.ts:7` (`'joinForm'`), `e2e/stats.spec.ts:21` (`'deviceId'`): each raw key becomes `'multiplayer-tabletop-games:<key>'`
- Modify: `docs/architecture.md` (lines 130, 134, 165, 171-174, 300 name keys; add the prefix and migration to the `storage.ts` bullet at 173)
- Modify: `README.md` only if it names a storage key (it does not today; check again)

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: nothing.

- [ ] **Step 1: Run the four specs to see the stale keys fail**

Run: `npx vite build && E2E_PORT_BASE=6410 npx playwright test e2e/alerts.spec.ts e2e/rematch.spec.ts e2e/sharing.spec.ts e2e/stats.spec.ts`
Expected: FAIL where a spec reads or writes the bare key. (`rematch.spec.ts` line 39 polls for `null` and passes either way, and `sharing.spec.ts` line 7 sets a bare key that migration still picks up; update both anyway so the specs test the real key.)

- [ ] **Step 2: Update the four keys**

Write the literal prefixed string in each spec (e2e code runs in the page, so it cannot import `STORAGE_PREFIX`).

- [ ] **Step 3: Run the four specs to verify they pass**

Run: `E2E_PORT_BASE=6410 npx playwright test e2e/alerts.spec.ts e2e/rematch.spec.ts e2e/sharing.spec.ts e2e/stats.spec.ts`
Expected: PASS.

- [ ] **Step 4: Update `docs/architecture.md`**

The `storage.ts` bullet says every key is stored as `multiplayer-tabletop-games:<key>` (`STORAGE_PREFIX`), that callers pass the bare key, that a bare key from before the change is moved on first read (and `removeKey` clears both), and that `readText` / `writeText` hold the raw theme string. Where the doc says "`localStorage` under `lastGame`" or "`localStorage.deviceId`", add that the stored key carries the prefix (one mention per paragraph, not on every key). Mention the inline script in `index.html` sharing the key.

- [ ] **Step 5: Gates**

Run: `npm run lint && npm test && npm run build`
Expected: all pass.
Run: `E2E_PORT_BASE=6410 npx playwright test e2e/settings.spec.ts e2e/alerts.spec.ts e2e/rematch.spec.ts e2e/sharing.spec.ts e2e/stats.spec.ts`
Expected: PASS. A failure is rerun alone once; record both results.

- [ ] **Step 6: Browser check**

`npx vite build` then `PORT=3201 node server/server.ts`, in your own Chrome tab at `http://localhost:3201`:
- In DevTools via `javascript_tool`: clear storage, set bare `theme` = `dark`, `deviceId` = a JSON 32-hex string, `preferences` with `muted: true`; reload. Expect a dark first paint, the Settings dialog showing Mute all checked, and `localStorage` holding only prefixed keys with the same device ID.
- Join a game, reload: the seat is rejoined (prefixed `inGame` in `sessionStorage`, prefixed `lastGame` in `localStorage`).
- Toggle the theme in light and dark at desktop width and in 390 px and 320 px iframes (the phone toggle is in Settings); each writes the prefixed `theme`.

- [ ] **Step 7: Commit and open the PR**

```bash
git add e2e/alerts.spec.ts e2e/rematch.spec.ts e2e/sharing.spec.ts e2e/stats.spec.ts docs/architecture.md
git commit -m "Use prefixed storage keys in e2e specs and document the prefix"
gh pr create --base pause-resume-jenga-and-fixes --title "Prefix storage keys with the repository name"
```

PR body per the index plan (Summary, Rulings, Known gaps, Verification). Rulings to state: bare and prefixed both present keeps the prefixed value; `removeKey` clears both; theme stays a raw string; migration also moves a bare key another app on the same domain wrote under the same name (the spec's call; each loader already validates its value).
