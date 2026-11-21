# Controls Menu Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every game's ☰ menu gets a Controls item that opens a dialog listing that game's controls, written from its code, with control how-tos moved out of the FAQs.

**Architecture:** A `ControlItem` type and an optional `controls` list on `ClientGame`; each game's list in `games/<id>/client/controls.ts`. A `ControlsDialog` plus a `useControlsDialog` hook and `ControlsTrigger` button (the same split as `SettingsButton.tsx` and `RulesButton.tsx`), wired into `GameView`'s menu. Eight batches write the 55 lists; a last task makes `controls` required.

**Tech Stack:** React 19, TypeScript, SCSS, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-controls-menu-item-design.md`

## Global Constraints

- `export type ControlItem = { action: string; pointer?: string; keys?: string }` in `src/clientGames.ts`; at least one of `pointer` and `keys` per row.
- `action` is short and starts with a verb ("Move a piece"). `keys` only for the game's own keys, never for plain Tab and Enter on its buttons.
- Each list is `export const CONTROLS: ControlItem[]` in `games/<id>/client/controls.ts`; the client index adds `controls: CONTROLS`.
- Rows in the order a player meets them in a turn. One flat list; a mode-, house-rule- or role-only control says so in its text ("With the Rotation house rule: ...").
- A control is any way to act in the game's own play: gestures, drags, clicks on the board or hand, keys, each on-screen game action button (Roll, Pass, Draw, Offer a draw). Not the app's items (menu, reactions, undo and pause votes, Back to games). "How do I join a game?" stays in the FAQ.
- Every row traceable to the game's client code; the code wins over the FAQ, and a wrong FAQ is corrected.
- FAQ trimming: an answer that only explains controls is removed; one that mixes rules and controls keeps the rules and drops the control steps.
- Menu item label "Controls", right after Rules, shown everywhere the menu is except the table screen.
- Dialog title "<Game name> controls". Fixed first line, exactly: "Tab moves between buttons, and Enter or Space presses one."
- Column headings exactly: "To", "Mouse or touch", "Keys". Stacked on narrow screens; a missing cell shows nothing.
- Escape and the close button close it; focus returns to the menu button (`.game-menu-button`).
- No sideways scroll at 320px; works in light and dark themes.
- Copy: plain words, no em-dashes (—), "click or tap" as the FAQs say it.
- Commit trailers on every commit:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01ME2AkgYCKe4aZS5vYjnKjU`
- Shared code goes in `src/` or `shared/`, never in a `games/` folder.

## Review Focus

1. A row that names a key or gesture the game does not have (or misses one it has): each batch review reads the game's client code row by row (Tasks 2-9).
2. An FAQ answer trimmed so far that a rule it carried is lost (for example a "How do I move?" answer that also says captures are compulsory): batch reviews compare the old and new FAQ text (Tasks 2-9).
3. An e2e test still looking for FAQ text that moved: each batch runs its games' e2e specs (Tasks 2-9).
4. The dialog at 320px with a long row (Block Tower's hold-to-turn text): the Task 1 e2e test checks no sideways scroll at 320px.
5. Opening Controls on the table screen or before the client has a list: Task 1 e2e checks the item is absent on the table screen; Task 1 hides it while `controls` is missing.

---

### Task 1: The Controls dialog and menu item, with Tic-Tac-Toe's list

**Files:**
- Modify: `src/clientGames.ts` (type and optional field)
- Create: `src/components/ControlsDialog.tsx`, `src/components/ControlsButton.tsx`
- Modify: `src/components/GameView.tsx:109-130` (hook, trigger after `RulesTrigger`, dialog next to `{rulesDialog.dialog}`)
- Modify: `src/App.scss` (neutral default look, in the `:where([data-game] .modal ...)` block near line 705)
- Create: `games/tictactoe/client/controls.ts`; Modify: `games/tictactoe/client/index.ts`, `games/tictactoe/client/faq.ts`
- Create: `src/games/controls.test.ts`
- Modify: `e2e/fixtures.ts` (add `openControls` beside `openFaq`), `e2e/tictactoe.spec.ts`
- Create: `e2e/controls.spec.ts`
- Modify: `docs/architecture.md` (lines 75, 136, 210), `README.md` (lines 269-272, 282)

**Interfaces:**
- Produces: `ControlItem`; `ClientGame.controls?: ControlItem[]`; `useControlsDialog(game: GameInfo, controls: ControlItem[] | undefined): { open: () => void; dialog: ReactNode }`; `ControlsTrigger({ onOpen }: { onOpen: () => void })`; e2e `openControls(page: Page): Promise<Locator>` returning the dialog named `/ controls$/`; unit test helper loop over `GAME_INFOS`.

- [ ] **Step 1: Write the failing unit test `src/games/controls.test.ts`**

For each `id` of `GAME_INFOS`, if `games/<id>/client/controls.ts` exists (`existsSync`), dynamic-import it and assert:
```ts
assert.ok(CONTROLS.length > 0, id);
for (const row of CONTROLS) {
  assert.ok(row.action.trim(), id);
  assert.ok(row.pointer?.trim() || row.keys?.trim(), `${id}: ${row.action}`);
  assert.ok(!/—/.test(`${row.action}${row.pointer ?? ''}${row.keys ?? ''}`), `${id}: em-dash`);
}
assert.equal(new Set(CONTROLS.map(r => r.action)).size, CONTROLS.length, `${id}: repeated action`);
```
plus `test('at least one game has a controls list', ...)` asserting the count of files found is above 0.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test src/games/controls.test.ts`
Expected: FAIL, "at least one game has a controls list" (no file yet).

- [ ] **Step 3: Add the type, the field and Tic-Tac-Toe's list**

Add `ControlItem` and `controls?: ControlItem[]` (comment: optional until every game has a list). Write `games/tictactoe/client/controls.ts` from `games/tictactoe/client/` code (place a mark; Resign and Offer a draw from `DrawAndResign`; anything else the screen offers), add it to the index, and trim the FAQ's "How do I place a mark?" per the constraint.

- [ ] **Step 4: Run the unit test**

Run: `node --test src/games/controls.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing e2e test `e2e/controls.spec.ts`** (Tic-Tac-Toe, using the fixtures other specs use to seat two players)

Assertions:
- `openControls(alice)` shows a dialog named "Tic-Tac-Toe controls" containing "Tab moves between buttons, and Enter or Space presses one." and the column headings "To", "Mouse or touch", "Keys", and one row per `CONTROLS` entry (check the first row's action text).
- Escape closes it (`toHaveCount(0)`) and `alice.locator('.game-menu-button')` is focused; reopening and clicking Close does the same.
- At a 320px wide viewport (`page.setViewportSize({ width: 320, height: 640 })`), with the dialog open, `document.documentElement.scrollWidth <= 320` and the dialog's `scrollWidth <= clientWidth`.
- On the table screen (the way existing specs open one; grep `tableScreen` in `e2e/`), the menu has no Controls button.
- In a game with no list yet, the menu has no Controls button. Pick any game not in Task 2's batch; this assertion is deleted in Task 10.

Add `openControls` to `e2e/fixtures.ts`: click `headerButton(page, 'Controls')`, return `page.getByRole('dialog', { name: / controls$/ })`.

- [ ] **Step 6: Run it and see it fail**

Run: `npx playwright test e2e/controls.spec.ts`
Expected: FAIL, no Controls button.

- [ ] **Step 7: Build the dialog and item**

- `ControlsDialog({ game, controls, onClose })`: `.overlay` > `.modal.controls` `role="dialog"` labelled by its `h2` "<game.name> controls"; the Tab line as a `p`; a real `<table>` with a `thead` of the three headings and one `tr` per row (`th scope="row"` for the action); a `primary-button` "Close"; `useEscapeKey(onClose)`. On close, focus `.game-menu-button` in the page (the menu's `dismiss` already put focus there before opening).
- `ControlsButton.tsx`: `useControlsDialog` (wrap in `<div data-game={game.id}>` as `useRulesDialog` does) and `ControlsTrigger` (`className="controls-button"`, text "Controls", matching `RulesTrigger`, which has no icon).
- `GameView`: render `<ControlsTrigger>` right after `RulesTrigger` only when `!tableScreen && client.controls`; render the dialog beside `{rulesDialog.dialog}`.
- SCSS: below about 600px wide, each `tr` is a block, the `thead` is visually hidden, and the pointer and keys cells show their heading via `data-label` (`td::before { content: attr(data-label) }`); empty cells take no space. Neutral defaults under `:where(...)` like `.faq`.

- [ ] **Step 8: Run the e2e test, the Tic-Tac-Toe spec, unit tests, lint and typecheck**

Run: `npx playwright test e2e/controls.spec.ts e2e/tictactoe.spec.ts`, `npm test`, `npm run lint`, `npx tsc -b`
Expected: all pass. Update any `e2e/tictactoe.spec.ts` FAQ check that looked for the trimmed text per the spec's e2e rule.

- [ ] **Step 9: Update the docs**

`docs/architecture.md` line 75 adds `controls` to the `ClientGame` fields; line 136 adds a sentence on `ControlsButton.tsx` / `ControlsDialog.tsx` ("<Game> controls", `.modal.controls`, Escape closes it, focus back to the menu button, hidden on the table screen); line 210 adds `.controls-button` and `.modal.controls` to the neutral-default list. `README.md` 269 adds `controls`; after 272 add "`controls.ts`: the rows of the Controls dialog (see `ControlItem`)"; 282 adds `.controls-button`, `.modal.controls`.

- [ ] **Step 10: Commit:** "Controls: a menu item and dialog listing a game's controls, starting with Tic-Tac-Toe"

### Tasks 2-9: Controls lists, one batch of games each

Each batch task is the same procedure for its games. Batches:

| Task | Games |
|------|-------|
| 2 | blocktower, chinesecheckers, corners, go, hexisland, jigsaw, pawnsandwalls |
| 3 | railroutes, rummytiles, shaperace, sudoku, territories, tritiles, bingo |
| 4 | backgammon, checkers, chess, fourinarow, mancala, ultimatetictactoe, codebreaker |
| 5 | dominoes, naval, nest, pachisi, palacewalls, snakesladders, cribbage |
| 6 | euchre, gofish, hearts, holdem, missiontricks, spades, spiteandmalice |
| 7 | stagerummy, war, inorder, jewelguild, rainboweights, hintgrid, farkle |
| 8 | fivedice, roadsandfields, roadtoretirement, streetdeeds, tradingfloor, steadyhand, categories |
| 9 | charades, drawandguess, fictionary, lettergrid, whodunit |

**Files (per game `<id>`):**
- Create: `games/<id>/client/controls.ts`
- Modify: `games/<id>/client/index.ts`, `games/<id>/client/faq.ts`, `e2e/<id>.spec.ts`

**Interfaces:**
- Consumes: `ControlItem` from `src/clientGames.ts`, `openControls` from `e2e/fixtures.ts` (Task 1).

- [ ] **Step 1: Read each game's client code** (`games/<id>/client/*.tsx`, its key handlers, its `faq.ts`, and shared pieces it renders such as `DrawAndResign`, `Dice`, `PlayingCard`, `PieceTray`, `src/drag/`) and list every control per the constraint.
- [ ] **Step 2: Add the e2e assertion first** in `e2e/<id>.spec.ts`, next to its existing FAQ check: `openControls(page)` contains one distinctive row's action and its keys or pointer text; close it. Move or delete the spec's FAQ checks whose text you will trim (moved when it checked a control description, deleted when it only checked that the FAQ shows).
- [ ] **Step 3: Run that spec and see the new assertion fail.** Run: `npx playwright test e2e/<id>.spec.ts -g "<the FAQ test's title>"`. Expected: FAIL, no Controls button.
- [ ] **Step 4: Write `controls.ts`, wire the index, trim `faq.ts`.** Where the FAQ and code disagree, the code wins and the FAQ is corrected.
- [ ] **Step 5: Verify.** `node --test src/games/controls.test.ts` passes; `npx playwright test e2e/<id>.spec.ts` for every game in the batch passes; `npm run lint` and `npx tsc -b` clean.
- [ ] **Step 6: Commit** one commit per batch: "Controls lists: <game names>". The report lists, per game, each row and the file and line it was traced to, and each FAQ answer removed or shortened.

### Task 10: Every game has a list

**Files:**
- Modify: `src/clientGames.ts` (`controls: ControlItem[]`, required; drop the "optional until" comment)
- Modify: `src/components/ControlsButton.tsx`, `src/components/GameView.tsx` (drop the `client.controls` guard and `| undefined`)
- Modify: `src/games/controls.test.ts`, `e2e/controls.spec.ts`

- [ ] **Step 1: Change the test** so every `GAME_INFOS` id must have `games/<id>/client/controls.ts` (`assert.ok(existsSync(path), id)`), replacing the "at least one" test; delete the "game with no list yet" e2e assertion.
- [ ] **Step 2: Run it.** `node --test src/games/controls.test.ts`. Expected: PASS (all 55 written). If one is missing, that batch was incomplete: stop and report.
- [ ] **Step 3: Make the field required and drop the guards.** `npx tsc -b` must be clean (it fails for any client index missing `controls`).
- [ ] **Step 4: Verify.** `npm test`, `npm run lint`, `npx tsc -b`, `npx playwright test e2e/controls.spec.ts e2e/rules.spec.ts e2e/lazyLoading.spec.ts` all pass.
- [ ] **Step 5: Commit:** "Controls: every game has a list, so the field is required"
