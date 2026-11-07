# Road to Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Road to Retirement, an original career race for 2 to 6 players in Classic board games, with a "Board" house rule that switches to the 1860 Checkered board (Milton Bradley's public-domain *The Checkered Game of Life*, drawn with this project's own art).

**Architecture:** A new folder `games/roadtoretirement/` on the `GameDefinition` contract. One game state holds the chosen board's sub-state (`road` or `checkered`); `rules.ts` dispatches each hook to `roadRules.ts` or `checkeredRules.ts`. Pure data lives apart from the rules: `content.ts` (careers, houses), `road.ts` (the winding path and its forks) and `checkered.ts` (the 8 by 8 layout and teetotum moves). Nothing is hidden: careers and houses are drawn with the move's `random`, so there is no deck to keep secret and no `secretState`.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Goals", "Rules for every agent", "Road to Retirement" and "Left to the builders". The spec's chunk table names this chunk `game-roadtoretirement`; an older copy may say `game-careerpath` (the name that failed the web search); the game is Road to Retirement.

**Branch:** `game-roadtoretirement` in its own worktree `C:/Users/Natha/Documents/code/mtg-wt/game-roadtoretirement`, from `party-games-and-polish`. Site `PORT=3406`, e2e `E2E_PORT_BASE=8600` (never 6000). PR into `party-games-and-polish`.

## Global Constraints

- Id `roadtoretirement`, name `Road to Retirement`, category `'classic'` (Classic board games), `minPlayers: 2`, `maxPlayers: 6`.
- "An original career race on a winding path (my call: about 90 spaces), with a spinner of 1 to 10."
- "All job, house and event texts are original." No name, card text, art or board layout copied from the commercial game. The commercial game's name appears only in the README's Wikipedia link and its one descriptive line.
- Rules from [Wikipedia's The Game of Life article](https://en.wikipedia.org/wiki/The_Game_of_Life), rules only; every difference in `games/roadtoretirement/README.md` under "Differences from Wikipedia", in the format of `games/rook/README.md`. Where the spec disagrees with Wikipedia, the spec wins.
- House rules: **Board** (`board`, choice, `'road'` labeled `Road to Retirement` or `'checkered'` labeled `1860 Checkered`, standard `'road'`); **Game length** (`length`, `'short'` labeled `Short` or `'full'` labeled `Full`, standard `'full'`); **Starting cash** (`startingCash`, 10000, 25000 or 50000 labeled `$10,000` and so on, standard 25000). Game length and Starting cash are offered only with the Road to Retirement board.
- 1860 Checkered, copied from the spec: "An 8 × 8 checkerboard. Pieces stand on the light squares, which carry the named squares; start is Infancy in the bottom-left corner and the goal is Happy Old Age in the top-right corner, worth 50 points." "A spinner of 1 to 6 (the original teetotum). 1: one square up or down; 2: one square left or right; 3: one square diagonally; 4: one or two squares up or down; 5: one or two squares left or right; 6: one or two squares diagonally. The player chooses among the legal moves." "Named squares send you on (for example Bravery to Honor, School to College, Honesty to Happiness, Industry to Wealth, Gambling to Ruin, Idleness to Disgrace, Crime to Prison) and score points (Wealth 10; Honor, Happiness, College, Success, Fat Office and Congress 5 each). Prison loses a turn." "The square named Suicide in the original is renamed **Despair** (my call) and sends the player back to Infancy with all points lost." "Win: land on Happy Old Age with at least 100 points counting its 50. Arriving short, keep playing and collect more."
- "The exact square layout is copied from a public-domain scan of the 1860 board (for example the Smithsonian's or the Library of Congress's); the README cites the scan used and lists anything that could not be read." Disagreements among the secondary sources (Wikipedia, thebiggamehunter.com, baldwin-games.com) are settled from the scan's printed rules where readable, every choice listed in the README.
- Every turn move is undoable by vote (a replayed spin may land differently, as in every dice game here).
- Files outside `games/roadtoretirement/`: one line each in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `shared/categories.test.ts`; and `e2e/roadtoretirement.spec.ts`. Not the root README game list or count, not `e2e/landing.spec.ts`, not `docs/architecture.md`, not `e2e/fixtures.ts`. A needed platform or fixture change not listed here: stop and report it.
- New e2e specs reach header controls only through `headerButton(page, name)` from `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in code comments, README, FAQ or commit messages.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

## Coordinator decisions to confirm (reported, not silently resolved)

- **Teetotum moves on light squares.** On a checkerboard, a one-square move up, down, left or right always lands on a dark square, so the spec's moves and "Pieces stand on the light squares" cannot both hold literally. This plan counts light squares: "one square up or down" is the next light square in the same column (two rows), "one square left or right" the next light square in the same row (two columns), "one square diagonally" the diagonal neighbor (always light). If the scan's printed rules say otherwise, the builder follows the scan (as the spec allows) and lists it.
- **Arriving short at Happy Old Age.** The plan does not bank its 50 points: they count only for the win check on arrival, so a second short arrival does not win by repetition. The README lists it.

## Review Focus

1. A spin that runs past a stop space or a payday: the token stops on the stop space with the rest of the spin lost, and collects salary for every payday passed or landed on (Task 4).
2. Money below zero more than once in one move, and at retirement loans that outweigh the cash: each shortfall takes whole loans, the repayment can leave the final worth negative, and standings rank negative worths correctly (Task 4).
3. A fork reached mid-spin: the move pauses with the steps left, the choice continues it, and an undo of the choice returns to the paused fork (Tasks 4 and 6).
4. On the 1860 board, a spin with no legal move at an edge or corner, and a send-on square whose target is itself a send-on square: the turn passes with a status line, and a send does not chain (Task 5).
5. A dismissal of the player whose turn is waiting on a choice (job, house, fork, teetotum move): the next player starts a fresh turn, and the game ends once every player left has retired (Tasks 4 and 5).

---

### Task 1: Worktree, branch and port

**Files:** none in the repo.

- [ ] **Step 1: Create the worktree** from the pushed `party-games-and-polish`:
  ```bash
  cd C:/Users/Natha/Documents/code/multiplayer-tabletop-games
  git fetch origin
  git worktree add -b game-roadtoretirement C:/Users/Natha/Documents/code/mtg-wt/game-roadtoretirement origin/party-games-and-polish
  ```
  Expected: `Preparing worktree (new branch 'game-roadtoretirement')`. All later paths are relative to the worktree.
- [ ] **Step 2: Install.** If `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH (memory note). Run `npm ci`. Expected: exit 0.
- [ ] **Step 3: Check the ports are free:** `netstat -ano | grep -E ':(3406|860[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3406 or 8600, and say so in the PR.
- [ ] **Step 4: Baseline:** `npm test && npm run typecheck && npm run lint`. Expected: PASS (note any failure that already exists).

### Task 2: Options, info, types and content

**Files:**
- Create: `games/roadtoretirement/options.ts`, `games/roadtoretirement/info.ts`, `games/roadtoretirement/types.ts`, `games/roadtoretirement/content.ts`
- Test: `games/roadtoretirement/options.test.ts`, `games/roadtoretirement/content.test.ts`

**Interfaces:**
- Consumes: `houseRule`, `offeredChoices`, `standardOf` from `shared/houseRules.ts`.
- Produces (`options.ts`): `BOARD_RULE: ChoiceRule<'road' | 'checkered'>`, `LENGTH_RULE: ChoiceRule<'short' | 'full'>`, `STARTING_CASH_RULE: ChoiceRule<number>` (ids, labels and standards as in Global Constraints; the last two with `offered: (_, values) => values.board !== 'checkered'`), `ROAD_RULES: HouseRule[]` in that order, and readers `boardOf(state)`, `lengthOf(state)`, `startingCashOf(state)`.
- Produces (`info.ts`): `roadtoretirementInfo: GameInfo`: id, name, category, players as in Global Constraints, description `Choose college or work, build a career and a family, and retire the richest`, `houseRules: ROAD_RULES`.
- Produces (`content.ts`): `CAREERS: readonly { id: string; name: string; salary: number; degree: boolean }[]` (at least 8 with `degree: true`, 8 without; degree salaries higher), `HOUSES: readonly { id: string; name: string; price: number; saleValue: number }[]` (at least 8), `careerOf(id)`, `houseOf(id)`. Ids lowercase slugs.
- Produces (`types.ts`):
  ```ts
  type Board = 'road' | 'checkered';
  type Cell = { row: number; col: number };               // row 0 is the top
  type RoadPlayer = {
    space: number; cash: number; loans: number;           // loans: count of LOAN_UNIT taken
    career: string | null; degree: boolean; houses: string[];
    partner: boolean; children: number; retired: boolean; worth: number | null; // worth set on retiring
  };
  type RoadPhase = 'route' | 'spin' | 'fork' | 'career' | 'house';
  type RoadState = { players: Record<Seat, RoadPlayer>; phase: RoadPhase; stepsLeft: number; offer: string[] };
  type CheckeredState = { pieces: Record<Seat, Cell>; points: Record<Seat, number>; skipNext: Seat[]; phase: 'spin' | 'choose'; options: Cell[] };
  type Move =
    | { type: 'route'; choice: 'college' | 'work' }
    | { type: 'spin' }
    | { type: 'fork'; road: 'safe' | 'fast' }
    | { type: 'career'; pick: string | null }             // null keeps the current career
    | { type: 'buyHouse'; pick: string | null }           // null buys nothing
    | { type: 'step'; to: Cell };                         // 1860 board
  type LastMove = { type: Move['type']; playerNumber: Seat; spin?: number; events: string[] }; // events: plain sentences
  type GameState = BaseGameState & { board: Board; road: RoadState | null; checkered: CheckeredState | null; spin: number | null; lastMove: LastMove | null };
  type PublicGameState = GameState & BasePublicState;
  ```

Decisions (my calls where the spec leaves them; each goes in the README): `LOAN_UNIT = 20000`, each repaid `LOAN_REPAY = 25000` at retirement; `COLLEGE_COST = 50000`; `CHILD_BONUS = 25000`; risk spin 1 to 4 loses 20000, 5 to 7 nothing, 8 to 10 gains 50000.

- [ ] **Step 1: Write the failing tests.**
  `options.test.ts`:
  - `'the standard board is Road to Retirement'`: `standardOf(BOARD_RULE, 2) === 'road'`; labels `Road to Retirement` and `1860 Checkered`.
  - `'game length and starting cash are offered only on the road board'`: `LENGTH_RULE.offered!(2, { board: 'checkered' })` is false, with `'road'` true; same for `STARTING_CASH_RULE`.
  - `'starting cash choices'`: values `[10000, 25000, 50000]`, labels `$10,000`, `$25,000`, `$50,000`, standard 25000.
  `content.test.ts`:
  - `'careers and houses have unique ids and sane numbers'`: degree salaries all above the highest non-degree salary; every house `saleValue > 0`.
  - `'no file of the game names the commercial game'`: walk `games/roadtoretirement/` and `e2e/roadtoretirement.spec.ts`, assert no line outside `README.md` matches `/game of life/i`; in `README.md` only the Wikipedia link line, the one descriptive line and the 1860 title (`The Checkered Game of Life`) may.
- [ ] **Step 2: Run** `node --test games/roadtoretirement/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four files.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `Road to Retirement: house rules, types and content`.

### Task 3: The road

**Files:**
- Create: `games/roadtoretirement/road.ts`
- Test: `games/roadtoretirement/road.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type SpaceKind = 'start' | 'payday' | 'job' | 'event' | 'house' | 'family' | 'risk' | 'graduation' | 'marriage' | 'houseStop' | 'retirement' | 'fork';
  type Space = { kind: SpaceKind; text?: string; amount?: number; fullOnly?: true; next: number[] }; // text and amount: event spaces; next has 2 entries at a fork
  ROAD: readonly Space[];                                   // index 0 is start
  START_FORK: { college: number; work: number };            // first space of each branch
  MID_FORK: { space: number; safe: number; fast: number };
  isStop(kind: SpaceKind): boolean;                         // graduation, marriage, houseStop, retirement, fork
  nextSpace(from: number, length: 'short' | 'full'): number; // follows next[0], skipping fullOnly spaces when short; never called at a fork
  pathLength(route: 'college' | 'work', road: 'safe' | 'fast', length: 'short' | 'full'): number;
  ```

Decisions:
- The layout is the builder's (spec "Left to the builders"): the college branch ends at the graduation stop and rejoins the work branch; the mid fork's Safe road is longer with more paydays and gain events, the Fast lane shorter with more risk spaces; both rejoin before retirement. The marriage stop and the house stop come after the branches rejoin. Event texts are original, one sentence each with an amount.
- Coordinates for drawing live in the client (Task 7), not here.

- [ ] **Step 1: Write the failing tests:**
  - `'about 90 spaces on the full road, fewer on the short'`: `pathLength('work', 'safe', 'full')` between 80 and 100; every short length is at least 20 fewer than its full one.
  - `'every space type appears'`: each `SpaceKind` is present.
  - `'both forks rejoin and every path ends at retirement'`: walking `nextSpace` from each branch start reaches the one `retirement` space, for both lengths.
  - `'stop spaces are never fullOnly'`.
  - `'event spaces carry a text and an amount'`.
- [ ] **Step 2: Run** `node --test games/roadtoretirement/road.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `road.ts`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `Road to Retirement: the road`.

### Task 4: Road rules

**Files:**
- Create: `games/roadtoretirement/roadRules.ts`
- Test: `games/roadtoretirement/roadRules.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3; `shuffle` from `shared/shuffle.ts`; `seeded`, `dealt` from `games/testStates.ts`; `withRules` from `server/testing.ts`.
- Produces: `startRoad(state, random): GameState` (for `resetLobby`), `roadMove(state, seat, move, random): Result<GameState>`, `roadLeft(state, seat): GameState`, `roadStandings(state): Standing[]`, `spin(random): number` (`Math.floor(random() * 10) + 1`), `charge(player, amount): RoadPlayer` (takes whole loans when cash would go below zero), `retire(player): RoadPlayer`.

Decisions:
- Start: every player on space 0 with the Starting cash, phase `route` on their first turn. `route: 'college'` charges `COLLEGE_COST` (loans as needed) and sets `degree: true` on graduation; `'work'` offers two random non-degree careers at once (phase `career`, `pick: null` refused while the player has no career).
- `spin`: move one space at a time with `nextSpace`. Passing or landing on a payday pays the salary. Reaching a stop space ends the move there (the rest is lost). Reaching the mid fork sets phase `fork` with `stepsLeft`; `fork` continues the move along the chosen road.
- Landing: `job` offers two random careers the player may hold (degree careers only with a degree), `career` takes one or keeps (`pick: null`); `event` applies `amount`; `house` and `houseStop` offer two random houses not owned by anyone (`buyHouse` buys at `price` through `charge`, or `null` skips); `family` adds a partner if none, else a child; `marriage` adds a partner if none; `risk` spins again and applies the table; `graduation` offers two degree careers; `retirement` calls `retire` (cash plus `saleValue` of each house plus `CHILD_BONUS` per child minus `LOAN_REPAY` per loan, as `worth`; `retired: true`).
- After a landing resolves, the turn passes to the next seat in seat order that has not retired. When every seat has retired, the game is over: `winners` the highest `worth` (ties share), status `<names> retired the richest with $<worth>`.
- `lastMove.events` lists what happened in order, e.g. `['spun 7', 'collected $40,000 on payday', 'landed on an event: <text>']`.
- `roadLeft` (dismissal): the leaver's player record is removed; if the platform moved the turn, the new current player starts in phase `spin` (or `route` if on space 0); if everyone left has retired, end the game as above.
- `roadStandings`: `rankStandings` by `worth` (retired) or a live estimate the same way (not retired, game ended by dismissals), score text `$<worth>` with `toLocaleString('en-US')`.
- Errors: `Choose college or work first`, `Spin first`, `Choose a road`, `Pick one of the careers offered`, `Pick one of the houses offered`, `Not now`.

- [ ] **Step 1: Write the failing tests** (two or three seats, spins queued with a random returning `(n - 0.5) / 10`):
  - `'college costs money and leads to better careers'`: after `route: 'college'` cash is the Starting cash minus 50000, with loans taken if that goes below zero; graduation offers two degree careers.
  - `'straight to work offers two careers at once'`.
  - `'a payday is paid when passed and when landed on'`.
  - `'a stop space stops the move'` (Review Focus 1): a spin of 9 from three spaces before the marriage stop ends on it.
  - `'the mid fork pauses and continues with the steps left'` (Review Focus 3).
  - `'money below zero takes whole loans'` (Review Focus 2): cash 5000, an event of -50000 gives cash 15000 and `loans: 3`; a second shortfall in the same move adds more.
  - `'a house can be bought or skipped and sells at retirement'`.
  - `'family adds a partner first, then children'`.
  - `'risk pays by the table'`: spins 3, 6 and 9 give -20000, 0 and +50000.
  - `'retirement counts houses and children and repays loans'`: a worth that comes out negative is kept negative and ranks last.
  - `'the game ends when everyone has retired and the richest wins'`; equal worths share.
  - `'retired players are skipped'`.
  - `'a short road skips the fullOnly spaces'` with `withRules({ length: 'short' })`.
  - `'dismissing the player at a choice starts the next turn'` (Review Focus 5).
- [ ] **Step 2: Run** `node --test games/roadtoretirement/roadRules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `roadRules.ts`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `Road to Retirement: road rules`.

### Task 5: The 1860 Checkered board

**Files:**
- Create: `games/roadtoretirement/checkered.ts`, `games/roadtoretirement/checkeredRules.ts`
- Test: `games/roadtoretirement/checkered.test.ts`

**Interfaces:**
- Produces (`checkered.ts`):
  ```ts
  type Square = { name: string; points?: number; sendTo?: string; loseTurn?: true; despair?: true; goal?: true };
  SQUARES: Readonly<Record<string, Square>>;    // key `${row},${col}`, light squares only; unnamed light squares absent
  INFANCY: Cell;                                // { row: 7, col: 0 }
  HAPPY_OLD_AGE: Cell;                          // { row: 0, col: 7 }
  GOAL_POINTS = 50; WIN_POINTS = 100;
  isLight(cell: Cell): boolean;                 // (row + col) odd, so both corners are light
  cellOf(name: string): Cell;
  legalMoves(from: Cell, spin: number): Cell[]; // on the board, light squares only, per "Coordinator decisions"
  ```
- Produces (`checkeredRules.ts`): `startCheckered(state): GameState`, `checkeredMove(state, seat, move, random): Result<GameState>`, `checkeredLeft(state, seat): GameState`, `checkeredStandings(state): Standing[]`, `teetotum(random): number` (`Math.floor(random() * 6) + 1`).

**Finding the scan (do this first).** Locate a readable public-domain image of the 1860 board. Candidates to check, in order: the Smithsonian National Museum of American History object `nmah_321475` (https://www.si.edu/object/nmah_321475, also mirrored on DPLA), the Penn Museum object 43609 (https://penn.museum/collections/object/43609), the Strong National Museum of Play copies on Google Arts & Culture, and the Library of Congress catalog. Prefer an image marked open access or public domain. Read every square's name and pointing finger from it. If no source is readable enough to place the named squares, stop and report; do not invent a layout.

Decisions:
- `spin`: a player in `skipNext` loses this turn instead (removed from `skipNext`, the turn passes). Otherwise roll the teetotum; no legal move passes the turn (status `<name> spun <n> and cannot move`); one legal move is made at once; several set phase `choose` with `options`, and `step` picks one.
- Landing: add the square's `points`; if it has `sendTo`, move there and add that square's points (no further send). `loseTurn` adds the seat to `skipNext`. `despair` sends to Infancy with points 0. Landing on Happy Old Age: points plus `GOAL_POINTS` at least `WIN_POINTS` wins (`winners: [seat]`, status `<name> reached Happy Old Age with <n> points`); otherwise status `<name> reached Happy Old Age short of 100 points` and the 50 is not banked.
- Every named square, points value and send in the spec must appear exactly as the spec gives it; any other square comes from the scan.
- `checkeredLeft`: remove the leaver's piece; if the turn moved, the new player starts at `spin`.
- `checkeredStandings`: winner first, then by points, score text `<n> points`.

- [ ] **Step 1: Write the failing tests:**
  - `'Infancy is bottom left, Happy Old Age top right, both light'`.
  - `'the spec's named squares and points'`: `SQUARES` holds Bravery, Honor, School, College, Honesty, Happiness, Industry, Wealth, Gambling, Ruin, Idleness, Disgrace, Crime, Prison, Success, Fat Office, Congress and Despair; `sendTo` for Bravery is Honor, School College, Honesty Happiness, Industry Wealth, Gambling Ruin, Idleness Disgrace, Crime Prison; points Wealth 10, Honor, Happiness, College, Success, Fat Office and Congress 5; Prison `loseTurn`; Despair `despair`; no square named Suicide.
  - `'teetotum moves'`: from a middle light square, spin 1 gives the light squares two rows up and down in the same column; 2 two columns left and right; 3 the four diagonal neighbors; 4, 5 and 6 add the second step; every result `isLight`.
  - `'no legal move passes the turn'` (Review Focus 4), and `'a send does not chain'` (patch a square whose `sendTo` target has its own `sendTo`, or use the real board if it has one).
  - `'Prison loses the next turn'`; `'Despair goes back to Infancy with no points'`.
  - `'Happy Old Age wins at 100 counting its 50, and short of it play goes on'`: 50 points arriving wins; 40 does not, and the points stay 40.
  - `'dismissing the player who must choose starts the next turn'` (Review Focus 5).
- [ ] **Step 2: Run** `node --test games/roadtoretirement/checkered.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files from the scan.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `Road to Retirement: the 1860 Checkered board`.

### Task 6: Dispatch, registration and manager test

**Files:**
- Create: `games/roadtoretirement/rules.ts`, `games/roadtoretirement/index.ts`, `games/roadtoretirement/manager.test.ts`
- Modify (one line each): `games/registry.ts` and `games/infos.ts` (in `GAMES` and `GAME_INFOS` after `racko`, before `risk`, alphabetical by name), `shared/categories.test.ts` (`'roadtoretirement'` in `classic`, both counts up by one)

**Interfaces:**
- Consumes: Tasks 2, 4 and 5; `createGameManager` from `server/games.ts`; `rememberingKeys`, `agreeAll`, `withRules`, `stepsOf` from `server/testing.ts`.
- Produces (`rules.ts`): `createGameState(gameId)`, `resetLobby(state, random)` (sets `board` from `boardOf(state)` and calls `startRoad` or `startCheckered`, the other sub-state `null`; it runs after every house rule change, so switching the board in the lobby rebuilds the state), `applyMove`, `onPlayerLeft`, `toPublicState(state, undo) => ({ ...state, undoAvailable: undo })`, `finalStandings`.
- Produces (`index.ts`): `roadtoretirement: GameDefinition<GameState, PublicGameState>` with `info`, `createGameState`, `resetLobby`, `onPlayerLeft`, `applyMove`, `toPublicState`, `finalStandings`. No `privateSeatView`, no `secretState` (nothing hidden; `games/privateSeatView.test.ts` then checks "hides nothing per seat").

- [ ] **Step 1: Write the failing tests** in `manager.test.ts` through `rememberingKeys(createGameManager([roadtoretirement], random))`:
  - `'a short road game plays to retirement'`: two joins, `withRules`-equivalent house rules set to Short, `agreeAll`, a fixed random, players spin and choose until `isGameOver`; standings put the highest worth first.
  - `'an 1860 game plays to Happy Old Age'`: board `checkered`, patch points near 50, spin and step until a win.
  - `'switching the board in the lobby rebuilds the state'`: after the host sets `board: 'checkered'`, `getState(room).checkered` is set and `road` is `null`.
  - `'a spin and a fork choice are undone by vote'` (Review Focus 3): after a spin that stops at the fork and the `fork` move, `requestUndo` and the vote restore phase `fork` with the same `stepsLeft`.
  - `'every step is recorded'`: `stepsOf` grows by one per move.
- [ ] **Step 2: Run** `node --test games/roadtoretirement/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `rules.ts`, `index.ts` and the registration lines.
- [ ] **Step 4: Run** the same command and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Road to Retirement: registration and manager test`.

### Task 7: Client

**Files:**
- Create in `games/roadtoretirement/client/`: `GameScreen.tsx`, `RoadBoard.tsx`, `roadLayout.ts` (x, y of each `ROAD` space along a winding line), `CheckeredBoard.tsx`, `Spinner.tsx`, `ChoicePanel.tsx` (route, fork, career, house), `PlayerList.tsx`, `HistoryBoard.tsx`, `animateMove.ts`, `describeMove.ts`, `faq.ts`, `index.ts`, `roadtoretirement.scss`
- Modify (one line each): `src/clientGames.ts`, `shared/svg/gameIcons.ts` (a winding road ending at a small house, drawn with `lineIcon`)
- Test: `games/roadtoretirement/client/describeMove.test.ts`, `games/roadtoretirement/client/roadLayout.test.ts`

**Interfaces:**
- Consumes: `PublicGameState` (Task 2); `GameScreenProps`, `ClientGame` from `src/clientGames.ts`; `gameService.makeMove` (default export of `src/services/gameService.ts`).
- Produces: `roadtoretirementClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `animateMove` (the token slides along the spaces it passed), `gameLength` (`plural(n, 'turn')`).

Decisions:
- Both boards are page markup in the project's own style (no copied art). The road is an SVG path with one circle or tile per space, colored by kind with a small text label; the fork branches are visibly two roads. The 1860 board is an 8 by 8 grid, light squares carrying the square names in a period-feel type (a web-safe serif), pointing arrows drawn for each `sendTo`.
- Spinner: a button `Spin` that shows the number (1 to 10 or the teetotum's 1 to 6); the result is also text for screen readers.
- `ChoicePanel` buttons: `College` and `Straight to work`; `Safe road` and `Fast lane`; one button per offered career (`<name>, $<salary>`) and `Keep <current>`; one per house (`<name>, $<price>`) and `No house`; on the 1860 board, each legal square is a button `Move to <name or row r, column c>`.
- `PlayerList`: cash, loans, career, houses, partner and children (road), points and lose-a-turn mark (1860), retired and worth.
- `describeMove`: `Alice spun 7` plus `lastMove.events` joined as sentences; `Alice chose college`; `Alice took the Fast lane`; `Alice became a <career>`; `Alice bought <house>`; `Alice moved to <square>`.
- Layout: board and side panel side by side at laptop width, stacked below 720 px; the road board scales to fit (`useFitScale` from `src/components/useFitScale.ts` as other boards do).

- [ ] **Step 1: Write the failing tests.** `describeMove.test.ts`: one state per `LastMove` type, exact texts. `roadLayout.test.ts`: `'every space has a position and no two overlap'` (distance between any two centers at least the space diameter).
- [ ] **Step 2: Run** `node --test games/roadtoretirement/client/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client and the two registration lines.
- [ ] **Step 4: Run** `node --test games/roadtoretirement/**/*.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Road to Retirement: boards, screen, history and FAQ`.

### Task 8: README and end-to-end tests

**Files:**
- Create: `games/roadtoretirement/README.md`, `e2e/roadtoretirement.spec.ts`

**Interfaces:**
- Consumes: Task 7 labels; `seat`, `table.patch`, `table.random`, `table.dice`, `setHouseRules`, `inHouseRules`, `undo`, `leave`, `dismiss`, `headerButton`, `openFaq` from `e2e/fixtures.ts` (unchanged). The 1 to 10 spinner is queued with `table.random((n - 0.5) / 10)`; the teetotum with `table.dice(n)`.

README sections: Rules (both boards), Controls, Differences from Wikipedia (linking the Wikipedia article), and **The 1860 board's sources**: the scan's title, holder and URL, every square or rule that could not be read, and each disagreement among Wikipedia, thebiggamehunter.com and baldwin-games.com with how it was settled. One descriptive line may say it plays like The Game of Life. Differences to list at least: no cars, pegs, bills, insurance, stocks, Life Tiles or Day of Reckoning; the spinner and the richest-at-retirement win are the same; the numbers in Task 2's decisions; payday on passing and landing; stop spaces; loans; the house rules; and for 1860: Suicide renamed Despair and sending back to Infancy with points lost instead of out of the game, moves counted in light squares, the 50 not banked when short, a send does not chain.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/roadtoretirement.spec.ts`**, one test per rule, control and difference in the README, patching positions and cash with `table.patch`. At least: House rules list Board with both labels, and Game length and Starting cash disappear when 1860 Checkered is chosen; College and Straight to work; a payday passed pays; a stop space stops a long spin; the mid fork pauses for Safe road or Fast lane; a job offers two careers and Keep; a house bought shows in the player list and sells at retirement; a shortfall shows loans; risk; family adds a partner then a child; retirement and the richest winning on the game-over screen; on 1860 Checkered: Infancy and Happy Old Age corners, each teetotum number's legal squares highlighted, a send-on square moves on and scores, Prison skips a turn, Despair back to Infancy with 0, a win at 100 counting the 50, short of it play goes on; Undo of a spin; a dismissed player's token leaves the board; History (via `headerButton(page, 'History')`) steps through moves; FAQ opens.
- [ ] **Step 3: Run** `npx vite build` then `E2E_PORT_BASE=8600 npx playwright test --workers=2 e2e/roadtoretirement.spec.ts`. Expected: PASS.
- [ ] **Step 4: Run** `node --test games/roadtoretirement/content.test.ts`. Expected: PASS (the README passes the name check).
- [ ] **Step 5: Commit** `Road to Retirement: README and end-to-end tests`.

### Task 9: Browser check

**Files:** none new.

- [ ] **Step 1:** In the worktree, `npx vite build`, then `PORT=3406 node server/server.ts` (nvm PATH workaround if needed; never port 6000).
- [ ] **Step 2: Play in Chrome**, one tab per player: a full Short road game with three tabs (one college, one straight to work, both forks taken, a house bought, a loan taken) to retirement; a Full road game played a few turns then ended by dismissals (forced end); an 1860 Checkered game with two tabs to a win (patch points to shorten it if needed), passing through a send-on square, Prison and Despair.
- [ ] **Step 3: Check History** steps and describes each move, and **download the game file** after game over and open it with View as each seat.
- [ ] **Step 4: Check layout** of both boards at a laptop width and at phone width (same-origin iframes at 390 px and 320 px, per the memory note), light and dark: no overlap, no blank rows, every square name readable, every choice button reachable.

### Task 10: Full checks and pull request

**Files:** none new.

- [ ] **Step 1: Run** `npm test && npm run typecheck && npm run lint && E2E_PORT_BASE=8600 npx playwright test --workers=2 e2e/roadtoretirement.spec.ts`. Expected: PASS (apart from any failure noted in Task 1 Step 4).
- [ ] **Step 2: Push:** `git push -u origin game-roadtoretirement`.
- [ ] **Step 3: Open the PR:** `gh pr create --base party-games-and-polish --title "Road to Retirement"`, the body listing both boards, the Differences from Wikipedia, the 1860 scan cited, the one-line registration edits, the two coordinator decisions above, and ending with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
