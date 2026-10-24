# Drag and Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players drag pieces and tiles with mouse and touch in eleven games, plus a shared piece tray for placing pieces from a supply, while every click, tap, button and key that works today keeps working.

**Architecture:** One pointer-events hook, `useDrag` in `src/drag/`, owns the press, the movement threshold, the floating copy of the piece, finding the drop target under the pointer, snapping back and swallowing the click after a drag. A game wires it to the handlers it already has: lifting a piece calls the game's own select (so today's highlights light up), and a drop calls the game's own click handler for that spot (so the same message goes to the server). A shared `PieceTray` component shows a supply of pieces as a hand. No server or rules file changes.

**Tech Stack:** TypeScript, React 19, Vite, SCSS, `node --test`, Playwright (Chromium), Node 22.18+ through nvm.

**Spec:** `docs/superpowers/specs/2026-10-24-drag-and-drop-design.md`

## Global Constraints

- Branch `drag-and-drop`, cut from `scss-migration` (PR #21), or from `master` if #21 has merged. Do not depend on the house rules, preferences, UI polish, Catan five-six or Dominoes layouts branches.
- "Built on pointer events, with no library." No new dependencies.
- "A drag starts only after a small movement, so a tap stays a tap and the page still scrolls on a phone": `DRAG_THRESHOLD_PX = 6`.
- "Dropping on a legal spot makes the same move a click would. Dropping anywhere else snaps the piece back." A drop calls the game's existing click handler for that spot; no new move or action types; "the server learns nothing new".
- "Only when the move is yours. Off-turn, pieces do not lift, except that you can rearrange your own rack in Scrabble and Rummikub at any time."
- "The existing buttons keep working", and "everything stays possible with click or tap alone, and keyboard play that exists today keeps working".
- "One implementation, not one per game": every game uses `useDrag`; Rummikub's HTML5 drag and drop is removed.
- Dominoes is out of scope; its own plan consumes `useDrag` exactly as Task 1 documents it.
- Styles in SCSS: platform defaults in `src/App.scss` under `:where()`, game styles nested under `[data-game="<id>"]`. Check light and dark (`data-theme`) at phone width (390x844) and wide (1280x800).
- "Tests: unit tests for the shared drag logic; at least one e2e drag test per game using Playwright's mouse API, plus one touch test."
- `docs/architecture.md`, the README and each touched game's README Controls section and FAQ (`client/faq.ts`) are updated in the task that changes the game.
- Unit tests sit next to the code as `*.test.ts` (pure `.ts` only; `node --test` cannot load `.tsx`). E2E tests go in `e2e/<id>.spec.ts` using `e2e/fixtures.ts`.
- No em-dashes in code comments, docs, READMEs, FAQs or commit messages.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every task ends with `npm test`, `npm run typecheck` and `npm run lint` passing, plus the e2e specs of the games it touched.

## Review Focus

- The game state changes while a piece is held (the opponent's undo request, a dismiss vote, a patch that ends the turn): releasing over a square that was legal at lift time must snap back and send nothing. Task 2 pins it in `e2e/chess.spec.ts`.
- A drag that ends on its own starting square, or anywhere on the board, must not also deliver a click that reselects or moves something. Task 2 pins it (chess) and Task 8 keeps Carcassonne's pan-then-click guard on the shared helper.
- On a phone, a swipe that starts on anything that cannot be lifted (an empty square, or any piece off-turn) still scrolls the page. Task 2's touch test pins it.
- A drop inside a scrolled container (Quoridor's board scrolls sideways under 540px) lands on the square under the finger, not an offset one. Task 4 pins it.
- A second finger, a right click or a `pointercancel` mid-drag never lifts a second piece or sends a move. Task 1 pins it in `src/drag/dragMachine.test.ts`.

---

### Task 1: The shared drag hook

**Files:**
- Create: `src/drag/dragMachine.ts`, `src/drag/dragMachine.test.ts`, `src/drag/recentDrop.ts`, `src/drag/recentDrop.test.ts`, `src/drag/swallowClick.ts`, `src/drag/ghost.ts`, `src/drag/useDrag.ts`
- Modify: `src/animation/motion.ts` (`slideFrom` returns its `Animation`), `src/animation/useMoveAnimation.ts:348` (skip the animation of a move the player just dropped), `games/carcassonne/client/Board.tsx:118-126` (use `swallowNextClick`), `src/App.scss` (drag and tray defaults), `e2e/fixtures.ts` (drag helpers, `touch` option), `docs/architecture.md`

**Interfaces:**
- Produces (pure, `src/drag/dragMachine.ts`):
  ```ts
  export const DRAG_THRESHOLD_PX = 6;
  export type Point = { x: number; y: number };
  export type PointerInfo = { pointerId: number; isPrimary: boolean; button: number; point: Point };
  export type Press = { id: string; pointerId: number; start: Point; lifted: boolean };
  export type Outcome = { kind: 'tap' } | { kind: 'drop'; target: string } | { kind: 'cancel' };
  // The press to keep: `current` while one is held, null for a non-primary pointer or a button other than 0
  export function startPress(current: Press | null, id: string, pointer: PointerInfo): Press | null;
  // Lifted once the pointer is DRAG_THRESHOLD_PX or more from the start, and stays lifted; other pointers change nothing
  export function movePress(press: Press, pointerId: number, point: Point): Press;
  // Unlifted: a tap. Lifted: a drop when target is non-null and canDrop(press.id, target), otherwise cancel.
  // pointercancel and Escape call it with target null.
  export function endPress(press: Press, target: string | null, canDrop: (id: string, target: string) => boolean): Outcome;
  ```
- Produces (`src/drag/recentDrop.ts`): `DROP_SNAP_MS = 1000`; `markDropped(now?: number): void`; `takeDrop(now?: number): boolean` (true once for a mark made within `DROP_SNAP_MS`; `now` defaults to `performance.now()`).
- Produces (`src/drag/swallowClick.ts`): `swallowNextClick(): void` (the capture-phase, once-only click blocker now inline in Carcassonne's `Board.tsx`, cleared on the next tick).
- Produces (`src/drag/ghost.ts`, DOM only): `createGhost(source: Element, pointer: Point): HTMLElement` (a deep clone with every element's computed style copied inline, `position: fixed`, class `drag-ghost`, appended to `source.closest('[data-game]') ?? document.body`, keeping the grab offset); `moveGhost(ghost: HTMLElement, pointer: Point): void`; `returnGhost(ghost: HTMLElement, source: Element): void` (slides back to the source with `slideFrom`, then removes itself; removes at once under reduced motion or when the source is gone).
- Produces (the hook, `src/drag/useDrag.ts`), verbatim for the Dominoes plan:
  ```ts
  import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';

  export type DragOptions = {
    canLift: (id: string) => boolean;                 // read on every render; false means the element gets no source props
    canDrop: (id: string, target: string) => boolean; // read on every pointer move and at release, from the latest render
    onLift?: (id: string) => void;                    // once the pointer passes DRAG_THRESHOLD_PX: select the piece so its targets light up
    onDrop: (id: string, target: string) => void;     // released over a legal [data-drop] target
    onCancel?: (id: string) => void;                  // released anywhere else, pointercancel, Escape, or canLift(id) turned false mid-drag
  };

  export type DragSourceProps = {
    'data-drag': string;
    onPointerDown: (event: ReactPointerEvent<Element>) => void;
    onDragStart: (event: ReactDragEvent<Element>) => void; // prevents the browser's own image and text drag
  };

  export type Drag = {
    source: (id: string) => DragSourceProps | undefined; // spread as {...drag.source(id)}; undefined while canLift(id) is false
    dragging: string | null;                           // the lifted id, null when nothing is lifted
    over: string | null;                               // the legal target under the pointer, null otherwise
  };

  export function useDrag(options: DragOptions): Drag;
  ```
  Contract: a drop target is any element with `data-drop="<target id>"`; the innermost one under the pointer (`document.elementFromPoint(...).closest('[data-drop]')`) is the target, and it may be an SVG element. A source must be an HTML element or an outer `<svg>`. Ids are game-chosen strings. Pressing records the press only (no `preventDefault`, so focus, keyboard and click are untouched); a release before the threshold is a plain tap and the browser's click fires as before. Once lifted, the hook sets `data-dragging` on the source, shows the ghost, sets `data-drag-over` on the legal target under the pointer, and swallows the click that follows the release. On a drop it calls `markDropped()` then `onDrop`. Listeners live on `window` from press to release and are removed on unmount, which also cancels a lift.

- [ ] **Step 1: Write the failing unit tests**

  `src/drag/dragMachine.test.ts`, with `const at = (x: number, y: number) => ({ x, y })` and `const mouse = (point, pointerId = 1) => ({ pointerId, isPrimary: true, button: 0, point })`:
  ```ts
  test('a press starts only for a primary pointer and its main button', () => {
    assert.deepEqual(startPress(null, 'a', mouse(at(0, 0))), { id: 'a', pointerId: 1, start: at(0, 0), lifted: false });
    assert.equal(startPress(null, 'a', { ...mouse(at(0, 0)), button: 2 }), null);
    assert.equal(startPress(null, 'a', { ...mouse(at(0, 0)), isPrimary: false }), null);
  });
  test('a second press while one is held is ignored', () => {
    const held = startPress(null, 'a', mouse(at(0, 0)))!;
    assert.equal(startPress(held, 'b', mouse(at(9, 9), 2)), held);
  });
  test('a move under the threshold keeps it a tap', () => {
    const press = movePress(startPress(null, 'a', mouse(at(0, 0)))!, 1, at(3, 4)); // 5px
    assert.equal(press.lifted, false);
    assert.deepEqual(endPress(press, 'b', () => true), { kind: 'tap' });
  });
  test('a move of the threshold lifts the piece and it stays lifted', () => {
    const lifted = movePress(startPress(null, 'a', mouse(at(0, 0)))!, 1, at(6, 0));
    assert.equal(lifted.lifted, true);
    assert.equal(movePress(lifted, 1, at(0, 0)).lifted, true);
  });
  test('moves of another pointer change nothing', () => {
    const press = startPress(null, 'a', mouse(at(0, 0)))!;
    assert.equal(movePress(press, 2, at(50, 50)), press);
  });
  test('a lifted piece released over a legal target drops there', () => {
    assert.deepEqual(endPress(lifted('a'), 'sq', (id, target) => id === 'a' && target === 'sq'), { kind: 'drop', target: 'sq' });
  });
  test('a lifted piece released over an illegal target, no target, or by pointercancel snaps back', () => {
    assert.deepEqual(endPress(lifted('a'), 'sq', () => false), { kind: 'cancel' });
    assert.deepEqual(endPress(lifted('a'), null, () => true), { kind: 'cancel' });
  });
  ```
  (`lifted(id)` is a local helper that starts at 0,0 and moves 10px.)

  `src/drag/recentDrop.test.ts`:
  ```ts
  test('a drop is taken once', () => {
    markDropped(1000);
    assert.equal(takeDrop(1500), true);
    assert.equal(takeDrop(1500), false);
  });
  test('a drop older than DROP_SNAP_MS is not taken', () => {
    markDropped(1000);
    assert.equal(takeDrop(1000 + DROP_SNAP_MS + 1), false);
  });
  ```
- [ ] **Step 2: Run them to see them fail**

  Run: `node --test src/drag/dragMachine.test.ts src/drag/recentDrop.test.ts`
  Expected: FAIL, the modules do not exist.
- [ ] **Step 3: Implement `dragMachine.ts` and `recentDrop.ts`** with the signatures above (`Math.hypot` against the threshold; module-level timestamp for `recentDrop`).
- [ ] **Step 4: Run them to see them pass**

  Run: `node --test src/drag/dragMachine.test.ts src/drag/recentDrop.test.ts`
  Expected: PASS, 9 tests.
- [ ] **Step 5: Implement `swallowClick.ts`, `ghost.ts` and `useDrag.ts`; change `slideFrom` and `useMoveAnimation`; switch Carcassonne's pan to `swallowNextClick`**
  - `useDrag` keeps `options` in a ref refreshed in `useLayoutEffect`, drives `Press` through the pure functions, and holds `dragging` and `over` in state. Escape while lifted cancels (a `keydown` listener added on lift only, so keyboard play is untouched otherwise). The ghost has `pointer-events: none` so `elementFromPoint` sees what is under it.
  - `slideFrom(...)` returns `Animation | null` (null when canceled for reduced motion); existing callers ignore it.
  - In `useMoveAnimation`, the one-move branch becomes `previous && rects && state.moveCount === previous.moveCount + 1 && !takeDrop()`, so the player who dropped a piece does not watch it fly back from where it started; other players still see the animation. Rects are still stored.
- [ ] **Step 6: Add the platform styles to `src/App.scss`**, each under `:where()`, with `--<name>-default` tokens in both the light `:root` and `:root[data-theme="dark"]` blocks:
  - `[data-drag]`: `touch-action: none; user-select: none; -webkit-touch-callout: none; cursor: grab`
  - `[data-dragging]`: `opacity: 0.35`
  - `.drag-ghost`: `position: fixed; z-index: 1000; pointer-events: none; cursor: grabbing; filter: drop-shadow(...)`, scaled 1.08
  - `[data-drag-over]`: `outline: 3px solid var(--drag-over, var(--drag-over-default)); outline-offset: -3px`
  - `.piece-tray`, `.piece-tray-pieces`, `.piece-tray-piece` (plus `[aria-pressed="true"]` and `:disabled` dimmed to 0.4 opacity), `.piece-tray-count`, themable with `--piece-tray-bg`, `--piece-tray-border`, `--piece-tray-text`, `--piece-tray-selected` (Task 4 builds the component on these)
- [ ] **Step 7: Add the e2e helpers to `e2e/fixtures.ts`**
  ```ts
  // Drags with the mouse from the center of `from` to `to` (its center, or `position` inside it), in 8 steps as a person would
  export async function drag(page: Page, from: Locator, to: Locator, position?: { x: number; y: number }): Promise<void>;
  // Presses on `from` and moves `by` (default 20, 0) without releasing, so a test can act mid-drag; finish with page.mouse.move/up
  export async function lift(page: Page, from: Locator, by?: { x: number; y: number }): Promise<void>;
  // One finger from `from` to `to` through Chrome's touch input (CDP Input.dispatchTouchEvent: touchStart, 8 touchMoves, touchEnd)
  export async function touchDrag(page: Page, from: Locator, to: Locator): Promise<void>;
  ```
  `SeatOptions` gains `touch?: boolean`; `newPlayer` then builds the context from `devices['Pixel 7']` (touch, mobile viewport) with the same `baseURL` and `reducedMotion`.
- [ ] **Step 8: Document it** in `docs/architecture.md`: a `src/drag/` entry under Client (the contract above in prose, `swallowNextClick`, `markDropped`/`takeDrop` and how `useMoveAnimation` uses it), the new `App.scss` selectors and `--drag-over`/`--piece-tray-*` variables in the default-styles list.
- [ ] **Step 9: Verify**

  Run: `npm test && npm run typecheck && npm run lint && npx playwright test e2e/carcassonne.spec.ts`
  Expected: all pass; the Carcassonne pan test still passes on `swallowNextClick`.
- [ ] **Step 10: Commit** `feat: shared pointer drag hook`

### Task 2: Chess and Checkers pieces, and the touch test

**Files:**
- Modify: `games/chess/client/Board.tsx`, `games/chess/client/PieceGlyph.tsx` (accept `dragProps?: DragSourceProps`), `games/chess/client/chess.scss`, `games/chess/README.md`, `games/chess/client/faq.ts`, `e2e/chess.spec.ts`
- Modify: `games/checkers/client/GameScreen.tsx`, `games/checkers/client/Board.tsx` (accept `drag: Drag`), `games/checkers/client/checkers.scss`, `games/checkers/README.md`, `games/checkers/client/faq.ts`, `e2e/checkers.spec.ts`

**Interfaces:**
- Consumes: `useDrag`, `Drag`, `DragSourceProps` (Task 1); `drag`, `lift`, `touchDrag`, `SeatOptions.touch` (Task 1 fixtures).
- Ids: source and target are both `"<row>-<col>"` of board coordinates in both games; every square carries `data-drop`.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/chess.spec.ts` (using its `square`, `piece`, `marks`, `setUp`, `start` helpers):
  - `a piece dragged to a marked square moves there, and the marks show while it is held`: `lift(alice, piece(alice, 'e2'))`, then `expect(marks(alice)).toHaveCount(2)`, move to `e4` and release; `piece(bob, 'e4')` has label `white pawn`, `square(alice, 'e2')` has no piece.
  - `a piece dropped on a square it cannot reach goes back, and nothing stays selected`: drag e2 to e5; e2 still holds the pawn, `.square.selected` count 0, `.drag-ghost` count 0, server `moveCount` unchanged.
  - `a drag that ends where it began leaves nothing selected`: `drag(alice, piece(alice, 'e2'), square(alice, 'e2'))`; `.square.selected` count 0.
  - `a drag to the last rank opens the promotion picker, as a click does`: set up a white pawn on a7; drag to a8; the picker is visible and choosing Queen puts a white queen on a8.
  - `off turn, pieces do not lift`: Bob `lift`s his e7 pawn; `.drag-ghost` count 0 on Bob's page; after `mouse.up`, nothing moved.
  - `a change of turn while a piece is held snaps it back`: Alice lifts e2; `table.patch({ currentPlayer: 2 })`; she releases over e4; e2 still holds the pawn and server `moveCount` is unchanged.
  - Touch, `seat('chess', ['Alice', 'Bob'], { touch: true })`: `a finger drags a piece, a tap still selects one, and a swipe from an empty square scrolls the page`: `touchDrag` e2 to e4 moves the pawn for both players; on Bob's turn `bob.touchscreen.tap` on the e7 pawn adds `selected`; a `touchDrag` on Alice's page from an empty square (e5) toward the top of the screen makes `window.scrollY` greater than 0. If headless Chrome does not scroll from CDP touch input, replace only the scroll assertion with: computed `touch-action` is `none` on Alice's own movable piece on her turn and `auto` on an empty square and on every piece off-turn.

  In `e2e/checkers.spec.ts` (its `square`, `piece`, `targets`, `setUp` helpers):
  - `a man dragged onto a highlighted square moves, and a double jump continues from the first landing`: with `BRANCHING`, drag the jumping man to its first landing; `targets` now shows the two next landings; drag the same man again (still on its start square, marked picked) to one of them; the move completes as it does by clicks.
  - `a man dropped on an unhighlighted square goes back`.
- [ ] **Step 2: Run them to see them fail**

  Run: `npx playwright test e2e/chess.spec.ts e2e/checkers.spec.ts -g "drag|finger|lift|held|snaps"`
  Expected: FAIL, nothing lifts.
- [ ] **Step 3: Wire chess.** In `Board.tsx` call `useDrag` with `canLift` = `isMyTurn` and own piece with at least one legal move; `onLift` sets the selection to that square (no toggle); `canDrop` = target in `legalMoves(gameState, from)`; `onDrop` = `handleSquareClick(target)` (so promotion and claim prompts come up as for a click); `onCancel` clears the selection. Spread `drag.source(id)` through `PieceGlyph`'s `dragProps`; add `data-drop` to every square.
- [ ] **Step 4: Wire checkers.** In `GameScreen.tsx` call `useDrag`: `canLift` = `isMyTurn` and the square is in `movable`, or is `picked[0]` part way through a jump; `onLift` keeps `picked` when lifting `picked[0]` mid-jump, otherwise `pick([position])` (never the toggle in `handleSquareClick`); `canDrop` = target in `targets`; `onDrop` = `handleSquareClick(target)`; `onCancel` keeps a mid-jump pick and clears a fresh one. Pass `drag` to `Board`, which spreads `drag.source(id)` on the `.piece` div and puts `data-drop` on squares.
- [ ] **Step 5: Style** the ghost and `[data-drag-over]` square in each game's SCSS so it reads in both themes (the outline color from each palette via `--drag-over`).
- [ ] **Step 6: Docs.** Each README Controls section gets a line like "Or drag one of your pieces onto a marked square; drop it anywhere else to put it back"; the FAQ "How do I move?" answers say the same. Checkers adds that a multi-jump drag stops at each landing.
- [ ] **Step 7: Verify**

  Run: `npm test && npm run typecheck && npm run lint && npx playwright test e2e/chess.spec.ts e2e/checkers.spec.ts`
  Expected: all pass, old and new.

  Browser check (`npm start`, two tabs as Alice and Bob, Chrome browser tool): drag a chess piece and a checkers man at 390x844 and 1280x800, in light and dark; the ghost follows, targets light, drops land, a bad drop snaps back, the page scrolls from the panel at phone width.
- [ ] **Step 8: Commit** `feat: drag pieces in chess and checkers`

### Task 3: Backgammon checkers and Parchisi pawns

**Files:**
- Modify: `games/backgammon/client/Board.tsx` (`Stack` takes `dragProps?: DragSourceProps` for its outermost checker), `games/backgammon/client/backgammon.scss`, `games/backgammon/README.md`, `games/backgammon/client/faq.ts`, `e2e/backgammon.spec.ts`
- Modify: `games/parchisi/client/Board.tsx`, `games/parchisi/client/Pawn.tsx` (accept `dragProps?: DragSourceProps`), `games/parchisi/client/parchisi.scss`, `games/parchisi/README.md`, `games/parchisi/client/faq.ts`, `e2e/parchisi.spec.ts`

**Interfaces:**
- Consumes: `useDrag`, `DragSourceProps` (Task 1); `drag` (fixtures).
- Backgammon ids: source and target `String(location)` (a point index, `'bar'`, or `'off'`); points and the viewer's tray carry `data-drop`, the bar never does.
- Parchisi ids: source `"pawn-<index>"`; targets are the existing `destinationKey` strings (`cellKey(cell)` or `'home'`), on squares and the center.

- [ ] **Step 1: Write the failing e2e tests**
  - `e2e/backgammon.spec.ts` (`point`, `checkers`, `myTray`, `craft`, `start`): `a checker dragged to a highlighted point moves there`; `a checker dragged from the bar enters`; `a checker dragged to the tray bears off, and two dice that both reach it still ask which die`; `a checker dropped on a point it cannot reach goes back`.
  - `e2e/parchisi.spec.ts` (`pawn`, `square`, `place`, `craft`, `start`): `a pawn dragged to a square with a badge moves there`; `a pawn dragged into home goes home`; `a pawn dropped elsewhere goes back with nothing selected`.
- [ ] **Step 2: Run them to see them fail**

  Run: `npx playwright test e2e/backgammon.spec.ts e2e/parchisi.spec.ts -g "drag"`
  Expected: FAIL.
- [ ] **Step 3: Wire backgammon** in `Board.tsx`: `canLift` = `isMyTurn && !pendingChoice` and some step starts at the location; `onLift` sets the selection; `canDrop` = parsed target in that location's targets; `onDrop` = `handleClick(parsed)`; `onCancel` clears the selection.
- [ ] **Step 4: Wire parchisi** in `Board.tsx`: `canLift` = the pawn is the viewer's and in `movable`; `onLift` = `onSelectPawn(pawn)`; `canDrop` = `destinations.has(target)` (computed from the latest render, after the lift selected the pawn); `onDrop` = `handleClick(target, [])`; `onCancel` = `onSelectPawn(null)`.
- [ ] **Step 5: Style** ghosts and `[data-drag-over]` in both SCSS files; **docs** in both READMEs' Controls and FAQs, as in Task 2.
- [ ] **Step 6: Verify**

  Run: `npm test && npm run typecheck && npm run lint && npx playwright test e2e/backgammon.spec.ts e2e/parchisi.spec.ts`
  Expected: all pass. Browser check both games at both widths and themes with a real drag.
- [ ] **Step 7: Commit** `feat: drag checkers in backgammon and pawns in parchisi`

### Task 4: Quoridor pawn, wall tray, and the shared PieceTray

**Files:**
- Create: `src/components/PieceTray.tsx`, `games/quoridor/client/walls.ts`, `games/quoridor/client/walls.test.ts`
- Modify: `games/quoridor/client/GameScreen.tsx`, `games/quoridor/client/Board.tsx`, `games/quoridor/client/Pawn.tsx` (accept `dragProps?: DragSourceProps`), `games/quoridor/client/quoridor.scss`, `games/quoridor/README.md`, `games/quoridor/client/faq.ts`, `e2e/quoridor.spec.ts`, `docs/architecture.md` (PieceTray)

**Interfaces:**
- Consumes: `useDrag`, `Drag`, `DragSourceProps` (Task 1); the `.piece-tray*` styles (Task 1).
- Produces (`src/components/PieceTray.tsx`, used by Tasks 5, 8, 9, 10):
  ```ts
  export type TrayPiece = {
    id: string;
    label: string;      // 'Wall'; the button's accessible name is `${label}, ${count} left`, or label alone without a count
    icon: ReactNode;
    count?: number;
    blocked?: string;   // non-empty: the piece is dimmed and disabled, and this is its title
  };
  type PieceTrayProps = {
    label: string;                 // the section's aria-label, e.g. 'Your walls'
    pieces: TrayPiece[];
    selected: string | null;       // shown with aria-pressed
    onTap: (id: string) => void;
    drag: Drag;                    // each piece button spreads drag.source(piece.id)
    children?: ReactNode;          // extra controls after the pieces, such as Rotate
  };
  export default function PieceTray(props: PieceTrayProps): JSX.Element;
  ```
- Produces (`games/quoridor/client/walls.ts`):
  ```ts
  // What a tap on the tray's wall, or Rotate (button or R key), selects next
  export function nextWallAction(current: Action, input: 'tap' | 'rotate'): Action;
  // Where a wall of the selected orientation could go now, as "<row>-<col>" anchor squares
  export function wallSlots(state: BoardState & { wallCounts: Record<Seat, number> }, seat: Seat, action: Action): string[];
  ```
- Ids: sources `'pawn'` (own pawn) and `'wall'` (tray); targets are squares, `"<row>-<col>"`.

- [ ] **Step 1: Write the failing unit tests** in `games/quoridor/client/walls.test.ts`:
  ```ts
  test('a tap picks up a horizontal wall, and tapping it again turns it', () => {
    assert.equal(nextWallAction('move', 'tap'), 'wall-h');
    assert.equal(nextWallAction('wall-h', 'tap'), 'wall-v');
    assert.equal(nextWallAction('wall-v', 'tap'), 'wall-h');
  });
  test('rotate turns the held wall, or picks up a vertical one', () => {
    assert.equal(nextWallAction('wall-h', 'rotate'), 'wall-v');
    assert.equal(nextWallAction('move', 'rotate'), 'wall-v');
  });
  test('wall slots leave out overlapping and crossing places, and are empty with no walls left or no wall held', () => {
    const state = { ...createGameState('t'), activePlayers: [1, 2], pawns: { 1: at(8, 4), 2: at(0, 4) }, wallCounts: { 1: 10, 2: 10 },
      walls: [{ row: 0, col: 0, orientation: 'horizontal', playerNumber: 2 }] };
    const horizontal = wallSlots(state, 1, 'wall-h');
    assert.equal(horizontal.includes('0-0') || horizontal.includes('0-1'), false);
    assert.equal(horizontal.includes('4-4'), true);
    assert.equal(wallSlots(state, 1, 'wall-v').includes('0-0'), false);
    assert.deepEqual(wallSlots({ ...state, wallCounts: { 1: 0, 2: 10 } }, 1, 'wall-h'), []);
    assert.deepEqual(wallSlots(state, 1, 'move'), []);
  });
  ```
  (`at(row, col)` builds a `Position`; `wallSlots` takes `BoardState & { wallCounts: Record<Seat, number> }`, so a rules state works in the test.)
- [ ] **Step 2:** `node --test games/quoridor/client/walls.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `walls.ts`** (`wallSlots` checks every square with the rules' `isValidWallPlacement`, as `Board.tsx` does today) and run the test to PASS.
- [ ] **Step 4: Write the failing e2e tests** in `e2e/quoridor.spec.ts` (`board`, `square`, `pawn`, `wallsLeft`, `expectHighlighted`):
  - `the pawn dragged onto a highlighted square moves there`
  - `a wall dragged from the tray onto a slot is placed, and the tray count drops`: tray button `Wall, 10 left`; drag it onto `square(alice, 3, 3)`; a horizontal wall shows at 3,3 for Bob and the tray reads `Wall, 9 left`.
  - `tapping the tray wall lights its slots, tapping it again, Rotate or the R key turns it`: after a tap, `.square.wall-slot` count is greater than 0 and `Horizontal Wall` is active; a second tap makes `Vertical Wall` active; `Rotate` and `alice.keyboard.press('r')` each turn it back; a click on a slot places the wall.
  - `at phone width, a drag on the sideways-scrolled board lands on the square under the pointer`: `setViewportSize({ width: 390, height: 844 })`, scroll `.board-area` right by 120px, drag the pawn to the highlighted square one step forward; the pawn is on that square.
  - `off turn, the tray's wall is disabled and the pawn does not lift`.
- [ ] **Step 5: Run them to see them fail.** `npx playwright test e2e/quoridor.spec.ts -g "drag|tray|phone|lift"`. Expected: FAIL.
- [ ] **Step 6: Build `PieceTray.tsx`** to the interface above: a `<section className="piece-tray">` with one `<button type="button" className="piece-tray-piece">` per piece (icon, then `.piece-tray-count`), `disabled` and `title` from `blocked`.
- [ ] **Step 7: Wire Quoridor.** `useDrag` in `GameScreen.tsx`: `canLift('pawn')` = `isMyTurn`; `canLift('wall')` = `isMyTurn` and walls left; `onLift('wall')` selects a wall with `nextWallAction(selectedAction, 'tap')` only when `selectedAction` is `'move'`, keeping a held orientation; `onLift('pawn')` selects `'move'`; `canDrop` = valid pawn move or `wallSlots` membership; `onDrop` sends the same `Move` as `Board`'s square click; `onCancel` restores the action held before the lift. Pass `drag` to `Board`: own `Pawn` spreads `drag.source('pawn')`, squares get `data-drop`, squares in `wallSlots` get class `wall-slot` while a wall is selected, and the wall preview follows `drag.over` during a drag as it follows the hovered square today. Tray: one `Wall` piece (wall icon, count `wallCounts[playerNumber]`) and a `Rotate` button as child; `onTap` uses `nextWallAction(..., 'tap')`. R key: a `window` `keydown` listener while `isMyTurn` and a wall is selected, ignoring modified keys and keys typed in `input`, `textarea` or `select`. The Move, Horizontal Wall and Vertical Wall buttons stay.
- [ ] **Step 8: Style** `.wall-slot`, the tray and the ghosts in `quoridor.scss` (the game themes the header itself, so set `--piece-tray-*` here too). **Docs:** README Controls and FAQ cover dragging the pawn, the wall tray, Rotate, second tap and R; `docs/architecture.md` lists `PieceTray` with the other shared components.
- [ ] **Step 9: Verify.** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/quoridor.spec.ts`: all pass. Browser check at both widths and themes: a real wall drag, rotation by each of the three ways, tray layout not overlapping the goal list on a phone.
- [ ] **Step 10: Commit** `feat: drag the pawn and walls from a tray in quoridor`

### Task 5: Connect Four disc

**Files:**
- Modify: `games/connectfour/client/Board.tsx`, `games/connectfour/client/GameScreen.tsx` (hint text), `games/connectfour/client/connectfour.scss`, `games/connectfour/README.md`, `games/connectfour/client/faq.ts`, `e2e/connectfour.spec.ts`

**Interfaces:**
- Consumes: `useDrag` (Task 1), `PieceTray` (Task 4).
- Ids: source `'disc'`; target `"column-<n>"` on every cell of column n and on its drop button.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/connectfour.spec.ts` (`cell`, `disc`, `arrow`): `a disc dragged from your supply onto a column falls to its lowest empty cell` (drag the `Your disc` tray button onto `cell(alice, '0,3')`; `disc(bob, '5,3')` is `Red disc`); `a disc dropped on a full column or off the board goes back`; `off turn, the disc is disabled`.
- [ ] **Step 2:** Run `npx playwright test e2e/connectfour.spec.ts -g "drag|disc dropped|disabled"`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `Board.tsx`, a `PieceTray` labelled `Your disc` above the drop row with one piece (the player's colored disc, no count, `blocked` when `!droppable`); `useDrag` with `canLift` = `droppable`, `canDrop` = `canDrop(column)`, `onDrop` = `onDrop(column)`. While `drag.over` names a column, its cells and arrow get class `column-over`. Board needs the viewer's seat color for the icon: pass `seat` from `GameScreen`. Hint: "Drag your disc to a column, or click a column".
- [ ] **Step 4: Style** `.column-over` and the tray; **docs** in README Controls and FAQ.
- [ ] **Step 5: Verify.** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/connectfour.spec.ts`: all pass. Browser check at both widths and themes with a real drag.
- [ ] **Step 6: Commit** `feat: drag a disc onto a column in connect four`

### Task 6: Scrabble tiles and rack

**Files:**
- Create: `games/scrabble/client/placing.ts`, `games/scrabble/client/placing.test.ts`
- Modify: `games/scrabble/client/PlayArea.tsx`, `games/scrabble/client/Board.tsx` (take `sourceProps?: (row: number, col: number) => DragSourceProps | undefined`; every square gets `data-drop="square-<row>-<col>"` when `onSquare` is set), `games/scrabble/client/GameScreen.tsx` (rack order kept while the rack's letters are unchanged), `games/scrabble/client/useSlides.ts` (no slide for a drop: `takeDrop()`), `games/scrabble/client/scrabble.scss`, `games/scrabble/README.md`, `games/scrabble/client/faq.ts`, `e2e/scrabble.spec.ts`

**Interfaces:**
- Consumes: `useDrag`, `DragSourceProps`, `takeDrop` (Task 1).
- Produces (`games/scrabble/client/placing.ts`; `PendingTile` moves here from `PlayArea.tsx`):
  ```ts
  export type PendingTile = Placement & { slot: number };
  // The rack order with `slot` moved to place `place`, the others keeping their order
  export function moveInOrder(order: number[], slot: number, place: number): number[];
  // The pending tile on `from` moved to the empty square `to`, keeping its letter, blank and slot
  export function movePending(pending: PendingTile[], from: { row: number; col: number }, to: { row: number; col: number }): PendingTile[];
  ```
- Ids: sources `"rack-<slot>"` and `"pending-<row>-<col>"`; targets `"square-<row>-<col>"`, `"place-<place>"` (each rack cell) and `"rack"` (the rack).

- [ ] **Step 1: Write the failing unit tests** in `placing.test.ts`:
  ```ts
  test('a rack tile moves to a new place and the rest keep their order', () => {
    assert.deepEqual(moveInOrder([0, 1, 2, 3, 4, 5, 6], 5, 1), [0, 5, 1, 2, 3, 4, 6]);
    assert.deepEqual(moveInOrder([0, 1, 2, 3, 4, 5, 6], 0, 6), [1, 2, 3, 4, 5, 6, 0]);
    assert.deepEqual(moveInOrder([3, 1, 2], 1, 1), [3, 1, 2]);
  });
  test('a pending tile moves to another square with its letter, blank and slot', () => {
    const pending = [{ row: 7, col: 7, letter: 'Q', blank: true, slot: 2 }, { row: 7, col: 8, letter: 'I', slot: 0 }];
    assert.deepEqual(movePending(pending, { row: 7, col: 7 }, { row: 6, col: 8 }),
      [{ row: 6, col: 8, letter: 'Q', blank: true, slot: 2 }, { row: 7, col: 8, letter: 'I', slot: 0 }]);
  });
  ```
- [ ] **Step 2:** `node --test games/scrabble/client/placing.test.ts`. Expected: FAIL. **Step 3:** implement; run to PASS.
- [ ] **Step 4: Write the failing e2e tests** in `e2e/scrabble.spec.ts` (`rack`, `rackTile`, `square`, `rackLetters`, `hint`, `playButton`, `place`):
  - `a rack tile dragged onto a square is placed, and a blank dragged there asks for its letter`
  - `a placed tile dragged to another square moves, and dragged to the rack goes back`
  - `rack tiles dragged between places rearrange the rack, also off turn, and the order survives the other player's move`: Bob drags his first tile onto his fifth place; `rackLetters(bob)` shows the new order; Alice plays a word; Bob's order is unchanged.
  - `off turn, a rack tile dropped on the board goes back`
- [ ] **Step 5:** Run `npx playwright test e2e/scrabble.spec.ts -g "drag"`. Expected: FAIL.
- [ ] **Step 6: Implement.** In `PlayArea.tsx`, `useDrag`:
  - `canLift`: a rack slot that is not placed and no blank letter is being picked (any turn); a pending tile on your turn.
  - `onLift`: a rack tile on your turn becomes `selected`, as a click does.
  - `canDrop`: rack tile to an empty, unpending square only when `isMyTurn && !exchanging`; rack tile to `place-*`; pending tile to an empty, unpending square or to `place-*`/`rack`.
  - `onDrop`: square from rack calls `clickSquare(row, col)` (blank picker included); `place-*` from rack calls `setOrder(moveInOrder(...))` and `onShuffle(next)`; pending to square uses `movePending`; pending to the rack calls `clickSquare` on the pending square (back to its slot).
  - `onCancel` clears `selected` when the lift set it.
  - Each rack slot `<button>` is wrapped in `<div className="rack-cell" data-drop="place-<place>" {...drag.source('rack-<slot>')}>`, and `.rack-slot:disabled { pointer-events: none }` lets the press reach the wrapper off-turn. The `.rack` gets `data-drop="rack"`.
  - `useSlides`: when `takeDrop()` is true, queue nothing for that call, so a dropped tile does not glide from where it was picked up.
  - In `GameScreen.tsx`, `orderOf` matches the saved order by `state.rack.join('')` alone (rename `shuffleRef` to `orderRef`); `PlayArea` keeps its `key`, so pending tiles still reset each move.
- [ ] **Step 7: Style** the ghost, `[data-drag-over]` squares and rack cells; **docs** in README Controls and FAQ (dragging onto the board, moving and returning placed tiles, rearranging the rack at any time).
- [ ] **Step 8: Verify.** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/scrabble.spec.ts`: all pass. Browser check at both widths and themes, including an off-turn rack rearrange on a phone.
- [ ] **Step 9: Commit** `feat: drag tiles in scrabble and rearrange the rack`

### Task 7: Rummikub on the shared hook

**Files:**
- Delete: `games/rummikub/client/dragDrop.ts`
- Modify: `games/rummikub/client/PlayArea.tsx`, `games/rummikub/client/TableArea.tsx` (`TableEditing` loses `onDragStart`, `onDragEnd`, `onDrop` and gains `drag: Drag`), `games/rummikub/client/Pickable.tsx` (no `draggable` or HTML5 drag handlers; takes `dragProps?: DragSourceProps` and an optional `dropId?: string` for `data-drop`), `games/rummikub/client/draft.ts`, `games/rummikub/client/draft.test.ts`, `games/rummikub/client/useLocalSlides.ts` (no slides for a drop: `takeDrop()`), `games/rummikub/client/rummikub.scss`, `games/rummikub/README.md`, `games/rummikub/client/faq.ts`, `e2e/rummikub.spec.ts`

**Interfaces:**
- Consumes: `useDrag`, `Drag`, `DragSourceProps`, `takeDrop` (Task 1).
- Produces (`draft.ts`): `export function isRackTarget(draft: Draft, target: Target): boolean`, the check `placeHeld` makes inline today, now shared by `placeHeld` and the drag's `canDrop`.
- Ids: sources `"tile-<id>"` and `"group-<index>"`; targets `"before-<id>"` (every tile Pickable), `"end-<index>"` (each group and its + button), `"new"` (New group) and `"rack"` (the rack section). Small helpers in `PlayArea.tsx` turn these into `Held` and `Target`.

- [ ] **Step 1: Write the failing unit test** in `draft.test.ts`: `a target is on the rack when it is the rack or a rack tile` (`isRackTarget` true for `{ kind: 'rack' }` and `{ kind: 'before', id: <rack tile> }`, false for a table tile, `groupEnd` and `newGroup`). Run `node --test games/rummikub/client/draft.test.ts`: FAIL. Implement and switch `placeHeld` to it; run: PASS, old tests too.
- [ ] **Step 2: Write the failing e2e tests** in `e2e/rummikub.spec.ts`: rewrite the three `dragTo` calls of the existing test at line 349 to the fixtures' `drag` helper (same targets, same assertions); add `off turn, rack tiles drag to rearrange the rack, and a drop on the table goes back` (Bob drags a rack tile in front of another; his rack order changes; a drag to New group leaves the table unchanged) and `a group dragged by its handle joins the end of another group`.
- [ ] **Step 3:** Run `npx playwright test e2e/rummikub.spec.ts -g "drag"`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement.** In `PlayArea.tsx`, replace `dragStart`, `drop`, `dragEnd` and `dragRef` with `useDrag`: `canLift` = a rack tile any time, or a table tile or group handle on your turn; `onLift` sets `held`; `canDrop` = `isMyTurn || isRackTarget(draft, target)`; `onDrop` = `apply(placeHeld({ ...state, held }, target, committed, isMyTurn))`; `onCancel` clears `held`. Off-turn the rack Pickables get source props and `before-*` ids; the table only on your turn. Keep Enter and Space on `Pickable`.
- [ ] **Step 5: Style** the ghost and `[data-drag-over]`; **docs**: README Controls and the FAQ answer now say drag works with a finger too, and that the rack can be rearranged by dragging at any time.
- [ ] **Step 6: Verify.** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/rummikub.spec.ts`: all pass. Browser check at both widths and themes; on a phone, a table tile drag between groups.
- [ ] **Step 7: Commit** `feat: rummikub drags tiles with pointer events`

### Task 8: Carcassonne tile and meeple tray

**Files:**
- Modify: `games/carcassonne/client/GameScreen.tsx`, `games/carcassonne/client/TurnPanel.tsx` (`TilePicture` takes `dragProps?: DragSourceProps`; renders the meeple `PieceTray` passed as a prop), `games/carcassonne/client/Board.tsx` (`data-drop` on `.cc-cell` and `.cc-spot`), `games/carcassonne/client/carcassonne.scss`, `games/carcassonne/README.md`, `games/carcassonne/client/faq.ts`, `e2e/carcassonne.spec.ts`

**Interfaces:**
- Consumes: `useDrag`, `DragSourceProps`, `swallowNextClick` (Task 1); `PieceTray`, `TrayPiece` (Task 4); `MeepleIcon`.
- Ids: sources `'tile'` (the tile picture) and `'meeple'` (tray); targets `"cell-<x>,<y>"` and `"spot-<kind>-<index>"`.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/carcassonne.spec.ts` (`craft`, `tilePicture`, `cell`, `spot`, `button`, `boardMeeples`, `meeplesInHand`):
  - `the tile dragged onto a highlighted square is shown there, ready to turn and place`: drag `tilePicture` onto `cell(alice, 0, -1)`; that cell has `cc-cell-selected`; `Place tile` is enabled and places it.
  - `a meeple dragged from the tray onto a circle is chosen there, ready to place`: tray button `Meeple, 7 left`; drag onto `spot(alice, 'road')`; `Place meeple` puts it on the board and the tray reads `Meeple, 6 left`.
  - `a tile dropped on the board away from a highlighted square goes back, and the view does not pan`: viewBox unchanged.
- [ ] **Step 2:** Run `npx playwright test e2e/carcassonne.spec.ts -g "dragged|dropped"`. Expected: FAIL.
- [ ] **Step 3: Implement** in `GameScreen.tsx`: `useDrag` with `canLift('tile')` = `canMove && !placed`, `canLift('meeple')` = `canMove && placed && meeplesLeft > 0 && freeSpots.length > 0`; `canDrop` = the cell is in `options`, or the spot is in `freeSpots`; `onDrop` = `pickCell(cell)`, or `update({ meeple: feature })` (set, never the toggle of `pickMeeple`). Meeple tray: one piece, the player's `MeepleIcon`, count `meeplesLeft`, `blocked` with the existing hint text when it cannot be used; `onTap` selects it (the circles are already lit). The board's own pan keeps working because sources sit outside the SVG.
- [ ] **Step 4: Style** `[data-drag-over]` on `.cc-cell` and `.cc-spot` with stroke (SVG ignores outline), the tray and the ghost; **docs** in README Controls and FAQ.
- [ ] **Step 5: Verify.** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/carcassonne.spec.ts`: all pass. Browser check at both widths and themes; a tile drag at phone width with the board fitted and zoomed.
- [ ] **Step 6: Commit** `feat: drag the tile and meeples in carcassonne`

### Task 9: Catan building tray

**Files:**
- Create: `games/catan/client/tray.ts`, `games/catan/client/tray.test.ts`
- Modify: `games/catan/client/GameScreen.tsx`, `games/catan/client/TurnPanel.tsx` (`buildButton` uses `buildBlocker`), `games/catan/client/Board.tsx` (`data-drop` on `.edge-target` and `.vertex-target`), `games/catan/client/catan.scss`, `games/catan/README.md`, `games/catan/client/faq.ts`, `e2e/catan.spec.ts`

**Interfaces:**
- Consumes: `useDrag` (Task 1); `PieceTray`, `TrayPiece` (Task 4); `piecesLeft`, `COSTS`, `covers`, `describeResources`.
- Produces (`games/catan/client/tray.ts`):
  ```ts
  export type TrayKind = 'road' | 'settlement' | 'city';
  // Why a build button or tray piece is unavailable after the roll: `Needs ${describeResources(cost)}` or
  // `Nowhere to build a ${kind}`; '' when it can be built. The same strings TurnPanel shows today.
  export function buildBlocker(kind: TrayKind, hand: Resources | null, spots: number): string;
  // Why a tray piece is dimmed now, '' when it can be lifted: in setup only the piece the step asks for, during free roads
  // only the road, after the roll and with nothing pending buildBlocker, otherwise 'Not now'.
  // The one place the Catan five-six plan extends for the special build phase.
  export function trayBlocker(state: PublicGameState, kind: TrayKind, spots: number): string;
  ```
- Ids: sources `'road' | 'settlement' | 'city'`; targets `"edge-<n>"` and `"vertex-<n>"`.

- [ ] **Step 1: Write the failing unit tests** in `tray.test.ts`, with states from `toPublicState(game({...}), false, 1)` (`game` and `holding` from `games/catan/testing.ts`):
  ```ts
  test('a piece you cannot afford needs its cost, and one with nowhere to go says so', () => {
    assert.equal(buildBlocker('city', resources({ ore: 2 }), 3), `Needs ${describeResources(COSTS.city)}`);
    assert.equal(buildBlocker('road', resources({ wood: 1, brick: 1 }), 0), 'Nowhere to build a road');
    assert.equal(buildBlocker('road', resources({ wood: 1, brick: 1 }), 2), '');
  });
  test('setup offers only the piece the step asks for', () => {
    // setup.settlement null: settlement '' , road and city 'Not now'; setup.settlement set: road '', the others 'Not now'
  });
  test('free roads offer only the road, and before the roll or with the robber pending every piece waits', () => {
    // pending roadBuilding: road '', settlement 'Not now'; rolled false: all 'Not now'; pending robber: all 'Not now'
  });
  test('after the roll an affordable piece with a spot is ready', () => {
    // rolled true, holding ROAD resources, spots 1: trayBlocker(state, 'road', 1) === ''
  });
  ```
  (`resources(partial)` from `games/catan/resources.ts` builds a full hand.)
- [ ] **Step 2:** `node --test games/catan/client/tray.test.ts`. Expected: FAIL. **Step 3:** implement, switch `buildButton` to `buildBlocker`, run to PASS.
- [ ] **Step 4: Write the failing e2e tests** in `e2e/catan.spec.ts` (`craft`, `vertex`, `path`, `button`, `status`, `SETTLEMENT`, `ROAD`):
  - `a road dragged from the tray onto a highlighted path is built and paid for, like Build road`: tray button `Road, 13 left`; drag onto `path(alice, n)`; the road shows for Bob, the hand lost a wood and a brick, the tray reads `Road, 12 left`.
  - `a settlement dragged in setup is placed`
  - `a piece you cannot afford is dimmed with its cost as the title`
  - `tapping a tray piece highlights its spots like the build button, and a click builds there`
  - `a piece dropped off a highlighted spot goes back and costs nothing`
- [ ] **Step 5:** Run `npx playwright test e2e/catan.spec.ts -g "tray"`. Expected: FAIL.
- [ ] **Step 6: Implement** in `GameScreen.tsx`: a `PieceTray` labelled `Your pieces` with road, settlement and city (counts from `piecesLeft`, `blocked` from `trayBlocker`), placed above the build buttons; `onTap` toggles `mode` as the build buttons do; `useDrag` with `canLift` = `canMove && trayBlocker(...) === ''`, `onLift` remembers the current mode and sets the lifted kind (setup ignores mode), `canDrop` = the target is in `targetsFor(gameState, playerNumber, kind)`, `onDrop` = `clickEdge` or `clickVertex`, `onCancel` restores the remembered mode. The build buttons stay.
- [ ] **Step 7: Style** `[data-drag-over]` on the SVG targets with stroke and a larger radius, the tray (dimmed pieces readable in dark mode) and the ghost; **docs** in README Controls and FAQ.
- [ ] **Step 8: Verify.** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/catan.spec.ts`: all pass. Browser check at both widths and themes; a settlement drag at phone width onto a small intersection.
- [ ] **Step 9: Commit** `feat: build from a piece tray in catan`

### Task 10: Risk army tray

**Files:**
- Modify: `games/risk/client/GameScreen.tsx`, `games/risk/client/WorldMap.tsx` (`data-drop="land-<id>"` on territories when `onSelect` is given), `games/risk/client/risk.scss`, `games/risk/README.md`, `games/risk/client/faq.ts`, `e2e/risk.spec.ts`

**Interfaces:**
- Consumes: `useDrag` (Task 1); `PieceTray` (Task 4).
- Ids: source `'armies'`; targets `"land-<territory id>"`.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/risk.spec.ts` (`land`, `armiesOn`, `panel`, `button`, `placeAllStarting`): `armies dragged from the tray onto your territory are added to the draft by the chosen step` (tray button `Armies, 3 left`; drag onto one of Alice's lands; the `+1` badge shows and the tray reads `Armies, 2 left`; with step `5` or `All`, the drop adds that many); `armies dropped on an enemy territory go back`; `the tray is disabled outside placing and for the other players`.
- [ ] **Step 2:** Run `npx playwright test e2e/risk.spec.ts -g "tray|dragged"`. Expected: FAIL.
- [ ] **Step 3: Implement** in `GameScreen.tsx`: a `PieceTray` labelled `Your armies` at the top of the side panel with one piece (count `left`, `blocked` unless `placing && left > 0`); `useDrag` with `canLift` = `placing && left > 0`, `canDrop` = `canSelect(id)`, `onDrop` = `select(id)`; `onTap` marks the tray piece selected (territories are already lit and clickable).
- [ ] **Step 4: Style** `[data-drag-over]` on territory discs with stroke, the tray and the ghost; **docs** in README Controls and FAQ.
- [ ] **Step 5: Verify.** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/risk.spec.ts`: all pass. Browser check at both widths and themes.
- [ ] **Step 6: Commit** `feat: place armies from a tray in risk`

### Task 11: Final checks and the pull request

**Files:**
- Modify: `README.md` (a Technical Details line: drag and drop with mouse and touch through one shared pointer-events hook; the How to Play section notes that pieces can be dragged or clicked), `docs/architecture.md` (re-read against what was built)

- [ ] **Step 1: Docs pass.** Update `README.md` as above; check every touched game's README Controls and FAQ mention drag, and none promises dragging on another player's turn other than the two racks.
- [ ] **Step 2: Full run**

  Run: `npm run lint && npm test && npm run build && npm run test:e2e`
  Expected: 0 lint problems, every unit test passes, the build succeeds, every e2e spec passes (all games, not only the eleven).
- [ ] **Step 3: Browser sweep** (`npm start`, Chrome browser tool, two players in two tabs): for each of the eleven games, one real drag that makes a move, one bad drop that snaps back, and one click-only move, at 390x844 and 1280x800, in light and dark. Look for overlap, blank rows and misplaced controls from the trays, a ghost that loses its look, and that the page still scrolls at phone width.
- [ ] **Step 4: Commit** `docs: drag and drop in the readme and architecture`
- [ ] **Step 5: Open the pull request** with `gh pr create` against `scss-migration` (or `master` if #21 has merged), titled `Drag and drop`, listing the games, the shared hook and the tray, the decisions in this plan's notes, and how it was tested; the body ends with the attribution line from the session.

## Notes on decisions the spec left open

- A drop calls the game's click handler for that spot, so in Carcassonne (cell, meeple spot) and Risk (army draft) a drop chooses, and the existing Place button still sends the move, exactly as a click does today.
- On a phone, `touch-action: none` sits only on pieces that can be lifted right now. A swipe that starts on one of your own movable pieces on your turn drags it rather than scrolling; every other swipe scrolls.
- Checkers multi-jumps drop one landing at a time; the man can be dragged again, or the next landings clicked.
- Scrabble moving a placed tile to another square and rearranging the rack by drag are new local actions with no click equivalent; neither sends anything to the server.
- The player who drops a piece does not see that move's slide animation (`takeDrop`); everyone else does.
