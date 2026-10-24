# Dominoes Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dominoes gains three combinable layout house rules (doubles open branches: none, starter only or every double; Chickenfoot; Trains), the double-six or double-nine set becomes a house rule, the board draws branches outward from the starting double, and tiles can be dragged onto highlighted open ends.

**Architecture:** The single `line: Placed[]` becomes a `Board`: the starting tile plus a flat, append-only list of arms, each growing outward from the starter or from a double. One rule covers every layout: a double always ends its arm and opens child arms (one forward arm that continues the line, plus two branch arms when that double branches), so open ends, Chickenfoot and trains are all questions about arms. The pure board model lives in `games/dominoes/board.ts`; `rules.ts` reads the layout from `houseRule(state, RULE)` and owns who may use which end; the client turns the board into rows with a pure `boardRows` and draws them. Drag runs on a local helper with the drag and drop PR's `useDrag` interface.

**Tech Stack:** React 19, Vite 6, TypeScript 5.9, SCSS (sass), Express 5, `ws` 8, Node 22 (`node --test`), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-dominoes-layouts-design.md`

## Global Constraints

- Work on the current branch `dominoes-layouts`, created from the house rules framework commit (end of Task 3 of `docs/superpowers/plans/2026-10-24-house-rules.md`). Do not switch branches. Never commit to `master`. The PR targets `house-rules` and is retargeted to `master` once that merges.
- Build against the house rules framework exactly: `HouseRule`, `ToggleRule`, `ChoiceRule`, `houseRule(state, rule)`, `setHouseRules`, `offered`, `afterSeatChange` from `shared/houseRules.ts`; `agreeAll(manager, roomId)` from `server/testing.ts`; `SeatOptions.houseRules`, `setHouseRules`, `agreeToHouseRules` from `e2e/fixtures.ts`. The manager refuses moves until everyone agreed and calls `game.resetLobby` after a rule change.
- This branch owns the Dominoes `set`, `branching`, `chickenfoot` and `trains` rules. It does not add the Dominoes target score (house rules plan Task 5 owns `targetScore`).
- Rule values (spec, exact): "Doubles open branches" none, starter only or every double, **default every double**; Chickenfoot on or off, default off; Trains on or off, default off; any combination allowed; with Trains on the starting double is always a hub with one train per player plus the Mexican train, whatever the branching setting, and the branching setting applies to doubles played later.
- "No branches" must still play exactly as today. Existing e2e tests that assume the single line set `branching: 'none'` explicitly.
- "Rules are validated on the server; the board's legal ends come from the rules, not the client": the client highlights only what `legalPlays` / `usableEnds` from `rules.ts` return.
- Where a combination's rules conflict, the reading below (Task 3 Decisions) is written in the README's Rules and "Differences from Wikipedia" sections. Every source claim in a README must be checked against the cited page before it is written; anything not found there is written as "this game's choice" (CLAUDE.md: never invent facts).
- Drag: no library, no new dependency. `games/dominoes/client/useDrag.ts` exports exactly the drag and drop plan's `DragOptions`, `DragSourceProps`, `Drag` and `useDrag`, so the merge is a one-line import change.
- Styles in SCSS, nested under `[data-game="dominoes"]` in `games/dominoes/client/dominoes.scss`, light and dark (`:root[data-theme="dark"] &`), matching PR #21.
- No em-dashes (U+2014) in code, comments, UI text, READMEs, FAQ, commit messages or the PR description.
- Browser checks (CLAUDE.md): every task that changes UI loads the page in Chrome at 390x844 and 1440x900, in light and dark mode, and checks for overlap, blank rows, misplaced controls and sideways page scroll before it is reported done.
- Every task ends with `npm test`, `npm run typecheck` and `npm run lint` passing, plus `npx playwright test e2e/dominoes.spec.ts` once e2e is touched.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A game saved before this change.** A room in SQLite (or a step in a downloaded game file) has `line`, no `board`, no `houseRules`, and `lastMove.end`. It must load, play on as a single line (not switch to the new "every double" default mid-round) and its history must draw and describe. Tests in Task 1 (`boardOf`), Task 2 (rules) and Task 4 (`describeMove`).
2. **A blocked round with trains.** Nobody can play right now, but a stuck player's pass would open their train for someone who can. That is not blocked; blocked means nobody could play even with every train open. Test in Task 3.
3. **A Chickenfoot double nobody can finish with the boneyard empty.** The round must end as blocked at once, not loop on passes. Test in Task 3.
4. **A hand-crafted move.** `end` of -1, 1.5, 99, `"1"`, a closed end (its last tile is a double), another player's closed train, or an end outside an unfinished double. Each is refused with the state unchanged. Tests in Task 2 and Task 3.
5. **A long board on a phone.** Many doubles and long trains at 390 px must wrap inside the board with no sideways page scroll and no overlapping rows. Test in Task 4 (e2e, viewport 390x844).

---

## File Structure

- `games/dominoes/board.ts` (new): the board model. Types, laying a tile, open ends, the unfinished double, legacy conversion, end names. `games/dominoes/board.test.ts` (new).
- `games/dominoes/types.ts`: `GameState.board`, `openTrains`, `drewThisTurn`; `Move.end` becomes an arm index; `LastMove` play gains `where`; `chooseSet` leaves `Action`.
- `games/dominoes/rules.ts`: the four house rule declarations, `layoutOf`, `usableEnds`, `legalPlays`, `stuckMove`, opening the round, play, draw, pass, blocked, leaving.
- `games/dominoes/index.ts`: `info.houseRules`, the description.
- `games/dominoes/client/boardRows.ts` (new): board to rows, pure. `boardRows.test.ts` (new).
- `games/dominoes/client/Board.tsx` (new): draws the rows, the end slots and the empty-board slot.
- `games/dominoes/client/useDrag.ts` (new, temporary): local drag helper.
- `games/dominoes/client/GameScreen.tsx`, `Table.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `dominoes.scss`.
- `games/dominoes/README.md`, `README.md` (the Dominoes line near line 129).
- Tests: `games/dominoes/rules.test.ts`, `games/dominoes/manager.test.ts`, `games/dominoes/client/describeMove.test.ts`, `e2e/dominoes.spec.ts`.

---

### Task 1: The board model

**Files:**
- Create: `games/dominoes/board.ts`, `games/dominoes/board.test.ts`

**Interfaces:**
- Consumes: `Placed`, `Seat` from `games/dominoes/types.ts`.
- Produces (later tasks use these names exactly):

```ts
export type Branching = 'none' | 'starter' | 'every';
export type Layout = { branching: Branching; chickenfoot: boolean; trains: boolean };
export const SINGLE_LINE: Layout; // { branching: 'none', chickenfoot: false, trains: false }

export type Laid = { tile: number; inner: number; outer: number }; // inner touches the arm's base side
export type ArmName =
  | { kind: 'left' | 'right' | 'top' | 'bottom' | 'train' }
  | { kind: 'branch'; index: 1 | 2; pips: number }; // pips: the double it grows from
export type Owner = Seat | 'mexican' | null; // null unless Trains is on
export type Arm = {
  from: number | null; // tile id of the starter or double it grows from; null for the two arms of a non-double starter
  base: number;        // the pips its first tile must match
  name: ArmName;       // a forward child inherits its parent's name
  owner: Owner;        // every child inherits its parent's owner
  tiles: Laid[];       // outward
};
export type Board = { start: Placed | null; arms: Arm[] }; // arms are append-only: an arm's index is its id on the wire
export const EMPTY_BOARD: Board;

export function openEnd(board: Board, arm: number): number | null; // pips to match; null when its last tile is a double, or no such arm
export function openEnds(board: Board): { arm: number; pips: number }[]; // in arm index order
export function branched(board: Board): boolean; // some arm is named top, bottom, train or branch
export function lay(board: Board, layout: Layout, tile: number, pips: [number, number], arm: number, seats: Seat[]):
  { board: Board; pips: [number, number] }; // pips as laid, for LastMove; arm ignored on an empty board; caller has validated
export function pendingArms(board: Board, layout: Layout): number[]; // Chickenfoot: the empty arms of the newest unfinished double, else []
export function lineOf(board: Board): Placed[]; // the hub row, left to right: the left chain reversed, the starter, the right chain
export function boardFromLine(line: Placed[]): Board; // a saved single line as a board with the same open ends
export function boardOf(state: { board?: Board; line?: Placed[] }): Board; // state.board, else boardFromLine(state.line ?? [])
export function endLabel(board: Board, arm: number, playerNames: Record<Seat, string>): string;
export function endPhrase(board: Board, arm: number, playerNames: Record<Seat, string>): string;
```

Behavior of `lay`:
- **Empty board.** `start = { tile, left: low, right: high }`. Children of the starter: with `layout.trains` and a double, one `train` arm per seat in `seats` order (owner that seat), then one `train` arm owned by `'mexican'`; else a double with `branching !== 'none'`, four arms `left`, `right`, `top`, `bottom`; else `left` (base low) and `right` (base high). A non-double starter's arms have `from: null`.
- **On an arm** whose open end is `e`: append `{ tile, inner: e, outer: other }`. A non-double stops there. A double then appends its children, forward first: a forward arm (same `name` and `owner`, base `e`), then, when the double branches, two `branch` arms (index 1 and 2, `pips: e`, same owner). A double branches when `branching === 'every'`, or `branching === 'starter' && !branched(board)` (so with a non-double lead the first double played becomes the spinner).
- **Pips as laid:** `[outer, inner]` on an arm named `left`, else `[inner, outer]`; the starter `[left, right]`.

Behavior of `pendingArms`: empty unless `layout.chickenfoot`. Take the highest-index empty arm whose `from` is not null and, with Trains on, not the starter; return every empty arm with that same `from`. (Arms are appended in play order, so this is the newest unfinished double, and a double played as a toe is finished before the one it sits on.)

Copy of `endLabel` / `endPhrase` (exact): left `Left end` / `on the left`; right `Right end` / `on the right`; top `Top end` / `on the top`; bottom `Bottom end` / `on the bottom`; a seat's train `Bob's train` / `on Bob's train`; Mexican `Mexican train` / `on the Mexican train`; branch `First branch of 3-3` / `on the first branch of 3-3` (index 2: `Second`).

- [ ] **Step 1: Write the failing tests** in `games/dominoes/board.test.ts` (`node:test`, `assert/strict`), with a local `p = (a, b): [number, number]` and tile ids from `tilesOf(6)`:

```ts
test('a non-double starter opens a left and a right end', () => {
  const { board } = lay(EMPTY_BOARD, SINGLE_LINE, t(3, 4), p(3, 4), 0, [1, 2]);
  assert.deepEqual(openEnds(board), [{ arm: 0, pips: 3 }, { arm: 1, pips: 4 }]);
  assert.equal(board.arms[0].from, null);
});
test('with no branches a double continues the line and two ends stay open', () => {
  // 3-4, then 4-4 on the right: arm 1 is closed, arm 2 (forward, named right) is open on 4
  assert.equal(openEnd(board, 1), null);
  assert.deepEqual(openEnds(board), [{ arm: 0, pips: 3 }, { arm: 2, pips: 4 }]);
  assert.deepEqual(lineOf(board), [{ tile: t(3, 4), left: 3, right: 4 }, { tile: t(4, 4), left: 4, right: 4 }]);
});
test('a tile on the left is laid outer pips first, as the line reads', () => {
  assert.deepEqual(lay(board34, SINGLE_LINE, t(3, 6), p(3, 6), 0, []).pips, [6, 3]);
});
test('a starting double opens four ends unless branching is none', () => {
  // starter and every: names left, right, top, bottom, all base 6; none: left and right only
});
test('with starter only a later double continues the line, and with every double it opens two branches', () => {
  // starter: 6-6 hub, 6-3 on top, 3-3 on top -> one forward arm, openEnds count stays 4
  // every: same plays -> forward plus 'branch' 1 and 2 of pips 3, openEnds count 6
});
test('with starter only and a non-double lead, the first double played becomes the spinner', () => {
  // 3-4, 4-4 on the right opens forward + two branches; a later 3-3 on the left opens forward only
});
test('with trains the starting double is a hub of one train per seat and the Mexican train, whatever the branching', () => {
  for (const branching of ['none', 'starter', 'every'] as const) {
    const { board } = lay(EMPTY_BOARD, { branching, chickenfoot: false, trains: true }, t(6, 6), p(6, 6), 0, [1, 2, 3]);
    assert.deepEqual(board.arms.map(arm => arm.owner), [1, 2, 3, 'mexican']);
  }
});
test('a double on a train opens branches owned by that train', ...); // trains + every: children owner 2
test('Chickenfoot waits on the newest unfinished double until its ends are filled', () => {
  // every + chickenfoot: 3-4, 4-4 on the right -> pendingArms is its 3 children; 4-3 and 4-6 on two of them -> the third; fill it -> []
});
test('Chickenfoot finishes a newer unfinished double before an older one', () => {
  // a Board literal: an older double with one empty arm, a newer double with two empty arms
  // -> pendingArms is the newer double's two arms; with those filled -> the older double's arm
});
test('Chickenfoot exempts the trains hub but not a double played on a train', ...);
test('Chickenfoot asks a non-branching double for its one forward end, and the starter hub for all four', ...);
test('boardFromLine keeps the open ends and the left-to-right reading of a saved line', () => {
  const line = [{ tile: t(6, 3), left: 6, right: 3 }, { tile: t(3, 4), left: 3, right: 4 }, { tile: t(4, 4), left: 4, right: 4 }];
  assert.deepEqual(lineOf(boardFromLine(line)), line.map(...)); // same tiles and pips, same order
  assert.deepEqual(openEnds(boardFromLine(line)).map(end => end.pips), [6, 4]);
  assert.deepEqual(boardOf({ line }), boardFromLine(line));
  assert.deepEqual(boardOf({}), EMPTY_BOARD);
});
test('end labels and phrases name every kind of end', () => {
  // exact copy above, for left, right, top, bottom, "Bob's train", Mexican train, First and Second branch of 4-4
});
```

- [ ] **Step 2: Run** `node --test games/dominoes/board.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `board.ts` with the signatures and behavior above. `boardFromLine` lays `line[0]` with `SINGLE_LINE`, then every later tile on the open arm named `right` (each later tile's `left` equals the previous `right`, so `lay` takes them in order). `lineOf` follows forward children: a double's forward child is the first arm whose `from` is that double.
- [ ] **Step 4: Run** `node --test games/dominoes/board.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `git add games/dominoes/board.ts games/dominoes/board.test.ts && git commit -m "Dominoes: a board model with arms for every layout"`.

---

### Task 2: Rules on the board, the set and branching as house rules

**Files:**
- Modify: `games/dominoes/types.ts`, `games/dominoes/rules.ts`, `games/dominoes/index.ts`, `games/dominoes/client/GameScreen.tsx`, `games/dominoes/client/Table.tsx`, `games/dominoes/client/describeMove.ts`, `games/dominoes/README.md`, `games/dominoes/client/faq.ts`
- Test: `games/dominoes/rules.test.ts`, `games/dominoes/manager.test.ts`, `games/dominoes/client/describeMove.test.ts`, `e2e/dominoes.spec.ts`

**Interfaces:**
- Consumes: Task 1; `ChoiceRule`, `ToggleRule`, `HouseRule`, `houseRule`, `setHouseRules` (`shared/houseRules.ts`); `agreeAll` (`server/testing.ts`); `SeatOptions.houseRules` (`e2e/fixtures.ts`).
- Produces:

```ts
// types.ts
export type Move =
  | { type: 'play'; tile: number; end: number } // end: arm index; ignored for the first tile
  | { type: 'draw' } | { type: 'pass' };
export type Action = { type: 'acknowledgeRound' }; // chooseSet is gone: the set is a house rule
export type LastMove =
  | { type: 'play'; playerNumber: Seat; tile: number; pips: [number, number]; where: string | null; wentOut: boolean; end?: End | null } // end: saves from before layouts
  | { type: 'draw'; playerNumber: Seat }
  | { type: 'pass'; playerNumber: Seat; trainOpened?: boolean };
// GameState: `line` is replaced by
board: Board;
openTrains: Seat[];    // Trains: seats whose train anyone may use (Task 3)
drewThisTurn: boolean; // Trains: the one draw of this turn is used (Task 3)

// rules.ts
export const SET_RULE: ChoiceRule<SetSize>;          // id 'set', label 'Set', standard 6, choices 6 'Double-six (28 tiles)', 9 'Double-nine (55 tiles)'
export const BRANCHING_RULE: ChoiceRule<Branching>;  // id 'branching', label 'Doubles open branches', standard 'every',
                                                     // choices 'none' 'None (a single line)', 'starter' 'Starting double only', 'every' 'Every double'
export const CHICKENFOOT_RULE: ToggleRule;           // id 'chickenfoot', label 'Chickenfoot', standard false,
                                                     // help 'After a double, every end it opens must get a tile before anyone plays elsewhere'
export const TRAINS_RULE: ToggleRule;                // id 'trains', label 'Trains (Mexican Train)', standard false,
                                                     // help 'Play only on your own train, the Mexican train or an open train'
export const DOMINOES_RULES: HouseRule[];            // [SET_RULE, BRANCHING_RULE, CHICKENFOOT_RULE, TRAINS_RULE]
export function layoutOf(state: Pick<GameState, 'houseRules'>): Layout; // SINGLE_LINE when houseRules is missing (saved before layouts)
export type PlayView = Pick<GameState, 'set' | 'board' | 'leadTile' | 'openTrains' | 'drewThisTurn' | 'activePlayers' | 'houseRules'>;
export type Play = { tile: number; end: number };
export function usableEnds(view: PlayView, seat: Seat, everyTrainOpen?: boolean): number[]; // arm indexes this seat may play on
export function legalPlays(view: PlayView, seat: Seat, hand: number[]): Play[]; // first tile: each allowed tile once with end 0
export function stuckMove(view: PlayView, seat: Seat, hand: number[], boneyardCount: number): 'draw' | 'pass' | null; // null when a tile fits
```

`GameState` and `PublicGameState` both satisfy `PlayView`, so the client passes `gameState`. Every read of `view.board` goes through `boardOf(view)`, and `openTrains ?? []`, `drewThisTurn ?? false`, so a saved state from before this change works (Review Focus 1). `index.ts` sets `info.houseRules: DOMINOES_RULES`. `createGameState` sets `set: SET_RULE.standard`, `board: EMPTY_BOARD`, `openTrains: []`, `drewThisTurn: false`; `resetLobby` and `dealRound` reset the same three fields, and `resetLobby` sets `set: houseRule(state, SET_RULE)` before dealing (the manager calls it after every rule change). `layoutOf` reads `houseRule(state, BRANCHING_RULE)` and the two toggles; a missing `houseRules` means the state was saved before layouts (or a test built it by hand), so it plays `SINGLE_LINE`. Comment that in one line.

`usableEnds` in this task: every open end (`openEnds(boardOf(view))`), narrowed by `pendingArms` when it is non-empty. Task 3 adds the train filter. `play` refuses, in order: tile not in hand ('You do not have that tile'); the lead tile rule (existing copy); `end` not an integer arm index on the board ('There is no such end'); a closed end ('That end is closed'); an end outside a non-empty `pendingArms` ("Finish the 3-3 first", the double's pips); not matching ('That tile does not match that end'). `parseMove` accepts `end` only when `Number.isInteger(input.end)`. `isBlocked` tests `board.start !== null` instead of `line.length > 0`. `where` is `endPhrase(...)` of the arm played on (null for the first tile); `describeMove` uses `where ?? (end ? \`on the ${end}\` : null)`.

Client, only what typecheck and today's single line need (Task 4 draws the full board): `GameScreen` drops the set buttons and `SETS` import, computes `plays = legalPlays(gameState, playerNumber, hand)`, `stuckMove` for Draw and Pass, and the "Choose an end" group renders one button per fitting end, `${endLabel(board, end, playerNames)} (${pips})`, plus Cancel (so a single line still reads "Left end (2)" and "Right end (4)"). `Table` renders `lineOf(boardOf(gameState))` in `.line` and `Open ends: ` plus `openEnds` pips joined as "3 and 4" / "3, 4 and 6" in `.line-ends`.

- [ ] **Step 1: Update the existing tests to the board, then write the new ones.**
  - `rules.test.ts` helpers: `game()` uses `board: boardFromLine(laid([3, 4]))`, `openTrains: []`, `drewThisTurn: false`; assertions on `next.line` become `lineOf(next.board)`; `play(state, seat, tile, side: 'left' | 'right')` resolves `side` to the open arm with that name, so call sites stay; `legalPlays(6, hand, line, null)` calls become `legalPlays(view, seat, hand)`. The `chooseSet` test is replaced (below). These states have no `houseRules`, so they keep testing the single line unchanged.
  - New in `rules.test.ts`:

```ts
test('a new game plays every double branching, double-six, no Chickenfoot and no trains', () => {
  const state = lobby(2);
  assert.deepEqual(layoutOf(state), { branching: 'every', chickenfoot: false, trains: false });
  assert.equal(state.set, 6);
});
test('the set is a house rule: the host's choice is dealt and the first move locks it', () => {
  // setHouseRules(dominoes.info, lobby(2), 1, { values: { set: 9 }, override: false, maxPlayers: null }) then resetLobby:
  // set 9, hands of 9; after a move setHouseRules -> { error: 'The house rules are locked once play starts' }
});
test('chooseSet is no longer an action', () => assert.deepEqual(act(lobby(2), 1, { type: 'chooseSet', set: 9 }), { error: 'Unknown action' }));
test('a game saved before layouts plays on as a single line', () => {
  // { ...game(), board: undefined, line: laid([3, 4]) } with houseRules removed: legalPlays lists ends 0 and 1 only,
  // a 4-4 on the right is accepted and the result has a board whose lineOf is 3-4, 4-4, and still exactly two open ends
});
test('starter only: the starting double opens four ends, a later double continues its arm', () => {
  // houseRules values branching 'starter'; 6-6 led -> usableEnds count 4; 6-3 then 3-3 on the top -> still 4
});
test('every double: a double on an end opens three ends that each take its pips', () => {
  // 3-4 board, Alice plays 4-4 on the right -> openEnds pips [3, 4, 4, 4]; Bob's 4-6 is legal on each of the three 4s
});
test('a play on a missing, fractional or closed end is refused and changes nothing', () => {
  for (const end of [-1, 1.5, 99, '1']) assert.ok('error' in play(...));
  // after 4-4 on the right, end 1 (closed by the double) -> { error: 'That end is closed' }
});
```

  - `describeMove.test.ts`: `describes a play on each kind of end` ('Bob played 4-6 on the first branch of 4-4', "Cara played 6-1 on Bob's train", 'Alice played 6-2 on the Mexican train', 'Alice played 6-5 on the top') and `describes a play saved before layouts by its end` (`{ ..., end: 'left' }` without `where` reads 'on the left').
  - `manager.test.ts`: `gameWith(...names)` calls `agreeAll(manager, ROOM)` after the joins; a `gameWithRules(values, ...names)` helper calls `manager.setHouseRules(ROOM, 1, { values, override: false, maxPlayers: null })` after the joins and then `agreeAll`; `anyMove` uses `legalPlays(view, seat, view.hand)` and `stuckMove`; `view.line` comparisons become `view.board`. The lobby test becomes `the host's set reaches everyone and is dealt at once` (set 9 through `setHouseRules`; after one move `setHouseRules` is refused).
  - `e2e/dominoes.spec.ts`: `start(seat, names, houseRules = { branching: 'none' })` passes `{ houseRules }` to `seat`; `deal()` patches `board: boardFromLine(laid(...line))`, `openTrains: []`, `drewThisTurn: false` instead of `line`. The first test seats with `{ branching: 'none', set: 9 }` instead of clicking Double-nine. `the lobby choice is kept across joins...` becomes `the host's set is dealt, kept across joins, and locked by the first move`: seat with `{ agree: false }`, `setHouseRules(alice, 'dominoes', { branching: 'none', set: 9 })`, Bob's House rules panel shows Double-nine disabled, `table.join('Cara')` deals Cara 9 tiles, `agreeToHouseRules` on every page, the leader plays the lead tile, and `(await table.state<GameState>()).set` is 9 with the House rules panel gone.
- [ ] **Step 2: Run** `node --test games/dominoes && npx playwright test e2e/dominoes.spec.ts`. Expected: the new tests FAIL; typecheck fails on `line`.
- [ ] **Step 3: Implement** the types, rules, `index.ts` and the minimal client changes above.
- [ ] **Step 4: Update** `games/dominoes/README.md`: Rules gains **Set** as a house rule ("the host chooses double-six or double-nine in the house rules, before the first move") and **Doubles open branches** (none, starting double only, every double, default every double; what each does, including "with starting double only, if the round is not led by a double, the first double played opens the branches"); "The line" bullet says it is the "None" setting; Controls drops "click Double-six or Double-nine". Differences: replace "No spinner" with how the branching settings compare to the article's spinner section (check the article's wording first). `faq.ts`: "Which set is used?" (host, house rules), "Which tiles can I play?" (open ends of every arm), a new "What do the branching settings do?".
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/dominoes.spec.ts`. Expected: PASS.
- [ ] **Step 6: Browser check** a Dominoes lobby (host and guest) and a single-line game at 390x844 and 1440x900, light and dark: the House rules panel shows Set, Doubles open branches, Chickenfoot and Trains; no set buttons remain; the line and the end choice look as before.
- [ ] **Step 7: Commit** `git commit -am "Dominoes: the set and branching doubles as house rules, on the board model"`.

---

### Task 3: Chickenfoot and Trains

**Files:**
- Modify: `games/dominoes/rules.ts`, `games/dominoes/index.ts` (description), `games/dominoes/README.md`, `games/dominoes/client/faq.ts`, `README.md` (the Dominoes line)
- Test: `games/dominoes/rules.test.ts`, `games/dominoes/manager.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: no new exports beyond Task 2's; `usableEnds` gains the train filter and `stuckMove` the one-draw rule. Internal: `openRound(state: GameState): GameState` (sets `leadTile` and `currentPlayer`, and with Trains may move boneyard tiles into hands), used by `dealRound` and `onPlayerLeft`.

**Decisions** (this game's readings; write each in the README's Rules, and in "Differences from Wikipedia" where it departs from the article or the cited ruleset):
- **Chickenfoot** means a double must be finished: every end it opened gets a tile before anyone plays elsewhere. With "Every double" a double on an end opens three ends, which is the spec's 3-tile foot. With "None" or "Starting double only", a later double opens one end and must be covered first; a starting double that opens four ends must have all four covered before any arm grows. A double played as a toe is finished before the one it sits on.
- **Trains with Chickenfoot:** the trains hub is exempt (each train starts when its owner plays on it). The ends of an unfinished double may be used by every player, whatever train it is on, as Mexican Train rules have every player satisfy an open double.
- **Trains, whose ends:** you may play on your own train, the Mexican train, any open train, and the train of a dismissed player. Branches of a double on a train belong to that train.
- **Trains, drawing:** with no tile to play you draw one tile; if it fits you may play it, otherwise (or when the boneyard is empty) you pass and your train opens. Playing on your own train closes it. Without Trains, drawing is unchanged.
- **Trains, the lead:** every round, the first-round rule (the highest double held leads with it); the previous round's winner does not lead. If nobody holds a double, players draw from the boneyard one tile at a time in seat order, starting from the lowest seat, until someone draws a double; that player leads with it.
- **Trains, hand sizes:** unchanged (`HAND_SIZES`). Before writing the README, check Pagat's Mexican Train page; if its sizes are for a double-twelve set, say so and call these this game's choice.
- **Trains, leaving:** a leader who held the lead tile and is dismissed before the hub is played: `openRound` again among the hands left. A dismissed player's train stays on the board, open to everyone.
- **Not adopted** (Differences): a player who plays a double does not play again; without Chickenfoot a double need not be covered.
- **Blocked:** the boneyard is empty and no seat could play even with every train open (Review Focus 2). An unfinished double nobody can finish counts as blocked (Review Focus 3).

Copy (exact): errors "You can play only on your own train, the Mexican train or an open train", "You have already drawn this turn"; `pass` with boneyard tiles left and no draw yet keeps "Draw from the boneyard first"; status for a pass that opens a train: "Alice passed: Alice's train is open" (`trainOpened: true`).

- [ ] **Step 1: Write the failing tests** in `rules.test.ts` (states with `houseRules` values set by a local `withRules(state, values)` helper that writes `houseRules.values` directly):

```ts
test('Chickenfoot: after a double the next three tiles must go on it', () => {
  // every + chickenfoot, 3-4 board: Alice plays 4-4 on the right; Bob's 3-1 on the left -> { error: 'Finish the 4-4 first' };
  // three plays on its three ends are accepted, then the left end is usable again
});
test('Chickenfoot with no branches: a double must be covered before anyone plays elsewhere', ...);
test('Chickenfoot with starter only: all four ends of the starting double before any arm grows', ...);
test('Trains: the starting double opens one train per player and the Mexican train', ...); // 3 seats -> owners [1, 2, 3, 'mexican']
test('Trains: you may play only on your own train, the Mexican train or an open train', () => {
  // Alice's 6-2 on Bob's closed train -> the train error; on the Mexican train -> accepted; Bob in openTrains -> accepted
});
test('Trains: with nothing to play you draw one tile, then pass and your train opens', () => {
  // draw -> drewThisTurn true; second draw -> 'You have already drawn this turn'; pass -> openTrains [1], gameStatus "Alice passed: Alice's train is open"
});
test('Trains: playing on your own train closes it', ...);
test('Trains: every round opens with the highest double, and the last winner does not lead', ...);
test('Trains: when nobody holds a double, players draw in seat order until one does', ...); // crafted deck, noShuffle
test('Trains with Chickenfoot: the hub is exempt, and anyone may finish a double on a train', ...);
test('Trains: a dismissed player\'s train is open to everyone', ...);
test('Trains: a dismissed leader who held the lead double opens the round again', ...);
test('Trains: a round is not blocked while a pass would open a train someone can use', () => {
  // boneyard empty; Alice (to move) has nothing; Bob's only fit is on Alice's closed train -> Alice passes, round not over, Bob plays
});
test('a double nobody can finish with the boneyard empty ends the round as blocked', ...);
test('Trains without branching, with starter only and with every double all keep the hub', ...);
```

  `manager.test.ts`:
```ts
test('every combination of layouts plays whole games, and builds its history and game file', () => {
  for (const branching of ['none', 'starter', 'every']) for (const chickenfoot of [false, true]) for (const trains of [false, true]) {
    // gameWithRules({ branching, chickenfoot, trains }, 'A', 'B', 'C'); step to game over (cap 50000)
    assert.equal(state.isGameOver, true);
    assert.ok(manager.history('dominoes', 'g1')?.length);
    assert.ok('file' in (manager.gameFile('dominoes', 'g1', new Date()) ?? {}));
  }
});
test('undo restores the board, the open trains and the draw', ...); // trains: a draw, then undo -> drewThisTurn false, same board
test('a rejoin shows the same board and open trains', ...);
```
  `anyMove` already uses `stuckMove`, so it draws once and passes under Trains.
- [ ] **Step 2: Run** `node --test games/dominoes`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the decisions in `rules.ts`: `usableEnds` filters by owner when Trains is on (own, `'mexican'`, in `openTrains`, or not in `activePlayers`), unless `pendingArms` is non-empty (then those arms for everyone), and treats every train as open when `everyTrainOpen`; `stuckMove` applies the one-draw rule under Trains; `draw` sets `drewThisTurn`, `settle` clears it when the turn moves on; `pass` under Trains adds the seat to `openTrains`; a play on your own train removes you from it; `isBlocked` uses `everyTrainOpen`; `openRound` as decided; `lay` gets `state.activePlayers` as the train seats.
- [ ] **Step 4: Update** `games/dominoes/README.md` (intro sentence, Rules for Chickenfoot and Trains, every Decision above, Differences with sources checked: Wikipedia Dominoes, Pagat Mexican Train and Chicken Foot pages), `faq.ts` ("What is Chickenfoot?", "How do trains work?", "When is my train open?"), `index.ts` description "Match tile ends to build a line or branches and be first to play out your hand", and the Dominoes line in the root `README.md` (Chickenfoot and Mexican Train as house rules).
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -am "Dominoes: Chickenfoot and Mexican Train house rules"`.

---

### Task 4: The branching board

**Files:**
- Create: `games/dominoes/client/boardRows.ts`, `games/dominoes/client/boardRows.test.ts`, `games/dominoes/client/Board.tsx`
- Modify: `games/dominoes/client/Table.tsx`, `games/dominoes/client/GameScreen.tsx`, `games/dominoes/client/dominoes.scss`, `games/dominoes/README.md` (Controls), `games/dominoes/client/faq.ts`
- Test: `e2e/dominoes.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3; `lineKey` from `animateMove.ts` (unchanged, so a played tile still slides in).
- Produces:

```ts
// boardRows.ts
export type Cell =
  | { kind: 'tile'; tile: number; pips: [number, number] }
  | { kind: 'end'; arm: number; pips: number };
export type Row = { key: string; label: string | null; place: 'above' | 'hub' | 'below'; depth: number; open: boolean; cells: Cell[] };
export function boardRows(board: Board, playerNames: Record<Seat, string>, openTrains: Seat[]): Row[]; // [] for an empty board

// Board.tsx
export default function Board(props: {
  board: Board; playerNames: Record<Seat, string>; openTrains: Seat[]; lastTile: number | null;
  usable?: number[];          // ends to highlight as yours to use (class end-slot-usable)
  fits?: number[];            // ends the held or selected tile fits: buttons (class end-slot-fits)
  onEnd?: (arm: number) => void;
  startDrop?: boolean;        // the empty board is a drop target for the first tile
}): JSX.Element;
```

Layout (decided here; the spec leaves it to the builder): rows, not geometry, so a long branch never collides with another and wraps on a phone.
- The **hub row** (`key 'hub'`, label null) is `lineOf(board)` plus an end cell at each extreme for an open left or right end: exactly today's line when nothing branches. With Trains it is the hub tile alone.
- **Above** the hub: the `top` arm, or the first `ceil(n / 2)` trains. **Below**: the `bottom` arm, or the rest of the trains, Mexican last. Each such row is one chain: the arm's tiles, through each double's forward child, ending in an end cell when the chain's last arm is open.
- **Branch rows** (`depth` parent + 1) come right after the row holding their double, first branch then second, recursively.
- `label` is `endLabel` of the row's first arm; `open` is true for a train whose owner is in `openTrains`.

Board markup: each row is `.board-row` (`.board-row-above`, `.board-row-hub`, `.board-row-below`, `.board-row-open`, inline `--depth`), the hub row also has class `line`, `role="list"` and `aria-label="Line of play"` so today's selectors hold; other rows `role="list"` with `aria-label` = label and a visible `.board-row-label` (label plus " (open)" when open). Tiles are the existing `Tile` with `animKey={lineKey(tile)}` and `highlighted` for `lastTile`. An end cell is `.end-slot` showing its pips with `data-drop="end-<arm>"`; in `fits` it is a `<button>` with `aria-label="Open end: <endLabel> (<pips>)"` calling `onEnd`, else a `<span>` with that text as `title`. End slots are never `.tile`, so `.line .tile` counts only tiles. An empty board shows `.end-slot.board-start` with `data-drop="start"` when `startDrop`. Rows wrap (`flex-wrap`), indent by `--depth` up to a cap, and never widen the page.

GameScreen: on your turn `usable = usableEnds(gameState, playerNumber)`. Clicking a playable tile plays it at once when it fits one end (or is the first tile), else selects it: `fits` becomes its ends, the "Choose an end" group lists them, and clicking a slot or a group button plays it; Cancel or clicking the tile again clears it. Hints (exact): with an unfinished double "Finish the 4-4 first: play on its open ends"; Trains after a draw with nothing to play "Nothing fits: pass, and your train opens"; Trains with an empty boneyard and nothing to play "Nothing fits and the boneyard is empty: pass, and your train opens"; otherwise today's hints. `Table` renders `Board` in place of the `.line` div; `HistoryBoard` passes nothing interactive.

- [ ] **Step 1: Write the failing tests.**
  - `boardRows.test.ts`:
```ts
test('with no branches the board is one hub row that reads as today\'s line', () => {
  const rows = boardRows(boardFromLine(line), names, []);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].cells.filter(cell => cell.kind === 'tile').map(cell => cell.pips), [[6, 3], [3, 4], [4, 5]]);
  assert.deepEqual(rows[0].cells.filter(cell => cell.kind === 'end').map(cell => cell.pips), [6, 5]);
});
test('a spinner puts its top arm above the hub row and its bottom arm below', ...); // places ['above', 'hub', 'below']
test('trains split above and below the hub, the Mexican train last, an open train marked', ...); // 3 seats: Alice, Bob above; Cara, Mexican below
test('each branch row follows the row of its double, one deeper', ...);
test('an empty board has no rows', () => assert.deepEqual(boardRows(EMPTY_BOARD, names, []), []));
```
  - `e2e/dominoes.spec.ts` (a `build(layout, seats, start, ...plays)` helper that folds `lay` from `games/dominoes/board.ts` into a `board` for `deal()`, which gains an optional `board`; layout tests seat with the matching `houseRules`):
    - `every double (the default): a double opens three ends, and a tile clicked then an end clicked is played there`: default rules; 3-4 board; Alice plays 4-4; Bob's `.end-slot-usable` count is 4; Bob clicks 4-6, the end group lists 'Right end (4)', 'First branch of 4-4 (4)', 'Second branch of 4-4 (4)'; Bob clicks the slot 'Open end: First branch of 4-4 (4)'; Alice sees status 'Bob played 4-6 on the first branch of 4-4' and a row labelled 'First branch of 4-4' holding title '4-6'.
    - `starter only: the starting double opens four ends and a later double continues its arm`: `.line-ends` lists four ends after the lead; rows labelled 'Top end' above and 'Bottom end' below the hub; after 6-3 and 3-3 on the top, still 4 `.end-slot`.
    - `Chickenfoot: after a double only its ends are highlighted until its foot is finished`: every + chickenfoot; after 4-4, `.end-slot-usable` count 3 and the left end is not highlighted; after three toes, the left end is highlighted again.
    - `Trains: only your train, the Mexican train and open trains are highlighted; passing opens and marks your train`: three players; hub 6-6; Alice's usable ends are her train and the Mexican train (2); Alice draws a tile that does not fit, clicks Pass; Bob sees the row "Alice's train (open)" and 3 usable ends; Alice later plays on her own train and the "(open)" mark is gone.
    - `the leader's highest double becomes the hub with one train per player and the Mexican train`: trains on, real deal; the leader plays the lead tile; rows labelled "Alice's train", "Bob's train", 'Mexican train'.
    - `History and undo show the branches`: every double; after a branching play, History shows `.board-row` with the branch row; after `undo`, the branch row is gone for both players.
    - `a long board wraps at phone width with no sideways scroll`: viewport 390x844, every double, a crafted board of a 6-6 hub with long arms and several branches; `document.documentElement.scrollWidth <= 390` and no two `.board-row` boxes overlap (compare bounding boxes).
- [ ] **Step 2: Run** `node --test games/dominoes/client/boardRows.test.ts && npx playwright test e2e/dominoes.spec.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `boardRows.ts`, `Board.tsx`, the `Table`, `GameScreen` and `HistoryBoard` wiring, and the styles in `dominoes.scss` (`.board`, `.board-row*`, `.board-row-label`, `.end-slot`, `.end-slot-usable`, `.end-slot-fits`, `.board-start`), with dark-mode tokens for the slot highlight and open-train mark; use `--highlight` for usable ends.
- [ ] **Step 4: Update** README Controls (open ends are highlighted; click a tile, then an end, or use the end buttons; open trains are marked; the board rows, the hub row in the middle) and the FAQ "What if a tile fits more than one end?".
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/dominoes.spec.ts`. Expected: PASS.
- [ ] **Step 6: Browser check** every layout (none, starter only, every double, Chickenfoot, Trains with 4 players) mid-round with a long board, live and in History, at 390x844 and 1440x900, light and dark: rows do not overlap, labels sit with their rows, highlights are visible in both themes, no sideways scroll.
- [ ] **Step 7: Commit** `git commit -am "Dominoes: draw branches outward from the starter and highlight usable ends"`.

---

### Task 5: Drag tiles onto open ends

**Files:**
- Create: `games/dominoes/client/useDrag.ts`
- Modify: `games/dominoes/client/GameScreen.tsx`, `games/dominoes/client/Tile.tsx` (accept `dragProps?: DragSourceProps`, spread on the button), `games/dominoes/client/dominoes.scss`, `games/dominoes/README.md` (Controls), `games/dominoes/client/faq.ts`
- Test: `e2e/dominoes.spec.ts`

**Interfaces:**
- Consumes: Task 4's `Board` props (`fits`, `startDrop`, `data-drop` on slots).
- Produces, the drag and drop plan's Task 1 interface verbatim, from `games/dominoes/client/useDrag.ts`:

```ts
export type DragOptions = {
  canLift: (id: string) => boolean;
  canDrop: (id: string, target: string) => boolean;
  onLift?: (id: string) => void;
  onDrop: (id: string, target: string) => void;
  onCancel?: (id: string) => void;
};
export type DragSourceProps = {
  'data-drag': string;
  onPointerDown: (event: ReactPointerEvent<Element>) => void;
  onDragStart: (event: ReactDragEvent<Element>) => void;
};
export type Drag = { source: (id: string) => DragSourceProps | undefined; dragging: string | null; over: string | null };
export function useDrag(options: DragOptions): Drag;
```

The local helper keeps the contract that matters to Dominoes: a primary-button press only; lifted after 6 px (`DRAG_THRESHOLD_PX`); listeners on `window` from press to release, removed on unmount; the target is `document.elementFromPoint(...).closest('[data-drop]')`; `data-dragging` on the source and `data-drag-over` on a legal target; a floating clone with `pointer-events: none` that follows the pointer; Escape and `pointercancel` cancel; the click after a drag is swallowed; a tap stays a click. First line of the file: `// shortcut: a local copy of the drag and drop PR's src/drag/useDrag.ts interface; replace with that import when the branches merge`. Its styles (`[data-drag]` with `touch-action: none`, `[data-dragging]`, `.drag-ghost`, `[data-drag-over]`) go in `dominoes.scss` under a comment saying they go when the shared defaults arrive.

Wiring: source ids are `String(tile)`; targets `end-<arm>` and `start`. `canLift`: your turn and the tile is in `plays`. `canDrop`: some play of that tile has `end-${end}`, or `start` on an empty board. `onLift`: select the tile, so `fits` lights its ends. `onDrop`: send the play and clear the selection. `onCancel`: clear the selection.

- [ ] **Step 1: Write the failing e2e tests**, with a local `dragTile(page, from, to)` (mouse down on `from`, 8 `mouse.move` steps to `to`, mouse up):
  - `a tile dragged onto a highlighted end is played there, and its ends light up while it is held`: every double, after 4-4; Bob presses 4-6 and moves 20 px; three `.end-slot-fits`; release over 'Open end: Second branch of 4-4 (4)'; Alice sees 'Bob played 4-6 on the second branch of 4-4'.
  - `a tile dropped away from an open end goes back and nothing is sent`: drop on the players list; the tile is still in Bob's hand, `.drag-ghost` count 0, server `moveCount` unchanged.
  - `the first tile can be dragged onto the empty board`: the leader drags the lead tile onto `.board-start`.
  - `off turn, tiles do not lift`: Alice presses a tile on Bob's turn and moves 20 px; `.drag-ghost` count 0.
  - `a tap still plays a tile that fits one end`: the existing click tests keep passing (no change needed; run them).
- [ ] **Step 2: Run** `npx playwright test e2e/dominoes.spec.ts`. Expected: the drag tests FAIL.
- [ ] **Step 3: Implement** `useDrag.ts`, the `Tile` prop, the `GameScreen` wiring and the styles.
- [ ] **Step 4: Update** README Controls ("drag a tile onto a highlighted open end, or click it and then click an open end") and the FAQ answer on playing a tile.
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run lint && npx playwright test e2e/dominoes.spec.ts`. Expected: PASS.
- [ ] **Step 6: Browser check** dragging with the mouse at 1440x900 and with touch emulation at 390x844, light and dark: the ghost follows, fitting ends light up, a short tap still plays, the page still scrolls from the board and the players list on a phone.
- [ ] **Step 7: Commit** `git commit -am "Dominoes: drag tiles onto open ends"`.

---

### Task 6: Final verification and PR

**Files:**
- Modify: only what the checks below turn up.

- [ ] **Step 1: Run** `npm run lint && npm test && npm run build && npm run test:e2e`. Expected: all pass, 0 warnings.
- [ ] **Step 2: Browser check** on a fresh server (`npm start`): a three-player game with each layout and two combinations (Trains with every double; Chickenfoot with starting double only), through the House rules panel, a round to its scoring screen, a reload mid-round (rejoin), undo, History, and a downloaded game file opened with "Open a saved game", at 390x844 and 1440x900 in light and dark mode.
- [ ] **Step 3: Grep** `git diff house-rules --name-only | LC_ALL=C.UTF-8 xargs grep -lP '\x{2014}'` returns nothing (plain `grep -P` fails in this Git Bash locale).
- [ ] **Step 4: Push and open the PR**: `git push -u origin dominoes-layouts`, then `gh pr create --base house-rules --title "Dominoes layouts: branching doubles, Chickenfoot and Mexican Train"` with a body listing the four house rules and their standard values (including that "Every double" changes the default game on purpose), every Task 3 Decision, the row layout choice, the legacy single-line handling, the merge notes below, and ending with the attribution line.

---

## Merge notes

- **House rules plan Task 5 (Dominoes target score).** This branch owns `DOMINOES_RULES` in `games/dominoes/rules.ts` and `info.houseRules` in `index.ts`. Task 5 appends its `targetScore` choice rule to that array (order: set, branching, chickenfoot, trains, targetScore) and adds `targetScore(state)`. Expect conflicts in `rules.ts` (imports, `targetScore`), `client/Table.tsx` (the round line, next to the rewritten board), `client/RoundSummary.tsx` (theirs only), `README.md`, `faq.ts`, `manager.test.ts` (both add `agreeAll` to `gameWith`: keep one) and `e2e/dominoes.spec.ts`: Task 5's `the host can set a lower target` test must seat with `branching: 'none'` and its `deal()` must patch `board: boardFromLine(...)`, not `line`.
- **Drag and drop PR.** Replace `import { useDrag } from './useDrag.ts'` in `GameScreen.tsx` (and the `DragSourceProps` type import in `Tile.tsx`) with `'../../../src/drag/useDrag.ts'`, delete `games/dominoes/client/useDrag.ts` and the drag rules in `dominoes.scss` (the shared `:where()` defaults then apply; set `--drag-over` on `[data-game="dominoes"]` if the default outline color clashes). Optionally swap the e2e `dragTile` for the fixtures' `drag`. Update the drag and drop docs that list Dominoes as out of scope.
- **PR base.** Opened against `house-rules`; retarget to `master` once house rules merges.
