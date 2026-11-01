# Shared Puzzle Modes (chunk 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the platform what Sudoku, Jigsaw and Code Breaker need: one-player games, a mode house rule (Solo, Together, Race) with per-choice offering, games that continue with one player left, own-move undo, uploaded images, and a Puzzles category.

**Architecture:** Small additions to the existing platform files (`shared/houseRules.ts`, `shared/seating.ts`, `shared/gameDefinition.ts`, `server/games.ts`, `server/server.ts`, `server/store.ts`, `src/services/gameService.ts`), one new shared module `shared/puzzleModes.ts`, and one new server module `server/images.ts` with a client helper `src/services/images.ts`. Existing games behave exactly as before.

**Tech Stack:** TypeScript, Node `node:test`, Express 5, `ws`, `node:sqlite` (as `server/store.ts` uses today), React 19, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-nine-new-games-design.md` (section "Shared ground")

## Global Constraints

- Branch `shared-puzzle-modes` off `nine-new-games`, in its own worktree; finish with a PR into `nine-new-games` (not `master`).
- No new npm dependency.
- No em-dashes in comments, docs or commit messages.
- Every existing test keeps passing: `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`.
- Existing games' behavior is unchanged; every new hook is optional.
- Images: longest side 1600 px, JPEG, at most 1 MB after shrinking, JPEG or PNG only, checked by leading bytes.
- Update `docs/architecture.md` where it describes each platform piece this plan changes.
- Ports: site on PORT 3100, e2e with `E2E_PORT_BASE=6300` (other agents run at the same time on other ports).
- `GameInfo.ownTurnLimit`: its comment in `shared/gameDefinition.ts` and the architecture note become "the game enforces its own turn limit or has no turns, so the platform turn timer is not offered". The puzzle games set it.

## Review Focus

- A house rule value kept from a smaller table that is no longer offered at the new seat count (Solo kept after a second player joins) must fall back to the standard for the new count, not stay.
- Own-move undo when the seat has no move of its own left must answer an error and change nothing, including History.
- An image upload with a wrong or missing seat key, a game that does not exist, a non-image file renamed `.jpg`, or 1 MB + 1 byte must be refused with 4xx and store nothing.
- A one-player game: the lobby must start on that player's agreement alone, and Ask to undo must apply at once; a two-player game must still need the vote.
- `continuesAlone` false (every existing game): dismissing down to one player still ends the game with "X wins! Everyone else left." exactly as today.

---

### Task 1: Per-choice offering and seat-count standards in house rules

**Files:**
- Modify: `shared/houseRules.ts`
- Test: `shared/houseRules.test.ts`

**Interfaces:**
- Produces:
  - `ChoiceRule` choices gain an optional `offered?(seats: number, values: HouseRuleValues): boolean` per choice.
  - `HouseRuleBase` gains optional `standardFor?(seats: number): HouseRuleValue`, used instead of `standard` when present.
  - `export function standardOf(rule: HouseRule, seats: number): HouseRuleValue`
  - `export function offeredChoices(rule: ChoiceRule, seats: number, values: HouseRuleValues): ChoiceRule['choices']`

- [ ] **Step 1: Write failing tests** in `shared/houseRules.test.ts` with a fake info whose only rule is `mode` (choices `solo` offered at `seats === 1`, `together` and `race` at `seats >= 2`, `standardFor: seats => seats === 1 ? 'solo' : 'together'`):
  - `houseRulesOf(info, { activePlayers: [1] })` has `values.mode === 'solo'`; with `[1, 2]` it is `'together'`.
  - `afterSeatChange(info, rulesWithSolo, [1, 2])` gives `'together'` (a kept value whose choice is no longer offered falls back).
  - `afterSeatChange(info, rulesWithRace, [1, 2, 3])` keeps `'race'`.
  - `setHouseRules` with two seated and `{ values: { mode: 'solo' } }` returns `{ error: 'That value is not allowed for Mode' }`.
  - `describeHouseRules` marks `together` at two seats as `standard: true` and `race` as `standard: false`.
  - An existing rule with no `standardFor` and no per-choice `offered` (reuse `CATAN`/`UNO` fixtures) normalizes exactly as before.
- [ ] **Step 2: Run** `node --test shared/houseRules.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `normalize` uses `standardOf(rule, seats)` for new values and also when a kept choice value fails its choice's `offered`. `allowed` takes `seats` and `values` and checks `offeredChoices`. `describeHouseRules` compares against `standardOf(rule, seated)`. `houseRule()` falls back to `rule.standard` as today (state always holds a value once seated).
- [ ] **Step 4: Run** `node --test shared/houseRules.test.ts`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Client.** In `src/components/HouseRulesPanel.tsx` (and `HouseRulesSection.tsx` if it lists choices), show only `offeredChoices(rule, seated, values)`. Check in the browser later (Task 7).
- [ ] **Step 6: Commit** `House rules: per-choice offering and seat-count standards`.

### Task 2: `shared/puzzleModes.ts`

**Files:**
- Create: `shared/puzzleModes.ts`, `shared/puzzleModes.test.ts`

**Interfaces:**
- Consumes: Task 1's `ChoiceRule` with per-choice `offered` and `standardFor`.
- Produces (exact names the three puzzle games import):
  ```ts
  export type PuzzleMode = 'solo' | 'together' | 'race';
  export type ModeChoice<M extends string> = { value: M; label: string; offered(seats: number): boolean };
  // The Mode rule: Solo at 1 seat, Together and Race at 2+, plus `extra` choices; `standardAt` overrides the standard per seat count
  export function modeRule<M extends string = never>(extra?: ModeChoice<M>[], standardAt?: (seats: number) => PuzzleMode | M): ChoiceRule<PuzzleMode | M>;
  export const MODE_RULE: ChoiceRule<PuzzleMode>; // modeRule() with no extras
  export function modeOf<M extends string>(state: Pick<BaseGameState, 'houseRules'>, rule: ChoiceRule<PuzzleMode | M>): PuzzleMode | M;
  export function playsAtOnce(mode: string): boolean; // true for together and race: moves are actions, any seat, any time
  export type RaceBoards<B> = Partial<Record<Seat, B>>;
  export type RaceProgress = Partial<Record<Seat, number>>; // 0 to 100, whole numbers
  // The boards a viewer may see: during play only their own (none for null); once over, all
  export function visibleBoards<B>(boards: RaceBoards<B>, viewer: Seat | null, isGameOver: boolean): RaceBoards<B>;
  export function raceProgress<B>(boards: RaceBoards<B>, percent: (board: B) => number): RaceProgress;
  // Counts per seat of placed pieces or entries, for the Together end screen
  export type Contributions = Partial<Record<Seat, number>>;
  export function addContribution(counts: Contributions, seat: Seat, by?: number): Contributions;
  ```
  Labels: `Solo`, `Together`, `Race`; rule id `mode`, label `Mode`, help `Solo with one player. Together shares one board; Race gives everyone the same puzzle.`

- [ ] **Step 1: Write failing tests:** `MODE_RULE` normalizes to `solo` at 1 seat and `together` at 2; `modeRule([{ value: 'classic', label: 'Classic', offered: s => s === 2 }], s => s === 2 ? 'classic' : s === 1 ? 'solo' : 'together')` offers `classic` only at 2 and defaults to it there; `visibleBoards({1: a, 2: b}, 1, false)` is `{1: a}`, with `null` is `{}`, and with `isGameOver` true is both; `raceProgress` rounds; `addContribution({}, 2)` is `{2: 1}`; `playsAtOnce('solo') === false`.
- [ ] **Step 2: Run** `node --test shared/puzzleModes.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the module.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `Shared puzzle modes`.

### Task 3: One-player games

**Files:**
- Modify: `server/games.ts` (undo request and `resolveUndoVote`, dismiss/pause/rematch vote counts where they require two), `shared/seating.ts` only if it blocks starting with one
- Test: `server/games.test.ts`

**Interfaces:**
- Produces: a game with `info.minPlayers: 1` starts with one seated player once house rules are agreed; with exactly one connected player, `requestUndo` applies the undo at once (no `undoVote` left in state) and returns the restored view.

- [ ] **Step 1: Write failing tests** with `{ ...testGame, info: { ...testGame.info, minPlayers: 1 } }`: one player joins, agrees, moves; `requestUndo` returns a state equal to the pre-move one with `undoVote: null`; `requestPause` with one player pauses at once; rematch with one player starts the rematch. A second test: the normal `testGame` with two players still opens a vote (`undoVote.requestedBy` set).
- [ ] **Step 2: Run** `node --test server/games.test.ts`. Expected: the new tests FAIL with "Not enough players to vote".
- [ ] **Step 3: Implement.** Replace the `< 2` guards with "fewer than one connected player" for undo; when the requester is the only connected player, apply the undo through the same path `resolveUndoVote` uses. Leave the history `undoAvailable` rules as they are. Check `seating.ts` start logic works at 1 (it uses `minimumToStart`).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: e2e fixture.** Make `seat(gameType, ['Alice'])` in `e2e/fixtures.ts` work for a one-player game (no waiting for a second player; agreeing to house rules with the single page). No registered game has `minPlayers: 1` yet, so the puzzle games' e2e specs are the first real use; here, read the fixture's seat loop and remove anything that assumes two or more pages (a second join, a wait for "Waiting for more players" to clear). Run `E2E_PORT_BASE=6300 npx playwright test e2e/landing.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `Platform: one-player games`.

### Task 4: `continuesAlone`

**Files:**
- Modify: `shared/gameDefinition.ts`, `shared/seating.ts:95-110`
- Test: `shared/seating.test.ts`

**Interfaces:**
- Produces: `GameDefinition.continuesAlone?: true`. When set, `removePlayer` mid-game with one player left does not end the game; it moves the turn on as usual and calls `onPlayerLeft(next, seat, random)`. The `onPlayerLeft` comment in `gameDefinition.ts` changes to "only while 2+ remain, or 1+ for a game that continuesAlone".

- [ ] **Step 1: Write failing tests:** with `{ ...testGame, continuesAlone: true }` and two players started, `removePlayer(game, state, 2)` leaves `isGameOver: false`, `activePlayers: [1]`, and `onPlayerLeft` was called; with plain `testGame` the result is unchanged from today (`isGameOver: true`, `gameStatus: 'Alice wins! Everyone else left.'` using the fixture's names).
- [ ] **Step 2: Run** `node --test shared/seating.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the flag check before the `activePlayers.length === 1` branch.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `Platform: games that continue with one player`.

### Task 5: Own-move undo

**Files:**
- Modify: `shared/gameDefinition.ts`, `shared/messages.ts`, `server/games.ts`, `server/server.ts` (the switch near line 218), `src/services/gameService.ts`
- Test: `server/games.test.ts`

**Interfaces:**
- Produces:
  - `GameDefinition.undoOwn?(state: S, seat: Seat): Result<S>`: the state with `seat`'s last move taken back, or `{ error }` when it has none. The game owns what "its last move" is.
  - `MESSAGE_TYPES.UNDO_OWN = 'UNDO_OWN'`, no payload.
  - `manager.undoOwn(roomId: string, seat: Seat): Result<BasePublicState>`: refuses with `'This game has no own-move undo'` when the hook is missing, `'The game is paused'` while paused, `'The game is over'` after game over, and passes through the hook's error; on success records the result as a step (as `action()` does with `recordsAction`), cancelling no vote (none exist in those modes).
  - `gameService.undoOwn(): void` sends `UNDO_OWN`.
  - `GameDefinition.allowsUndoVote?(state: S): boolean`: when it returns false, `requestUndo` answers `{ error: 'Use Undo my last move in this mode' }` and opens no vote, and the platform view's `undoAvailable` is false. Missing means true (every existing game).
  - Screen copy for the game's button (games use it): `Undo my last move`.

- [ ] **Step 1: Write failing tests** with a test game whose state holds `marks: { seat, n }[]` and whose `undoOwn` drops that seat's last mark: seat 2 marks, seat 1 marks, seat 2 `undoOwn` leaves only seat 1's mark and the timeline grows by one; seat 2 again returns `{ error: 'Nothing of yours to undo' }` (the test game's message) and the timeline length is unchanged; paused game is refused; a game without the hook is refused; a game whose `allowsUndoVote` returns false refuses `requestUndo` with `'Use Undo my last move in this mode'` and leaves `undoVote` null.
- [ ] **Step 2: Run** `node --test server/games.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook, message, manager method, server route and client method.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Platform: own-move undo`.

### Task 6: Uploaded images

**Files:**
- Create: `server/images.ts`, `server/images.test.ts`, `src/services/images.ts`
- Modify: `server/store.ts` (new `images` table and methods), `server/server.ts` (mount routes), `server/games.ts` (delete a room's images with the room), `shared/gameDefinition.ts`, `shared/gameFile.ts` and `shared/pauseFile.ts` (embed images), the server routes that build game files and pause files and accept resumes, `src/services/pauseFiles.ts` and the client that opens a saved game file
- Test: `server/images.test.ts`, `server/store.test.ts`, `shared/gameFile.test.ts`, `shared/pauseFile.test.ts`

**Interfaces:**
- Produces:
  - `GameDefinition.imagesOf?(state: S): string[]`: the image ids a state refers to.
  - Store: `saveImage(id: string, roomId: string, mime: 'image/jpeg' | 'image/png', bytes: Buffer): void`, `loadImage(id: string): { mime: string; bytes: Buffer } | undefined`, `deleteRoomImages(roomId: string): void`. Images of a room are deleted with the room, except ids still referenced by that room's archived games (deleted when `pruneArchive` removes them).
  - `POST /api/images/:gameType/:gameId` with header `X-Seat-Key: <key>` and a raw body (`express.raw({ type: ['image/jpeg', 'image/png'], limit: '1mb' })`): 201 `{ id }` for a seated player of an existing room; 403 for a wrong key, 404 for no such room, 413 above 1 MB, 415 when the leading bytes are not JPEG (`FF D8 FF`) or PNG (`89 50 4E 47`). Ids are random 128-bit hex.
  - `GET /api/images/:id`: the bytes with their mime and `Cache-Control: public, max-age=31536000, immutable`, or 404.
  - Game files and pause files carry `images?: Record<string, { mime: string; data: string }>` (base64) for every id that `imagesOf` returns across their steps. Resuming a pause file stores the images again under the same ids. A game file opened on the landing page registers its images with `src/services/images.ts` so screens show them offline.
  - Client: `shrinkImage(file: File): Promise<Blob>` (canvas, longest side 1600 px, JPEG quality 0.85, refuses non-images); `uploadImage(gameType: string, gameId: string, blob: Blob): Promise<string>` (reads the seat key from `src/services/session.ts` the way rejoin does); `imageUrl(id: string): string` (a registered data URL from an opened file, else `/api/images/<id>`).

- [ ] **Step 1: Write failing tests** in `server/images.test.ts` (start the router on an ephemeral port as `server/static.test.ts` does): a seated player's JPEG upload returns 201 and `GET` returns the same bytes and mime; wrong key 403; unknown room 404; 1 MB + 1 byte 413; a text file sent as `image/jpeg` 415; after the room is deleted `GET` is 404. In `shared/gameFile.test.ts`: a built game file round-trips `images`. In `shared/pauseFile.test.ts`: the same for pause files.
- [ ] **Step 2: Run** `node --test server/images.test.ts shared/gameFile.test.ts shared/pauseFile.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the store table, routes, deletion, file embedding and client helpers.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Platform: uploaded images`.

### Task 7: Puzzles category, docs and browser check

**Files:**
- Modify: `shared/categories.ts` (add `{ id: 'puzzle', name: 'Puzzles' }` after `classic`), `shared/categories.test.ts`, `docs/architecture.md`
- Test: `shared/categories.test.ts`

- [ ] **Step 1: Write a failing test** that `CATEGORIES.map(c => c.id)` equals `['card', 'dice', 'tile', 'classic', 'puzzle', 'strategy', 'party']` and an empty Puzzles group is dropped.
- [ ] **Step 2: Run** `node --test shared/categories.test.ts`. Expected: FAIL. Implement; run again: PASS.
- [ ] **Step 3: Docs.** In `docs/architecture.md`, describe: one-player games, `continuesAlone`, own-move undo (`undoOwn`, `UNDO_OWN`), per-choice `offered` and `standardFor`, `shared/puzzleModes.ts`, the image routes, store table and file embedding, and the Puzzles category.
- [ ] **Step 4: Browser check.** Run the site on its own port (not 6000; see the memory note on nvm PATH). In Chrome, open the House rules panel of an existing game with a choice rule (Pictionary) and confirm it looks and works as before at laptop and phone widths. Upload a JPEG with `curl` using a real seat key from a joined game and open `/api/images/<id>` in the browser.
- [ ] **Step 5: Run the full suite** `npm test && npm run typecheck && npm run lint && npm run test:e2e`. Expected: all PASS.
- [ ] **Step 6: Commit** `Puzzles category and architecture notes`, push, and open a PR into `nine-new-games` with `gh pr create --base nine-new-games`.
