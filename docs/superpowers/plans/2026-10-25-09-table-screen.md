# Shared Table Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TV or laptop joins as a "Table screen" and shows the public table, sized for a couch, while each player's phone can switch to a trimmed "Hand only" layout.

**Architecture:** A table screen is a plan 1 spectator with `tableScreen: true`. It never asks for a hand. Its view is always the plain table view (`toPublicState(state, false, null)`), even for a game whose ordinary spectators see more. Pictionary is that game: plan 11 exported `spectatorState(state, undoAvailable, tableScreen)`, and this plan wires it in as an optional `GameDefinition.spectatorState` hook. The browser gives it its own `TableScreenView`: a QR code of the game link in the lobby, then the read-only `HistoryBoard` scaled to fill the screen, the presence bar, and the game-over screen. Phones get a remembered "Board and hand" / "Hand only" switch while a table screen is connected. Hand only is CSS: the platform sets `data-hand-only` and `data-my-turn` on `.game-root`, and each game tags its own elements with `hand-only-hide` (never shown) or `hand-only-board` (shown only on your turn, for games whose actions are on the board). The QR code is a server SVG drawn by an in-house encoder.

**Tech Stack:** TypeScript, React 19, SCSS, Express 5, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-spectators-social-and-new-games-design.md`, feature 9 (and the Pictionary table screen rule in feature 11). Index plan: `docs/superpowers/plans/2026-10-25-spectators-social-and-new-games.md`, ports PORT 3109 and E2E_PORT_BASE 6270. Branch `table-screen` from `spectators-social` after wave 1, so spectators (1), game-over (2), open games (5), reactions (6), turn timer (7), Pictionary (11) and Jenga (12) are merged. Read `shared/spectators.ts`, `src/components/SpectatorView.tsx`, `JoinDialog.tsx` (`JOIN_ROLES`), the game-over screen from plan 2, and `games/pictionary/` and `games/jenga/` before starting. Use the names you find there.

## Global Constraints

All of the index plan's Global Constraints, plus:

- A table screen is a `Spectator` with `tableScreen: true`, joined with `role: 'tableScreen'`. It never sees a hand: `allowedSeats` stays `[]` and asking is refused (plan 1 already refuses with "A table screen never asks").
- Pictionary: a table screen sees the blanks and the public chat only, never the word or the chat among players who have guessed, because the guessers can see the TV.
- The QR code is generated in-house as a server SVG (`shared/svg/qr.ts`, served at `/api/svg/qr/<link>`). Add no package. A decoder package may be used only in a scratchpad directory outside the repo, to check the output.
- Copy, exactly: join choice "Table screen", button "Show table"; phone switch "Board and hand" / "Hand only", default Hand only, remembered.
- This touches every game, so the full e2e suite runs before the PR.

## Review Focus

1. Pictionary on the TV: the word or a guessed-only chat line reaching the table screen through its live view, the game-over screen or History (Task 1, Task 8).
2. A table screen disconnects mid-game: the phone switch disappears and every phone returns to the full layout, with no hidden board left behind (Task 4).
3. Hand only during your turn in a board-action game (Chess, Catan, Scrabble): the board must be there, or the player cannot move (Task 4 rule, Tasks 5 to 8).
4. Out-of-turn private choices (passing in Hearts, answering a Catan trade, a Rook nest) while Hand only hides the board: the control must stay visible (Tasks 5 and 7).
5. A long game link, or a host name with non-ASCII characters: the QR route returns 400 above its capacity, never 500, and the lobby still shows the link as text (Task 2).

---

### Task 1: Table screen role on the server, and the `spectatorState` hook

**Files:**
- Modify: `server/games.ts` (spectator join), `shared/spectators.ts`, `shared/gameDefinition.ts`, `games/pictionary/index.ts` (wire `spectatorState`, and `privateSeatView` if the wave 1 merge did not), `games/privateSeatView.test.ts`
- Test: `server/spectators.test.ts`, `games/pictionary/views.test.ts` (plan 11's)

**Interfaces:**
- `join(..., role: 'tableScreen')` adds a spectator with `tableScreen: true`. The player name is ignored: the server names it "Table screen", then "Table screen 2" and so on while the name is taken. It rejoins by the returned key like any spectator. Like spectators, it needs an existing room.
- `GameDefinition.spectatorState?(state: S, undoAvailable: boolean, tableScreen: boolean): Omit<P, 'moveCount'>`, commented "what a spectator sees with no permissions, for a game where that is more than the table view". `spectatorView` uses it in place of `toPublicState(state, false, null)` when defined. A table screen still gets no `seatViews`.
- Pictionary sets `spectatorState` to plan 11's function, which returns exactly `toPublicState(state, undoAvailable, null)` for a table screen: the blanks and the public chat only.
- `games/privateSeatView.test.ts`: the "spectator with no permissions sees the history view" check now holds for every game's table screen. For an ordinary spectator it holds only for games without `spectatorState`. A game with the hook gets the check `its ordinary spectator view hides nothing a table screen must not see`, which for Pictionary is plan 11's own spectator tests.

- [ ] **Step 1: Write the failing tests**:
  - `a table screen joins as a spectator that never asks`: `seat === null`, the `spectators` entry has `tableScreen: true` and name "Table screen"; a second one is "Table screen 2"; `requestHand` from it is "A table screen never asks".
  - `a table screen needs an existing game`: "Game not found".
  - `spectatorState is used when a game has it`: with a test game whose hook adds `extra: tableScreen ? null : 'x'`, an ordinary spectator view has `extra: 'x'` and a table screen view has `extra: null`.
  - `pictionary: the table screen sees blanks and public chat only`: in a crafted state mid-turn with the word "red apple" and one `'guessed'` chat line, `JSON.stringify(spectatorView(pictionary, state, tv))` does not contain `red apple` or that line's text, and does contain the mask `___ _____` and a public guess. The same state through an ordinary spectator contains `red apple`.
- [ ] **Step 2:** `node --test server/spectators.test.ts games/pictionary/ games/privateSeatView.test.ts` fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Both pass; `npm test` passes.
- [ ] **Step 5:** Commit `Join as a table screen`.

### Task 2: In-house QR code as a server SVG

**Files:**
- Create: `shared/svg/qr.ts`
- Modify: `server/assets/registry.ts`
- Test: `shared/svg/qr.test.ts`, `server/assets/routes.test.ts`

**Interfaces:**
- `qrMatrix(text: string): boolean[][] | null`: byte mode (UTF-8), error correction level M, the smallest of versions 1 to 10 that fits, or null when the text is longer than 213 bytes (version 10-M) or empty. `true` is a dark module. The size is `17 + 4 * version`.
- Exported for tests: `reedSolomon(data: number[], ecLength: number): number[]` (GF(256) with polynomial 0x11D, generator roots α^0 to α^(n-1)), `formatBits(mask: number): number` (level M, BCH 0x537, XOR 0x5412), `versionBits(version: number): number` (BCH 0x1F25, for versions 7 and up).
- Pinned values (ISO 18004), level M: blocks are `[ecPerBlock, [count, dataCodewords]...]`:
  v1 `10,[1,16]`; v2 `16,[1,28]`; v3 `26,[1,44]`; v4 `18,[2,32]`; v5 `24,[2,43]`; v6 `16,[4,27]`; v7 `18,[4,31]`; v8 `22,[2,38],[2,39]`; v9 `22,[3,36],[2,37]`; v10 `26,[4,43],[1,44]`.
  Alignment centers: v2 `[6,18]`, v3 `[6,22]`, v4 `[6,26]`, v5 `[6,30]`, v6 `[6,34]`, v7 `[6,22,38]`, v8 `[6,24,42]`, v9 `[6,26,46]`, v10 `[6,28,50]`.
  Character count: 8 bits for versions 1 to 9, 16 bits for version 10. Pad with terminator, then bytes 0xEC and 0x11. Interleave data then EC codewords across blocks. Pick the mask (0 to 7) with the lowest penalty under the four standard rules.
- `qrSvg(text: string): string | null`: `svgDoc` with a 4-module quiet zone, a white `rect` and one black `path` (`M{x} {y}h1v1h-1z` per dark module), fixed `#fff` and `#000` so scanners read it in dark mode too, `shape-rendering="crispEdges"`.
- Asset `{ name: 'qr', params: ['text'], samples: [['https://example.com/join/chess/fun1']], render: ([text]) => qrSvg(text) }`.

- [ ] **Step 1: Write the failing tests** in `shared/svg/qr.test.ts`:
  - `reed-solomon matches the HELLO WORLD 1-M example`: `reedSolomon([32,91,11,120,209,114,220,77,67,64,236,17,236,17,236,17], 10)` equals `[196,35,39,119,235,215,231,226,93,23]`.
  - `format bits for M with mask 0`: `formatBits(0) === 0b101010000010010`.
  - `version bits for version 7`: `versionBits(7) === 0b000111110010010100`.
  - `picks the smallest version`: `qrMatrix('https://example.com/join/chess/fun1')` (35 bytes) has 29 rows (version 3); `'a'.repeat(213)` has 57 rows; `'a'.repeat(214)` and `''` are null.
  - `fixed patterns are in place`: for a version 7 matrix, the three finder patterns (7 by 7, dark ring and center) sit at the corners, row 6 alternates from column 8 to size - 9, and the dark module at `(4 * 7 + 9, 8)` is set.
  - `qrSvg draws one path in a quiet zone`: the viewBox is `0 0 37 37` for a 29-module code, and the markup has exactly one `<path`.
  - In `routes.test.ts`: `/api/svg/qr/` + `encodeURIComponent('https://x.example/join/chess/a%2Eb')` is 200 `image/svg+xml`; a 300-character text is 400.
- [ ] **Step 2:** `node --test shared/svg/qr.test.ts server/assets/routes.test.ts` fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Decode check outside the repo.** In the scratchpad, `npm init -y && npm i jsqr`. Write a script that imports `qrMatrix` from the repo by absolute path, renders each matrix to an RGBA buffer (4 px per module, quiet zone included) and decodes it with jsQR. Run it on texts of 1, 26, 35, 100, 180 and 213 bytes plus one with `é`. Each must decode to its input. Paste the output in the PR's Verification.
- [ ] **Step 6:** Commit `Draw QR codes on the server`.

### Task 3: "Table screen" in the join dialog, and the table screen view

**Files:**
- Modify: `src/components/JoinDialog.tsx` (`JOIN_ROLES`), `src/services/session.ts` (keep `'tableScreen'` too), `src/components/GameView.tsx`, `src/components/fitScale.ts`, `src/App.scss`
- Create: `src/components/TableScreenView.tsx`
- Test: `src/components/fitScale.test.ts`, `e2e/tableScreen.spec.ts`

**Interfaces:**
- `JOIN_ROLES` gains `{ role: 'tableScreen', label: 'Table screen', button: 'Show table' }`. With it picked, the name field is hidden and the form sends the name "Table screen".
- `fitScale(content: Size, box: Size, max = 1): number`. The table screen passes `max = 4`, so a small board grows to fill the TV. The History dialog keeps the default.
- `GameView` renders `TableScreenView({ game, client, gameState })` when the joined spectator is a table screen (its `spectators` entry with `tableScreen`, found by `spectatorId`), and sets `data-table-screen` on `.game-root`. The header keeps Back to games, the title, Settings and the theme toggle.
- `TableScreenView`:
  - Lobby (`!started`): a QR code of `joinLink(window.location.origin, game.id, gameId)` through `ServerSvg` (`svgUrl('qr', link)`) in `.table-screen-qr`, the link as text under it, and the seated players.
  - Playing: `PresenceBar` (it carries the turn timer and reactions after wave 1), the `gameStatus` in `.table-screen-status`, and `client.HistoryBoard` with `viewer = null`, scaled with `fitScale(..., max 4)` inside a box that fills the rest of the viewport, measured again on resize (reuse the History dialog's measuring code if it is a hook, otherwise a `ResizeObserver`).
  - Game over: plan 2's game-over screen in its spectator form, with no Rematch.
- Couch sizing: under `[data-table-screen]`, the root font size is `clamp(18px, 1.6vw, 36px)` and the status and presence bar scale with it. A rule outside `:where()`, like `[data-awaiting-agreement]`.

- [ ] **Step 1: Failing tests**: `fitScale grows up to max`: `fitScale({ width: 100, height: 50 }, { width: 400, height: 400 }, 4) === 4` and `fitScale(..., 3) === 3`; the default call still caps at 1. e2e in `e2e/tableScreen.spec.ts`:
  - `a table screen shows the QR code and link in the lobby`: Alice opens a Hearts lobby; the TV picks Table screen (no name field, button "Show table") and sees `.table-screen-qr svg` and the link `/join/hearts/<id>` as text; Alice sees "Watching: Table screen".
  - `the table screen shows the table and never a hand`: four players start; the TV has a `.history-board` or the board, no `.hand`, no `.spectator-seats`, and no Ask button.
  - `the table screen rejoins after a refresh`: reload the TV and it is back on the table.
  - `game over on the table screen has no Rematch`: patch to a finished state through the e2e hook; the TV shows the game-over screen with History and no Rematch button.
- [ ] **Step 2:** Run (`node --test src/components/fitScale.test.ts`, `E2E_PORT_BASE=6270 npx playwright test e2e/tableScreen.spec.ts`) and see failures.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Both pass; `e2e/spectators.spec.ts` still passes.
- [ ] **Step 5:** Commit `Show the table on a shared screen`.

### Task 4: The phone switch and the platform's Hand only rules

**Files:**
- Create: `src/components/LayoutSwitch.tsx`
- Modify: `src/services/settings.ts`, `src/components/GameView.tsx`, `src/App.scss`
- Test: `src/services/settings.test.ts`, `e2e/tableScreen.spec.ts`

**Interfaces:**
- `type TableLayout = 'handOnly' | 'board'`, `loadTableLayout(): TableLayout` (default and fallback `'handOnly'`) and `saveTableLayout(layout)`, under the key `tableLayout`.
- `LayoutSwitch({ layout, onChange })`: two `aria-pressed` buttons, "Board and hand" and "Hand only", in `.layout-switch` (styled like `.rules-switch`), shown under the presence bar.
- `GameView`, for a player only: `const tableScreenOn = gameState.spectators?.some(s => s.tableScreen) ?? false`. While it is on, the switch shows, and with Hand only `.game-root` gets `data-hand-only`. `data-my-turn` is set whenever `currentPlayer === playerNumber && !isGameOver`. When no table screen is connected, neither attribute nor the switch is there.
- `App.scss`, outside `:where()` so it beats game rules: `[data-hand-only] .hand-only-hide { display: none }` and `[data-hand-only]:not([data-my-turn]) .hand-only-board { display: none }`.
- The rule every game follows in Tasks 5 to 8: Hand only keeps your hand or private pieces, every control you can use now (including out-of-turn ones), the status or turn line, and your own score. `hand-only-hide` goes on what is only for watching: opponents' areas, logs, trick or table displays the TV shows, the game ID line. `hand-only-board` goes on a board you act on, so it is there on your turn. A control placed inside a hidden element must move out of it, or the element must not be hidden.

- [ ] **Step 1: Failing tests**: settings `table layout defaults to hand only and is remembered`. e2e:
  - `phones get the switch only while a table screen is connected`: no `.layout-switch` before the TV joins; after it joins, Hand only is pressed and `.game-root[data-hand-only]` is set; after the TV's page closes, both are gone.
  - `the choice is remembered`: pick Board and hand, reload, and it is still pressed.
- [ ] **Step 2:** Run, see failures. **Step 3:** Implement. **Step 4:** Pass.
- [ ] **Step 5:** Commit `Add the Board and hand / Hand only switch`.

### Tasks 5 to 8: Hand only layouts, one game group per task

Each task follows the same steps. The shared spec is `e2e/handOnly.spec.ts`, built from a table `HAND_ONLY: Record<string, { keep: string[]; hide: string[]; board?: string; setup?: (table: Table) => Promise<void> }>` of CSS selectors. For each game in its group, the generated test does this:

- Seat the game's minimum players plus a table screen (a `tableScreen(table)` helper in `e2e/fixtures.ts` that opens a context, picks Table screen and joins).
- Wait for `[data-hand-only]` on the player whose turn it is not.
- Check that every `keep` selector is visible and every `hide` selector is hidden.
- With a `board`: hidden off-turn, visible on the player's turn.
- Then make one legal move from Hand only (the game's own e2e spec shows how), so the layout is proved playable.

- [ ] **Step 1:** Add the group's rows to `HAND_ONLY`. `E2E_PORT_BASE=6270 npx playwright test e2e/handOnly.spec.ts -g "<game>"` fails.
- [ ] **Step 2:** Tag the elements in each game's client components and add any layout tweak under `[data-game="<id>"][data-hand-only]` in its SCSS (a larger hand, for example).
- [ ] **Step 3:** The group's rows pass, and so does each game's own spec (`npx playwright test e2e/<id>.spec.ts`), since tags change no behavior outside Hand only.
- [ ] **Step 4:** Browser check of one game in the group at 390 px and 320 px, light and dark.
- [ ] **Step 5:** Commit `Hand only layouts for <group>`.

**Task 5: Trick and hand card games.** Hearts, Spades, Euchre, Rook, The Crew, War, Go Fish, Texas Hold'em.
- Keep: the hand, the bid, pass, trump, nest, task and communication controls, the turn line, and your score row.
- Hide: the trick table and opponents' seats. The Crew's task list stays (it is your goal).
- Board: none. Every action is in the hand or a panel, so these games get no `hand-only-board`.
- War keeps its flip control and your pile count. Hold'em keeps hole cards, the bet controls, pot and your stack.

**Task 6: Draw and rack games.** Uno, Phase 10, Skip-Bo, Rack-O, Rummikub, Dominoes, Scrabble.
- Keep: the hand or rack, plus the draw and discard piles you click (Uno, Phase 10, Skip-Bo, Rack-O), your stock top (Skip-Bo), the color, swap and catch controls (Uno), and your score.
- Board: the table melds (Rummikub, and Phase 10's laid phases), the line of play (Dominoes) and the Scrabble board, all as `hand-only-board`.
- Hide: opponents' hands and counts.

**Task 7: Board games with private pieces.** Catan, Risk, Ticket to Ride, Splendor, Monopoly, Carcassonne, Azul.
- Keep: your resource and development cards, the trade and robber panels, including out-of-turn trade answers and discards (Catan); your territory cards and trade-in (Risk); your train cards, tickets and ticket choice (Ticket to Ride); your gems, reserved cards and nobles (Splendor); your cash, properties and the buy, auction, jail and trade controls, auctions out of turn included (Monopoly); the tile to place and your meeple count (Carcassonne); your pattern lines, wall and floor (Azul).
- Board, `hand-only-board`: the hex map, world map, route map, card market, property board, tile map, and Azul's factories and center.
- Hide: other players' panels.

**Task 8: Public board games, plus Pictionary and Jenga.**
- Chess, Checkers, Connect Four, Backgammon, Mancala, Parchisi, Quoridor: nothing is private, so the board is `hand-only-board`. Keep the turn line, the action controls (undo, resign, draw, dice and roll, Quoridor's tray) and the clock where there is one. Hide the move list and the captured pieces display.
- Farkle and Yahtzee: keep the dice, roll and hold controls, and your own score column or total. Hide the other players' columns.
- Pictionary: the drawer keeps the word choice, the canvas and the tools (the canvas as `hand-only-board`, since drawing is their turn). A guesser keeps the guess box and their own chat and hides the canvas, which the TV shows. The TV, from Task 1, shows the canvas, blanks and public chat only.
- Jenga: the tower view and pull input are `hand-only-board`. Keep the turn line. Off-turn the phone shows only whose turn it is and the camera note, since the TV shows the tower.
- Extra test in `e2e/tableScreen.spec.ts`, `pictionary: the table screen never shows the word`: crafted mid-turn state with the word "red apple"; a player who has guessed sends a guessed-only chat line. The TV page's `innerText` contains the blanks but not `red apple` or that line. After the turn ends by time-out, the reveal shows the word to everyone, the TV included, as plan 11 defines.

### Task 9: Docs, full suite, browser check, PR

- [ ] Update `docs/architecture.md`: Table screen (role, the `spectatorState` hook, `TableScreenView`, couch sizing, `fitScale`'s `max`), the QR encoder in Assets, and Hand only (attributes, the two tags, the rule from Task 4). Update `README.md` (playing with a TV), each game README's controls with one line on Hand only where its layout differs, and the Pictionary README with the table screen rule.
- [ ] `npm run lint`, `npm test`, `npm run build`; full suite `E2E_PORT_BASE=6270 npx playwright test --workers=3`. Rerun a failure alone once and record both results.
- [ ] Browser check on `PORT=3109`: a TV page at desktop width (lobby QR, Hearts and Catan mid-game, game over); phones at 390 px and 320 px in iframes, Hand only and Board and hand, light and dark; one game from each task group.
- [ ] Commit `Document the table screen`, then open the PR titled "Shared table screen" against `spectators-social`.
