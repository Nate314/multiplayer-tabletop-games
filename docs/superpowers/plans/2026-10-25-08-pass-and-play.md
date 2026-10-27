# Pass-and-Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two or more people share one device: the join dialog's third role, Pass and play, seats several names on it, and between turns the device shows only the public table until the next player confirms they hold it.

**Architecture:** One socket holds all of a device's seats. The server keeps `localSeats` and a `shownSeat` on the connection and builds that connection's view for `shownSeat` only, so another local seat's private data never reaches the device before its handoff (not only never renders). Moves, actions and votes act as `shownSeat`. A pure `nextShownSeat` decides when the server drops back to the handoff screen, from a new live-view field `waitingOn` (the seats the table waits on: the current player, each game's out-of-turn choices, unanswered votes).

**Tech Stack:** React 19, Express 5, ws, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-spectators-social-and-new-games-design.md` (feature 8). Index plan: `docs/superpowers/plans/2026-10-25-spectators-social-and-new-games.md`. Branch `pass-and-play` from `spectators-social` after wave 1 (spectators, game-over, open games, reactions, turn timer, Pictionary and Jenga merged). PORT 3108, E2E_PORT_BASE 6250.

## Global Constraints

All of the index plan's Global Constraints, plus:

- Decision (the spec leaves it to the builder): one socket per device, several seats on it, never one socket per seat. The server sends a pass-and-play connection only the view of its `shownSeat` (or the public view, `viewer` null, while it is null).
- `JoinRole` value `'passAndPlay'` from the index contract, added to plan 1's role switch, labelled "Pass and play". Not offered when `GameInfo.passAndPlay === false` (Pictionary), and the server refuses it there too.
- Copy, exact: banner `Pass to <name>`, button `I'm <name>, show my hand`, the other local seats as `I'm <name>` buttons under "Someone else?", the in-game bar `Playing as <name>` with a `Pass the device` button, join errors `Enter at least two names`, `Only <n> seats left in this game`, `Pass and play is not offered for <Game>`, move refused while handing off `Pass the device first`.
- A game with no `privateSeatView` (plan 1's hook: nothing private) skips the handoff: the server shows the waiting local seat at once. Record this in the PR's Rulings.

## Review Focus

- Ann's hand stays in React state after the handoff (a Scrabble rack order, a Hearts pass selection) and shows to Bo: the game screen is remounted per shown seat (Task 4, e2e).
- A reload or lost connection mid-game: every local seat comes back on the handoff screen, never straight into the last shown hand (Task 3, Task 4).
- A remote player moves while Ann's hand is shown and it becomes Bo's turn: the device drops to "Pass to Bo" on that broadcast (Task 1, Task 2).
- A game waits on a local seat nobody can reach (a hook missing for some out-of-turn choice): the "Someone else?" buttons let any local seat take the device, so play never sticks (Task 4).
- Two local names that differ only in case, or a table with fewer free seats than names: the whole join is refused and no seat is taken (Task 2).

---

### Task 1: Who the table waits on

**Files:**
- Create: `shared/passAndPlay.ts`
- Modify: `shared/gameDefinition.ts` (hook and info flag), `shared/types.ts` (`waitingOn` on `BasePublicState`), `server/games.ts` (`view()` adds `waitingOn`), the games listed in Step 3 (`games/<id>/index.ts` or `rules.ts`)
- Test: `shared/passAndPlay.test.ts`, `games/<id>/rules.test.ts` for each game given the hook

**Interfaces:**
- Produces:
  - `GameDefinition.waitingOn?(state: S): Seat[]`: seats the game waits on besides `currentPlayer` (a pass, a discard, a trade answer, a round summary Continue).
  - `GameInfo.passAndPlay?: boolean` (missing means offered); `games/pictionary/info.ts` sets `false`.
  - `seatsToAct(game: GameDefinition, state: BaseGameState): Seat[]` in `shared/passAndPlay.ts`: sorted, unique; `currentPlayer` while not over, plus `game.waitingOn`, plus connected seats that have not voted in an open `undoVote` or `dismissVote` (and `rematchVote` if plan 3 is on the branch; otherwise note it for the combine step), plus seats named in `handRequests`.
  - `nextShownSeat(shown: Seat | null, localSeats: Seat[], waiting: Seat[], hasPrivate: boolean): Seat | null`: with `hasPrivate` false, the first local waiting seat (or `shown` if none waits); with it true, `null` when `shown` is not waiting but another local seat is, else `shown`.
  - `BasePublicState.waitingOn?: Seat[]`, set only on live views (like `serverTime`), never on history steps or game files.

- [ ] **Step 1: Write failing tests** in `shared/passAndPlay.test.ts`: with `testGame`, `seatsToAct` is `[2]` when seat 2 holds the turn; `[]` once `isGameOver` with no vote; `[2, 3]` with an undo vote requested by 1 among connected 1 to 3; a disconnected non-voter is left out. `nextShownSeat(1, [1, 2], [2], true)` is `null`; `nextShownSeat(1, [1, 2], [1, 3], true)` is `1`; `nextShownSeat(1, [1, 2], [3], true)` is `1` (a remote turn keeps the hand); `nextShownSeat(null, [1, 2], [2], false)` is `2`. Manager test in `server/games.test.ts`: `getState(ROOM, 1).waitingOn` is `[1]` after two joins, and `history('test', 'g1')[0]` has no `waitingOn`.
- [ ] **Step 2:** `npm test`, see them fail.
- [ ] **Step 3:** Implement. Inventory every `applyAction` and out-of-turn wait (`grep -l applyAction games/*/rules.ts`, `shared/rounds.ts` users) and give `waitingOn` to each game that waits on a seat out of turn. At least: Hearts (seats without a pass), Catan (seats owing a discard, the trade's addressee or everyone for an open offer), The Crew (distress pass, task handout), every `RoundAccess` user and Azul (seats that have not acknowledged the summary). Each gets one rules test, for example Hearts during a left pass with seat 2 passed: `waitingOn(state)` is `[1, 3, 4]`. List the final inventory in the PR.
- [ ] **Step 4:** `npm test` passes.
- [ ] **Step 5:** Commit `Tell every view which seats the table waits on`.

### Task 2: One connection, several seats (server)

**Files:**
- Modify: `server/games.ts` (`joinLocal`), `server/server.ts` (connection, `SHOW_SEAT`, broadcast, disconnect), `shared/messages.ts`, `server/testing.ts` if a helper is needed
- Test: `server/games.test.ts`

**Interfaces:**
- Consumes: `seatsToAct`, `nextShownSeat` (Task 1); `JoinRole` and plan 1's spectator connection handling.
- Produces:
  - `JOIN_GAME` with `role: 'passAndPlay'` carries `playerNames: string[]` and, on a rejoin, `seatKeys: string[]` (same order); `playerName` is ignored.
  - `GAME_JOINED` for it: `{ playerNumber: null, localSeats: { seat: Seat; seatKey: string }[], gameState }` (the public view).
  - New client message `SHOW_SEAT { payload: { seat: Seat | null } }`; the server refuses a seat not in `localSeats` with `Not one of this device's players`.
  - Live views to a pass-and-play connection carry `shownSeat: Seat | null` (the seat the view was built for), so the client switches seat and state in one message.
  - `manager.joinLocal(gameType, gameId, names: unknown, rejoin?: unknown, seatKeys?: unknown): { roomId: string; seats: { seat: Seat; seatKey: string }[]; state: BasePublicState } | { error: string }`. All-or-nothing on a fresh join: names trimmed, at least 2, distinct ignoring case, `Only <n> seats left in this game` when they do not fit, `Pass and play is not offered for <Game>` when `info.passAndPlay === false`; each name goes through `addPlayer` on a working copy and the room is committed only if every one succeeds. A rejoin takes back each held seat with its key and drops seats that were dismissed; it fails only if none comes back.
  - `manager.handoffSeat(roomId: string, shown: Seat | null, localSeats: Seat[]): Seat | null` wraps `nextShownSeat` with `seatsToAct` of the live state and `game.privateSeatView !== undefined`.
  - `server.ts` `Connection` gains `localSeats?: Seat[]`; its `seat` is the shown seat, `null` during a handoff. A seat-bound message with `seat` null answers `Pass the device first`. `SET_HOUSE_RULES` acts as the local host seat if it is local, and `AGREE_HOUSE_RULES` agrees for every local seat (nothing private in a lobby). `broadcast` runs `handoffSeat` for each pass-and-play connection before building its view. Closing the socket disconnects every local seat.

- [ ] **Step 1: Write failing tests** in `server/games.test.ts`: `joinLocal('test', 'g1', ['Ann', 'Bo'])` seats 1 and 2 with distinct keys; `['Ann', 'ann']` errors and `getState(ROOM)` is undefined; with Cy and Dee already seated in a 4-seat game, `['Ann', 'Bo', 'Eve']` errors `Only 2 seats left in this game` and the room still has 2 players; one name errors `Enter at least two names`; a game whose info has `passAndPlay: false` refuses; after a move and two disconnects, `joinLocal(..., ['Ann', 'Bo'], true, [keyA, keyB])` takes both back, and with a wrong key for Bo takes back only Ann; a remote `join('test', 'g1', 'Cy')` after `joinLocal` gets seat 3 (mixing). `handoffSeat(ROOM, 1, [1, 2])` is `null` once seat 2 holds the turn, for a test game variant with `privateSeatView`, and `2` for `testGame` without one.
- [ ] **Step 2:** `npm test`, see them fail.
- [ ] **Step 3:** Implement `joinLocal` and `handoffSeat` in `server/games.ts`, reusing `join`'s name cleaning and key checks rather than copying them; wire `server.ts`.
- [ ] **Step 4:** `npm test` passes; `npm run lint`.
- [ ] **Step 5:** Commit `Seat several players on one connection`.

### Task 3: Client connection and resume

**Files:**
- Modify: `src/services/gameService.ts` (`connect` takes a join request object, `showSeat(seat)`), `src/hooks/useGameConnection.ts`, `src/services/session.ts`, `src/services/settings.ts` (`JoinForm.localNames?: string[]`)
- Test: `src/services/session.test.ts` (create if missing), `src/services/settings.test.ts`

**Interfaces:**
- Consumes: Task 2's messages.
- Produces:
  - `Session.localSeats?: { playerName: string; seatKey: string }[]`; `read` keeps it only when it is an array of such pairs, so an old or hand-edited entry falls back to a normal session.
  - `useGameConnection` returns `localSeats: { seat: Seat; name: string }[] | null` and `showSeat(seat: Seat | null)`; `playerNumber` follows `shownSeat` from each state; `join(type, gameId, playerName, role, localNames?)`. A rejoin of a pass-and-play session sends `role: 'passAndPlay'`, `rejoin: true`, the names and keys; it always lands on the handoff screen because the server starts `shownSeat` at null.
  - `loadJoinForm` keeps `localNames` only as an array of strings.

- [ ] **Step 1: Failing tests**: a saved pass-and-play session round-trips through `saveSession` and `loadSession` with both seats; `localSeats: 'x'` or `[{ playerName: 1 }]` loads as a session without `localSeats`; `loadJoinForm` drops a non-array `localNames`.
- [ ] **Step 2:** Run, see failures. **Step 3:** Implement; the "is already in this game" retry loop is reused unchanged. **Step 4:** `npm test` passes. **Step 5:** Commit `Remember and rejoin every seat on a pass-and-play device`.

### Task 4: Join dialog choice, handoff screen and the full check

**Files:**
- Create: `src/components/HandoffScreen.tsx`, `src/components/PassAndPlayBar.tsx`, `e2e/passAndPlay.spec.ts`
- Modify: `src/components/JoinDialog.tsx` (third switch value and the names list), `src/App.tsx` (joined also when `localSeats` is set), `src/components/GameView.tsx`, `src/App.scss`, `e2e/fixtures.ts` (a `joinPassAndPlay(page, gameType, gameId, names)` helper), `docs/architecture.md`, `README.md`, the Rules/FAQ text
- Test: `e2e/passAndPlay.spec.ts`

**Interfaces:**
- Consumes: Task 3's hook; plan 1's spectator table view for drawing the public table with no viewer.
- Produces:
  - Join dialog: with Pass and play selected, name inputs labelled `Player 1`, `Player 2`, ... (two to start, an `Add player` button up to the game's maximum, a remove button on each beyond two) replace "Your name"; the main button reads Join. The choice is hidden when `game.passAndPlay === false`.
  - `HandoffScreen({ gameState, localSeats, onShow })`: plan 1's public table under a banner. The first local seat in `gameState.waitingOn` gets `Pass to <name>` and `I'm <name>, show my hand`; with none waiting it reads `Waiting for <names>`; every other local seat is an `I'm <name>` button under "Someone else?".
  - `GameView` with `localSeats` and a shown seat renders `PassAndPlayBar` (`Playing as <name>`, `Pass the device`, which calls `showSeat(null)`) and the game `Screen` with `key={shownSeat}`, so no component state survives a handoff.

- [ ] **Step 1: Write failing e2e** in `e2e/passAndPlay.spec.ts` (Hearts, Ann, Bo and Cy on one page and Dee remote, deterministic deal through `table.random`):
  - `no private view of another local seat renders or arrives before its handoff`: record every WebSocket frame the shared page receives (`page.on('websocket')`, `framereceived`); read the server state; until `I'm Bo, show my hand` is pressed, no frame contains Bo's or Cy's cards (compare each card's rank and suit pair against the frame JSON's `hand` fields) and the page shows none of their cards by accessible name; after Ann passes, the page shows `Pass to Bo` and no card of Ann's hand.
  - `a pass and a vote hand off one player at a time`: Dee requests an undo after the first trick; the device shows `Pass to Ann`, then `Pass to Bo`, each voting in turn.
  - `reload resumes on the handoff screen`: with Bo shown, reload; the page shows the handoff banner, not Bo's hand, and `I'm Bo` brings the hand back.
  - `Pictionary offers no pass and play`: its join dialog has Player and Spectator but no Pass and play.
  - `the dialog refuses a single name and a duplicate`: shows `Enter at least two names`.
- [ ] **Step 2:** `E2E_PORT_BASE=6250 npx playwright test e2e/passAndPlay.spec.ts`, see failures.
- [ ] **Step 3:** Implement the dialog, `HandoffScreen`, `PassAndPlayBar` and the styles (banner large and centered over a dimmed table, buttons at least 44 px tall).
- [ ] **Step 4:** The spec passes; `npm run lint`, `npm test`, `npm run build`; then `E2E_PORT_BASE=6250 npx playwright test --workers=3` (the join dialog and `GameView` touch every game).
- [ ] **Step 5:** Browser check per the index plan: a pass-and-play Hearts and Catan game (discard on a 7, a trade answer) and Chess (no handoff), light and dark, desktop, 390 px and 320 px. Update `docs/architecture.md` (Communication Flow: the pass-and-play join, `SHOW_SEAT`, `shownSeat`, `waitingOn`; Hidden state: a pass-and-play device gets only the shown seat's view), README and the FAQ. Commit `Pass and play on one device`, open the PR with `gh pr create --base spectators-social`.
