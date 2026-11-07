# Corners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Corners (`corners`, Strategy board games, 2 to 4 players), a polyomino territory game played on a Squares board or a Triangles board chosen by house rule.

**Architecture:** A new folder `games/corners/` on the `GameDefinition` contract, built like Quoridor and Chess (turn moves only, platform undo vote, no hidden information). One pure module (`geometry.ts`) describes both boards with a single cell model: every cell is a lattice cell with a set of corner points, so "touch at a corner" is "share a corner point" and "touch along an edge" is "share two corner points" on both boards. The piece sets are generated from that model (every free shape of 1 to 5 squares, or 1 to 6 triangles), not typed in by hand. `rules.ts` holds colors, turn order, placement checks, automatic passing and scoring.

**Tech Stack:** TypeScript, React 19, SCSS, SVG, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Goals", "Anti-goals", "Shared ground", "Rules for every agent" and "Corners". Read it with this plan.

**Branch:** `game-corners`, in its own worktree, from `party-games-and-polish`. Site `PORT=3707`, e2e `E2E_PORT_BASE=8700` (never 6000). PR into `party-games-and-polish`.

## Global Constraints

- Id `corners`, name `Corners`, category `'strategy'`, `minPlayers: 2`, `maxPlayers: 4`.
- **House rule "Board"** (`board`, choice: Squares or Triangles; standard Squares).
- **Squares:** a 20 × 20 grid and 21 polyomino pieces per color (1 to 5 squares). **Triangles:** a hexagon-shaped triangle grid and 22 polyiamond pieces per color (1 to 6 triangles).
- Each player's first piece covers their starting corner (Squares) or a starting point (Triangles). Every later piece must touch a piece of the same color at a corner and never along an edge. Pieces may rotate and flip.
- A player with no legal placement passes for the rest of the game. When nobody can place, the game ends. Scoring: minus one per unplayed square or triangle; plus 15 for placing every piece, plus 5 more if the last piece was the single square or triangle. Highest score wins.
- 2 players play two colors each. 3 players play one color each and take turns placing the fourth, shared color, which scores for no one.
- Controls: pick a piece from your tray, rotate and flip it with buttons (and keys on desktop), preview it on the board with legal spots shown, tap to place. Works by tap on phones.
- Rules checked against Wikipedia's [Blokus](https://en.wikipedia.org/wiki/Blokus) article (rules only, no content). Every difference goes in `games/corners/README.md` under "Differences from Wikipedia", in the format of `games/rook/README.md`. Where the spec disagrees with Wikipedia, the spec wins and the README lists it. No name, art or text from the commercial game: the word "Blokus" appears only in the README's Wikipedia link line.
- Every turn move is undoable by vote (the platform's normal undo). Leaving follows Quoridor: a dismissed player's colors stop; the platform ends a game left with one player.
- Files outside `games/corners/`: one line each in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `shared/categories.test.ts` (`strategy` list and the game count), and the new `e2e/corners.spec.ts`. Corners has no secret and no private view, so `games/secretState.test.ts` and `games/privateSeatView.test.ts` stay as they are. Do **not** touch the root `README.md` game list or count, `e2e/landing.spec.ts`, `docs/architecture.md`, `e2e/fixtures.ts` or anything else in `src/`, `server/`, `shared/`. If a platform or fixture change seems needed, stop and report it.
- New e2e specs reach header controls (History, Share, Rules, Hide, Pause, Settings, Theme) only through `headerButton(page, name)` from `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in code comments, README, FAQ or commit messages.
- Every commit message ends with these two lines (use `git commit -F -` with a heredoc so they stay one trailer block):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
- If `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH (memory note).

## Review Focus

1. On the triangle board a piece's corner touching the middle of a same-color piece's straight side (Wikipedia: "a corner touching an edge is allowed") is legal, since the two share one corner point and no side (Task 3, `'a corner on a side is a corner touch on triangles'`).
2. A placement that leaves every color without a legal spot ends the game in that same move, and a color with no legal spot is skipped at once with its owner told, never left as a turn nobody can take (Task 3, `'the move that blocks everyone ends the game'`, `'a blocked color is skipped and stays out'`).
3. Three players: the shared color's turn rotates through the seated players and keeps rotating after a player is dismissed; it never adds to anyone's score, and a tie for the top score is a shared win (Task 3).
4. A forged move (orientation index out of range, a fractional or huge offset, a piece already played, a piece of another color) is refused with an error, never a crash or a half-placed piece (Task 3, `'forged moves are refused'`).
5. On a phone the first tap on a legal spot previews the piece there and a second tap on the same spot places it; rotating or flipping after the preview keeps it on the same spot or clears it when no longer legal; a tap on an illegal spot places nothing (Task 5 `placeInput.test.ts`, Task 6 touch test).

---

### Task 1: Worktree, branch and ports

**Files:** none in the repo.

- [ ] **Step 1:** From the main checkout: `git -C C:/Users/Natha/Documents/code/multiplayer-tabletop-games worktree add ../mtg-game-corners -b game-corners party-games-and-polish`. Expected: a new worktree at `C:/Users/Natha/Documents/code/mtg-game-corners` on branch `game-corners`. All later work happens there.
- [ ] **Step 2:** Check the ports are free: `netstat -ano | grep -E ':(3707|870[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3707 or 8700, and say so in the PR.
- [ ] **Step 3:** `npm ci`, then `npm test`. Expected: PASS (the base branch is green apart from the two `e2e/houseRules.spec.ts` tests the spec names, which are not run here).

### Task 2: Board geometry and piece sets

**Files:**
- Create: `games/corners/geometry.ts`
- Test: `games/corners/geometry.test.ts`

**Interfaces:**
- Produces (`geometry.ts`):
  - `type BoardKind = 'squares' | 'triangles'`
  - `type Cell = readonly [x: number, y: number, t: 0 | 1]`: Squares cell `(x, y)` has `t = 0`. Triangles cell `(a, b, t)` sits in axial lattice coordinates: `t = 0` is the up triangle with corners `(a,b) (a+1,b) (a,b+1)`, `t = 1` the down triangle with corners `(a+1,b) (a,b+1) (a+1,b+1)`.
  - `type Shape = Cell[]` (normalized: shifted so the smallest `x` and smallest `y` are 0, sorted).
  - `cellKey(cell: Cell): string` (`"x,y,t"`), `corners(kind: BoardKind, cell: Cell): string[]` (point keys `"x,y"`; 4 for a square, 3 for a triangle).
  - `BOARD_SIZE = 20`, `HEX_SIDE = 9`.
  - `boardCells(kind: BoardKind): Cell[]`: Squares, every `(x, y)` with `0 <= x, y < 20`. Triangles, every triangle whose three corners `(x, y)` satisfy `max(|x|, |y|, |x + y|) <= 9` (a hexagon of side 9).
  - `normalize(shape: Shape): Shape`, `orientations(kind: BoardKind, shape: Shape): Shape[]` (distinct normalized results of every symmetry: 8 for squares, 12 for triangles), `canonical(kind, shape): string` (the smallest `orientations` key string).
  - `edgeTouch(kind, a: Cell, b: Cell): boolean` (two shared corner points), `cornerTouch(kind, a, b): boolean` (exactly one shared corner point).
  - `PIECES: Record<BoardKind, Shape[]>`: generated once at module load by growing every shape by one edge neighbor at a time and keeping one per `canonical`; Squares up to 5 cells, Triangles up to 6. Ordered by size, then by `canonical`. A piece's id is its index; index 0 is the single cell on both boards.
  - `SQUARE_STARTS: Cell[] = [[0,0,0], [19,0,0], [19,19,0], [0,19,0]]` (color 0 to 3, clockwise from the top left).
  - `TRIANGLE_STARTS: Cell[]`: six cells. With `D = [(1,0), (0,1), (-1,1), (-1,0), (0,-1), (1,-1)]` and `S_k = 6·D_k`, start `k` is the triangle with corners `S_k`, `S_k - D_k` and `S_k + D_(k+2 mod 6)`.

Decisions:
- Symmetries act on corner points, then each cell is rebuilt from its corners: squares rotate `(x, y) -> (-y, x)` and mirror `(x, y) -> (-x, y)`; triangles rotate 60 degrees `(x, y) -> (-y, x + y)` and mirror `(x, y) -> (y, x)`. A triangle rebuilt from corners: `a` = smallest x, `b` = smallest y, `t = 0` when the point `(a, b)` is among its corners, else 1.
- Translation of a triangle shape is by whole lattice steps on `a` and `b`, which never changes `t`.

- [ ] **Step 1: Write the failing tests** in `geometry.test.ts`:
  - `'the squares board has 400 cells and the triangles board 486'`: `boardCells('squares').length === 400`, `boardCells('triangles').length === 486`, every key distinct.
  - `'piece sets are every free shape: 21 squares pieces and 22 triangles pieces'`: `PIECES.squares.length === 21`, sizes counted `{1:1, 2:1, 3:2, 4:5, 5:12}`; `PIECES.triangles.length === 22`, sizes `{1:1, 2:1, 3:1, 4:3, 5:4, 6:12}`; cells per color 89 and 110.
  - `'a square has 4 edge neighbors and 4 corner neighbors inside the board'`: for `(5,5,0)` among `boardCells('squares')`.
  - `'an inner triangle has 3 edge neighbors and 9 corner neighbors'`: for `[0,0,0]` and `[0,0,1]` among `boardCells('triangles')`.
  - `'orientations: the long bar has 2 on squares, the 2 by 2 block 1, the bent five-square piece 8'`; on triangles the single triangle has 2 (`t` 0 and 1) and the straight 6-triangle bar has 6.
  - `'the six triangle starts are distinct cells on the board, turned 60 degrees from each other'`.
  - `'every corner of the squares board is a start'`.
- [ ] **Step 2: Run** `node --test games/corners/geometry.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `geometry.ts`.
- [ ] **Step 4: Run** `node --test games/corners/geometry.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Corners: board geometry and generated piece sets`.

### Task 3: Info, options, types and rules

**Files:**
- Create: `games/corners/info.ts`, `games/corners/options.ts`, `games/corners/types.ts`, `games/corners/rules.ts`
- Test: `games/corners/rules.test.ts`

**Interfaces:**
- Consumes: Task 2; `houseRule` from `shared/houseRules.ts`; `baseGameState`, `nextActivePlayer` from `shared/seating.ts`; `rankStandings`, `pointsText` from `shared/standings.ts`; `asRecord` from `shared/messages.ts`.
- Produces (`options.ts`): `BOARD_RULE: ChoiceRule<BoardKind>` = id `board`, label `Board`, kind `choice`, standard `'squares'`, choices `{ value: 'squares', label: 'Squares' }`, `{ value: 'triangles', label: 'Triangles' }`, help `Squares: a 20 by 20 grid. Triangles: a six-sided board of triangles.`; `CORNERS_RULES: HouseRule[] = [BOARD_RULE]`.
- Produces (`info.ts`): `cornersInfo: GameInfo` with `id: 'corners'`, `name: 'Corners'`, `category: 'strategy'`, description `Claim the board one piece at a time, touching your own color only at the corners`, `minPlayers: 2`, `maxPlayers: 4`, `houseRules: CORNERS_RULES`. No rules imports (the landing page loads it eagerly).
- Produces (`types.ts`):
  ```ts
  type Color = 0 | 1 | 2 | 3;                         // shown as Blue, Yellow, Red, Green
  type Owner = Seat | 'shared';
  type Placed = { color: Color; piece: number; cells: Cell[] };
  type LastMove =
    | { type: 'place'; playerNumber: Seat; color: Color; piece: number; cells: Cell[] }
    | null;
  type GameState = BaseGameState & {
    board: BoardKind;                                 // copied from the rule at resetLobby
    owners: Record<Color, Owner>;
    turnColor: Color;
    sharedTurn: number;                               // how many times the shared color has been placed or passed
    used: Record<Color, number[]>;                    // piece ids placed, in order
    placed: Placed[];
    out: Color[];                                     // colors that pass for the rest of the game, in the order they went out
    lastMove: LastMove;
  };
  type PublicGameState = GameState & BasePublicState & { scores: Partial<Record<Seat, number>>; colorScores: Record<Color, number> };
  type Move = { type: 'place'; piece: number; orientation: number; dx: number; dy: number };
  ```
- Produces (`rules.ts`): `createGameState(gameId)`, `resetLobby(state)`, `applyMove(state, seat, move)`, `onPlayerLeft(state, seat)`, `toPublicState(state, undoAvailable)`, `finalStandings(state)`, and for the client: `COLOR_NAMES = ['Blue', 'Yellow', 'Red', 'Green'] as const`, `ownersFor(seats: Seat[]): Record<Color, Owner>`, `cellsOf(state, piece, orientation, dx, dy): Cell[]`, `placementError(state: GameState, color: Color, cells: Cell[]): string | null`, `legalSpots(state, color, piece, orientation): { dx: number; dy: number }[]`, `hasLegalPlacement(state, color): boolean`, `colorScore(state, color): number`, `seatToPlace(state): Seat` (the owner of `turnColor`, the rotating seat for the shared color).

Decisions:
- `ownersFor`: 2 seats `{0: s1, 1: s2, 2: s1, 3: s2}`; 3 seats `{0: s1, 1: s2, 2: s3, 3: 'shared'}`; 4 seats one each, in seat order.
- The shared color's seat is `activePlayers[sharedTurn % activePlayers.length]`; `sharedTurn` goes up by one every time the shared color places or is skipped.
- `cellsOf` takes `orientations(board, PIECES[board][piece])[orientation]` shifted by `(dx, dy)`.
- `placementError` messages, checked in this order: `That piece is already played`, `That spot is not on the board`, `That space is taken`, `Pieces of one color may only touch at corners` (an `edgeTouch` with any cell of the same color), then for a color's first piece `Your first piece must cover your corner` (Squares: covers `SQUARE_STARTS[color]`) or `Your first piece must cover a starting point` (Triangles: covers any of `TRIANGLE_STARTS`), otherwise `A piece must touch your color at a corner` (no `cornerTouch` with the same color).
- `applyMove` refuses `Unknown move type`, and `Invalid move` when `piece`, `orientation`, `dx` or `dy` is not an integer or the piece or orientation index is out of range; then `placementError`. On success it pushes `Placed`, appends the piece to `used`, sets `lastMove`, then advances.
- **Advance:** walk the colors after `turnColor` in order 0, 1, 2, 3. A color already `out` is skipped. A color that has placed all its pieces, or for which `hasLegalPlacement` is false, is appended to `out` (and the shared color's `sharedTurn` goes up) and skipped. The first color that can place becomes `turnColor` and `currentPlayer = seatToPlace(state)`. When every color is out the game is over.
- `hasLegalPlacement` tries only anchor cells that are empty and `cornerTouch` the color (or the color's start cells for a first piece), each remaining piece and orientation, aligning each cell of the orientation onto the anchor.
- `gameStatus`: `Alice placed a piece in Blue`; when colors go out in the advance, add `Red cannot place any more` per color; game over `Alice wins with 12 points` or `Alice and Bob tie with 12 points`.
- **Scoring** (`colorScore`): minus the cells of every unplayed piece; if every piece is placed, plus 15, and plus 5 more when the last piece in `used` is piece 0. A seat's score is the sum over the colors it owns; the shared color counts for nobody. `winners` are the seats with the top score.
- `onPlayerLeft`: the leaver's colors go into `out`; owners stay as they are, so the shared color keeps rotating among `activePlayers`; when the leaver held the turn, advance from `turnColor`. If every color is now out, end the game as above.
- `finalStandings`: `rankStandings` by score descending, score text `pointsText(score)`.
- `toPublicState` adds `scores` and `colorScores`; nothing is hidden.

- [ ] **Step 1: Write the failing tests** in `rules.test.ts` (seats from `addPlayer` with `seeded(1)` from `games/testStates.ts`, rules set through `withRules` from `server/testing.ts`):
  - `'two players own two colors each and alternate'`: owners `{0:1, 1:2, 2:1, 3:2}`; after four legal first moves `currentPlayer` went 1, 2, 1, 2.
  - `'three players share the fourth color in turn'`: the shared color is placed by seat 1, then seat 2, then seat 3 on its next three turns; `scores` never include it.
  - `'the first piece must cover the corner on squares'`: Blue's single square at `(1,0)` is `{ error: 'Your first piece must cover your corner' }`; at `(0,0)` it is placed.
  - `'the first piece must cover a starting point on triangles'`.
  - `'a later piece must touch its color at a corner and never along a side'`: a side touch gives `Pieces of one color may only touch at corners`; a gap gives `A piece must touch your color at a corner`; a corner touch is placed; a side touch with another color's piece is allowed.
  - `'a corner on a side is a corner touch on triangles'`: build a same-color pair where one triangle's corner lies on the middle of the other piece's two-triangle straight side and assert `placementError` is null.
  - `'forged moves are refused'`: orientation `99`, `dx: 1.5`, `dx: 1e9`, a used piece, `piece: -1`, `type: 'jump'`: each an error, state unchanged.
  - `'a blocked color is skipped and stays out'`: patch a board where Yellow has no legal spot; after Blue's move `turnColor` is Red, `out` holds 1, status contains `Yellow cannot place any more`.
  - `'the move that blocks everyone ends the game'`.
  - `'scoring: minus unplayed cells, plus 15 for all, plus 5 when the single cell is last'`: all 21 placed with piece 0 last scores 20; all placed with piece 0 earlier scores 15; pieces of 89 cells minus 5 placed scores -84.
  - `'two players score both their colors; a tie is a shared win'`.
  - `'a dismissed player\'s colors go out and the shared color keeps rotating'`: 3 seats, seat 2 leaves; the next shared turns go to seats 1 and 3.
  - `'changing the Board rule resets the board'`: `resetLobby` under `triangles` gives `board === 'triangles'` and empty `placed`.
  - `'standings rank by score with winners first'`.
- [ ] **Step 2: Run** `node --test games/corners/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four files.
- [ ] **Step 4: Run** `node --test games/corners/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Corners: rules, turn order and scoring`.

### Task 4: Registration and manager test

**Files:**
- Create: `games/corners/index.ts`, `games/corners/manager.test.ts`
- Modify: `games/registry.ts` (import and `corners` after `connectfour` in `GAMES`, which is alphabetical by name), `games/infos.ts` (the same place), `shared/categories.test.ts` (`'corners'` in `strategy`, both counts 42 to 43)
- Test: the above plus `games/standings.test.ts`, `games/infos.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts` unchanged

**Interfaces:**
- Consumes: Task 3.
- Produces: `corners: GameDefinition<GameState, PublicGameState>` with `info`, `createGameState`, `resetLobby`, `onPlayerLeft`, `applyMove`, `toPublicState`, `finalStandings`.

- [ ] **Step 1: Write the failing test** `manager.test.ts` through `createGameManager([corners], seeded(42))` with `rememberingKeys` and `agreeAll` from `server/testing.ts`:
  - `'two players place the four first pieces through the manager'`: join two, agree, place Blue, Yellow, Red and Green on their corners; `stepsOf(manager, 'corners')` has 4 steps, each `describeMove`-ready `lastMove`, and `currentPlayer` went 1, 2, 1, 2. (The forced end is covered in Task 3.)
  - `'an undo vote takes back a placement'`: place, request undo, approve; `placed` is one shorter and `currentPlayer` is back.
  - `'the Board house rule switches to triangles before the start'`.
- [ ] **Step 2: Run** `node --test games/corners/manager.test.ts games/*.test.ts shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `index.ts` and the registration lines.
- [ ] **Step 4: Run** `node --test games/corners/*.test.ts games/*.test.ts shared/categories.test.ts && npm run typecheck`. Expected: PASS except `src/games/loadClientGame.test.ts` (no client yet; Task 5).
- [ ] **Step 5: Commit** `Corners: registration and manager test`.

### Task 5: Client

**Files:**
- Create in `games/corners/client/`: `GameScreen.tsx`, `Board.tsx`, `Tray.tsx`, `PieceShape.tsx`, `HistoryBoard.tsx`, `placeInput.ts`, `describeMove.ts`, `faq.ts`, `index.ts`, `corners.scss`
- Modify: `src/clientGames.ts` (one line), `shared/svg/gameIcons.ts` (one `corners` line, drawn with `lineIcon`: four small squares meeting corner to corner on a diagonal)
- Test: `games/corners/client/placeInput.test.ts`, `games/corners/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PublicGameState`, `COLOR_NAMES`, `cellsOf`, `legalSpots`, `seatToPlace` (Task 3); `corners` (Task 2); `GameScreenProps`, `ClientGame` from `src/clientGames.ts`; `gameService.makeMove`, `requestUndo`; `ColorSymbol` for each color (blue, yellow, red, green).
- Produces: `cornersClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `gameLength` (`plural(placed.length, 'piece')`).
- Produces (`placeInput.ts`, pure): `type Draft = { piece: number; orientation: number; spot: { dx: number; dy: number } | null }`; `turn(kind, draft, by: 1 | -1): Draft`, `flip(kind, draft): Draft` (the orientation index the symmetry gives, found with `orientations` and `canonical`); `tapSpot(draft, spot, legal: Spot[]): { draft: Draft; place: boolean }` (a legal spot that is not the previewed one previews it; the previewed one again places; an illegal one clears the preview); `keepSpot(draft, legal): Draft` (after turning, the spot stays only if still legal).

Decisions:
- Board: one SVG. Squares cell `(x, y)` at `x, y` with size 1. Triangle corner `(x, y)` drawn at `(x + y / 2, y · √3 / 2)`. Placed cells take their color with its `ColorSymbol` pattern when the color-blind setting is on; empty start cells show a small marker.
- Tray: the pieces of the color to place (for the shared color, its pieces), unplayed only, each a `PieceShape` button with `aria-label` `Piece of 5 squares` or `Piece of 5 triangles` plus its index; the chosen one is `aria-pressed`. Below it **Turn left**, **Turn right**, **Flip** buttons; on desktop `Q` and `E` turn, `F` flips, `Escape` drops the choice.
- Legal spots for the chosen piece and orientation are outlined on the board. On desktop the piece previews under the pointer on a legal spot and a click places it; on touch `tapSpot` decides. A **Place** button also places the previewed piece (keyboard and phone).
- Only the seat `seatToPlace` sees an active tray; others see the color to place, its owner's name and the scores per seat and color.
- Undo: the platform Undo button (`requestUndo`).
- `describeMove`: `Alice placed a piece of 5 squares in Blue`, `Cara placed a piece of 3 triangles in Green (shared)`; game over adds nothing (status says it).
- Layout: board and tray side by side at laptop width, stacked below 640 px with the tray scrolling sideways; board cells at least 14 px on a 390 px phone for Squares (the SVG fills the width).

- [ ] **Step 1: Write the failing tests:** `placeInput.test.ts`: `'a first tap previews and a second places'`, `'a tap on an illegal spot clears the preview'`, `'turning keeps the spot only while it stays legal'`, `'four right turns come back to the start on squares and six on triangles'`, `'flipping twice comes back'`. `describeMove.test.ts`: the two texts above exactly.
- [ ] **Step 2: Run** `node --test games/corners/client/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client files and the two one-line registrations.
- [ ] **Step 4: Run** `node --test games/corners/client/*.test.ts src/games/loadClientGame.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Corners: board, tray, history and FAQ`.

### Task 6: README and end-to-end tests

**Files:**
- Create: `games/corners/README.md`, `e2e/corners.spec.ts`

**Interfaces:**
- Consumes: the labels from Task 5; `seat`, `table.patch`, `table.state`, `setHouseRules`, `undo`, `dismiss`, `openFaq`, `headerButton`, `setPreference` from `e2e/fixtures.ts` (unchanged).

README (`games/corners/README.md`, sections Rules, Controls, Differences from Wikipedia, in the format of `games/rook/README.md`, linking [Wikipedia's Blokus article](https://en.wikipedia.org/wiki/Blokus)). Differences to list:
- Wikipedia lets a three-player game either give one player two colors or place the fourth color "in a non-strategic way"; here the three players take turns placing the shared fourth color, which scores for nobody.
- Wikipedia does not give the triangle board's size, piece set or starting points. Here the board is a hexagon of side 9 (486 triangles), each color has the 22 shapes of 1 to 6 triangles, and there are six starting points 3 steps in from each corner of the hexagon toward the middle; any color's first piece may cover any starting point not yet covered.
- Wikipedia's triangle game is best with three colors; here the Triangles board uses four colors at every player count, with the same two-colors and shared-color rules as Squares.
- Colors with no legal placement pass automatically, and the game says so; there is no Pass button.
- The game is played on screen, so pieces cannot be placed illegally and the score is counted for you.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/corners.spec.ts`**, one test per rule, control and difference in the README, patching boards with `table.patch` where a test needs a late position. At least: Squares is the standard Board and Triangles is offered; two players alternate two colors each; three players rotate the shared color and its score shows for nobody; a first piece off the corner is refused with the message; a side touch of the same color is refused, a corner touch placed; turning and flipping with the buttons and with Q, E and F changes the preview; legal spots are outlined; desktop click places; with `touch: true` a tap previews and a second tap places; a blocked color is skipped with its status line; the game ends when nobody can place and the game over dialog shows the scores with the +15 and +5 bonuses; Triangles: the board shows 486 cells and six start markers, a first piece must cover one; Undo by vote takes back a placement; History (through `headerButton(page, 'History')`) steps through placements; a dismissed player's colors stop; color-blind symbols show with the setting on; FAQ opens.
- [ ] **Step 3: Run** `E2E_PORT_BASE=8700 npx playwright test --workers=2 e2e/corners.spec.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `Corners: README and end-to-end tests`.

### Task 7: Browser check

**Files:** none new (fix what the check finds, with a test for each fix, in the task that owns the code).

- [ ] **Step 1:** In the worktree: `npx vite build`, then `PORT=3707 node server/server.ts` (run in the background).
- [ ] **Step 2: Play in Chrome**, one tab per player, at `http://localhost:3707`: a two-player Squares game to a forced end (patching a late board is fine), a three-player game long enough to see the shared color rotate, and a Triangles game through every first placement and a few more. Open History mid-game and step through; after game over download the game file, open it, and use View as for each seat.
- [ ] **Step 3: Check layout** at laptop size and at phone width (390 px and 320 px same-origin iframes, per the memory note; `data-theme="dark"` on an iframe's root for dark mode), on both boards, light and dark: no overlap, no blank rows, tray and Place reachable, legal spots visible, symbols visible with the color-blind setting on.
- [ ] **Step 4:** Stop the server. Commit any fixes with their tests.

### Task 8: Full test run

**Files:** none.

- [ ] **Step 1: Run** `npm test`. Expected: PASS.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: PASS.
- [ ] **Step 3: Run** `npm run lint`. Expected: PASS with 0 warnings.
- [ ] **Step 4: Run** `E2E_PORT_BASE=8700 npx playwright test --workers=2 e2e/corners.spec.ts e2e/history.spec.ts e2e/rules.spec.ts e2e/lazyLoading.spec.ts`. Expected: PASS. Do not run or fix `e2e/landing.spec.ts` counts; the coordinator updates them after the merge.

### Task 9: Push and pull request

**Files:** none.

- [ ] **Step 1:** `git push -u origin game-corners`.
- [ ] **Step 2:** `gh pr create --base party-games-and-polish --head game-corners --title "Corners"` with a body that lists: the rules and both boards, the Differences from Wikipedia, every line changed outside `games/corners/` (registry, infos, clientGames, gameIcons, categories test), and for the coordinator the lines left to them (root README game list and count, `e2e/landing.spec.ts` counts, `docs/architecture.md`). The body ends with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
- [ ] **Step 3:** Report the PR URL.
