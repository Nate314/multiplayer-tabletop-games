# Code Breaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Coordinator note (overrides anything below):** one-line registration entries are allowed in `games/registry.ts`, `src/clientGames.ts`, `games/infos.ts`, `shared/svg/gameIcons.ts` (this game's landing icon), `shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`, the game count in `e2e/landing.spec.ts`, and `server/assets/registry.ts` for this game's server SVGs. Make them yourself; do not stop to ask, and do not leave a test failing for want of one. List them in the PR description. Other agents edit the same lines, so expect the coordinator to resolve conflicts.
> **Coordinator note, puzzle modes:** chunk 0 also provides `GameDefinition.allowsUndoVote?(state): boolean`; return false in Together and Race so the server itself refuses the room-wide undo vote. Set `ownTurnLimit: true` in `GameInfo` (chunk 0 redefines it as "own turn limit or no turns"). `e2e/fixtures.ts` `seat()` supports one player after chunk 0.

**Goal:** Add Code Breaker, a Bulls and Cows style colored-peg code-breaking game in the Puzzles category, with four modes: Classic (two players take turns as maker and breaker), Solo, Together and Race.

**Architecture:** A new folder `games/codebreaker/` on the `GameDefinition` contract, using chunk 0's `shared/puzzleModes.ts` for the mode rule, race boards and contributions, and `shared/rounds.ts` for Classic's Continue between rounds. One pure module (`feedback.ts`) scores a guess; `rules.ts` holds the four modes; `toPublicState` hides the code from everyone but its maker (nobody, when the computer made it) until it is revealed, and hides other players' Race boards.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-nine-new-games-design.md`, sections "Shared ground", "Rules for every game agent" and "Code Breaker". Builds on `docs/superpowers/plans/2026-10-31-10-shared-puzzle-modes.md` (chunk 0), which must be merged into `nine-new-games` first.

**Branch:** `game-codebreaker` in its own worktree, from `nine-new-games` after chunk 0 is merged. Server `PORT=3318`, `E2E_PORT_BASE=6880` (never 6000). PR into `nine-new-games`.

## Global Constraints

- The word "Mastermind" never appears in any name, copy, comment, README, FAQ or test of this game (the trademark). The game is "Code Breaker", id `codebreaker`, category `'puzzle'`.
- Rules from Wikipedia's "Bulls and Cows" article; every difference listed in `games/codebreaker/README.md` under "Differences from Wikipedia", in the format of `games/rook/README.md`. Where the spec disagrees with Wikipedia, the spec wins.
- **Code** house rule: 4 pegs from 6 colors (standard) or 5 pegs from 8 colors. Repeated colors allowed. 10 guesses per code.
- **Modes:** Classic offered at exactly 2 seats, Solo at 1, Together and Race at 2 or more. Standard: Solo at 1, Classic at 2, Together at 3 or more.
- **Classic:** 2 rounds each as maker (4 rounds), the breaker scores 1 point per guess used, plus 1 more if they fail all 10 (11). Lowest total wins; equal totals share the win.
- **Race:** fewest guesses wins, ties broken by who finished first. The game ends once no player still guessing can match or beat the best result.
- The code is hidden from every browser except its maker (in Solo, Together and Race, from everyone) until it is broken or the guesses run out, including History (viewer `null`), game files, `lastMove`, `gameStatus` and spectators.
- Pegs carry the site's color-blind symbols (`ColorSymbol`).
- `minPlayers: 1`, `maxPlayers: 6`, `continuesAlone: true`.
- Files outside `games/codebreaker/`: one line each in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `games/secretState.test.ts` (`WITH_SECRET`), `games/privateSeatView.test.ts` (`CASES`); the root `README.md` game list and count; `docs/architecture.md` only where it lists games by name; `e2e/codebreaker.spec.ts`. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in code comments, README, FAQ or commit messages.

## Review Focus

1. A guess with repeated colors against a code with repeated colors (code red red green green, guess green green green green) counts each code peg at most once: exact first, then color-only from what is left (Task 1).
2. A breaker or spectator reads the raw WebSocket frames, the History dialog or `lastMove` mid-round in Classic and sees the maker's code; a Race player sees another player's guesses or answer pegs: the views tests read every view and every history step for the code and other boards (Task 4).
3. The host switches the Code rule from 4 of 6 to 5 of 8 in the lobby after the computer drew a code: the code is redrawn at the new length, since `resetLobby` runs after every house rule change (Task 3).
4. A Race player who has broken the code or run out undoes their own last guess to play on knowing the answer: `undoOwn` on a finished board is refused (Task 3).
5. A Classic player leaves mid-game: the remaining player wins at once, as in Chess, even though the game sets `continuesAlone` (Task 2).

---

### Task 1: Folder, options, types and feedback

**Files:**
- Create: `games/codebreaker/info.ts`, `games/codebreaker/options.ts`, `games/codebreaker/types.ts`, `games/codebreaker/feedback.ts`
- Test: `games/codebreaker/feedback.test.ts`, `games/codebreaker/options.test.ts`

**Interfaces:**
- Consumes (chunk 0): `modeRule`, `ModeChoice`, `PuzzleMode`, `RaceBoards`, `RaceProgress`, `Contributions` from `shared/puzzleModes.ts`; `offeredChoices`, `standardOf` from `shared/houseRules.ts`.
- Produces (`options.ts`):
  - `type Mode = PuzzleMode | 'classic'`
  - `CODEBREAKER_MODE: ChoiceRule<Mode>` = `modeRule<'classic'>([{ value: 'classic', label: 'Classic', offered: seats => seats === 2 }], seats => seats === 1 ? 'solo' : seats === 2 ? 'classic' : 'together')`
  - `CODE_RULE: ChoiceRule<'4of6' | '5of8'>`: id `code`, label `Code`, standard `'4of6'`, choices `4 pegs, 6 colors` and `5 pegs, 8 colors`, help `Repeated colors are allowed. 10 guesses per code.`
  - `CODEBREAKER_RULES: HouseRule[] = [CODEBREAKER_MODE, CODE_RULE]`
  - `COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'cyan'] as const` (all have a `COLOR_SYMBOLS` shape); `codeShape(value): { pegs: 4 | 5; colors: Color[] }` (the first 6 or all 8); `MAX_GUESSES = 10`; `ROUNDS_EACH = 2`.
- Produces (`info.ts`): `codebreakerInfo: GameInfo` with `id: 'codebreaker'`, `name: 'Code Breaker'`, `category: 'puzzle'`, description `Work out the hidden row of colored pegs from the clues each guess earns`, `minPlayers: 1`, `maxPlayers: 6`, `houseRules: CODEBREAKER_RULES`, `passAndPlay: false` (Race boards and Together's any-time play do not fit one shared device).
- Produces (`types.ts`):
  ```ts
  type Color = (typeof COLORS)[number];
  type Feedback = { exact: number; colorOnly: number };
  type Guess = { pegs: Color[]; feedback: Feedback; by: Seat };
  type Board = { guesses: Guess[]; broken: boolean };          // finished = broken || guesses.length === MAX_GUESSES
  type RoundResult = { round: number; maker: Seat; breaker: Seat; code: Color[]; guesses: number; broken: boolean; points: number };
  type RoundSummary = RoundResult & { acknowledged: Seat[] };   // Acknowledgeable
  type LastMove =
    | { type: 'setCode'; playerNumber: Seat }
    | { type: 'guess'; playerNumber: Seat; feedback: Feedback; broken: boolean; outOfGuesses: boolean }
    | { type: 'raceGuess'; playerNumber: Seat; guessNumber: number; broken: boolean } // no pegs or feedback
    | { type: 'undoOwn'; playerNumber: Seat };
  type GameState = BaseGameState & {
    phase: 'setting' | 'breaking' | 'summary';  // 'setting' and 'summary' are Classic only
    code: Color[] | null;                      // the secret; null in Classic until the maker sets it
    maker: Seat | null;                        // Classic: this round's maker; null when the computer made the code
    round: number;                             // Classic: 1 to 4; else 1
    board: Board;                              // Classic, Solo, Together
    boards: RaceBoards<Board>;                 // Race only, one per seat
    finishOrder: Seat[];                       // Race: seats in the order their boards finished
    points: Partial<Record<Seat, number>>;     // Classic totals
    rounds: RoundResult[];                     // Classic, finished rounds
    summary: RoundSummary | null;              // Classic, between rounds
    contributions: Contributions;              // Together: guesses per seat
    lastMove: LastMove | null;
  };
  type PublicGameState = Omit<GameState, 'code' | 'boards'> & BasePublicState & {
    code: Color[] | null;      // the maker's own code, or everyone's once revealed; else null
    boards: RaceBoards<Board>; // visibleBoards, or every board for a spectator
    progress: RaceProgress;    // Race: every seat
    guessesUsed: Partial<Record<Seat, number>>; // Race: every seat
  };
  ```
- Produces (`feedback.ts`): `feedback(code: Color[], guess: Color[]): Feedback`. Exact is the count of equal positions; colorOnly is the sum over colors of `min(count in code, count in guess)`, minus exact.

- [ ] **Step 1: Write the failing tests.** `feedback.test.ts`, `'feedback counts exact pegs first and each code peg once'`, as a table of `[code, guess, exact, colorOnly]`:
  - `red red green blue` / `red red green blue`: 4, 0
  - `red green blue yellow` / `yellow blue green red`: 0, 4
  - `red red blue blue` / `blue blue red red`: 0, 4
  - `red green green blue` / `green green green green`: 2, 0
  - `red red green green` / `red green red blue`: 1, 2
  - `red green blue yellow` / `red red red red`: 1, 0
  - `red red red green` / `green red red red`: 2, 2
  - `red green blue yellow` / `orange purple orange purple`: 0, 0
  - `red red green green` / `green green green green`: 2, 0
  - 5 pegs: `pink cyan red red blue` / `red pink cyan blue red`: 1, 4

  `options.test.ts`:
  - `'Solo is the only mode at one seat'`: `offeredChoices(CODEBREAKER_MODE, 1, {}).map(c => c.value)` is `['solo']` and `standardOf(CODEBREAKER_MODE, 1) === 'solo'`.
  - `'Classic is offered and standard at exactly two seats'`: at 2 the values contain `classic`, `together`, `race` (no `solo`) and `standardOf(..., 2) === 'classic'`.
  - `'three seats offer Together and Race, standard Together'`: at 3 the values are `together` and `race` only and the standard is `together`.
  - `'Classic kept from two seats falls back when a third joins'`: `afterSeatChange(codebreakerInfo, withRules({ mode: 'classic', code: '4of6' }), [1, 2, 3])` (`withRules` from `server/testing.ts`) gives `mode === 'together'`; with `[1]` it gives `'solo'`.
  - `'codeShape gives 4 of the first 6 colors or 5 of all 8'`.
  - `'no file of the game names the trademark'`: walk `games/codebreaker/` and read `e2e/codebreaker.spec.ts` with `fs`, assert none matches `new RegExp(['master', 'mind'].join(''), 'i')`.
- [ ] **Step 2: Run** `node --test games/codebreaker/*.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the four files.
- [ ] **Step 4: Run** `node --test games/codebreaker/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Code Breaker: options, types and feedback`.

### Task 2: Classic rules

**Files:**
- Create: `games/codebreaker/rules.ts`
- Test: `games/codebreaker/rules.test.ts`

**Interfaces:**
- Consumes: Task 1; `acknowledge`, `awaiting`, `type RoundAccess` from `shared/rounds.ts`; `modeOf` from `shared/puzzleModes.ts`; `houseRule` from `shared/houseRules.ts`.
- Produces (`rules.ts`): `createGameState(gameId)`, `resetLobby(state, random)`, `applyMove(state, seat, move, random)`, `applyAction(state, seat, action, random)`, `onPlayerLeft(state, seat, random)`, `waitingOn(state)`, `finalStandings(state)`, and the helpers `modeIn(state): Mode`, `isFinished(board: Board): boolean`, `isRevealed(state): boolean` (Classic: phase `summary` or game over; other modes: game over).
- Moves (Classic): `{ type: 'setCode', pegs: Color[] }` by the maker while `setting`; `{ type: 'guess', pegs: Color[] }` by the breaker while `breaking`. Action: `{ type: 'continue' }` during `summary`.
- Errors: `Pick ${pegs} colors` (wrong length or a color outside `codeShape`), `Wait for the code` (guess while setting), `Nothing to continue`.

Decisions:
- Round `r` (1 to 4): maker is `activePlayers[(r - 1) % 2]`, breaker the other; `currentPlayer` is the maker while `setting`, the breaker while `breaking`.
- A guess that breaks the code or is the 10th ends the round: `points[breaker] += guesses + (broken ? 0 : 1)`, push a `RoundResult`, `phase: 'summary'`, `summary` with `acknowledged: []`. Continue goes through `acknowledge` with a `RoundAccess` (`noun: 'round'`); everyone ready starts round `r + 1` (`setting`, empty board, `code: null`) or, after round 4, ends the game: `winners` the seats with the lowest total, status `<names> won with <n> points` (or `... tied with <n> points`).
- `gameStatus` and `lastMove` never contain the code. Round-end status: `<breaker> broke the code in <n> guesses` or `<breaker> ran out of guesses`.
- `onPlayerLeft` in Classic (called with one left, since `continuesAlone`): game over, `winners: [remaining]`, status `<name> wins! Everyone else left.` (the platform's wording).
- `waitingOn`: `awaiting(state, ROUND)` during `summary`, else `[]`.
- `finalStandings`: `rankStandings` by total ascending, score text `pointsText(total)`.

- [ ] **Step 1: Write the failing tests** (two seats, mode `classic` via `withRules`, `seeded` from `games/testStates.ts`):
  - `'the maker sets a code and the breaker guesses'`: round 1 has `phase === 'setting'` and `currentPlayer === 1`; a `guess` from seat 1 then is `{ error: 'Wait for the code' }`; after `setCode` `currentPlayer === 2` and `phase === 'breaking'`.
  - `'a code of the wrong length or color is refused'`: 3 pegs, and `pink` under `4of6`, both `{ error: 'Pick 4 colors' }`.
  - `'each guess gets its feedback'`: `board.guesses[0].feedback` equals `feedback(code, pegs)`.
  - `'breaking in 3 scores 3, failing all 10 scores 11'`.
  - `'rounds alternate maker and the game ends after 4 rounds with the lowest total winning'`: totals 3 + 11 against 5 + 5: seat 2 (10) wins; a 7-7 tie gives `winners: [1, 2]`.
  - `'Continue waits for both players'`: `waitingOn` is `[1, 2]`, then `[2]` after seat 1 continues.
  - `'status and lastMove never hold the code'`: `JSON.stringify({ gameStatus, lastMove })` contains no color name after every move of a full round.
  - `'the player left behind wins'`: `onPlayerLeft({ ...mid, activePlayers: [1] }, 2, ...)` is over with `winners: [1]` and status `Alice wins! Everyone else left.`
- [ ] **Step 2: Run** `node --test games/codebreaker/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the Classic paths in `rules.ts`.
- [ ] **Step 4: Run** `node --test games/codebreaker/rules.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Code Breaker: Classic rounds and scoring`.

### Task 3: Solo, Together and Race rules, own-move undo

**Files:**
- Modify: `games/codebreaker/rules.ts`
- Test: `games/codebreaker/modes.test.ts`

**Interfaces:**
- Consumes: Task 2; `playsAtOnce`, `raceProgress`, `addContribution` from `shared/puzzleModes.ts`.
- Produces (`rules.ts`): `recordsAction(state, seat, action): boolean` (true for a valid-looking `guess` action while `playsAtOnce(modeIn(state))` and not over), `undoOwn(state, seat): Result<GameState>`, `progressOf(board: Board, pegs: number): number` (100 when broken, else `Math.round(100 * best exact / pegs)`).
- Solo: `guess` is a move by the only seat (`currentPlayer` is that seat); normal undo applies.
- Together and Race: `guess` is an action from any seated player at any time; `currentPlayer` is `null` from `resetLobby` on, so no turn timer runs.

Decisions:
- `resetLobby` in Solo, Together and Race draws the code at random from `codeShape(houseRule(state, CODE_RULE))` with `maker: null`; it runs after every seat and house rule change, so the code always matches the current rule. Race gets an empty board per active seat.
- Solo ends when broken (`winners: [seat]`) or after 10 (`winners: []`, status `The code was not broken`). Standings score `Broken in <n> guesses` or `Not broken`.
- Together: guesses go on the one `board`, each with its `by`; `contributions` counts them. Broken: everyone wins; 10 used: `winners: []`. Standings score `plural(n, 'guess')`.
- Race: each guess goes on the guesser's own board. A board finishes when broken or at 10; a broken board's seat goes on `finishOrder`. Let `best` be the fewest guesses among broken boards. The game ends when every board is finished, or when every unfinished board already has at least `best` guesses. Winner: the first in `finishOrder` with `best` guesses; nobody broke it, `winners: []`. Standings: broken seats by guesses then `finishOrder`, then the rest by `progressOf` descending.
- A guess on a finished Race board is refused `Your board is finished`.
- `undoOwn` (Together): removes that seat's most recent guess from `board.guesses` wherever it is, and `addContribution(counts, seat, -1)`. `undoOwn` (Race): removes the last guess of the seat's own board; refused `Your board is finished` when it is finished. Both refuse `Nothing of yours to undo` when the seat has no guess. In Solo and Classic `undoOwn` returns `{ error: 'Use Undo' }`.
- `onPlayerLeft` in Together and Race: the leaver's Race board is dropped and the end check runs again; play goes on with whoever is left.
- `waitingOn`: Race, the seats with unfinished boards; Together, `[]`.

- [ ] **Step 1: Write the failing tests** in `modes.test.ts`:
  - `'Solo: the computer draws a code of the rule's length'`: with `code: '5of8'` the code has 5 pegs from `COLORS`; changing the rule to `4of6` and calling `resetLobby` again gives 4 pegs from the first 6.
  - `'Solo: breaking wins, ten misses lose'`.
  - `'Together: any seat may guess and contributions count each'`: seats 1, 2, 1 guess; `contributions` is `{ 1: 2, 2: 1 }`; `currentPlayer === null`.
  - `'Together: undoOwn takes back only my last guess'`: guesses by 1, 2, 1, 2; seat 1 `undoOwn` leaves guesses by 1, 2, 2; seat 3 `undoOwn` is `{ error: 'Nothing of yours to undo' }`.
  - `'Race: each board is its own'`: seat 1's guess does not appear on seat 2's board.
  - `'Race: a player who can still match the best keeps the game going'`: seat 1 breaks in 4; seat 2 at 3 guesses: not over; seat 2's 4th guess misses: over, `winners: [1]`.
  - `'Race: a tie in guesses goes to who finished first'`: seat 1 breaks in 4, seat 2 then breaks in 4: `winners: [1]`, standings place seat 2 second.
  - `'Race: nobody breaks it and every board runs out'`: `winners: []`, standings by `progressOf`.
  - `'Race: undoOwn is refused on a finished board'`.
  - `'Race: a guess on a finished board is refused'`.
  - `'Race: the last player still guessing leaving ends the game'`: seat 1 broken in 5, seat 2 at 2 guesses leaves with seat 3 finished: over.
  - `'recordsAction is true for a Together or Race guess and false in Classic'`.
- [ ] **Step 2: Run** `node --test games/codebreaker/modes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three modes and `undoOwn`.
- [ ] **Step 4: Run** `node --test games/codebreaker/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Code Breaker: Solo, Together and Race`.

### Task 4: Hidden views, registration and manager test

**Files:**
- Modify: `games/codebreaker/rules.ts` (`toPublicState`, `spectatorState`)
- Create: `games/codebreaker/index.ts`, `games/codebreaker/manager.test.ts`, `games/codebreaker/views.test.ts`
- Modify: `games/registry.ts`, `games/infos.ts`, `games/secretState.test.ts` (add `'codebreaker'` to `WITH_SECRET`), `games/privateSeatView.test.ts` (a `codebreaker` entry in `CASES`: a Classic state in `breaking` with seat 1's code set, and a Race state with a guess on each board)
- Test: the above, plus `games/standings.test.ts` and `games/infos.test.ts` unchanged

**Interfaces:**
- Consumes: Tasks 2 and 3; `visibleBoards`, `raceProgress` from `shared/puzzleModes.ts`; `seatFields` from `shared/spectators.ts`.
- Produces (`index.ts`): `codebreaker: GameDefinition<GameState, PublicGameState>` with `continuesAlone: true`, `undoOwn`, `recordsAction`, `applyAction`, `waitingOn`, `finalStandings`, `onPlayerLeft`, `toPublicState`, `spectatorState`, `privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['code', 'boards'])`, `secretState: state => state.maker === null && !isRevealed(state) ? seatFields(state, ['code']) : {}`.

Decisions:
- `toPublicState(state, undo, viewer)`: `code` is the code when `isRevealed(state)` or `viewer === state.maker` (non-null), else `null`. `boards` is `visibleBoards(state.boards, viewer, state.isGameOver)`. `progress` is `raceProgress(state.boards, b => progressOf(b, pegs))`; `guessesUsed` counts every board.
- `spectatorState`: as the `null` view but with every Race board (spectators see every board), never the code before reveal.
- Every recorded step (move, recorded action, `undoOwn`) is built by the platform through `toPublicState`, so History and game files follow the same rules.

- [ ] **Step 1: Write the failing tests.**
  - `views.test.ts`, with a helper that serializes a view and checks for the code as a JSON array:
    - `'Classic: only the maker sees the code before the round ends'`: views for `null`, the breaker, and `spectatorState` hold no code; the maker's does; after the round ends all do.
    - `'Solo, Together, Race: nobody sees the code before game over'`: every viewer, `null` and `spectatorState`, in the lobby and mid-game; all see it once over.
    - `'Race: a player sees only their own board, progress and counts of the others'`: seat 1's view has `boards` keys `['1']`, `progress` and `guessesUsed` for every seat; `null` has `{}`; `spectatorState` has every board; after game over every view has every board.
    - `'secretState names the code exactly when the computer made it'`.
  - `manager.test.ts` through `createGameManager([codebreaker], seeded(42))` with `rememberingKeys` and `agreeAll`:
    - `'a Classic game plays four rounds to a winner'`: set codes, guess, Continue, check `isGameOver` and standings.
    - `'no history step or view shows a Classic code to the breaker before the reveal'`: after the maker sets a code and the breaker guesses twice, `stepsOf(manager, 'codebreaker')` and `manager.getState(room, 2)` hold no step whose `code` is non-null; `fileOf` is refused until game over.
    - `'Together guesses from two seats are both recorded and never refused as stale'`: two actions without `moveCount` both succeed; `stepsOf` grows by two; `undoOwn(room, 1)` grows it by one more.
    - `'Race: the history never shows another board during play'`: every step in `stepsOf` has `boards` equal to `{}` while not over.
    - `'Solo: one player starts, plays and undoes at once'`: one join, `agreeAll`, guess, `requestUndo` restores the empty board with no vote.
- [ ] **Step 2: Run** `node --test games/codebreaker/*.test.ts games/*.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the views, `index.ts`, and the five one-line registrations.
- [ ] **Step 4: Run** `node --test games/codebreaker/*.test.ts games/*.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Code Breaker: hidden views and registration`.

### Task 5: Client

**Files:**
- Create in `games/codebreaker/client/`: `GameScreen.tsx`, `Peg.tsx`, `GuessRows.tsx`, `ColorPicker.tsx`, `RaceProgress.tsx`, `RoundRows.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `index.ts`, `codebreaker.scss`
- Modify: `src/clientGames.ts` (one line)
- Test: `games/codebreaker/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PublicGameState` (Task 1), `GameScreenProps`, `ClientGame` from `src/clientGames.ts`; `gameService.makeMove`, `sendAction`, `requestUndo`, `undoOwn` (chunk 0); `ColorSymbol`; `RoundSummaryDialog`.
- Produces: `codebreakerClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `gameLength` (Classic `4 rounds`, else `plural(n, 'guess')`), `FinalRound` (Classic only: the four `RoundRows`).

Decisions:
- `Peg` draws one round peg in its color with `ColorSymbol` inside it, `aria-label` the color name; an empty slot is an outlined hole. Answer pegs: a dark filled peg per exact, a light ringed peg per color-only, and the text `2 right place, 1 right color` under `visually-hidden` for screen readers and a `title` on hover.
- `ColorPicker`: one button per color in the rule (`aria-label` `Red` and so on), clicking fills the first empty slot of the draft row; clicking a draft peg empties it; **Clear** empties the row; **Submit guess** (or **Set code** for the Classic maker) is enabled when the row is full. The draft is local to the browser.
- `GuessRows`: 10 rows, newest at the bottom, each with its pegs, its answer pegs and, in Together, the guesser's name. The code row is at the top: covered holes with `?` until `code` is non-null.
- Race: `GuessRows` for my own board, `RaceProgress` listing each other seat with `guessesUsed` of 10 and `progress` percent (`Broken` once 100).
- Undo: Classic and Solo show **Undo** (`requestUndo`); Together and Race show **Undo my last move** (`gameService.undoOwn()`).
- Classic between rounds: `RoundSummaryDialog` with the revealed code and the round's points; Continue sends `{ type: 'continue' }`.
- `describeMove` texts: `Alice set a code`; `Bob guessed: 2 right place, 1 right color`; `Bob broke the code in 5 guesses`; `Bob ran out of guesses`; Race `Bob made guess 3` and `Bob broke the code in 3 guesses`; `Bob took back a guess`.
- Layout: board column and picker side by side at laptop width, stacked below 640 px, pegs at least 32 px for touch.

- [ ] **Step 1: Write the failing test** `describeMove.test.ts` with one public state per `LastMove` kind, asserting the texts above exactly.
- [ ] **Step 2: Run** `node --test games/codebreaker/client/describeMove.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client files and the `src/clientGames.ts` line.
- [ ] **Step 4: Run** `node --test games/codebreaker/client/*.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Code Breaker: screen, history and FAQ`.

### Task 6: README, docs and end-to-end tests

**Files:**
- Create: `games/codebreaker/README.md`, `e2e/codebreaker.spec.ts`
- Modify: `README.md` (game list and the count in its first sentence), `docs/architecture.md` (only where it lists games by name)

**Interfaces:**
- Consumes: the screen's labels from Task 5; `seat`, `table.patch`, `inHouseRules`, `undo`, `leave`, `openFaq` from `e2e/fixtures.ts` (unchanged).

README decisions (`games/codebreaker/README.md`, sections Rules, Controls, Differences from Wikipedia, linking [Wikipedia's Bulls and Cows article](https://en.wikipedia.org/wiki/Bulls_and_Cows)). Differences to list, from the article as read:
- Wikipedia plays with digits (usually four, all different); here colored pegs, 4 from 6 colors or 5 from 8, and repeated colors are allowed, so the count is exact pegs first, then right color from what is left, each code peg counted once.
- Wikipedia's "bulls" and "cows" are shown here as dark and light answer pegs, labeled right place and right color.
- Wikipedia has both players set a secret and guess at the same time, first to break the other's wins, with no guess limit and no scoring. Here Classic has one maker and one breaker per round, 4 rounds, 10 guesses each, and the breaker scores 1 per guess plus 1 for failing; lowest total wins.
- Solo, Together and Race, and the computer setting the code, are not in Wikipedia.
- Wikipedia's word version (letters spelling a word) is not offered.
- Accepted risk to state in Rules: the platform allows Undo after game over, so a Solo player could undo the last guess after seeing the code.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/codebreaker.spec.ts`**, one test per rule, control and difference in the README, each patching a known code with `table.patch`. At least: Solo at one seat offers only Solo in House rules; two seats default to Classic and offer Together and Race; three seats default to Together; Classic set code, guess, answer pegs match `feedback`, the breaker's page never shows the code before the round ends (read the page and the WebSocket frames for the code); Continue starts round 2 with the other maker; four rounds end with the lowest total winning; a repeated-color guess shows the right answer pegs; Together guesses from two pages and Undo my last move; Race: a page shows only its own rows and the other's progress, the game ends when the other cannot match; switching Code to 5 pegs shows 5 slots and 8 colors; color-blind symbols appear on pegs with the setting on; History during Race shows no boards; leaving Classic makes the other player win; FAQ opens.
- [ ] **Step 3: Run** `npx vite build` then `E2E_PORT_BASE=6880 npx playwright test e2e/codebreaker.spec.ts`. Expected: PASS.
- [ ] **Step 4: Update** the root `README.md` list and count and the game lists in `docs/architecture.md`.
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS except `shared/categories.test.ts` and `src/games/loadClientGame.test.ts` on `codebreaker` (see Task 7).
- [ ] **Step 6: Commit** `Code Breaker: README, docs and end-to-end tests`.

### Task 7: Browser check and pull request

**Files:** none new.

- [ ] **Step 1:** In the worktree, `npm ci`, `npx vite build`, then `PORT=3318 node server/server.ts` (see the memory note on the nvm PATH workaround; never port 6000).
- [ ] **Step 2: Play every mode in Chrome**, one tab per player: Solo to a break and to 10 misses; Classic through all 4 rounds; Together with 2 tabs, both guessing and each using Undo my last move; Race with 3 tabs to the early end. In each, open History and check the code and other Race boards are hidden mid-game; after game over download the game file and open it with View as each seat.
- [ ] **Step 3: Check layout** at a laptop width and at phone width (iframes, as in the memory note) in every mode: no overlap, no blank rows, the picker and Submit guess reachable, symbols visible with the color-blind setting on, in light and dark themes.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint && E2E_PORT_BASE=6880 npx playwright test e2e/codebreaker.spec.ts`. Expected: PASS except the two shared tests named in Task 6.
- [ ] **Step 5: Push and open the PR:** `git push -u origin game-codebreaker`, then `gh pr create --base nine-new-games` titled `Code Breaker`. The description lists the modes, the Differences from Wikipedia, and, for the coordinator, the two shared lines this game needs but may not edit: `codebreaker` in `puzzle` in `shared/categories.test.ts` (and its game count), and a `codebreaker` icon in `shared/svg/gameIcons.ts` (a row of four pegs over two small answer pegs, drawn with `lineIcon` like the others).
