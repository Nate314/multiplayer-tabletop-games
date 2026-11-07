# Generic Names: Card, Dice and Party Games (Chunk 12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename seven games (Phase 10, Pictionary, Rack-O, Rook, Skip-Bo, UNO, Yahtzee) to the generic names and ids in the spec, with the same rules, while old ids, links, files, settings and stats keep working through `games/legacyIds.ts`.

**Architecture:** Each game is one task: tests switch to the new id first, then `git mv` moves the folder and e2e spec, and the id, symbols, asset names, CSS selectors, wording, in-game terms, icon and art follow. Five of these games use their old name as an in-game word (the UNO call, the Yahtzee box, the Rook card, the Skip-Bo wild, the Rack-O call); those words get generic replacements on screen, while the serialized keys that carry them stay so saved games still load. The legacy id plumbing (chunk 9's first PR, already merged) does the old-data work; this chunk only adds one map entry per game and a test that checks them.

**Tech Stack:** TypeScript, React 19, SCSS, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Generic names (wave 2)" (What every renamed game gets, New names), "Rules for every agent", "Polish: UNO" (the One round target from wave 1) and "Order of work" step 4 and 5. Branch `generic-card-party` from `party-games-and-polish`, after wave 1 (chunks 1 to 8) and chunk 9's legacy id PR are merged. Server `PORT=3212`, `E2E_PORT_BASE=9200`.

## Global Constraints

- Wave 1 chunk 3 moves Pictionary's turn, chat, scoring and shared client pieces into `games/guessing/` (Pictionary's `rules.ts` becomes a thin wrapper over `guessGame(config)`, which Charades also uses). The Pictionary rename covers `games/pictionary/` and any player-visible "Pictionary" text in `games/guessing/`; `games/guessing/` itself keeps its name.

- **Names and ids, exactly:** Phase 10 to **Stage Rummy** (`stagerummy`), Pictionary to **Draw and Guess** (`drawandguess`), Rack-O to **In Order** (`inorder`), Rook to **Nest** (`nest`), Skip-Bo to **Spite and Malice** (`spiteandmalice`), UNO to **Rainbow Eights** (`rainboweights`), Yahtzee to **Five Dice** (`fivedice`).
- **Same rules.** Rules, house rule ids and values, options, state shape and move shapes are unchanged. Rules and manager tests change only in ids, names and player-visible text.
- **In-game words (my calls, the owner may rename them):**
  - Stage Rummy: the word "phase" stays; text that says "phase 10" says "the last phase" instead.
  - In Order: the player who completes a rack "calls In Order" (was "calls Rack-O").
  - Nest: the Rook card is **the Bird** (face word `BIRD`, corner mark `B`). "The nest" (the widow) stays.
  - Spite and Malice: the Skip-Bo card is a **Wild** ("a Wild as 4"). The draw pile back shows no word.
  - Rainbow Eights: calling UNO is calling **Last card**: button `Last card!`, badge `Last card!`, hints such as "Call Last card before you play your next-to-last card", catch button `Catch Bob: no Last card call!`, status "Bob called Last card!". Draw Two, Skip, Reverse, Wild and Wild Draw Four are generic Crazy Eights terms and stay.
  - Five Dice: the Yahtzee box is **Five of a Kind**, and the bonus is the "Five of a Kind bonus".
- **Kept serialized names (pending owner confirmation, see the PR body).** These keys and values are stored in pause files, game files and open games, so they keep their old spelling and old files load without a state migration: Nest's card `color: 'rook'`; Spite and Malice's card `kind: 'skipbo'`; In Order's `LastMove.rackO`; Rainbow Eights' move field `uno`, move type `catchUno` and state field `unoWindow`; Five Dice's category key `'yahtzee'` and state field `yahtzeeBonuses`. Each declaration in `types.ts` gets the comment `// saved games store this name; kept from before the rename so older files load`. Nothing derived from them shows the old name on screen or in a class name (for example Nest's bird card class is `nest-card-bird`, not `nest-card-rook`). Every other identifier is renamed (for example `UnoWindow` to `LastCardWindow`, `RookCard` to `BirdCard`, `isYahtzee` to `isFiveOfAKind`).
- **Old name appears nowhere** in `games/`, `src/`, `server/`, `shared/`, `e2e/` or `vite.config.ts`, except these allowed hits:
  - `games/legacyIds.ts` and `games/legacyIds.test.ts`;
  - one sentence in the opening paragraph of the game's own README: `It plays like <Old name>.`;
  - Wikipedia article titles and URLs where the README's "Differences from Wikipedia" section or a rules source comment cites the article;
  - the kept serialized names above;
  - chess's rook (`games/chess/`, `e2e/chess.spec.ts`), which is the chess piece and is not touched;
  - `e2e/landing.spec.ts` (the coordinator updates it after wave 2);
  - the folders chunks 9 and 10 own (`games/monopoly`, `games/tickettoride`, `games/thecrew`, `games/risk`, or their new names): list any mention in the PR body instead of editing it;
  - content lists written by wave 1 (prompts, words, definitions) where the old name is a common word ("rook" the bird): list them in the PR body, do not edit.
- **Do not edit** the top-level `README.md` game list or count, `e2e/landing.spec.ts`, or `docs/architecture.md`. Do not edit `games/legacyIds.ts` beyond adding entries, and `games/legacyIds.test.ts` beyond the one test this plan adds. `e2e/fixtures.ts` needs no change (it has no game ids); if it turns out to, stop and report.
- **Shared registration lines** (`games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, the test lists of every game): replace the old token with the new one **in place**. Do not re-sort. `games/infos.test.ts` checks that `GAME_INFOS` and `GAMES` keep the same order, and in-place edits keep the merge with chunks 9, 10 and 11 to one-token conflicts.
- **Legacy ids:** chunk 9 owns `games/legacyIds.ts`. This plan assumes it exports `LEGACY_IDS: Readonly<Record<string, string>>` (old id to new id) with tests in `games/legacyIds.test.ts`. If chunk 9 merged another export or file name, use what it merged; the entry (old id key, new id value) is fixed by the spec.
- **No em-dashes** in READMEs, FAQs, comments, test titles, commit messages or the PR body. No new npm dependency.
- **Commits** end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
- **Ports:** this chunk's server runs on `PORT=3212` and its e2e runs with `E2E_PORT_BASE=9200` (never 6000, which Chrome refuses). Chunk 11 uses 3211 and 6510.

### Rename recipe (every game task follows it; the task gives the values)

`<old>` and `<new>` are the ids, `<Old>` and `<New>` the names, `<OLD>` and `<NEW>` the upper-case ids.

- **R1 Tests first.** Edit the test files the task lists to say `<new>` (and `<New>` or the new in-game word where they match on text). In `games/legacyIds.test.ts`, add `<old>: '<new>'` to the `CHUNK_12` map (Task 2 creates the test). If a test to edit lives in the game's own folder, do R2 first; the test must still fail until R3 and R4 are done.
- **R2 Move.** `git mv games/<old> games/<new>`, `git mv e2e/<old>.spec.ts e2e/<new>.spec.ts`, and `git mv games/<new>/client/<old>.scss games/<new>/client/<new>.scss`. Then `git grep -n "games/<old>/\|/<old>/\|'\./<old>"` and fix every import path it finds (wave 1's party games may import from `games/pictionary/`).
- **R3 Ids and symbols.** In the moved folder, its spec and the files the task lists: the `id` in `info.ts` and `client/index.ts`; exports `<old>Info` to `<new>Info`, `<old>` (definition) to `<new>`, `<old>Client` to `<new>Client`, `<OLD>_ASSETS` to `<NEW>_ASSETS`; every other identifier containing the old id or name, except the kept serialized names; SVG asset names `<old>-*` to `<new>-*` (the `/dev/svgs` gallery themes an asset by the part of its name before the first `-`, so it must be the id) and their `svgUrl` calls; CSS classes, DOM ids and custom properties `<old>-*` to `<new>-*`, and `[data-game="<old>"]` to `[data-game="<new>"]`. Registration, in place: `games/registry.ts` (import and `GAMES`), `games/infos.ts` (import and `GAME_INFOS`), `src/clientGames.ts` (`CLIENT_LOADERS` key, path and export), `shared/svg/gameIcons.ts` (`GAME_ICONS` key), `server/assets/registry.ts` (import and spread) when the game draws server SVGs.
- **R4 Wording.** `info.ts` `name` is `<New>`; `description` loses any old name or old in-game word. README: the H1 is `# <New>`, the opening paragraph gains `It plays like <Old>.` as its last sentence, and every other mention of the game or the old in-game word uses the new one; "Differences from Wikipedia" keeps citing the same article. FAQ, screen hints, `gameStatus` strings, `describeMove`, error messages, aria labels, SCSS and code comments, test titles and the e2e spec's `describe` titles and text assertions use the new name and words. Existing tests that assert on that text change with it.
- **R5 Icon and art.** As the task says. Every art finding goes in the PR body: what changed, or "checked, no change" with the reason.
- **R6 Legacy entry.** Add `<old>: '<new>'` to `LEGACY_IDS` in `games/legacyIds.ts`.
- **R7 Verify.** All of these pass:
  - `node --test games/<new>/ games/legacyIds.test.ts games/infos.test.ts games/secretState.test.ts games/privateSeatView.test.ts games/standings.test.ts shared/categories.test.ts` plus the task's other unit test files;
  - `npm run typecheck`;
  - `E2E_PORT_BASE=9200 npx playwright test --workers=2 e2e/<new>.spec.ts` plus the task's platform specs;
  - `git grep -n -i -P "<pattern>" -- games src server shared e2e vite.config.ts` shows only the allowed hits above.
- **R8 Commit** `Rename <Old> to <New> (<new>)` with the trailers, adding every moved and edited file.

## Review Focus

1. **A game paused before the rename whose state carries a kept key** (a Rainbow Eights pause file with `unoWindow` and `uno` moves, a Five Dice pause file with `yahtzeeBonuses`) must resume and play on. Task 1 makes those files on the unrenamed build; Task 9 resumes them. History of such a file shows its stored status lines as they were written; new moves use the new words.
2. **Longer words in tight places:** "Five of a Kind" in the Five Dice score sheet and `Last card!` on the Rainbow Eights button must not wrap into overlap or push controls off screen at 320 px. Task 9 checks both at phone width.
3. **An old join link and an old remembered house rule** (`/join/uno/<id>` with the Target score the host picked in Task 1) must land in Rainbow Eights with that rule chosen. Task 9 checks; the `CHUNK_12` test (Task 2) pins every entry to a registered id.
4. **Chess's rook must not be renamed** by a broad replace. Task 5's grep excludes `games/chess` and `e2e/chess.spec.ts`, and Task 10 checks `git diff party-games-and-polish --stat -- games/chess e2e/chess.spec.ts` is empty and that `e2e/chess.spec.ts` passes.
5. **Draw and Guess's hidden word stays hidden after the rename**: the renamed selectors (`#drawandguess-chat-input`, `.drawandguess-blanks`) in `e2e/tableScreen.spec.ts`, and the `drawandguess` cases in `games/privateSeatView.test.ts`, must still assert that the table screen and other seats never get the word. Task 3 runs both.

---

### Task 1: Worktree, port and old-data samples

**Files:** none committed.

- [ ] **Step 1: Check the starting point.** In the main checkout: `git checkout party-games-and-polish && git pull`. Confirm wave 1 and the legacy PR are in: `ls games/legacyIds.ts games/charades games/steadyhand` lists all three, `git log --oneline -20` shows the chunk 9 legacy id merge, and `games/uno/options.ts` offers the target score 0 "One round". If any is missing, stop and report.
- [ ] **Step 2: Create the worktree.** Following superpowers:using-git-worktrees: `git worktree add ../mtg-generic-card-party -b generic-card-party party-games-and-polish`, then `cd ../mtg-generic-card-party && npm ci`. If `node` is not found, `export PATH="/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH"`.
- [ ] **Step 3: Check the ports.** `netstat -ano | grep -E ':(3212|920[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3212 or 9200, and say so in the PR.
- [ ] **Step 4: Baseline.** `npm test`, `npm run typecheck` and `npm run lint` pass on the untouched branch. Note any failure for the PR body (the spec names `e2e/houseRules.spec.ts` tests at lines 14 and 51 as already failing on `master`).
- [ ] **Step 5: Make old-data samples on the unrenamed build.** `npx vite build && PORT=3212 node server/server.ts` (in the background). In Chrome, at `http://localhost:3212`:
  - UNO game `old-uno`, Alice and Bob in two tabs, Alice hosting with Target score "One round" (the site remembers it): play the round to its end (this finishes a game for the stats check), Rematch, play a few cards so that someone calls UNO if the hand allows, then Pause; both agree; save both pause files to the scratchpad as `old-uno-Alice-paused.json` and `old-uno-Bob-paused.json`.
  - Yahtzee game `old-yz`, Alice and Bob: score one box each, then Pause and save both files as `old-yz-*-paused.json`.
  - Rook game `old-rk`, four players: bid and play one trick, then open History and download the game file as `old-rk.json`.
  - Stop the server. Keep the worktree's `data/` folder: its stats database now holds a finished `uno` game.

### Task 2: Phase 10 to Stage Rummy

**Files:**
- Move: `games/phase10/` to `games/stagerummy/`, `e2e/phase10.spec.ts` to `e2e/stagerummy.spec.ts`
- Modify: registration files (no server assets), `games/legacyIds.ts`, `e2e/handOnly.spec.ts` (`phase10` entry), comments in `server/games.test.ts` (the "Azul, Uno and Phase 10" line: change Uno and Phase 10 only; the "as Phase 10 does" line)
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `shared/categories.test.ts` (`card`), `src/components/gameFilters.test.ts` (seven-player list and its house-rule list)

**Interfaces:**
- Produces: id `stagerummy`, `stagerummyInfo`, `stagerummy`, `stagerummyClient`, `STAGERUMMY_RULES` (was `PHASE10_RULES`), `StageRummyPlan` (was `Phase10Plan`). The `CHUNK_12` test that later tasks extend.

- [ ] **Step 1: Write the failing test.** Add to `games/legacyIds.test.ts`:
  ```ts
  // Chunk 12's renames: every old id points at a registered game, and no old id is still registered
  const CHUNK_12: Record<string, string> = { phase10: 'stagerummy' };
  test('chunk 12 old ids map to their renamed games', () => {
    for (const [old, id] of Object.entries(CHUNK_12)) {
      assert.equal(LEGACY_IDS[old], id, old);
      assert.ok(GAMES.some(game => game.info.id === id), id);
      assert.ok(!GAMES.some(game => game.info.id === old), old);
    }
  });
  ```
  (Import `GAMES` from `./registry.ts` if the file does not already.) Then R1 in the listed tests. `gameFilters.test.ts`: `'Phase 10'` becomes `'Stage Rummy'` in both lists, each kept sorted by name (`localeCompare`).
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts shared/categories.test.ts src/components/gameFilters.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6.
- [ ] **Step 4:** R4. Every player-visible "phase 10" becomes "the last phase": the tiebreaker status ("...so they play a tiebreaker hand of the last phase..."), the error `The tiebreaker hand is the last phase`, the hand summary ("Tiebreaker next: Ann and Bo attempt the last phase again") and the FAQ. "Phase 1" to "Phase 9" and the house rule "Phases in any order" stay.
- [ ] **Step 5: Icon and art.** New icon (my call): three steps rising left to right, replacing the "10" label. Art check: card faces and the wild and skip cards against the commercial cards; record the finding.
- [ ] **Step 6:** R7 with pattern `phase ?10`, platform spec `e2e/handOnly.spec.ts`, plus `node --test src/components/gameFilters.test.ts server/games.test.ts`.
- [ ] **Step 7:** R8.

### Task 3: Pictionary to Draw and Guess

**Files:**
- Move: `games/pictionary/` to `games/drawandguess/`, `e2e/pictionary.spec.ts` to `e2e/drawandguess.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts` (entry and `.pictionary-*`, `#pictionary-chat-input` selectors), `e2e/passAndPlay.spec.ts`, `e2e/spectators.spec.ts`, `e2e/tableScreen.spec.ts`; any wave 1 party game (Charades, Fictionary, Categories, Hint Grid, Steady Hand) file that imports from or names Pictionary; `shared/guess.ts` and `shared/guess.test.ts` if a comment names Pictionary
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts` (`pictionary` key, the test "a Pictionary spectator sees the word..." and its `GAMES.find` id), `shared/categories.test.ts` (`party`), `src/components/gameFilters.test.ts` (seven-player list)

**Interfaces:**
- Produces: id `drawandguess`, `drawandguessInfo`, `drawandguess`, `drawandguessClient`, classes `.drawandguess-*`, DOM id `drawandguess-chat-input`.

- [ ] **Step 1: Write the failing test.** R1 in the listed unit tests (the `privateSeatView` test title becomes "a Draw and Guess spectator sees the word being drawn, and a table screen sees only the blanks"). In the platform specs: `'pictionary'` to `'drawandguess'`, "Pictionary" to "Draw and Guess" in titles, and the selectors to `.drawandguess-chat`, `#drawandguess-chat-input`, `.drawandguess-paper`, `.drawandguess-blanks`. `gameFilters.test.ts`: `'Pictionary'` becomes `'Draw and Guess'`, list re-sorted.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/privateSeatView.test.ts shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6. Wave 1 party games that import from `games/pictionary/` now import from `games/drawandguess/`.
- [ ] **Step 4:** R4, including comments and READMEs in wave 1's party games that say "as Pictionary does" or similar.
- [ ] **Step 5: Icon and art.** Icon: keep the pencil. Art check: the sketchbook theme, toolbar and timer against the commercial game's board and box art; record the finding.
- [ ] **Step 6:** R7 with pattern `pictionary`, platform specs `e2e/handOnly.spec.ts e2e/passAndPlay.spec.ts e2e/spectators.spec.ts e2e/tableScreen.spec.ts` and the wave 1 party game specs whose files changed in Step 3 or 4, plus `node --test src/components/gameFilters.test.ts` and those games' folders.
- [ ] **Step 7:** R8.

### Task 4: Rack-O to In Order

**Files:**
- Move: `games/racko/` to `games/inorder/`, `e2e/racko.spec.ts` to `e2e/inorder.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts`, the comment in `e2e/hide.spec.ts` ("Rack-O, Skip-Bo and Dominoes boards": change Rack-O only), comment in `shared/svg/cardArt.ts` (Rack-O only)
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts` (`racko` key), `shared/categories.test.ts` (`card`)

**Interfaces:**
- Produces: id `inorder`, `inorderInfo`, `inorder`, `inorderClient`, `IN_ORDER_POINTS` (was `RACKO_POINTS`). Kept: `LastMove.rackO`.

- [ ] **Step 1: Write the failing test.** R2 first (the tests live in the folder), then R1. In `games/inorder/rules.test.ts` the test "an ascending rack calls In Order and ends the round" asserts `assert.match(done.gameStatus, /called In Order/)`. In `client/describeMove.test.ts` the expected text ends `..., calling In Order!`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/inorder/`. Expected: FAIL.
- [ ] **Step 3:** R3, R6. Add the kept-name comment on `rackO` in `types.ts`.
- [ ] **Step 4:** R4 with the In Order call: statuses "Bob called In Order and scores 75 points. Waiting for everyone to continue." and "Bob called In Order! Bob wins with 520 points" (same shapes as now), the round summary reason `In Order` (other players keep `In order from slot 1`), and the FAQ.
- [ ] **Step 5: Icon and art.** Icon: keep the rising bars. Art check: the rainbow card colors and the rack against the commercial card and rack design; record the finding.
- [ ] **Step 6:** R7 with pattern `rack-?o\b`, platform specs `e2e/handOnly.spec.ts e2e/hide.spec.ts`. The hits `rackO` are the kept name.
- [ ] **Step 7:** R8.

### Task 5: Rook to Nest

**Files:**
- Move: `games/rook/` to `games/nest/`, `e2e/rook.spec.ts` to `e2e/nest.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `games/testStates.ts` (`FOUR_SEATS`), `e2e/handOnly.spec.ts`, `e2e/houseRules.spec.ts` (the test "Rook at six goes from three teams..." and its `seat` and `setHouseRules` ids), comments in `server/games.test.ts` ("as Rook does") and `shared/svg/cardArt.ts` (Rook only). Not `games/chess/` or `e2e/chess.spec.ts`.
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts` (`rook` key), `shared/categories.test.ts` (`card`), `src/components/gameFilters.test.ts` (seven-player list and its house-rule list)

**Interfaces:**
- Produces: id `nest`, `nestInfo`, `nest`, `nestClient`, `NEST_RULES` (was `ROOK_RULES`), `BIRD` (was `ROOK`), `BirdCard` (was `RookCard`), `BIRD_POINTS` (was `ROOK_POINTS`), `nestTeams` (was `rookTeams`), classes `.nest-card*`, bird card class `nest-card-bird`. Kept: card `color: 'rook'`.

- [ ] **Step 1: Write the failing test.** R1. `gameFilters.test.ts`: `'Rook'` becomes `'Nest'` in both lists, re-sorted. In the moved rules tests, `cardName(BIRD)` is `'the Bird'`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/privateSeatView.test.ts src/components/gameFilters.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6. Add the kept-name comment on `BirdCard`'s `color: 'rook'` in `types.ts`. `Card.tsx` maps that color to the class `nest-card-bird`.
- [ ] **Step 4:** R4 with the Bird: card name `the Bird`, the GameScreen hint "Follow suit if you can; the Bird may be played at any time", the not-enough-players hint "Nest needs at least ...", the FAQ ("What is special about the Bird?"), the README and the rules source comment (which keeps citing Wikipedia's "Rook (card game)" article).
- [ ] **Step 5: Icon and art.** New icon (my call): a nest holding three eggs, replacing the bird. Art: the bird card's middle word becomes `BIRD` and its corner mark `B`; check the card faces against the commercial deck; record the finding.
- [ ] **Step 6:** R7 with pattern `\brook\b` and the extra paths `':!games/chess' ':!e2e/chess.spec.ts'`, platform specs `e2e/handOnly.spec.ts e2e/houseRules.spec.ts`, plus `node --test src/components/gameFilters.test.ts games/chess/`. The hits `'rook'` as a card color are the kept name.
- [ ] **Step 7:** R8.

### Task 6: Skip-Bo to Spite and Malice

**Files:**
- Move: `games/skipbo/` to `games/spiteandmalice/`, `e2e/skipbo.spec.ts` to `e2e/spiteandmalice.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts`, the comment in `e2e/hide.spec.ts` (Skip-Bo only), comment in `shared/svg/cardArt.ts` (Skip-Bo only)
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `shared/categories.test.ts` (`card`)

**Interfaces:**
- Produces: id `spiteandmalice`, `spiteandmaliceInfo`, `spiteandmalice`, `spiteandmaliceClient`, `WILD_COUNT` (was `SKIPBO_COUNT`), classes `.spiteandmalice-*`. Kept: card `kind: 'skipbo'`.

- [ ] **Step 1: Write the failing test.** R1. In the moved `client/describeMove.test.ts`, the title says "Wild cards" and the expected text says `a Wild as 4` where it said `a Skip-Bo as 4`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/spiteandmalice/`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6. Add the kept-name comment on `kind: 'skipbo'` in `types.ts`. `CardView.tsx`'s class or art key for the wild is `wild`.
- [ ] **Step 4:** R4 with the Wild: `cardName` returns `Wild`, the on-pile label `Wild as 4`, the error `A building pile starts with a 1 or a Wild`, the FAQ ("18 Wild cards") and the README. Spite and Malice is the traditional game Skip-Bo grew from (spec); the README's Wikipedia section keeps citing the Skip-Bo article.
- [ ] **Step 5: Icon and art.** Icon: keep the cards. Art: the draw pile back in `client/Board.tsx` drops the word `Skip-Bo` and shows only the card-back art; check the card faces against the commercial deck; record the finding.
- [ ] **Step 6:** R7 with pattern `skip-?bo`, platform specs `e2e/handOnly.spec.ts e2e/hide.spec.ts`. The hits `'skipbo'` as a card kind are the kept name.
- [ ] **Step 7:** R8.

### Task 7: UNO to Rainbow Eights

**Files:**
- Move: `games/uno/` to `games/rainboweights/`, `e2e/uno.spec.ts` to `e2e/rainboweights.spec.ts`
- Modify: registration files, `server/assets/registry.ts` (`UNO_ASSETS`), `games/legacyIds.ts`, `e2e/handOnly.spec.ts` (entry, `.uno-button`, its comment), `e2e/hide.spec.ts`, `e2e/pause.spec.ts`, comments in `server/games.ts` ("an UNO challenge") and `server/games.test.ts` (Uno only, if Task 2 has not already)
- Test: `games/legacyIds.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts` (`uno` key, `OTHER_SEATS_SECRETS`, the comment "UNO's challenged hand"), `shared/categories.test.ts` (`card`), `shared/pauseFile.test.ts`, `shared/houseRules.test.ts` (const `UNO` to `RAINBOW_EIGHTS`), `src/services/pauseFiles.test.ts`, `src/services/settings.test.ts` (search `'uno'` to `'eights'`), `src/stats/aggregate.test.ts`, `src/components/gameFilters.test.ts`

**Interfaces:**
- Produces: id `rainboweights`, `rainboweightsInfo`, `rainboweights`, `rainboweightsClient`, `RAINBOWEIGHTS_ASSETS`, asset `rainboweights-card`, `LastCardWindow` (was `UnoWindow`), classes `.last-card-button` and `.last-card-badge` (were `.uno-button` and `.uno-badge`), other classes `.rainboweights-*`. Kept: move field `uno`, move type `catchUno`, state field `unoWindow`. The wave 1 target score 0 "One round" in `options.ts` is unchanged.

- [ ] **Step 1: Write the failing test.** R1 in the listed unit tests: `'uno'` to `'rainboweights'` as a game type (pause file name `rainboweights-g1-Alice-paused.json`, URLs `/api/pause-file/rainboweights/...`, `/api/resume/rainboweights/...`). `gameFilters.test.ts`: `const rainboweights = fake('Rainbow Eights', 'card', 2, 10, 'Shed your cards');`, the search test uses `'eights'`, the sorted lists keep chunk 11's other names sorted with `'Rainbow Eights'` (with chunk 11 merged: `['Four in a Row', 'Rainbow Eights', 'Roads and Fields']`; on this branch alone: `['Carcassonne', 'Connect Four', 'Rainbow Eights']` and `['Carcassonne', 'Rainbow Eights']`), and `'UNO'` becomes `'Rainbow Eights'` in the seven-player list, re-sorted. Platform specs: `'uno'` to `'rainboweights'` (seat, `nameOf`, `joinPassAndPlay`, `openJoinDialog`, `/api/e2e/room/rainboweights/`), the downloaded name `rainboweights-${table.gameId}-Alice-paused.json`, and `.last-card-button` in `handOnly`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/privateSeatView.test.ts shared/pauseFile.test.ts shared/houseRules.test.ts src/components/gameFilters.test.ts`. Expected: FAIL (the pure-string tests pass either way; the registry-backed ones fail).
- [ ] **Step 3:** R2, R3, R6. Add the kept-name comments on `uno`, `catchUno` and `unoWindow` in `types.ts`. Local names such as `unoArmed` and `lateUno` become `lastCardArmed` and `lateLastCard`.
- [ ] **Step 4:** R4 with the Last card call (Global Constraints), in `GameScreen.tsx`, `Table.tsx`, `rules.ts` statuses and errors (`Call Last card when you play your second-to-last card`, "Bob caught Ann not calling Last card; Ann draws 2"), the FAQ ("How do I call Last card?") and the README. Check the One round target text from wave 1 still reads naturally.
- [ ] **Step 5: Icon and art.** Art (a change): the tilted white oval in `svg.ts` is the commercial card's mark. Replace it with an upright circle (my call: `cx 50, cy 75, r 36`, no rotation) on faces, wilds and back; the back keeps its dark fill and red circle and `Table.tsx` drops the `UNO` word from both card backs. New icon (my call): a card with an upright `8`, replacing the tilted ellipse. Record both.
- [ ] **Step 6:** R7 with pattern `\buno\b`, platform specs `e2e/handOnly.spec.ts e2e/hide.spec.ts e2e/pause.spec.ts`, plus `node --test shared/ src/services/ src/stats/ src/components/gameFilters.test.ts`. The hits `uno`, `catchUno` and `unoWindow` are the kept names.
- [ ] **Step 7:** R8.

### Task 8: Yahtzee to Five Dice

**Files:**
- Move: `games/yahtzee/` to `games/fivedice/`, `e2e/yahtzee.spec.ts` to `e2e/fivedice.spec.ts`
- Modify: registration files, `games/legacyIds.ts`, `e2e/handOnly.spec.ts`, `e2e/gameOver.spec.ts`, `e2e/rematch.spec.ts`
- Test: `games/legacyIds.test.ts`, `shared/categories.test.ts` (`dice`), `src/stats/aggregate.test.ts`, `src/components/gameFilters.test.ts` (seven-player list)

**Interfaces:**
- Produces: id `fivedice`, `fivediceInfo`, `fivedice`, `fivediceClient`, `FIVE_OF_A_KIND_BONUS` (was `YAHTZEE_BONUS`), `isFiveOfAKind` (was `isYahtzee`), `totals(...).fiveOfAKindBonus` (was `yahtzeeBonus`; computed, not stored). After this task the `CHUNK_12` map holds all seven entries. Kept: category key `'yahtzee'`, state field `yahtzeeBonuses`.

- [ ] **Step 1: Write the failing test.** R1. `gameFilters.test.ts`: `'Yahtzee'` becomes `'Five Dice'`, re-sorted. In the moved rules tests: `CATEGORY_LABELS.yahtzee === 'Five of a Kind'`, the move text ends `and a 100 point Five of a Kind bonus`, and the Joker error says `score the Five of a Kind in ...`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts games/fivedice/ shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3:** R2, R3, R6. Add the kept-name comments on the `'yahtzee'` category and `yahtzeeBonuses` in `types.ts`.
- [ ] **Step 4:** R4: the score sheet row `Five of a Kind bonus`, the FAQ ("What happens with a second Five of a Kind?"), the README, `rules.ts` comments.
- [ ] **Step 5: Icon and art.** Icon: keep the dice. Art check: the score sheet layout against the commercial score pad; record the finding.
- [ ] **Step 6:** R7 with pattern `yahtzee`, platform specs `e2e/handOnly.spec.ts e2e/gameOver.spec.ts e2e/rematch.spec.ts`, plus `node --test src/stats/aggregate.test.ts src/components/gameFilters.test.ts`. The hits `'yahtzee'` as a category key and `yahtzeeBonuses` are the kept names.
- [ ] **Step 7:** R8.

### Task 9: Browser check in Chrome

**Files:** none, unless a check fails (fix it in the game's files and commit `Fix <New> after the rename: <what>`).

- [ ] **Step 1:** `npx vite build && PORT=3212 node server/server.ts` in the background, with the worktree's `data/` from Task 1.
- [ ] **Step 2: Every game.** For each of the seven games, in Chrome tabs at `http://localhost:3212` (four tabs for Nest, three for Draw and Guess): the landing card shows the new name and icon; join, make at least one move, open History and step through it, download the game file and check its `gameType` is the new id; open Rules and the FAQ and read them for the old name and old in-game words. End the game by having a player leave where the game ends on leaving.
- [ ] **Step 3: One full game.** Play Rainbow Eights with Target score "One round" to the end: the Last card button and badge work, a missed call can be caught, and the game over screen reads "Rainbow Eights".
- [ ] **Step 4: Old data.** Resume `old-uno` and `old-yz` with their pause files from Task 1 through Resume a game: they open as Rainbow Eights and Five Dice and play continues. Open `old-rk.json` in the saved game viewer: it shows Nest, with the Bird card drawn as the Bird. Visit `/join/uno/old-link`: the Rainbow Eights join dialog opens, and as host the Target score from Task 1 is still chosen. Open Stats: the UNO game from Task 1 is listed under Rainbow Eights.
- [ ] **Step 5: Art.** Open `/dev/svgs`: `rainboweights-card` faces, wild and back show the upright circle with Rainbow Eights' colors. Check the Nest Bird card and the Spite and Malice draw pile in light and dark themes.
- [ ] **Step 6: Sizes.** At laptop size and at phone width (390 px and 320 px same-origin iframes, `data-theme` set on each iframe's root for dark mode, per the phone-width memory note), check Rainbow Eights (the Last card button), Five Dice (the Five of a Kind rows), Nest, Spite and Malice and Stage Rummy for overlap, blank rows and misplaced controls. Note: a 15 px iframe scrollbar can fake a sideways scroll at 320 px.
- [ ] **Step 7:** Write the results (one line per check) into the PR body draft.

### Task 10: Final verification and PR

**Files:** none new.

- [ ] **Step 1: Unit, types, lint.** `npm test`, `npm run typecheck` and `npm run lint` all pass.
- [ ] **Step 2: e2e.** `E2E_PORT_BASE=9200 npx playwright test --workers=2 e2e/stagerummy.spec.ts e2e/drawandguess.spec.ts e2e/inorder.spec.ts e2e/nest.spec.ts e2e/spiteandmalice.spec.ts e2e/rainboweights.spec.ts e2e/fivedice.spec.ts e2e/chess.spec.ts e2e/handOnly.spec.ts e2e/hide.spec.ts e2e/pause.spec.ts e2e/passAndPlay.spec.ts e2e/spectators.spec.ts e2e/tableScreen.spec.ts e2e/houseRules.spec.ts e2e/gameOver.spec.ts e2e/rematch.spec.ts`, plus any wave 1 party game spec Task 3 touched, passes apart from failures recorded in Task 1 Step 4.
- [ ] **Step 3: Landing spec, run but not edited.** `E2E_PORT_BASE=9200 npx playwright test --workers=2 e2e/landing.spec.ts` and record each failing test with the old name it expects (for example Yahtzee as the last card and in the dice filter, the seven-player list, Rook's house rule card, the Pictionary row counts). These go in the PR body for the coordinator.
- [ ] **Step 4: Old names and chess.** `git grep -n -i -P "phase ?10|pictionary|rack-?o\b|\brook\b|skip-?bo|\buno\b|yahtzee" -- games src server shared e2e vite.config.ts ':!games/chess' ':!e2e/chess.spec.ts'` shows only the allowed hits in Global Constraints; paste them, grouped by reason, into the PR body. `git diff party-games-and-polish --stat -- games/chess e2e/chess.spec.ts` prints nothing.
- [ ] **Step 5: Push and open the PR.** `git push -u origin generic-card-party`, then `gh pr create --base party-games-and-polish --title "Generic names: card, dice and party games (chunk 12)" --body-file <scratchpad>/pr-12.md`. The body has: the seven renames (old name, new name, id); the in-game word choices from Global Constraints, marked as calls the owner may change; the kept serialized names, asking the owner to confirm keeping them over a state migration; the art findings from every task; the browser results from Task 9; the landing spec failures from Step 3; the allowed grep hits from Step 4; mentions left in chunk 9 and 10 folders; the registration and shared test lines that will conflict with chunks 9, 10 and 11 (one token each). It ends with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
