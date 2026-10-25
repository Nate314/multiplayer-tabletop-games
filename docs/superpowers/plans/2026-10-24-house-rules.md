# House Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first player to join sets per-game house rules (and, behind "I know what I'm doing", a table size outside the box range), every seated player agrees before the first move, the rules stay viewable all game, and the first set of rules works end to end in Chess, Monopoly, UNO, Scrabble, Mancala, Catan, Phase 10, Hearts, Rook and every game with a target score.

**Architecture:** A game declares `houseRules` and `stretchedPlayers` on its `GameInfo`; `shared/houseRules.ts` owns the pure model (validation, host, agreement, table limit) and the chosen values live in `BaseGameState.houseRules`, so the store, history, rejoin and game files carry them with no extra plumbing. The manager adds two messages (set, agree), blocks the first move until everyone agreed, lets a game accept an out-of-turn move through `allowsOutOfTurn`, and (in a later task) runs server-side deadlines for the timed rules. Each game reads its values with `houseRule(state, RULE)` inside its own rules.

**Tech Stack:** React 19, Vite 6, TypeScript 5.9, SCSS (sass), Express 5, `ws` 8, Node 22 (`node --test`, `node:sqlite`), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-house-rules-design.md`

## Global Constraints

- Work on a new branch `house-rules` created from `scss-migration` (PR #21); retarget the PR to `master` once #21 merges. Never commit to `master`.
- **The framework commit is the commit at the end of Task 3.** Push it (`git push -u origin house-rules`) as soon as it is made, so the Dominoes layouts and Catan special build phase branches can start from it. Tasks 1 to 3 change no game.
- No new runtime or dev dependencies.
- No em-dashes (U+2014) in prose, UI text, comments, READMEs, commit messages or the PR description.
- Server code (`server/`, `shared/`, `games/<id>/*.ts` outside `client/`) never imports `src/` or any `games/<id>/client/`. Each game's rule declarations live in its non-client files, since both the server and the browser read them through `GAMES`.
- Rule values from the host are untrusted: `setHouseRules` checks every key and value against the game's declarations.
- Every option's standard value is the game's current rule, except Mancala, whose two rules are both on by default.
- Copy (exact): header button "House rules"; panel title "House rules"; host line "<host> sets the house rules" (host sees "You set the house rules"); checkbox "I know what I'm doing"; number field "Most players"; button "Agree"; per player "<name>: agreed" / "<name>: waiting"; dialog marks a non-standard value with "(house rule)".
- Errors (exact): "Only the host can change the house rules", "The house rules are locked once play starts", "That is not a house rule of this game", "That value is not allowed for <label>", "Most players must be from <min> to <max>", "<n> players are already seated", "This game has no player-count override", "The house rules changed. Check them and agree again", "Everyone must agree to the house rules first", "Someone else moved first".
- Styles: platform pieces in `src/App.scss` wrapped in `:where()`, like the existing defaults; game pieces in the game's own `.scss`, nested under `[data-game="<id>"]`.
- Each changed game's README "Rules" and "Differences from Wikipedia" sections and its `client/faq.ts` cover its new options, in the same task as the rule.
- Browser checks (CLAUDE.md): every task that changes UI loads the page in Chrome at 390x844 and 1440x900, in light and dark mode, and checks for overlap, blank rows and misplaced controls before it is reported done.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A stale Agree.** The host changes a rule while a guest's Agree is in flight. The guest must not end up agreeing to rules they never saw: the agreement names the `revision` it saw and is refused when it is stale. Test in Task 1 (`agreeToHouseRules refuses a stale revision`) and Task 2 (manager).
2. **A hand-crafted proposal.** A non-host, a key the game does not declare, a string where a toggle goes, a value for a rule not offered at this seat count, `maxPlayers` of `4.5`, `"6"`, `1e9` or below the seated count. Each is refused and the state is unchanged. Test in Task 1.
3. **A restart with a clock running.** Saved `runningSince` is from before the restart, so a naive deadline is already past and the player would lose on load. `resumeClock` runs on every loaded room, so the downtime is never charged. Test in Task 6 (manager) and Task 7 (chess).
4. **A game saved before this change.** No `houseRules` field, and for Rook no `teams` and two-entry scores. It loads, plays on with standard rules, and its history and game file still build. Test in Task 2 (platform) and Task 16 (Rook).
5. **Mancala with both rules on never ends.** Sowing from the opponent's side plus avalanche relays must still finish, and the game must end only when every pit is empty. Test in Task 12 with seeded random playouts.

---

## File Structure

- `shared/houseRules.ts` (new): rule declaration types, `HouseRulesState`, every pure function of the model. `shared/houseRules.test.ts` (new).
- `shared/gameDefinition.ts`: `GameInfo.houseRules`, `GameInfo.stretchedPlayers`, `GameDefinition.allowsOutOfTurn`; later (Task 6) the clock hooks and `now`.
- `shared/types.ts`: `BaseGameState.houseRules`; later `BasePublicState.serverTime`.
- `shared/seating.ts`: table limit, start minimum, host and agreement upkeep on join and leave, out-of-turn check.
- `shared/messages.ts`: `SET_HOUSE_RULES`, `AGREE_HOUSE_RULES`, `moveCount` on `MAKE_MOVE`.
- `shared/testGame.ts`: `rulesGame`, a test game with rules and a stretched range; later `timedGame`.
- `server/games.ts`, `server/server.ts`, `server/testing.ts`: manager methods, routing, `agreeAll`.
- `src/services/gameService.ts`, `src/components/HouseRulesPanel.tsx` (new), `HouseRulesButton.tsx` (new), `HouseRulesDialog.tsx` (new), `GameView.tsx`, `src/App.scss`.
- `src/hooks/useCountdown.ts` (new, Task 6).
- `e2e/fixtures.ts`, `e2e/houseRules.spec.ts` (new, Task 4).
- Each game's `rules.ts` (or the file holding the changed rule), `index.ts`, `types.ts`, `client/*`, `README.md`, `client/faq.ts`, tests.
- `docs/architecture.md`, `README.md`.

---

### Task 1: The house rules model

**Files:**
- Create: `shared/houseRules.ts`, `shared/houseRules.test.ts`
- Modify: `shared/gameDefinition.ts` (`GameInfo`), `shared/types.ts` (`BaseGameState`), `shared/testGame.ts` (add `rulesGame`)

**Interfaces:**
- Consumes: `GameInfo`, `BaseGameState`, `Seat`, `Result`, `asRecord`.
- Produces (other plans are written against these names; do not rename):

```ts
// shared/houseRules.ts
export type HouseRuleValue = boolean | string | number;
export type HouseRuleValues = Record<string, HouseRuleValue>;
export type PlayerRange = { min: number; max: number };

type HouseRuleBase = {
  id: string;     // key in HouseRuleValues, unique within the game
  label: string;  // form and dialog label, e.g. 'Free Parking jackpot'
  help?: string;  // one line under the control
  // Offered at this seat count and with these other values; omitted means always offered
  offered?(seats: number, values: HouseRuleValues): boolean;
};
export type ToggleRule = HouseRuleBase & { kind: 'toggle'; standard: boolean };
export type ChoiceRule<V extends string | number = string | number> =
  HouseRuleBase & { kind: 'choice'; standard: V; choices: { value: V; label: string }[] };
export type HouseRule = ToggleRule | ChoiceRule;

export type HouseRulesState = {
  host: Seat | null;
  values: HouseRuleValues;   // exactly the rules offered at the current seat count
  override: boolean;         // "I know what I'm doing" is ticked
  maxPlayers: number | null; // the table size while override is on, else null
  agreed: Seat[];            // sorted ascending
  revision: number;          // bumped by every change; an agreement must name the current one
};
export type HouseRulesProposal = { values: HouseRuleValues; override: boolean; maxPlayers: number | null };
export type HouseRuleLine = { label: string; value: string; standard: boolean };
export type RulesInfo = Pick<GameInfo, 'minPlayers' | 'maxPlayers' | 'houseRules' | 'stretchedPlayers'>;

export function needsAgreement(info: RulesInfo): boolean;
export function houseRulesOf(info: RulesInfo, state: Pick<BaseGameState, 'houseRules' | 'activePlayers'>): HouseRulesState;
export function houseRule(state: Pick<BaseGameState, 'houseRules'>, rule: ToggleRule): boolean;
export function houseRule<V extends string | number>(state: Pick<BaseGameState, 'houseRules'>, rule: ChoiceRule<V>): V;
export function tableLimit(info: RulesInfo, state: Pick<BaseGameState, 'houseRules'>): number;
export function minimumToStart(info: RulesInfo, state: Pick<BaseGameState, 'houseRules'>): number;
export function afterSeatChange(info: RulesInfo, rules: HouseRulesState | undefined, seats: Seat[]): HouseRulesState;
export function setHouseRules<S extends BaseGameState>(info: RulesInfo, state: S, seat: Seat, proposal: unknown): Result<S>;
export function agreeToHouseRules<S extends BaseGameState>(info: RulesInfo, state: S, seat: Seat, revision: unknown): Result<S>;
export function everyoneAgreed(info: RulesInfo, state: BaseGameState): boolean;
export function describeHouseRules(info: RulesInfo, rules: HouseRulesState): HouseRuleLine[];
export function targetScoreRule(standard: number, others: number[], label?: string): ChoiceRule<number>; // id 'targetScore'

// shared/gameDefinition.ts, GameInfo gains
houseRules?: HouseRule[];
stretchedPlayers?: PlayerRange; // allowed with "I know what I'm doing"; contains minPlayers..maxPlayers

// shared/types.ts, BaseGameState gains
houseRules?: HouseRulesState; // missing in games saved before house rules; read through houseRulesOf / houseRule

// shared/testGame.ts
export const rulesGame: GameDefinition<TestState, TestPublicState>;
// testGame with: minPlayers 2, maxPlayers 4, stretchedPlayers { min: 2, max: 6 }, and rules
// { id: 'fast', kind: 'toggle', standard: false },
// { id: 'goal', kind: 'choice', standard: 3, choices: 3, 5 },
// { id: 'big', kind: 'toggle', standard: false, offered: seats => seats >= 3 },
// { id: 'bigger', kind: 'toggle', standard: false, offered: (seats, values) => seats >= 3 && values.big === true }
```

Behavior the tests pin:
- `needsAgreement` is false only when `houseRules` is empty or missing and `stretchedPlayers` is missing.
- `houseRulesOf` returns `state.houseRules` or, when missing, `{ host: activePlayers[0] ?? null, values: standard values at that seat count, override: false, maxPlayers: null, agreed: [], revision: 0 }`.
- `houseRule` returns `values[rule.id]` when present, else `rule.standard`.
- `tableLimit` is `maxPlayers` when override is on, else `info.maxPlayers`. `minimumToStart` is `stretchedPlayers.min` when override is on, else `info.minPlayers`.
- `afterSeatChange`: clears `agreed`, bumps `revision`, keeps the host if still seated, else the first seat above the old host, wrapping to the lowest; a missing host becomes `seats[0]`. Values are re-normalized for `seats.length`: rules no longer offered are removed, newly offered ones get their standard value, kept ones keep the host's choice.
- `setHouseRules` checks in this order: started, host, override allowed, each key declared and offered, each value's type and membership, `maxPlayers` an integer in the stretched range and not below the seated count, override off with more seated than `info.maxPlayers`. A key missing from the proposal keeps its current value. On success: values normalized, `agreed: []`, `revision + 1`, `gameStatus: '<host> changed the house rules'`.
- `agreeToHouseRules` refuses after start, refuses a `revision` that is not the current number, is idempotent for a seat that already agreed, sets `gameStatus: '<name> agreed to the house rules'`.
- `describeHouseRules` lists offered rules in declaration order (value label from `choices`, "On"/"Off" for toggles), then, with override, `{ label: 'Most players', value: String(maxPlayers), standard: false }`.

- [ ] **Step 1: Write the failing tests** in `shared/houseRules.test.ts`, style of `shared/seating.test.ts` (`node:test`, `assert/strict`), using `rulesGame.info`, building lobby states with `afterSeatChange` directly (seating is wired up in Task 2):

```ts
test('needsAgreement is false only for a game with no rules and no stretched range', () => {
  assert.equal(needsAgreement(testGame.info), false);
  assert.equal(needsAgreement(rulesGame.info), true);
  assert.equal(needsAgreement({ ...testGame.info, stretchedPlayers: { min: 2, max: 6 } }), true);
});
test('houseRule falls back to the standard value for a state saved before house rules', () => {
  assert.equal(houseRule({}, FAST), false);
  assert.equal(houseRule({}, GOAL), 3);
});
test('afterSeatChange gives the first seat the host and keeps the host while seated', ...);
test('afterSeatChange moves a departed host to the next seat in seat order, wrapping', () => {
  // host 3 leaves seats [1, 2, 3, 4] -> host 4; host 4 leaves [1, 2, 4] -> host 1
});
test('afterSeatChange clears every agreement and bumps the revision', ...);
test('afterSeatChange adds a rule offered at the new seat count and drops one no longer offered', () => {
  // 2 seats: values has fast, goal only; 3 seats: big appears as false; back to 2: big gone
});
test('setHouseRules refuses everyone but the host', () => assert.deepEqual(result, { error: 'Only the host can change the house rules' }));
test('setHouseRules refuses after the first move', () => /* 'The house rules are locked once play starts' */);
test('setHouseRules refuses an undeclared key, a wrong type and a value not in the choices', () => {
  // { values: { nope: true } } -> 'That is not a house rule of this game'
  // { values: { fast: 'yes' } } -> 'That value is not allowed for Fast'
  // { values: { goal: 4 } } -> 'That value is not allowed for Goal'
});
test('setHouseRules refuses a rule not offered at this seat count', () => /* big at 2 seats -> 'That is not a house rule of this game' */);
test('setHouseRules checks the table size', () => {
  // override on testGame.info -> 'This game has no player-count override'
  // maxPlayers 7, 4.5, '6', 1e9 -> 'Most players must be from 2 to 6'
  // 3 seated, maxPlayers 2 -> '3 players are already seated'
  // 5 seated (override on, max 6), override off -> '5 players are already seated'
});
test('setHouseRules keeps unsent values, clears agreements and bumps the revision', ...);
test('agreeToHouseRules refuses a stale revision', () =>
  assert.deepEqual(agreeToHouseRules(info, state, 2, state.houseRules.revision - 1), { error: 'The house rules changed. Check them and agree again' }));
test('agreeToHouseRules is idempotent and everyoneAgreed waits for every seat', ...);
test('tableLimit and minimumToStart follow the override', () => {
  // off: 4 and 2; on with maxPlayers 6: 6 and 2 (stretched min)
});
test('describeHouseRules marks non-standard values and lists the table size with the override', () => {
  assert.deepEqual(describeHouseRules(rulesGame.info, rules), [
    { label: 'Fast', value: 'On', standard: false },
    { label: 'Goal', value: '3', standard: true },
    { label: 'Most players', value: '6', standard: false }
  ]);
});
test('targetScoreRule offers the standard target among the others, sorted', () => {
  const rule = targetScoreRule(500, [250, 1000]);
  assert.equal(rule.id, 'targetScore');
  assert.deepEqual(rule.choices.map(choice => choice.value), [250, 500, 1000]);
  assert.equal(rule.standard, 500);
});
```

- [ ] **Step 2: Run** `node --test shared/houseRules.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the types and functions above in `shared/houseRules.ts`, the `GameInfo` and `BaseGameState` fields, and `rulesGame` in `shared/testGame.ts` (spread `testGame`, override `info`). Use `asRecord` to read the proposal. `targetScoreRule` labels values with `toLocaleString('en-US')` (so 10000 reads "10,000").
- [ ] **Step 4: Run** `node --test shared/houseRules.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `git add shared && git commit -m "Add the house rules model"` (with the trailer).

---

### Task 2: Seating, manager, messages and persistence

**Files:**
- Modify: `shared/gameDefinition.ts` (`allowsOutOfTurn`), `shared/seating.ts` (`addPlayer`, `removePlayer`, `applyMove`), `shared/messages.ts`, `server/games.ts`, `server/server.ts`, `server/testing.ts`
- Test: `shared/seating.test.ts`, `server/games.test.ts`, `server/store.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:

```ts
// shared/gameDefinition.ts, GameDefinition gains
// Called only when `seat` is not currentPlayer, after every other turn guard passed. True lets applyMove run for this
// out-of-turn move, which is recorded for undo like any other. Validates untrusted `move`.
allowsOutOfTurn?(state: S, seat: Seat, move: unknown): boolean;

// shared/messages.ts
MESSAGE_TYPES.SET_HOUSE_RULES = 'SET_HOUSE_RULES'
MESSAGE_TYPES.AGREE_HOUSE_RULES = 'AGREE_HOUSE_RULES'
| { type: typeof MESSAGE_TYPES.SET_HOUSE_RULES; payload: { proposal: HouseRulesProposal } }
| { type: typeof MESSAGE_TYPES.AGREE_HOUSE_RULES; payload: { revision: number } }
| { type: typeof MESSAGE_TYPES.MAKE_MOVE; payload: { move: unknown; moveCount?: number } } // moveCount: the count the mover saw

// server/games.ts, the manager gains
setHouseRules(roomId: string, seat: Seat, proposal: unknown): Result<BasePublicState>;  // then game.resetLobby
agreeHouseRules(roomId: string, seat: Seat, revision: unknown): Result<BasePublicState>;
move(roomId: string, seat: Seat, move: unknown, moveCount?: unknown): Result<BasePublicState>;

// server/testing.ts
export function agreeAll(manager: Manager, roomId: string): void; // every seated player agrees to the current revision
```

Behavior:
- `addPlayer` refuses at `tableLimit(info, state)` ("Game is full"), writes `(<n>/<limit> players)` in the status, and sets `houseRules: afterSeatChange(...)`. `removePlayer` before the first move does the same. After the first move neither touches `houseRules`.
- `applyMove` uses `minimumToStart` instead of `info.minPlayers`, and replaces the turn guard with `state.currentPlayer !== seat && !game.allowsOutOfTurn?.(state, seat, move)`.
- `manager.move` refuses `'Everyone must agree to the house rules first'` when `!state.started && !everyoneAgreed(info, state)` (this guard lives in the manager, not `seating.applyMove`, so the rules tests that drive `seating.applyMove` directly need no change), and refuses `'Someone else moved first'` when `moveCount !== undefined && moveCount !== room.timeline.length`.
- `publicView` always adds `houseRules: houseRulesOf(game.info, state)`, so history steps, game files and every live view carry the rules whatever the game's `toPublicState` does.
- `setHouseRules` and `agreeHouseRules` save the room (a lobby is still not stored, by the existing `save`).

- [ ] **Step 1: Write the failing tests.**

`shared/seating.test.ts` (use `rulesGame`):
```ts
test('the first player to join is the host', ...);              // houseRules.host === 1
test('a join or a leave before the first move clears every agreement', ...);
test('the host leaving before the first move passes the host to the next seat and keeps the choices', ...);
test('the table is full at the chosen most players', () => {
  // override on, maxPlayers 5: the 5th join succeeds with '(5/5 players)', the 6th fails 'Game is full'
});
test('with the override a game starts at the stretched minimum', ...); // rulesGame with stretched { min: 1, ... } variant
test('an out-of-turn move needs the game to allow it', () => {
  // game without allowsOutOfTurn: 'Not your turn'; with allowsOutOfTurn returning true for { type: 'tick' }: applied
});
```

`server/games.test.ts` (new `rulesManager()` helper over `rulesGame` with `rememberingKeys`):
```ts
test('a move before everyone agreed is refused', () => {
  assert.deepEqual(manager.move(ROOM, 1, tick), { error: 'Everyone must agree to the house rules first' });
});
test('the move goes through once every seated player agreed', ...);
test('a game with no house rules and no override needs no agreement', ...); // testGame, unchanged existing behavior
test('only the host may set the house rules and a change clears the agreements', ...);
test('an agreement to an old revision is refused after the host changed the rules', ...); // Review Focus 1
test('a move that names an old move count is refused', () => {
  assert.deepEqual(manager.move(ROOM, 2, tick, 0), { error: 'Someone else moved first' }); // after one move
});
test('every view, history step and game file step carries the house rules', ...);
test('a game saved without house rules loads, plays and builds its history', ...); // Review Focus 4: SavedRoom state without houseRules
test('the house rules survive a restart', ...); // store round trip through openGameStore(':memory:')
```

- [ ] **Step 2: Run** `node --test shared/seating.test.ts server/games.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the seating changes, `allowsOutOfTurn`, the message types, the manager methods, `publicView`, the `server.ts` routing (`SET_HOUSE_RULES` to `manager.setHouseRules(roomId, seat, payload?.proposal)`, `AGREE_HOUSE_RULES` to `manager.agreeHouseRules(roomId, seat, payload?.revision)`, `MAKE_MOVE` passes `payload?.moveCount`), and `agreeAll` in `server/testing.ts`.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS (no game declares rules yet, so no game test changes).
- [ ] **Step 5: Commit** `git commit -m "Seat, host and agree to house rules on the server"`.

---

### Task 3: Lobby form, agreement, House rules dialog (THE FRAMEWORK COMMIT)

**Files:**
- Create: `src/components/HouseRulesPanel.tsx`, `src/components/HouseRulesButton.tsx`, `src/components/HouseRulesDialog.tsx`
- Modify: `src/services/gameService.ts`, `src/components/GameView.tsx`, `src/App.scss`, `e2e/fixtures.ts`, `docs/architecture.md`, `README.md` (the "How to play" platform list near line 77)

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces:

```ts
// src/services/gameService.ts
setHouseRules(proposal: HouseRulesProposal): void;
agreeHouseRules(revision: number): void;
makeMove(move: unknown, moveCount?: number): void; // moveCount only for out-of-turn moves

// src/components
export default function HouseRulesPanel(props: { game: GameInfo; gameState: BasePublicState; playerNumber: Seat }): JSX.Element;
export default function HouseRulesButton(props: { game: GameInfo; gameState: BasePublicState }): JSX.Element | null;
export default function HouseRulesDialog(props: { game: GameInfo; rules: HouseRulesState; onClose: () => void }): JSX.Element;

// e2e/fixtures.ts
export type SeatOptions = { gameId?: string; motion?: boolean; agree?: boolean; houseRules?: HouseRuleValues; maxPlayers?: number };
export async function setHouseRules(page: Page, gameType: string, values: HouseRuleValues, maxPlayers?: number): Promise<void>;
export async function agreeToHouseRules(...pages: Page[]): Promise<void>;
```

Behavior:
- `GameView` renders `HouseRulesPanel` between `PresenceBar` and `Screen` while `!gameState.started && needsAgreement(game)`, and `HouseRulesButton` in the header after the FAQ button whenever `needsAgreement(game)`.
- The panel: title, host line, one control per rule in `values` (toggle: checkbox; choice: select; label from the declaration, `help` under it), then, with `stretchedPlayers`, the "I know what I'm doing" checkbox and, while ticked, "Most players" (`input type="number"`, `min` = max(seated, stretched.min), `max` = stretched.max). Every control is disabled for everyone but the host. Each host change sends the whole proposal at once. Below: each seated player "<name>: agreed" or "<name>: waiting", and an "Agree" button for a player not yet agreed, which sends `gameState.houseRules.revision`. When everyone agreed the list stays and the button is gone.
- The dialog (class `.modal.house-rules`, `role="dialog"`, name "House rules", closes on Escape through `useEscapeKey` and a Close button) lists `describeHouseRules`, appending " (house rule)" to non-standard values.
- Fixtures: `seat()` joins the first name, calls `setHouseRules(host, ...)` when `houseRules` or `maxPlayers` is given, joins the rest, then, unless `agree: false`, calls `agreeToHouseRules` on every page when `needsAgreement` for that game. `table.join(name)` agrees everyone again afterwards (a join clears agreements). `setHouseRules` sets controls by their labels (`getByLabel(rule.label)`; check/uncheck or `selectOption`), and for `maxPlayers` ticks "I know what I'm doing" and fills "Most players". `agreeToHouseRules` clicks "Agree" on each page and waits for its own "<name>: agreed".
- `docs/architecture.md`: platform list (host, vote, dialog, override, out-of-turn moves), Contracts (`shared/houseRules.ts` and its exports, the new `GameInfo` and `GameDefinition` fields), Communication Flow (a "House rules" section with both messages and `moveCount`), the App.scss class list.

- [ ] **Step 1: Implement** the service methods, the three components, the `GameView` wiring and the `:where()` styles in `src/App.scss` (`.house-rules`, `.house-rules-panel`, `.house-rules-title`, `.house-rules-host`, `.house-rules-list`, `.house-rules-agreed`, `.house-rules-actions`, `.house-rules-button`), reusing `--platform-panel-bg` and friends.
- [ ] **Step 2: Update** `e2e/fixtures.ts` as above, `docs/architecture.md` and the README platform list.
- [ ] **Step 3: Run** `npm run lint && npm test && npm run build && npm run test:e2e`. Expected: all PASS; no game declares rules yet, so the fixture agrees nowhere and every existing spec behaves as before.
- [ ] **Step 4: Browser check what can be checked now:** open Chess and UNO in Chrome at both widths and both themes and confirm the header is unchanged (no House rules button, no panel). The form itself is browser-checked in Task 4, the first task that declares a rule.
- [ ] **Step 5: Commit and push the framework commit.**

```bash
git add src e2e docs README.md
git commit -m "House rules framework: options, host, agreement, dialog and player-count override"
git push -u origin house-rules
```

---

### Task 4: Target score and override in Farkle, and the lobby flow end to end

**Files:**
- Modify: `games/farkle/rules.ts`, `games/farkle/index.ts`, `games/farkle/client/GameScreen.tsx`, `games/farkle/client/Table.tsx`, `games/farkle/README.md`, `games/farkle/client/faq.ts`, `games/farkle/manager.test.ts` (`agreeAll` in its seating helpers)
- Create: `e2e/houseRules.spec.ts`
- Test: `games/farkle/rules.test.ts`, `e2e/farkle.spec.ts`

**Interfaces:**
- Consumes: `targetScoreRule`, `houseRule`, `agreeAll`, fixtures from Task 3.
- Produces: `export const FARKLE_RULES: HouseRule[]` and `export function targetScore(state: Pick<GameState, 'houseRules'>): number` in `games/farkle/rules.ts`; every use of `TARGET_SCORE` (rules and client) reads `targetScore(state)` instead. This `targetScore(state)` pattern is repeated in Task 5.

Values: Farkle `targetScoreRule(10000, [5000, 15000, 20000])`; `stretchedPlayers: { min: 2, max: 10 }`.

- [ ] **Step 1: Write the failing tests.**
  - `games/farkle/rules.test.ts`: `test('the game ends at the target score the host chose', ...)` (state with `houseRules.values.targetScore = 5000`, banking past 5000 ends the game; at the standard rule 5000 does not); `test('ten players can play a full game', ...)` (seeded random playout to game over with 10 seats).
  - `e2e/houseRules.spec.ts` (Farkle, `seat('farkle', [...], { agree: false })`):
    - `the host edits the form and everyone else sees it read-only, live`
    - `nobody can roll until every player agreed`
    - `a change by the host clears every agreement`
    - `a player joining clears every agreement`
    - `the host leaving passes the form to the next player with the choices kept`
    - `the override lets more players join, and cannot go below the players seated`
    - `the House rules dialog shows the chosen rules all game, the house rule marked` (also after a page reload, which rejoins)
  - `e2e/farkle.spec.ts`: `test('a game to 5,000 ends at 5,000', ...)` with `{ houseRules: { targetScore: 5000 } }`.
- [ ] **Step 2: Run** `node --test games/farkle/rules.test.ts` and `npx playwright test e2e/houseRules.spec.ts e2e/farkle.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `FARKLE_RULES`, `targetScore`, `info.houseRules` and `info.stretchedPlayers`, the client reads, README and FAQ (the target rule, the 10-player override). Fix any Farkle layout that assumes at most 8 seats.
- [ ] **Step 4: Run** `npm test` and the two specs. Expected: PASS.
- [ ] **Step 5: Browser check** the lobby panel (host and guest views, with the override open) and the House rules dialog at 390x844 and 1440x900 in light and dark mode, plus a 10-player Farkle table.
- [ ] **Step 6: Commit** `git commit -m "Farkle: adjustable target and up to 10 players; lobby flow e2e"`.

---

### Task 5: Adjustable target scores in every other game with one

**Files (each game: `rules.ts`, `index.ts`, the client files listed, `README.md`, `client/faq.ts`, `rules.test.ts`, `manager.test.ts` helpers, one e2e test):**
- UNO: `games/uno/rules.ts`, `client/RoundSummary.tsx`, `client/Table.tsx`
- Spades: `games/spades/rules.ts`, `client/RoundSummary.tsx`, `client/Table.tsx`
- Hearts: `games/hearts/rules.ts`, `client/RoundSummary.tsx`, `client/Table.tsx`
- Rook: `games/rook/rules.ts`, `client/RoundSummary.tsx`, `client/Table.tsx`
- Euchre: `games/euchre/rules.ts`, `client/RoundSummary.tsx`, `client/Table.tsx`
- Rack-O: `games/racko/rules.ts`, `client/RoundSummary.tsx`
- Dominoes: `games/dominoes/rules.ts`, `client/RoundSummary.tsx`, `client/Table.tsx`
- Splendor: `games/splendor/rules.ts` (`WINNING_PRESTIGE`)
- Catan: `games/catan/state.ts` (`WINNING_POINTS`, `checkWin`)

**Interfaces:**
- Consumes: `targetScoreRule`, `houseRule`, `agreeAll`, the `targetScore(state)` pattern from Task 4.
- Produces: per game `export const <GAME>_RULES: HouseRule[]` (UNO_RULES, SPADES_RULES, ...) and `targetScore(state)`; Splendor `winningPrestige(state)`, Catan `winningPoints(state)`. Later tasks append their rules to these arrays.

Choices (standard first): UNO 500 of [250, 500, 1000]; Spades 500 of [250, 300, 500] (the -200 loss stays); Hearts 100 of [50, 75, 100, 150]; Rook 500 of [300, 500, 1000]; Euchre 10 of [5, 10, 15]; Rack-O 500 of [250, 500, 1000]; Splendor 15 of [10, 15, 21] labelled "Prestige to win"; Catan 10 of [8, 10, 12] labelled "Points to win". Dominoes is a choice rule (not `targetScoreRule`) with id `targetScore`: `'standard'` labelled "100 for 2 players, 61 for 3 or 4" (standard), then 61, 100, 150, 200; `targetScore(state)` returns the existing `targetScore(players)` for `'standard'`.

- [ ] **Step 1: Write the failing tests:** one rules test per game, named `the game ends at the chosen target`, that ends a round or turn just past a non-standard target and asserts `isGameOver`, and asserts the standard target does not end it. Dominoes adds `the standard target is still 100 for two players and 61 for three`.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL, and every `manager.test.ts` of these games FAILS on "Everyone must agree to the house rules first" once Step 3 declares the rules.
- [ ] **Step 3: Implement** each game's rule and reads; in each game's `manager.test.ts`, call `agreeAll(manager, ROOM)` after the joins in every helper that seats players. Update READMEs (the "first team to 500" style sentences say "500 unless the host chose another target") and FAQs.
- [ ] **Step 4: Add one e2e test per game** in its existing spec, `the host can set a lower target`, seated with `{ houseRules: { targetScore: <low> } }`, patching scores just under it and finishing one round in the browser.
- [ ] **Step 5: Run** `npm test` and `npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Browser check** one round summary per game at both widths and themes (the target text must fit).
- [ ] **Step 7: Commit** `git commit -m "Adjustable target scores"`.

---

### Task 6: Platform: server-side deadlines for timed rules

**Files:**
- Modify: `shared/gameDefinition.ts`, `shared/types.ts`, `shared/seating.ts` (`applyMove`), `shared/testGame.ts` (add `timedGame`), `server/games.ts`, `server/server.ts`, `docs/architecture.md`
- Create: `src/hooks/useCountdown.ts`, `src/hooks/useCountdown.test.ts`
- Test: `server/games.test.ts`, `shared/seating.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:

```ts
// shared/gameDefinition.ts
applyMove(state: S, seat: Seat, move: unknown, random: Random, now: number): Result<S>; // now: server ms; existing games ignore it
deadline?(state: S): number | null;               // server ms when onDeadline must run; null for none
onDeadline?(state: S, now: number, random: Random): S; // recorded as a move by currentPlayer, so it can be undone
resumeClock?(state: S, now: number): S;           // when everyone has agreed, after an approved undo, and on load after a restart

// shared/seating.ts
applyMove(game, state, seat, move, random = Math.random, now = Date.now())

// server/games.ts
export type ManagerHooks = { now?: () => number; changed?: (roomId: string) => void };
createGameManager(games, random = Math.random, store?: GameStore, hooks: ManagerHooks = {})

// shared/types.ts, BasePublicState gains
serverTime?: number; // only on live views, for client countdowns

// src/hooks/useCountdown.ts
export function useCountdown(deadline: number | null, serverTime: number | undefined): number | null; // ms left, re-rendering every 250 ms
export function formatClock(ms: number): string; // 'm:ss', never below '0:00'
```

Behavior: the manager keeps one `setTimeout` per room (`unref`), rescheduled in `save` from `game.deadline(state)` (none once the game is over; open votes and disconnects do not pause it), cleared in `deleteRoom`. When it fires and `deadline(state) <= now()`, the manager pushes a history step with `onDeadline`'s state (`started: true`), saves, and calls `hooks.changed(roomId)`. `server.ts` passes `{ changed: broadcast }`. `agreeHouseRules` runs `resumeClock` once everyone has agreed; `resolveUndoVote` runs it after `onUndo`; `loadRoom` runs it on every loaded room.

- [ ] **Step 1: Write the failing tests** in `server/games.test.ts` with `t.mock.timers.enable({ apis: ['setTimeout'] })` and a `now` hook the test advances. `timedGame` is `rulesGame` plus a 1000 ms turn deadline whose `onDeadline` passes the turn:
  - `a deadline passing makes the game's timeout move and tells the server`
  - `a timeout is a move and can be undone`
  - `the clock starts when everyone has agreed` (`resumeClock` called once, on the last agreement)
  - `an undo restarts the clock from the moment of the undo`
  - `a restart does not charge the time the server was down` (Review Focus 3: saved deadline in the past; after load, no timeout until 1000 ms after load)
  - `a deleted room's deadline never fires`
  - `src/hooks/useCountdown.test.ts`: `formatClock` cases 0, 999, 61000, 600000, -5.
- [ ] **Step 2: Run** `node --test server/games.test.ts src/hooks/useCountdown.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the hooks, scheduling, `now` threading and `serverTime` (added in `view()` only, not history).
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Server-side deadlines for timed house rules"`.

---

### Task 7: Chess clock

**Files:**
- Modify: `games/chess/rules.ts`, `games/chess/types.ts`, `games/chess/index.ts`, `games/chess/client/GameScreen.tsx` (and the file showing each player's name), `games/chess/client/chess.scss`, `games/chess/README.md`, `games/chess/client/faq.ts`, `games/chess/manager.test.ts`
- Test: `games/chess/rules.test.ts`, `e2e/chess.spec.ts`

**Interfaces:**
- Consumes: Task 6 hooks, `houseRule`, `useCountdown`, `formatClock`.
- Produces: `export const CLOCK_MINUTES: ChoiceRule<'off' | 5 | 10 | 15>` (id `clockMinutes`, standard `'off'`, labels "Off", "5 minutes", "10 minutes", "15 minutes"), `export const INCREMENT_SECONDS: ChoiceRule<0 | 2 | 5 | 10>` (id `incrementSeconds`, standard 0, `offered: (_, values) => values.clockMinutes !== 'off'`), `export type ChessClock = { remainingMs: Record<Seat, number>; runningSince: number | null }`, `GameState.clock: ChessClock | null`, and `deadline`, `onDeadline`, `resumeClock` on `chess`.

Decisions (write into the README): the clock starts when both players have agreed, with White's time running; each move charges the mover the time since `runningSince`, then adds the increment; a move that arrives after the mover's time ran out is refused as a loss on time; running out loses ("<name> ran out of time. <other> wins!"), as the spec says, even when the opponent could not checkmate; the clock keeps running through disconnects and votes; **undo** puts both clocks back to what they showed when the undone move's turn began and restarts the running clock from the moment of the undo, so time spent on an undone move is given back; a server restart does not charge the downtime; the clock stops at game over (resign, draw, mate).

- [ ] **Step 1: Write the failing tests** (`rules.test.ts`, times as numbers passed to `applyMove`/`onDeadline`/`resumeClock`):
  - `with the clock off there is no deadline`
  - `the clock starts with White's time when everyone has agreed`
  - `a move charges the mover and adds the increment` (5 min, 2 s: White moves after 10 s, `remainingMs[1] === 300000 - 10000 + 2000`)
  - `running out of time loses`
  - `a move after the time ran out is refused as a loss on time`
  - `the increment is offered only with the clock on` (`describeHouseRules` at clock off has no increment line)
  - `a game over stops the clock` (`deadline` null after mate and after resign)
  - e2e `chess.spec.ts`: `a player whose clock runs out loses` (seat with `{ houseRules: { clockMinutes: 5 } }`, patch `clock.runningSince` 301 s into the past), `the clock shows each player's time`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the rules and a clock display next to each player (`.chess-clock`, the running one highlighted, under `[data-game="chess"]`); update `manager.test.ts` helpers with `agreeAll`.
- [ ] **Step 4: Run** `npm test` and `npx playwright test e2e/chess.spec.ts`. Expected: PASS.
- [ ] **Step 5: Browser check** both clocks at both widths and themes, and that the countdown keeps ticking after a page reload.
- [ ] **Step 6: Commit** `git commit -m "Chess: optional clock with increment"`.

---

### Task 8: Scrabble turn timer

**Files:**
- Modify: `games/scrabble/rules.ts`, `games/scrabble/types.ts`, `games/scrabble/index.ts`, `games/scrabble/client/PlayArea.tsx`, `games/scrabble/client/GameStatus.tsx`, `games/scrabble/client/describeMove.ts`, `games/scrabble/client/scrabble.scss`, `games/scrabble/README.md`, `games/scrabble/client/faq.ts`, `games/scrabble/manager.test.ts`
- Test: `games/scrabble/rules.test.ts`, `games/scrabble/client/describeMove.test.ts`, `e2e/scrabble.spec.ts`

**Interfaces:**
- Consumes: Task 6.
- Produces: `export const TURN_MINUTES: ChoiceRule<'off' | 1 | 2 | 3 | 5>` (id `turnMinutes`, standard `'off'`), `GameState.turnStartedAt: number | null`, `LastMove` pass gains `timedOut?: true`, and `deadline`, `onDeadline`, `resumeClock` on `scrabble`.

Decisions (README): the timer starts when everyone has agreed and again at every turn; when it runs out the turn passes and counts as a scoreless turn (so it counts toward the six-scoreless-turns ending); tiles placed on the board but not played go back to the rack (they are only in the browser, so `PlayArea` clears `pending` when `currentPlayer` changes); undo gives the restored turn a full timer from the moment of the undo; a restart restarts the current turn's timer.

- [ ] **Step 1: Write the failing tests:** `the turn passes when the timer runs out`, `a timed-out turn counts as scoreless`, `each turn gets the full time`, `with the timer off there is no deadline`; `describeMove` `'Alice ran out of time'`; e2e `tiles placed when the time runs out go back to the rack and the turn passes`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, with the countdown in `GameStatus` (`.turn-timer`).
- [ ] **Step 4: Run** `npm test` and `npx playwright test e2e/scrabble.spec.ts`. Expected: PASS.
- [ ] **Step 5: Browser check** at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "Scrabble: optional turn timer"`.

---

### Task 9: Monopoly: Free Parking jackpot, $400 on GO, auctions on or off

**Files:**
- Modify: `games/monopoly/types.ts` (`Debt`, `GameState`), `games/monopoly/money.ts`, `games/monopoly/movement.ts` (`landOn`, `moveTo`, card payments in `drawCard`), `games/monopoly/rules.ts` (`decline`, lobby state), `games/monopoly/bankruptcy.ts` (auction queue), `games/monopoly/index.ts`, the client board/status files that show the bank, `games/monopoly/client/monopoly.scss`, README, FAQ, `games/monopoly/manager.test.ts`
- Test: `games/monopoly/rules.test.ts`, `e2e/monopoly.spec.ts`

**Interfaces:**
- Produces: `export const MONOPOLY_RULES: HouseRule[]` with toggles `freeParkingJackpot` ("Free Parking jackpot", standard false), `goBonus` ("$400 for landing exactly on GO", standard false), `auctions` ("Auctions", standard true); `GameState.freeParkingPot: number` (0 in old saved games: read with `?? 0`); `Debt.toPot?: true`; `charge(state, debtor, creditor, amount, reason, toPot?: boolean)`.

Decisions (README): money into the pot is the tax spaces, Chance and Community Chest payments to the bank, and the $50 jail fine; purchases, building, unmortgaging and auction bids still go to the bank; a debt to the pot left unpaid by a bankruptcy is lost; landing on Free Parking takes the whole pot. Landing exactly on GO, by dice or by "Advance to GO", collects $400 in all. With auctions off, a declined property stays with the bank, and a bankrupt player's properties go back to the bank unowned.

- [ ] **Step 1: Write the failing tests:** `taxes, card fees and the jail fine go into the pot with the jackpot on`, `landing on Free Parking collects the pot`, `with the jackpot off Free Parking pays nothing and taxes go to the bank`, `landing exactly on GO pays $400 with the rule on and $200 off`, `passing GO still pays $200 with the rule on`, `with auctions off a declined property stays with the bank`, `with auctions off a bankrupt player's properties return to the bank unowned`; e2e `the Free Parking pot is shown and collected`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, showing the pot on the Free Parking space when the rule is on.
- [ ] **Step 4: Run** `npm test` and the spec. Expected: PASS.
- [ ] **Step 5: Browser check** the pot display at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "Monopoly house rules"`.

---

### Task 10: UNO: stacking, 7-0 and draw until you can play

**Files:**
- Modify: `games/uno/types.ts`, `games/uno/rules.ts` (`applyEffect`, `play`, `draw`, `accept`, `challenge`, `parseMove`, `describeMove`, `endRound`), `games/uno/index.ts`, `games/uno/client/GameScreen.tsx`, `games/uno/client/Table.tsx`, `games/uno/client/describeMove.ts`, `games/uno/client/uno.scss`, README, FAQ, `games/uno/manager.test.ts`
- Test: `games/uno/rules.test.ts`, `games/uno/client/describeMove.test.ts`, `e2e/uno.spec.ts`

**Interfaces:**
- Produces: toggles `stacking` ("Stack +2 and +4 cards"), `sevenZero` ("7-0: a 7 swaps hands, a 0 passes every hand"), `drawUntilPlayable` ("Draw until you can play"), all standard false, appended to `UNO_RULES`; `GameState.pendingDraw: { count: number; target: Seat } | null`; `Move` play gains `swapWith?: Seat`; `LastMove` draw gains `count: number`, play gains `swappedWith?: Seat` and `passedHands?: true`.

Decisions (README): with stacking, a Draw Two or Wild Draw Four does not draw at once; its target may stack a Draw Two on a Draw Two, a Wild Draw Four on either, or `accept` and draw the whole count and lose the turn; a Draw Two may not go on a Wild Draw Four; a Wild Draw Four can be challenged only while it is the only card in the stack. With 7-0, a 7 needs `swapWith` (any other player), a 0 passes every hand one seat in the direction of play; a 7 or 0 that goes out does neither. With draw until you can play, a draw takes cards until one can be played or the pile is empty; that card may be played or the player passes.

- [ ] **Step 1: Write the failing tests:** `a Draw Two can be stacked and the next player draws four`, `a Wild Draw Four stacks on a Draw Two but not the other way round`, `accepting a stack draws the whole count and loses the turn`, `a stacked Wild Draw Four cannot be challenged`, `a 7 swaps hands with the chosen player`, `a 7 without a player is refused`, `a 0 passes every hand in the direction of play`, `a 7 that goes out swaps nothing`, `drawing until you can play stops at the first playable card`, `drawing until you can play stops when the pile is empty`; `describeMove` for each new move; e2e `stacking a Draw Two`, `a 7 swaps hands`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, with a player picker for the 7 (`.swap-picker`) and the stack count on the table.
- [ ] **Step 4: Run** `npm test` and `npx playwright test e2e/uno.spec.ts`. Expected: PASS.
- [ ] **Step 5: Browser check** the swap picker and stack count at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "UNO: stacking, 7-0 and draw until you can play"`.

---

### Task 11: UNO jump-in

**Files:**
- Modify: `games/uno/rules.ts`, `games/uno/index.ts` (`allowsOutOfTurn`), `games/uno/types.ts` (`LastMove` play `jumpedIn?: true`), `games/uno/client/GameScreen.tsx`, `games/uno/client/describeMove.ts`, README, FAQ
- Test: `games/uno/rules.test.ts`, `games/uno/manager.test.ts`, `e2e/uno.spec.ts`

**Interfaces:**
- Consumes: `GameDefinition.allowsOutOfTurn`, `manager.move(..., moveCount)`, `gameService.makeMove(move, moveCount)`.
- Produces: toggle `jumpIn` ("Jump-in", standard false); `export function canJumpIn(state: Pick<GameState, 'houseRules' | 'pendingFour' | 'pendingDraw' | 'currentColor' | 'roundSummary'>, top: Card | null, card: Card): boolean` (shared by rules and screen).

Decisions: a jump-in is a `play` move with a number card (0 to 9) identical in color and number to the top card, by any player other than the current one, while no Draw stack, Wild Draw Four, round summary or starting-color choice is pending. Play continues from the jumper in the current direction; a jumped 7 or 0 still swaps or passes with 7-0 on; a jump-in that empties the hand goes out; the current player's drawn card is no longer theirs to play. The screen sends `moveCount` with every out-of-turn play, so of two players jumping on the same card the second gets "Someone else moved first" (both red 7s exist, so the second would otherwise match the new top card too).

- [ ] **Step 1: Write the failing tests:** `allowsOutOfTurn accepts only an exact number match with jump-in on`, `a jump-in moves the turn on from the jumper`, `a jump-in during a Draw stack is refused`; `manager.test.ts`: `a jump-in can be undone`, `the second of two jump-ins on the same card is refused`; e2e `a player jumps in out of turn and play continues from them`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**; the hand marks jump-in cards playable when it is not your turn.
- [ ] **Step 4: Run** `npm test` and the spec. Expected: PASS.
- [ ] **Step 5: Browser check** at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "UNO: jump-in"`.

---

### Task 12: Mancala: play from the other side, and Avalanche or Kalah

**Files:**
- Modify: `games/mancala/rules.ts` (`isPlayablePit`, `playPit`, `applyMove`), `games/mancala/types.ts` (`LastMove.captured?: number`, `LastMove.fromOpponent?: true`), `games/mancala/index.ts` (description no longer says Avalanche only), `games/mancala/client/*` (playable pits on the other side, capture animation), `games/mancala/client/mancala.scss`, README, FAQ, `games/mancala/manager.test.ts`
- Test: `games/mancala/rules.test.ts`, `e2e/mancala.spec.ts`

**Interfaces:**
- Produces: `export const MANCALA_RULES: HouseRule[]` with toggles `otherSide` ("When your side is empty, play from the other side", standard true) and `avalanche` ("Avalanche (off plays Kalah, with captures)", standard true); `export function playablePits(board: Board, seat: Seat, otherSide: boolean): number[]`; `playPit(board: Board, seat: Seat, pit: number, rules: { otherSide: boolean; avalanche: boolean }): Turn`; `Turn.capture: Transfer[]`.

Decisions: with `otherSide` on, a player whose six pits are empty picks any non-empty pit on the other side and sows from it counter-clockwise as usual, dropping into their own bank as they pass it and skipping the opponent's; the game ends only when all twelve pits are empty, with no sweep. With it off, the game ends as today when either row is empty, with the sweep. With `avalanche` off (Kalah, per Wikipedia): a last stone in your own bank gives another turn; a last stone in an empty pit on your own side, when the opposite pit has stones, captures both into your bank; no relays. A pit on the other side chosen under `otherSide` follows the same Kalah or Avalanche rule.

- [ ] **Step 1: Write the failing tests:** `with your side empty you may play a pit on the other side`, `a pit on the other side is refused while your side has stones`, `with play from the other side on the game ends only when every pit is empty`, `with it off the game ends when a row is empty and the rows are swept`, `Kalah captures the last stone and the opposite pit`, `Kalah does not capture opposite an empty pit`, `Kalah has no relays`, `both rules on: 500 seeded random games all end, every pit empty` (Review Focus 5; also both off, and each mix), e2e `playing from the other side when yours is empty`, `a Kalah capture`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Existing Mancala tests run with both rules on, which is the new standard, so they keep passing except those asserting the game ends on an empty row: give those `otherSide: false`.
- [ ] **Step 4: Run** `npm test` and the spec. Expected: PASS.
- [ ] **Step 5: Browser check** at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "Mancala: play from the other side, and Kalah"`.

---

### Task 13: Catan: friendly robber, and two players

**Files:**
- Modify: `games/catan/dice.ts` (`robberVictims`, `moveRobber`), `games/catan/rules.ts` (`MIN_PLAYERS` checks in `applyAction` and `onPlayerLeft`), `games/catan/index.ts`, `games/catan/client/*` (victim picker), README, FAQ, `games/catan/manager.test.ts`
- Test: `games/catan/rules.test.ts`, `e2e/catan.spec.ts`

**Interfaces:**
- Produces: toggle `friendlyRobber` ("Friendly robber: players with 2 points or fewer cannot be robbed", standard false) appended to `CATAN_RULES`; `export const PLAYERS = { minPlayers: 3, maxPlayers: 4, stretchedPlayers: { min: 2, max: 4 } }` in `rules.ts`, spread into `info`; `robberVictims(state, seat, hex, cardCount)` reads the rule from `state`.

Decisions: "2 points or fewer" counts the points everyone can see (`visiblePoints`), so hidden Victory Point cards neither protect nor expose anyone. The robber may still be placed on a protected player's hex; it blocks production there and steals nothing. Two players use the normal board. `applyAction` and `onPlayerLeft` compare with `minimumToStart(PLAYERS, state)` instead of `MIN_PLAYERS`.

- [ ] **Step 1: Write the failing tests:** `the friendly robber cannot steal from a player with 2 points`, `it can steal from a player with 3`, `hidden Victory Point cards do not count`, `two players can play with the override`, `a three-player game with the override plays on after a dismissal leaves two`; e2e `a player with 2 points is not offered as a victim`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` and the spec. Expected: PASS.
- [ ] **Step 5: Browser check** a two-player board at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "Catan: friendly robber and two players"`.

---

### Task 14: Phase 10: phases in any order

**Files:**
- Modify: `games/phase10/types.ts`, `games/phase10/rules.ts` (`layDown`, `endHand`, `parseMove`, `moveText`), `games/phase10/index.ts`, `games/phase10/client/*` (phase picker, progress per player), README, FAQ, `games/phase10/manager.test.ts`
- Test: `games/phase10/rules.test.ts`, `e2e/phase10.spec.ts`

**Interfaces:**
- Produces: toggle `anyOrder` ("Phases in any order", standard false) in `PHASE10_RULES`; `GameState.phasesDone: Record<Seat, number[]>` (missing in old saves: derive from `phases`); `Move` layDown gains `phase?: number` (required with the rule on); `GameState.laidPhase: Record<Seat, number>` for the hand.

Decisions: with the rule on, a player lays down any phase they have not completed; completing all ten is finishing; the existing lowest-score and tiebreaker rules apply, and a tiebreaker hand is phase 10 for everyone in it.

- [ ] **Step 1: Write the failing tests:** `with any order a player may lay down phase 5 first`, `a completed phase cannot be laid down again`, `the game ends when a player has completed all ten`, `without the rule only the next phase is accepted`; e2e `laying down a later phase first`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` and the spec. Expected: PASS.
- [ ] **Step 5: Browser check** the phase picker at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "Phase 10: phases in any order"`.

---

### Task 15: Hearts: Jack of Diamonds minus 10

**Files:**
- Modify: `games/hearts/types.ts` (`GameState.jackTaker: Seat | null`, `HandSummary.jack: Seat | null`), `games/hearts/rules.ts` (trick scoring, `endHand`), `games/hearts/index.ts`, `games/hearts/client/RoundSummary.tsx`, README, FAQ, `games/hearts/manager.test.ts`
- Test: `games/hearts/rules.test.ts`, `e2e/hearts.spec.ts`

**Interfaces:**
- Produces: toggle `jackOfDiamonds` ("Jack of Diamonds is worth minus 10", standard false) in `HEARTS_RULES`.

Decisions: the taker of the Jack of Diamonds scores -10 for the hand; `taken` still counts only hearts and the queen, so shooting the moon still needs all 26 and a moon shooter who also took the jack scores -10. The jack is not a penalty card, so it may be played on the first trick.

- [ ] **Step 1: Write the failing tests:** `the Jack of Diamonds takes 10 off its taker`, `shooting the moon with the jack scores minus 10`, `the jack may be played on the first trick`, `without the rule the jack is worth nothing`; e2e `the round summary shows the jack`.
- [ ] **Step 2 to 6:** run (FAIL), implement, run (PASS), browser check the summary, commit `git commit -m "Hearts: Jack of Diamonds minus 10"`.

---

### Task 16: Rook at 4 and 6 players with fixed teams

**Files:**
- Modify: `games/rook/types.ts`, `games/rook/rules.ts` (deal, seats, teams, bidding order, `endHand`, `onPlayerLeft`), `games/rook/index.ts`, `games/rook/client/Table.tsx`, `games/rook/client/RoundSummary.tsx`, `games/rook/client/HistoryBoard.tsx`, `games/rook/client/rook.scss`, README, FAQ, `games/rook/manager.test.ts`
- Test: `games/rook/rules.test.ts`, `e2e/rook.spec.ts`

**Interfaces:**
- Produces:

```ts
export const SIX_TEAMS: ChoiceRule<'twoOfThree' | 'threeOfTwo'>; // id 'sixTeams', "Teams at 6 players", standard 'twoOfThree', offered at seats === 6
export const DEFENDERS: ChoiceRule<'separate' | 'together'>;     // id 'defenders', "Defending teams score", offered at 6 with 'threeOfTwo'
export function rookTeams(seats: Seat[], sixTeams: 'twoOfThree' | 'threeOfTwo'): Seat[][]; // 4: [[1,3],[2,4]]; 6 of 3: [[1,3,5],[2,4,6]]; 6 of 2: [[1,4],[2,5],[3,6]]; 5 and 7: one team per seat
export function dealSizes(players: number): { hand: number; nest: number }; // 4: 9/5, 5: 7/6, 6: 6/5, 7: 5/6 (41 cards each time)
export function teamOfSeat(state: Pick<GameState, 'teams' | 'activePlayers'>, seat: Seat): number;
// GameState: teams: Seat[][] (missing in old saves: [[1,3],[2,4]]); scores, tricksWon, captured: number[] by team; HandSummary points, change: number[]
```

`info.stretchedPlayers = { min: 4, max: 7 }`; `minPlayers` and `maxPlayers` stay 4.

Decisions (README, "Rules" and "Differences"): seats go around in seat order, the last seat deals first and the deal passes to the next seat; the nest and laid-aside count is `dealSizes(n).nest`; three teams of two: partners sit three apart; with "separate" each defending team scores what it took, with "together" each defending team scores what both defending teams took; teams are fixed for the game. A dismissal ends the game and the highest-scoring team without the dismissed player wins. Fix the "Team" import from `shared/partnerships.ts` so 4 seats keep their current behavior. `TeamScores` becomes `number[]`, which still reads an old `[a, b]` save.

- [ ] **Step 1: Write the failing tests:** `four players play exactly as before` (existing tests unchanged), `six players as two teams of three`, `six players as three teams of two`, `the defenders option is offered only for three teams of two`, `defending teams scoring separately and together`, `six players deal 6 each and a 5-card nest`, `a game saved before teams existed loads and scores` (Review Focus 4), `a dismissal at six ends the game`; e2e `a six-player hand of three teams`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, with a table that places N seats around the trick and a score panel listing each team.
- [ ] **Step 4: Run** `npm test` and the spec. Expected: PASS.
- [ ] **Step 5: Browser check** 4- and 6-player tables at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "Rook: six players in fixed teams"`.

---

### Task 17: Rook at 5 and 7 players with called partners

**Files:**
- Modify: `games/rook/types.ts` (`Phase` gains `'callPartner'`, `Move` gains `{ type: 'callPartner'; cards: Card[] }`, `GameState.called: { cards: Card[]; partners: Seat[] } | null`), `games/rook/rules.ts`, `games/rook/client/*`, README, FAQ
- Test: `games/rook/rules.test.ts`, `games/rook/client/describeMove.test.ts` (if present), `e2e/rook.spec.ts`

**Interfaces:**
- Consumes: Task 16 (`teams` as one seat each at 5 and 7, `dealSizes`).
- Produces: `export function calledCount(players: number): number` (5: 1, 7: 2, else 0).

Decisions: after naming trump, the bidder calls `calledCount` cards not in their own hand; a called card may be in the laid-aside cards, so the bidder may play with fewer partners or alone. The called cards are public; who holds them is not, until the card is played (`partners` lists only revealed holders in every view; the full list stays server side until the hand is scored). The bidding side is the bidder and every holder of a called card; if it made its bid each member scores the counters the side took, else each loses the bid; each defender scores the counters the defenders took together. Scores are per player. The first to the target wins; equal top totals share the win.

- [ ] **Step 1: Write the failing tests:** `five players call one partner card and it is 2 against 3`, `seven players call two and it is 3 against 4`, `a called card in the laid-aside cards leaves the bidder alone`, `the bidder cannot call a card in their own hand`, `a partner stays hidden until the called card is played`, `each player scores individually`, `equal top totals share the win`, `five players deal 7 each with a 6-card nest`; e2e `calling a partner at five players`.
- [ ] **Step 2 to 6:** run (FAIL), implement (the call picker `.call-partner`), run (PASS), browser check 5- and 7-player tables at both widths and themes, commit `git commit -m "Rook: five and seven players with called partners"`.

---

### Task 18: Stretched ranges for the other games

**Files:**
- Modify: `games/<id>/index.ts` for UNO (`{ min: 2, max: 10 }`), Yahtzee (`{ min: 2, max: 10 }`), Phase 10 (`{ min: 2, max: 8 }`), Texas Hold'em (`{ min: 2, max: 10 }`); their client layouts where they assume the box maximum; their READMEs and FAQs
- Test: each game's `rules.test.ts`, one e2e test each

Ranges (Farkle 2 to 10 in Task 4, Catan 2 to 4 in Task 13, Rook 4 to 7 in Tasks 16 and 17): no override for Azul, Backgammon, Carcassonne, Checkers, Chess, Connect Four, Dominoes (its own branch), Euchre, Go Fish, Hearts, Mancala, Monopoly, Parchisi, Quoridor, Rack-O, Risk, Rummikub, Scrabble, Skip-Bo, Spades, Splendor, The Crew, Ticket to Ride and War, because their decks, boards, pieces or partnerships fix the count. A game whose full seeded playout at the top of its range fails, or whose screen cannot fit that many seats at 390 px, drops back to no override and is listed as such in the PR.

- [ ] **Step 1: Write the failing tests:** per game `a full game at <max> players` (seeded random playout to game over, the existing anyMove/step helpers in each `manager.test.ts`), and e2e `<max> players can join with the override` using `seat(game, names, { maxPlayers: <max> })`.
- [ ] **Step 2: Run.** Expected: FAIL ("Game is full").
- [ ] **Step 3: Implement** the ranges and any layout fixes; add `agreeAll` to the manager test helpers of games that now need agreement.
- [ ] **Step 4: Run** `npm test` and the specs. Expected: PASS.
- [ ] **Step 5: Browser check** each game at its maximum at both widths and themes.
- [ ] **Step 6: Commit** `git commit -m "Player-count override for UNO, Yahtzee, Phase 10 and Texas Hold'em"`.

---

### Task 19: Final verification and PR

**Files:**
- Modify: `README.md` (each game's player range sentence adds the override range), `docs/architecture.md` (timers and the per-game rule list, if not already done)

- [ ] **Step 1: Run** `npm run lint && npm test && npm run build && npm run test:e2e`. Expected: all pass, 0 warnings.
- [ ] **Step 2: Browser check** the full lobby flow on a fresh server (`npm start`): host form, guest read-only, override, Agree, first move, House rules dialog, reload and rejoin, at 390x844 and 1440x900 in light and dark mode.
- [ ] **Step 3: Grep** for em-dashes: `git diff origin/scss-migration --name-only | xargs grep -lP '\x{2014}'` returns nothing.
- [ ] **Step 4: Push and open the PR** with `gh pr create`, its description listing every game's normal and stretched range (including "no override" games), every rule with its standard value, and the decisions marked in this plan (undo and clocks, Rook deal sizes, friendly robber counting visible points), ending with the attribution line.
