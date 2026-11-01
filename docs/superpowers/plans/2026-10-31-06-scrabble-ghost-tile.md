# Scrabble Ghost Tile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find and fix the see-through "ghost tile" Scrabble's move animation shows, and the same fault in every other game that builds an animation copy by hand.

**Architecture:** Since #37 (e3e00b6, server-drawn assets) a tile's face is no longer a CSS background on `.tile` but a `<ServerSvg className="piece-art">` child. The copies that `ghostSlide` flies (`ghostToBag` in Scrabble, `ghostCard` in Phase 10) are built with `document.createElement` and never got that child, so they render as an outline with a letter and no face. One new DOM helper, `pieceArt(url)`, gives a hand-built copy the same face from the SVG cache, and both games use it. Task 1 confirms this in the browser before any code changes.

**Tech Stack:** TypeScript, React 19, Web Animations API, Playwright, node:test.

**Spec:** `docs/superpowers/specs/2026-10-31-pause-resume-jenga-and-fixes-design.md`, section 6. Index plan: `docs/superpowers/plans/2026-10-31-pause-resume-jenga-and-fixes.md`. Branch `scrabble-ghost-tile` from `pause-resume-jenga-and-fixes`, PORT 3206, E2E_PORT_BASE 6510.

## Hypothesis (from the planner's reading and a headless probe)

Ranked, most likely first. Task 1 confirms or rejects H1 before Task 2 starts.

- **H1, faceless copies.** `ghostToBag` (`games/scrabble/client/animateMove.ts:43-56`) builds `span.tile > span.tile-letter + span.tile-value` with no `.piece-art`. `.tile` lost `background: var(--tile-bg)` in e3e00b6 (`git show e3e00b6 -- games/scrabble/client/scrabble.scss`), so the copy is transparent. Evidence: a Playwright probe with `motion: true` (1280x720, exchange of 3 tiles) showed, 20 ms after Exchange, three see-through tiles (border and letter only) drawn over the new rack at the exchanged places, then sliding to "Tiles in the bag" and fading; they are gone from the DOM by about 450 ms (`MOVE_DURATION_MS` 300 + 2 x `STAGGER_MS` 70). Phase 10's `ghostCard` (`games/phase10/client/animateMove.ts:56-69`) has the same gap: `CardView` and `Piles` draw `cardArtUrl('solid' | 'bands' | 'stripes')` behind the face, the copy does not, so the card back Bob sees fly to Alice's seat is a see-through outline. Yahtzee's `pointsLabel` is text with no art and is not affected; `src/drag/ghost.ts` clones a real element (art included) and is not affected.
- **H2, parked draws.** Drawn tiles slide from the bag with `fill: 'backwards'` and a stagger, so for up to 6 x 70 ms each waits stacked on "Tiles in the bag", over the Undo button. This is by design and nothing persists. If Task 1 shows the user-visible ghost is this stack and not H1, stop and report.
- **H3, a copy that stays.** No probe run left a stray `.tile` or `.drag-ghost` after animations ended (own play with clicks, own play with mouse drags, own play on a Pixel 7 touch context, exchange, opponent's view). If Task 1 finds one that stays, stop and report with the steps; the fix tasks below do not cover it.

Seen in the probe and not in scope: on a phone-width layout the kept rack tiles started their slide about 24 px off, because the side panel above the rack changed height with the new status line after the rects were taken. Plan 2 changes `useMoveAnimation` remeasuring; record this under Known gaps in the PR rather than fixing it here.

## Global Constraints

All of the index plan's Global Constraints, plus:

- Branch `scrabble-ghost-tile`, `PORT=3206`, `E2E_PORT_BASE=6510`.
- Do not touch `src/animation/useMoveAnimation.ts` or `src/animation/motion.ts` (plan 2 changes both); the fix lives in the ghost builders.
- A ghost copy looks like the piece it copies: same classes, same `.piece-art` drawing, `aria-hidden="true"`.
- Contract additions (inside this plan's own files, no other plan needs them): `pieceArt(url: string): HTMLSpanElement` in new `src/assets/pieceArt.ts`; `recordGhosts(page, parent, piece)` and `ghostsSeen(page)` in `e2e/fixtures.ts`.
- E2E specs for the gate: `e2e/scrabble.spec.ts e2e/phase10.spec.ts e2e/yahtzee.spec.ts`.

## Review Focus

1. A ghost made before its drawing is cached (first move after a hard refresh): it must still show the letter or card face and be removed, never throw (Task 2, `pieceArt` falls back to an empty span).
2. Dark theme: the copy's face must use the dark `--tile-bg` and card colors like the real pieces, since the art reads the same CSS variables (Task 4 browser check in both themes).
3. A ghost flown inside the History dialog (`ghostSlide` appends to `.history-board`): same face there, and nothing left after stepping (Task 2 test steps History forward with Animations on).
4. Reduced motion: no copy is created at all (existing Phase 10 test, plus Task 2's still-table check).
5. A blank exchanged: its copy has the blank class and no letter, and still has the face (Task 2 test exchanges a `?`).

---

### Task 1: Reproduce and confirm the root cause

**Files:**
- None in the repo. Scratch files only, under the scratchpad directory.

**Interfaces:**
- Produces: a short written finding (in the task report, later the PR's Rulings) that names H1 as confirmed, or stops the plan.

- [ ] **Step 1: Build and seat a game in Chrome.** `export PATH=/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH`, `npx vite build`, then `E2E=1 PORT=3206 DATABASE_PATH=:memory: node server/server.ts` in the background. In your own new Chrome tab open `http://localhost:3206`, join Scrabble game `ghost1` as Alice; seat Bob from a second browser context (a headless Playwright page, see Step 3's setup) so Alice can exchange. Set Alice's rack with `POST /api/e2e/state/scrabble/ghost1` body `{"started":true,"currentPlayer":1,"racks":{"1":["C","A","T","?","Y","Z","E"],"2":<Bob's dealt rack from GET>}}`.
- [ ] **Step 2: Exchange C, ? and Z in Chrome and watch the rack.** Expected under H1: three outline tiles with no face fly from the rack to "Tiles in the bag". Check also that Settings has Animations on and the OS is not set to reduce motion.
- [ ] **Step 3: Capture frames.** In the scratchpad: `package.json` `{"type":"module"}`, a `node_modules` junction to the repo's (`New-Item -ItemType Junction`), a config `defineConfig({ testDir: '.', testMatch: 'probe.spec.ts', use: { ...devices['Desktop Chrome'] } })`, and a spec importing `test` from the repo's `e2e/fixtures.ts` by absolute path. Seat with `{ motion: true }`, exchange 3 tiles, and take `page.screenshot` with an absolute `C:/...` path at 20, 80, 140 and 500 ms. Run from the repo root with `E2E_SKIP_BUILD=1 E2E_PORT_BASE=6510 npx playwright test --config <scratch config>`. Expected: frames at 20 to 140 ms show faceless copies; at 500 ms `document.querySelectorAll('.game-layout > .tile').length` is 0.
- [ ] **Step 4: Confirm the cause.** In DevTools on a live copy: `getComputedStyle(copy).backgroundColor` is `rgba(0, 0, 0, 0)` and `copy.querySelector('.piece-art')` is null, while a rack tile has a `.piece-art` with an `svg`. Do the same for Phase 10: Alice draws from the pile, and Bob's `.game-screen > .card.card-back` copy has no `.piece-art`.
- [ ] **Step 5: Decide.** H1 confirmed: continue to Task 2. Otherwise stop and report the frames and steps; do not write a fix for an unconfirmed cause. No commit in this task.

### Task 2: `pieceArt` and a solid Scrabble exchange copy

**Files:**
- Create: `src/assets/pieceArt.ts`
- Modify: `games/scrabble/client/animateMove.ts:43-56` (`ghostToBag`)
- Modify: `e2e/fixtures.ts` (two helpers next to `recordTones`)
- Test: `e2e/scrabble.spec.ts` (the `start` helper gains an options argument; one new test)

**Interfaces:**
- Consumes: `cachedSvg(url)` from `src/assets/svgCache.ts`, `cardArtUrl('solid')` from `src/components/pieces.ts`.
- Produces:
  - `export function pieceArt(url: string): HTMLSpanElement`: `<span class="server-svg piece-art" aria-hidden="true">` whose `innerHTML` is `cachedSvg(url) ?? ''`. Comment: the DOM twin of `<ServerSvg url className="piece-art" />`, for a copy built outside React; the drawing is cached because the piece it copies was on screen. Same safety note as `ServerSvg` (markup only from this site's `/api/svg`).
  - `export async function recordGhosts(page: Page, parent: string, piece: string): Promise<void>`: a `MutationObserver` on `document.querySelector(parent)` (`childList` only) that pushes, for each added element matching `piece`, `node.querySelector('.piece-art svg') !== null` onto `window.ghosts`.
  - `export const ghostsSeen = (page: Page) => page.evaluate(() => (window as unknown as { ghosts: boolean[] }).ghosts.slice())`.
  - `start(seat, setup = {}, names = ['Alice', 'Bob'], options: SeatOptions = {})` in `e2e/scrabble.spec.ts`, passing `options` to `seat`.

- [ ] **Step 1: Write the failing test** in `e2e/scrabble.spec.ts`, in the describe block that holds the animation and drag tests:

```ts
test('an exchanged tile flies into the bag with its face, and nothing is left behind', async ({ seat }) => {
  const { alice } = await start(seat, { racks: { 1: 'CAT?YZE' } }, ['Alice', 'Bob'], { motion: true });
  await recordGhosts(alice, '.game-layout', '.tile');
  await button(alice, 'Exchange').click();
  for (const letter of ['C', '?', 'Z']) await rackTile(alice, letter).click();
  await button(alice, 'Exchange 3').click();
  await expect.poll(() => ghostsSeen(alice)).toEqual([true, true, true]);
  await expect.poll(() => alice.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(alice.locator('.game-layout > .tile')).toHaveCount(0);
  await expect(alice.locator('.game-layout > .tile-blank')).toHaveCount(0);
});
```

Then the History half, in the same test: `await recordGhosts(alice, '.history-board', '.tile')` cannot run before the dialog exists, so open History first (`button(alice, 'History')`), then record, choose Alice in the playback settings' "View as" select (`src/components/PlaybackSettings.tsx:54`; it shows only when the steps carry per-seat views), set the "Step" slider to the step before the exchange and press Play. Expect `ghostsSeen(alice)` (reset by the second `recordGhosts`) to reach `[true, true, true]` and `alice.locator('.history-board > .tile')` to reach count 0. If "View as" is absent for a live game's History (see `e2e/history.spec.ts:113`), the history replay of your own exchange cannot be reached in e2e: drop this half and list it under Known gaps.

- [ ] **Step 2: Run it to see it fail.** `E2E_PORT_BASE=6510 npx playwright test e2e/scrabble.spec.ts -g "exchanged tile flies"`. Expected: FAIL, `ghostsSeen` is `[false, false, false]`.
- [ ] **Step 3: Implement `pieceArt` and use it in `ghostToBag`.** Append `pieceArt(cardArtUrl('solid'))` as the copy's first child, before `.tile-letter`, matching `Tile.tsx`'s child order, and set `aria-hidden="true"` on the copy. Update the `ghostToBag` comment ("A copy of a tile that left the rack, face and all, ...").
- [ ] **Step 4: Run it to see it pass,** then the whole file: `E2E_PORT_BASE=6510 npx playwright test e2e/scrabble.spec.ts`. Expected: all pass. `npm run typecheck` and `npm run lint` pass.
- [ ] **Step 5: Docs.** `docs/architecture.md` line 145 (the `motion.ts` bullet): after `ghostSlide (...)`, say a copy built by hand gets its drawing from `pieceArt(url)` in `src/assets/pieceArt.ts`, so it looks like the piece and not an outline. Line 228 (the `ServerSvg` bullet): one sentence naming `pieceArt(url)` as its DOM twin for animation copies.
- [ ] **Step 6: Commit** `Give Scrabble's exchanged tile copies their face` (with the index plan's trailer).

### Task 3: Phase 10's card copy gets its face too

**Files:**
- Modify: `games/phase10/client/animateMove.ts:56-69` (`ghostCard`), `games/phase10/client/CardView.tsx:29`, `games/phase10/client/Piles.tsx:24`
- Test: `e2e/phase10.spec.ts` (extend `cards slide where they went, and nothing animates with reduced motion`, line 618)

**Interfaces:**
- Consumes: `pieceArt(url)` (Task 2), `recordGhosts`, `ghostsSeen` (Task 2).
- Produces: `export const cardArt = (card: Card | null): string` in `games/phase10/client/CardView.tsx`: `cardArtUrl('stripes')` for `null` (a back), `'bands'` for a wild, `'solid'` otherwise. `CardView` and `Piles` use it in place of their inline `cardArtUrl(...)` calls, so the copy and the real card can never disagree.

- [ ] **Step 1: Extend the failing test.** In the `animated` half, before `drawPile` is clicked: `await recordGhosts(animated.bob, '.game-screen', '.card')`. After the existing `toHaveCount(0)`: `expect(await ghostsSeen(animated.bob)).toEqual([true])`.
- [ ] **Step 2: Run it to see it fail.** `E2E_PORT_BASE=6510 npx playwright test e2e/phase10.spec.ts -g "cards slide where they went"`. Expected: FAIL with `[false]`.
- [ ] **Step 3: Implement.** Add `cardArt`, use it in `CardView` and `Piles`, and in `ghostCard` append `pieceArt(cardArt(card))` as the first child of both the back and the face copy (before the text or `.card-face`). The face copy's `ColorSymbol` stays out (YAGNI: it is a 300 ms flight).
- [ ] **Step 4: Run it to see it pass,** then `E2E_PORT_BASE=6510 npx playwright test e2e/phase10.spec.ts e2e/yahtzee.spec.ts`. Expected: all pass (Yahtzee unchanged, run as the third `ghostSlide` user).
- [ ] **Step 5: Commit** `Give Phase 10's flying card copies their face`.

### Task 4: Gates, browser check and PR

**Files:**
- None new. Fix-ups only if a gate fails.

- [ ] **Step 1: Gates.** `npm run lint`, `npm test`, `npm run build`, then `E2E_PORT_BASE=6510 npx playwright test e2e/scrabble.spec.ts e2e/phase10.spec.ts e2e/yahtzee.spec.ts`. Expected: all pass. A failure is rerun alone once; both results go in the PR.
- [ ] **Step 2: Browser check.** `npx vite build`, `E2E=1 PORT=3206 DATABASE_PATH=:memory: node server/server.ts`, own Chrome tab, Bob seated from a headless context as in Task 1. In light and dark: Scrabble exchange of 3 tiles including a blank, and a play that draws tiles; Phase 10 draw from the pile seen from Bob's side. Each copy is solid and colored like the real piece, nothing stays after the animations. Repeat at 390 px and 320 px through same-origin iframes with `data-theme` set on each iframe's `documentElement`. Take one screenshot of a mid-flight copy in each theme for the PR.
- [ ] **Step 3: PR.** `gh pr create --base pause-resume-jenga-and-fixes --head scrabble-ghost-tile` with Summary, Rulings (the Task 1 finding: H1 confirmed, with the e3e00b6 reference; Phase 10 had the same cause; Yahtzee and drag ghosts checked and not affected), Known gaps (the phone-width 24 px start offset of kept tiles, left to plan 2's `useMoveAnimation` work), and Verification (exact commands and results), ending with the index plan's footer.
