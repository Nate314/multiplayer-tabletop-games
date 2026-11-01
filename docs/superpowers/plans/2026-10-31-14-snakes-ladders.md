# Snakes and Ladders Implementation Plan (changeset 14)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Coordinator note (overrides anything below):** one-line registration entries are allowed in `games/registry.ts`, `src/clientGames.ts`, `games/infos.ts`, `shared/svg/gameIcons.ts` (this game's landing icon), `shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`, the game count in `e2e/landing.spec.ts`, and `server/assets/registry.ts` for this game's server SVGs. Make them yourself; do not stop to ask, and do not leave a test failing for want of one. List them in the PR description. Other agents edit the same lines, so expect the coordinator to resolve conflicts.

**Goal:** Add Snakes and Ladders (`snakesladders`) for 2 to 6 players: roll one die, race up a fixed 10x10 board, climb ladders, slide down snakes, first to 100 wins.

**Architecture:** A new game folder `games/snakesladders/` on the existing `GameDefinition` contract, shaped like `games/parchisi/`. The fixed layout lives in a pure `board.ts` shared by rules, client and e2e. A roll is the only move (`{ type: 'roll' }`), rolled on the server with the platform's `random`, so every roll is on the timeline and undoable by vote. There is no hidden information. The Exact finish house rule is a `ToggleRule` in `options.ts`, as Pictionary declares its rules.

**Tech Stack:** React 19, TypeScript, SCSS, inline SVG, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-nine-new-games-design.md` (sections "Rules for every game agent" and "Snakes and Ladders").

**Branch:** `game-snakesladders` in its own worktree, started from `nine-new-games`. PORT 3214, E2E_PORT_BASE 6670 (never 6000).

## Global Constraints

- 2 to 6 players, category `classic`, id `snakesladders`, name "Snakes and Ladders".
- One six-sided die (`rollDie(random)` from `shared/dice.ts`), drawn with the shared `Die` from `src/components/Dice.tsx`.
- Rules from Wikipedia ("Snakes and ladders"); every difference listed in the README under "Differences from Wikipedia", in the format of `games/rook/README.md`. Where the spec disagrees, the spec wins.
- Rolling a 6 gives another roll: Wikipedia's main Gameplay text says "If a 6 is rolled, the player, after moving, immediately rolls again for another turn", so it is in. No limit on sixes in a row (Wikipedia is silent).
- Exact finish house rule: id `exactFinish`, `kind: 'toggle'`, `standard: false`. On: a roll that would pass 100 does not move. Off: a roll that would pass 100 stops on 100 and wins.
- First to 100 wins and the game ends there (no ranking play-on).
- Leaving: the leaver's token is removed and play goes on, as in Parchisi; the platform ends the game when one player is left.
- Files outside `games/snakesladders/`: one line each in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts` and `shared/svg/gameIcons.ts` (the last two are required by `games/infos.test.ts` and `src/games/loadClientGame.test.ts`; report the `infos.ts` and `gameIcons.ts` lines in the PR as the only shared-file touches beyond the spec's list), the root `README.md` game list and the count in its first sentence, and `e2e/snakesladders.spec.ts`. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`; if a platform or fixture change is needed, stop and report it.
- No new npm dependency. No em-dashes in READMEs, FAQs, comments or commit messages.
- Gates: `npm test`, `npm run typecheck`, `npm run lint` and `npx playwright test e2e/snakesladders.spec.ts` pass.

## The fixed layout (my call, documented in the README)

Our own layout, 8 ladders and 8 snakes. No square is both an end and a start, none uses 1 or 100, so a move never chains.

- Ladders (foot to top): 3 to 22, 8 to 30, 21 to 42, 28 to 76, 36 to 57, 50 to 69, 71 to 92, 80 to 99
- Snakes (head to tail): 27 to 5, 43 to 17, 55 to 34, 66 to 45, 74 to 53, 89 to 68, 96 to 77, 98 to 61

Squares run boustrophedon: 1 to 10 left to right on the bottom row, 11 to 20 right to left above it, and so on, 100 at the top left. Every token starts on square 1 (Wikipedia: "the starting square (usually the 1 grid square in the bottom left corner)"). Tokens may share a square. Seat 1 rolls first, then seats in join order (Wikipedia names no rule for who starts; my call, listed as a difference).

## Review Focus

1. A token on 95 to 99 with Exact finish on rolls too high: it stays, the status says how many it needs, and a 6 still gives another roll (Task 2 test `'exact finish: too high a roll stays put, and a 6 still rolls again'`).
2. A 6 that reaches 100 must end the game, not give another roll to a winner (Task 2 test `'a 6 that reaches 100 wins and does not roll again'`).
3. The current roller leaves mid-turn right after rolling a 6: the turn moves to the next seat and their token is gone, nobody is stuck waiting (Task 2 test `'the roller leaving after a 6 passes the turn on and removes their token'`).
4. Six tokens on square 1 at the start, or several on one snake tail, at phone width: every token stays visible and inside its cell, with no overlap into the next square (Task 3 `stackOffset` test, and the Task 4 browser check at 390 and 320 px).
5. Undo of a roll replays as a fresh roll (the platform's documented behaviour); the README must say so, so a player is not surprised the die differs (Task 2 README, Task 4 e2e `'an undo needs every player still in the game to approve'`).

---

### Task 1: Layout, house rule, info and types

**Files:**
- Create: `games/snakesladders/board.ts`, `games/snakesladders/options.ts`, `games/snakesladders/info.ts`, `games/snakesladders/types.ts`
- Test: `games/snakesladders/board.test.ts`

**Interfaces:**
- Produces (`board.ts`, pure, imported by rules, client and e2e):
  - `START = 1`, `FINISH = 100`, `SIZE = 10`
  - `LADDERS: Readonly<Record<number, number>>` and `SNAKES: Readonly<Record<number, number>>` with exactly the layout above
  - `jumpFrom(square: number): { to: number; via: 'ladder' | 'snake' } | null`
  - `cellOf(square: number): { row: number; col: number }`, row 0 at the top, col 0 at the left, boustrophedon as above
- Produces (`options.ts`): `EXACT_FINISH: ToggleRule` (`id: 'exactFinish'`, label "Exact finish: a roll that would pass 100 does not move", `standard: false`), `SNAKES_LADDERS_RULES: HouseRule[] = [EXACT_FINISH]`
- Produces (`info.ts`): `snakesladdersInfo: GameInfo` with `id: 'snakesladders'`, `category: 'classic'`, `name: 'Snakes and Ladders'`, description "Roll the die, climb the ladders and dodge the snakes on the way to 100", `minPlayers: 2`, `maxPlayers: 6`, `houseRules: SNAKES_LADDERS_RULES`
- Produces (`types.ts`):
  ```ts
  type Move = { type: 'roll' };
  type LastMove = {
    type: 'roll'; // the platform's sounds play the dice for lastMove.type 'roll'
    playerNumber: Seat; roll: number;
    from: number; landed: number; // landed: from + roll, capped at 100; equals from when stayed
    to: number; via: 'ladder' | 'snake' | null;
    stayed: boolean; // Exact finish kept the token in place
    again: boolean;  // a 6 that did not win: the same player rolls next
  };
  type GameState = BaseGameState & { positions: Record<Seat, number>; lastMove: LastMove | null }; // a player who left has no entry
  type PublicGameState = GameState & BasePublicState;
  ```

- [ ] **Step 1: Write the failing tests** in `board.test.ts`:
  - `'the layout is the documented eight ladders and eight snakes'`: `deepEqual` both records against the lists above.
  - `'ladders go up, snakes go down, and no move chains'`: every ladder `to > from`, every snake `to < from`, every square in 2..99, no `to` is a key of either record, no square is a key of both.
  - `'jumpFrom finds ladders and snakes'`: `jumpFrom(3)` is `{ to: 22, via: 'ladder' }`, `jumpFrom(98)` is `{ to: 61, via: 'snake' }`, `jumpFrom(4) === null`.
  - `'squares snake back and forth from the bottom left'`: `cellOf(1)` `{ row: 9, col: 0 }`, `cellOf(10)` `{ row: 9, col: 9 }`, `cellOf(11)` `{ row: 8, col: 9 }`, `cellOf(20)` `{ row: 8, col: 0 }`, `cellOf(100)` `{ row: 0, col: 0 }`.
- [ ] **Step 2: Run** `node --test games/snakesladders/board.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the four files.
- [ ] **Step 4: Run** `node --test games/snakesladders/`. Expected: PASS.
- [ ] **Step 5: Commit** `git add games/snakesladders && git commit -m "Snakes and Ladders layout, house rule and types"`

### Task 2: Rules, definition, manager test and README

**Files:**
- Create: `games/snakesladders/rules.ts`, `games/snakesladders/index.ts`, `games/snakesladders/README.md`
- Test: `games/snakesladders/rules.test.ts`, `games/snakesladders/manager.test.ts`

**Interfaces:**
- Consumes: Task 1's `board.ts`, `EXACT_FINISH`, types; `houseRule` (`shared/houseRules.ts`), `rollDie` (`shared/dice.ts`), `nextActivePlayer` and `baseGameState` (`shared/seating.ts`), `rankStandings` (`shared/standings.ts`).
- Produces (`rules.ts`):
  - `createGameState(gameId: string): GameState` (`positions: {}`, `lastMove: null`)
  - `resetLobby(state: GameState, random: Random): GameState`: every active seat on `START`, `lastMove: null`
  - `applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState>`: anything but `{ type: 'roll' }` is `{ error: 'Unknown move type' }`. Rolls, moves, applies `jumpFrom(landed)`, sets `lastMove` and `gameStatus`. Reaching 100: `isGameOver: true`, `winners: [seat]`, `currentPlayer: null`, `gameStatus` "<name> wins!". Else `currentPlayer` is `seat` when `again`, otherwise `nextActivePlayer`.
  - `onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState`: deletes `positions[seat]`; the platform has already moved the turn.
  - `toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'>`
  - `finalStandings(state: GameState): Standing[]`: `rankStandings` by position, furthest first; score text "Reached 100" or "Square <n>"
  - `describeLastMove(lastMove: LastMove, playerNames: Record<Seat, string>): string`, exact copy:
    - plain: "Alice rolled 4 and moved from 3 to 7"
    - ladder: "Alice rolled 2 and climbed a ladder from 3 to 22"
    - snake: "Bob rolled 3 and slid down a snake from 27 to 5"
    - stayed: "Alice rolled 5 and needs exactly 3 to reach 100"
    - win: "Alice rolled 3 and reached 100"
    - `again` appends ", and rolls again" to any of the first four
- Produces (`index.ts`): `snakesladders: GameDefinition<GameState, PublicGameState>` with `info`, `createGameState`, `resetLobby`, `onPlayerLeft`, `applyMove`, `toPublicState`, `finalStandings`. No `secretState` or `privateSeatView` (nothing is hidden).

- [ ] **Step 1: Write the failing tests** in `rules.test.ts` (a `faces(...values)` helper returns a `Random` giving `(face - 0.5) / 6` in turn; states built with `addPlayer` as `games/parchisi/rules.test.ts` does):
  - `'every token starts on square 1 and seat 1 rolls first'` (3 players).
  - `'a roll moves the token that many squares and passes the turn'`: from 1, a 4 gives position 5, `currentPlayer` 2, status "Alice rolled 4 and moved from 1 to 5".
  - `'landing on a ladder foot climbs it'`: from 1, a 2 gives 22, `lastMove.via === 'ladder'`, `landed === 3`.
  - `'landing on a snake head slides down'`: from 24, a 3 gives 5, `via === 'snake'`.
  - `'a 6 rolls again'`: from 1, a 6 gives 7, `currentPlayer` still 1, `again: true`, status ends ", and rolls again"; a second 6 again; then a 2 passes the turn.
  - `'without exact finish, passing 100 stops on 100 and wins'`: from 97, a 5 gives 100, `isGameOver`, `winners [1]`, status "Alice wins!".
  - `'exact finish: too high a roll stays put, and a 6 still rolls again'`: `houseRules: { exactFinish: true }`, from 97 a 5 leaves 97, `stayed: true`, status "Alice rolled 5 and needs exactly 3 to reach 100", turn passes; from 95 a 6 stays and `currentPlayer` stays 1; from 97 a 3 wins.
  - `'a 6 that reaches 100 wins and does not roll again'`: from 94, a 6 wins, `again: false`, `currentPlayer: null`.
  - `'tokens may share a square'`: two seats both on 5.
  - `'the roller leaving after a 6 passes the turn on and removes their token'`: through `removePlayer` from `shared/seating.ts` with 3 players, seat 1 rolled a 6, then leaves: `positions` has no key 1, `currentPlayer` 2.
  - `'malformed moves are rejected'`: `null`, `{ type: 'move' }`, `'roll'` each give `{ error: 'Unknown move type' }`.
  - `'finalStandings ranks by square, the winner first'`: positions 100, 40, 57 give seats 1, 3, 2 with "Reached 100", "Square 57", "Square 40".
  - `'describeLastMove covers every kind of roll'`: one assertion per string in the Interfaces block.
- [ ] **Step 2: Write the failing manager test** in `manager.test.ts` (as `games/parchisi/manager.test.ts`: `rememberingKeys(createGameManager([snakesladders], random))`, room `snakesladders/g1`):
  - `'rolls are validated, rolled on the server and recorded for undo'`: seat 2 rolling first gives `{ error: 'Not your turn' }`; seat 1's roll moves their token and `undoAvailable` is true; `requestUndo` by 1 and `voteUndo` by 2 restores position 1.
  - `'a short game plays to 100'`: a random that always rolls 6, so seat 1 keeps rolling (7, 13, ... 43 down to 17, ... 71 up to 92, 98 down to 61, ... 97, 100). After exactly 24 rolls by seat 1: `isGameOver`, `winners [1]`, `moveCount 24`, seat 2 still on 1, and a 25th roll is refused.
- [ ] **Step 3: Run** `node --test games/snakesladders/`. Expected: FAIL.
- [ ] **Step 4: Implement** `rules.ts` and `index.ts`. Write `README.md` in the shape of `games/parchisi/README.md`: intro line; seating (seat colors red, blue, green, orange, purple, cyan in join order); Rules (board and layout as two lists, start on 1, roll and move, ladders, snakes, shared squares, a 6 rolls again, passing 100, Exact finish house rule, first to 100 wins, leaving, undo by vote and "an undone roll is rolled again fresh"); Controls (filled in Task 3); "Differences from Wikipedia": the layout is this game's own; seat 1 always starts (Wikipedia names no rule); without Exact finish a roll past 100 stops on 100 (Wikipedia's Gameplay section does not say, its mathematics section ends the game on overshoot); with Exact finish the token stays (Wikipedia's variant also allows bouncing off, not implemented); no limit on sixes in a row.
- [ ] **Step 5: Run** `node --test games/snakesladders/`. Expected: PASS.
- [ ] **Step 6: Commit** `git add games/snakesladders && git commit -m "Snakes and Ladders rules, definition and README"`

### Task 3: Screen, animation, history and registration

**Files:**
- Create in `games/snakesladders/client/`: `index.ts`, `GameScreen.tsx`, `Board.tsx`, `RollPanel.tsx`, `GameStatus.tsx`, `PlayerList.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `animateMove.ts`, `geometry.ts`, `seatSymbols.ts`, `faq.ts`, `snakesladders.scss`
- Test: `games/snakesladders/client/geometry.test.ts`, `games/snakesladders/client/describeMove.test.ts`
- Modify: `games/registry.ts` (import and list `snakesladders` alphabetically, after `skipbo`), `games/infos.ts` (same), `src/clientGames.ts` (`snakesladders: () => import('../games/snakesladders/client/index.ts').then(m => m.snakesladdersClient)`), `shared/svg/gameIcons.ts` (`snakesladders: () => lineIcon(...)`: a ladder and a wavy snake on the 24-unit grid, for example `el('path', { d: 'M5 21V3M10 21V3M5 8h5M5 13h5M5 18h5' })` and `el('path', { d: 'M20 3c-4 2 0 5-3 8s1 6-3 10' })`), `games/snakesladders/README.md` (Controls)

**Interfaces:**
- Consumes: Task 1's `board.ts`, Task 2's `describeLastMove`, types; `Die` from `src/components/Dice.tsx`, `ColorSymbol`, `UndoVote`, `useMoveAnimation`, `boardScale` and `prefersReducedMotion` from `src/animation/motion.ts`, `gameService.makeMove`.
- Produces (`geometry.ts`, pure, board units in a `0 0 100 100` viewBox):
  - `centerOf(square: number): { x: number; y: number }` from `cellOf` (cell 10 units)
  - `stackOffset(index: number, count: number): { dx: number; dy: number }`: up to 6 tokens on one square in a 3 by 2 grid inside the cell, each within plus or minus 3.5 units
  - `pathOf(lastMove: LastMove): number[]`: the squares a token passes through: `from` then each square to `landed`, then `to` when `via`; `[]` when `stayed`
- Produces (`seatSymbols.ts`): `SEAT_SYMBOLS: Record<Seat, SymbolColor> = { 1: 'red', 2: 'blue', 3: 'green', 4: 'orange', 5: 'purple', 6: 'cyan' }`, token colors matching
- Produces (`describeMove.ts`): `describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string`, `describeLastMove` or `''`
- Produces (`index.ts`): `snakesladdersClient: ClientGame` with `id`, `Screen`, `faq`, `HistoryBoard`, `describeMove`, `animateMove`
- Layout decisions: `Board` is a square box (`aspect-ratio: 1`, max width the board area) holding a CSS grid of 100 numbered squares (`data-square`, checkerboard tint) and one SVG overlay (`viewBox 0 0 100 100`, `pointer-events: none`) drawing ladders as two rails and rungs between `centerOf(from)` and `centerOf(to)`, snakes as a curved body with a head at the head square, and tokens as circles in seat colors with `data-anim-key="token-<seat>"`, `aria-label` "<name>, square <n>", a `ColorSymbol` inside when Color-blind symbols is on. The board's group has `aria-label` "Board" and the last move's `from` and `to` squares get an outline. `RollPanel`: the last roll as `<Die value label="Last roll: 4">` (or "No roll yet") and a Roll button, enabled only for the current player with 2+ seated, not over, no undo or dismiss vote. `GameStatus` shows `gameStatus`, "Your turn: roll the die" when it is the viewer's turn, and `error`. `PlayerList` lists players in seat order with color, symbol, square, the current player marked. Side panel beside the board at laptop width, below it at 640 px or less. `HistoryBoard` renders `Board` and `PlayerList` read only.
- Animation: `animateMove` finds `next.lastMove`, and when `pathOf` has 2 or more squares it animates the mover's token through each square's center (`element.animate` keyframes of translations relative to the final spot, scaled by `boardScale`), 120 ms per step and 400 ms for the ladder or snake leg; nothing under `prefersReducedMotion()`.

- [ ] **Step 1: Write the failing tests:**
  - `geometry.test.ts`: `'centers follow the boustrophedon numbering'` (`centerOf(1)` `{ x: 5, y: 95 }`, `centerOf(10)` `{ x: 95, y: 95 }`, `centerOf(11)` `{ x: 95, y: 85 }`, `centerOf(100)` `{ x: 5, y: 5 }`); `'six tokens on one square stay inside the cell and apart'` (all six offsets distinct, every `|dx|` and `|dy|` at most 3.5; `stackOffset(0, 1)` is `{ dx: 0, dy: 0 }`); `'the path walks each square then jumps'` (from 1 rolling 2 up the ladder: `[1, 2, 3, 22]`; from 24 rolling 3 down the snake: `[24, 25, 26, 27, 5]`; a stayed roll: `[]`).
  - `describeMove.test.ts`: `'describes a roll, and nothing before the first'` (the ladder string from Task 2, and `''` for `lastMove: null`).
- [ ] **Step 2: Run** `node --test games/snakesladders/client/`. Expected: FAIL.
- [ ] **Step 3: Implement** the client files, the registrations and the icon. Fill in the README's Controls: Roll button, the die showing the last roll, the board outline of the last move, Undo asks everyone, Rules and FAQ, Color-blind symbols. Write `faq.ts` (4 to 6 entries covering a 6, passing 100 with and without Exact finish, shared squares, undo).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS, including `games/infos.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts` and `src/games/loadClientGame.test.ts`.
- [ ] **Step 5: Commit** `git add games/snakesladders games/registry.ts games/infos.ts src/clientGames.ts shared/svg/gameIcons.ts && git commit -m "Snakes and Ladders screen, animation and history"`

### Task 4: End-to-end tests, docs, browser check and PR

**Files:**
- Create: `e2e/snakesladders.spec.ts`
- Modify: `README.md` (count "thirty-four" in the first sentence, "Snakes and Ladders (two to six players)" in it, and the list line `- [Snakes and Ladders](games/snakesladders/README.md): roll the die, climb the ladders and dodge the snakes on the way to 100, for 2 to 6 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Snakes_and_ladders).` in alphabetical place). `docs/architecture.md`: change only a line that lists games by name; `grep -n "Parchisi" docs/architecture.md` shows none that lists all games today, so expect no change.

**Interfaces:**
- Consumes: `e2e/fixtures.ts` (`test`, `expect`, `seat`, `table.patch`, `undo`, `leave`, `dismiss`, `openFaq`, `setPreference`, `setHouseRules` via `seat(..., { houseRules })`), the `/api/e2e/random` queue as `e2e/parchisi.spec.ts`'s `queueDice` uses it, and `LADDERS`, `SNAKES` from `games/snakesladders/board.ts`.

- [ ] **Step 1: Write the specs**, one per README rule, control and difference, each starting with `seat('snakesladders', ['Alice', 'Bob'])` (three players where noted) and queued die faces:
  - Rules: `'every token starts on square 1, seat 1 rolls first, and turns go in join order'` (3 players); `'a roll moves the token that many squares'`; `'landing on a ladder foot climbs it'` (queue 2); `'landing on a snake head slides down'` (patch Alice to 24, queue 3); `'tokens share a square'`; `'a 6 gives another roll'`; `'a roll past 100 stops on 100 and wins'`; `'with Exact finish a roll past 100 does not move'` (`houseRules: { exactFinish: true }`, status "needs exactly 3"); `'first to 100 wins and the game ends'`; `'a player who leaves loses their token and play goes on'` (3 players, `leave`, `dismiss`); `'an undo needs every player still in the game to approve'` (`undo(alice, bob)`).
  - Layout: `'the board draws the eight documented ladders and eight snakes'` (count the overlay's ladder and snake groups, each with `data-from` and `data-to` matching `LADDERS` and `SNAKES`).
  - Controls: `'only the current player can press Roll'`; `'the die shows the last roll'`; `'the last move's squares are outlined'`; `'Color-blind symbols show a shape on each token and in the player list'`; `'the token walks along the path'` (motion on: the token's `getAnimations().length > 0` right after a roll); `'History shows each roll and its board'`; `'the FAQ opens from Rules'` (`openFaq`).
  - Differences: `'seat 1 always starts'`; `'any number of sixes in a row keep rolling'` (queue 6, 6, 6, 2).
- [ ] **Step 2: Run** `E2E_PORT_BASE=6670 npx playwright test e2e/snakesladders.spec.ts`. Expected: PASS.
- [ ] **Step 3: Also run** `E2E_PORT_BASE=6670 npx playwright test e2e/landing.spec.ts e2e/rules.spec.ts e2e/history.spec.ts e2e/houseRules.spec.ts e2e/lazyLoading.spec.ts`. Expected: PASS.
- [ ] **Step 4: Gates:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 5: Commit** `git add e2e/snakesladders.spec.ts README.md && git commit -m "Snakes and Ladders end-to-end tests and docs"`
- [ ] **Step 6: Browser check** (after `npx vite build`, `PORT=3214 node server/server.ts`; if `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH). In Chrome, one tab per player (3 players), play to a forced end (patch a token to 97 with the e2e server, or roll on), with Exact finish on in one game and off in another. Check a ladder climb and a snake slide animate along the path, six tokens on square 1 do not overlap outside the cell, History steps through the rolls, a downloaded game file opens with "View as". Check laptop width and 390 px and 320 px (same-origin iframes, since the window cannot be resized), light and dark: no overlap, no sideways scroll, numbers readable, the Roll button reachable without scrolling past the board on a phone.
- [ ] **Step 7: Push and open the PR** `git push -u origin game-snakesladders` then `gh pr create --base nine-new-games --head game-snakesladders` with Summary, Rulings (the layout, the 6 rule from Wikipedia's main text, overshoot behaviour with and without Exact finish, seat 1 starts, the `games/infos.ts` and `shared/svg/gameIcons.ts` lines) and Verification.
