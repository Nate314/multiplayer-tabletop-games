# Keyboard Play for Shape Race and Jigsaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A keyboard-only player can pick a piece up, choose its target and drop it in Shape Race and Jigsaw.

**Architecture:** Client only. A small shared module gives grid arrow-key stepping and a hidden live-region style; each game's screen keeps a keyboard hold as its own state beside the existing pointer drag, makes its targets a roving-tabindex grid while something is held, and sends the actions a drop already sends.

**Tech Stack:** React 19, TypeScript, SCSS, node:test, Playwright.

**Spec:** docs/superpowers/specs/2026-11-15-keyboard-drag-play-design.md

## Global Constraints

- No server, rules or message changes.
- Pointer play (drag, tap or click to turn, the Jigsaw ↻ handle and right-click) behaves exactly as today; every existing e2e in `e2e/shaperace.spec.ts` and `e2e/jigsaw.spec.ts` still passes unchanged.
- Keys: Enter or Space picks up and drops; arrow keys step between targets (no wrap); Escape puts back; R turns the held piece. R is ignored with Ctrl, Meta or Alt and while focus is in an input, textarea or select.
- Targets and Jigsaw pieces are each one tab stop (roving tabindex). Targets are not focusable while nothing is held.
- The keyboard hold is separate state from the pointer drag. A pointer press on a piece, or Enter on another piece, puts the held piece back first.
- An interactive board svg is `role="group"` with its label; a read-only one (History) stays `role="img"`.
- Live-region copy, verbatim: "<Shape> picked up. Choose a hole, R turns it, Escape puts it back", "<Shape> placed", "That shape does not fit there", "Piece put back"; Jigsaw: "Piece N picked up. Choose a spot, R turns it, Escape puts it back" (", R turns it" only with Rotate pieces on), "Piece N placed", "Piece N left loose at row R, column C", "Piece put back".
- Labels, verbatim: Shape Race hole "Hole N of M, <shape name>"; Jigsaw piece "Piece N, loose" or "Piece N, loose, turned <90|180|270> degrees"; Jigsaw spot "Spot row R, column C". N, R and C count from 1.
- Shared cross-game client code lives in `src/` (never a `games/` folder of its own).

## Review Focus

- A Shape Race keyboard Enter on a tray shape fires a click too: it must pick up, never also turn. A mouse click must still turn.
- The race ending, a pause or an error while a shape or piece is held by keyboard ends the hold and returns focus to the tray, with nothing left looking held.
- Jigsaw: another player picking up the piece this player holds by keyboard ends the hold (no drop is sent for it).
- Arrow keys at the grid edge stay put, and arrow keys never scroll the page while a target has focus.
- R pressed while typing in chat does not turn a held piece.

---

### Task 1: Grid stepping and the hidden live region

**Files:**
- Create: `src/drag/gridStep.ts`
- Test: `src/drag/gridStep.test.ts`
- Modify: `src/App.scss` (add `.visually-hidden`)

**Interfaces:**
- Produces: `gridStep(index: number, key: string, cols: number, count: number): number | null`: the index of the neighbour in that arrow direction on a row-major grid of `count` cells and `cols` columns, `index` itself at an edge, `null` for a key that is not an arrow key.
- Produces: the global class `.visually-hidden` (position absolute, 1px box, `overflow: hidden`, `clip-path: inset(50%)`, `white-space: nowrap`), for live regions.

- [ ] **Step 1: Write the failing test** `src/drag/gridStep.test.ts`, on a 3 by 3 grid:
  - `gridStep(4, 'ArrowRight', 3, 9) === 5`, `'ArrowLeft'` → 3, `'ArrowUp'` → 1, `'ArrowDown'` → 7.
  - Edges stay put: `gridStep(5, 'ArrowRight', 3, 9) === 5`, `gridStep(3, 'ArrowLeft', 3, 9) === 3`, `gridStep(1, 'ArrowUp', 3, 9) === 1`, `gridStep(7, 'ArrowDown', 3, 9) === 7`.
  - A ragged last row (`cols` 4, `count` 6): `gridStep(3, 'ArrowDown', 4, 6) === 3`.
  - `gridStep(4, 'a', 3, 9) === null`.
- [ ] **Step 2: Run it and see it fail**: `node --test src/drag/gridStep.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `gridStep`** and add `.visually-hidden` to `src/App.scss`.
- [ ] **Step 4: Run it**: same command. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "Grid arrow-key stepping and a visually hidden class, for keyboard play"`

### Task 2: Shape Race keyboard play

**Files:**
- Modify: `games/shaperace/client/GameScreen.tsx`
- Modify: `games/shaperace/client/RaceBoard.tsx` (optional focusable holes)
- Modify: `games/shaperace/client/faq.ts`, `games/shaperace/client/shaperace.scss`
- Test: `e2e/shaperace.spec.ts`

**Interfaces:**
- Consumes: `gridStep` and `.visually-hidden` from Task 1; `fits(layout, placed, shape, hole, turns)` from `games/shaperace/board.ts`; `shapeLabel(id)` from `games/shaperace/shapes.ts`.
- Produces: `RaceBoard` gains an optional `targets?: { focused: number; onFocus(hole: number): void; onKey(hole: number, event: KeyboardEvent): void }`. With it, the svg is `role="group"`, and each empty hole is a `role="button"` element labeled "Hole N of M, <shape name>" whose `tabIndex` is 0 for `focused` and -1 for the rest; without it, nothing changes (History).

- [ ] **Step 1: Write the failing e2e tests** in `e2e/shaperace.spec.ts`, using the file's existing helpers to set a known layout:
  - `the keyboard alone places a shape`: focus a tray shape, press Enter; the live region (`.sr-screen [aria-live="polite"]`) says "<Shape> picked up. Choose a hole, R turns it, Escape puts it back" and the shape's turn has not changed; a hole now has focus. Press R until it fits (each R sends one `turn`), arrow to the matching hole, press Enter: the hole shows the placed shape, the region says "<Shape> placed", and focus is on the next unplaced tray shape.
  - `a keyboard drop on the wrong hole sends nothing`: pick up, arrow to a hole of another shape, Enter: no `place` reaches the server (state unchanged), the region says "That shape does not fit there", the shape stays held and focus stays on that hole.
  - `Escape puts a keyboard-held shape back`: pick up, Escape: the region says "Piece put back", focus is on that tray shape, and no hole is focusable (`[role="button"][tabindex="0"]` inside the board count 0).
  - `a click still turns a shape and Enter does not`: one mouse click turns it by 45; Enter on another shape leaves its turn alone.
  - `the race ending lets go of a keyboard hold`: pick up, patch the state to game over; nothing shows held, no hole is focusable.
  - `R while typing in chat does not turn the held shape` (only if this screen has a chat or any text input on it; otherwise skip and say so in the report).
- [ ] **Step 2: Run them and see them fail**: `npx playwright test e2e/shaperace.spec.ts -g "keyboard|Enter does not"`. Expected: FAIL.
- [ ] **Step 3: Implement** in `GameScreen.tsx`: a `held: { shape: number } | null` keyboard state beside `drag`; Enter or Space keydown on a tray shape (with `preventDefault`, so its click never fires a turn) picks up; a click whose `event.detail === 0` (a keyboard click) does not turn. While `held`, pass `targets` to `RaceBoard`, focus the first empty hole, handle arrows with `gridStep` (with `preventDefault`), Enter/Space to drop through `fits` and the same `setLanded` + `place` path a pointer drop uses, Escape to put back. A window keydown for R while held sends `turn` (the same modifier and input checks Jigsaw's `onKey` makes). A pointer down on any tray shape ends `held` first. `held` ends whenever `racing` goes false, `paused` is true, or `error` changes. A `visually-hidden` `aria-live="polite"` element carries the announcements. The tray note gains the keyboard sentence "Enter picks a shape up, R turns it, then choose its hole".
- [ ] **Step 4: FAQ**: `games/shaperace/client/faq.ts` "How do I place…" answer gains: "With a keyboard, press Enter on a shape to pick it up, R to turn it, the arrow keys to choose a hole and Enter to drop it in. Escape puts it back."
- [ ] **Step 5: Run**: `npx playwright test e2e/shaperace.spec.ts`. Expected: all pass, old and new.
- [ ] **Step 6: Check it in Chrome** at 1280 px and 390 px wide: pick up, move, drop and cancel by keyboard; the focus outline on holes is visible and nothing overlaps.
- [ ] **Step 7: Verify and commit**: `npm test`, `npm run lint`, `npm run typecheck` pass; `git commit -m "Shape Race: pick a shape up, choose its hole and drop it with the keyboard"`

### Task 3: Jigsaw keyboard play

**Files:**
- Modify: `games/jigsaw/client/GameScreen.tsx`, `games/jigsaw/client/Table.tsx`, `games/jigsaw/client/PieceShape.tsx`
- Modify: `games/jigsaw/client/faq.ts`, the Jigsaw stylesheet
- Test: `e2e/jigsaw.spec.ts`

**Interfaces:**
- Consumes: `gridStep` and `.visually-hidden` from Task 1; `gridOf`, `homeOf` from `games/jigsaw/cut.ts`; the existing `landing` state and `canLift` in `GameScreen.tsx`.
- Produces: `TableProps` gains optional `keys?: { pieceFocus: number | null; onPieceKey(piece: number, event: KeyboardEvent): void; spots?: { focused: number; onSpotKey(spot: number, event: KeyboardEvent): void } }`. With `keys`, the svg is `role="group"`; liftable pieces are `role="button"` with the piece label and `tabIndex` 0 only for `pieceFocus`; with `spots`, each `.jigsaw-spot` is `role="button"` labeled "Spot row R, column C" with `tabIndex` 0 only for `focused`. `PieceShape` gains optional `label?: string`, `tabIndex?: number`, `onKeyDown`.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/jigsaw.spec.ts`, using its existing seating and state helpers (24 pieces, Solo, unless a test says otherwise):
  - `the keyboard alone snaps a piece into its spot`: Tab to the table, the first liftable piece has focus; Enter: the state shows it held, the region says "Piece 1 picked up. Choose a spot, Escape puts it back"; arrow to its home spot (row and column from `homeOf`), the piece is drawn there; Enter: the state shows it placed, the region says "Piece 1 placed", and focus is on the next liftable piece.
  - `a keyboard drop on another spot leaves the piece loose there`: drop on a spot that is not its home: the state shows it loose at that spot's x, y, and the region says "Piece 1 left loose at row R, column C".
  - `arrow keys step through the pieces`: with focus on a piece, ArrowRight moves focus to the next liftable piece in index order, and Tab leaves the table (focus is outside the svg).
  - `Escape puts a keyboard-held piece back`: the state shows it not held at the position it was picked up from; the region says "Piece put back"; focus is back on that piece; no spot is focusable.
  - `R turns a keyboard-held piece` (Rotate pieces on): R once: the state's `turns` is 1; with Rotate pieces off the region's pick-up copy has no ", R turns it".
  - `someone else taking the piece ends a keyboard hold`: Together mode, two players; player one holds a piece by keyboard; patch it to held by player two: nothing is shown held by player one and no spot is focusable, and no `drop` was sent.
  - `a mouse press on a piece puts the keyboard-held one back`: hold piece 1 by keyboard, drag piece 2 with the mouse: piece 1 is not held, piece 2 moves as a drag does today.
- [ ] **Step 2: Run them and see them fail**: `npx playwright test e2e/jigsaw.spec.ts -g "keyboard|arrow keys|R turns"`. Expected: FAIL.
- [ ] **Step 3: Implement** in `GameScreen.tsx`: a keyboard hold `{ piece: number; from: { x: number; y: number }; spot: number }` beside `usePieceDrag`. Enter or Space on a piece sends `pickUp`, sets `touched`, focuses the spot nearest the piece. The held piece is passed to `Table` as the shown `dragging` position at the focused spot's home x, y. Enter or Space on a spot sends `drop` at that spot's home x, y via `setLanding`; Escape sends `drop` at `from` via `setLanding`. The existing R handler also turns the keyboard-held piece. A pending announcement resolves when the state shows the piece placed ("Piece N placed") or loose and not held ("Piece N left loose at row R, column C"). The hold ends without a drop when `lostHold` says so, the game is over, `undoVote` starts, `paused` is true, or `error` changes. A pointer down on any piece while held sends the put-back drop first. Focused spots and pieces scroll into view in the zoomed table (`scrollIntoView({ block: 'nearest', inline: 'nearest' })`).
- [ ] **Step 4: FAQ**: the "How do I place…" answer in `games/jigsaw/client/faq.ts` gains: "With a keyboard, Tab to the table, use the arrow keys to choose a piece and press Enter to pick it up, then the arrow keys to choose a spot and Enter to drop it there. Escape puts it back."
- [ ] **Step 5: Run**: `npx playwright test e2e/jigsaw.spec.ts`. Expected: all pass, old and new.
- [ ] **Step 6: Check it in Chrome** at 1280 px and 390 px wide, at zoom 1 and 3: pick up, move, drop, cancel by keyboard; focus outlines visible, the focused spot scrolls into view, nothing overlaps.
- [ ] **Step 7: Verify and commit**: `npm test`, `npm run lint`, `npm run typecheck` pass; `git commit -m "Jigsaw: pick a piece up, choose its spot and drop it with the keyboard"`
