# Player Views, Replay and Remembered Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Game files carry each player's view so an opened file can be watched as any player. The History dialog gains an animations checkbox and a Play button. The browser remembers the checkbox, plus the join name and game ID.

**Architecture:** The server builds the version 2 file, from full states, at a new endpoint that refuses until the game is over. Each step keeps its table view and adds `views` keyed by seat. The History dialog picks the step's view for the chosen seat, then passes it plus `viewer` to each game's `HistoryBoard`. It animates through the existing `useMoveAnimation`, with a per-game `animateMove` exposed on `ClientGame`. Settings live in a small localStorage module that shares safe access helpers with `session.ts`.

**Tech Stack:** Express 5, React 19, TypeScript run by Node (`node --test`), ESLint 9. Branch `history-start-saved-games` (PR #4).

**Spec:** `docs/superpowers/specs/2026-10-18-player-views-replay-remembered-settings-design.md` (builds on `docs/superpowers/specs/2026-10-18-history-start-persistence-export-design.md`)

## Global Constraints

- No new npm dependency.
- No em-dashes in any prose: docs, code comments, commit messages, UI copy.
- Match surrounding code: comment density, naming, idiom (`.ts` import suffixes in shared/server code, React function components).
- Every localStorage access may throw, so wrap each one, and the page must work without storage.
- The live in-game History dialog never shows hands. Only files carry `views`.
- Old version 1 files still open, with the picker hidden.
- Play moves one step every 1500 ms (`PLAY_STEP_MS = 1500`).
- Copy: picker label "View as", first option "Table only"; checkbox "Animations"; buttons "Play" / "Pause"; download failure "Could not download the game"; server refusal "The game is not over yet".
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01DHDKUPEkPQyApMDpmYDsWv
  ```
- After each task: `npm test`, `npm run lint` and `npm run typecheck` pass.

## Review Focus

1. A hand-edited v2 file whose `views` is missing a seat, or holds junk for a step: the board falls back to the table view or shows "This step could not be shown", and the slider and picker keep working. (Task 1 parser test, Task 2 fallback.)
2. Switching "View as" or dragging the slider while animations are on: nothing animates except a one-move-forward step, and pieces never fly in from the wrong place after a viewer switch. (Task 6: the viewer switch keeps `moveCount`; browser check.)
3. Pressing Play on the last step, then closing the dialog mid-play: it restarts from the start, and no timer fires after close. (Task 6 `nextPlayIndex` test, unmount cleanup.)
4. Storage that throws or holds junk (`joinForm` not an object, the animations value not a boolean): defaults are used. (Task 5 tests.)
5. Downloading from the live History when the server is down or the room expired: the dialog shows "Could not download the game" and stays open. (Task 1, browser check in Task 7.)

---

### Task 1: Version 2 game file built on the server

**Files:**
- Modify: `shared/gameFile.ts`, `shared/gameFile.test.ts`
- Modify: `server/games.ts` (beside `history()`, about line 328), `server/games.test.ts`
- Modify: `server/server.ts` (beside `/api/history`, line 29)
- Modify: `src/components/HistoryButton.tsx`, `src/components/HistoryDialog.tsx`

**Interfaces:**
- Produces in `shared/gameFile.ts`:
  - `GAME_FILE_VERSION = 2`
  - `type GameFileStep = HistoryStep & { views?: Record<string, HistoryStep> }`, where the keys are seat numbers as strings.
  - `GameFile.version: 1 | 2`, with `steps: GameFileStep[]`.
  - `buildGameFile(gameType, gameId, steps: GameFileStep[], now: Date): GameFile`, which writes version 2.
  - `parseGameFile` is unchanged in signature.
- Produces in the manager: `gameFile(gameType: unknown, gameId: unknown, now: Date): { file: GameFile } | { error: string } | null`.
  - It returns null for an unknown room, and `{ error: 'The game is not over yet' }` while `room.state.isGameOver` is false.
  - Each step is the existing table step plus `views`, one entry per key of that step's state `playerNames`. Each entry is built by `publicView(room, state, false, moveCount, seat)` with the same `historyStep`.
  - Factor the step list out of `history()` so both methods share it (DRY).
- Produces at the endpoint: `GET /api/game-file/:gameType/:gameId` returns 404 `{ error: 'Game not found' }`, 409 `{ error }` before game over, or 200 with the file as the body.
- Produces in the client: the `HistoryDialog` prop becomes `onDownload?: () => Promise<boolean>`. The dialog shows `Could not download the game` (in a `.history-move` paragraph under the buttons) when it resolves false.

- [ ] **Step 1: Write failing tests**
  - In `shared/gameFile.test.ts`:
    - `buildGameFile writes version 2`.
    - `parseGameFile reads a version 1 file`, a v1 object with no `views`.
    - `parseGameFile reads a version 2 file with views`.
    - Extend `parseGameFile rejects anything that is not a saved game` with: `version: 3`, `views: []`, `views: { "1": "x" }`, and `views: { "1": { historyStep: 'middle' } }`.
  - In `server/games.test.ts`, using `wonGame()` and `gameWith('A', 'B')`:
    - `gameFile refuses until the game is over`: expect `{ error: 'The game is not over yet' }`. An unknown game expects null.
    - `gameFile gives every step a table view and a view per seat`. Use `wonGame()`. Assert `steps.length === 4`. On each step, `viewer === null` and `'secret' in step === false`. Assert `Object.keys(step.views) === ['1','2']`, `views['2'].viewer === 2`, `views['1'].moveCount === step.moveCount` and `views['1'].historyStep === step.historyStep`.
    - `gameFile gives the end step views when the game ended by an action`: a two-player game, one tick, then `concede`. The last step has `historyStep: 'end'` and `views['1'].isGameOver === true`.

- [ ] **Step 2: Run `node --test shared/gameFile.test.ts server/games.test.ts`.** Expect the new tests to FAIL.

- [ ] **Step 3: Implement the shared format, the manager method and the endpoint.**
  - The parser accepts versions 1 and 2.
  - A step's `views`, when present, must be a non-array object whose every value passes `isHistoryStep`.

- [ ] **Step 4: Switch the client download to the endpoint.**
  - `HistoryButton.download` fetches `/api/game-file/${gameType}/${encodeURIComponent(gameId)}`. On 200 it calls `downloadJson(gameFileName(gameType, gameId), body)` and returns true.
  - Any failure or non-ok response returns false.
  - Drop the client-side `buildGameFile` import.

- [ ] **Step 5: Run `npm test`, `npm run lint`, `npm run typecheck`.** Expect all PASS.

- [ ] **Step 6: Commit** `feat: game files hold every player's view, built by the server`

### Task 2: "View as" picker and the `viewer` prop

**Files:**
- Modify: `src/clientGames.ts` (the `HistoryBoard` type), `src/components/HistoryDialog.tsx`, `src/components/OpenSavedGame.tsx`
- Modify: all ten `games/*/client/HistoryBoard.tsx`, but in this task only to accept and ignore the new prop where the game needs no change yet (Tasks 3 and 4 use it).

**Interfaces:**
- Consumes: `GameFileStep` from Task 1.
- Produces:
  - `ClientGame.HistoryBoard: ComponentType<{ gameState: any; viewer: Seat | null }>`.
  - `HistoryDialog`'s `history` loaded variant becomes `{ status: 'loaded'; steps: GameFileStep[] }`.
  - The pure helper `viewOf(step: GameFileStep, viewer: Seat | null): HistoryStep` in `HistoryDialog.tsx` (or a sibling `historyView.ts` if you want it unit tested). It returns `step.views?.[viewer]` when the viewer is non-null and that entry exists, otherwise the step itself.

- [ ] **Step 1: Add the picker.**
  - It is a `<select aria-label="View as">` above the board, rendered only when `steps[0].views` exists.
  - Options: "Table only" (viewer null), then one per key of `steps[0].playerNames`, labelled with that name, in seat order.
  - The state `viewer: Seat | null` starts null. Changing it does not touch the slider index.
  - The board receives `viewOf(step, viewer)`, with `lastMove` cleared for start and end steps as today (apply that to the chosen view), plus `viewer`.
  - The label text uses the table step as today.
- [ ] **Step 2: Update the `HistoryBoard` type, and every game's `HistoryBoard` signature to `{ gameState, viewer }`.** Typecheck passes. Behavior is unchanged (games ignore `viewer` until Tasks 3 and 4).
- [ ] **Step 3: Run `npm test`, `npm run lint`, `npm run typecheck`.** Expect PASS.
- [ ] **Step 4: Browser check.**
  - Open a v1 file: no picker.
  - Open a v2 file: the picker is listed with names, switching keeps the step, and a hand-edited file missing `views['2']` on one step shows the table view there.
- [ ] **Step 5: Commit** `feat: pick which player to view a saved game as`

### Task 3: Board games draw from the chosen seat

**Files:** `HistoryBoard.tsx` in `games/azul`, `backgammon`, `checkers`, `chess`, `mancala`, `parchisi`, `quoridor` (one batch).

Each board is drawn as that seat's live screen draws it, with nothing clickable:
- chess, backgammon, mancala, parchisi, quoridor: `playerNumber={viewer ?? 0}`. Check the game's `Board` treats a non-zero `playerNumber` with `isMyTurn={false}` as read only: no move hints, no selectable pieces.
- checkers: `flipped={viewer === 2}`, the same rule as `games/checkers/client/GameScreen.tsx:71`.
- azul: `isMe={seat === viewer}`.

- [ ] **Step 1: Make the edits.** If a board shows text that reads wrong in a replay (for example "Your turn"), keep the table-view behavior for that piece.
- [ ] **Step 2: Run `npm test`, `npm run lint`, `npm run typecheck`.** Expect PASS.
- [ ] **Step 3: Browser check.** Finish a chess game and open its file. Viewed as black, the board is flipped. Viewed as Table only, it is not. Spot check checkers and backgammon the same way.
- [ ] **Step 4: Commit** `feat: saved-game boards drawn from the chosen player's seat`

### Task 4: Hands in Uno, Phase 10 and Scrabble replays

**Files:** `games/uno/client/HistoryBoard.tsx`, `games/phase10/client/HistoryBoard.tsx`, `games/scrabble/client/HistoryBoard.tsx`. Each game may also get a read-only hand component extracted from its `GameScreen.tsx` where the markup is the same (DRY), plus its CSS file.

When `viewer` is non-null, the board shows that player's hand below the table, read only, in a section with `aria-label` and header `<name>'s hand (<count>)` (Scrabble: `<name>'s rack`).
- Uno: `Table viewer={viewer}` and `gameState.hand` through `sortedHand`. Give each card `animKey={handKey(slot)}` so Task 6's animations find them.
- Phase 10: `Table playerNumber={viewer}` and `gameState.myHand`, sorted with the default order from `sortHand.ts`.
- Scrabble: `Scores playerNumber={viewer ?? 0}` and `gameState.rack` in its own order, with the same `data-anim-key`s the live rack uses.

With `viewer` null, each board is unchanged.

- [ ] **Step 1: Make the edits.**
- [ ] **Step 2: Run `npm test`, `npm run lint`, `npm run typecheck`.** Expect PASS.
- [ ] **Step 3: Browser check.** Finish a two-player Uno game (playing it out, or by the other player leaving). Download it and open it. Switch "View as" at several steps and see each hand change. Do the same for Scrabble (end with `endGame`) or Phase 10.
- [ ] **Step 4: Commit** `feat: show the chosen player's hand when replaying a saved game`

### Task 5: Remembered settings

**Files:**
- Create: `src/services/storage.ts`, `src/services/settings.ts`, `src/services/settings.test.ts`
- Modify: `src/services/session.ts` (use the storage helpers), `src/App.tsx`

**Interfaces:**
- `src/services/storage.ts` exports `readJson(storage: () => Storage, key: string): unknown`, `writeJson(storage: () => Storage, key: string, value: unknown): void` and `removeKey(storage: () => Storage, key: string): void`. Each one swallows every error. `readJson` returns null on missing or bad JSON. `session.ts` keeps its validation on top of `readJson`.
- `src/services/settings.ts` exports:
  - `loadAnimations(): boolean` (default false) and `saveAnimations(on: boolean): void`, key `historyAnimations`.
  - `type JoinForm = { playerName: string; gameId: string }`, with `loadJoinForm(): JoinForm` (default `{ playerName: '', gameId: '' }`, and each field falls back to `''` unless it is a string) and `saveJoinForm(form: JoinForm): void`, key `joinForm`.

- [ ] **Step 1: Write failing tests** in `src/services/settings.test.ts`. Install a fake `localStorage` on `globalThis` with `Object.defineProperty(..., { configurable: true })` per test.
  - `animations default to off and round-trip`.
  - `join form defaults to empty and round-trips`.
  - `junk in storage falls back to defaults`: `historyAnimations` = `"yes"`, and `joinForm` = `[1]` and `{ playerName: 5 }`.
  - `a storage that throws gives defaults and saving does not throw`: the getter throws.
- [ ] **Step 2: Run `node --test src/services/settings.test.ts`.** Expect FAIL.
- [ ] **Step 3: Implement both modules and move `session.ts` onto `storage.ts`.**
- [ ] **Step 4: Wire `App.tsx`.**
  - `playerName` and `gameId` start from `loadJoinForm()`, through a lazy `useState` initializer, read once.
  - `onJoin` calls `saveJoinForm({ playerName, gameId })` before `join(...)`.
- [ ] **Step 5: Run `npm test`, `npm run lint`, `npm run typecheck`.** Expect PASS.
- [ ] **Step 6: Commit** `feat: remember the join name and game ID`

### Task 6: Animations checkbox and Play button

**Files:**
- Modify: `src/clientGames.ts`, `src/components/HistoryDialog.tsx`, `src/App.css` (the history dialog section, about line 385)
- Modify: the nine `games/*/client/index.ts` that have an `animateMove` (all but phase10)
- Create: `src/components/playback.ts`, `src/components/playback.test.ts`

**Interfaces:**
- Consumes: `loadAnimations` and `saveAnimations` from Task 5. `useMoveAnimation` and `MoveChange` come from `src/animation/useMoveAnimation.ts`.
- Produces:
  - `ClientGame.animateMove?: (change: MoveChange<any>, viewer: Seat | null) => void`.
    - Eight games pass their default `animateMove` through, ignoring `viewer`.
    - Scrabble passes `(change, viewer) => animateMove(change, viewer ?? 0, identityOrder(change.previous.rack))`.
    - Phase 10 omits it.
  - `src/components/playback.ts` exports `PLAY_STEP_MS = 1500` and `nextPlayIndex(index: number, lastIndex: number): number`. It returns 0 when `index >= lastIndex`, the restart, and `index` otherwise. Play starts by showing this index and then advances.

- [ ] **Step 1: Write the failing test** `src/components/playback.test.ts`: `nextPlayIndex(5, 5) === 0`, `nextPlayIndex(2, 5) === 2`, `PLAY_STEP_MS === 1500`.
- [ ] **Step 2: Run `node --test src/components/playback.test.ts`.** Expect FAIL. Then implement `playback.ts` and run again: PASS.
- [ ] **Step 3: Add animations to `HistorySteps`.**
  - A `<label><input type="checkbox"> Animations</label>`. Its state comes from `loadAnimations()`, read once on mount, and each change calls `saveAnimations`.
  - Put a `ref` on the `.history-board` div, which is outside the per-step `StepErrorBoundary`. Then call `useMoveAnimation(boardRef, boardState, animate)`.
  - `animate` is a `useCallback` that calls `client.animateMove?.(change, viewer)` only when the checkbox is on, and never throws out (wrap it in try/catch so a bad step can't break the dialog).
  - The hook already animates only when `moveCount` rises by exactly one. A viewer switch keeps `moveCount`, so it never animates.
- [ ] **Step 4: Add Play.**
  - The button reads "Play" or "Pause" and sits beside the slider.
  - Pressing Play sets the index to `nextPlayIndex(index, last)` and starts playing.
  - While playing, a `useEffect` keyed on `[playing, index]` sets a `PLAY_STEP_MS` timeout to `index + 1`, stops on the last step, and clears the timeout on cleanup and unmount.
  - The slider and picker stay usable, and playback continues from wherever they leave it.
- [ ] **Step 5: Style the controls row** (checkbox, Play, picker) in `src/App.css` within the existing history dialog look, wrapping at narrow widths.
- [ ] **Step 6: Run `npm test`, `npm run lint`, `npm run typecheck`.** Expect PASS.
- [ ] **Step 7: Browser check.**
  - With animations on, stepping one move forward glides pieces in chess, Uno and Azul. Stepping back or jumping does not.
  - Play runs through a short game with animations on and off, and dragging the slider mid-play continues.
  - Pressing Play at the end restarts.
  - Closing mid-play shows no console errors.
  - Reload: the checkbox is as it was left.
- [ ] **Step 8: Commit** `feat: animations and a play button in the history dialog`

### Task 7: Docs and end-to-end check

**Files:** `docs/architecture.md`, `README.md`

- [ ] **Step 1: Update the docs.**
  - `docs/architecture.md`:
    - the v2 file with `views`, and `GET /api/game-file`, which needs no credentials and refuses until game over;
    - `HistoryBoard`'s `viewer` prop and `ClientGame.animateMove`;
    - the settings module;
    - the accepted risk: undo is still allowed after game over, so players could download the file, undo the final move and play on knowing every hand.
  - `README.md`: viewing a saved game as any player, the animations checkbox and Play, and remembered settings.
  - Run `grep -c "—"` over the branch diff: expect 0.
- [ ] **Step 2: Full browser pass** at about 390 px and a wide window.
  - Join with a name and game ID, leave, reload: both are filled in.
  - Download a finished game from the live History, and see the live History has no picker.
  - Open the file: the picker, the hands, animations and Play all work.
  - Stop the server and press Download: "Could not download the game".
  - Check for overlap and misplaced controls.
- [ ] **Step 3: Run `npm test`, `npm run lint`, `npm run build`.** Expect PASS.
- [ ] **Step 4: Commit** `docs: player views, replay and remembered settings`
