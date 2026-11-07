# Naval Battle Remove and First-hit Length, Jigsaw Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Naval Battle player take one placed ship back to the tray, add the Naval house rule "Say the length on the first hit", and add the Jigsaw house rule "Rotate pieces" with a ↻ handle.

**Architecture:** All changes stay in `games/naval/` and `games/jigsaw/` plus their e2e specs. Naval's removal is a browser-only draft change (`draft.ts`, `Placement.tsx`, `Grid.tsx`); the first-hit length is one optional field on `Shot`, set by the server's `answer` and spoken by the shared `shotsText`. Jigsaw adds an optional quarter-turn count to `Piece`, drawn once in `resetLobby`, changed by a new unrecorded `turn` action, and checked by `drop` before a snap; the client draws the turn and a handle on the piece this player last touched.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Rules for every agent" and "Polish": "Naval Battle", "Jigsaw".

**Branch:** `polish-naval-jigsaw` in its own worktree at `C:/Users/Natha/Documents/code/mtg-wt/polish-naval-jigsaw`, from `party-games-and-polish`. Site `PORT=3502`, e2e `E2E_PORT_BASE=8200` (never 6000). PR into `party-games-and-polish`.

## Global Constraints

- **Naval, remove one ship while placing.** A placed ship can be dragged back to the tray, or selected with a tap and returned with a new **Remove** button beside Rotate. Clear and Random placement stay. Removing is draft-only (browser-side) until Confirm fleet.
- **Naval house rule "Say the length on the first hit"** (`announceLength`, toggle, off by default). When on, the first hit on a ship reports `hit a ship of length 3`. Later hits on the same ship say `hit`; sinking works as now. The length is part of the shot result in the public state, and History and `describeMove` show it. Undo of that shot removes it.
- **Jigsaw house rule "Rotate pieces"** (`rotation`, toggle, off by default), in Solo, Together and Race.
- When on, every piece starts turned a random 0°, 90°, 180° or 270° in the scatter, the same turns on every Race board. A piece's state gains its quarter-turn count.
- After a player touches or moves a piece, a small ↻ handle appears at its corner; pressing it turns the piece 90° clockwise. On desktop, R or a right-click also turns the piece being held. Dragging the piece body never turns it. Only the player who last touched the piece sees its handle; a piece held by someone else shows no handle.
- Turning is an unrecorded action: not a History step, and Undo does not take it back (only snaps are recorded).
- A piece snaps only when it is near its home **and** turned the right way up.
- With either rule off, both games behave and draw exactly as before, and states saved before this change (pause files, game files) still load and play.
- Files: `games/naval/`, `games/jigsaw/`, `e2e/naval.spec.ts`, `e2e/jigsaw.spec.ts`. Nothing in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in comments, READMEs, FAQs or commit messages.

## Review Focus

1. All five ships placed, so the tray has no ship buttons: it must still be a visible drop target, or a placed ship cannot be dragged back (Task 2).
2. A Salvo that hits the same unhit ship twice, or hits a 2-ship and sinks it in one turn: only the first of those shots carries the length, and the sinking shot still says `sank a ship of length 2` (Task 3).
3. A pause file or game file saved before the rotation rule has pieces with no turn field: they count as upright and still snap (Task 4).
4. A drop near home of a piece turned 180°: it stays loose and keeps its turns, rather than snapping or being set upright (Task 4).
5. A press on the ↻ handle sits over another piece or the held piece's body: it turns that one piece and never starts a drag, and a drag that starts on the body never turns it (Task 5).

---

### Task 1: Worktree, branch and ports

**Files:** none.

- [ ] **Step 1: Check the base.** In `C:/Users/Natha/Documents/code/multiplayer-tabletop-games`, run `git fetch origin && git log -1 --oneline origin/party-games-and-polish`. Expected: the commit that adds the plans (this file exists in it). If the branch is missing on origin, stop and report.
- [ ] **Step 2: Create the worktree.** `git worktree add -b polish-naval-jigsaw C:/Users/Natha/Documents/code/mtg-wt/polish-naval-jigsaw origin/party-games-and-polish`. Work only there from here on.
- [ ] **Step 3: Install.** If `node` is not found, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH (memory note). `npm ci`. Expected: exit 0.
- [ ] **Step 4: Check the ports are free.** `netstat -ano | grep -E ':(3502|820[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3502 or 8200, and say so in the PR.
- [ ] **Step 5: Baseline.** `npm test && npm run typecheck && npm run lint`. Expected: PASS. Record any failure that exists before your changes.

### Task 2: Naval, remove one ship while placing

**Files:**
- Modify: `games/naval/client/draft.ts`, `games/naval/client/Placement.tsx`, `games/naval/client/Grid.tsx`, `games/naval/client/naval.scss`, `games/naval/client/faq.ts`, `games/naval/README.md`
- Test: `games/naval/client/draft.test.ts`, `e2e/naval.spec.ts`

**Interfaces:**
- Produces (`draft.ts`): `removeShip(draft: Draft, index: number): Draft`: slot `index` set to `null`; the draft itself when that slot is already `null`.
- Produces (`Grid.tsx`): an optional prop `dragSource?: (cell: Cell) => DragSourceProps | undefined` (type from `src/drag/useDrag.ts`), spread onto each square's button.

Decisions:
- `Placement`'s `useDrag`: `canLift` is true for every slot (tray or placed). `canDrop(id, target)`: `'tray'` when slot `id` is placed; a `cell-<row>-<col>` target only when slot `id` is in the tray and fits, as now. `onDrop` on `'tray'` sets `removeShip(draft, id)` and keeps `selected` on that ship.
- `Grid` gets `dragSource={cell => { const slot = slotAt(draft, cell); return slot === -1 ? undefined : drag.source(String(slot)); }}`. A tap on a placed ship still selects it (the drag machine swallows only the click after a real drag).
- The tray `div` gets `data-drop="tray"` and a `min-height` equal to one ship's height in `naval.scss`, so it stays a target when empty.
- **Remove** sits right after Rotate: `<button type="button" disabled={selected === null || draft[selected] === null} onClick={() => setDraft(removeShip(draft, selected!))}>Remove</button>`. After it, the ship is back in the tray and still selected, so a tap on a square places it again.
- README Controls gains: `Remove takes the picked ship off the grid and back to the tray. You can also drag a placed ship back onto the tray`. The FAQ placement answer gains the same sentence.

- [ ] **Step 1: Write the failing tests.**
  `draft.test.ts`, `'removeShip puts one ship back in the tray and leaves the others'`: place slots 0 and 2, `removeShip(draft, 0)` has slot 0 `null` and slot 2 unchanged; `complete` of it is `null`; `removeShip(emptyDraft(), 1)` returns the same object it was given.
  `e2e/naval.spec.ts`, under the controls describe:
  - `'Remove takes the picked ship back to the tray'`: Random placement, tap one square of the length-4 ship, click Remove; `trayShip(alice, 4)` is visible, the grid has 13 ship squares, Confirm fleet is disabled; tap a free square and the ship is placed again.
  - `'Remove is disabled with nothing picked or a tray ship picked'`.
  - `'a placed ship dragged onto the tray goes back to it, even when the tray was empty'`: Random placement (tray empty), `drag(alice, square(alice, 'Your fleet', <a square of the 5>), alice.locator('.ship-tray'))`; `trayShip(alice, 5)` is visible and the grid has 12 ship squares. Repeat with `touchDrag`.
  - `'removing is not sent until Confirm fleet'`: after Remove, `table.state()` has no fleet for seat 1 and Bob's page does not show Alice as ready.
- [ ] **Step 2: Run** `node --test games/naval/client/draft.test.ts`. Expected: FAIL (`removeShip` missing).
- [ ] **Step 3: Implement** the draft function, the drag changes, Remove, the tray target, README and FAQ.
- [ ] **Step 4: Run** `node --test games/naval/*.test.ts games/naval/client/*.test.ts && npm run typecheck && npx vite build && E2E_PORT_BASE=8200 npx playwright test --workers=2 e2e/naval.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Naval Battle: remove one ship while placing`.

### Task 3: Naval house rule "Say the length on the first hit"

**Files:**
- Modify: `games/naval/options.ts`, `games/naval/types.ts`, `games/naval/rules.ts`, `games/naval/fleet.ts`, `games/naval/client/faq.ts`, `games/naval/README.md`
- Test: `games/naval/rules.test.ts`, `games/naval/fleet.test.ts`, `games/naval/client/describeMove.test.ts`, `games/naval/manager.test.ts`, `e2e/naval.spec.ts`

**Interfaces:**
- Produces (`options.ts`): `ANNOUNCE_LENGTH: ToggleRule = { id: 'announceLength', label: 'Say the length on the first hit', kind: 'toggle', standard: false, help: 'The first hit on a ship tells everyone its length' }`; `NAVAL_RULES = [SALVO, ANNOUNCE_LENGTH]`.
- Produces (`types.ts`): `Shot = { row; col; result: 'miss' | 'hit' | 'sunk'; sunkLength?: ShipLength; hitLength?: ShipLength }`. `hitLength` is set only on a `'hit'` that is the first shot ever to land on that ship, and only with the rule on.
- Produces (`rules.ts`): `answer(fleet: Ship[], earlier: Shot[], target: Cell, announce: boolean): Shot`; `applyMove` passes `houseRule(state, ANNOUNCE_LENGTH)`. "First" means no shot in `earlier` (which includes the earlier shots of the same salvo) is on a square of that ship.
- Produces (`fleet.ts`): `shotResult` returns `hit a ship of length ${shot.hitLength}` when `hitLength` is set. `shotsText` (used by `gameStatus` and `describeMove`) is otherwise unchanged.

- [ ] **Step 1: Write the failing tests.**
  `rules.test.ts`:
  - `'with Say the length on the first hit, the first hit on a ship carries its length and later hits do not'`: `playing({ announceLength: true })`; Alice fires F1: last shot `{ row: 5, col: 0, result: 'hit', hitLength: 5 }` and `gameStatus` `Alice fired at F1: hit a ship of length 5`; Bob misses; Alice fires F2: `result: 'hit'` with no `hitLength`.
  - `'a salvo carries the length only on its first shot on each ship, and sinking is unchanged'`: `playing({ salvo: true, announceLength: true })`, Alice fires J9, J10, F1, F2, A1: J9 has `hitLength: 2`, J10 is `sunk` with `sunkLength: 2` and no `hitLength`, F1 has `hitLength: 5`, F2 none.
  - `'without the rule a first hit has no length'`: `playing()`, F1 has no `hitLength` key.
  `fleet.test.ts`, `'shotsText names the length on a first hit'`: `shotsText([{ row: 5, col: 0, result: 'hit', hitLength: 3 }])` is `F1: hit a ship of length 3`.
  `describeMove.test.ts`, `'describes a first hit with its length'`: `Alice fired at B7: hit a ship of length 3`.
  `manager.test.ts`, `'an undone first hit takes its length with it'`: a manager with the rule on (house rules set by the host before `agreeAll`), Alice's first hit, `requestUndo` by Alice and approval by Bob; `view(manager, null).shots[1]` is `[]` and no step in `stepsOf(manager, 'naval')` after the undo holds `hitLength`.
  `e2e/naval.spec.ts`, under the rules describe: `'Say the length on the first hit: the first hit names the length, later hits do not, and History shows it'`: `houseRules: { announceLength: true }`, patched fleets `ALICE` and `BOB`; Alice fires F1: `status(alice)` and `status(bob)` read `Alice fired at F1: hit a ship of length 5`; after Bob's miss, F2 reads `Alice fired at F2: hit`; History's move label for F1 contains `hit a ship of length 5`; the read-only House rules list contains `Say the length on the first hitOn (house rule)`.
- [ ] **Step 2: Run** `node --test games/naval/*.test.ts games/naval/client/*.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the rule, type, `answer`, `shotResult`, README (Players list and a Rules line, and Differences from Wikipedia: the article's announce-on-sink only; the length on first hit is a house rule) and FAQ.
- [ ] **Step 4: Run** `node --test games/naval/*.test.ts games/naval/client/*.test.ts games/*.test.ts && npm run typecheck && npx vite build && E2E_PORT_BASE=8200 npx playwright test --workers=2 e2e/naval.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Naval Battle: house rule to say the length on the first hit`.

### Task 4: Jigsaw rotation rules

**Files:**
- Modify: `games/jigsaw/options.ts`, `games/jigsaw/types.ts`, `games/jigsaw/rules.ts`
- Test: `games/jigsaw/rules.test.ts`, `games/jigsaw/views.test.ts`

**Interfaces:**
- Produces (`options.ts`): `ROTATION_RULE: ToggleRule = { id: 'rotation', label: 'Rotate pieces', kind: 'toggle', standard: false, help: 'Pieces start turned. Turn one with its ↻ handle, or with R or a right-click while you hold it. A piece snaps only the right way up' }`; `JIGSAW_RULES = [MODE_RULE, PIECES_RULE, ROTATION_RULE]`.
- Produces (`types.ts`): `export type Turns = 0 | 1 | 2 | 3;` and `Piece = { x; y; placed; heldBy; placedBy; turns?: Turns }` with the comment `// quarter turns clockwise; absent is 0 (the rule off, or a state saved before it)`.
- Produces (`rules.ts`):
  - `turnsOf(piece: Piece): Turns` returns `piece.turns ?? 0` (exported; the client uses it too).
  - Action `{ type: 'turn'; piece: number }`, handled by `turnPiece(state: GameState, seat: Seat, value: unknown): Result<GameState>`: refused with `Pieces do not turn in this game` when the rule is off; `No such piece`; `That piece is locked in place`; `<name> is holding that piece` when held by another seat. Otherwise sets `turns: (turnsOf(piece) + 1) % 4` and `started: true` (as `pickUp` does). Reached from `attempt` as `case 'turn': return unrecorded(turnPiece(state, seat, input.piece))`, so `recordsAction` stays snap-only.

Decisions:
- `resetLobby`: when `houseRule(state, ROTATION_RULE)` is on, after `scatter` draw one `Math.floor(random() * 4)` per piece, in piece order, into the one `board` that Race copies to every seat. When off, draw nothing and add no `turns` key, so seeded tests and old states are unchanged.
- `drop`: `snapped = turnsOf(held) === 0 && snaps(grid, piece, spot.x, spot.y)`. A loose landing keeps the piece's `turns` (only when it has the key). A snapped piece is upright (no `turns` key).
- `undoOwn`: the piece comes loose upright (no `turns` key), as it was when it snapped.

- [ ] **Step 1: Write the failing tests** in `rules.test.ts` (with the file's `lobby`, `act`, `refused`, `home`):
  - `'with Rotate pieces on, every piece starts with 0 to 3 quarter turns, and not all upright'`: `lobby(['Alice'], { rotation: true })`; every `turns` is in `[0, 1, 2, 3]`; at least one is not 0.
  - `'Race boards all start with the same turns'`: `lobby(['Alice', 'Bob'], { mode: 'race', rotation: true })`; `boards[1]` deep equals `boards[2]`.
  - `'with Rotate pieces off, pieces have no turns and the scatter is as before'`: `lobby(['Alice'])` pieces have no `turns` key; `lobby(['Alice'], { rotation: false })` board deep equals it.
  - `'turn adds a quarter turn clockwise and wraps after three'`: four `turn` actions on one piece go 1, 2, 3, 0 from 0.
  - `'turn is refused with the rule off, on a placed piece and on a piece someone else holds'`: the three messages above, via `refused`.
  - `'turning is not recorded'`: `jigsaw.recordsAction!(state, 1, { type: 'turn', piece: 0 })` is false.
  - `'a piece near home snaps only when upright, and a loose drop keeps its turns'`: patch piece 0 to `turns: 2`; pick up and drop at `home(state, 0)`: not placed, `turns` 2; two turns more, pick up and drop at home: placed.
  - `'a piece saved without turns still snaps'`: a rotation-on lobby whose piece 0 has its `turns` key deleted drops at home and snaps.
  - `'undo my last move returns the piece upright'`: in Together, snap then `jigsaw.undoOwn!` gives a loose piece with no `turns` key.
  `views.test.ts`, `'a Race player sees only their own turns'`: in a rotation-on Race, seat 1's view has `boards` keys `['1']` only (as for positions).
- [ ] **Step 2: Run** `node --test games/jigsaw/*.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the rule, type, `turnsOf`, `turnPiece`, `resetLobby`, `drop` and `undoOwn` changes.
- [ ] **Step 4: Run** `node --test games/jigsaw/*.test.ts games/*.test.ts && npm run typecheck`. Expected: PASS, including every existing jigsaw test unchanged.
- [ ] **Step 5: Commit** `Jigsaw: Rotate pieces house rule`.

### Task 5: Jigsaw turn handle, R and right-click

**Files:**
- Modify: `games/jigsaw/client/PieceShape.tsx`, `games/jigsaw/client/Table.tsx`, `games/jigsaw/client/GameScreen.tsx`, `games/jigsaw/client/jigsaw.scss`, `games/jigsaw/client/faq.ts`, `games/jigsaw/README.md`
- Test: `e2e/jigsaw.spec.ts`

**Interfaces:**
- Consumes: `turnsOf`, `ROTATION_RULE`, the `turn` action (Task 4).
- Produces (`PieceShape.tsx`): prop `turns: number`; the group's transform is `translate(x,y) rotate(turns * 90, cell.w / 2, cell.h / 2)`, written as `rotate(...)` only when `turns > 0`, so an unturned piece's markup is unchanged.
- Produces (`Table.tsx`): optional prop `turnHandle?: { piece: number; onTurn: () => void }`. Drawn after every piece (on top) as `<g className="jigsaw-turn" role="button" tabIndex={0} aria-label="Turn piece">` with a circle and `↻`, centered on the top right corner of that piece's cell at its shown position (the dragged or landed spot when there is one), radius a quarter of the cell's shorter side. `onPointerDown` stops propagation and prevents default, so it never starts a drag; `onClick`, Enter and Space call `onTurn`.

Decisions:
- `GameScreen` keeps `touched: number | null` (`useState`), set in `onLift`. The handle shows when the rule is on, `touched !== null` and `canLift(touched)` (so not placed, not held by another, and this player can play). Its `onTurn` sends `{ type: 'turn', piece: touched }`. Nothing about `touched` is sent or stored.
- While `dragging !== null` and the rule is on, a window `keydown` of `r` or `R` (no Ctrl, Alt or Meta, not in a text field) and a window `contextmenu` (with `preventDefault`) send `turn` for `dragging.piece`. Removed when the drag ends.
- History and the table screen draw the turns through the same `PieceShape` and show no handle (no `turnHandle`).
- README: Rules gains a **Rotate pieces** line (the rule as in Global Constraints); Controls gains the handle, R and right-click; the Differences line `**No rotation.** Pieces never rotate` becomes `**Rotation is a house rule.** Off by default, pieces lie upright; with Rotate pieces on they start turned and snap only the right way up. Pieces are never flipped face down`. FAQ gains `How do I turn a piece?`.

- [ ] **Step 1: Write the failing tests** in `e2e/jigsaw.spec.ts` (use the file's `layout`, `piece`, `spot`, `drag`, `lift`; a `handle = (page) => page.getByRole('button', { name: 'Turn piece' })`; patch boards with `turns` set where needed):
  - `'Rotate pieces: pieces start turned, and a Race gives every board the same turns'`: Race with `houseRules: { mode: 'race', rotation: true }`; `table.state()` boards 1 and 2 have equal `turns` lists, not all 0; a turned piece's `transform` contains `rotate(`.
  - `'the ↻ handle appears after you touch a piece and turns it 90 degrees clockwise'`: no handle at first; drag piece 0 a little; the handle is visible; click it: `turns` goes from 0 to 1 and the transform contains `rotate(90`; four presses bring it back with no `rotate(`.
  - `'dragging the piece body never turns it'`: drag piece 0 several times; `turns` unchanged.
  - `'a turned piece dropped on its spot stays loose; turned upright it snaps'`.
  - `'R and a right-click turn the piece being held'`: `lift(alice, piece(alice, 0))`, `alice.keyboard.press('r')`, then a right button press and release at the pointer; `turns` rises by 2; finish the drag with `alice.mouse.up()`.
  - `'only the player who touched a piece sees its handle, and a piece held by someone else shows none'`: Together; Alice touches piece 0: Alice sees a handle, Bob none; Bob lifts piece 0 and holds it: Alice's handle is gone.
  - `'turning is not a History step and Undo my last move does not take it back'`: Together; turn piece 0, snap piece 1 upright; History has one step; Undo my last move unsnaps piece 1 and piece 0 keeps its turns.
  - `'with Rotate pieces off there is no handle'`: touch a piece; `handle` count 0.
  - `'turning works with a finger'`: a `touch: true` table, tap the handle after a `touchDrag`.
- [ ] **Step 2: Run** `npx vite build && E2E_PORT_BASE=8200 npx playwright test --workers=2 e2e/jigsaw.spec.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the transform, handle, `touched`, key and right-click listeners, CSS (handle fill and stroke from the theme's `--player` or accent colors, visible in light and dark), README and FAQ.
- [ ] **Step 4: Run** `node --test games/jigsaw/*.test.ts games/jigsaw/client/*.test.ts && npm run typecheck && npm run lint && npx vite build && E2E_PORT_BASE=8200 npx playwright test --workers=2 e2e/jigsaw.spec.ts`. Expected: PASS, including `'a piece locks only into its own spot, and pieces never rotate'` (rule off).
- [ ] **Step 5: Commit** `Jigsaw: turn handle, R and right-click`.

### Task 6: Browser check

**Files:** none new.

- [ ] **Step 1:** `npx vite build`, then `PORT=3502 node server/server.ts` in the background.
- [ ] **Step 2: Naval in Chrome**, two tabs: place with drag and tap, Remove a ship, drag one back to an empty tray, Random placement then Remove, Confirm. With the first-hit rule on, play to a forced end (patch shots if needed): status lines, History labels with the length, Undo of a first hit, download the game file and open it with View as each seat.
- [ ] **Step 3: Jigsaw in Chrome** with Rotate pieces on: Solo to the end; Together in two tabs (handles only on your own touched piece, none on the other's held piece); Race in two tabs (same turns on both boards). Turn with the handle, R and right-click; check no turn ever happens from dragging. Open History (turns drawn, no handle) and a downloaded game file.
- [ ] **Step 4: Layout:** both games at a laptop width (1280 px) and at phone width (same-origin iframes of 390 and 320 px, memory note), light and dark themes: the Remove button and tray fit with no overlap or blank rows; the ↻ handle is tappable at zoom 1 and 2 on the phone frame and never covered by the side panel.
- [ ] **Step 5:** Stop the server.

### Task 7: Full verification

- [ ] **Step 1: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS (or only failures recorded in Task 1 Step 5).
- [ ] **Step 2: Run** `npx vite build && E2E_PORT_BASE=8200 npx playwright test --workers=2 e2e/naval.spec.ts e2e/jigsaw.spec.ts e2e/houseRules.spec.ts`. Expected: PASS except `e2e/houseRules.spec.ts` lines 14 and 51 (known on `master`).

### Task 8: Push and pull request

- [ ] **Step 1: Push** `git push -u origin polish-naval-jigsaw`.
- [ ] **Step 2: Open the PR:**

```bash
gh pr create --base party-games-and-polish --title "Naval Battle remove and first-hit length, Jigsaw rotation" --body "$(cat <<'EOF'
## Summary
- Naval Battle: Remove beside Rotate, and a placed ship can be dragged back to the tray (draft only until Confirm fleet)
- Naval Battle house rule "Say the length on the first hit" (announceLength, off by default)
- Jigsaw house rule "Rotate pieces" (rotation, off by default): pieces start turned, a ↻ handle (and R or right-click on desktop) turns the piece you last touched, and a piece snaps only upright. Turning is not recorded

## Notes for the coordinator
- Only games/naval, games/jigsaw and their e2e specs changed
- e2e/houseRules.spec.ts tests at lines 14 and 51 fail as on master

## Test plan
- npm test, npm run typecheck, npm run lint
- npx playwright test --workers=2 e2e/naval.spec.ts e2e/jigsaw.spec.ts
- Chrome at 1280, 390 and 320 px, light and dark

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
EOF
)"
```

Every commit message in this plan ends with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
```
