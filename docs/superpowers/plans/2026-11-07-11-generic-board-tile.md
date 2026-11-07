# Generic Names: Board and Tile Games (Chunk 11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename ten games (Azul, Carcassonne, Catan, Connect Four, Jenga, Parchisi, Quoridor, Rummikub, Scrabble, Splendor) to the generic names and ids in the spec, with the same rules, while old ids, links, files, settings and stats keep working through `games/legacyIds.ts`.

**Architecture:** Each game is one task: tests switch to the new id first, then `git mv` moves the folder and e2e spec, and the id, symbols, asset names, CSS selectors, wording, icon and art follow. The legacy id plumbing (chunk 9's first PR, already merged) does the old-data work; this chunk only adds one map entry per game and a test that checks them.

**Tech Stack:** TypeScript, React 19, SCSS, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Generic names (wave 2)" (What every renamed game gets, New names), "Rules for every agent" and "Order of work" step 4 and 5. Branch `generic-board-tile` from `party-games-and-polish`, after wave 1 (chunks 1 to 8) and chunk 9's legacy id PR are merged. Server `PORT=3211`, `E2E_PORT_BASE=9100`.

## Global Constraints

- **Names and ids, exactly:** Azul to **Palace Walls** (`palacewalls`), Carcassonne to **Roads and Fields** (`roadsandfields`), Catan to **Hex Island** (`hexisland`), Connect Four to **Four in a Row** (`fourinarow`), Jenga to **Block Tower** (`blocktower`), Parchisi to **Pachisi** (`pachisi`), Quoridor to **Pawns and Walls** (`pawnsandwalls`), Rummikub to **Rummy Tiles** (`rummytiles`), Scrabble to **Letter Grid** (`lettergrid`), Splendor to **Jewel Guild** (`jewelguild`).
- **Same rules.** Rules, house rule ids and values, options, state shape and move shapes are unchanged. Rules and manager tests change only in ids, names and player-visible text.
- **Old name appears nowhere** in `games/`, `src/`, `server/`, `shared/`, `e2e/` or `vite.config.ts`, except these allowed hits:
  - `games/legacyIds.ts` and `games/legacyIds.test.ts`;
  - one sentence in the opening paragraph of the game's own README: `It plays like <Old name>.` (the spec allows it once, as descriptive use);
  - Wikipedia article titles and URLs where the README's "Differences from Wikipedia" section or a rules source comment cites the article (the spec keeps those pointing at the article);
  - Catan's "Monopoly" development card (a common word; the spec keeps it);
  - `e2e/landing.spec.ts` (the coordinator updates it after wave 2);
  - the folders chunks 9 and 10 own (`games/monopoly`, `games/tickettoride`, `games/thecrew`, `games/risk`, or their new names): list any mention in the PR body instead of editing it;
  - content lists written by wave 1 (prompts, words, definitions) where the old name is a common word ("splendor", "scrabble"): list them in the PR body, do not edit.
- **Do not edit** the top-level `README.md` game list or count, `e2e/landing.spec.ts`, or `docs/architecture.md`. Do not edit `games/legacyIds.ts` beyond adding entries, and `games/legacyIds.test.ts` beyond the one test this plan adds. `e2e/fixtures.ts` needs no change (it has no game ids); if it turns out to, stop and report.
- **Shared registration lines** (`games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, the test lists of every game): replace the old token with the new one **in place**. Do not re-sort. `games/infos.test.ts` checks that `GAME_INFOS` and `GAMES` keep the same order, and in-place edits keep the merge with chunks 9, 10 and 12 to one-token conflicts.
- **Legacy ids:** chunk 9 owns `games/legacyIds.ts`. This plan assumes it exports `LEGACY_IDS: Readonly<Record<string, string>>` (old id to new id) with tests in `games/legacyIds.test.ts`. If chunk 9 merged another export or file name, use what it merged; the entry (old id key, new id value) is fixed by the spec.
- **No em-dashes** in READMEs, FAQs, comments, test titles, commit messages or the PR body. No new npm dependency.
- **Commits** end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
- **Ports:** this chunk's server runs on `PORT=3211` and its e2e runs with `E2E_PORT_BASE=9100` (never 6000, which Chrome refuses). Chunk 12 uses 3212 and 6610.

### Rename recipe (every game task follows it; the task gives the values)

`<old>` and `<new>` are the ids, `<Old>` and `<New>` the names, `<OLD>` and `<NEW>` the upper-case ids.

- **R1 Tests first.** Edit the test files the task lists to say `<new>` (and `<New>` where they match on the name). In `games/legacyIds.test.ts`, add `<old>: '<new>'` to the `CHUNK_11` map (Task 2 creates the test). If a test to edit lives in the game's own folder, do R2 first; the test must still fail until R3 and R4 are done.
- **R2 Move.** `git mv games/<old> games/<new>`, `git mv e2e/<old>.spec.ts e2e/<new>.spec.ts`, and `git mv games/<new>/client/<old>.scss games/<new>/client/<new>.scss`. Then `git grep -n "games/<old>/\|/<old>/\|'\./<old>"` and fix every import path it finds (wave 1 games may import from this folder).
- **R3 Ids and symbols.** In the moved folder, its spec and the files the task lists: the `id` in `info.ts` and `client/index.ts`; exports `<old>Info` to `<new>Info`, `<old>` (definition) to `<new>`, `<old>Client` to `<new>Client`, `<OLD>_ASSETS` to `<NEW>_ASSETS`; every other identifier containing the old id or name (for example `jengaStandings` to `blocktowerStandings`); SVG asset names `<old>-*` to `<new>-*` (the `/dev/svgs` gallery themes an asset by the part of its name before the first `-`, so it must be the id) and their `svgUrl` calls; CSS classes, DOM ids and custom properties `<old>-*` to `<new>-*`, and `[data-game="<old>"]` to `[data-game="<new>"]` in SCSS and TSX. Registration, in place: `games/registry.ts` (import and `GAMES`), `games/infos.ts` (import and `GAME_INFOS`), `src/clientGames.ts` (`CLIENT_LOADERS` key, path and export), `shared/svg/gameIcons.ts` (`GAME_ICONS` key), `server/assets/registry.ts` (import and spread) when the game draws server SVGs.
- **R4 Wording.** `info.ts` `name` is `<New>`; `description` loses any old name. README: the H1 is `# <New>`, the opening paragraph gains `It plays like <Old>.` as its last sentence, and every other mention of the game says `<New>`; "Differences from Wikipedia" keeps citing the same article. FAQ, screen hints, `gameStatus` strings, `describeMove`, aria labels, SCSS and code comments, test titles and the e2e spec's `describe` titles and text assertions say `<New>`.
- **R5 Icon and art.** As the task says. Every art finding goes in the PR body: what changed, or "checked, no change" with the reason.
- **R6 Legacy entry.** Add `<old>: '<new>'` to `LEGACY_IDS` in `games/legacyIds.ts`.
- **R7 Verify.** All of these pass:
  - `node --test games/<new>/ games/legacyIds.test.ts games/infos.test.ts games/secretState.test.ts games/privateSeatView.test.ts games/standings.test.ts shared/categories.test.ts` plus the task's other unit test files;
  - `npm run typecheck`;
  - `E2E_PORT_BASE=9100 npx playwright test --workers=2 e2e/<new>.spec.ts` plus the task's platform specs;
  - `git grep -n -i -P "<pattern>" -- games src server shared e2e vite.config.ts` shows only the allowed hits above.
- **R8 Commit** `Rename <Old> to <New> (<new>)` with the trailers, adding every moved and edited file.

## Review Focus

1. **A game paused or downloaded before the rename** (gameType `connectfour`, `scrabble`) must load and play on as Four in a Row and Letter Grid. Task 1 makes those files on the unrenamed build; Task 12 resumes and opens them.
2. **An old join or share link** (`/join/catan/<id>`) must land in the Hex Island join dialog, and an old remembered house rule must still be chosen. Task 1 sets the remembered rule and Task 12 checks both; the `CHUNK_11` test (Task 2) pins every entry to a registered id.
3. **Stats recorded under an old id** (`connectfour` games finished in Task 1) must show under Four in a Row, not as an unknown game. Task 12 checks the Stats page after the server restarts.
4. **The `/dev/svgs` gallery and server SVG routes** must serve renamed assets (`palacewalls-tile`, `roadsandfields-tile`, `hexisland-motif`, `pawnsandwalls-wall`) themed by their game. Task 12 opens `/dev/svgs`; each game task's e2e run loads the art.
5. **A wave 1 game that imports from a renamed folder** (a party game reusing a Jenga or Splendor helper) must still build. R2's `git grep` for import paths and `npm run typecheck` in every task pin it.

---

### Task 1: Worktree, port and old-data samples

**Files:** none committed.

- [ ] **Step 1: Check the starting point.** In the main checkout: `git checkout party-games-and-polish && git pull`. Confirm wave 1 and the legacy PR are in: `ls games/legacyIds.ts games/charades games/steadyhand` lists all three, and `git log --oneline -20` shows the chunk 9 legacy id merge. If either is missing, stop and report.
- [ ] **Step 2: Create the worktree.** Following superpowers:using-git-worktrees: `git worktree add ../mtg-generic-board-tile -b generic-board-tile party-games-and-polish`, then `cd ../mtg-generic-board-tile && npm ci`. If `node` is not found, `export PATH="/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH"`.
- [ ] **Step 3: Check the ports.** `netstat -ano | grep -E ':(3211|910[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3211 or 9100, and say so in the PR.
- [ ] **Step 4: Baseline.** `npm test`, `npm run typecheck` and `npm run lint` pass on the untouched branch. Note any failure for the PR body (the spec names `e2e/houseRules.spec.ts` tests at lines 14 and 51 as already failing on `master`).
- [ ] **Step 5: Make old-data samples on the unrenamed build.** `npx vite build && PORT=3211 node server/server.ts` (in the background). In Chrome, at `http://localhost:3211`:
  - Connect Four game `old-c4`, Alice and Bob in two tabs: play to a win, then Rematch and drop two discs, then Pause; both agree; save both pause files to the scratchpad as `old-c4-Alice-paused.json` and `old-c4-Bob-paused.json`.
  - Scrabble game `old-sc`, Alice and Bob: play one word, open History and download the game file to the scratchpad as `old-sc.json`.
  - Catan: as host, change one house rule from its standard value and start game `old-ca` (the site remembers the host's choice); note which rule and value.
  - Stop the server. Keep the worktree's `data/` folder: its stats database now holds a finished `connectfour` game.

### Task 2: Azul to Palace Walls

**Files:**
- Move: `games/azul/` to `games/palacewalls/`, `e2e/azul.spec.ts` to `e2e/palacewalls.spec.ts`
- Modify: `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts` (`AZUL_ASSETS`), `games/legacyIds.ts`, `e2e/handOnly.spec.ts` (`azul` entry), comments in `src/components/RoundSummaryDialog.tsx`, `server/games.test.ts` (the comment "Azul, Uno and Phase 10": change Azul only) and `src/App.scss` (only if a comment still names Azul after wave 1)
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `shared/categories.test.ts` (`tile`)

**Interfaces:**
- Produces: id `palacewalls`, `palacewallsInfo`, `palacewalls`, `palacewallsClient`, `PALACEWALLS_ASSETS`, asset `palacewalls-tile`. The `CHUNK_11` test that later tasks extend.

- [ ] **Step 1: Write the failing test.** Add to `games/legacyIds.test.ts`:
  ```ts
  // Chunk 11's renames: every old id points at a registered game, and no old id is still registered
  const CHUNK_11: Record<string, string> = { azul: 'palacewalls' };
  test('chunk 11 old ids map to their renamed games', () => {
    for (const [old, id] of Object.entries(CHUNK_11)) {
      assert.equal(LEGACY_IDS[old], id, old);
      assert.ok(GAMES.some(game => game.info.id === id), id);
      assert.ok(!GAMES.some(game => game.info.id === old), old);
    }
  });
  ```
  (Import `GAMES` from `./registry.ts` if the file does not already.) Then R1: `'azul'` to `'palacewalls'` in `games/secretState.test.ts` and `shared/categories.test.ts`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/secretState.test.ts shared/categories.test.ts`. Expected: FAIL (`LEGACY_IDS.azul` undefined; `palacewalls` not registered).
- [ ] **Step 3:** R2, R3 and R6 for `azul` to `palacewalls`.
- [ ] **Step 4:** R4. The SCSS header comment ("Azul's blue theme") names Palace Walls.
- [ ] **Step 5: Icon and art.** New icon (my call): a 3 by 3 grid of square tiles with the centre one filled, drawn with the existing `lineIcon`, `el` and `solid` helpers. Art check: the tiles are already flat colors with this project's own marks; check the board and wall layout against the commercial game's printed board and record the finding.
- [ ] **Step 6:** R7 with pattern `azul`, platform spec `e2e/handOnly.spec.ts`.
- [ ] **Step 7:** R8.

### Task 3: Carcassonne to Roads and Fields

**Files:**
- Move: `games/carcassonne/` to `games/roadsandfields/`, `e2e/carcassonne.spec.ts` to `e2e/roadsandfields.spec.ts`
- Modify: registration files, `server/assets/registry.ts` (`CARCASSONNE_ASSETS`), `games/legacyIds.ts`, `e2e/handOnly.spec.ts`
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `shared/categories.test.ts` (`tile`), `src/components/gameFilters.test.ts`

**Interfaces:**
- Consumes: the `CHUNK_11` map (Task 2).
- Produces: id `roadsandfields`, `roadsandfieldsInfo`, `roadsandfields`, `roadsandfieldsClient`, `ROADSANDFIELDS_ASSETS`, assets `roadsandfields-tile` and `roadsandfields-meeple`.

- [ ] **Step 1: Write the failing test.** R1, and in `src/components/gameFilters.test.ts` rename the fake: `const roadsandfields = fake('Roads and Fields', 'tile', 2, 5, 'Place tiles and claim meeples');`, use it where `carcassonne` was, and re-sort the expected name lists: `names([])` is `['Connect Four', 'Roads and Fields', 'UNO']`, `names(['card', 'tile'])` is `['Roads and Fields', 'UNO']`, and `byName[0]` is `['Connect Four', 'Roads and Fields', 'UNO']` (Task 5 and chunk 12 change the other two fakes).
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts shared/categories.test.ts src/components/gameFilters.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4. "Meeple" is a generic word and stays.
- [ ] **Step 5: Icon and art.** New icon (my call): a square tile with a road curving from one edge to another, replacing the castle wall. Art check: tile art (`roadsandfields-tile` in `svg.ts`, `client/TileArt.tsx`) and the meeple shape against the commercial tiles; record the finding.
- [ ] **Step 6:** R7 with pattern `carcassonne`, platform spec `e2e/handOnly.spec.ts`, plus `node --test src/components/gameFilters.test.ts`.
- [ ] **Step 7:** R8.

### Task 4: Catan to Hex Island

**Files:**
- Move: `games/catan/` to `games/hexisland/`, `e2e/catan.spec.ts` to `e2e/hexisland.spec.ts`
- Modify: registration files, `server/assets/registry.ts` (`CATAN_ASSETS`), `games/legacyIds.ts`, `e2e/handOnly.spec.ts` (the `catan` entry and the test "Catan trade offers and Monopoly auctions...": change "Catan" and `seat('catan', ...)` only), `e2e/lazyLoading.spec.ts` (first test), `e2e/rules.spec.ts` (the markdown sample's `[Catan](../catan/README.md)` link and its expected `href`), comment in `shared/passAndPlay.ts`
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts` (`catan` key), `shared/categories.test.ts` (`strategy`), `shared/houseRules.test.ts` (const `CATAN` to `HEX_ISLAND`)

**Interfaces:**
- Produces: id `hexisland`, `hexislandInfo`, `hexisland`, `hexislandClient`, `HEXISLAND_ASSETS`, assets `hexisland-motif` and `hexisland-piece`.

- [ ] **Step 1: Write the failing test.** R1 in the listed test files. `e2e/lazyLoading.spec.ts` first test: title "...and opening Hex Island downloads Hex Island", `url.includes('hexisland')`, `openDialog(page, 'Hex Island')`, regexes `/\/hexisland-.*\.js$/` and `/\/hexisland-.*\.css$/` (Vite names the chunk after the folder). `e2e/rules.spec.ts`: link text `Hex Island`, target `../hexisland/README.md`, expected href ending `games/hexisland/README.md`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/privateSeatView.test.ts shared/houseRules.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4. Catan's "Monopoly" development card keeps its name (spec). Check `editions.ts` and the five and six player text for the old name.
- [ ] **Step 5: Icon and art.** Icon: keep the hexagon with a centre circle (already generic). Art check: terrain motifs and pieces in `svg.ts`, and the board frame, against the commercial art; record the finding.
- [ ] **Step 6:** R7 with pattern `catan`, platform specs `e2e/handOnly.spec.ts e2e/lazyLoading.spec.ts e2e/rules.spec.ts`, plus `node --test shared/houseRules.test.ts`.
- [ ] **Step 7:** R8.

### Task 5: Connect Four to Four in a Row

**Files:**
- Move: `games/connectfour/` to `games/fourinarow/`, `e2e/connectfour.spec.ts` to `e2e/fourinarow.spec.ts`
- Modify: registration files (no server assets), `games/legacyIds.ts`, comment in `shared/svg/disc.ts`, and every platform spec that seats or names Connect Four: `e2e/alerts.spec.ts`, `e2e/gameOver.spec.ts`, `e2e/handOnly.spec.ts`, `e2e/hide.spec.ts`, `e2e/history.spec.ts`, `e2e/houseRules.spec.ts`, `e2e/lazyLoading.spec.ts`, `e2e/openGames.spec.ts`, `e2e/reactions.spec.ts`, `e2e/rematch.spec.ts`, `e2e/settings.spec.ts`, `e2e/sharing.spec.ts`, `e2e/spectators.spec.ts`, `e2e/stats.spec.ts`, `e2e/tableScreen.spec.ts`, `e2e/turnTimer.spec.ts`
- Test: `games/legacyIds.test.ts`, `games/standings.test.ts` (`FALLBACK_GAMES`), `shared/categories.test.ts` (`classic`), `src/stats/aggregate.test.ts`, `src/components/gameFilters.test.ts`

**Interfaces:**
- Produces: id `fourinarow`, `fourinarowInfo`, `fourinarow`, `fourinarowClient`.

- [ ] **Step 1: Write the failing test.** R1 in the listed unit tests. `gameFilters.test.ts`: `const fourinarow = fake('Four in a Row', 'classic', 2, 2, 'Drop discs');`, the search test uses `search: 'row'` (true for Four in a Row, false for Roads and Fields), and the sorted lists become `['Four in a Row', 'Roads and Fields', 'UNO']` and `['Roads and Fields', 'UNO']`. In the platform specs: `'connectfour'` to `'fourinarow'` (seat, watch, join, URLs, `/join/fourinarow/...`, `/api/history/fourinarow/...`, `[data-game="fourinarow"]`, `/assets/fourinarow-`), `Connect Four` to `Four in a Row` in titles, dialog names and expected text (`'Four in a Row · 1 of 2 players'`, `'Join Four in a Row'`, `Back to Four in a Row (...)`), and the `lazyLoading` import from `../games/fourinarow/index.ts`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/standings.test.ts src/stats/aggregate.test.ts src/components/gameFilters.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4.
- [ ] **Step 5: Icon and art.** Icon: keep the grid of discs. Art check: the frame and disc colors in `fourinarow.scss` and `shared/svg/disc.ts` against the commercial blue frame with red and yellow discs; if both match, change the frame color in this game's SCSS to one of the project's theme colors and keep the discs; record the finding.
- [ ] **Step 6:** R7 with pattern `connect ?four`, platform specs: every e2e file in this task's Files list, plus the unit tests above. Pre-existing `e2e/houseRules.spec.ts` failures from Task 1 Step 4 stay out of scope.
- [ ] **Step 7:** R8.

### Task 6: Jenga to Block Tower

**Files:**
- Move: `games/jenga/` to `games/blocktower/`, `e2e/jenga.spec.ts` to `e2e/blocktower.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts` (`jenga` entry and its `.jenga-*` selectors), `e2e/lazyLoading.spec.ts` (second test), comment in `vite.config.ts`
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `shared/categories.test.ts` (`party`), `src/components/gameFilters.test.ts` (seven-player list)

**Interfaces:**
- Produces: id `blocktower`, `blocktowerInfo`, `blocktower`, `loadBlocktowerClient()` (replaces `loadJengaClient()`, same signature `() => Promise<ClientGame>`), `blocktowerStandings`, classes `.blocktower-*`, custom properties `--blocktower-*`.

- [ ] **Step 1: Write the failing test.** R1. `gameFilters.test.ts` seven-player test: replace `'Jenga'` with `'Block Tower'` and keep the list sorted by name (`localeCompare`). `e2e/lazyLoading.spec.ts`: title "...never download Block Tower or its libraries", game id `lazy-blocktower`, regex `/blocktower|three|rapier/i`. `e2e/handOnly.spec.ts`: `.blocktower-status`, `.blocktower-undo`, `.blocktower-controls`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts src/components/gameFilters.test.ts shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3 (including `TowerView.tsx`'s `closest('[data-game="blocktower"]')` and its `--blocktower-*` reads), R6.
- [ ] **Step 4:** R4, including the `console.error` text in `rules.ts` and the `vite.config.ts` comment "Rapier (Block Tower)".
- [ ] **Step 5: Icon and art.** Icon: keep the stacked blocks. Art check: block colors and the wood texture in the 3D view; record the finding.
- [ ] **Step 6:** R7 with pattern `jenga`, platform specs `e2e/handOnly.spec.ts e2e/lazyLoading.spec.ts`.
- [ ] **Step 7:** R8.

### Task 7: Parchisi to Pachisi

**Files:**
- Move: `games/parchisi/` to `games/pachisi/`, `e2e/parchisi.spec.ts` to `e2e/pachisi.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts`, comments in `src/sound/sounds.ts` and `shared/svg/disc.ts`
- Test: `games/legacyIds.test.ts`, `shared/categories.test.ts` (`classic`), `src/sound/sounds.test.ts` (test title)

**Interfaces:**
- Produces: id `pachisi`, `pachisiInfo`, `pachisi`, `pachisiClient`.

- [ ] **Step 1: Write the failing test.** R1; `sounds.test.ts` title becomes "Pachisi's automatic roll after a move clicks and rattles".
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4. The README's opening sentence is `It plays like Parchisi.` Pachisi is the traditional game's own name, so the README may also say the game is the traditional Indian game.
- [ ] **Step 5: Icon and art.** Icon: keep the cross board. Art check: board colors and layout against the commercial board; record the finding.
- [ ] **Step 6:** R7 with pattern `parchisi`, platform spec `e2e/handOnly.spec.ts`, plus `node --test src/sound/sounds.test.ts`.
- [ ] **Step 7:** R8.

### Task 8: Quoridor to Pawns and Walls

**Files:**
- Move: `games/quoridor/` to `games/pawnsandwalls/`, `e2e/quoridor.spec.ts` to `e2e/pawnsandwalls.spec.ts`
- Modify: registration files, `server/assets/registry.ts` (`QUORIDOR_ASSETS`), `games/legacyIds.ts`, `e2e/handOnly.spec.ts`, comments in `src/components/PieceTray.tsx`, `shared/svg/disc.ts` and `src/App.scss` (only those still naming Quoridor after wave 1)
- Test: `games/legacyIds.test.ts`, `games/standings.test.ts` (`FALLBACK_GAMES`), `shared/categories.test.ts` (`classic`)

**Interfaces:**
- Produces: id `pawnsandwalls`, `pawnsandwallsInfo`, `pawnsandwalls`, `pawnsandwallsClient`, `PAWNSANDWALLS_ASSETS`, asset `pawnsandwalls-wall`.

- [ ] **Step 1: Write the failing test.** R1.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/standings.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4.
- [ ] **Step 5: Icon and art.** Icon: keep the pawn. Art check: board, pawn and wall art against the commercial wooden board; record the finding.
- [ ] **Step 6:** R7 with pattern `quoridor`, platform spec `e2e/handOnly.spec.ts`. (The word in `compose-launcher/README.md` names another project and is outside the grep paths.)
- [ ] **Step 7:** R8.

### Task 9: Rummikub to Rummy Tiles

**Files:**
- Move: `games/rummikub/` to `games/rummytiles/`, `e2e/rummikub.spec.ts` to `e2e/rummytiles.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts`, comment in `shared/svg/cardArt.ts` (Rummikub only)
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `shared/categories.test.ts` (`tile`)

**Interfaces:**
- Produces: id `rummytiles`, `rummytilesInfo`, `rummytiles`, `rummytilesClient`. The `rk-` class prefix does not contain the old name and stays.

- [ ] **Step 1: Write the failing test.** R1.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/secretState.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4.
- [ ] **Step 5: Icon and art.** Icon: keep the numbered tile. Art check: tile faces and the joker mark against the commercial tiles (the joker face is the most distinctive); record the finding.
- [ ] **Step 6:** R7 with pattern `rummikub`, platform spec `e2e/handOnly.spec.ts`.
- [ ] **Step 7:** R8.

### Task 10: Scrabble to Letter Grid

**Files:**
- Move: `games/scrabble/` to `games/lettergrid/`, `e2e/scrabble.spec.ts` to `e2e/lettergrid.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts` (entry and `seat('scrabble', ...)`), comments in `src/sound/timerWarning.ts` and `shared/svg/cardArt.ts` (Scrabble only)
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `shared/categories.test.ts` (`tile`)

**Interfaces:**
- Produces: id `lettergrid`, `lettergridInfo`, `lettergrid`, `lettergridClient`.

- [ ] **Step 1: Write the failing test.** R1.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/secretState.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4. Premium square labels and the word list stay.
- [ ] **Step 5: Icon and art.** Icon: keep the letter tile. Art (a change): the premium squares use the commercial board's scheme (triple word red, double word pink, triple letter dark blue, double letter light blue: `--tw-bg`, `--dw-bg`, `--tl-bg`, `--dl-bg` in `lettergrid.scss`, light and dark). Recolor all four, in both themes, to a scheme that is not red, pink and two blues (my call: triple word deep green, double word light green, triple letter deep purple, double letter lavender), keeping the label text at WCAG AA contrast on each. Check the tile face too and record both findings.
- [ ] **Step 6:** R7 with pattern `scrabble`, platform spec `e2e/handOnly.spec.ts`.
- [ ] **Step 7:** R8.

### Task 11: Splendor to Jewel Guild

**Files:**
- Move: `games/splendor/` to `games/jewelguild/`, `e2e/splendor.spec.ts` to `e2e/jewelguild.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts`, comments in `shared/svg/disc.ts`, `shared/svg/cardArt.ts` (Splendor only) and `server/pauseFiles.test.ts`
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts` (`splendor` key), `shared/categories.test.ts` (`strategy`)

**Interfaces:**
- Produces: id `jewelguild`, `jewelguildInfo`, `jewelguild`, `jewelguildClient`. After this task the `CHUNK_11` map holds all ten entries.

- [ ] **Step 1: Write the failing test.** R1.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/privateSeatView.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4. "Nobles", "gems" and "prestige" are common words and stay. `games/tickettoride/README.md` (chunk 9's folder) says "It follows Splendor": leave it, list it in the PR body.
- [ ] **Step 5: Icon and art.** Icon: keep the gem. Art check: card layout, gem colors and noble tiles against the commercial cards; record the finding.
- [ ] **Step 6:** R7 with pattern `splendor`, platform spec `e2e/handOnly.spec.ts`.
- [ ] **Step 7:** R8.

### Task 12: Browser check in Chrome

**Files:** none, unless a check fails (fix it in the game's files and commit `Fix <New> after the rename: <what>`).

- [ ] **Step 1:** `npx vite build && PORT=3211 node server/server.ts` in the background, with the worktree's `data/` from Task 1.
- [ ] **Step 2: Every game.** For each of the ten games, in Chrome tabs at `http://localhost:3211`: the landing card shows the new name and icon; join with two players (one tab each), make at least one move, open History and step through it, download the game file and check its `gameType` is the new id; open Rules and the FAQ and read them for the old name. End the game by having the second player leave where the game ends on leaving.
- [ ] **Step 3: One full game.** Play Four in a Row to a win: the game over screen and Rematch read "Four in a Row".
- [ ] **Step 4: Old data.** Resume `old-c4` with both pause files from Task 1 through Resume a game: it opens as Four in a Row and play continues. Open `old-sc.json` through the saved game viewer: it shows Letter Grid. Visit `/join/catan/old-link`: the Hex Island join dialog opens, and as host the house rule from Task 1 is still chosen. Open Stats: the Connect Four game from Task 1 is listed under Four in a Row.
- [ ] **Step 5: Art.** Open `/dev/svgs`: `palacewalls-tile`, `roadsandfields-tile`, `roadsandfields-meeple`, `hexisland-motif`, `hexisland-piece` and `pawnsandwalls-wall` render with their game's colors. Check Letter Grid's new premium colors in light and dark themes.
- [ ] **Step 6: Sizes.** At laptop size and at phone width (390 px and 320 px same-origin iframes, `data-theme` set on each iframe's root for dark mode, per the phone-width memory note), check Palace Walls, Roads and Fields, Hex Island, Letter Grid and Block Tower for overlap, blank rows and misplaced controls. Note: a 15 px iframe scrollbar can fake a sideways scroll at 320 px.
- [ ] **Step 7:** Write the results (one line per check) into the PR body draft.

### Task 13: Final verification and PR

**Files:** none new.

- [ ] **Step 1: Unit, types, lint.** `npm test`, `npm run typecheck` and `npm run lint` all pass.
- [ ] **Step 2: e2e.** `E2E_PORT_BASE=9100 npx playwright test --workers=2 e2e/palacewalls.spec.ts e2e/roadsandfields.spec.ts e2e/hexisland.spec.ts e2e/fourinarow.spec.ts e2e/blocktower.spec.ts e2e/pachisi.spec.ts e2e/pawnsandwalls.spec.ts e2e/rummytiles.spec.ts e2e/lettergrid.spec.ts e2e/jewelguild.spec.ts e2e/alerts.spec.ts e2e/gameOver.spec.ts e2e/handOnly.spec.ts e2e/hide.spec.ts e2e/history.spec.ts e2e/houseRules.spec.ts e2e/lazyLoading.spec.ts e2e/openGames.spec.ts e2e/reactions.spec.ts e2e/rematch.spec.ts e2e/rules.spec.ts e2e/settings.spec.ts e2e/sharing.spec.ts e2e/spectators.spec.ts e2e/stats.spec.ts e2e/tableScreen.spec.ts e2e/turnTimer.spec.ts` passes, apart from failures recorded in Task 1 Step 4.
- [ ] **Step 3: Landing spec, run but not edited.** `E2E_PORT_BASE=9100 npx playwright test --workers=2 e2e/landing.spec.ts` and record each failing test with the old name it expects (for example the Carcassonne and Connect Four filters, Azul as the first card, Catan's house rule card and the `catan` search). These go in the PR body for the coordinator.
- [ ] **Step 4: Old names.** `git grep -n -i -P "azul|carcassonne|catan|connect ?four|jenga|parchisi|quoridor|rummikub|scrabble|splendor" -- games src server shared e2e vite.config.ts` shows only the allowed hits in Global Constraints. Paste the allowed hits, grouped by reason, into the PR body.
- [ ] **Step 5: Push and open the PR.** `git push -u origin generic-board-tile`, then `gh pr create --base party-games-and-polish --title "Generic names: board and tile games (chunk 11)" --body-file <scratchpad>/pr-11.md`. The body has: the ten renames (old name, new name, id); the art findings from every task; the browser results from Task 12; the landing spec failures from Step 3; the allowed grep hits from Step 4; mentions left in chunk 9 and 10 folders; the registration lines that will conflict with chunks 9, 10 and 12 (one token each). It ends with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
