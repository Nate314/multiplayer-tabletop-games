# Chinese Checkers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Coordinator note (overrides anything below):** one-line registration entries are allowed in `games/registry.ts`, `src/clientGames.ts`, `games/infos.ts`, `shared/svg/gameIcons.ts` (this game's landing icon), `shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`, the game count in `e2e/landing.spec.ts`, and `server/assets/registry.ts` for this game's server SVGs. Make them yourself; do not stop to ask, and do not leave a test failing for want of one. List them in the PR description. Other agents edit the same lines, so expect the coordinator to resolve conflicts.

**Goal:** Add Chinese Checkers (`chinesecheckers`): 2, 3, 4 or 6 players race ten marbles each across the 121-hole star by steps and chains of jumps; the first to fill the opposite point wins.

**Architecture:** A new game folder `games/chinesecheckers/` on the existing `GameDefinition` contract, shaped like `games/checkers/` (a whole turn is one move carrying its path, built on the client and sent once) with Parchisi's multi-player leaving (`onPlayerLeft` removes the leaver's pieces, play goes on, `finalStandings` ranks the rest). There is no hidden information, so `toPublicState` only adds `undoAvailable`. The board is clickable page markup (one SVG drawn by the client), so the game adds no server SVG asset.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-31-nine-new-games-design.md` (sections "Rules for every game agent" and "Chinese Checkers"). Rules source: https://en.wikipedia.org/wiki/Chinese_checkers

**Branch:** worktree on `game-chinesecheckers`, started from `nine-new-games`. Site port `PORT=3121`, e2e `E2E_PORT_BASE=6410` (never 6000).

## Global Constraints

- Files outside `games/chinesecheckers/`: one line each in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts` and `shared/svg/gameIcons.ts` (the icon), the `classic` list in `shared/categories.test.ts`, the main `README.md` game list and the count in its first sentence, `docs/architecture.md` only where it lists games by name, and `e2e/chinesecheckers.spec.ts`. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`; if more seems needed, stop and report it.
- `GameInfo`: `id: 'chinesecheckers'`, `name: 'Chinese Checkers'`, `category: 'classic'`, description `Hop your ten marbles across the star into the opposite point`, `minPlayers: 2`, `maxPlayers: 6`. No house rules of its own (the platform Turn timer still shows).
- Board: 121 holes, 10 marbles per player. Starting points (point indexes clockwise from the bottom, below): 2 players `[0, 3]`, 3 players `[0, 2, 4]`, 4 players `[0, 1, 3, 4]`, 6 players all six. Each player's target is the point opposite their start, `(p + 3) % 6`. Five seated players cannot start (Wikipedia: "Five people cannot play, because one player would lack an opponent sitting opposite").
- Moves (Wikipedia): a step to an adjacent empty hole, or one or more hops, each over a single adjacent marble (own or anyone's) into the empty hole straight beyond. No mixing a step with hops. The player may stop a chain at any landing. No captures. Turns go clockwise.
- Winning: the first player whose target point is full wins and the game ends (spec, my call). Anti-spoiling (Wikipedia lists none, so the spec's call applies): a seat has won when every hole of its target point is occupied and at least one of them holds its own marble; opponent marbles there count for it. Everyone else is ranked by own marbles in their target.
- Leaving mid-game: the leaver's marbles are removed and play goes on (as Parchisi); the platform ends the game when one player is left.
- Undo: every move by vote (the platform's normal undo); a whole chain is one move.
- No em-dashes in the README, FAQ, comments or commit messages.
- Gates: `npm test`, `npm run typecheck`, `npm run lint` and `e2e/chinesecheckers.spec.ts` pass.

## Review Focus

- A chain that loops back (lands twice on one hole, or ends where it started) must be refused, and a chain may hop through the hole the marble lifted from, since that hole is empty while it moves (Task 1 tests both).
- The anti-spoiling win must not fire at the very start of a 2-player game, where seat 1's target is already full of seat 2's marbles and holds none of seat 1's (Task 1 pins `hasWon` false there).
- Five seated players: the first move is refused with a clear status, while a 6-player game that drops to five by a dismissal plays on (Task 1 and Task 2).
- A player boxed in with no legal move must not stall the table: their turn passes with a status line, and if nobody can move the game ends (Task 1).
- A half-built chain on one browser when another state arrives (an undo, a dismissal) must be dropped, not sent stale (Task 3 `selection.test.ts`).

---

### Task 1: Board geometry, rules and README

**Files:**
- Create: `games/chinesecheckers/types.ts`, `info.ts`, `board.ts`, `rules.ts`, `index.ts`, `README.md`
- Test: `games/chinesecheckers/board.test.ts`, `games/chinesecheckers/rules.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Hole = { q: number; r: number }; // axial coordinates, s = -q - r
  export type PointIndex = 0 | 1 | 2 | 3 | 4 | 5; // clockwise from the bottom
  export type Move = { type: 'move'; path: Hole[] }; // the marble's hole, then every landing
  export type LastMove = { playerNumber: Seat; path: Hole[] };
  export type GameState = BaseGameState & {
    holes: Record<string, Seat>;          // holeKey -> owner, occupied holes only
    points: Partial<Record<Seat, PointIndex>>; // each seated player's start point; a leaver has no entry
    lastMove: LastMove | null;
  };
  export type PublicGameState = GameState & BasePublicState;
  ```
- Produces (`board.ts`, pure geometry, no state):
  - `holeKey(hole: Hole): string` (`"q,r"`), `parseHole(key: string): Hole`, `isHole(hole: Hole): boolean`: true when `min(q, r, s) >= -4` or `max(q, r, s) <= 4`.
  - `HOLES: Hole[]` (121, sorted by `r` then `q`), `DIRECTIONS: Hole[]` (the six axial unit vectors), `neighbors(hole): Hole[]`.
  - `pointOf(hole: Hole): PointIndex | null`: `0` when `r > 4`, `1` when `q < -4`, `2` when `s > 4`, `3` when `r < -4`, `4` when `q > 4`, `5` when `s < -4`, else `null` (the 61-hole center).
  - `POINT_HOLES: Record<PointIndex, Hole[]>` (10 each), `opposite(point: PointIndex): PointIndex`.
  - `START_POINTS: Record<2 | 3 | 4 | 6, PointIndex[]>` with the Global Constraints values; `PLAYABLE_COUNTS = [2, 3, 4, 6]`.
- Produces (`rules.ts`):
  - `SEAT_COLORS: Record<Seat, string>` = `{ 1: 'Red', 2: 'Blue', 3: 'Green', 4: 'Yellow', 5: 'Purple', 6: 'Orange' }`.
  - `targetOf(state, seat): PointIndex`, `marblesHome(state, seat): number`, `hasWon(state, seat): boolean`.
  - `nextLandings(state: GameState, path: Hole[]): Hole[]`: for `[start]`, empty neighbors plus hop landings; after a hop, further hop landings only; after a step, none. The start hole counts as empty; a landing already in `path` (including the start) is excluded.
  - `isLegalPath(state, seat, path): boolean`, `hasAnyMove(state, seat): boolean`, `isStep(path: Hole[]): boolean`.
  - `createGameState(gameId)`, `resetLobby(state, random)`, `applyMove(state, seat, move, random)`, `onPlayerLeft(state, seat, random)`, `toPublicState(state, undoAvailable)`, `finalStandings(state): Standing[]`, `moveSummary(name: string, lastMove: LastMove, won: boolean): string`.
  - Exact copy: five seated `gameStatus` and refusal `Chinese Checkers needs 2, 3, 4 or 6 players`; illegal path `Invalid move`; a pass `<name> has no move and passes`; a win `<name> filled the far point and wins!`; nobody can move `Nobody can move. <names> win with the most marbles home`. `moveSummary`: `Alice moved a marble`, `Alice made 1 jump`, `Alice made 3 jumps` (`plural` from `shared/text.ts`), with ` and won` appended when `won`. Standings score `<n> of 10 marbles home`.
- Decisions:
  - `resetLobby` assigns `START_POINTS[n]` to `activePlayers` in seat order (so platform turn order runs clockwise) and fills each start point with that seat's marbles; with 5 seated, `points` and `holes` are empty.
  - `applyMove` refuses when `!state.started` and five are seated, validates the path, moves the marble, sets `lastMove`, then: if the mover `hasWon`, `isGameOver: true`, `winners: [seat]`; else passes the turn to the next seat in `activePlayers` order, skipping (with the pass status) any seat with no move, at most once round the table; if nobody can move, the game ends with winners the seats with the most `marblesHome`.
  - `onPlayerLeft` deletes the leaver's holes and point, as `games/parchisi/rules.ts` does.

- [ ] **Step 1: Write failing tests.** `board.test.ts`: `'the star has 121 holes'`; `'each point has 10 holes and the center 61'`; `'points are numbered clockwise and opposite is three on'` (`opposite(0) === 3`, `opposite(4) === 1`); `'every hole has at most six neighbors and the center hole has six'`. `rules.test.ts` (build states with `addPlayer` from `shared/seating.ts`, then patch `holes`):
  - Setup: `'2 players start opposite'` (`points` `{1: 0, 2: 3}`, 20 marbles); `'3 players start on alternating points'` (`{1: 0, 2: 2, 3: 4}`); `'4 players use two opposite pairs'` (`{1: 0, 2: 1, 3: 3, 4: 4}`); `'6 players fill every point'` (60 marbles); `'five players cannot start'` (status and `applyMove` error are the exact copy above).
  - Moves: `'a marble steps to an adjacent empty hole'`; `'a marble cannot step onto a marble or off the board'`; `'a hop goes over one adjacent marble of any color into the empty hole beyond'`; `'a hop over two marbles in a row or over a gap is refused'`; `'a chain of hops may stop at any landing'` (paths of length 2, 3 and 4 along one chain are all legal); `'a step cannot follow or precede a hop'`; `'a chain may not land twice on one hole or end where it began'`; `'a chain may hop through the hole the marble left'`; `'no marble is captured'` (marble count unchanged after a hop); `'only the current player moves, and only their own marble'`.
  - Turns: `'turns go to the next seated player'`; `'a player with no move passes'` (patch a boxed-in seat 2; after seat 1 moves, `currentPlayer` is 3 and status is `Bob has no move and passes`).
  - End: `'filling the opposite point wins and ends the game'`; `'an opponent marble left in the target still lets the player win'` (9 own plus 1 of seat 2's: `hasWon` true); `'a target full of opponent marbles is not a win'` (the 2-player start: `hasWon(state, 1) === false`); `'the others are ranked by marbles home'` (`finalStandings` places and `3 of 10 marbles home`).
  - Leaving: `'a player who leaves loses their marbles and play goes on'` (3 players, seat 2 leaves: no hole holds 2, `points[2]` gone, the turn moves on if it was theirs).
  - Views: `'the public view is the whole state with undoAvailable'`.
- [ ] **Step 2: Run** `node --test games/chinesecheckers/`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `types.ts`, `info.ts`, `board.ts`, `rules.ts` and `index.ts` (`chinesecheckers: GameDefinition<GameState, PublicGameState>` with `info`, `createGameState`, `resetLobby`, `onPlayerLeft`, `applyMove`, `toPublicState`, `finalStandings`, as `games/parchisi/index.ts`).
- [ ] **Step 4: Write `README.md`** in `games/parchisi/README.md`'s shape: intro (seat colors, where each player's point is, each player sees their own point at the bottom), Rules (every Global Constraints rule, five cannot play, leaving, undo by vote), Controls (filled in Task 3), and "Differences from Wikipedia":
  - Each player plays one set of ten marbles; Wikipedia lets two or three players control two or three sets, and two players play with 15
  - The game ends when the first player fills their target; Wikipedia plays on for second and later places. Everyone else is ranked by marbles home
  - A marble left in your target cannot stop you: you win once every hole there is occupied and at least one marble is yours. Wikipedia has no such rule
  - A chain of hops may not land on the same hole twice; Wikipedia does not say
  - A player with no legal move passes; Wikipedia does not say
  - The fast-paced and capture variants are not implemented
- [ ] **Step 5: Run** `node --test games/chinesecheckers/`. Expected: PASS.
- [ ] **Step 6: Commit** `git add games/chinesecheckers && git commit -m "Chinese Checkers rules, board and README"`

### Task 2: Registration and the manager test

**Files:**
- Modify: `games/registry.ts` (import, and `chinesecheckers` after `checkers` in `GAMES`), `games/infos.ts` (same place), `shared/categories.test.ts` (`classic` list: `'checkers', 'chinesecheckers', 'chess'`)
- Test: `games/chinesecheckers/manager.test.ts`

**Interfaces:**
- Consumes: Task 1's `chinesecheckers`, `holeKey`, `POINT_HOLES`, `nextLandings`.

- [ ] **Step 1: Write failing tests** through `rememberingKeys(createGameManager([chinesecheckers], seeded(1)))` (`seeded` from `games/testStates.ts`), room `chinesecheckers/g1`, with the `ok()` narrowing helper from `games/checkers/manager.test.ts`:
  - `'moves are validated and recorded for undo'`: before any move `undoAvailable` is false; seat 2 moving first gets `Not your turn`; seat 1's step makes `undoAvailable` true and `currentPlayer` 2.
  - `'a chain of hops is one move and undo restores it'`: after a 2-hop chain, `requestUndo` by seat 2 and `voteUndo` by seat 1 restore every marble and `currentPlayer` 1.
  - `'a seventh player cannot join'`: `{ error: 'Game is full' }`.
  - `'five seated players cannot start'`: `manager.move` answers `Chinese Checkers needs 2, 3, 4 or 6 players`.
  - `'dismissing a player mid-game removes their marbles and play goes on'` (3 players, `disconnect`, `requestDismiss`, `voteDismiss` as `games/dominoes/manager.test.ts`): `activePlayers` `[1, 2]`, no hole holds 3, `isGameOver` false.
  - `'a 6-player game that loses one player plays on with five'`.
  - `'a played-out game builds its history and game file'`: patch the room so seat 1 is one step from filling its target, step in, `isGameOver` true, `standings[0].seat === 1`, and `stepsOf`/`fileOf` (as Dominoes' test) return steps and a file.
- [ ] **Step 2: Run** `node --test games/chinesecheckers/manager.test.ts`. Expected: FAIL until registered where the manager test needs it, then PASS.
- [ ] **Step 3: Register** the game in `games/registry.ts`, `games/infos.ts` and the categories test.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS, including `games/infos.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts` and `games/privateSeatView.test.ts`.
- [ ] **Step 5: Commit** `git add games/chinesecheckers games/registry.ts games/infos.ts shared/categories.test.ts && git commit -m "Register Chinese Checkers on the server"`

### Task 3: The screen, History and move descriptions

**Files:**
- Create: `games/chinesecheckers/client/index.ts`, `GameScreen.tsx`, `Board.tsx`, `GameStatus.tsx`, `HistoryBoard.tsx`, `geometry.ts`, `selection.ts`, `describeMove.ts`, `animateMove.ts`, `seatSymbols.ts`, `faq.ts`, `chinesecheckers.scss`
- Test: `games/chinesecheckers/client/geometry.test.ts`, `selection.test.ts`, `describeMove.test.ts`
- Modify: `src/clientGames.ts` (`chinesecheckers: () => import('../games/chinesecheckers/client/index.ts').then(m => m.chinesecheckersClient)`, after `checkers`), `shared/svg/gameIcons.ts` (a `chinesecheckers` line icon: a six-pointed star outline with a dot, on the 24-unit grid)

**Interfaces:**
- Consumes: Task 1's `nextLandings`, `isLegalPath`, `isStep`, `hasAnyMove`, `marblesHome`, `SEAT_COLORS`, `HOLES`, `holeKey`, `moveSummary`, `hasWon`.
- Produces:
  - `geometry.ts`: `turnsFor(points: GameState['points'], viewer: Seat | null): number` (sixths of a turn that bring the viewer's start point to the bottom; `0` for `null` or a spectator); `holeXY(hole: Hole, turns: number): { x: number; y: number }` (pointy-top layout, `x = √3·(q + r/2)`, `y = 1.5·r`, y down, rotated by `turns × 60°` about the center).
  - `selection.ts`: `type Picked = { moveCount: number; path: Hole[] }`; `pathFor(picked: Picked, moveCount: number): Hole[]` (empty when `moveCount` differs); `pickHole(state: PublicGameState, seat: Seat, path: Hole[], hole: Hole): { path: Hole[]; send: boolean }`: an own movable marble starts a new path (clicking the picked marble again clears it); a step sends at once; a hop landing extends the path and sends at once when `nextLandings` is then empty; anything else leaves the path unchanged.
  - `seatSymbols.ts`: `SEAT_SYMBOLS: Record<Seat, SymbolColor>` = red, blue, green, yellow, purple, orange.
  - `describeMove(state: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'isGameOver' | 'winners'>): string` via `moveSummary`.
  - `chinesecheckersClient: ClientGame` with `Screen`, `faq`, `HistoryBoard`, `describeMove`, `animateMove`.
- Screen decisions: one SVG `.board` with a `<circle class="hole" data-hole="q,r">` per hole (point holes tinted with their owner's color, a target's tint shown to its player), marbles `.marble.player<n>` with `aria-label` `Red marble`, and `ColorSymbol` (with `svgProps`) on each marble. On your turn movable marbles glow; the picked marble is outlined, the path so far is a polyline from the marble through each landing, and `nextLandings` holes are marked `.target`. The End move button (in the side panel, beside Undo) shows while a chain of at least one hop is built and has more landings, and sends the path. The last move's path is drawn as a faint line. The board is dimmed when it is not your turn. `GameStatus` lists each player with color, symbol and `n of 10 home`, whose turn it is, and the game status. The board stays square and scales to its box; at 480 px or less the side panel goes below the board. Undo uses `src/components/UndoVote` as Checkers does. `animateMove` slides the marble from `path[0]` to the last landing (`slideFrom`, keys `hole-<q>-<r>`).

- [ ] **Step 1: Write failing tests.** `geometry.test.ts`: `'point 0 is at the bottom unturned'` (every `POINT_HOLES[0]` hole has `y > 0`); `'each viewer sees their own start point at the bottom'` (for `points {1: 0, 2: 3}`, viewer 2's `POINT_HOLES[3]` holes have `y > 0`); `'null sees the table unturned'`. `selection.test.ts`: `'clicking an own marble starts a path and clicking it again clears it'`; `'a step is sent at once'`; `'a hop with more hops beyond waits for End move'`; `'a hop with nothing beyond is sent at once'`; `'an opponent marble or an unmarked hole changes nothing'`; `'a path from an earlier state is dropped'` (`pathFor({ moveCount: 3, path }, 4)` is `[]`). `describeMove.test.ts`: `Alice moved a marble`, `Alice made 1 jump`, `Bob made 3 jumps`, `Cara made 2 jumps and won`.
- [ ] **Step 2: Run** `node --test games/chinesecheckers/client/`. Expected: FAIL.
- [ ] **Step 3: Implement** the client files, `faq.ts` (questions on: how to move, chains and End move, why a player passed, the blocked-target win, five players, leaving) and SCSS nested under `[data-game="chinesecheckers"]` with `--player1` to `--player6` colors for light and dark themes. Register in `src/clientGames.ts` and add the icon.
- [ ] **Step 4: Fill in the README's Controls** (click a marble, then a hole; chains and End move; clicking the marble again starts over; glow, path line, last move line, dimming; Undo; Rules and FAQ; Color-blind symbols: red circle, blue square, green triangle, yellow star, purple cross, orange hexagon).
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: PASS, including `src/games/loadClientGame.test.ts`.
- [ ] **Step 6: Commit** `git add games/chinesecheckers src/clientGames.ts shared/svg/gameIcons.ts && git commit -m "Chinese Checkers screen, History and FAQ"`

### Task 4: End-to-end tests and docs

**Files:**
- Create: `e2e/chinesecheckers.spec.ts`
- Modify: `README.md` (count in the first sentence up by one, "Chinese Checkers (two, three, four or six players)" in that sentence, and a game list line `- [Chinese Checkers](games/chinesecheckers/README.md): hop your ten marbles across the star into the opposite point. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Chinese_checkers).` after Checkers), `docs/architecture.md` (only the Color-blind symbols line that names the games told apart by color alone)

**Interfaces:**
- Consumes: `e2e/fixtures.ts` (`test`, `expect`, `seat`, `table.patch`, `table.state`, `undo`, `dismiss`, `leave`, `openFaq`, `setPreference`, `touch: true`), `holeKey` and `POINT_HOLES` from `games/chinesecheckers/board.ts`.

- [ ] **Step 1: Write the specs**, one per README rule, control and difference, each starting from `seat('chinesecheckers', names)` and `table.patch({ holes, currentPlayer, started: true })` for crafted positions, clicking `[data-hole="q,r"]`:
  - `'two players start on opposite points'`, `'three players start on alternating points'`, `'four players use two opposite pairs'`, `'six players fill the star'` (marble counts per color).
  - `'five players cannot start'` (the status text, and a click does nothing).
  - `'a marble steps to an adjacent hole'`, `'a hop goes over any one marble'`, `'a chain of hops ends with End move'`, `'a chain stops by itself when no hop is left'`, `'clicking the marble again starts over'`, `'the path line follows the chain'`.
  - `'no marble is captured'`, `'a player with no move passes'`.
  - `'filling the opposite point wins and the rest are ranked by marbles home'` (game-over standings show `of 10 marbles home`).
  - `'a marble left in your target does not stop you winning'`.
  - `'each player sees their own point at the bottom'` (the bounding box of Alice's and Bob's own marbles is in the lower half on each page).
  - `'undo takes back a whole chain'` (`undo(alice, bob)`).
  - `'a player who leaves loses their marbles and play goes on'` (3 players, `leave`, `dismiss`).
  - `'History shows each move'` (descriptions as Task 3), `'tapping works on a touch screen'` (`touch: true`), `'color-blind symbols show on marbles'` (`setPreference(page, 'Color-blind symbols', true)`), `'the FAQ opens from Rules'` (`openFaq`).
- [ ] **Step 2: Run** `E2E_PORT_BASE=6410 npx playwright test e2e/chinesecheckers.spec.ts`. Expected: PASS.
- [ ] **Step 3: Also run** `E2E_PORT_BASE=6410 npx playwright test e2e/landing.spec.ts e2e/rules.spec.ts e2e/history.spec.ts e2e/lazyLoading.spec.ts`. Expected: PASS.
- [ ] **Step 4: Update** the README and architecture lines above.
- [ ] **Step 5: Gates** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 6: Commit** `git add e2e/chinesecheckers.spec.ts README.md docs/architecture.md && git commit -m "Chinese Checkers end-to-end tests and docs"`

### Task 5: Browser check and PR

- [ ] **Step 1: Run the site** on its own port: `npx vite build && PORT=3121 node server/server.ts` (if `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH).
- [ ] **Step 2: Play in Chrome**, one tab per player: a 3-player game through a forced end (patch near a win through the e2e hook if needed, or play it out), including a chain with End move, a pass, an undo vote, and a dismissal. Open History and step through it; download the game file and open it with "View as" each seat; join a spectator tab.
- [ ] **Step 3: Check layout** at a laptop size and at 390 px and 320 px (same-origin iframes, since the window cannot be resized), light and dark: no overlap, every hole tappable, the End move and Undo buttons visible, no sideways page scroll. Fix anything found, rerun Task 4's spec, and commit.
- [ ] **Step 4: Push and open the PR:** `git push -u origin game-chinesecheckers`, then `gh pr create --base nine-new-games --title "Chinese Checkers" --body ...` with Summary, Rulings (game ends at the first winner, the anti-spoiling rule, five players refused, a player with no move passes, no landing twice in a chain), Files outside the game folder (the registration lines listed in Global Constraints) and Verification.
