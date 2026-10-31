# Join Dialog and Table Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The join dialog's four choices lay out in one row, two per row or one per row by width, a table screen can create a missing game and show its QR code, and the table screen header has a "Show QR code" button that works at any time.

**Architecture:** 7b is a server change: `join` in `server/games.ts` refuses a table screen with "Game not found" today (the `!existing && (... || tableScreen)` check), so it now creates the room for a table screen as it does for a player, and an unstarted room with nobody seated is kept only while a table screen watches it. 7a is CSS: the join dialog gets its own class, is a size container, and its role switch becomes a grid whose column count follows container queries. 7c moves the QR code and link out of `TableScreenView` into a shared `JoinQr` component, used by the lobby view and by a new `QrCodeDialog` opened from the header.

**Tech Stack:** TypeScript, React 19, SCSS, Express 5, ws, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-pause-resume-jenga-and-fixes-design.md`, section 7 (7a, 7b, 7c). Index plan: `docs/superpowers/plans/2026-10-31-pause-resume-jenga-and-fixes.md`. Branch `join-and-table-screen` from `pause-resume-jenga-and-fixes`, PORT 3207, E2E_PORT_BASE 6530.

## Global Constraints

All of the index plan's Global Constraints, plus:

- Copy, exactly: header button "Show QR code"; dialog heading "Scan to join"; its close button "Close". The open games line for a lobby with nobody seated is "Waiting for players".
- 7b: only `role: 'tableScreen'` may create a game this way. `role: 'spectator'` and any `rejoin: true` keep "Game not found". The created game is of the type chosen in the dialog (the `gameType` the join already sends).
- An unstarted room with nobody seated lives only while a table screen is connected to it. When the last such table screen leaves, or the last seated player leaves a lobby with no table screen connected, the room is deleted and whoever still watches gets "Game not found" (today's behavior, pinned by `e2e/spectators.spec.ts` "a spectator is told when the last player leaves the lobby"). Unstarted rooms are never stored (`save` removes them), so nothing changes across a restart.
- 7a breakpoints, measured on the join dialog's content box (container queries on `.join-dialog`): one row at `min-width: 560px`, one per row at `max-width: 279px`, two per row in between. The join dialog's `max-width` is `640px`; every other `.lobby-dialog` keeps `400px`. Buttons never wrap their label (`white-space: nowrap`) and every button in the grid has the same width (`1fr` columns, no spanning).
- 7c: the button shows only on a table screen (`tableScreen` in `GameView`), in the lobby, during play and after the game is over. Players and ordinary spectators never see it. Per the index contract, it goes into the existing header after `ShareButton` and before `RulesButton`, without restructuring the header.
- The QR code keeps the existing `.table-screen-qr` and `.table-screen-link` classes so `e2e/tableScreen.spec.ts` keeps passing unchanged.
- Contract additions: none. All new names (`JoinQr`, `QrCodeDialog`, `tableScreenWatching`, `.join-dialog`) stay inside this plan's files.

## Review Focus

1. The only seated player leaves a lobby the TV created: the room must stay and the TV must keep its QR code, not get "Game not found" (Task 1).
2. The TV that created a game leaves before anyone sat down while an ordinary spectator watches: the room goes and that spectator sees "Game not found", never a lobby nobody can delete (Task 1).
3. A game with three join choices (Pictionary has no Pass and play): one row wide, then two and one, still equal widths, no stretched last button (Task 2).
4. The join dialog at 320 px with "Pass and play" chosen: the name inputs and Add player still fit, and the one-column switch does not push the actions off screen without scrolling (Task 2 browser check).
5. Escape with the QR dialog open over the game-over dialog: only the QR dialog closes (Task 3).

---

### Task 1: A table screen creates a missing game (7b)

Confirmed cause (code reading of `server/games.ts` `join`, lines 655 to 657): `if (!existing && (rejoin === true || role === 'spectator' || tableScreen)) return { error: 'Game not found' };`. The spectator branch also never calls `rooms.set`, since it assumed an existing room. Hypothesis to confirm with the failing test in Step 1: dropping `tableScreen` from that check and adding the room to `rooms` is enough for the join; the lobby lifecycle needs the two rules below so the room neither vanishes under the TV nor outlives it.

**Files:**
- Modify: `server/games.ts` (`join`, `disconnect`, `disconnectSpectator`, a new local helper), `server/server.ts` (`handleDisconnect`), `src/services/openGames.ts` (`describeOpenGame`)
- Modify docs: `docs/architecture.md` (Table screen bullet at the "It needs an existing game" sentence, and the open games line if it describes the text), `README.md` (the Table screen paragraph: drop "and the game must already exist (create it from a player's device first)", say a new game ID creates the game with nobody seated and shows its QR code)
- Test: `server/spectators.test.ts`, `src/services/openGames.test.ts`, `e2e/tableScreen.spec.ts`

**Interfaces:**
- Produces, inside `createGameManager` in `server/games.ts`: `function tableScreenWatching(room: Room): boolean`, true when some `room.state.spectators` entry has `tableScreen` and its id is in `room.watching`.
- `join(gameType, gameId, playerName, rejoin?, seatKey?, role?, deviceId?)`: unchanged signature. With `role === 'tableScreen'`, no room and `rejoin !== true`, it builds `newRoom(game, id)`, adds the table screen as today, and calls `rooms.set(roomId, room)`.
- `disconnect(roomId, seat)`: when `activePlayers` becomes empty, the room is deleted unless `!room.state.started && tableScreenWatching(room)`; then it returns `{ state: view(room, seat) }` as for any other disconnect.
- `disconnectSpectator(roomId, spectatorId): void`: after today's lobby cleanup, an unstarted room with `activePlayers.length === 0` and `!tableScreenWatching(room)` is deleted with `deleteRoom(roomId)`.
- `server/server.ts`: `function tellRoomGone(roomId: string): void` sends `sendError(other, 'Game not found')` to every remaining connection of `roomId`. `handleDisconnect` calls it in the player path (replacing the inline loop) and in the spectator path when `manager.getState(connection.roomId)` is undefined after `disconnectSpectator`, else broadcasts as today.
- `describeOpenGame(game, gameName)`: `'Waiting for players'` when `players.length === 0` and `!playing`; otherwise unchanged.

- [ ] **Step 1: Write the failing tests** in `server/spectators.test.ts`. Replace `a table screen needs an existing game` with:
  - `a table screen creates a missing game with nobody seated`: `screen(newManager(), 'x')` (via a fresh manager, game id `g1`) is not an error, has `seat === null`; `manager.getState(ROOM)` has `activePlayers: []`, `started: false`, and `spectators` named `['Table screen']`; then `manager.join('test', 'g1', 'Alice')` seats Alice at seat 1.
  - `only a table screen creates a game`: on a fresh manager `join('test', 'none', 'Dana', false, undefined, 'spectator')` and `join('test', 'none', 'x', true, undefined, 'tableScreen')` both equal `{ error: 'Game not found' }`.
  - `a lobby the table screen watches survives its last player leaving`: TV creates `g1`, Alice joins, `manager.disconnect(ROOM, 1)` returns a state (not null) and `manager.getState(ROOM)?.activePlayers` deep-equals `[]`.
  - `a lobby with nobody seated goes when its table screen leaves`: TV creates `g1`, Dana joins as a spectator, `manager.disconnectSpectator(ROOM, tv.spectatorId)`, then `manager.getState(ROOM)` is `undefined`.
  - `a started game keeps its room when the table screen leaves`: `gameWith('Alice', 'Bob')`, TV joins, `ok(manager.move(ROOM, 1, tick))`, `disconnectSpectator` for the TV, `manager.getState(ROOM)` is defined.

  In `src/services/openGames.test.ts`: `describeOpenGame({ gameType: 'chess', gameId: 'a', players: [], playing: false }, 'Chess') === 'Waiting for players'`.
- [ ] **Step 2:** `node --test server/spectators.test.ts src/services/openGames.test.ts` fails on the new tests (the first with "Game not found").
- [ ] **Step 3:** Implement the `server/games.ts`, `server/server.ts` and `openGames.ts` changes above, with one-line "why" comments (for example, "a TV may open the lobby before anyone sits down, so it keeps the room alive").
- [ ] **Step 4:** Add e2e tests to `e2e/tableScreen.spec.ts`, using `newPlayer(browser, server)`, `openJoinDialog` and `joinGame` from `e2e/fixtures.ts`, with a game ID `tv${Date.now() % 100000}` (at most 20 characters):
  - `a table screen with a new game ID creates the game and shows its QR code`: the TV opens Hearts, picks Table screen, fills the ID, presses Show table; `.table-screen-qr svg` is visible, `.table-screen-players li` has count 0, and `.table-screen-link` matches `/join/hearts/<id>$`. A second page `joinGame(page, 'hearts', id, 'Alice')`; the TV's `.table-screen-players li` has text `['Alice']` and Alice's `.presence-watching` reads `Watching: Table screen`.
  - `the TV keeps the lobby when its only player leaves`: continuing the setup above in its own test, Alice's page closes; the TV still shows `.table-screen-qr svg` and no `Game not found` text.
- [ ] **Step 5:** `node --test server/spectators.test.ts src/services/openGames.test.ts` passes; `npm test` passes; `E2E_PORT_BASE=6530 npx playwright test e2e/tableScreen.spec.ts e2e/spectators.spec.ts e2e/openGames.spec.ts` passes.
- [ ] **Step 6:** Update `docs/architecture.md` and `README.md` as listed in Files.
- [ ] **Step 7:** Commit `Let a table screen create a missing game`.

### Task 2: Join dialog choices in one row, two or one by width (7a)

**Files:**
- Modify: `src/components/JoinDialog.tsx` (the form's `className` becomes `lobby-dialog join-dialog`), `src/App.scss` (the `.lobby-dialog` block near line 341 and the shared switch rules near lines 630 to 656)
- Modify docs: `docs/architecture.md` (the `JoinDialog.tsx` bullet: the switch is a grid, one row, two per row or one per row by the dialog's width)
- Test: `e2e/landing.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `.join-dialog` (the join form; `max-width: 640px`; `container-type: inline-size`). `.join-role-switch` leaves the shared segmented-control rules for layout and corners, and keeps only the shared `aria-pressed="true"` colors.
- `.join-role-switch` rules, inside `:where()` like its neighbors:
  - base (two per row): `display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 8px;`
  - `@container (min-width: 560px)`: `grid-auto-flow: column; grid-auto-columns: 1fr; grid-template-columns: none;` (one row for three or four choices)
  - `@container (max-width: 279px)`: `grid-template-columns: 1fr;`
  - buttons: today's padding, border and weight from the shared rule, plus `padding: 6px 12px; border-radius: 6px; white-space: nowrap;`.

- [ ] **Step 1: Write the failing test** in `e2e/landing.spec.ts`, `the join choices sit in one row, two per row or one per row`. A helper `rowsOf(page): Promise<{ rows: number; widths: number[]; heights: number[] }>` reads the bounding boxes of `getByRole('group', { name: 'Join as' }).getByRole('button')`, counting distinct rounded `y`. For Hearts (four choices) after `openJoinDialog(page, 'hearts')`:
  - at `{ width: 1280, height: 800 }`: `rows === 1`;
  - at `{ width: 390, height: 844 }`: `rows === 2`;
  - at `{ width: 320, height: 700 }`: `rows === 4`;
  - at each size every width is within 1 px of the first, and every height is within 1 px of the first (no label wraps).
  
  Then the same for Pictionary (three choices): rows 1, 2 and 3, widths equal at each size.
- [ ] **Step 2:** `E2E_PORT_BASE=6530 npx playwright test e2e/landing.spec.ts -g "join choices"` fails (at 1280 px the four buttons do not fit the 400 px dialog in one row today, or wrap unevenly).
- [ ] **Step 3:** Implement the class and SCSS above. Remove `.join-role-switch` and `.join-role-switch button` from the `display: flex`, `button`, `:first-child` and `:last-child` shared selectors; keep it in the `[aria-pressed="true"]` one.
- [ ] **Step 4: Check the breakpoints against real widths.** In the browser (index plan's browser check setup), run in the dialog `Math.max(...[...document.querySelectorAll('.join-role-switch button')].map(b => b.scrollWidth))` at desktop width. Call it W. One row needs `4 * W + 18 <= 560`; two per row needs `2 * W + 6 <= 280`. If either fails, raise the dialog's `max-width` (one row) or the one-column breakpoint (two per row) by the shortfall, record the values used in the PR's Rulings, and rerun Step 2's test.
- [ ] **Step 5:** The test passes; `E2E_PORT_BASE=6530 npx playwright test e2e/passAndPlay.spec.ts e2e/spectators.spec.ts e2e/tableScreen.spec.ts e2e/landing.spec.ts` passes (they click these buttons by name).
- [ ] **Step 6: Browser check** of the join dialog at desktop width, 640 px, 390 px and 320 px (iframes for the phone widths), light and dark, with each of the four roles picked: no overlap, no blank row, buttons equal, the Rules / Cancel / submit row intact, and the Pass and play name rows still fit at 320 px.
- [ ] **Step 7:** Update `docs/architecture.md`. Commit `Lay out the join choices by width`.

### Task 3: "Show QR code" in the table screen header (7c)

**Files:**
- Create: `src/components/JoinQr.tsx`, `src/components/QrCodeDialog.tsx`
- Modify: `src/components/TableScreenView.tsx` (the lobby uses `JoinQr`), `src/components/GameView.tsx` (header button, only when `tableScreen`), `src/App.scss` (dialog QR size under `[data-table-screen]`)
- Modify docs: `docs/architecture.md` (`TableScreenView.tsx` bullet: the header's Show QR code button and `QrCodeDialog`), `README.md` (the Table screen paragraph: "Show QR code in the header shows the code again at any time, so more people can join or watch")
- Test: `e2e/tableScreen.spec.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1 and 2.
- `JoinQr({ game, gameId }: { game: GameInfo; gameId: string })`: a fragment of today's lobby markup, `ServerSvg url={svgUrl('qr', link)} className="table-screen-qr" title={`QR code to join ${game.name} ${gameId}`}` and `<p className="table-screen-link">{link}</p>`, with `link = joinLink(window.location.origin, game.id, gameId)`. `TableScreenView`'s lobby renders it in place of those two elements.
- `QrCodeDialog({ game, gameId, onClose }: { game: GameInfo; gameId: string; onClose: () => void })`: `useEscapeKey(onClose)`; markup in the `RulesDialog` pattern: `.overlay` (click closes) holding `.modal.qr-dialog` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby` a `useId()` on `<h2>Scan to join</h2>`, then `JoinQr`, then `<button type="button" className="primary-button">Close</button>`.
- `GameView`: `const [qrOpen, setQrOpen] = useState(false)`; in the header, after `ShareButton` and before `RulesButton`, `{tableScreen && <button type="button" className="history-button" onClick={() => setQrOpen(true)}>Show QR code</button>}` (the `history-button` class gives it the header's text-button look; add `qr-button` too for tests and styling); `{qrOpen && <QrCodeDialog game={game} gameId={gameState.gameId} onClose={() => setQrOpen(false)} />}` rendered inside `.game-root` so the table screen styles apply. Every open dialog's `useEscapeKey` listens on `document` in the capture phase, so `stopPropagation` does not keep the game-over dialog from hearing the same Escape: extend the existing guard on `GameOverDialog`'s `onSeeTable` to `if (!history.dialog && !qrOpen) setClosed(true)`, the way History already does it.
- SCSS: `:where([data-table-screen] .qr-dialog .table-screen-qr) { width: min(60vh, 80vw); height: min(60vh, 80vw); }` and `:where([data-table-screen] .qr-dialog) { text-align: center; }`.

- [ ] **Step 1: Write the failing tests** in `e2e/tableScreen.spec.ts`:
  - `the table screen shows the QR code from the header during play`: four Hearts players with `{ agree: true }`, `tableScreen(table)`, `table.patch({ started: true })`, `.table-screen-board` visible. Click `Show QR code`; `getByRole('dialog', { name: 'Scan to join' })` is visible and holds `.table-screen-qr svg` and a `.table-screen-link` matching `/join/hearts/<gameId>$`. `Close` hides it. Open again, `keyboard.press('Escape')` hides it, and `.table-screen-board` is still visible.
  - `the QR button is there in the lobby and after the game ends`: Connect Four with two players, a move, `tableScreen(table)`, the button is visible; `table.patch({ isGameOver: true, currentPlayer: null, winners: [1], gameStatus: 'Alice wins!' })`, the Game over dialog shows, `Show QR code` opens "Scan to join" above it; Escape closes only "Scan to join" and `getByRole('dialog', { name: 'Game over' })` is still visible.
  - `players have no QR button`: in both tests, `table.pages[0].getByRole('button', { name: 'Show QR code' })` has count 0.
- [ ] **Step 2:** `E2E_PORT_BASE=6530 npx playwright test e2e/tableScreen.spec.ts -g "QR"` fails (no such button).
- [ ] **Step 3:** Implement `JoinQr`, `QrCodeDialog`, the `TableScreenView` and `GameView` changes and the SCSS.
- [ ] **Step 4:** `E2E_PORT_BASE=6530 npx playwright test e2e/tableScreen.spec.ts` passes in full (the existing lobby test still finds `.table-screen-qr svg` and `.table-screen-link`).
- [ ] **Step 5: Browser check:** a table screen in a Hearts game at desktop width, 390 px and 320 px, light and dark: the header button sits with the others (on phones it may wrap to the button row under the title, with no overlap), the dialog's QR code is square, fully on screen, black on white in dark mode, and the link wraps inside the dialog.
- [ ] **Step 6:** Update `docs/architecture.md` and `README.md`. Commit `Show the join QR code from the table screen header`.

### Task 4: Gates and PR

**Files:** none beyond fixes the gates call for.

- [ ] **Step 1:** `npm run lint`, `npm test` and `npm run build` pass.
- [ ] **Step 2:** `E2E_PORT_BASE=6530 npx playwright test e2e/tableScreen.spec.ts e2e/spectators.spec.ts e2e/openGames.spec.ts e2e/landing.spec.ts e2e/passAndPlay.spec.ts e2e/handOnly.spec.ts` passes. Rerun any failure alone once and record both results.
- [ ] **Step 3:** `grep -rnP "\x{2014}" docs/architecture.md README.md src/components/JoinQr.tsx src/components/QrCodeDialog.tsx` finds nothing new.
- [ ] **Step 4:** Push `join-and-table-screen` and open the PR with `gh pr create --base pause-resume-jenga-and-fixes`, body per the index plan (Summary, Rulings: the "only a table screen keeps an empty lobby" rule, the "Waiting for players" line, and the measured W from Task 2 Step 4; Known gaps; Verification).
