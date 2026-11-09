# Header Menu, Azul Pause, Snakes and Ladders Auto-roll, UNO One Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every game's header controls behind one ☰ drop-down menu, hold Azul's round summary for 2.5 s, give Snakes and Ladders an Auto-roll checkbox and a Roll button that never moves, and add a "One round" target score to UNO.

**Architecture:** A new `GameMenu` component in `src/components/` owns the open state, the panel and its dismissal (`useDismiss`); `GameView` puts the existing controls inside it. The Rules and Settings dialogs move out of their buttons into hooks (`useRulesDialog`, `useSettingsDialog`, the pattern `useHistoryDialog` already uses), so a dialog stays open when the menu closes; `GameView` renders them inside the header, so Hide and the agreement dimming leave them alone as today. The e2e helper `headerButton` opens the menu first, and every spec reaches header controls through it. The three game items are local edits in each game's folder.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Rules for every agent", "Shared ground" (the `headerButton` helper) and "Polish": "Header menu (every game)", "Azul", "Snakes and Ladders", "UNO".

**Branch:** `polish-header-azul-snakes-uno` in its own worktree at `C:/Users/Natha/Documents/code/mtg-wt/polish-header-azul-snakes-uno`, from `party-games-and-polish`. Site `PORT=3501`, e2e `E2E_PORT_BASE=8100` (never 6000). PR into `party-games-and-polish`.

## Global Constraints

- The header keeps **Back to games**, the game name and the game id on the left. Everything else goes behind one **menu button (☰)** on the right, top to bottom in this order: History, Share, Show QR code (table screen only), Rules, Hide, Pause (when allowed), Settings, GitHub and Theme.
- Pressing ☰ unfolds a **drop-down panel** under the button with each control's label. It animates open and closed (a short scale-and-fade from the top right corner, 150 ms) and respects `prefers-reduced-motion`.
- It starts closed. It closes on a second press of ☰, a click or tap outside, Escape, or choosing a control. The button has `aria-expanded` and `aria-controls`; focus moves into the panel when it opens and back to ☰ when Escape closes it.
- **Phones and desktop behave the same.** Share and Theme live in the menu at every width. `phoneControls` in `SettingsButton` (Pause, Share, Theme rows) is removed, so Settings shows only what it showed on desktop before. The CSS that existed only to hide or squeeze header buttons on narrow screens is removed.
- A control's badge or state stays visible in the menu (the Rules agreement dot, Hide's Hide/Show). While this device must agree to the house rules, ☰ shows a small dot.
- Accessible names of the controls do not change: `History`, `Share`, `Show QR code`, `Rules`, `Hide` / `Show`, `Pause`, `Settings`, `View source on GitHub`, `Switch to dark mode` / `Switch to light mode`. ☰ is named `Menu`.
- `headerButton(page, name)` in `e2e/fixtures.ts` opens the menu first; every existing spec that reaches a header control goes through it. Nothing else in `e2e/fixtures.ts` changes except `setPreference`, which reaches Settings and so uses `headerButton` too.
- Azul: `SUMMARY_DELAY_MS` in `games/azul/client/GameScreen.tsx` becomes 2500 ms from when the last move's animation starts. Client only; History playback unchanged.
- Snakes and Ladders: an "Auto-roll" checkbox per player, client-only, off on load; when on and it is your turn, it rolls after one second, with War's `sentAt` guard so a click and the timer cannot both roll. The Roll button stays in the same spot for the whole game: the status box is always present at a fixed height, the roll panel never wraps, long names end in an ellipsis.
- UNO: the Target score house rule gains a **0** choice labeled "One round", added through `targetScoreRule` in `games/uno/options.ts`, with the label set there so other games' target rules are unchanged. The game ends when the first round ends and that round's winner wins. No screen says "first to 0 points".
- Files: `src/components/` (the header controls and the new `GameMenu.tsx`), `src/App.scss`, the 25 game stylesheets that restyle header controls (Task 3), `games/azul/client/GameScreen.tsx`, `games/snakesladders/`, `games/uno/`, `e2e/`. `docs/architecture.md` only in the paragraphs that describe the game header and Settings (see the PR note in Task 9). Not the root README game list or count, nor `e2e/landing.spec.ts` counts.
- No new npm dependency. No em-dashes in comments, READMEs, FAQs or commit messages.
- Known before this work: `e2e/houseRules.spec.ts` tests at lines 14 and 51 already fail on `master`. Leave them; name them in the PR.

## Review Focus

1. Rules or Settings chosen from the menu: the menu closes and the dialog stays open, visible and undimmed while Hide is on and while the house rules await agreement, since today both dialogs live inside the header (Task 2).
2. Share chosen from the menu: the "Link copied" status or the copy-by-hand panel hangs under the Share row, so the menu stays open for Share (the one control that does not close it) until a press outside or Escape (Task 2).
3. A game whose stylesheet sizes `.share-button`, `.hide-button` and friends as 2.5 rem circles (Azul, Dominoes, Quoridor...) squashes the labeled rows or pushes the header onto two lines at 320 px: every game is checked at 390 and 320 px with the panel open (Task 3).
4. Auto-roll on and Roll clicked at the moment the timer fires, or a 6 giving another roll: exactly one roll per state, and the timer restarts for the second roll (Task 5).
5. UNO "One round" where the player who went out scores 0 (every other hand holds only 0 cards): the game still ends and they win (Task 6).

---

### Task 1: Worktree, branch and ports

**Files:** none.

- [ ] **Step 1: Check the base.** In `C:/Users/Natha/Documents/code/multiplayer-tabletop-games`, run `git fetch origin && git log -1 --oneline origin/party-games-and-polish`. Expected: the commit that adds the plans (this file exists in it). If `origin/party-games-and-polish` is missing, stop and report: the coordinator pushes it before the fan-out.
- [ ] **Step 2: Create the worktree.** `git worktree add -b polish-header-azul-snakes-uno C:/Users/Natha/Documents/code/mtg-wt/polish-header-azul-snakes-uno origin/party-games-and-polish`. Work only in that folder from here on.
- [ ] **Step 3: Install.** If `node` is not found, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH (memory note). Run `npm ci`. Expected: exit 0.
- [ ] **Step 4: Check the ports are free.** `netstat -ano | grep -E ':(3501|810[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3501 or 8100, and say so in the PR.
- [ ] **Step 5: Baseline.** `npm test && npm run typecheck && npm run lint`. Expected: PASS. Record any failure that exists before your changes.

### Task 2: The ☰ menu in the game header

**Files:**
- Create: `src/components/GameMenu.tsx`, `e2e/headerMenu.spec.ts`
- Modify: `src/components/GameView.tsx`, `src/components/RulesButton.tsx`, `src/components/SettingsButton.tsx`, `src/components/SettingsDialog.tsx`, `src/components/ShareButton.tsx`, `src/components/HideButton.tsx`, `src/components/GitHubLink.tsx`, `src/components/ThemeToggle.tsx`, `src/components/PauseButton.tsx` (comment only), `src/App.scss`, `e2e/fixtures.ts` (`headerButton`, `setPreference`)

**Interfaces:**
- Produces (`GameMenu.tsx`): `export default function GameMenu({ attention, children }: { attention: boolean; children: ReactNode })`. Renders `<div className="game-menu">` holding `<button type="button" className="game-menu-button" aria-label="Menu" aria-expanded aria-controls={panelId} data-attention={attention ? '' : undefined}>☰</button>` and `<div id={panelId} className="game-menu-panel" data-open={open ? '' : undefined} inert={!open}>{children}</div>`. The panel is always mounted (so it can animate closed); `panelId` from `useId`.
- Produces (`RulesButton.tsx`, the `useHistoryDialog` pattern, with the same `eslint-disable-next-line react-refresh/only-export-components` comment):
  - `export function useRulesDialog(game: GameInfo, faq: FaqItem[], houseRules?: ReactNode, agreeNeeded = false): { open: () => void; dialog: ReactNode }`: the `<div data-game={game.id}><RulesDialog ... initialView={agreeNeeded ? 'houseRules' : 'rules'} /></div>` while open.
  - `export function RulesTrigger({ agreeNeeded = false, onOpen }: { agreeNeeded?: boolean; onOpen: () => void })`: today's `.rules-button` with `data-attention` and the `.rules-attention` note.
  - `export default function RulesButton(props: RulesButtonProps)`: unchanged props, now the hook plus `RulesTrigger` (used by `JoinDialog`).
- Produces (`SettingsButton.tsx`): `export function useSettingsDialog(): { open: () => void; dialog: ReactNode }`; `export function SettingsTrigger({ onOpen, withLabel = false }: { onOpen: () => void; withLabel?: boolean })`; `export default function SettingsButton()` with no props (the lobby header). `SettingsDialog` loses its `phoneControls` prop and the `.settings-phone-controls` section.
- Produces: an optional `withLabel?: boolean` on `ShareButton`, `HideButton`, `GitHubLink`, `ThemeToggle` and `SettingsTrigger`. When true, a `<span className="menu-label">` follows the icon with: `Share`; `Hide` or `Show`; `Settings`; `GitHub`; `Dark mode` or `Light mode` (the mode the toggle switches to, so the label is inside the accessible name). The `aria-label`s are unchanged.
- Produces (`e2e/fixtures.ts`): `headerButton(page, name): Promise<Locator>` clicks `.game-header` `Menu` when its `aria-expanded` is not `"true"`, then returns `page.locator('.game-header .game-menu-panel').getByRole('button', { name, exact: typeof name === 'string' })`. `setPreference` opens Settings with `headerButton(page, 'Settings')`.

Decisions:
- `GameMenu` closes on: a second ☰ press; `useDismiss(menuRef, open, dismiss)` (a press outside, Escape); a click whose target is inside a `button` or `a` in the panel, except inside `.share-wrapper` (Share keeps the menu open so its status and panel stay visible). `dismiss` returns focus to ☰ when focus was inside the panel. On open, focus the first enabled `button` or `a` in the panel.
- `GameView` header: Back to games, `h1`, then `<GameMenu attention={agreeNeeded}>` with, in order, `HistoryButton`, `ShareButton withLabel`, the table screen's Show QR code button, `RulesTrigger`, `HideButton withLabel` (not on a table screen), `PauseButton` when `canPause` (its `onPause` just calls `gameService.requestPause()`; the menu closes itself), `SettingsTrigger withLabel`, `GitHubLink withLabel`, `ThemeToggle withLabel`. After `</GameMenu>` and still inside `<header>`: `{rules.dialog}{settings.dialog}`, so the `[data-hidden]` and `[data-awaiting-agreement]` rules (direct children of `.game-root` other than the header) still skip them.
- The hidden cover's second line becomes `Open the menu (☰) and choose Show to see it again.`
- `App.scss`:
  - Delete the `$compact-header` block and the `max-width: 360px` block after it (the rules that hide Share, Pause, GitHub and Theme and squeeze the header), and the two `.settings-phone-controls` rules.
  - `.game-menu`: `position: relative; margin-left: auto`. `.game-menu-button`: joins the 2.5 rem round button rules and their hover rule. Its `[data-attention]` dot joins the `.rules-button[data-attention]` rule and its `::after` (one rule, two selectors).
  - `.game-menu-panel`: absolute, `top: calc(100% + 0.375rem); right: 0; z-index: 25`, a column of rows with gap, panel background and shadow like `.share-panel`, `max-width: calc(100vw - 2rem)`, `transform-origin: top right`. Closed: `visibility: hidden; opacity: 0; transform: scale(0.95)`, `transition: opacity 150ms, transform 150ms, visibility 0s 150ms`. Open (`[data-open]`): `visibility: visible; opacity: 1; transform: none; transition-delay: 0s`. Under `prefers-reduced-motion: reduce`: `transition: none`.
  - Panel rows, **outside `:where()`** with at least three classes or attributes (for example `[data-game].game-root .game-menu-panel :is(...)`), so the game stylesheets that size header buttons cannot shrink a row: full width, `height: 2.5rem`, `border-radius: 1.25rem`, icon then label left aligned with a gap, `width: auto`. `.share-wrapper` is a full-width row too.
  - Replace `:where([data-table-screen] .qr-button)` (z-index 21) with the same rule on `[data-table-screen] .game-menu`, so the table screen still reaches Show QR code over the game-over backdrop.
- Comments that say phones show a control in Settings (`PauseButton.tsx`, `ThemeToggle.tsx`, `SettingsButton.tsx`) are updated to say the menu.

- [ ] **Step 1: Write the failing tests** in `e2e/headerMenu.spec.ts` (connectfour, Alice and Bob, unless said; `menu = page.locator('.game-header').getByRole('button', { name: 'Menu', exact: true })`, `panel = page.locator('.game-menu-panel')`):
  - `'the header shows Back to games, the title and a closed Menu button'`: the header's visible direct children are `.back-button`, `h1`, `.game-menu`; `menu` has `aria-expanded="false"` and `aria-controls` equal to `panel`'s `id`; `panel` is hidden.
  - `'Menu lists the controls in order, with labels, the same on a phone and a laptop'`: after Alice drops in column 1 (so Pause is allowed), at 1280 and at 390 px wide, the accessible names of `panel`'s buttons and links in order are `['History', 'Share', 'Rules', 'Hide', 'Pause', 'Settings', 'View source on GitHub', 'Switch to dark mode']` (or `light`, read from `data-theme`); the panel's text contains `Share`, `Hide`, `Settings`, `GitHub` and `Dark mode` or `Light mode`; the panel's bounding box lies inside the viewport.
  - `'Pause is listed only once play has started'`: before any move the panel has no `Pause`.
  - `'a second press, a press outside, Escape and choosing a control each close the menu'`: each time `menu` returns to `aria-expanded="false"`; after opening, `document.activeElement` is inside `panel`; after Escape `menu` is focused; choosing History opens the History dialog with the menu closed.
  - `'Share keeps the menu open to show Link copied'`: the clipboard setup of `e2e/sharing.spec.ts` line 50 to 52; `(await headerButton(alice, 'Share')).click()`; `panel` shows `Link copied` and `menu` stays `aria-expanded="true"`.
  - `'Rules and Settings chosen from the menu stay open while hidden and before agreement'`: seat with `houseRules: { turnTimer: 30 }` and `agree: false`; Rules from the menu shows the `Connect Four rules` dialog with the menu closed, and the dialog has a `header.game-header` ancestor; Escape; Hide from the menu, then Settings from the menu shows the `Settings` dialog.
  - `'the Menu button shows a dot while the house rules need this player, and Rules keeps its own'`: same seating; `menu` has `data-attention`; in the open panel `.rules-button` has `data-attention`; after `agreeToHouseRules(alice)` neither has it.
  - `'Hide shows its state in the menu'`: after Hide from the menu, the panel has a button named `Show` whose text is `Show`; the cover reads `Open the menu (☰) and choose Show to see it again.`
  - `'Settings has no Share and theme section'`: at 390 px, Settings from the menu has no heading `Share and theme` and no button `Share`.
  - `'the menu animates, and not with reduced motion'`: on a `seat(..., { motion: true })` page the panel's computed `transition-duration` contains `0.15s`; on a default page it is `0s`.
- [ ] **Step 2: Run** `npx vite build && E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/headerMenu.spec.ts`. Expected: FAIL (no Menu button).
- [ ] **Step 3: Implement** `GameMenu`, the hooks and triggers, the `withLabel` props, `GameView`, `SettingsDialog`, the CSS and the two fixture changes above.
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npx vite build && E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/headerMenu.spec.ts e2e/rules.spec.ts e2e/sharing.spec.ts`. Expected: `headerMenu.spec.ts` PASS. `rules.spec.ts` and `sharing.spec.ts` may still fail where they reach header controls directly; Task 3 switches them.
- [ ] **Step 5: Commit** `Header: one menu button for every game's controls`.

### Task 3: Every spec through `headerButton`, and game stylesheets

**Files:**
- Modify (header controls reached directly): `e2e/alerts.spec.ts`, `e2e/chinesecheckers.spec.ts`, `e2e/codebreaker.spec.ts`, `e2e/dominoes.spec.ts`, `e2e/hearts.spec.ts`, `e2e/hide.spec.ts`, `e2e/history.spec.ts`, `e2e/holdem.spec.ts`, `e2e/houseRules.spec.ts`, `e2e/jenga.spec.ts`, `e2e/jigsaw.spec.ts`, `e2e/pause.spec.ts`, `e2e/phase10.spec.ts`, `e2e/pictionary.spec.ts`, `e2e/reactions.spec.ts`, `e2e/rules.spec.ts`, `e2e/settings.spec.ts`, `e2e/sharing.spec.ts`, `e2e/snakesladders.spec.ts`, `e2e/sudoku.spec.ts`, `e2e/tableScreen.spec.ts`, `e2e/war.spec.ts`, `e2e/yahtzee.spec.ts`
- Modify (header rules for narrow screens): the game stylesheets that style header controls: `games/{azul,checkers,connectfour,dominoes,euchre,farkle,hearts,holdem,jenga,phase10,pictionary,quoridor,racko,rook,rummikub,scrabble,skipbo,spades,splendor,sudoku,thecrew,uno,war,yahtzee}/client/*.scss` and `games/tictactoe/client/_page.scss`
- Modify: `docs/architecture.md` (only the `GameView.tsx`, `ShareButton`, `RulesButton`, `SettingsButton`, `ThemeToggle` and table screen sentences about the header)

**Interfaces:**
- Consumes: `headerButton` (Task 2).

Decisions:
- Switch only header controls. Find them with `grep -nE "game-header'\)\.getByRole|getByRole\('button', \{ name: '(History|Share|Rules|Hide|Show|Pause|Settings|Show QR code)'" e2e`. Leave buttons in dialogs (`dialog.getByRole`, `gameOver(...)`, the join dialog's Rules in `rules.spec.ts` lines 12 to 65 and `lazyLoading.spec.ts`, the stats page History in `stats.spec.ts`) and the lobby header.
- Locator helpers become async calls: for example `pause.spec.ts`'s `pauseButton(page)` becomes `headerButton(page, 'Pause')`, `hide.spec.ts`'s `hideButton` and `showButton` likewise, `houseRules.spec.ts`'s `rulesButton` likewise.
- Tests of the removed phone layout are replaced, not deleted:
  - `settings.spec.ts` `'on a phone the header fits one row, and Share and the theme toggle are in Settings'` becomes `'on a phone Share and the theme toggle are in the menu, not in Settings'`: at 375 px, `headerButton(alice, 'Share')` is visible; the theme toggle from `headerButton` switches `data-theme`; Settings has no `Share` button.
  - `hide.spec.ts`'s per-game loop `'<name>: Hide sits by the title on a phone and matches Settings'` becomes `'<name>: on a phone the header is one row and the open menu fits'`: at 390 and 320 px, `.back-button`, `h1` and `.game-menu-button` have centers within 4 px vertically, the header has no horizontal overflow (`scrollWidth - clientWidth <= 0`), and after opening the menu every row of `.game-menu-panel` lies inside the viewport with a height of at least 40 px.
  - `pause.spec.ts`'s `pauseFromSettings` becomes `pauseFromMenu(page, width = 390)` (Pause through `headerButton`, then `Menu` has `aria-expanded="false"`); the tablet test becomes `'at every width the header stays on screen and pauses from the menu'` over widths 481, 600, 680, 760, 860 checking every header child's right edge is within the width; `'pausing from Settings on a phone closes Settings'` becomes `'pausing from the menu on a phone closes the menu'`; the pass-and-play test pauses from the menu.
- Game stylesheets: delete rules inside narrow-width `@media` blocks that only re-flow the header for the old buttons (title on its own row, tighter button padding, as in `azul.scss` around line 671). Keep colors, fonts and the desktop sizing of the round buttons; the menu-row rule from Task 2 overrides their size inside the panel. The per-game loop above decides when a file is done.

- [ ] **Step 1: Run** `E2E_PORT_BASE=8100 npx playwright test --workers=2` once and list the failing specs. Expected: failures only in the files above (plus the two known `houseRules.spec.ts` tests).
- [ ] **Step 2: Switch the specs** and replace the three phone-layout tests as decided.
- [ ] **Step 3: Run** `E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/hide.spec.ts`. Expected: FAIL for the games whose stylesheets still re-flow the header.
- [ ] **Step 4: Clean the game stylesheets** until `e2e/hide.spec.ts` passes.
- [ ] **Step 5: Update** the header sentences of `docs/architecture.md` (`GameView.tsx` paragraph: the ☰ `GameMenu`, its order, dismissal, Share keeping it open, dialogs rendered inside the header; `SettingsButton`: no phone controls; table screen: `.game-menu` above the backdrop). Touch no game list or count.
- [ ] **Step 6: Run** `npx vite build && E2E_PORT_BASE=8100 npx playwright test --workers=2`. Expected: PASS except `houseRules.spec.ts` lines 14 and 51.
- [ ] **Step 7: Commit** `Header menu: specs reach header controls through headerButton`.

### Task 4: Azul holds the board 2.5 s before the round summary

**Files:**
- Modify: `games/azul/client/GameScreen.tsx`, `e2e/azul.spec.ts`

Decisions:
- `const SUMMARY_DELAY_MS = 2500;` with the comment `// The last tile and the wall tiling stay in view this long, counted from the move's animation start`. The `MOVE_DURATION_MS` import stays only if still used. `useSummaryHeld` is otherwise unchanged: it skips the hold under reduced motion and for a summary already open on load, as now.

- [ ] **Step 1: Write the failing test** in `e2e/azul.spec.ts`, `'the board stays in view for 2.5 seconds before the round summary opens'`: `seat('azul', ['Alice', 'Bob'], { motion: true })` directly (the file's `start` helper has no motion option), patch as the `'after each round the scoring screen waits...'` test does, take and place; record `Date.now()` after the click; `scoring(bob)` has count 0 after `bob.waitForTimeout(1500)`; then `scoring(bob)` is visible within 3000 ms and the elapsed time is at least 2400 ms.
- [ ] **Step 2: Run** `E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/azul.spec.ts -g "2.5 seconds"`. Expected: FAIL (the summary opens after 400 ms).
- [ ] **Step 3: Implement** the constant.
- [ ] **Step 4: Run** `npx vite build && E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/azul.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Azul: hold the board 2.5 s before the round summary`.

### Task 5: Snakes and Ladders Auto-roll and a steady Roll button

**Files:**
- Modify: `games/snakesladders/client/GameScreen.tsx`, `games/snakesladders/client/RollPanel.tsx`, `games/snakesladders/client/GameStatus.tsx`, `games/snakesladders/client/snakesladders.scss`, `games/snakesladders/client/faq.ts`, `games/snakesladders/README.md`, `e2e/snakesladders.spec.ts`

**Interfaces:**
- Produces (`GameScreen.tsx`): `export const AUTO_ROLL_MS = 1000;` and a `roll` callback with War's guard: `sentAt = useRef<number | null>(null)`, `roll` returns early when `sentAt.current === moveCount`, else sets it and sends `{ type: 'roll' }`; an effect resets `sentAt` on `[moveCount, error, undoVote, dismissVote]`; an effect starts `setTimeout(roll, AUTO_ROLL_MS)` while `autoRoll && isMyTurn`, deps `[autoRoll, isMyTurn, roll]`. `autoRoll` is `useState(false)`, never stored.
- Produces (`RollPanel.tsx`): props `{ gameState; canRoll: boolean; onRoll: () => void; autoRoll: boolean; onAutoRoll: (on: boolean) => void }`; a `<label className="sl-auto-roll"><input type="checkbox" .../>Auto-roll</label>` in the panel.

Decisions:
- `GameStatus` always renders `.sl-status` (empty when there is no status or error). `.sl-status` and `.sl-turn` each get a fixed height of two lines (`height` in `em`, `overflow: hidden`, two-line clamp), so their content never moves what is below.
- `.sl-roll-panel`: `flex-wrap: nowrap`; the last-roll block `flex: 1; min-width: 0`; `.sl-roller` `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`; the die, the Roll button and Auto-roll `flex: none`.
- README Controls gains: `Auto-roll (beside Roll) rolls for you one second after your turn comes up. It is kept only in this browser tab and is off after a reload`. FAQ gains a question `What does Auto-roll do?` with the same answer.

- [ ] **Step 1: Write the failing tests** in `e2e/snakesladders.spec.ts`, under "Snakes and Ladders controls":
  - `'Auto-roll rolls one second after your turn comes up, only in your own tab, and is off after a reload'`: copy War's test (`e2e/war.spec.ts` line 276) with the checkbox `Auto-roll` and Bob's token moving after Alice's roll, elapsed at least 1000 ms; Alice's checkbox is unchecked; after `bob.reload()` it is unchecked.
  - `'Auto-roll and a click at the same moment roll once'`: Alice checks Auto-roll, `table.dice(3)` then waits 950 ms and clicks Roll; after 1500 ms `table.state()` has `moveCount` 1 more than before, Alice's position is 4, and Alice's page shows no `.sl-status-error` (the guard kept the second roll from being sent and refused).
  - `'Auto-roll rolls again after a 6'`: `table.dice(6, 2)`, Alice checks Auto-roll; her token ends on square 9 with no click.
  - `'the Roll button stays in the same spot all game'`: names `Alice` and `Bartholomew Longname` (20 characters); at 1280 and at 390 px wide, Roll's bounding box (x, y, width) is the same within 1 px before any roll, after Alice's roll (Bob's turn, long name in the turn line and the last-roll line), after a refused action shows an error, and after Bob's roll.
- [ ] **Step 2: Run** `E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/snakesladders.spec.ts`. Expected: the four new tests FAIL.
- [ ] **Step 3: Implement** the guard, timer, checkbox, fixed heights, README and FAQ lines.
- [ ] **Step 4: Run** `npx vite build && E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/snakesladders.spec.ts && node --test games/snakesladders/*.test.ts games/snakesladders/client/*.test.ts`. Expected: PASS, including `'on a phone the Roll button is on screen below the board'`.
- [ ] **Step 5: Commit** `Snakes and Ladders: Auto-roll and a Roll button that stays put`.

### Task 6: UNO "One round" target

**Files:**
- Modify: `games/uno/options.ts`, `games/uno/client/Table.tsx`, `games/uno/client/faq.ts`, `games/uno/README.md`, `games/uno/rules.test.ts`, `e2e/uno.spec.ts`
- Test: `shared/houseRules.test.ts` (unchanged; must still pass)

**Interfaces:**
- Produces (`options.ts`): `TARGET_RULE: ChoiceRule<number>` built from `targetScoreRule(500, [0, 250, 1000])` with the choice whose value is 0 relabeled `One round`; standard stays 500. `endRound`'s `total >= targetScore(state)` is unchanged, so 0 ends the game at the first round's end.

Decisions:
- `Table.tsx` round line: `One round: first to go out wins` when `targetScore(gameState) === 0`, else unchanged (`Round 2: first to 500 points wins`). `RoundSummary` never shows with 0 (the game is over), so its line is unchanged.
- FAQ house rules answer: `a target score of one round, 250, 500 or 1,000 points`. README: the Players or Rules line names "One round (the first player to go out wins)"; the Differences line about Mattel's 2022 single-hand rule says the host can choose it with One round.

- [ ] **Step 1: Write the failing tests** in `games/uno/rules.test.ts`:
  - `'One round ends the game when the first round ends'`: `finish(0, 0)` (as in `'the game ends at the chosen target'`) has `isGameOver` true and `winners` `[1]`.
  - `'One round ends the game even when going out scores 0'`: Alice goes out with `red('7')` while seats 2 and 3 hold only `blue('0')`; `isGameOver` true, `winners` `[1]`, `scores[1]` 0.
  - `'the target choices are One round, 250, 500 and 1,000, standard 500'`: `TARGET_RULE.choices` equals `[{ value: 0, label: 'One round' }, { value: 250, label: '250' }, { value: 500, label: '500' }, { value: 1000, label: '1,000' }]` and `TARGET_RULE.standard === 500`.
  
  In `e2e/uno.spec.ts`: `'One round: the first player to go out wins the game'`: `start(seat, ['Alice', 'Bob'], { houseRules: { targetScore: 0 } })`; `.round` reads `One round: first to go out wins`; deal Alice one playable card and play it; the Game over dialog says `Alice wins` and no round summary dialog opened; the read-only House rules list contains `Target scoreOne round (house rule)`.
- [ ] **Step 2: Run** `node --test games/uno/rules.test.ts`. Expected: FAIL on the choices test.
- [ ] **Step 3: Implement** the rule, the round line, FAQ and README.
- [ ] **Step 4: Run** `node --test games/uno/*.test.ts games/uno/client/*.test.ts shared/houseRules.test.ts && npx vite build && E2E_PORT_BASE=8100 npx playwright test --workers=2 e2e/uno.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `UNO: One round target score`.

### Task 7: Browser check

**Files:** none new.

- [ ] **Step 1:** `npx vite build`, then `PORT=3501 node server/server.ts` in the background.
- [ ] **Step 2: Header menu in Chrome**, two tabs in one game (Connect Four) and one in Quoridor, Azul and Rack-O (wide or restyled headers): open and close the menu every way (second press, outside, Escape, each control); Rules opens on House rules while agreement is pending, the ☰ dot shows and clears; Hide then Show from the menu; Share copies the link with the menu open; Settings has no Share or Theme rows; Theme switches. Join a table screen tab and press Show QR code over the game-over screen. In both light and dark themes.
- [ ] **Step 3: Phone width:** in one tab, replace the body with same-origin iframes of 390 and 320 px of a game page (memory note), set `data-theme` in each for dark: the header is one row, the panel opens fully on screen, no overlap, no blank rows. Repeat at a laptop width (1280 px).
- [ ] **Step 4: Azul:** with motion allowed, play a round to its end in two tabs: the last tile and the wall tiling stay in view about 2.5 s before the summary. Open History and check playback is as before.
- [ ] **Step 5: Snakes and Ladders:** two tabs, one with a 20-character name; Auto-roll on in one tab and play several turns, including a 6; watch that Roll never moves at laptop and phone widths (iframes).
- [ ] **Step 6: UNO:** set Target score to One round, play to the first player going out: Game over at once, no "first to 0 points" anywhere. Download the game file and open it with View as each seat.
- [ ] **Step 7:** Stop the server.

### Task 8: Full verification

- [ ] **Step 1: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS (or only the failures recorded in Task 1 Step 5).
- [ ] **Step 2: Run** `npx vite build && E2E_PORT_BASE=8100 npx playwright test --workers=2`. Expected: PASS except `e2e/houseRules.spec.ts` lines 14 and 51 (known on `master`). The full run is this chunk's e2e set, since Task 3 touched specs across the suite.

### Task 9: Push and pull request

- [ ] **Step 1: Push** `git push -u origin polish-header-azul-snakes-uno`.
- [ ] **Step 2: Open the PR:**

```bash
gh pr create --base party-games-and-polish --title "Header menu, Azul pause, Snakes and Ladders auto-roll, UNO one round" --body "$(cat <<'EOF'
## Summary
- Every game's header controls are behind one ☰ menu (drop-down panel, same on phones and desktop); Settings no longer carries phone-only Pause, Share and Theme rows
- `headerButton` in e2e/fixtures.ts opens the menu first; every spec reaches header controls through it (and setPreference uses it)
- Azul holds the board 2.5 s before the round summary
- Snakes and Ladders: Auto-roll, and a Roll button that never moves
- UNO: Target score "One round"

## Notes for the coordinator
- Share keeps the menu open, so its "Link copied" status and copy panel stay visible
- docs/architecture.md: only the header and Settings sentences changed
- Many READMEs and FAQs still say "Click Rules at the top of the page"; left as is
- e2e/houseRules.spec.ts tests at lines 14 and 51 fail as on master

## Test plan
- npm test, npm run typecheck, npm run lint
- npx playwright test --workers=2 (full suite)
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
