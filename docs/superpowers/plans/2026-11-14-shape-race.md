# Shape Race Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Shape Race (`shaperace`), where every player races the same board of shaped holes against one shared countdown.

**Architecture:** A pure `board.ts` module deals the shared layout and decides whether a shape fits a hole. `rules.ts` follows Jigsaw's race pattern: every move is an `applyAction` from any seat at any time, only a successful placement is recorded, and the countdown is the platform `deadline`/`onDeadline`/`resumeClock` the way Categories does it. The client draws shapes as inline SVG and drags with pointer events, as Jigsaw's `usePieceDrag` does.

**Tech Stack:** TypeScript, React, SCSS, `node --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-shape-race-design.md`

## Global Constraints

- Game id `shaperace`, display name `Shape Race`. No trademarked names or art anywhere (no "Perfection").
- 1 to 8 players, `continuesAlone: true`, `ownTurnLimit: true`, `passAndPlay: false`, `allowsUndoVote` returns false, no `undoOwn`.
- House rules: Board size 9, 16 (standard), 25 shapes; Timer 30, 60 (standard), 90 seconds; Race end Keep racing (standard) or First finish, offered only with 2+ seats.
- The server owns the clock and decides close finishes by arrival; no client timestamps.
- No new npm dependencies. No em-dashes in README, FAQ or commit messages.

## Review Focus

- A placement that reaches the server at or after the deadline is refused with `Time is up` and does not count (Task 2 test `a placement after the deadline is refused`).
- With Keep racing, if the only unfinished player leaves, the race ends at once with the finishers ranked (Task 2 test `leaving ends the race when everyone left has finished`).
- A shape already placed, or a hole already filled, cannot be placed into again (Task 1 test `fits refuses a filled hole and a placed shape`).
- The clock does not start before every player has agreed to the house rules, and a game over state never restarts it (Task 2 test `resumeClock starts the race only once everyone agreed`).
- A drag released off the board, or cancelled by the browser (`pointercancel`), springs the shape back and sends nothing (Task 3 Chrome check).

---

### Task 1: Shapes and the board

**Files:**
- Create: `games/shaperace/shapes.ts`, `games/shaperace/board.ts`
- Test: `games/shaperace/board.test.ts`

**Interfaces:**
- Produces, in `shapes.ts`: `type ShapeId = string`; `SHAPES: { id: ShapeId; label: string; period: 1 | 2 | 4 | 8; path: string }[]`, exactly 25 entries with distinct ids. `path` is SVG path data in a 100 by 100 box centred on 50,50. `period` is the smallest number of 45 degree steps after which the shape looks the same: 1 for circle and octagon, 2 for 90 degree symmetry (square, plus), 4 for 180 degree symmetry only, 8 for none.
- Produces, in `board.ts`: `ROTATION_STEPS = 8`; `type BoardSize = 9 | 16 | 25`; `type Layout = { size: BoardSize; holes: ShapeId[]; tray: ShapeId[]; startTurns: number[] }` (`holes[i]` is the shape cut at grid cell `i`, row-major on a `Math.sqrt(size)` square; `tray` is the same shapes in another order; `startTurns[i]` is tray shape `i`'s starting rotation, 0 to 7); `dealLayout(size: BoardSize, random: Random): Layout`; `fits(layout: Layout, placed: Partial<Record<number, number>>, trayIndex: number, hole: number, turns: number): boolean` where `placed` maps hole index to tray index; `turnOnce(turns: number): number`.

- [ ] **Step 1: Write the failing tests** in `games/shaperace/board.test.ts`, using `seeded` from `games/testStates.ts`:
  - `SHAPES has 25 distinct shapes`: length 25, `new Set(ids).size === 25`, every `period` in `[1, 2, 4, 8]`.
  - `dealLayout uses size distinct shapes in holes and tray`: for each of 9, 16, 25: `holes.length === size`, `[...tray].sort()` deep-equals `[...holes].sort()`, `startTurns.length === size`, every value 0 to 7.
  - `dealLayout never starts a shape already fitting unless it always fits`: for every tray shape with `period > 1`, `startTurns[i] % period !== 0`.
  - `dealLayout is the same for the same seed`: two calls with `seeded(7)` deep-equal.
  - `fits accepts the matching hole at any equivalent rotation`: for a `period 2` shape, turns 0, 2, 4, 6 fit and 1, 3, 5, 7 do not; a `period 1` shape fits at every turn.
  - `fits refuses a wrong hole`: a tray shape against a hole cut for another shape is false.
  - `fits refuses a filled hole and a placed shape`: with `placed = { [hole]: other }` the hole is refused, and a tray index already among `Object.values(placed)` is refused for every hole.
  - `turnOnce wraps`: `turnOnce(7) === 0`, `turnOnce(3) === 4`.
- [ ] **Step 2:** `node --test games/shaperace/board.test.ts` fails: modules missing.
- [ ] **Step 3:** Write `shapes.ts` (25 simple, readable silhouettes, for example circle, square, triangle, five point star, six point star, hexagon, pentagon, octagon, diamond, plus, X, heart, crescent, arrow, lightning bolt, kite, trapezoid, parallelogram, semicircle, oval, teardrop, house, L, T, moon ring) and `board.ts`. `dealLayout` shuffles `SHAPES` with `shared/shuffle.ts`, takes `size`, shuffles again for `tray`, and draws each start turn from the turns where `turns % period !== 0`.
- [ ] **Step 4:** The tests pass.
- [ ] **Step 5: Commit** `Shape Race shapes and board` with the three files.

### Task 2: Rules, house rules and registration

**Files:**
- Create: `games/shaperace/types.ts`, `options.ts`, `info.ts`, `rules.ts`, `index.ts`
- Modify: `games/registry.ts`, `games/infos.ts`, `shared/categories.test.ts` (add `shaperace` to `party`, bump the `grouped.length` count by one), `shared/svg/gameIcons.ts` (a `shaperace` line icon: a star above a square hole)
- Test: `games/shaperace/rules.test.ts`, `games/shaperace/manager.test.ts`

**Interfaces:**
- Consumes: Task 1's `Layout`, `dealLayout`, `fits`, `turnOnce`, `BoardSize`.
- Produces, in `options.ts`: `SIZE_RULE: ChoiceRule<BoardSize>` (id `shapes`, label `Board size`), `TIMER_RULE: ChoiceRule<30 | 60 | 90>` (id `seconds`, label `Timer`), `END_RULE: ChoiceRule<'keep' | 'first'>` (id `raceEnd`, label `Race end`, labels `Keep racing` and `First finish`, `offered: seats => seats >= 2`), `SHAPERACE_RULES`.
- Produces, in `types.ts`: `GameState extends BaseGameState` with `layout: Layout | null`, `boards: RaceBoards<SeatBoard>` (`SeatBoard = { placed: Partial<Record<number, number>>; turns: number[] }`), `startedAt: number | null`, `finishedAt: Partial<Record<Seat, number>>` (ms after `startedAt`), `popped: boolean`. `PublicGameState` adds `layout`, `boards` (from `visibleBoards` in `shared/puzzleModes.ts`), `placedCounts: Partial<Record<Seat, number>>`, `finishedAt`, `endsAt: number | null`, `popped`.
- Produces, in `rules.ts`: the `GameDefinition` hooks `createGameState`, `resetLobby`, `applyAction`, `recordsAction`, `applyMove` (always `{ error: 'Drag the shapes onto the board' }`), `deadline`, `onDeadline`, `resumeClock`, `allowsUndoVote` (false), `onPlayerLeft`, `finalStandings`, `toPublicState`, `privateSeatView` (`seatFields(..., ['boards'])`), `spectatorState` (all boards). `index.ts` wires them with `continuesAlone: true` and `spectatorsSeeEverySeat: true`.
- Actions: `{ type: 'turn', shape: number }` (unrecorded, turns tray shape `shape` one step for the sender only) and `{ type: 'place', shape: number, hole: number }` (recorded only when it fits).

- [ ] **Step 1: Write the failing tests** in `rules.test.ts` (style as `games/jigsaw/rules.test.ts`, with `seeded`, `addPlayer` and a helper that agrees to house rules and calls `resumeClock(state, 1000)`):
  - `every seat gets the same layout`: after `resetLobby` with 3 seats, `boards[1..3]` all start with `placed` empty and `turns` equal to `layout.startTurns`.
  - `resumeClock starts the race only once everyone agreed`: before agreement `startedAt === null` and `deadline(state) === null`; after, `startedAt === 1000` and `deadline === 1000 + 60_000` at the standard timer; on a game over state `resumeClock` returns it unchanged.
  - `turn changes only the sender's shape`: seat 1 turns shape 0, seat 2's `turns[0]` is unchanged, and `recordsAction` is false.
  - `a fitting placement is recorded and a wrong one is refused`: placing at the matching hole with matching turns returns a state with `placed[hole] === shape` and `recordsAction` true; the wrong hole returns `{ error: 'That shape does not fit there' }`.
  - `a placement after the deadline is refused`: `applyAction(state, 1, place, random, deadline)` returns `{ error: 'Time is up' }`.
  - `keep racing ranks finishers by time`: 3 seats, seat 2 fills at +5000 ms and seat 1 at +7000 ms; the game is not over until seat 3 also fills or `onDeadline` runs; then `winners` is `[2]` and `finalStandings` places 2, 1, 3 with seat 3 scored as `n/16`.
  - `finishes in the same tick share the place`: seats 1 and 2 finish 30 ms apart within one `SIMULATION_TICK_MS` bucket (`Math.floor(ms / SIMULATION_TICK_MS)` equal), both are winners.
  - `first finish ends the race at once`: with `raceEnd` `first`, the first fill sets `isGameOver`, `winners [seat]`, others ranked by placed count, equal counts share a place.
  - `the pop ends the race`: `onDeadline` sets `isGameOver`, `popped: true`, winners are the finishers or, with none, the top placed count (ties share).
  - `solo wins only by filling the board`: 1 seat, `onDeadline` before filling gives `winners []`; filling first gives `winners [1]` with the time as score.
  - `leaving ends the race when everyone left has finished`: 3 seats, seats 1 and 2 finished, `onPlayerLeft(state, 3)` ends the game.
  - `others see counts, not boards, during the race`: `toPublicState(state, false, 1).boards` has only seat 1; `placedCounts` has every seat; once over every board is visible.
- [ ] **Step 2:** `manager.test.ts`, with the mock clock pattern of `games/categories/manager.test.ts:18-24` (`t.mock.timers`, `createGameManager(..., { now })`, `advance(ms)`): `the server clock ends a race`: two players agree, one places a shape, `advance(60_000)` ends the game with `popped` true and that player first.
- [ ] **Step 3:** `node --test games/shaperace` fails: modules missing.
- [ ] **Step 4:** Implement. `resumeClock` follows `games/categories/rules.ts:240` (start only once `everyoneAgreed(shaperaceInfo, state)` and not over), with the comment `shortcut: a server restart gives the race its full time again, store elapsed time if that ever matters`. `finalStandings` uses `rankStandings` from `shared/standings.ts`, finishers before non-finishers, finishers by tick bucket, the rest by placed count. Score text: `formatClock` style `0:42.3` for a finish, `12/16` otherwise. Register in `games/registry.ts` and `games/infos.ts` in alphabetical position like the neighbours; category `party`.
- [ ] **Step 5:** `npm test`, `npm run lint` and `npm run typecheck` pass, including `shared/categories.test.ts`, `games/secretState.test.ts` (Shape Race has no `secretState`: nothing is hidden from the whole table) and `games/privateSeatView.test.ts`.
- [ ] **Step 6: Commit** `Shape Race rules and house rules`.

### Task 3: The game screen

**Files:**
- Create: `games/shaperace/client/index.ts`, `GameScreen.tsx`, `RaceBoard.tsx`, `ShapeArt.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `describeMove.test.ts`, `faq.ts`, `shaperace.scss`
- Modify: `src/clientGames.ts` (a `shaperace` lazy import like `jigsaw`)

**Interfaces:**
- Consumes: Task 2's `PublicGameState`, actions and `SHAPES`, `fits`, `turnOnce`.
- Produces: `shaperaceClient: ClientGame` with `Screen`, `faq`, `HistoryBoard`, `describeMove`.

- [ ] **Step 1: Write the failing test** `describeMove.test.ts`: a recorded place reads `Alice placed the star`, the pop reads `Time ran out`, and a fill reads `Alice filled the board in 0:42.3`.
- [ ] **Step 2:** It fails; implement `describeMove.ts`; it passes.
- [ ] **Step 3:** Build the screen. Your board on top: the holes on a square grid, placed shapes sitting in them. The tray below: tap a shape to send `turn`, press and drag to move it (pointer capture, as in `games/jigsaw/client/usePieceDrag.ts`). On release over a hole, check `fits` locally first and send `place` only when it fits; otherwise, or on release off the board or `pointercancel`, animate it back and send nothing. A countdown from `useCountdown(endsAt, serverTime)` (`src/hooks/useCountdown.ts`), and one progress bar per other player (`Ana 12/16`, a check mark once finished). When `popped`, the holes spring up and unplaced shapes scatter in a short CSS animation (skipped under `prefers-reduced-motion`), then the standard game over dialog with the platform rematch shows Race again. Spectators and the table screen show every board side by side in compact form. Shapes are `ShapeArt` inline SVG from `SHAPES[].path`, so no server asset is needed and `server/assets/registry.ts` is untouched. Each tray shape is a button with `aria-label` like `Star, turned 90 degrees`.
- [ ] **Step 4:** `faq.ts` covers turning, dragging, what happens on a wrong drop, the timer, both Race end rules and solo.
- [ ] **Step 5:** `npm run build` passes.
- [ ] **Step 6: Commit** `Shape Race game screen`.

### Task 4: Docs, end-to-end tests and browser checks

**Files:**
- Create: `games/shaperace/README.md`, `e2e/shaperace.spec.ts`
- Modify: `README.md` line 3 (game count word and "Jigsaw, Steady Hand and Sudoku (one to eight players)" becomes a list that includes Shape Race) and the games list (an entry in alphabetical order, linking `games/shaperace/README.md`, no Wikipedia line since the rules are original)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1:** `games/shaperace/README.md` with Rules and Controls sections in the style of `games/steadyhand/README.md`, stating every house rule, the tick-share tie, solo, leaving and that there is no undo.
- [ ] **Step 2: Write `e2e/shaperace.spec.ts`** with the fixtures in `e2e/fixtures.ts` (`joinGame`, `setHouseRules`, `agreeToHouseRules`, `drag`, `touchDrag`, `leave`, `watch`), one test per README rule and control: a fitting drag places, a wrong drag springs back, tap turns, others see `1/16`, first fill wins, First finish ends at once, the pop at a short timer (use the E2E state hooks in `server/e2e.ts` to set `startedAt` near the deadline), a spectator sees both boards.
- [ ] **Step 3:** `npm run test:e2e -- e2e/shaperace.spec.ts` passes.
- [ ] **Step 4: Chrome check.** Start the app and load it in Chrome at desktop width and in a 320 px wide iframe (the phone-width method in memory). For each board size 9, 16 and 25: drag shapes with touch-style input (`touchDrag` behaviour, or the Chrome tool's touch drag), turn one by tapping, drop one wrongly and see it spring back, release one off the board, and let one race pop. Check for overlap, horizontal scroll, cut-off tray shapes and progress bars wrapping badly at both widths, and watch one race as a spectator.
- [ ] **Step 5:** `npm test`, `npm run lint`, `npm run build` pass.
- [ ] **Step 6: Commit** `Shape Race docs and end-to-end tests`.
