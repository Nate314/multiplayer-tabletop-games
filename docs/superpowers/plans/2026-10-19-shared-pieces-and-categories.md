# Shared Pieces and Game Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the landing page by game type, remove Quoridor's and Azul's last-move aids, and move eight repeated pieces of logic and UI into shared code with every existing game switched over, changing no game's behavior.

**Architecture:** Each task adds one shared piece (helper in `shared/` or component in `src/components/`) test-first, then switches the games that copy it onto it, using the games' existing unit and e2e tests as the proof nothing changed. Tasks run one after another on branch `shared-refactor-and-categories`, because several touch the same game files.

**Tech Stack:** TypeScript, React 19, Vite, Express and `ws`, `node --test`, Playwright, Node 22.18+ through nvm.

**Spec:** `docs/superpowers/specs/2026-10-19-shared-pieces-and-categories-design.md`

## Global Constraints

- No game's behavior changes: rules, validation and error text, status text, what each player sees, animations, History, game files. A behavior change is a bug.
- Existing tests are changed only where they reach into code that moved (an import path, a moved private helper), never to accept different behavior. Exception: the tests for the two removed last-move aids (Task 2).
- State shapes stay the same, so saved games (SQLite) and downloaded game files still load.
- A game whose copy needs more than a small option to fit a shared piece keeps its copy; the task's commit message and the task report say which game and why.
- Server code (`server/`, `shared/`, non-client game files) never imports from `src/` or `games/<id>/client/`.
- Platform CSS under `:where()`; per-game CSS scoped under `[data-game="<id>"]`; light and dark themes both work.
- No new npm dependency. No em-dashes in docs, comments, READMEs, FAQs or commit messages.
- Every task ends with `npm test`, `npm run typecheck`, `npm run lint` passing, and the e2e specs of every game it touched passing (`npx playwright test e2e/<id>.spec.ts ...`).
- Commits end with the session's Co-Authored-By and Claude-Session lines.

## Review Focus

- A saved state from before this change (a summary with `acknowledged`, a hand record) loaded into the refactored game still continues: Task 3 has a test that runs the shared Continue on a state literal shaped exactly like today's Hearts state.
- The last connected player acknowledging while another player is disconnected, or a player leaving while the others wait, still deals the next round: Task 3 pins both in `shared/rounds.test.ts`.
- Hand views for `viewer: null` and for a seat with no hand (dismissed) return an empty hand, never `undefined`, and never another seat's cards: Task 6 pins both.
- Every registered game has a category and appears exactly once on the landing page, in the spec's group order: Task 1 pins it against `GAMES`.
- The shared scoring dialog and dice look the same in dark theme as each game's old copy: Tasks 4 and 7 end with a browser check of two migrated games in both themes.

---

### Task 1: Game categories on the landing page

**Files:**
- Modify: `shared/gameDefinition.ts` (`GameInfo`), all 31 `games/<id>/index.ts`, `src/components/GameList.tsx`, `src/App.css`, `games/registry.ts` (comment only), `docs/architecture.md`
- Create: `shared/categories.ts`, `shared/categories.test.ts`
- Modify: `e2e/fixtures.ts` only if the lobby selector `.lobby-game` changes (it must not)

**Interfaces:**
- Produces: `type GameCategory = 'card' | 'dice' | 'tile' | 'classic' | 'strategy'`; `CATEGORIES: readonly { id: GameCategory; name: string }[]` in display order with names `'Card games'`, `'Dice games'`, `'Tile games'`, `'Classic board games'`, `'Strategy board games'`; `GameInfo.category: GameCategory` (required); `groupByCategory<T extends { info: GameInfo }>(games: readonly T[]): { category: GameCategory; name: string; games: T[] }[]` (empty groups dropped, games alphabetical by `info.name` within a group).

- [ ] **Step 1: Write failing tests** in `shared/categories.test.ts`: `groupByCategory keeps the spec's group order and sorts by name` (three fake games across two categories); `every registered game has the spec's category` (asserts the exact map below against `GAMES` from `games/registry.ts`, and that the groups cover all 31 ids once):
  - card: euchre, gofish, hearts, phase10, racko, rook, skipbo, spades, holdem, thecrew, uno, war
  - dice: farkle, yahtzee
  - tile: azul, carcassonne, dominoes, rummikub, scrabble
  - classic: backgammon, checkers, chess, connectfour, mancala, parchisi, quoridor
  - strategy: catan, monopoly, risk, splendor, tickettoride
- [ ] **Step 2:** `node --test shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Add `category` to `GameInfo` and every `index.ts`; implement `shared/categories.ts`; render `GameList` as one `<section aria-labelledby>` per group with an `<h2>` heading and the existing `<ul className="lobby-games">` inside (each `<li><button className="lobby-game">` unchanged). Heading style in `src/App.css`, both themes.
- [ ] **Step 4:** Unit tests, typecheck, lint pass; `npx playwright test e2e/war.spec.ts e2e/azul.spec.ts` (both join through the lobby) pass. Browser check: landing page shows five headings in order, light and dark, at 1280x800 and 800x900.
- [ ] **Step 5:** Commit `feat: group the game list by category`.

### Task 2: Remove the last-move aids from Quoridor and Azul

**Files:**
- Modify: `games/quoridor/client/ActionButtons.tsx:26-36`, `games/quoridor/client/GameScreen.tsx` (pin and hover state), `games/quoridor/client/Board.tsx` (`last-move-*` highlight props and classes, live board only), `games/quoridor/client/*.css`, `games/quoridor/README.md:27`, `games/quoridor/client/faq.ts:40-42`, `e2e/quoridor.spec.ts:256` (delete that test)
- Modify: `games/azul/client/Factories.tsx:17-21` (drop `last-source`), `games/azul/client/azul.css:338`, `games/azul/README.md:21`, `e2e/azul.spec.ts:266` (delete that test)

- [ ] **Step 1:** Remove the button, its state and the live-board highlight from Quoridor; keep anything `HistoryBoard.tsx` uses to highlight the move in History (if `Board` serves both, keep the highlight prop and stop passing it from `GameScreen`). Remove Azul's `last-source` class and CSS; keep `HistoryBoard`'s `lastLine`.
- [ ] **Step 2:** Update the README lines and the Quoridor FAQ entry (the Undo half of that FAQ answer stays). Delete the two e2e tests.
- [ ] **Step 3:** `npm test`, typecheck, lint, `npx playwright test e2e/quoridor.spec.ts e2e/azul.spec.ts`: pass. Browser check: Quoridor has no Show Last Move button; History still highlights moves in both games.
- [ ] **Step 4:** Commit `feat: remove Show Last Move and the last-source outline`.

### Task 3: Shared round Continue

**Files:**
- Create: `shared/rounds.ts`, `shared/rounds.test.ts`
- Modify: the `acknowledgeRound`/`startNext...IfReady` code in `games/{uno,phase10,rook,spades,euchre,hearts,dominoes,racko,azul,holdem}/rules.ts`; `games/thecrew/rules.ts` only if it fits (Global Constraints)

**Interfaces:**
- Produces:
  - `type Acknowledgeable = { acknowledged: Seat[] }`
  - `type RoundAccess<S extends BaseGameState, M extends Acknowledgeable> = { get(state: S): M | null; set(state: S, summary: M): S; noun: string; waitsFor?(state: S): Seat[] }` (`waitsFor` defaults to `connectedPlayers(state)`; Hold'em passes its players with chips who are connected)
  - `everyoneReady<S, M>(state: S, round: RoundAccess<S, M>): boolean` (false with no summary or when the game is over)
  - `acknowledge<S, M>(state: S, seat: Seat, round: RoundAccess<S, M>, startNext: (state: S) => S): Result<S>`: `{ error: 'Nothing to continue' }` with no summary; unchanged state if the seat already acknowledged; else adds the seat, sets `gameStatus` to `` `${playerNames[seat]} is ready for the next ${noun}` `` and returns `startNext(state)` when `everyoneReady`, else that state.
- Each game keeps its action type (Phase 10 keeps `'acknowledgeHand'`), its summary field and its own deal step, and calls `everyoneReady` where it re-checks after a disconnect or a leave.

- [ ] **Step 1: Write failing tests** in `shared/rounds.test.ts` using a minimal state literal with a `summary` field: `nothing to continue without a summary`; `acknowledging twice changes nothing`; `the status names the ready player` (`'Alice is ready for the next hand'`); `the next round starts once every connected player is ready` (a disconnected seat is not waited for); `waitsFor narrows who must be ready`; `a state shaped like today's Hearts state continues` (literal copied from a current `games/hearts/rules.test.ts` summary state).
- [ ] **Step 2:** `node --test shared/rounds.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `shared/rounds.ts`, then switch each game listed above, one commit per two or three games.
- [ ] **Step 4:** Unit tests, typecheck, lint, and `npx playwright test` for every switched game's spec: pass with no test changes beyond imports.
- [ ] **Step 5:** Commit(s) `refactor: shared round Continue in <games>`.

### Task 4: Shared round scoring dialog

**Files:**
- Create: `src/components/RoundSummaryDialog.tsx`, `src/text.ts` (with `plural`) and `src/text.test.ts`
- Modify: `src/App.css` (`:where()` block for `.summary-overlay`, `.round-summary`, `.summary-result`, `.summary-players`, `.summary-waiting`, moved from the games' CSS), `games/{hearts,euchre,rook,spades,uno,racko,dominoes,azul}/client/RoundSummary.tsx`, `games/phase10/client/HandSummary.tsx`, those games' CSS, and the five `plural` copies; Hold'em's `HandResultPanel.tsx` and The Crew's `MissionSummary.tsx` only if they fit

**Interfaces:**
- Produces: `plural(count: number, word: string, pluralWord = word + 's'): string` (match the existing copies' output exactly; read them first); default export `RoundSummaryDialog(props: { label: string; title: string; gameState: Pick<BasePublicState, 'isGameOver' | 'gameStatus' | 'activePlayers' | 'disconnected' | 'playerNames'>; acknowledged: Seat[]; playerNumber: Seat; onContinue: () => void; onClose: () => void; children: ReactNode })`. It renders exactly today's markup: `div.overlay.summary-overlay > div.modal.round-summary[role=dialog][aria-label={label}]`, `<h2>{title}</h2>`, `div.summary-result`, then `children`, then Close (game over), "Waiting for A, B" (`div.summary-waiting`) or Continue, as `games/hearts/client/RoundSummary.tsx` does.

- [ ] **Step 1: Write failing tests:** `src/text.test.ts` `plural matches the old copies` (`plural(1, 'tile') === '1 tile'`, `plural(2, 'tile') === '2 tiles'`, plus any irregular form a copy uses).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement both; switch each game's summary to render `RoundSummaryDialog` with its own rows as children; move the shared CSS to `src/App.css`, leaving each game's color overrides in its scoped CSS so each looks as before.
- [ ] **Step 4:** Unit tests, typecheck, lint, and every switched game's e2e spec pass. Browser check: Hearts and Azul scoring dialogs, light and dark, look as on `master`.
- [ ] **Step 5:** Commit(s) `refactor: shared round scoring dialog in <games>`.

### Task 5: Partnerships

**Files:**
- Create: `shared/partnerships.ts`, `shared/partnerships.test.ts`
- Modify: `games/{rook,spades,euchre}/rules.ts` (and their clients' imports of these helpers), `games/hearts/rules.ts` (`nextSeat`, `SEATS`)

**Interfaces:**
- Produces: `type Team = 0 | 1`; `FOUR_SEATS: readonly Seat[]` (`[1, 2, 3, 4]`); `nextSeat(seat: Seat): Seat` (`seat % 4 + 1`); `teamOf(seat: Seat): Team` (odd seats team 0); `teamSeats(team: Team): Seat[]`; `partnerOf(seat: Seat): Seat`; `teamNames(team: Team, playerNames: Record<Seat, string>): string` (`'Alice and Cara'`); `partnershipBroken<S extends BaseGameState>(state: S, seat: Seat): S` (game over, `currentPlayer: null`, the other team as `winners`, `undoVote: null`, status `` `${name} left, so the partnership is broken: ${teamNames(...)} win` ``, exactly as `games/rook/rules.ts:413-422`).
- Games re-export from their `rules.ts` only if their tests or clients import these names from there; otherwise update the imports.

- [ ] **Step 1: Write failing tests:** `seats 1 and 3 are team 0`, `next seat wraps from 4 to 1`, `partner of 2 is 4`, `team names join with and`, `a broken partnership ends the game for the other team` (status text exact).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; switch the four games.
- [ ] **Step 4:** Unit tests, typecheck, lint, e2e specs for rook, spades, euchre, hearts: pass.
- [ ] **Step 5:** Commit `refactor: shared partnership helpers`.

### Task 6: Hand views and per-seat maps

**Files:**
- Create: `shared/hands.ts`, `shared/hands.test.ts`
- Modify: `toPublicState` in `games/{dominoes,euchre,gofish,hearts,rook,spades,thecrew,uno,phase10,risk,skipbo,holdem,racko,rummikub,scrabble}/rules.ts` where the shape fits; `mapSeats`/`perSeat` copies in `games/{azul,phase10,hearts,skipbo}/rules.ts`

**Interfaces:**
- Produces: `viewHand<T>(hands: Partial<Record<Seat, T[]>>, viewer: Seat | null): T[]` (`[]` for `null` or a seat with no hand); `handCounts<T>(hands: Partial<Record<Seat, T[]>>): Record<Seat, number>` (same key order as `Object.entries(hands)`); `mapSeats<T, U>(record: Partial<Record<Seat, T>>, fn: (value: T, seat: Seat) => U): Record<Seat, U>`.
- Each game keeps its public field names (`hand`, `myHand`, `rack`, `myRack`, `myCards`, `handCounts`); Risk keeps `null` for no viewer if that is what it sends today.

- [ ] **Step 1: Write failing tests:** `viewer null sees no hand`; `a seat with no hand sees an empty one`; `a viewer sees only their own hand`; `counts list every seat`; `mapSeats passes the seat`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; switch the games.
- [ ] **Step 4:** Unit tests (every game's `table view hides hands` test must pass unchanged), typecheck, lint, e2e for the switched games: pass.
- [ ] **Step 5:** Commit(s) `refactor: shared hand views`.

### Task 7: Dice

**Files:**
- Create: `shared/dice.ts`, `shared/dice.test.ts`
- Modify: server rolls in `games/backgammon/rules.ts:49`, `games/catan/dice.ts:11`, `games/monopoly/movement.ts:18`, `games/risk/battle.ts:12`, `games/parchisi/rules.ts:233`, `games/farkle/rules.ts:84`, `games/yahtzee/rules.ts:148`
- Modify: `src/components/Dice.tsx` (export a `Die`), `games/backgammon/client/Dice.tsx`, `games/catan/client/Dice.tsx`, `games/monopoly/client/Dice.tsx`, `games/parchisi/client/DiceTray.tsx`, `games/risk/client/BattleDice.tsx`, and their CSS

**Interfaces:**
- Produces: `rollDie(random: Random, faces = 6): number` (`1 + Math.floor(random() * faces)`); `rollDice(count: number, random: Random, faces = 6): number[]`; named export `Die(props: { value: number; className?: string; label?: string; title?: string; animKey?: string })` from `src/components/Dice.tsx`, used by the default `Dice` row. The games' existing `Math.min(6, ...)` guards go away: `Random` is in [0, 1), and the e2e dice queue (`Math.floor(random * 6) + 1`) still yields the same faces.
- Each game keeps its own wrapper, classes (`used`, `underneath`, `die-attack`, `die-defend`), aria-labels and totals; its old `.die`/`.pip` look is kept by its scoped CSS or the `--dice-*` variables.

- [ ] **Step 1: Write failing tests:** `rollDie maps random to faces` (`rollDie(() => 0) === 1`, `rollDie(() => 0.999) === 6`, `rollDie(() => 0.5, 20) === 11`); `rollDice rolls count dice in order`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; switch the seven server rolls and five client components.
- [ ] **Step 4:** Unit tests, typecheck, lint, e2e for the seven games: pass. Browser check: Backgammon and Risk dice in light and dark look as on `master`.
- [ ] **Step 5:** Commit(s) `refactor: shared dice rolling and die drawing`.

### Task 8: Rook on the shared trick helpers, and trick move text

**Files:**
- Modify: `games/rook/rules.ts:83-100`, `shared/tricks.ts` (add `describeTrickPlay`), `shared/tricks.test.ts`, `games/{rook,spades,euchre}/client/describeMove.ts`

**Interfaces:**
- Consumes: `canFollow`, `trickWinner` from `shared/tricks.ts`.
- Produces: `describeTrickPlay(played: string, player: Seat, trickWinner: Seat | null, playerNames: Record<Seat, string>): string` returning `played`, `` `${played} and took the trick` `` or `` `${played}; ${name} took the trick` `` (as `games/rook/client/describeMove.ts`).
- Rook: `canPlayCard` keeps "the Rook may always be played" before calling `canFollow` with `suitOf(c, trump)`; `trickWinner` calls the shared one with a rank that puts the Rook above every trump (and `suitOf` mapping it to trump).

- [ ] **Step 1: Write failing test** `describeTrickPlay names who took the trick` (all three cases).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; switch Rook's rules and the three `describeMove` files.
- [ ] **Step 4:** Unit tests (Rook's trick tests unchanged), typecheck, lint, e2e for rook, spades, euchre: pass.
- [ ] **Step 5:** Commit `refactor: Rook on the shared trick helpers`.

### Task 9: Standard deck with filters and jokers

**Files:**
- Modify: `shared/playingCards.ts`, `shared/playingCards.test.ts`, `src/components/PlayingCard.tsx`, `src/App.css`, `games/euchre/rules.ts:35-36`

**Interfaces:**
- Produces: `type DeckOptions = { ranks?: readonly Rank[]; suits?: readonly Suit[] }`; `type JokerCard = { joker: number }` (1-based index); `type DeckCard = PlayingCard | JokerCard`; overloads `standardDeck(options?: DeckOptions): PlayingCard[]` and `standardDeck(options: DeckOptions & { jokers: number }): DeckCard[]` (jokers appended after the suits, in index order); `isJoker(card: DeckCard): card is JokerCard`; `cardName` and `sameCard` accept `DeckCard` (`'joker'` for a joker; jokers equal by index). `PlayingCard` component accepts `DeckCard` and draws a joker face (a "JOKER" label and a star in the corners, `aria-label="joker"`).
- `standardDeck()` with no options returns exactly today's 52 cards in today's order.

- [ ] **Step 1: Write failing tests:** `the default deck is unchanged` (52, first ace of clubs, last king of spades); `ranks filter keeps Euchre's 24`; `suits filter keeps one suit`; `jokers are appended and named`; `jokers compare by index`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; switch Euchre's deck to `standardDeck({ ranks: [...] })`; add the joker face to the component and CSS.
- [ ] **Step 4:** Unit tests, typecheck, lint, e2e for euchre, hearts, spades, holdem, war, gofish: pass.
- [ ] **Step 5:** Commit `feat: standard deck filters and jokers`.

### Task 10: Animation keys and Scrabble's shuffle

**Files:**
- Create: `src/animation/animKeys.ts`
- Modify: `games/{rook,spades,euchre,hearts,thecrew,uno}/client/animateMove.ts` and their importers; the `seatKey` copies in `games/{dominoes,gofish,holdem,rummikub,scrabble}/client/`; `games/scrabble/client/PlayArea.tsx:22-28`

**Interfaces:**
- Produces: `handKey(slot: number): string` (`` `hand-${slot}` ``), `seatKey(seat: Seat): string` (`` `seat-${seat}` ``), `trickKey(seat: Seat): string` (`` `trick-${seat}` ``). A game whose copy uses a different string keeps its own.
- Scrabble calls `shuffle(items, Math.random)` from `shared/shuffle.ts`.

- [ ] **Step 1:** Switch the copies (the key strings are pinned by the games' existing animation tests).
- [ ] **Step 2:** Unit tests, typecheck, lint, e2e for the touched games: pass.
- [ ] **Step 3:** Commit `refactor: shared animation keys`.

### Task 11: Docs, full verification and the PR

- [ ] **Step 1:** `docs/architecture.md`: Contracts and platform sections list `shared/categories.ts`, `shared/rounds.ts`, `shared/partnerships.ts`, `shared/hands.ts`, `shared/dice.ts`, the `standardDeck` options, `RoundSummaryDialog`, `Die`, `src/text.ts`, `src/animation/animKeys.ts`, and say each game declares a `category`. Main README: the landing page sentence mentions the groups.
- [ ] **Step 2:** `npm test`, `npm run typecheck`, `npm run lint`, full `npm run test:e2e` (stop any leftover `server/server.ts` processes first; rerun only failures that also fail on `master` load). Expected: all pass.
- [ ] **Step 3:** Browser check of the landing page and one game per category, light and dark.
- [ ] **Step 4:** Push the branch, open one PR with `gh pr create --base master`, listing each shared piece, the games switched to it, any game that kept its copy and why, and test results.
