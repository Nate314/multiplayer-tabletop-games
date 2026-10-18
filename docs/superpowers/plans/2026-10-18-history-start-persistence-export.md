# History Start, Saved Games and Game Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The History dialog starts at the starting board (and ends with an end step when the game ended outside a move), started games survive a server restart through SQLite, and a finished game can be downloaded as JSON and reopened from the landing page.

**Architecture:** The game manager builds history steps tagged `start | move | end` and writes every started room through an injected `GameStore`; `server/store.ts` implements that store on Node's built-in `node:sqlite`. A shared `shared/gameFile.ts` builds, names and validates the JSON file; the History dialog downloads it and a new landing page button opens it in the same dialog.

**Tech Stack:** React 19, Vite 6, TypeScript 5.9, Express 5, `ws` 8, Node 22.23 (`node:sqlite` `DatabaseSync`), `node --test`, ESLint 9. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-history-start-persistence-export-design.md`

## Global Constraints

- Branch `history-start-saved-games` (already created, spec committed); one PR against `master`; CI green (`npm run lint`, `npm test`, `npm run build`).
- No new runtime or dev dependencies. SQLite comes from `node:sqlite`.
- No em-dashes (U+2014) in prose, UI text, comments or commit messages.
- Server code (`server/`, `shared/`, `games/<id>/*.ts` outside `client/`) never imports `src/` or `games/<id>/client/`.
- Every state reaching a browser goes through the game's `toPublicState`; history steps use `viewer: null`.
- New platform UI gets `:where()` default styles in `src/App.css`, like the existing ones.
- UI copy: "Start of the game", "End of the game: <gameStatus>", "Download game", "Open a saved game", "This step could not be shown", "This file is not a saved game", "This saved game is for a game this site does not have".
- File: `{ format: "multiplayer-tabletop-games", version: 1, gameType, gameId, exportedAt, steps }`, named `<gameType>-<gameId>.json`.
- `DATABASE_PATH` env var, default `data/games.sqlite` at the repo root (`/app/data/games.sqlite` in Docker).
- `EMPTY_ROOM_TIMEOUT_MS` unchanged (10 minutes); restarted on load.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A restart while a dismiss vote is open must not dismiss anyone. `resolveDismissVote` with zero connected voters passes (`every` on an empty list), so votes are cleared before seats are marked disconnected. Test in Task 3.
2. A game ID with `/`, `\`, `:`, spaces or other file-name-unsafe characters still downloads under a safe name. Test in Task 4.
3. A file that is valid JSON but wrong (`steps: []`, `steps: [1, null]`, `steps` missing, an array at the top level, `version: 2`, a huge game ID) shows an error, never the dialog. Test in Task 4.
4. A room deleted by the empty-room timer after a restart is also deleted from the database, so it does not come back on the next restart. Test in Task 3.
5. An undo after a game ended by an action (resigning in Chess) removes the end step instead of leaving a stale one. Test in Task 1.

---

## File Structure

- `shared/types.ts`: add `HistoryStep`.
- `server/games.ts`: history with start and end steps; `GameStore` usage; loading saved rooms.
- `server/store.ts` (new): `GameStore` type, `SavedRoom` type, `openGameStore(file)`.
- `server/store.test.ts` (new).
- `server/server.ts`: open the store and pass it to the manager.
- `shared/gameFile.ts` (new) and `shared/gameFile.test.ts` (new): file type, build, name, parse.
- `src/components/HistoryDialog.tsx`: steps 0..N, start/end labels, error boundary, Download button, title prop.
- `src/components/HistoryButton.tsx`: never disabled; passes the download handler.
- `src/components/StepErrorBoundary.tsx` (new).
- `src/components/OpenSavedGame.tsx` (new): landing button, file picker, error, dialog.
- `src/services/download.ts` (new): `downloadJson`.
- `src/App.tsx`, `src/App.css`.
- `Dockerfile`, `docker-compose.yml`, `.gitignore`, `.dockerignore`, `README.md`, `docs/architecture.md`.

---

### Task 1: History steps with start and end

**Files:**
- Modify: `shared/types.ts`, `server/games.ts` (`history`), `shared/testGame.ts` (a `concede` action)
- Test: `server/games.test.ts` (update `history lists the state after each move...` and `actions add no history steps`, add new tests)

**Interfaces:**
- Produces: `export type HistoryStep = BasePublicState & { historyStep: 'start' | 'move' | 'end' }` in `shared/types.ts`. `manager.history(gameType, gameId): HistoryStep[] | null`.

- [ ] **Step 1: Write the failing tests**

Update the existing history test: before any move `history` returns one step, `historyStep: 'start'`, `moveCount: 0`, `moves: 0`. After three moves (the third wins, so no end step) the `historyStep`s are `['start', 'move', 'move', 'move']`, `moveCount`s `[0, 1, 2, 3]`, `moves` `[0, 1, 2, 3]`; every step has no `secret`, `undoAvailable: false`, `viewer: null`. After the undo, length is 3. In `actions add no history steps` the expected length becomes 2.

New tests:

```ts
test('the start step is the board before the first move, also after undoing back to zero', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const [start] = manager.history('test', 'g1') as TestPublicState[];
  assert.equal(start.moves, 0);
  assert.deepEqual(start.playerNames, { 1: 'A', 2: 'B' });
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const steps = manager.history('test', 'g1') as HistoryStep[];
  assert.deepEqual(steps.map(step => step.historyStep), ['start']);
});

test('a game that ends outside a move gets an end step built from the live state', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  left(manager.disconnect(ROOM, 2));
  left(manager.disconnect(ROOM, 3));
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.requestDismiss(ROOM, 1, 3));
  const steps = manager.history('test', 'g1') as HistoryStep[];
  assert.deepEqual(steps.map(step => step.historyStep), ['start', 'move', 'end']);
  const end = steps[2];
  assert.equal(end.isGameOver, true);
  assert.equal(end.moveCount, 1);
  assert.equal(end.gameStatus, 'A wins! Everyone else left.');
  assert.equal('secret' in end, false);
});

test('a game ended by an action gets an end step, and an undo removes it', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  assert.deepEqual((manager.history('test', 'g1') as HistoryStep[]).map(s => s.historyStep), ['start', 'move']);
  ok(manager.action(ROOM, 2, { type: 'concede' }));
  assert.deepEqual((manager.history('test', 'g1') as HistoryStep[]).map(s => s.historyStep), ['start', 'move', 'end']);
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.deepEqual((manager.history('test', 'g1') as HistoryStep[]).map(s => s.historyStep), ['start']);
});

test('a game won by a move has no end step', () => {
  const steps = wonGame().history('test', 'g1') as HistoryStep[];
  assert.deepEqual(steps.map(s => s.historyStep), ['start', 'move', 'move', 'move']);
});
```

For the action test, `shared/testGame.ts` gains a `concede` action: `{ ...state, isGameOver: true, currentPlayer: null, winners: activePlayers without seat, gameStatus: `${name} conceded` }` (the stand-in for resigning). The undo restores the state before the last move, so the live state is no longer over and the end step goes.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test server/games.test.ts`
Expected: FAIL on the history tests (lengths and `historyStep` missing).

- [ ] **Step 3: Implement `history` in `server/games.ts`**

`start` is `room.history[0] ?? room.state`; moves are `room.timeline` as today; `end` is `room.state` when `room.state.isGameOver` and the last timeline state (if any) is not. Each goes through `publicView(room, state, false, moveCount, null)` with `historyStep` added (`moveCount` 0 for start, index + 1 for moves, `timeline.length` for end).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test server/games.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/types.ts shared/testGame.ts server/games.ts server/games.test.ts
git commit -m "feat: history starts at the starting board and ends with the game's end"
```

### Task 2: History dialog shows the start and end steps

**Files:**
- Modify: `src/components/HistoryDialog.tsx`, `src/components/HistoryButton.tsx`, `src/App.css` (only if the error message needs a style)
- Create: `src/components/StepErrorBoundary.tsx`

**Interfaces:**
- Consumes: `HistoryStep` (Task 1).
- Produces: `History` becomes `{ status: 'loaded'; steps: HistoryStep[] }` for the loaded case. `HistoryDialog` props: `{ client: ClientGame; history: History; title: string; onClose: () => void; onDownload?: (steps: HistoryStep[]) => void }`. `StepErrorBoundary`: `({ children }: { children: ReactNode })`, a class component that renders `<p className="history-move">This step could not be shown</p>` after a child throws; callers reset it with `key={stepIndex}`.

- [ ] **Step 1: Implement the dialog changes**

- Slider `min={0}`, `max={steps.length - 1}`, starts on the last index; `aria-label="Step"`.
- Label: `'start'` → "Start of the game"; `'end'` → `End of the game: ${step.gameStatus}`; `'move'` → `Move ${step.moveCount} of ${moveTotal}: ${client.describeMove(step)}`, where `moveTotal` is the count of `'move'` steps.
- For `'start'` and `'end'` the board gets `{ ...step, lastMove: null }`, so no move is highlighted.
- The board sits in `<StepErrorBoundary key={index}>`. The label is computed inside a try/catch that falls back to "This step could not be shown" (a hand-edited `lastMove` can make `describeMove` throw outside the boundary).
- `<h2>` shows `title`. GameView's History button passes `"History"`.
- A "Download game" button (class `primary-button`, before Close) shows when `onDownload` is set and the last step has `isGameOver: true`.
- Remove the "No moves yet" branch (there is always a start step).
- In `HistoryButton`, drop `disabled`. `onDownload` is wired in Task 5.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Browser check**

`npm run build && node server/server.ts`, then in Chrome open two tabs, join Chess as two players, and open History before any move: one step, "Start of the game", the starting board. Make two moves: slider has 3 positions, the first is the start board with no highlight. Resign: the last step reads "End of the game: <status>" with no highlighted move. Repeat the start step check in Azul (factories shown, no bag contents) and Uno (no hands visible). Check at about 1280px and 390px wide.

- [ ] **Step 4: Commit**

```bash
git add src/components
git commit -m "feat: history dialog shows the starting board and the end of the game"
```

### Task 3: SQLite store and saved rooms

**Files:**
- Create: `server/store.ts`, `server/store.test.ts`
- Modify: `server/games.ts`, `server/games.test.ts`, `server/server.ts`, `Dockerfile`, `docker-compose.yml`, `.gitignore`, `.dockerignore`

**Interfaces:**
- Produces, in `server/store.ts`:
  - `export type SavedRoom = { gameType: string; state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[] }`
  - `export type GameStore = { loadAll(): Map<string, SavedRoom>; save(roomId: string, room: SavedRoom): void; remove(roomId: string): void }` (keys are room IDs, `<gameType>/<gameId>`)
  - `export function openGameStore(file: string): GameStore`: `':memory:'` or a path; creates the parent folder for a path; `CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, game_type TEXT NOT NULL, data TEXT NOT NULL)` with `data` holding `{ state, history, timeline }` as JSON; `save` is an upsert. `loadAll` skips and deletes a row whose `data` does not parse, logging with `console.error`.
- `createGameManager(games, random = Math.random, store?: GameStore)`.

- [ ] **Step 1: Write the failing store tests** (`server/store.test.ts`)

- `saves, loads, overwrites and removes rooms`: `openGameStore(':memory:')`, save `'test/g1'`, `loadAll()` deep-equals it; save again with a changed state, `loadAll()` has the new one; `remove`, `loadAll().size === 0`.
- `a row that does not parse is skipped and deleted`: needs a way to insert a bad row; use a temp file (`fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-'))`), open the store, then open the same file with `new DatabaseSync(file)` and `INSERT` `('test/bad', 'test', '{nope')`; reopen the store: `loadAll()` has no `test/bad`, and a second `loadAll()` still has none (silence `console.error` with `t.mock.method(console, 'error', () => {})`).
- `creates the folder for a new database file`: `openGameStore(path.join(tmp, 'nested', 'games.sqlite'))` and `fs.existsSync` on the folder. Close the databases before removing the temp folder (add `close(): void` to `GameStore` only if Windows refuses the delete; otherwise leave the folder to the OS temp cleanup).

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test server/store.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `server/store.ts`**

- [ ] **Step 4: Run them to verify they pass**

Run: `node --test server/store.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing manager tests** (`server/games.test.ts`)

A helper `memoryStore()` returning a `GameStore` over a `Map` (copy with `structuredClone` on save and load, so tests catch shared references), plus a `restart(store)` helper that returns `createGameManager([testGame], seededRandom, store)`.

- `a started game is saved after each change and a lobby is not`: join A and B: store empty. A ticks: store has `test/g1` with `timeline.length === 1`. A pings (action): saved `state.gameStatus === 'A pinged'`.
- `a restart keeps the game and holds every seat`: A, B, one tick, restart: `getState(ROOM)` has `disconnected: [1, 2]`, `moveCount: 1`; `join('test', 'g1', 'A', true)` succeeds with seat 1; `history` has 2 steps.
- `a restart clears open votes and dismisses nobody`: A, B, C, one tick, C disconnects, A requests dismiss of C (B has not voted, so it stays open); restart: `activePlayers` is `[1, 2, 3]`, `dismissVote` and `undoVote` are null. Same for an open undo vote.
- `after a restart the empty game is deleted after the timeout, from the store too`: `t.mock.timers.enable({ apis: ['setTimeout'] })` before the restart; tick `EMPTY_ROOM_TIMEOUT_MS`; `getState(ROOM)` is undefined and the store has no `test/g1`.
- `a saved game whose type no longer exists is dropped`: store holds `chess/g1` with `gameType: 'chess'`; `createGameManager([testGame], seededRandom, store)` leaves the store without it.
- `deleting a room removes it from the store`: a lobby-free path: A, B, tick, both disconnect, tick the timer: store empty.

- [ ] **Step 6: Run them to verify they fail**

Run: `node --test server/games.test.ts`
Expected: FAIL on the new tests.

- [ ] **Step 7: Implement persistence in `server/games.ts`**

- One `save(roomId, room)` helper: `store?.save(...)` when `room.state.started`, `store?.remove(roomId)` otherwise. Call it at the end of every method that changes a room (`join` both branches, `disconnect`, `move`, `action`, `requestUndo`, `voteUndo`, `requestDismiss`, `voteDismiss`). Every `rooms.delete` also calls `store?.remove`.
- Extract the empty-room timer from `disconnect` into `startEmptyTimer(roomId, room)` so loading reuses it.
- On creation, for each loaded room: skip and `store.remove` if `findGame(saved.gameType)` is undefined; otherwise set `state = { ...saved.state, undoVote: null, dismissVote: null }`, then `disconnectPlayer(game, state, seat, random)` for each seat in `connectedPlayers(state)`, store the room, save it, and `startEmptyTimer`. Votes are cleared first (Review Focus 1).

- [ ] **Step 8: Run all tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Wire the server and Docker**

- `server/server.ts`: `createGameManager(GAMES, Math.random, openGameStore(process.env.DATABASE_PATH || path.join(__dirname, '../data/games.sqlite')))`; log the database path at start.
- `.gitignore` and `.dockerignore`: add `data`.
- `Dockerfile` runtime stage, before `USER node`: `RUN mkdir -p /app/data && chown node:node /app/data`.
- `docker-compose.yml`: `volumes: - game-data:/app/data` on `app`, and a top-level `volumes: game-data:`.

- [ ] **Step 10: Restart check**

Locally: start the server, two Chrome tabs play two Checkers moves, stop the server (Ctrl+C), start it again. Both tabs show the "Back to Checkers (<id>)" button; clicking it in each returns to the board with the two moves and History shows 3 steps. Then `docker compose up --build -d`, play one move, `docker compose restart`, rejoin works the same. Confirm `node -e "require('node:sqlite')"` succeeds inside the container (`docker compose exec app node -e ...`).

- [ ] **Step 11: Commit**

```bash
git add server Dockerfile docker-compose.yml .gitignore .dockerignore
git commit -m "feat: keep started games in SQLite across server restarts"
```

### Task 4: The game file format

**Files:**
- Create: `shared/gameFile.ts`, `shared/gameFile.test.ts`

**Interfaces:**
- Consumes: `HistoryStep` (Task 1).
- Produces:
  - `export const GAME_FILE_FORMAT = 'multiplayer-tabletop-games'`, `export const GAME_FILE_VERSION = 1`
  - `export type GameFile = { format: typeof GAME_FILE_FORMAT; version: typeof GAME_FILE_VERSION; gameType: string; gameId: string; exportedAt: string; steps: HistoryStep[] }`
  - `export function buildGameFile(gameType: string, gameId: string, steps: HistoryStep[], now: Date): GameFile`
  - `export function gameFileName(gameType: string, gameId: string): string`
  - `export function parseGameFile(text: string, knownGameTypes: readonly string[]): { file: GameFile } | { error: string }`

- [ ] **Step 1: Write the failing tests**

- `buildGameFile` with `new Date('2026-10-18T20:15:00.000Z')` returns the exact object with `exportedAt: '2026-10-18T20:15:00.000Z'`.
- `gameFileName('chess', 'friday')` is `'chess-friday.json'`; `gameFileName('chess', 'a/b\\c:d e?')` is `'chess-a-b-c-d-e-.json'` (each character outside `[A-Za-z0-9_-]` becomes `-`, my rule: one `-` per character).
- `parseGameFile` round-trips `JSON.stringify(buildGameFile(...))` with `['chess']`.
- Each of these gives `{ error: 'This file is not a saved game' }`: `'not json'`, `'[]'`, `'null'`, wrong `format`, `version: 2`, `steps` missing, `steps: []`, `steps: [1, null]`, `gameId` not a string.
- `gameType: 'go'` with known `['chess']` gives `{ error: 'This saved game is for a game this site does not have' }`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test shared/gameFile.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `shared/gameFile.ts`** (use `asRecord` from `shared/messages.ts`)

- [ ] **Step 4: Run them to verify they pass**

Run: `node --test shared/gameFile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/gameFile.ts shared/gameFile.test.ts
git commit -m "feat: game file format for sharing finished games"
```

### Task 5: Download and open game files

**Files:**
- Create: `src/services/download.ts`, `src/components/OpenSavedGame.tsx`
- Modify: `src/components/HistoryButton.tsx`, `src/App.tsx`, `src/App.css`

**Interfaces:**
- Consumes: `buildGameFile`, `gameFileName`, `parseGameFile` (Task 4); `HistoryDialog` props (Task 2).
- Produces: `downloadJson(fileName: string, data: unknown): void` (Blob of `JSON.stringify(data, null, 2)`, a temporary `<a download>`, then `URL.revokeObjectURL`). `OpenSavedGame({ games: PlayableGame[] })`.

- [ ] **Step 1: Implement**

- `HistoryButton` passes `onDownload={steps => downloadJson(gameFileName(gameType, gameState.gameId), buildGameFile(gameType, gameState.gameId, steps, new Date()))}`.
- `OpenSavedGame`: a `button.open-saved-game` "Open a saved game" that clicks a hidden `<input type="file" accept=".json,application/json">`; reads with `file.text()`; `parseGameFile(text, games.map(g => g.info.id))`; an error shows in `.lobby-error`; success renders `<div data-game={gameType}><HistoryDialog client={...} history={{ status: 'loaded', steps }} title={`Saved game: ${gameId}`} onClose={...} /></div>` with no `onDownload`. Reset the input's `value` after each pick so the same file can be picked twice. An unreadable file (`file.text()` rejects) shows "This file is not a saved game".
- `App.tsx`: render `<OpenSavedGame games={PLAYABLE_GAMES} />` in `lobby-main`, above `GameList`. Clear its error when a join dialog opens (keep the error local to the component; it clears on the next pick or close).
- `App.css`: a `:where(.open-saved-game)` default style matching the lobby buttons.

- [ ] **Step 2: Typecheck, lint, test**

Run: `npm run lint && npm test && npm run build`
Expected: all pass.

- [ ] **Step 3: Browser check**

Finish a Quoridor or Mancala game by moves and a Chess game by resignation; in each, History shows "Download game" and the file downloads with the expected name. (In a running game the button is absent.) On the landing page, "Open a saved game" with each file opens the dialog with that game's look and the right last step. A text file renamed to `.json`, and a valid file with `"gameType": "go"`, each show their error. Hand-edit one step's board field to `null` and open it: that step shows "This step could not be shown" and other steps still work. Check the landing page and dialog at about 1280px and 390px wide, light and dark.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: download finished games and open them from the landing page"
```

### Task 6: Docs, final verification, PR

**Files:**
- Modify: `docs/architecture.md`, `README.md`

- [ ] **Step 1: Update docs** (no em-dashes)

`docs/architecture.md`: HistoryButton/HistoryDialog (start, move and end steps; always enabled; Download game), `OpenSavedGame`, `shared/gameFile.ts`, `server/store.ts` and the platform list ("Holds each game's full state in memory" becomes "in memory, written through to SQLite"), loading on start, `DATABASE_PATH`, the Docker volume. `README.md`: games survive restarts, where the database lives, `DATABASE_PATH`, the `game-data` volume, and sharing a finished game by file.

- [ ] **Step 2: Full check**

Run: `npm run lint && npm test && npm run build`
Expected: all pass. Grep the diff for U+2014: none.

- [ ] **Step 3: Commit, push, open the PR**

```bash
git add docs README.md
git commit -m "docs: saved games, game files and the history start step"
git push -u origin history-start-saved-games
gh pr create --base master --title "History start step, saved games in SQLite, and game files"
```

The PR body summarizes the three features, the calls listed in the spec, and the browser and restart checks done, ending with the Claude Code attribution line.
