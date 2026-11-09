# Generic Names: Legacy Ids, Street Deeds and Rail Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Old game ids keep working through one map in `games/legacyIds.ts` (shipped first, as its own PR), then Monopoly becomes Street Deeds (`streetdeeds`) and Ticket to Ride becomes Rail Routes (`railroutes`), each with original names, text, map and art and unchanged rules.

**Architecture:** `games/legacyIds.ts` holds the only copy of every old id: `LEGACY_IDS` maps an old id to `{ id, keepsSaves }`, and `currentId` reads it safely. Each place that meets a stored or linked game id calls it once: the stats store and the game store rename their rows at server start (`server/legacyIds.ts`), `parsePauseFile` and `parseGameFile` rewrite or refuse an old file, `parseJoinLink` and the remembered session rewrite the id in the browser. Every function that reads the map takes it as a last parameter defaulting to `LEGACY_IDS`, so the plumbing is tested with a made-up map before any game is renamed. The renames are `git mv` plus the new id at every registration point; the original content replaces names and text in place, keeping every index and number the saved states and the rules depend on.

**Tech Stack:** TypeScript 5.9, React 19, Vite, SCSS, Express 5, ws, `node:sqlite`, `node --test`, Playwright (Chromium), Node 22.18+ through nvm. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Generic names (wave 2)" (all of it) and "Rules for every agent". Chunk 9, branch `generic-streetdeeds-railroutes`, from `party-games-and-polish` after wave 1 (chunks 1 to 8) is merged into it.

## Global Constraints

- New names and ids, exactly: **Street Deeds** (`streetdeeds`), **Rail Routes** (`railroutes`). "Each new id is the name in lower case with no spaces or punctuation."
- `git mv games/<old> games/<new>` so history follows, and `e2e/<old>.spec.ts` renamed to `e2e/<new>.spec.ts` the same way.
- "Rules, house rules and options are unchanged, so existing rules tests pass after only the renames." House rule ids stay as they are (saved states carry them); only labels and help text may change.
- "A single `games/legacyIds.ts` maps each old id to its new id." "Each use has a test. The old ids appear nowhere else in the code."
- "The game's README may say once, in its opening, that it plays like the commercial game ("plays like Monopoly"), which is descriptive use; nothing else shows the old name. "Differences from Wikipedia" stays and keeps pointing at the Wikipedia article for the rules." Put the Wikipedia link in that one opening line, so the old name appears in one line only, and have "Differences from Wikipedia" refer to "the Wikipedia article linked above".
- "Any drawn art, piece or card design that imitates the commercial game's look is redrawn in the project's own style."
- Street Deeds: "a new board with the same structure (40 spaces, the same price, rent, group and space-type pattern) but original street, station and utility names (my call: a fictional city), and two new card decks with original text that keep each card's effect. The two deck names change too (my call: Fortune and Town Fund)."
- Rail Routes: "an original map, not the published one. Same rules and the same totals (number of routes, colors and lengths, train counts, ticket count and point spread) so the game balances the same way, but a fictional geography with its own city names, route network and tickets (my call: a fictional continent). Ticket scoring is recomputed for the new map and tested."
- Wave 2 does **not** edit the top-level `README.md` game list or count, the counts in `e2e/landing.spec.ts`, or `docs/architecture.md`.
- Outside the two game folders, touch only: `games/legacyIds.ts` (+ test), `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, the every-game test lists (`shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`, `src/components/gameFilters.test.ts`), `e2e/handOnly.spec.ts`, comments naming the old games in `shared/svg/disc.ts` and `shared/svg/cardArt.ts`, and the legacy id uses listed in Tasks 3 to 5. Anything else: stop and report.
- Wave 1 has edited the registry files, Azul, UNO, Pictionary and `e2e/fixtures.ts`. Find lines in those files by symbol (`GAMES`, `GAME_INFOS`, `CLIENT_GAMES`, `GAME_ICONS`, `SVG_ASSETS`), never by line number.
- Registry order is "alphabetical by name": move each renamed entry to its new name's place in `GAMES` (`games/registry.ts`) and `GAME_INFOS` (`games/infos.ts`), the same place in both (`games/infos.test.ts` checks it).
- No em-dashes (the character U+2014) in code, comments, READMEs, FAQs, commit messages or the PR body.
- Ports for this chunk: server `PORT=3309`, Playwright `E2E_PORT_BASE=8900`. Never 6000 (Chrome refuses it).
- Node through nvm. If `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to `PATH` (Git Bash: `export PATH="/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH"`).
- Every commit message ends with a blank line and then exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
  (`git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa"`).
- Every PR body ends with exactly:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

## Plan decisions (not pinned by the spec; reported to the coordinator)

- **Saved games that no longer fit.** A Rail Routes state names routes, cities and tickets by index, so a Ticket to Ride game saved before the rename would load onto the new map with different routes. `LEGACY_IDS` therefore carries `keepsSaves`: `true` for `monopoly` (the board and decks keep every index), `false` for `tickettoride`. With `false`, links, stats and the remembered session still move to the new id, but saved rooms are left under the old id (and dropped at load, as any unknown game is today), and an old pause file or game file is refused with a clear message.
- **Street Deeds corners and terms** (my call, within "original names"): GO becomes **Start**, Free Parking becomes **Town Square**, Jail and Go to Jail stay, railroads are shown as **stations**, Title Deed becomes **deed**, the Get Out of Jail Free card becomes the **Jail pass**. Internal keys that saved states carry (`DeckName` `'chance' | 'chest'`, space kinds, house rule ids `freeParkingJackpot` and `goBonus`) stay; only what is shown changes. Group colors and keys stay (the color groups are the structure the spec keeps).

## Review Focus

1. A game id from an upload or a link such as `__proto__`, `constructor` or `toString` must not resolve through the object prototype: it stays as it is and is refused as an unknown game. Test in Task 2.
2. A server restart where an old room's new id is already taken (an older build wrote to the same database) must not crash the start or merge two games' steps: that room is left under its old id. Test in Task 3.
3. The rename runs on every start: a second run changes nothing. Test in Task 3.
4. A Street Deeds game saved as Monopoly mid-game (board positions, deck order indices, a held jail card, a drawn card) must play on: every board index keeps its kind, price, rents, group and deck, and every card index keeps its effect. Characterization test in Task 8.
5. A tab that was in a Monopoly game when the server is redeployed refreshes and rejoins the same seat as Street Deeds. Unit test in Task 5, real-entry e2e in Task 7.

---

### Task 1: Worktree, branch and ports

**Files:** none in the repo.

- [ ] **Step 1: Create the worktree from the merged `party-games-and-polish`.**

```bash
cd C:/Users/Natha/Documents/code/multiplayer-tabletop-games
git fetch origin
git worktree add ../mtg-generic-streetdeeds-railroutes -b generic-streetdeeds-railroutes-legacy-ids origin/party-games-and-polish
cd ../mtg-generic-streetdeeds-railroutes
npm ci
```

Expected: the worktree exists; `git log -1` shows the wave 1 merge on `party-games-and-polish`. If wave 1 is not merged yet (no `games/charades` folder), stop and report.

- [ ] **Step 2: Check the ports are free.** `netstat -ano | grep -E ':(3309|890[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3309 or 8900, and say so in the PR.

- [ ] **Step 3: Baseline.** `npm test`, `npm run typecheck` and `npm run lint` all pass before any change. If they do not, stop and report (do not fix wave 1 here).

The legacy id work (Tasks 2 to 6) is on branch `generic-streetdeeds-railroutes-legacy-ids`; Task 6 opens its PR. The renames (Tasks 7 to 12) are on `generic-streetdeeds-railroutes`, created in Task 6 after that PR is merged.

---

### Task 2: `games/legacyIds.ts`

**Files:**
- Create: `games/legacyIds.ts`
- Test: create `games/legacyIds.test.ts`

**Interfaces:**
- Produces:
  - `export type LegacyId = { id: string; keepsSaves: boolean }` (`keepsSaves`: a saved state of the old game is still a valid state of the new one).
  - `export type LegacyIds = Readonly<Record<string, LegacyId>>`
  - `export const LEGACY_IDS: LegacyIds = {}` (empty in this PR; Tasks 7 and 9, and chunks 10 to 12, add entries).
  - `export function currentId(id: string, legacy: LegacyIds = LEGACY_IDS): string`: `legacy[id].id` when `Object.hasOwn(legacy, id)`, else `id`.
  - `export function keepsSaves(id: string, legacy: LegacyIds = LEGACY_IDS): boolean`: false only for an own key whose `keepsSaves` is false.
- No imports (shared, server and src all import it).

- [ ] **Step 1: Write the failing tests** in `games/legacyIds.test.ts`, with `const TEST: LegacyIds = { oldgame: { id: 'newgame', keepsSaves: true }, oldmap: { id: 'newmap', keepsSaves: false } }`:
  - `currentId maps an old id and leaves others`: `currentId('oldgame', TEST) === 'newgame'`, `currentId('newgame', TEST) === 'newgame'`, `currentId('chess', TEST) === 'chess'`.
  - `currentId ignores the object prototype`: for each of `'__proto__'`, `'constructor'`, `'toString'`, `'hasOwnProperty'`, `currentId(name, TEST) === name`.
  - `keepsSaves is false only for a reshaped old id`: `keepsSaves('oldgame', TEST) === true`, `keepsSaves('oldmap', TEST) === false`, `keepsSaves('chess', TEST) === true`, `keepsSaves('constructor', TEST) === true`.
  - `every legacy entry points at a registered game and no old id is still registered` (real map, imports `GAMES` from `./registry.ts`): for each `[old, { id }]` of `Object.entries(LEGACY_IDS)`: `GAMES.some(g => g.info.id === id)`, `!GAMES.some(g => g.info.id === old)`, `old !== id`, and no value is also a key (no chains).

- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `games/legacyIds.ts`** with the interface above and a one-line header comment: old game ids from before the generic renames, the only place they appear.

- [ ] **Step 4: Run** `node --test games/legacyIds.test.ts`. Expected: PASS (the real-map test passes vacuously while the map is empty).

- [ ] **Step 5: Commit** `games/legacyIds.ts` and its test: "Legacy ids: one map from old game ids to new ones".

---

### Task 3: Rename stored rows at server start

**Files:**
- Modify: `server/stats/store.ts`, `server/store.ts`, `server/server.ts`
- Create: `server/legacyIds.ts`
- Test: `server/stats/store.test.ts`, `server/store.test.ts`, create `server/legacyIds.test.ts`

**Interfaces:**
- Consumes: `LEGACY_IDS`, `LegacyIds` from Task 2.
- Produces:
  - `StatsStore.renameGameType(from: string, to: string): number`: in one transaction, `results` rows with `game_type = from` get `game_type = to` and their `archive_id` prefix `from/` replaced by `to/`. Uses `UPDATE OR IGNORE`, so a row whose new `archive_id` already exists keeps its old values. Returns the rows changed.
  - `GameStore.renameGameType(from: string, to: string): number`: in one transaction, for rooms with `game_type = from`: `rooms.id` prefix `from/` becomes `to/` and `game_type = to` (`UPDATE OR IGNORE`); then, only for room ids that now exist under `to/` and no longer under `from/`, the matching `room_steps.room_id` and `images.room_id`; then `archived_games` (`id` prefix and `game_type`, `UPDATE OR IGNORE`) and `archive_images.archive_id` for the archives that moved. Returns the rooms changed. A prefix match is `substr(x, 1, length(?) + 1) = ? || '/'`, never `LIKE` (an id may contain `%` or `_`).
  - `server/legacyIds.ts`: `export function renameLegacyGames(stats: Pick<StatsStore, 'renameGameType'>, games: Pick<GameStore, 'renameGameType'>, legacy: LegacyIds = LEGACY_IDS): void`: for every entry, `stats.renameGameType(old, id)`; `games.renameGameType(old, id)` only when `keepsSaves` is true. Logs one line per entry that changed anything.
  - `server/server.ts`: the game store is opened into a `const gameStore = openGameStore(DATABASE_PATH)` and `renameLegacyGames(stats, gameStore)` runs after `openStatsStore` and before `createGameManager(...)` receives `gameStore`, so rooms load under their new ids.

- [ ] **Step 1: Write the failing tests.**
  - `server/stats/store.test.ts`, `renameGameType moves an old game type and its archive ids, once`: record a result with `gameType: 'oldgame'`, `archiveId: 'oldgame/g1#1'`; `renameGameType('oldgame', 'newgame') === 1`; `resultsFor(hash)[0]` has `gameType: 'newgame'`, `archiveId: 'newgame/g1#1'`; a second `renameGameType('oldgame', 'newgame') === 0`; a result of another game type is unchanged.
  - `server/stats/store.test.ts`, `renameGameType leaves a row whose new archive id is taken`: results `oldgame/g1#1` and `newgame/g1#1` both recorded; rename returns 0 and both rows keep their game types.
  - `server/store.test.ts`, `renameGameType moves a room with its steps, images and archives`: save room `oldgame/g1` with one pushed step, an image saved to it, and an archive `oldgame/g1#1` showing that image; `renameGameType('oldgame', 'newgame') === 1`; `loadAll()` has key `newgame/g1` with `gameType: 'newgame'` and its history of one step, and no `oldgame/g1`; `countRoomImages('newgame/g1') === 1`; `loadArchive('newgame/g1#1')` is defined with `gameType: 'newgame'` and `loadArchive('oldgame/g1#1')` is undefined; a second call returns 0.
  - `server/store.test.ts`, `renameGameType leaves a room whose new id is taken, with its own steps`: rooms `oldgame/g1` (two steps) and `newgame/g1` (one step) saved; rename returns 0; `loadAll()` still has both, `newgame/g1` with one step.
  - `server/store.test.ts`, `renameGameType matches the old id as a whole prefix`: rooms `oldgame/g1` and `oldgamex/g1`; only the first moves.
  - `server/legacyIds.test.ts`, `renameLegacyGames renames stats for every entry and rooms only for saves that still fit`: fakes recording calls; with `{ oldgame: { id: 'newgame', keepsSaves: true }, oldmap: { id: 'newmap', keepsSaves: false } }`, stats gets both renames, games gets only `['oldgame', 'newgame']`.

- [ ] **Step 2: Run** `node --test server/stats/store.test.ts server/store.test.ts server/legacyIds.test.ts`. Expected: FAIL (`renameGameType` is not a function, module not found).

- [ ] **Step 3: Implement** the two store methods, `server/legacyIds.ts` and the `server/server.ts` wiring as in Interfaces. Add `renameGameType` to the `StatsStore` and `GameStore` types.

- [ ] **Step 4: Run** the same tests, then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**: "Legacy ids: rename stats, rooms and archives of an old game id at server start".

---

### Task 4: Old pause files and game files

**Files:**
- Modify: `shared/pauseFile.ts`, `shared/gameFile.ts`
- Test: `shared/pauseFile.test.ts`, `shared/gameFile.test.ts`

**Interfaces:**
- Consumes: `currentId`, `keepsSaves`, `LEGACY_IDS`, `LegacyIds` from Task 2 (`import ... from '../games/legacyIds.ts'`).
- Produces:
  - `parsePauseFile(text: string, knownGameTypes: readonly string[], legacy: LegacyIds = LEGACY_IDS)`: after the shape check, an old id with `keepsSaves` false gives `{ error: 'This pause file is from before this game got its new map and cannot be resumed' }`; otherwise `gameType` is replaced by `currentId(gameType, legacy)` before the known-game check, and the returned file carries the new id. Callers (`src/components/ResumeGame.tsx`, `server/games.ts` `uploadPauseFile`) are unchanged: they get the default map. The server's `checkPauseFiles` compares the parsed files, so files of one pause with old and new ids still match.
  - `parseGameFile(text: string, knownGameTypes: readonly string[], legacy: LegacyIds = LEGACY_IDS)`: the same, with `{ error: 'This saved game is from before this game got its new map and cannot be opened' }`. Caller `src/components/OpenSavedGame.tsx` unchanged.

- [ ] **Step 1: Write the failing tests**, each with `TEST = { oldgame: { id: 'newgame', keepsSaves: true }, oldmap: { id: 'newmap', keepsSaves: false } }`:
  - `shared/pauseFile.test.ts`, `a pause file saved under an old id opens as the new game`: the test's `file()` with `gameType: 'oldgame'`, `parsePauseFile(JSON.stringify(f), ['newgame'], TEST)` returns `{ file }` with `file.gameType === 'newgame'` and every other field equal.
  - `shared/pauseFile.test.ts`, `a pause file of a reshaped old game is refused`: `gameType: 'oldmap'`, known `['newmap']`: the error string above.
  - `shared/pauseFile.test.ts`, `a pause file named __proto__ is an unknown game`: `gameType: '__proto__'` gives `'This pause file is for a game this site does not have'`.
  - `shared/gameFile.test.ts`: the same three cases for `parseGameFile`, with its own strings (`'This saved game is for a game this site does not have'` for the unknown one).

- [ ] **Step 2: Run** `node --test shared/pauseFile.test.ts shared/gameFile.test.ts`. Expected: the new tests FAIL (the old id is reported unknown).

- [ ] **Step 3: Implement** both as in Interfaces.

- [ ] **Step 4: Run** the same tests and `node --test server/pause.test.ts server/pauseFiles.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**: "Legacy ids: open pause files and game files saved under an old id".

---

### Task 5: Old join links and the remembered game

**Files:**
- Modify: `src/services/share.ts`, `src/services/session.ts`
- Test: `src/services/share.test.ts`, `src/services/session.test.ts`

**Interfaces:**
- Consumes: `currentId`, `LEGACY_IDS`, `LegacyIds` from Task 2.
- Produces:
  - `parseJoinLink(pathname: string, gameTypes: readonly string[], legacy: LegacyIds = LEGACY_IDS): JoinLink | null`: the decoded game type goes through `currentId` before the `gameTypes` check, so `/join/<old id>/<game ID>` returns the new id. `src/App.tsx` is unchanged.
  - `loadSession(legacy: LegacyIds = LEGACY_IDS): Session | null`: the `read` helper rewrites `gameType` with `currentId`, for both `inGame` (sessionStorage) and `lastGame` (localStorage). `useState(loadSession)` in `useGameConnection.ts` calls it with no argument, which keeps the default. The next `saveSession` writes the new id, which is the "copied to the new key on first load" for the session.

- [ ] **Step 1: Find any other browser-stored value keyed by or holding a game id.** `git grep -n -E "readJson|readText|writeJson|writeText|localStorage|sessionStorage" -- src games ':!*.test.*'` and read each hit wave 1 added. On `party-games-and-polish` before wave 1, the only ones are `lastGame` and `inGame` in `session.ts`; `landingFilters` holds categories, `tableLayout` is global. If wave 1 added a key built from a game id (for example `<prefix><gameId>`), stop and report it to the coordinator with the file and key: copying it to the new key needs a change to `src/services/storage.ts` this plan does not cover.

- [ ] **Step 2: Write the failing tests** with `TEST = { oldgame: { id: 'newgame', keepsSaves: true } }`:
  - `src/services/share.test.ts`, `an old join link opens the renamed game`: `parseJoinLink('/join/oldgame/abc', ['newgame'], TEST)` deep-equals `{ gameType: 'newgame', gameId: 'abc' }`; `parseJoinLink('/join/__proto__/abc', ['newgame'], TEST) === null`.
  - `src/services/session.test.ts`, `a game remembered under an old id rejoins as the new game`: install `sessionStorage` with `'multiplayer-tabletop-games:inGame'` holding `{ gameType: 'oldgame', gameId: 'abc', playerName: 'Ann', seatKey: 'k1' }`; `loadSession(TEST)` deep-equals that with `gameType: 'newgame'`, `inGame: true`. A second case does the same for `lastGame` in `localStorage` with `inGame: false`.

- [ ] **Step 3: Run** `node --test src/services/share.test.ts src/services/session.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 4: Implement** both as in Interfaces.

- [ ] **Step 5: Run** the same tests. Expected: PASS.

- [ ] **Step 6: Commit**: "Legacy ids: old join links and remembered games open the renamed game".

---

### Task 6: Legacy id PR

**Files:** none new.

- [ ] **Step 1: Checks.** `npm test`, `npm run typecheck`, `npm run lint` pass. Then `E2E_PORT_BASE=8900 npx playwright test --workers=2 e2e/pause.spec.ts e2e/history.spec.ts e2e/sharing.spec.ts e2e/stats.spec.ts e2e/openGames.spec.ts`. Expected: all pass (these cover the code Tasks 3 to 5 touched; the map is empty, so nothing changes for them).

- [ ] **Step 2: Old ids appear nowhere.** `git grep -n -I -E "monopoly|tickettoride|thecrew|\brisk\b" -- games/legacyIds.ts server/legacyIds.ts shared/pauseFile.ts shared/gameFile.ts src/services/share.ts src/services/session.ts` prints nothing (the tests use `oldgame` and friends).

- [ ] **Step 3: Push and open the PR.**

```bash
git push -u origin generic-streetdeeds-railroutes-legacy-ids
gh pr create --base party-games-and-polish --title "Legacy game ids: one map, used by stats, saved rooms, files, links and the remembered game" --body-file <file>
```

The body lists: `games/legacyIds.ts` and its API; each use and its test (Tasks 3 to 5); the `keepsSaves` decision and the two refusal messages; that the map is empty until the renames add entries; and the result of Task 5 Step 1. It ends with the PR footer from Global Constraints.

- [ ] **Step 4: Wait for the merge.** Report the PR URL to the coordinator and wait until it is merged into `party-games-and-polish`. Do not start Task 7 before.

- [ ] **Step 5: Start the rename branch from the merged result.**

```bash
git fetch origin
git switch -c generic-streetdeeds-railroutes origin/party-games-and-polish
npm ci
```

Expected: `games/legacyIds.ts` is present on the new branch.

---

### Task 7: Rename Monopoly to Street Deeds (ids, folders, registration)

**Files:**
- Move: `games/monopoly` to `games/streetdeeds`; `e2e/monopoly.spec.ts` to `e2e/streetdeeds.spec.ts`; `games/streetdeeds/client/monopoly.scss` to `streetdeeds.scss`
- Modify: `games/streetdeeds/info.ts`, `index.ts`, `options.ts`, `svg.ts`, `client/index.ts`, `client/Board.tsx`, `client/GameScreen.tsx`, `client/streetdeeds.scss`, the README title; `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, `shared/categories.test.ts`, `games/secretState.test.ts`, `src/components/gameFilters.test.ts`, `e2e/handOnly.spec.ts`, `games/legacyIds.ts`, `shared/svg/disc.ts` (comment)
- Test: `games/legacyIds.test.ts`, `e2e/streetdeeds.spec.ts`

**Interfaces:**
- Produces: `streetdeedsInfo` (`id: 'streetdeeds'`, `name: 'Street Deeds'`), `streetdeeds` (the `GameDefinition`), `streetdeedsClient`, `STREETDEEDS_RULES`, `STREETDEEDS_ASSETS` with the asset named `streetdeeds-space`, CSS scope `[data-game="streetdeeds"]`, layout class `streetdeeds-layout`. `LEGACY_IDS` gains `monopoly: { id: 'streetdeeds', keepsSaves: true }`.

- [ ] **Step 1: Write the failing test.** `games/legacyIds.test.ts`, `monopoly is now Street Deeds and its saves still fit`: `currentId('monopoly') === 'streetdeeds'`, `keepsSaves('monopoly') === true`.

- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts`. Expected: FAIL.

- [ ] **Step 3: Move and rename.** `git mv games/monopoly games/streetdeeds`, `git mv e2e/monopoly.spec.ts e2e/streetdeeds.spec.ts`, `git mv games/streetdeeds/client/monopoly.scss games/streetdeeds/client/streetdeeds.scss`. Then replace the id and every identifier built from it (the names in Interfaces, `../games/monopoly/` imports in the e2e spec, `seat('monopoly', ...)` and the `monopoly:` key in `e2e/handOnly.spec.ts`, the `[data-game="monopoly"]` scope, `monopoly-layout`, `svgUrl('monopoly-space', ...)`). Set `name: 'Street Deeds'` in `info.ts`. Move the entry in `GAMES` and `GAME_INFOS` to its alphabetical place by name (after the last name before "Street Deeds", for example after "Spite and Malice" or "Splendor", whichever wave 1 left there). Update the lists: `shared/categories.test.ts` `strategy`, `games/secretState.test.ts`, `src/components/gameFilters.test.ts` (the seven-player list: replace 'Monopoly' with 'Street Deeds' in its sorted place; leave the count assertions alone). `e2e/landing.spec.ts` is not edited (Task 12 records what it expects). Add the `LEGACY_IDS` entry. Fix the comment in `shared/svg/disc.ts`.

- [ ] **Step 4: Add the old-link e2e test** at the end of `e2e/streetdeeds.spec.ts`, `an old monopoly join link opens Street Deeds`: open `/join/monopoly/<fresh game ID>`, expect the join dialog to name "Street Deeds" and, after joining, the game view's `data-game` to be `streetdeeds`. Follow how `e2e/sharing.spec.ts` opens a join link.

- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, `npm run lint`. Expected: PASS, with the rules tests unchanged apart from import paths.

- [ ] **Step 6: Run** `E2E_PORT_BASE=8900 npx playwright test --workers=2 e2e/streetdeeds.spec.ts e2e/handOnly.spec.ts`. Expected: PASS, including the old-link test.

- [ ] **Step 7: Commit**: "Street Deeds: rename the Monopoly game, its id and folder".

---

### Task 8: Street Deeds original content and art

**Files:**
- Modify: `games/streetdeeds/board.ts`, `cards.ts`, `options.ts` (labels and help only), `types.ts` (comments), `svg.ts` (comment), `client/layout.ts` (`SHORT`), `client/Board.tsx`, `client/streetdeeds.scss`, `client/faq.ts`, `client/HistoryBoard.tsx` (comment), every other client file whose text names a space, deck or card, `README.md`, `info.ts` (`description`), `shared/svg/gameIcons.ts` (`streetdeeds` icon)
- Test: `games/streetdeeds/board.test.ts`, `rules.test.ts`, `client/describeMove.test.ts`, `manager.test.ts` (names only), `e2e/streetdeeds.spec.ts`, `e2e/handOnly.spec.ts` (comments naming spaces)

**Interfaces:**
- Consumes: the Task 7 names. Keeps every export of `board.ts` and `cards.ts` (`BOARD`, `CHANCE`, `COMMUNITY_CHEST`, `DECKS`, `DECK_NAMES`, constants) with the same values apart from names and text. `DECK_NAMES` becomes `{ chance: 'Fortune', chest: 'Town Fund' }`.

- [ ] **Step 1: Write the characterization test before any name changes.** In `board.test.ts`, `every space and card keeps its rules when the names change`: define `const rulesOf = (space: Space) => JSON.stringify({ ...space, name: undefined })` (JSON drops the `undefined` name, and no variable goes unused), generate the 40 strings once from the current code with a scratch `node` script, and do the same for `CHANCE.map(c => JSON.stringify(c.effect))` and `COMMUNITY_CHEST.map(c => JSON.stringify(c.effect))`; paste the three arrays into the test as `deepEqual` expectations against the same expressions. Run `node --test games/streetdeeds/board.test.ts`: PASS now, and it must still pass after Step 3.

- [ ] **Step 2: Write the failing name tests** in `board.test.ts`:
  - `the board is a fictional city`: `BOARD[0].name === 'Start'`, `BOARD[20].name === 'Town Square'`, `BOARD[10].name === 'Jail'`, `BOARD[30].name === 'Go to Jail'`; no space name is one of the 28 property names, 4 railroad names, 2 utility names or the corner and deck names of the current `board.ts` (copy that list of old names into the test as `OLD_NAMES`, which is test data, not shown to players); all 40 names except the repeated card spaces are unique.
  - `the decks are Fortune and Town Fund`: `DECK_NAMES` deep-equals `{ chance: 'Fortune', chest: 'Town Fund' }`; card spaces are named 'Fortune' (deck `chance`) and 'Town Fund' (deck `chest`); no card text contains any `OLD_NAMES` entry, "Chance", "Community Chest", "Get Out of Jail Free", "GO" as a word, "Boardwalk" or "Railroad".
  - `every card text names the space it moves to`: for each card with an `advance` effect other than to 0, the text includes `BOARD[to].name`; an `advance` to 0 names "Start".
  Run `node --test games/streetdeeds/board.test.ts`: the name tests FAIL, the characterization test passes.

- [ ] **Step 3: Write the content.** In `board.ts`: 22 street names, 4 station names and 2 utility names, invented for one fictional city (my call: name the city in the header comment and the README), each fitting the board space through `SHORT` in `client/layout.ts`; corners as decided above; taxes keep "Income Tax" and "Luxury Tax". Replace the header comment (no "US board", no edition). In `cards.ts`: 16 Fortune and 16 Town Fund cards in the same order with the same effects, each text freshly written for the city; the jail card reads as a "Jail pass" ("Jail pass. Keep this card until you need it, or trade it"). In `options.ts`: the labels say "Town Square jackpot" and "$400 for landing exactly on Start" with matching help; ids unchanged.

- [ ] **Step 4: Update text everywhere players see it.** `client/Board.tsx` (the deck counts line reads "Cards left: Fortune N, Town Fund N"; the board title shows "Street Deeds"), `client/faq.ts`, `info.ts` `description` (new wording, same meaning), and `README.md`: the title "Street Deeds", one opening line "Plays like [Monopoly](https://en.wikipedia.org/wiki/Monopoly_(game)), with its own city, cards and art." (the only line with the old name), every rule bullet with the new names, "Differences from Wikipedia" opening with "These follow the rules in the Wikipedia article linked above and, where it is silent, the publisher's current rules." Replace literal old names in `rules.test.ts`, `client/describeMove.test.ts`, `manager.test.ts`, `e2e/streetdeeds.spec.ts` and `e2e/handOnly.spec.ts` comments with the new names at the same indices (for example "rent for Boardwalk" becomes "rent for <BOARD[39].name>", written as the literal new name).

- [ ] **Step 5: Art check.** In `client/streetdeeds.scss`, the board title is no longer a red banner turned -12 degrees (the commercial logo's look): draw it in the game's own palette, level, in the page's heading font. Keep the space icons in `svg.ts` (plain line icons), the tokens and the deed cards' layout unless they copy the commercial deed card's look (a colored header band with "TITLE DEED" in capitals): if so, retitle it "Deed" and use the project's card style. Give `streetdeeds` in `shared/svg/gameIcons.ts` a new drawing (my call: a line-icon house with a key), not the old "money bag" shape.

- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, `npm run lint`, `E2E_PORT_BASE=8900 npx playwright test --workers=2 e2e/streetdeeds.spec.ts e2e/handOnly.spec.ts`. Expected: PASS, the characterization test unchanged.

- [ ] **Step 7: Commit**: "Street Deeds: an original city, Fortune and Town Fund cards, and its own art".

---

### Task 9: Rename Ticket to Ride to Rail Routes (ids, folders, registration)

**Files:**
- Move: `games/tickettoride` to `games/railroutes`; `e2e/tickettoride.spec.ts` to `e2e/railroutes.spec.ts`; `games/railroutes/client/tickettoride.scss` to `railroutes.scss`
- Modify: `games/railroutes/info.ts`, `index.ts`, `svg.ts`, `client/index.ts`, `client/railroutes.scss`, `client/MapBoard.tsx`, any file using the old id; `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, `shared/categories.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`, `e2e/handOnly.spec.ts`, `games/legacyIds.ts`, `shared/svg/cardArt.ts` (comment)
- Test: `games/legacyIds.test.ts`, `e2e/railroutes.spec.ts`

**Interfaces:**
- Produces: `railroutesInfo` (`id: 'railroutes'`, `name: 'Rail Routes'`), `railroutes`, `railroutesClient`, `RAILROUTES_ASSETS` with the asset `railroutes-land`, scope `[data-game="railroutes"]`. `LEGACY_IDS` gains `tickettoride: { id: 'railroutes', keepsSaves: false }` (Task 10 changes the map).

- [ ] **Step 1: Write the failing test.** `games/legacyIds.test.ts`, `tickettoride is now Rail Routes and its saves are refused`: `currentId('tickettoride') === 'railroutes'`, `keepsSaves('tickettoride') === false`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts`. Expected: FAIL.
- [ ] **Step 3: Move and rename** as in Task 7 Step 3, with the names above; set `name: 'Rail Routes'`; move the `GAMES` and `GAME_INFOS` entries to the "Rail Routes" alphabetical place; update `shared/categories.test.ts` (`strategy`), `games/secretState.test.ts`, the `privateSeatView.test.ts` key and the `handOnly.spec.ts` key; add the `LEGACY_IDS` entry; fix the `shared/svg/cardArt.ts` comment.
- [ ] **Step 4: Add the old-link e2e test** at the end of `e2e/railroutes.spec.ts`, `an old tickettoride join link opens Rail Routes`, as in Task 7 Step 4.
- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, `npm run lint`. Expected: PASS.
- [ ] **Step 6: Run** `E2E_PORT_BASE=8900 npx playwright test --workers=2 e2e/railroutes.spec.ts e2e/handOnly.spec.ts`. Expected: PASS.
- [ ] **Step 7: Commit**: "Rail Routes: rename the Ticket to Ride game, its id and folder".

---

### Task 10: Rail Routes original map, tickets and art

**Files:**
- Modify: `games/railroutes/map.ts`, `svg.ts`, `client/railroutes.scss` (land classes and colors), `client/faq.ts`, `README.md`, `info.ts` (`description`), `shared/svg/gameIcons.ts` (`railroutes` icon)
- Test: `games/railroutes/map.test.ts`, `svg.test.ts`, `rules.test.ts`, `client/describeMove.test.ts`, `manager.test.ts`, `testing.ts` if it names cities, `e2e/railroutes.spec.ts`

**Interfaces:**
- Consumes: Task 9 names. Keeps every export of `map.ts` (`MAP_LEFT`, `MAP_WIDTH`, `MAP_HEIGHT`, `CITIES`, `ROUTES`, `TICKETS`, `ROUTE_POINTS`, `routeName`) and the `PairSpec` and ticket spec shapes; `MAP_LEFT`, `MAP_WIDTH` and `MAP_HEIGHT` may change if the drawing needs it.
- Produces: `export function shortestTrack(a: number, b: number): number` in `map.ts`: the fewest train spaces on any path of routes from city `a` to `b` (Dijkstra or Floyd over `ROUTES`, lengths as weights).

- [ ] **Step 1: Write the failing map tests** in `map.test.ts`, keeping every current assertion except the city-name check in the tickets test, and adding:
  - `the same totals as the published map`: 36 cities with unique names, 100 tracks over 78 city pairs, 22 double routes, 309 train spaces, lengths 1 to 6 spread `[9, 36, 20, 16, 10, 9]`, 508 route points, routes by color `{ gray: 44, pink: 7, white: 7, blue: 7, yellow: 7, orange: 7, black: 7, red: 7, green: 7 }`, train spaces by color `{ gray: 93 }` and 27 for each of the eight colors (these are the current map's numbers; the existing tests pin most of them).
  - `tickets keep the published point spread`: `TICKETS.map(t => t.points).sort((a, b) => a - b)` deep-equals `[4, 5, 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 10, 10, 11, 11, 11, 11, 12, 12, 13, 13, 13, 16, 17, 17, 20, 20, 21, 22]`; 30 distinct city pairs.
  - `every ticket is worth its shortest track` (the recomputed scoring): for every ticket, `ticket.points === shortestTrack(ticket.a, ticket.b)`.
  - `a fictional continent`: no city name is one of the 36 current city names (copy them into the test as `OLD_CITIES`).
  - In `svg.test.ts`: the land is the sea plus one or more `land` polygons on the map view box, with no `canada` or `usa` class.
  Run `node --test games/railroutes/map.test.ts games/railroutes/svg.test.ts`: FAIL (old names, no `shortestTrack`).

- [ ] **Step 2: Draw the map.** In `map.ts`: invent a continent and 36 city names (my call: name it in the header comment and README), place cities on the drawing so each route's drawn length suits its train count, then write a new `PAIRS` network over them (not the published network relabeled: lay out the cities first and join near neighbors) that meets the totals, and 30 tickets whose points equal `shortestTrack`, chosen to give exactly the point spread above. Replace the header comment (no USA, no published sources). A scratch script in the scratchpad that prints the totals and each ticket's `shortestTrack` helps; it is not committed. In `svg.ts`: a new land outline (or outlines) for the fictional continent, classes `land` and optional named regions of your own, and the matching `--land-*` colors in `railroutes.scss` for light and dark.

- [ ] **Step 3: Run** the map and svg tests. Expected: PASS.

- [ ] **Step 4: Update tests that name cities.** In `rules.test.ts`, `client/describeMove.test.ts`, `manager.test.ts`, `testing.ts` and `e2e/railroutes.spec.ts`, replace each named route with a new-map route of the same length and color (for example "Denver to Omaha, 4 pink" becomes a 4-long pink route), each loop or fork with a new-map loop or fork of the same shape, and each named ticket with a new ticket whose cities those routes join. Keep the assertions; change only names and the numbers that follow from the new map (ticket points, longest path), each recomputed by hand from the map and noted in a one-line comment.

- [ ] **Step 5: Text and art.** `README.md`: title "Rail Routes"; one opening line "Plays like [Ticket to Ride](https://en.wikipedia.org/wiki/Ticket_to_Ride_(board_game)), on its own continent." (the only line with the old name); "Components" names the continent, not the USA; "Differences from Wikipedia" opens with "These follow the rules in the Wikipedia article linked above and, where it is silent, the publisher's rules for the first edition.", and gains a bullet "**Map and tickets.** An original continent with the published game's totals; each ticket is worth the fewest train spaces between its cities." `client/faq.ts` and `info.ts` `description` ("across the USA" goes). Check the train pieces, cards and ticket drawings in `client/` and `shared/svg/cardArt.ts` for the commercial look (the train car silhouette is generic; a ticket that copies the published ticket layout is not): redraw any that copy it. Give `railroutes` in `gameIcons.ts` a new drawing (my call: two rails crossing a city dot), not the current train front.

- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, `npm run lint`, `E2E_PORT_BASE=8900 npx playwright test --workers=2 e2e/railroutes.spec.ts e2e/handOnly.spec.ts`. Expected: PASS.

- [ ] **Step 7: Commit**: "Rail Routes: an original continent, network and tickets, and its own art".

---

### Task 11: Browser check

**Files:** none (fixes found here go back to the task that owns the file, with their own commit).

- [ ] **Step 1: Start the site with the test hooks.** `npm run build` then `E2E=1 PORT=3309 DATABASE_PATH=<scratchpad>/check.sqlite node server/server.ts`, and open `http://localhost:3309` in Chrome (load the Chrome tools in one ToolSearch call, per the claude-in-chrome skill).
- [ ] **Step 2: Street Deeds.** Landing card shows the new name, icon and description. Two tabs, Alice and Bob: play several turns (buy, decline into an auction, draw a Fortune and a Town Fund card, build after setting a whole group through `POST /api/e2e/state/streetdeeds/<id>`), then end the game by bankruptcy. Check the board title, every space label fits, card texts, History, and a downloaded game file opened through Open a saved game.
- [ ] **Step 3: Rail Routes.** Two tabs: draw cards, claim routes, keep tickets; force the last round through the state hook (`trains: 2` for one seat) and finish. Check the map drawing, city labels (no overlaps), tickets with points, History and a downloaded game file.
- [ ] **Step 4: Old ids.** Open `http://localhost:3309/join/monopoly/check1` and `/join/tickettoride/check2`: each opens the join dialog of the renamed game.
- [ ] **Step 5: Widths.** Laptop size (the normal window) and phone width through same-origin iframes of 390 px and 320 px (memory note: the Chrome tool cannot resize the window; set `data-theme` on each iframe's `documentElement` for dark mode). Both games, light and dark: no overlap, blank rows or misplaced controls.

---

### Task 12: Final checks and PR

**Files:** none new.

- [ ] **Step 1: Unit, type and lint.** `npm test`, `npm run typecheck`, `npm run lint`. Expected: all pass.
- [ ] **Step 2: The chunk's e2e specs.** `E2E_PORT_BASE=8900 npx playwright test --workers=2 e2e/streetdeeds.spec.ts e2e/railroutes.spec.ts e2e/handOnly.spec.ts`. Expected: all pass. Then run `E2E_PORT_BASE=8900 npx playwright test --workers=2 e2e/landing.spec.ts` without editing it, and record in the PR body each failing test with the old name it expects (the seven-player filter list names Monopoly), for the coordinator.
- [ ] **Step 3: Old names in player-visible text.**

```bash
git grep -n -I -E "Monopoly|monopoly|MONOPOLY|Ticket to Ride|tickettoride|TICKETTORIDE|Boardwalk|Community Chest|Free Parking|Get Out of Jail" -- games src server e2e shared ':!games/legacyIds.ts' ':!games/legacyIds.test.ts' ':!games/streetdeeds/board.test.ts' ':!games/railroutes/map.test.ts'
```

Expected: only the opening line of `games/streetdeeds/README.md` and of `games/railroutes/README.md`, and Catan's own "Monopoly" development card (`games/catan/`, `e2e/catan.spec.ts`), which belongs to chunk 11 and is listed in the PR body. Anything else is fixed in its task.
- [ ] **Step 4: Em-dash check.** `git diff origin/party-games-and-polish -U0 | LC_ALL=C.UTF-8 grep -nP '^\+.*\x{2014}'` prints nothing.
- [ ] **Step 5: Push and open the PR.**

```bash
git push -u origin generic-streetdeeds-railroutes
gh pr create --base party-games-and-polish --title "Street Deeds and Rail Routes: generic names, ids and original content" --body-file <file>
```

The body lists both renames with their legacy entries, the content decisions (city, continent, corner names, Jail pass, Fortune and Town Fund), the art changes, the browser check results, the grep result, and that the top-level README, landing counts and `docs/architecture.md` are left for the coordinator. It ends with the PR footer from Global Constraints.
