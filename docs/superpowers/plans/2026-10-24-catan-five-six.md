# Catan 5 and 6 Players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catan seats up to 6, switching to the official 5-6 player extension's 30-hex board, harbors and card counts whenever 5 or 6 are seated, with the special build phase as a house rule (off by default, offered only with 5 or more seated).

**Architecture:** `board.ts` builds its geometry from a list of hex coordinates, so it yields two `Board` objects (`BASE_BOARD`, `FIVE_SIX_BOARD`); every rule reads `boardOf(state.layout)` (picked by hex count, so saved games need no new field) instead of module-level constants. `editions.ts` picks board, bank size and development deck from the seat count at `resetLobby`. The special build phase lives in `specialBuild.ts`: ending a turn starts the next player's turn but holds their roll while `state.specialBuild.builders` (the other players in turn order, starting with the next one) each get a build chance; builders who are not `currentPlayer` move through the framework's `allowsOutOfTurn`, with the client sending `moveCount` for those moves.

**Tech Stack:** React 19, Vite 6, TypeScript 5.9, SCSS, Express 5, `ws` 8, Node 22 (`node --test`), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-catan-five-six-design.md`

## Global Constraints

- Branch `catan-five-six`, created from the house rules framework commit (end of Task 3 of `docs/superpowers/plans/2026-10-24-house-rules.md`, branch `house-rules`). The PR targets `house-rules`; retarget to `master` once that merges. Never commit to `master`.
- Build only against the framework's names: `ToggleRule`, `houseRule(state, rule)`, `offered(seats, values)`, `GameDefinition.allowsOutOfTurn(state, seat, move)`, `gameService.makeMove(move, moveCount?)`, `agreeAll(manager, roomId)` (`server/testing.ts`), `setHouseRules(page, gameType, values)` and `agreeToHouseRules(...pages)` (`e2e/fixtures.ts`), `seat(game, names, { agree: false })`.
- Anti-goal: the 3 and 4 player game does not change. The base board's hex, intersection and path ids, its port edges, the 19-card bank and the 25-card deck stay exactly as today. The existing `board.test.ts`, `rules.test.ts` and `e2e/catan.spec.ts` tests pass with no change other than the lobby text `(3/6 players)` and the house rules agreement (Task 4).
- Extension contents (spec, "decided"): 30 hexes in rows of 3, 4, 5, 6, 5, 4, 3: 6 forest, 6 pasture, 6 fields, 5 hills, 5 mountains, 2 deserts; 28 number tokens: 2, 12 twice each and 3, 4, 5, 6, 8, 9, 10, 11 three times each; 11 harbors: five 3:1, two 2:1 sheep, one 2:1 each of wood, brick, wheat and ore; 24 of each resource; 34 development cards: 20 Knights, 5 Victory Points, 3 Road Building, 3 Year of Plenty, 3 Monopoly; pieces per player unchanged (15, 5, 4).
- `maxPlayers` is 6. The extension applies at 5 or more seated (`FIVE_SIX_FROM = 5`), checked at every lobby reset.
- Special build phase rule (exact): id `specialBuild`, kind `toggle`, standard `false`, label `Special build phase`, help `After each turn, every other player in turn order may build or buy a development card, without trading or playing cards`, `offered: seats => seats >= FIVE_SIX_FROM`.
- Copy (exact): turn message `Your build chance` / `<name>'s build chance`; panel title `Your build chance`; panel note `Build or buy a development card. No trading or playing cards.`; button `Done building`; waiting line `Waiting for <name> to build`; lobby `Waiting for at least 3 players (up to 6)`.
- Errors (exact): `Wait for <name> to build`, `No trading during the special build phase`, `No development cards during the special build phase`, `Click Done building first`.
- Log notes (exact): `Special build phase: <names joined by ", ">`, `<name> is done building`, `<name> is away, so their build chance is skipped`, `<next player>'s turn` when the phase ends.
- Seat colors: seat 5 white (light `#F5F5F5`, dark `#ECEFF1`), seat 6 green (light `#43A047`, dark `#66BB6A`). Both are in the preferences plan's color-blind table (white ring, green triangle).
- Styles in `games/catan/client/catan.scss`, nested under `[data-game="catan"]`, as in PR #21.
- No em-dashes (U+2014) anywhere: code, comments, README, FAQ, commits, PR.
- Browser checks (CLAUDE.md): every task that changes UI loads the page in Chrome at 390x844 and 1440x900, light and dark, with 6 players seated, and checks for overlap, blank rows and misplaced controls.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A move index past the base board.** With per-board validation, `{ type: 'buildSettlement', vertex: 79 }` on a 3 player game must be `Invalid move`, never a crash on `undefined`; on the 30-hex board it is a real intersection. Test in Task 2 (`fiveSix.test.ts`).
2. **A builder who disconnects mid-chance.** Their build chance must be skipped at once, not wait for them as a turn does; a later builder who is away is skipped when their chance comes. Test in Task 4.
3. **The lobby shrinking from 5 to 4.** A player leaving before the first move puts back the base board, the 19-card bank and the 25-card deck, and the `specialBuild` value disappears with the offer. Test in Task 2 (board) and Task 4 (rule).
4. **A card bought in a build chance.** Others see only the count, and the buyer can play it from their next turn (for the next player, the turn that starts right after the phase), never during the phase. Test in Task 4.
5. **A game saved before this change.** No `specialBuild` field and a 19-hex layout: it loads and plays on with no phase. Test in Task 4.

---

## File Structure

- `games/catan/board.ts`: `Board` type, `buildBoard(coords, contents)`, `BASE_BOARD`, `FIVE_SIX_BOARD`, `boardOf`, `randomLayout(random, board)`; the old constant names kept as the base board's, for tests.
- `games/catan/editions.ts` (new): `Edition`, `FIVE_SIX_FROM`, `editionFor(players)`.
- `games/catan/devCards.ts` (`FIVE_SIX_DEV_DECK`), `resources.ts` (`FIVE_SIX_BANK_SIZE`), `building.ts`, `roads.ts`, `dice.ts`, `trades.ts`, `rules.ts`, `index.ts`, `types.ts`, `testing.ts`: read the board from the state.
- `games/catan/specialBuild.ts` (new): the rule declaration and the phase.
- `games/catan/client/layout.ts`, `Board.tsx`, `GameScreen.tsx`, `TurnPanel.tsx`, `catan.scss`, `faq.ts`; `games/catan/README.md`; `README.md`; `docs/architecture.md`.
- Tests: `games/catan/board.test.ts`, `games/catan/fiveSix.test.ts` (new), `games/catan/specialBuild.test.ts` (new), `games/catan/manager.test.ts`, `e2e/catan.spec.ts`. New test files keep clear of the lines house rules Task 13 adds to `rules.test.ts`.

---

### Task 1: Two boards from one geometry builder

**Files:**
- Modify: `games/catan/board.ts`
- Test: `games/catan/board.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:

```ts
export type Board = {
  hexCount: number; vertexCount: number; edgeCount: number;
  centers: { x: number; y: number }[];      // hex centres in hex radii, the drawing centred on (0, 0)
  vertices: { x: number; y: number }[];     // top to bottom, then left to right (today's order)
  hexVertices: number[][]; edges: [number, number][];
  vertexHexes: number[][]; vertexEdges: number[][]; vertexNeighbors: number[][]; hexNeighbors: number[][];
  portEdges: number[];
  hexResources: (Resource | null)[]; numberTokens: number[]; portKinds: PortKind[];
};
export const BASE_BOARD: Board;
export const FIVE_SIX_BOARD: Board;
export function boardOf(layout: Pick<Layout, 'hexes'>): Board; // FIVE_SIX_BOARD when hexes.length === 30, else BASE_BOARD
export function randomLayout(random: Random, board?: Board): Layout; // board defaults to BASE_BOARD
export function fairNumbers(hexes: Hex[]): boolean;                  // neighbours from boardOf({ hexes })
// Kept as BASE_BOARD's fields under today's names, for the tests and e2e only:
// HEX_COUNT, VERTEX_COUNT, EDGE_COUNT, VERTICES, HEX_VERTICES, EDGES, VERTEX_HEXES, VERTEX_EDGES,
// VERTEX_NEIGHBORS, HEX_NEIGHBORS, PORT_EDGES, HEX_RESOURCES, NUMBER_TOKENS, PORT_KINDS.
// RESOURCES, desertOf, pips and isIndex are unchanged. hexCenter and HEX_COORDS go (layout.ts reads board.centers).
```

Values: base coords are today's (`r` from -2 to 2, `|q + r| <= 2`). Five-six coords, row by row from the top: `r = -3: q 0..2; r = -2: q -1..2; r = -1: q -2..2; r = 0: q -3..2; r = 1: q -3..1; r = 2: q -3..0; r = 3: q -3..-1`. `buildBoard` subtracts the midpoint of the hex centres' x range, which is 0 for the base board, so its ids are unchanged. Base `portEdges` stays coast indexes `[0, 3, 6, 10, 13, 16, 20, 23, 26]` of 30; five-six uses `[0, 3, 7, 10, 14, 17, 21, 24, 28, 31, 35]` of its 38 coast edges (gaps of 3 and 4 alternating, as the base frame spaces its 9). Five-six `portKinds`: `['any', 'any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore']`; `hexResources` lists 6 wood, 6 sheep, 6 wheat, 5 brick, 5 ore, then two `null` (deserts last, as in the base list).

- [ ] **Step 1: Write the failing tests** in `board.test.ts` (keep every existing test as is):

```ts
test('the 5-6 player board has 30 hexes, 80 intersections and 109 paths', () => {
  const b = FIVE_SIX_BOARD;
  assert.deepEqual([b.hexCount, b.vertexCount, b.edgeCount], [30, 80, 109]);
  const touching = (n: number) => b.vertexHexes.filter(hexes => hexes.length === n).length;
  assert.deepEqual([touching(1), touching(2), touching(3)], [22, 16, 42]);
  for (const neighbors of b.vertexNeighbors) assert.ok(neighbors.length === 2 || neighbors.length === 3);
  assert.equal(b.hexNeighbors.filter(n => n.length === 6).length, 14);
});
test('the 11 ports of the 5-6 player board sit on distinct coast edges with no shared intersection', () => {
  assert.equal(new Set(FIVE_SIX_BOARD.portEdges).size, 11);
  const ends = FIVE_SIX_BOARD.portEdges.flatMap(edge => FIVE_SIX_BOARD.edges[edge]);
  assert.equal(new Set(ends).size, 22);
  for (const vertex of ends) assert.ok(FIVE_SIX_BOARD.vertexHexes[vertex].length <= 2);
});
test('a 5-6 player random layout has the extension mix, two deserts and no 6 or 8 next to each other', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const layout = randomLayout(seeded(seed), FIVE_SIX_BOARD);
    // resources sorted equal FIVE_SIX_BOARD.hexResources sorted; two hexes with resource null and number null
    // tokens sorted equal [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12]
    // port kinds sorted equal ['any' x5, 'brick', 'ore', 'sheep', 'sheep', 'wheat', 'wood']; fairNumbers(layout.hexes)
  }
});
test('boardOf picks the board by hex count', () => {
  assert.equal(boardOf(randomLayout(seeded(1))), BASE_BOARD);
  assert.equal(boardOf(randomLayout(seeded(1), FIVE_SIX_BOARD)), FIVE_SIX_BOARD);
});
test('the base board keeps its ids', () => {
  assert.equal(HEX_VERTICES, BASE_BOARD.hexVertices);
  assert.deepEqual(BASE_BOARD.centers[9], { x: 0, y: 0 }); // the middle hex
});
```

- [ ] **Step 2: Run** `node --test games/catan/board.test.ts`. Expected: FAIL, `FIVE_SIX_BOARD` not exported.
- [ ] **Step 3: Implement** `buildBoard(coords: [number, number][], contents: Pick<Board, 'hexResources' | 'numberTokens' | 'portKinds'>, portIndexes: number[]): Board` by moving today's `buildGeometry`, neighbour tables and `COAST` sort inside it, then the two boards, `boardOf`, the `randomLayout` parameter and the base aliases (one comment: `// The base board under its old names, for tests; rules code reads boardOf(state.layout)`). Update `layout.ts` only enough to compile: `hexCenter(hex)` becomes `BASE_BOARD.centers[hex]` until Task 3.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS, every existing Catan test unchanged.
- [ ] **Step 5: Commit** `git add games/catan && git commit -m "Catan: build the base and 5-6 player boards from one geometry"`.

---

### Task 2: Five and six players in the rules

**Files:**
- Create: `games/catan/editions.ts`, `games/catan/fiveSix.test.ts`
- Modify: `games/catan/devCards.ts`, `resources.ts`, `building.ts`, `roads.ts`, `dice.ts`, `trades.ts`, `rules.ts` (`parseMove`, `applyMove`, `resetLobby`, `fullBank`, `MAX_PLAYERS`), `index.ts` (`maxPlayers: MAX_PLAYERS`), `testing.ts`, `games/catan/manager.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:

```ts
// devCards.ts
export const FIVE_SIX_DEV_DECK: DevCard[]; // 20 knight, 5 victoryPoint, 3 roadBuilding, 3 yearOfPlenty, 3 monopoly
// resources.ts
export const FIVE_SIX_BANK_SIZE = 24;      // parseResources' cap becomes FIVE_SIX_BANK_SIZE * 5
// editions.ts
export type Edition = { board: Board; bankSize: number; devDeck: DevCard[] };
export const FIVE_SIX_FROM = 5;
export function editionFor(players: number): Edition; // base below 5 seated, the extension at 5 or 6
// rules.ts
export const MAX_PLAYERS = 6;
function parseMove(move: unknown, board: Board): Move | null; // isIndex against board.vertexCount / edgeCount / hexCount
// building.ts: type Placement = Pick<GameState, 'layout' | 'roads' | 'buildings'>; every geometry read is boardOf(state.layout)
// roads.ts RoadView, dice.ts robberVictims' Pick and trades.ts tradeRatio add 'layout' where missing
// testing.ts
export const FIVE_SIX_LAYOUT: Layout;  // FIVE_SIX_BOARD contents in printed order, deserts at hexes 28 and 29
export function fiveSixGame(overrides?: Partial<GameState>): GameState;
// five players Alice, Bob, Cara, Dan, Eve past setup, Alice to roll, FIVE_SIX_LAYOUT, robber 28,
// bank 24 of each, deck FIVE_SIX_DEV_DECK in printed order
```

`resetLobby` takes `editionFor(players.length)` for `randomLayout(random, edition.board)`, `fullBank(edition.bankSize)` and `shuffle(edition.devDeck, random)`. It runs on every seat change before the first move, so a 5th join switches to the extension and a leave back to 4 switches back.

- [ ] **Step 1: Write the failing tests.**

`fiveSix.test.ts`:
```ts
test('five seated get the 30-hex board, 24 of each resource and 34 development cards; back at four the base game', () => {
  const five = resetLobby(lobby(5), seeded(1));   // lobby(n): createGameState with n active players and names
  assert.equal(five.layout.hexes.length, 30);
  assert.deepEqual(five.bank, resources({ wood: 24, brick: 24, sheep: 24, wheat: 24, ore: 24 }));
  assert.equal(five.devDeck.length, 34);
  assert.equal(five.layout.hexes[five.robber].resource, null);
  const four = resetLobby({ ...five, activePlayers: [1, 2, 3, 4] }, seeded(1));
  assert.equal(four.layout.hexes.length, 19);
  assert.equal(four.bank.wood, 19);
  assert.equal(four.devDeck.length, 25);
});
test('setup on the large board snakes through all six players', () => {
  // resetLobby(lobby(6)).setup.order has length 12, is a permutation of 1..6 followed by its reverse
});
test('an intersection past the base board is an invalid move there and a real one on the large board', () => {
  assert.deepEqual(move(game({ rolled: true }), 1, { type: 'buildSettlement', vertex: 79 }), { error: 'Invalid move' });
  assert.notDeepEqual(move(fiveSixGame({ rolled: true }), 1, { type: 'buildSettlement', vertex: 79 }), { error: 'Invalid move' });
  assert.deepEqual(move(game(), 1, { type: 'moveRobber', hex: 29, victim: null }), { error: 'Invalid move' });
});
test('a roll on the large board pays settlements on its far hexes', () => {
  // fiveSixGame with Eve's settlement on FIVE_SIX_BOARD.hexVertices[27][0]; roll that hex's number with dice(); Eve's hand gains its resource
});
test('a 2:1 sheep port on the large board trades 2 sheep for 1', () => {
  // settlement(1) on an end of FIVE_SIX_LAYOUT's first 'sheep' port; bankTrade sheep for ore with 2 sheep succeeds
});
test('Longest Road is counted on the large board', () => {
  // 5 connected roads of seat 5 along FIVE_SIX_BOARD.edges round hex 29; after a build, longestRoad === 5
});
```

`manager.test.ts`: `gameWith`, `step` and `mine` read `boardOf(view.layout)` instead of `VERTEX_COUNT`, `HEX_COUNT` and `VERTEX_EDGES`; add:
```ts
test('a seeded five-player game plays to 10 points on the large board', () => {
  const state = playUntil(gameWith(13, ['A', 'B', 'C', 'D', 'E']), view => view.isGameOver, 9000);
  assert.equal(state.layout.hexes.length, 30);
  assert.equal(state.winners.length, 1);
  assert.ok(state.points[state.winners[0]] >= 10);
});
test('a seeded six-player game plays to 10 points, and no table step shows a hand', ...); // seed 17, six names, the same hidden-state checks as the 3-player test
```

- [ ] **Step 2: Run** `node --test games/catan/fiveSix.test.ts games/catan/manager.test.ts`. Expected: FAIL (`fiveSixGame` missing; the five-player join fails "Game is full").
- [ ] **Step 3: Implement** the interfaces above. Every non-test file stops importing the base aliases.
- [ ] **Step 4: Check the rules no longer read the base aliases:** `grep -rnE "\b(HEX_COUNT|VERTEX_COUNT|EDGE_COUNT|VERTICES|HEX_VERTICES|EDGES|VERTEX_HEXES|VERTEX_EDGES|VERTEX_NEIGHBORS|HEX_NEIGHBORS|PORT_EDGES)\b" games/catan --include=*.ts --include=*.tsx | grep -v "test.ts\|testing.ts\|board.ts\|/client/"` prints nothing (the client switches in Task 3).
- [ ] **Step 5: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "Catan: the 5-6 player extension's board, bank and deck at five or six seated"`.

---

### Task 3: The large board on screen, six colors, README and e2e

**Files:**
- Modify: `games/catan/client/layout.ts`, `Board.tsx`, `GameScreen.tsx` (`ALL_VERTICES`, `ALL_HEXES`, `turnMessage`), `catan.scss`, `faq.ts`; `games/catan/README.md`; `README.md` (line 3 and line 125); `e2e/catan.spec.ts`
- Test: `e2e/catan.spec.ts`

**Interfaces:**
- Consumes: `Board`, `boardOf`, `FIVE_SIX_BOARD`, `editionFor`, `FIVE_SIX_LAYOUT`, `MAX_PLAYERS`.
- Produces:

```ts
// layout.ts: every function takes the board first
export function vertexPoint(board: Board, vertex: number): { x: number; y: number };
export function hexPoint(board: Board, hex: number): { x: number; y: number };
export function hexPolygon(board: Board, hex: number): string;
export function edgeEnds(board: Board, edge: number): [{ x: number; y: number }, { x: number; y: number }];
export function portPoint(board: Board, edge: number): { x: number; y: number };
// The SVG viewBox and the sea round the island: base as today (half size 5.3 * SCALE square, the flat-topped
// hexagon SEA unchanged); five-six half width 6.2 * SCALE, half height 6.8 * SCALE, sea corners (±halfWidth, 0)
// and (±halfWidth / 2, ±halfHeight * 0.98)
export function boardFrame(board: Board): { viewBox: string; sea: string };
```

- `Board.tsx` reads `const board = boardOf(layout)` and passes it to every layout call. `GameScreen` computes the vertex and hex lists from `boardOf(gameState.layout)`, and gives the board area the class `board-area board-area-large` on the large board. `turnMessage` says `Waiting for at least ${MIN_PLAYERS} players (up to ${MAX_PLAYERS})`.
- `catan.scss`: `--seat5`, `--seat6` in light and dark with the Global Constraints values, `.seat5`, `.seat6`; `.board-area-large { width: min(100%, 680px, calc((100vh - 110px) * 0.91)); }` and in the 899 px query `calc((100vh - 200px) * 0.91)` (0.91 is the frame's width to height).
- README: intro "for 3 to 6 players. The base game, and the 5-6 player extension with 5 or 6"; a Rules bullet "**Five or six players.**" with the extension contents from Global Constraints and "the robber starts on one of the two deserts"; the bank bullet "19 cards of each resource (24 with 5 or 6 players)"; the development cards bullet adds the 34-card mix; Differences gains "**Five and six players.**" (the extension's frame is random like the base board, the 11 harbors spaced round the coast and their kinds shuffled). Root README: move Catan into "Catan and Risk (three to six players)" and line 125 "for 3 to 6 players ... the official base game and 5-6 player extension rules". FAQ: the join answer says "up to six players"; new item "What changes with five or six players?".

- [ ] **Step 1: Write the failing e2e tests** in `e2e/catan.spec.ts`. Add `FIVE = [...FOUR, 'Eve']`, `SIX = [...FIVE, 'Finn']`; `craftedState` takes `editionFor(players)` for the layout (`FIVE_SIX_LAYOUT` and robber 28 when large), the bank (`edition.bankSize` minus the hands) and the deck. Change the roll-off test's expected status to `'Cara joined (3/6 players). ...'`.

```ts
test('five players get the 30-hex board, 28 number tokens, 11 ports, two deserts, 24 of each resource and 34 development cards', async ({ seat }) => {
  const page = (await seat('catan', FIVE)).pages[0];
  await expect(page.locator('.hex')).toHaveCount(30);
  // terrain counts wood 6, sheep 6, wheat 6, brick 5, ore 5, desert 2; tokens sorted equal FIVE_SIX_BOARD.numberTokens
  await expect(page.locator('.port')).toHaveCount(11);
  await expect(page.locator('.port-any')).toHaveCount(5);
  await expect(page.locator('.port-sheep')).toHaveCount(2);
  await expect(bankCount(page, 'Wood')).toHaveText('Wood 24');
  await expect(page.getByLabel('Bank').getByText('Dev 34')).toBeVisible();
  // the robber's centre lies inside one of the two desert hexes' boxes
});
test('six players place in setup order round the table and back, each in their own color', async ({ seat }) => {
  // seat SIX; read setup.order from table.state(); each placer clicks the first vertex with settlementSpotError null
  // on the live state, then its first free FIVE_SIX_BOARD.vertexEdges path; others see 'Waiting for <name> to place a settlement'
  await expect(alice.locator('.building.seat6')).toHaveCount(2);
  await expect(alice.locator('.road.seat5')).toHaveCount(2);
  await expect(alice.locator('.player-row')).toHaveCount(6);
  await expect(status(alice)).toContainText('Setup is over');
});
test('a sixth player can join and a seventh cannot', ...); // join SIX, then a seventh name gets 'Game is full'
```

- [ ] **Step 2: Run** `npx playwright test e2e/catan.spec.ts -g "five players|six players|seventh"`. Expected: FAIL (19 hexes drawn, no `.seat6` color, or the vertex ids past 53 have no target).
- [ ] **Step 3: Implement** the layout, frame, screen, SCSS, README and FAQ changes above.
- [ ] **Step 4: Run** `npm test && npm run lint && npx playwright test e2e/catan.spec.ts`. Expected: all PASS, including every existing Catan test. Then the Task 2 grep without the `/client/` exclusion prints nothing.
- [ ] **Step 5: Browser check.** `npm start`, join one game with six names in six Chrome tabs. At 390x844 and 1440x900, light and dark: the whole island, all 11 ports and the sea fit without a horizontal scroll; the board is not taller than the window below the header; white and green pieces read on every terrain (green on forest included) and in the player list; the six player rows do not overlap the bank line. Then a 3-player game at the same sizes looks as it did before this branch.
- [ ] **Step 6: Commit** `git commit -m "Catan: draw the 5-6 player board, six colors, README and e2e"`.

---

### Task 4: The special build phase rule

**Files:**
- Create: `games/catan/specialBuild.ts`, `games/catan/specialBuild.test.ts`
- Modify: `games/catan/types.ts` (`SpecialBuild`, `GameState.specialBuild`, `Move` `passBuild`), `rules.ts` (`createGameState`, `PLAIN_MOVES`, `play`, `settle`, `endTurn`, `onPlayerLeft`, `onPlayerDisconnected`, `allowsOutOfTurn`), `trades.ts` (`offerTrade`), `index.ts` (`houseRules`, `allowsOutOfTurn`), `games/catan/manager.test.ts`, `e2e/catan.spec.ts` (roll-off test), `games/catan/README.md`, `games/catan/client/faq.ts`, `docs/architecture.md`

**Interfaces:**
- Consumes: `ToggleRule`, `houseRule`, `houseRulesOf`, `afterSeatChange`, `allowsOutOfTurn` on `GameDefinition`, `agreeAll`; `FIVE_SIX_FROM`; `buildRoad`, `buildSettlement`, `buildCity`, `buyDevCard`, `startTurn`, `nameOf`, `note`, `total`.
- Produces:

```ts
// types.ts
export type SpecialBuild = { builders: Seat[] }; // builders[0] has the build chance now; the rest wait in turn order
// GameState gains: specialBuild: SpecialBuild | null; // missing in older saves, read by truthiness only
// Move gains: | { type: 'passBuild' }

// specialBuild.ts
export const SPECIAL_BUILD: ToggleRule;                    // values in Global Constraints
export function buildChance(state: Pick<GameState, 'specialBuild'>, seat: Seat | null): boolean; // builders[0] === seat
// After `ended` ends their turn (the next turn already started): with the rule on, the other active players in
// turn order from the next one, minus those disconnected or holding fewer than 2 cards; null when none or rule off
export function startSpecialBuild(state: GameState, ended: Seat): GameState;
export function playSpecialBuild(state: GameState, seat: Seat, move: Move): Result<GameState>;
// Drops `seat` from the builders; drops leading builders who are disconnected or hold fewer than 2 cards;
// ends the phase (specialBuild null, note "<turn holder>'s turn") when none remain
export function withoutBuilder(state: GameState, seat: Seat): GameState;
// rules.ts
export function allowsOutOfTurn(state: GameState, seat: Seat, move: unknown): boolean;
// true only when buildChance(state, seat) and parseMove(move, boardOf(state.layout)) is buildRoad,
// buildSettlement, buildCity, buyDevCard or passBuild
```

Decisions:
- `endTurn` calls `startTurn(next)` as today, then `startSpecialBuild`. `currentPlayer` stays the next turn holder (via `syncTurn`); every builder who is not them moves out of turn.
- `play` sends every move to `playSpecialBuild` while `state.specialBuild` is set, after the setup branch. In it: a seat that is not `builders[0]` gets `Wait for <name> to build`; `bankTrade` gets `No trading during the special build phase`; any `play*` card gets `No development cards during the special build phase`; `roll`, `endTurn` and the rest get `Click Done building first`; the three builds call the existing functions (no `rolled` check); `buyDevCard` calls the existing one and then moves the card from `boughtThisTurn` to `devCards[seat]`, so it is playable from the buyer's next turn; `passBuild` notes `<name> is done building` and calls `withoutBuilder`.
- `offerTrade` refuses `No trading during the special build phase` while `state.specialBuild` is set.
- `settle` in `rules.ts` skips `checkWin` while `specialBuild` is set (`state.ts` is left alone; house rules Task 5 edits `checkWin`), so, as in the official rules, a player can only win on their own turn: anyone reaching 10 during a build chance wins when their own turn begins (for the next player, that is the moment the phase ends), never mid-phase.
- `onPlayerDisconnected`: when `buildChance(state, seat)`, note `<name> is away, so their build chance is skipped` and `withoutBuilder`. `onPlayerLeft`: `withoutBuilder(next, seat)`; if the turn holder left, the existing next-turn code runs and `specialBuild` becomes `null`.
- The rule stays on for the rest of the game if dismissals leave fewer than 5.

- [ ] **Step 1: Write the failing tests.**

`specialBuild.test.ts` (states from `fiveSixGame`, `withRule = (s) => ({ ...s, houseRules: { host: 1, values: { specialBuild: true }, override: false, maxPlayers: null, agreed: [1, 2, 3, 4, 5], revision: 1 } })`; everyone holds 2 or more cards unless the test says otherwise):
```ts
test('the rule is offered only with five or more seated', () => {
  assert.equal(SPECIAL_BUILD.offered?.(4, {}), false);
  assert.equal(SPECIAL_BUILD.offered?.(5, {}), true);
  assert.equal('specialBuild' in afterSeatChange(catan.info, undefined, [1, 2, 3, 4]).values, false);
  assert.equal(afterSeatChange(catan.info, undefined, [1, 2, 3, 4, 5]).values.specialBuild, false);
});
test('with the rule off, ending a turn starts the next turn as before', () => {
  const next = played(fiveSixGame({ rolled: true }), 1, { type: 'endTurn' });
  assert.equal(next.specialBuild, null);
  assert.equal(next.currentPlayer, 2);
});
test('with the rule on, every other player gets a build chance in turn order, starting with the next player', () => {
  const next = played(withRule(fiveSixGame({ turnHolder: 3, currentPlayer: 3, rolled: true })), 3, { type: 'endTurn' });
  assert.deepEqual(next.specialBuild, { builders: [4, 5, 1, 2] });
  assert.equal(next.currentPlayer, 4);
  assert.equal(next.turnHolder, 4);
  assert.match(next.gameStatus, /Special build phase: Dan, Eve, Alice, Bob/);
});
test('a builder may build and buy until Done building, which passes the chance on', ...); // Bob builds a road, keeps the chance, passBuild -> builders [3, 4, 5]
test('nobody may trade or play development cards during the phase', () => {
  // bankTrade by the builder -> 'No trading during the special build phase'
  // act(state, 2, offerTrade ...) by the turn holder -> 'No trading during the special build phase'
  // playKnight by the builder holding a knight -> 'No development cards during the special build phase'
});
test('only the builder whose chance it is may move, and the next player cannot roll until the phase ends', () => {
  // builders [3, 4, 5, 1], turn holder 2: move(state, 2, roll) -> 'Wait for Cara to build'; Cara's roll -> 'Click Done building first'
});
test('allowsOutOfTurn admits only the builder\'s build moves', () => {
  assert.equal(allowsOutOfTurn(state, 3, { type: 'buildRoad', edge }), true);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'passBuild' }), true);
  assert.equal(allowsOutOfTurn(state, 4, { type: 'passBuild' }), false);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'bankTrade', give: 'wood', get: 'ore' }), false);
  assert.equal(allowsOutOfTurn(state, 3, { type: 'buildRoad', edge: 999 }), false);
  assert.equal(allowsOutOfTurn(fiveSixGame(), 3, { type: 'passBuild' }), false);
});
test('when the last builder is done the next player rolls', ...); // specialBuild null, currentPlayer 2, rolled false, status ends "Bob's turn"
test('players with fewer than 2 cards and disconnected players are skipped', ...); // Alice ends; Cara holds 1 card, Dan in disconnected -> builders [2, 5]
test('a builder who disconnects has their chance skipped at once', () => {
  // onPlayerDisconnected(state with builders [3, 4], 3, dice()).specialBuild deep equals { builders: [4] }; status 'Cara is away, so their build chance is skipped'
});
test('a dismissed builder is dropped, and the turn holder leaving ends the phase', () => {
  // builders [3, 4], turn holder 2: onPlayerLeft(..., 4) -> { builders: [3] }; onPlayerLeft(..., 2) -> specialBuild null, turnHolder 3
});
test('a card bought in a build chance is hidden from others and playable from the buyer\'s next turn', () => {
  // Eve buys: devCards[5] has the knight, boughtThisTurn unchanged; toPublicState(s, false, 1).devCounts[5] === 1 and its myDevCards is []
  // playKnight by Eve in the phase is refused; once Eve's own turn begins playKnight succeeds
});
test('the next player reaching 10 in their own build chance wins when the phase ends', ...); // Bob at 9 builds a settlement: not over; after the last pass winners [2]
test('a later player reaching 10 in a build chance wins only when their own turn begins', ...); // Carol (seat 3) at 9 builds during Alice's phase: not over after the phase or during Bob's turn; winners [3] when Carol's turn begins
test('a game saved without the specialBuild field plays on with no phase', ...); // delete field from withRule-less state; endTurn works, specialBuild null
```

`manager.test.ts`: `gameWith` calls `agreeAll(manager, ROOM)` after the joins; `gameWith` takes an optional `values` and, when given, calls `manager.setHouseRules(ROOM, 1, { values, override: false, maxPlayers: null })` before `agreeAll`. `step` picks `table.specialBuild?.builders[0] ?? table.currentPlayer`, and for a builder sends `chooseBuild` unless it is a `bankTrade`, else `{ type: 'passBuild' }`. Add:
```ts
test('a seeded six-player game with the special build phase plays to 10 points', () => {
  const state = playUntil(gameWith(19, SIX_NAMES, { specialBuild: true }), view => view.isGameOver, 12000);
  assert.equal(state.winners.length, 1);
  // and somewhere in history a step whose lastMove.type is 'passBuild' and one built by a seat that was not currentPlayer
});
test('a builder\'s move naming an old move count is refused', () => {
  // in a phase, manager.move(ROOM, builder, { type: 'passBuild' }, staleCount) -> { error: 'Someone else moved first' }
});
```

`e2e/catan.spec.ts`: the roll-off test calls `await agreeToHouseRules(alice, bob, cara)` after Cara joins (her join clears the agreements now that Catan declares a rule).

- [ ] **Step 2: Run** `node --test games/catan/specialBuild.test.ts games/catan/manager.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the interfaces and decisions above; `index.ts` adds `houseRules: [SPECIAL_BUILD]` and `allowsOutOfTurn`. README Rules bullet "**Special build phase (house rule, 5 or 6 players).**", Differences bullets: the extension always uses it and here it is off unless the host turns it on; players holding fewer than 2 cards are skipped, as they cannot pay for any piece; a card bought in a build chance is playable from the buyer's next turn; a player away when their chance comes is skipped. FAQ item "What is the special build phase?". `docs/architecture.md`: one line under the platform's out-of-turn moves naming Catan's special build phase as the user.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npx playwright test e2e/catan.spec.ts`. Expected: PASS (the lobby now shows the house rules panel and every Catan e2e still passes through the fixture's agreement).
- [ ] **Step 5: Commit** `git commit -m "Catan: the special build phase as a house rule"`.

---

### Task 5: Build chances on screen

**Files:**
- Modify: `games/catan/client/GameScreen.tsx`, `TurnPanel.tsx`, `catan.scss` (only if the new panel needs it), `games/catan/README.md` (Controls), `games/catan/client/faq.ts`
- Test: `e2e/catan.spec.ts`

**Interfaces:**
- Consumes: `buildChance`, `SpecialBuild`, `setHouseRules`, `agreeToHouseRules`, `gameService.makeMove(move, moveCount?)`.
- Produces:
  - `GameScreen`: `const canBuild = ready && buildChance(gameState, playerNumber)`. `activeMode` is `mode` when `(canMove && !pending && rolled) || canBuild`. `targetsFor` returns the mode's targets when `state.specialBuild` is set. Targets are computed when `canMove || canBuild`. `send` calls `gameService.makeMove(move, playerNumber === currentPlayer ? undefined : gameState.moveCount)`. `HandPanel` gets `canPlay && !specialBuild`; `TradePanel` gets `canAct && !specialBuild`. `turnMessage` returns `Your build chance` / `<name>'s build chance` while the phase runs. **Merge hook for the drag and drop tray:** `canBuild` is the flag the tray's `canLift` ORs with `canMove`.
  - `TurnPanel`: new prop `canBuild: boolean`. The build buttons and Buy development card move into one local `BuildButtons({ gameState, mode, spots, onMode, onMove })`, used by the turn and by the build chance (DRY). While `specialBuild` is set: with `canBuild`, a panel titled `Your build chance` with the note, `BuildButtons`, the "Click a highlighted ..." line and `Done building` (`{ type: 'passBuild' }`); otherwise `Waiting for <builder> to build`. No bank trade and no End turn in the phase.

- [ ] **Step 1: Write the failing e2e tests:**

```ts
test('the special build phase is offered only with five or more seated', async ({ seat }) => {
  const table = await seat('catan', FOUR, { agree: false });
  await expect(table.pages[0].getByLabel('Special build phase')).toHaveCount(0);
  await table.join('Eve');
  await expect(table.pages[0].getByLabel('Special build phase')).not.toBeChecked();
});
test('with the special build phase on, each other player in turn order gets a build chance, builds or buys without trading or playing cards, and Done building passes it on', async ({ seat }) => {
  const table = await seat('catan', FIVE, { agree: false });
  await setHouseRules(table.pages[0], 'catan', { specialBuild: true });
  await agreeToHouseRules(...table.pages);
  // craft: Alice rolled; Bob holds ROAD and an old Knight next to his road; Cara holds DEV_CARD; Dan holds nothing; Eve holds ROAD
  await button(alice, 'End turn').click();
  await expect(turnMessage(alice)).toHaveText("Bob's build chance");
  await expect(bob.locator('.turn-panel .panel-title')).toHaveText('Your build chance');
  await expect(bob.getByLabel('Give to the bank')).toHaveCount(0);
  await expect(devCardRow(bob, 'Knight').getByRole('button', { name: 'Play' })).toBeDisabled();
  await expect(cara.locator('.turn-waiting')).toHaveText('Waiting for Bob to build');
  await button(bob, 'Build road').click();
  await clickPath(bob, edge);
  await expect(alice.locator('.road.seat2')).toHaveCount(2);
  await button(bob, 'Done building').click();
  await expect(turnMessage(bob)).toHaveText("Cara's build chance");
  await button(cara, 'Buy development card').click();
  await expect(row(alice, 'Cara')).toContainText('Dev 1');
  await button(cara, 'Done building').click();
  await expect(turnMessage(alice)).toHaveText("Eve's build chance"); // Dan, with no cards, is skipped
  await button(eve, 'Done building').click();
  await expect(button(bob, 'Roll the dice')).toBeVisible();
});
```

(A stale out-of-turn click is pinned by the manager test in Task 4; the UI cannot produce one on demand.)

- [ ] **Step 2: Run** `npx playwright test e2e/catan.spec.ts -g "special build|build chance"`. Expected: FAIL (no build chance panel).
- [ ] **Step 3: Implement** the `GameScreen` and `TurnPanel` changes; README Controls bullet "With the special build phase on, after each turn your panel shows Your build chance: build or buy, then click Done building"; FAQ answer names the button.
- [ ] **Step 4: Run** `npm test && npm run lint && npx playwright test e2e/catan.spec.ts`. Expected: PASS.
- [ ] **Step 5: Browser check** with six players and the rule on, at 390x844 and 1440x900, light and dark: the build chance panel, the waiting line on the other five screens, the turn message, highlighted targets for the builder only, and no bank trade or End turn during the phase; no overlap or blank rows in the side panel.
- [ ] **Step 6: Commit** `git commit -m "Catan: build chance panel and Done building"`.

---

### Task 6: Final verification and PR

**Files:** none new.

- [ ] **Step 1: Run** `npm run lint && npm test && npm run build && npm run test:e2e`. Expected: all pass, 0 lint warnings.
- [ ] **Step 2: Browser check** on a fresh `npm start`: a 3-player game (unchanged look and rules), a 5-player game (board switches at the fifth join and back when one leaves before the first move), and a 6-player game with the special build phase through one full round of build chances, each at 390x844 and 1440x900 in light and dark mode. Open the History dialog on the 6-player game and confirm the large board fits in it.
- [ ] **Step 3: Grep** for em-dashes: `git diff house-rules --name-only | LC_ALL=C.UTF-8 xargs grep -lP '\x{2014}'` prints nothing (Git Bash's grep refuses `-P` without a UTF-8 locale).
- [ ] **Step 4: Push and open the PR:** `git push -u origin catan-five-six`, then `gh pr create --base house-rules --title "Catan: 5 and 6 players, and the special build phase house rule"` with a body listing the extension contents, the special build decisions (cards bought in a chance play from the next turn, players under 2 cards and away players skipped, the rule stays on after dismissals), the seat colors, and the merge notes below, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Merge Notes

- **House rules Task 5 (Catan target score)** adds `CATAN_RULES` and `winningPoints(state)` in `state.ts` and puts `agreeAll` in `manager.test.ts`'s `gameWith`. This branch leaves `state.ts` alone (the phase's win guard is in `rules.ts` `settle`). On merge: `houseRules: [...CATAN_RULES, SPECIAL_BUILD]` (or append `SPECIAL_BUILD` to `CATAN_RULES`), and keep one `agreeAll` call in `gameWith`. With a target rule offered at every seat count, the agreement step is needed anyway.
- **House rules Task 13 (friendly robber, 2 players)** adds `PLAYERS = { minPlayers: 3, maxPlayers: 4, stretchedPlayers: { min: 2, max: 4 } }`. On merge it becomes `{ minPlayers: 3, maxPlayers: 6, stretchedPlayers: { min: 2, max: 6 } }` and replaces `MAX_PLAYERS`. Two players get the base board through `editionFor`. Its `robberVictims(state, seat, hex, cardCount)` change meets this branch's `'layout'` added to the same `Pick`. Its `MIN_PLAYERS` lines in `applyAction` and `onPlayerLeft` are near this branch's `withoutBuilder` line in `onPlayerLeft`, but not the same lines.
- **House rules Task 19** README player ranges: Catan is "three to six players (two with the override)".
- **Drag and drop Task 9 (`trayBlocker`)**: add one branch at the top, `if (state.specialBuild) return buildChance(state, state.viewer) ? buildBlocker(kind, state.hand, spots) : 'Not now';`, and in `GameScreen` the tray's `canLift` uses `(canMove || canBuild) && trayBlocker(...) === ''`. `targetsFor` already covers the phase. Its `buildButton` to `buildBlocker` switch goes inside this branch's `BuildButtons`. If the tray styles list seats, add `.seat5` and `.seat6`. Add one e2e: `the tray works during your special build chance`.
- **Preferences Task 8 (color-blind symbols)**: Catan's `SEAT_SYMBOLS` becomes `{ 1: 'red', 2: 'blue', 3: 'orange', 4: 'purple', 5: 'white', 6: 'green' }`.
