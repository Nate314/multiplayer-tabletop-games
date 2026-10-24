# Preferences and Game Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-player Settings screen with generated sounds, color-blind symbols and a "Highlight newly drawn cards" option, plus move animations for Phase 10, Rack-O and Yahtzee.

**Architecture:** Preferences live in `localStorage` through `src/services/settings.ts` and reach React through a small external store (`usePreferences`). Sounds are derived from consecutive public states by one pure function (`soundsFor`), the same way `useMoveAnimation` derives animations, and played with the Web Audio API. Color symbols are one shared `ColorSymbol` component driven by one color-to-shape table; newly drawn cards use one shared hook over a pure per-game step function; the three new animations follow the Azul pattern (a pure plan function, tested, executed by `animateMove`).

**Tech Stack:** React 19, TypeScript, Vite, SCSS, Web Audio API, Web Animations API, `node --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-preferences-and-game-feel-design.md`

## Global Constraints

- No new runtime or dev dependencies
- Every setting is per player, kept in that browser's `localStorage` through `src/services/settings.ts` on `src/services/storage.ts`; nothing is sent to the server, and no setting changes what other players see or hear
- Every storage access may fail; the site works without remembered settings
- Defaults: every sound group on, volume 0.5 ("a moderate volume"), Mute all off, Color-blind symbols off, Highlight newly drawn cards on, History Sounds off (History Animations stays as it is, off)
- Sounds are generated with the Web Audio API, no audio files; the audio context starts on the player's first click or key press
- The turn chime never plays in the History dialog; History sounds play only when the player turned them on there
- Animations go through `useMoveAnimation` live and `ClientGame.animateMove` in the History dialog, `MOVE_DURATION_MS` (300 ms), nothing under `prefers-reduced-motion: reduce`
- Styles in SCSS: platform defaults in `src/App.scss` wrapped in `:where()`, game styles nested under `[data-game="<id>"]`
- The theme toggle stays where it is
- This branch must not depend on the house rules, UI polish or drag and drop branches; where the spec says "when combined", only the hook point is built
- Prose (README, docs, FAQ, commit messages) never uses em-dashes
- Each game README rule or control line has an e2e test (the repo's convention: "One test per rule and control in games/<id>/README.md")
- Commit messages follow the repo's plain sentence style, e.g. `Add the Settings dialog`

## Review Focus

1. Junk in storage (a `preferences` value that is an array, a volume of `"loud"`, `2` or `NaN`, a missing sound group): each field falls back to its own default and the rest are kept. Test in Task 1.
2. No Web Audio (old browser, blocked) or no user gesture yet (a page that rejoins after a refresh): sounds are silently skipped and never throw into a render. Test in Task 3.
3. A History slider jump (start to end) or a step backwards: no sound at all, including no game-over flourish. Test in Task 3.
4. The turn coming back without a new move: an undo, a declined undo vote, a rejoin or a reload must not chime; a dismissal that hands you the turn must. Tests in Task 3.
5. A move that ends a hand, round or game (Phase 10 last discard, a Rack-O call, the last Yahtzee box): the animation plan still works and missing elements are skipped without throwing. Tests in Tasks 10, 11, 12.

---

### Task 1: Preferences and their store

**Files:**
- Modify: `src/services/settings.ts`
- Create: `src/hooks/usePreferences.ts`
- Test: `src/services/settings.test.ts`
- Modify: `docs/architecture.md` (the "Settings" block under Client 4)

**Interfaces:**
- Produces (in `src/services/settings.ts`):
  - `export type SoundName = 'turn' | 'move' | 'dice' | 'gameOver' | 'timer'`
  - `export type Preferences = { volume: number; muted: boolean; sounds: Record<SoundName, boolean>; colorSymbols: boolean; highlightDrawn: boolean }`
  - `export const DEFAULT_PREFERENCES: Preferences` (volume 0.5, muted false, every sound true, colorSymbols false, highlightDrawn true)
  - `export function loadPreferences(): Preferences` (key `preferences`)
  - `export function savePreferences(preferences: Preferences): void`
  - `export function loadHistorySounds(): boolean` / `export function saveHistorySounds(on: boolean): void` (key `historySounds`, default false)
- Produces (in `src/hooks/usePreferences.ts`):
  - `export function getPreferences(): Preferences` (read once from storage, then from memory)
  - `export function setPreferences(next: Preferences): void` (saves and notifies subscribers)
  - `export default function usePreferences(): Preferences` (`useSyncExternalStore`)

- [ ] **Step 1: Write the failing tests** in `src/services/settings.test.ts`, reusing its `installStorage` helper

```ts
test('preferences default to every sound on at half volume, symbols off and the highlight on', () => {
  installStorage()
  assert.deepEqual(loadPreferences(), {
    volume: 0.5, muted: false,
    sounds: { turn: true, move: true, dice: true, gameOver: true, timer: true },
    colorSymbols: false, highlightDrawn: true,
  })
})

test('preferences round-trip', () => {
  installStorage()
  const changed = { ...DEFAULT_PREFERENCES, volume: 0.2, muted: true, colorSymbols: true, highlightDrawn: false,
    sounds: { ...DEFAULT_PREFERENCES.sounds, dice: false } }
  savePreferences(changed)
  assert.deepEqual(loadPreferences(), changed)
})

test('each bad preference falls back to its own default and the good ones are kept', () => {
  installStorage({ preferences: '{"volume":"loud","muted":true,"sounds":{"dice":false,"turn":"no"},"colorSymbols":1}' })
  assert.deepEqual(loadPreferences(), { ...DEFAULT_PREFERENCES, muted: true, sounds: { ...DEFAULT_PREFERENCES.sounds, dice: false } })
  for (const volume of ['2', '-1', 'null']) {
    installStorage({ preferences: `{"volume":${volume}}` })
    assert.equal(loadPreferences().volume, 0.5)
  }
  installStorage({ preferences: '[1]' })
  assert.deepEqual(loadPreferences(), DEFAULT_PREFERENCES)
})

test('history sounds default to off and round-trip', () => {
  installStorage()
  assert.equal(loadHistorySounds(), false)
  saveHistorySounds(true)
  assert.equal(loadHistorySounds(), true)
})
```

Also add `loadPreferences()` returning `DEFAULT_PREFERENCES` and `savePreferences`/`saveHistorySounds` not throwing to the existing "a storage that throws" test.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/services/settings.test.ts`
Expected: FAIL, `loadPreferences` is not exported

- [ ] **Step 3: Implement the settings functions**

Volume is valid only as a finite number in [0, 1]. `loadHistorySounds` shares a private boolean-flag reader with `loadAnimations`.

- [ ] **Step 4: Implement `src/hooks/usePreferences.ts`** with the signatures above: a module-level value, a `Set` of listeners, `useSyncExternalStore(subscribe, getPreferences)`.

- [ ] **Step 5: Run to verify they pass**

Run: `node --test src/services/settings.test.ts`
Expected: PASS

- [ ] **Step 6: Document** in `docs/architecture.md` (Client 4, Settings): the `preferences` and `historySounds` keys with their defaults, and `usePreferences` / `getPreferences` / `setPreferences`.

- [ ] **Step 7: Commit**

```bash
git add src/services/settings.ts src/services/settings.test.ts src/hooks/usePreferences.ts docs/architecture.md
git commit -m "Add per-player preferences"
```

---

### Task 2: Settings dialog and gear buttons

**Files:**
- Create: `src/components/SettingsButton.tsx`, `src/components/SettingsDialog.tsx`
- Modify: `src/components/GameView.tsx` (gear after `FaqButton`, before `GitHubLink`)
- Modify: `src/App.tsx` (gear in `.lobby-header`, before `ThemeToggle`)
- Modify: `src/App.scss`
- Modify: every game SCSS that restyles `.game-header .theme-toggle` (find with `grep -l "theme-toggle" games/*/client/*.scss`): add `.settings-button` to the same selectors
- Modify: `e2e/fixtures.ts`
- Create: `e2e/settings.spec.ts`
- Modify: `README.md` (new "Settings" section after "How to Play Multiplayer"), `docs/architecture.md` (components list, App.scss selector list)

**Interfaces:**
- Consumes: `usePreferences`, `setPreferences`, `Preferences`, `SoundName` (Task 1); `useEscapeKey` (`src/hooks/useEscapeKey.ts`)
- Produces:
  - `export default function SettingsButton(): JSX.Element` (a `button.settings-button`, `aria-label="Settings"`, text `⚙️`; opens the dialog)
  - `export default function SettingsDialog({ onClose }: { onClose: () => void }): JSX.Element` (`.overlay` > `.modal.settings`, `role="dialog"`, `aria-label="Settings"`)
  - In `e2e/fixtures.ts`: `export async function setPreference(page: Page, label: string, on: boolean): Promise<void>` (opens Settings, `setChecked` on the label, clicks Close)

Dialog contents, in order (exact labels):
- `h2` "Settings"
- Section "Sounds": range input labelled "Volume" (0 to 100, step 5, maps to `volume`), checkbox "Mute all", checkboxes "Your turn chime" (`turn`), "Moves" (`move`), "Dice" (`dice`), "Game over" (`gameOver`), "Timer warnings" (`timer`)
- Section "Display": checkboxes "Color-blind symbols", "Highlight newly drawn cards"
- The house rules spot: a JSX comment `{/* House rules: the current game's house rules go here, read only, once the house rules PR is combined; nothing renders when the game has none */}`
- `.modal-buttons` with a `primary-button` "Close"; Escape and a click on the overlay also close

Styles: `.settings-button` looks like the round `.theme-toggle` in both headers; `.modal.settings` sections are left aligned rows; checkboxes and the range use `accent-color: var(--platform-button-bg, var(--lobby-accent))` so they match the platform buttons until the UI polish PR's themed controls are combined. The landing page has no `[data-game]`, so widen the `.overlay`, `.modal`, `.modal h2`, `.modal-buttons` and `.primary-button` default selectors from `:where([data-game] X)` to `:where([data-game] X, .lobby X)`.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/settings.spec.ts`

```ts
test.describe('Settings', () => {
  test('the gear opens Settings from the landing page and the game header, every setting at its default', async ({ seat }) => {
    const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
    await alice.getByRole('button', { name: 'Settings' }).click();
    const dialog = alice.getByRole('dialog', { name: 'Settings' });
    await expect(dialog.getByLabel('Volume')).toHaveValue('50');
    await expect(dialog.getByLabel('Mute all')).not.toBeChecked();
    for (const label of ['Your turn chime', 'Moves', 'Dice', 'Game over', 'Timer warnings', 'Highlight newly drawn cards'])
      await expect(dialog.getByLabel(label)).toBeChecked();
    await expect(dialog.getByLabel('Color-blind symbols')).not.toBeChecked();
    await alice.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await alice.getByRole('button', { name: 'Back to games' }).click();
    await alice.getByRole('button', { name: 'Settings' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('a change is kept in this browser across a reload and does not change another player', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('connectfour', ['Alice', 'Bob']);
    await setPreference(alice, 'Color-blind symbols', true);
    await alice.reload();
    await alice.getByRole('button', { name: 'Settings' }).click();
    await expect(alice.getByLabel('Color-blind symbols')).toBeChecked();
    await bob.getByRole('button', { name: 'Settings' }).click();
    await expect(bob.getByLabel('Color-blind symbols')).not.toBeChecked();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/settings.spec.ts`
Expected: FAIL, no button named "Settings"

- [ ] **Step 3: Implement** `SettingsButton`, `SettingsDialog`, the two header placements, the styles and `setPreference` as specified above.

- [ ] **Step 4: Run to verify they pass**

Run: `npx playwright test e2e/settings.spec.ts`
Expected: PASS

- [ ] **Step 5: Browser check.** `npm start`, open `http://localhost:3000`. Open Settings from the landing page and from a Connect Four, Azul and Quoridor game header (Azul and Quoridor restyle the header). At 375 px and 1280 px wide, in light and dark: the gear lines up with History, FAQ and the theme toggle with no wrap overlap; the dialog fits, nothing overlaps, the slider and checkboxes are readable. Also open the join dialog's FAQ on the landing page and confirm the widened `.modal` defaults did not break it.

- [ ] **Step 6: Document** the Settings section in `README.md` (what each setting does, that it is per browser) and the two components and new selectors in `docs/architecture.md`.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsButton.tsx src/components/SettingsDialog.tsx src/components/GameView.tsx src/App.tsx src/App.scss games/*/client/*.scss e2e/fixtures.ts e2e/settings.spec.ts README.md docs/architecture.md
git commit -m "Add the Settings dialog"
```

---

### Task 3: Sound triggers, synthesizer and live game sounds

**Files:**
- Create: `src/sound/sounds.ts` (pure), `src/sound/synth.ts` (Web Audio), `src/sound/useStateSounds.ts` (hook)
- Test: `src/sound/sounds.test.ts`
- Modify: `src/main.tsx` (call `installAudioUnlock(window)` before render)
- Modify: `src/components/GameView.tsx` (`useStateSounds(gameState, playerNumber, true)`)
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: `SoundName`, `Preferences` (Task 1), `getPreferences` (Task 1)
- Produces:
  - `src/sound/sounds.ts`:
    - `export function soundsFor(previous: BasePublicState | null, next: BasePublicState, viewer: Seat | null): SoundName[]`
    - `export function audible(names: SoundName[], preferences: Preferences): SoundName[]`
  - `src/sound/synth.ts`:
    - `export function unlockAudio(): void` (creates or resumes the one `AudioContext`; safe to call often; does nothing without `AudioContext`)
    - `export function installAudioUnlock(target: Window): void` (`pointerdown` and `keydown` listeners calling `unlockAudio`, removed once the context is running)
    - `export function playSounds(names: SoundName[]): void` (filters with `audible(names, getPreferences())`, plays each; silently does nothing before unlock or without Web Audio). This is also the timer hook point: the house rules timers call `playSounds(['timer'])` once a second in the last 10 seconds when combined
  - `src/sound/useStateSounds.ts`: `export default function useStateSounds(state: BasePublicState, viewer: Seat | null, enabled: boolean): void` (keeps the previous state in a ref, starting at null on mount; when `enabled`, calls `playSounds(soundsFor(previous, state, viewer))`)

`soundsFor` rules (the tests pin them):
- `previous === null` (mount, join, rejoin, reload): nothing
- A step is "one move forward" when `next.moveCount === previous.moveCount + 1`, and "in place" when the counts are equal; any other step (undo, jump) plays nothing
- One move forward plays `dice` when the move rolled, otherwise `move`. Rolled: `lastMove.type` is `roll`, `attack` or `blitz` (Yahtzee, Farkle, Backgammon, Catan, Monopoly, Risk), or a `dice` array whose entries are objects that are all `used: false` and differ from the previous `dice` (Parchisi's automatic roll, which also gets `move`)
- `gameOver` when `!previous.isGameOver && next.isGameOver`, on one move forward or in place (a resignation is an action)
- `turn` only when `viewer !== null` and it became the viewer's turn on one move forward or in place: `isTurn(s) = s.currentPlayer === viewer && s.activePlayers.length >= 2 && !s.isGameOver`, true in `next`, false in `previous`
- Order: `move` or `dice`, then `gameOver`, then `turn`

Sounds (builder's call, one line each): `turn` two bell-like sine notes 660 Hz then 880 Hz; `move` a 30 ms soft triangle click; `dice` six short noise bursts over 250 ms; `gameOver` a rising four-note triangle arpeggio; `timer` a 20 ms 1000 Hz tick. Gain is `volume * volume * 0.5`.

- [ ] **Step 1: Write the failing tests** in `src/sound/sounds.test.ts`, with a `state(overrides)` builder for a two-player `BasePublicState` (moveCount 3, currentPlayer 2, activePlayers [1, 2], not over)

```ts
test('the first state after a join, rejoin or reload plays nothing', () => {
  assert.deepEqual(soundsFor(null, state({ currentPlayer: 1 }), 1), []);
});
test('a move by anyone clicks', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4 }), 1), ['move']);
});
test('a roll rattles instead of clicking', () => {
  for (const type of ['roll', 'attack', 'blitz'])
    assert.deepEqual(soundsFor(state(), state({ moveCount: 4, lastMove: { type } }), 1), ['dice']);
});
test("Parchisi's automatic roll after a move clicks and rattles", () => {
  const before = state({ dice: [{ value: 3, used: true }, { value: 5, used: true }] });
  const after = state({ moveCount: 4, dice: [{ value: 2, used: false }, { value: 6, used: false }] });
  assert.deepEqual(soundsFor(before, after, 1), ['move', 'dice']);
});
test('your turn arriving chimes after the move sound', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4, currentPlayer: 1 }), 1), ['move', 'turn']);
});
test('the second player joining gives the first player their turn', () => {
  assert.deepEqual(soundsFor(state({ moveCount: 0, currentPlayer: 1, activePlayers: [1] }), state({ moveCount: 0, currentPlayer: 1 }), 1), ['turn']);
});
test('a dismissal that hands you the turn chimes', () => {
  assert.deepEqual(soundsFor(state(), state({ currentPlayer: 1 }), 1), ['turn']);
});
test('an undo that gives the turn back plays nothing', () => {
  assert.deepEqual(soundsFor(state({ moveCount: 4 }), state({ moveCount: 3, currentPlayer: 1 }), 1), []);
});
test('a vote opening or being declined while it is already your turn does not chime', () => {
  const mine = state({ currentPlayer: 1 });
  assert.deepEqual(soundsFor(mine, { ...mine, undoVote: { requestedBy: 2, votes: {} } }, 1), []);
  assert.deepEqual(soundsFor({ ...mine, undoVote: { requestedBy: 2, votes: {} } }, mine, 1), []);
});
test('the game ending flourishes once, by a move or a resignation, and never chimes the turn', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4, isGameOver: true, currentPlayer: 1 }), 1), ['move', 'gameOver']);
  assert.deepEqual(soundsFor(state(), state({ isGameOver: true }), 1), ['gameOver']);
  assert.deepEqual(soundsFor(state({ isGameOver: true }), state({ isGameOver: true }), 1), []);
});
test('without a viewer (the History dialog) the turn never chimes', () => {
  assert.deepEqual(soundsFor(state(), state({ moveCount: 4, currentPlayer: 1 }), null), ['move']);
});
test('a History jump or a step back plays nothing, not even the flourish', () => {
  assert.deepEqual(soundsFor(state({ moveCount: 0 }), state({ moveCount: 9, isGameOver: true }), null), []);
  assert.deepEqual(soundsFor(state({ moveCount: 9, isGameOver: true }), state({ moveCount: 8 }), null), []);
});
test('mute or a volume of 0 silences everything, and an unchecked group is left out', () => {
  const all: SoundName[] = ['move', 'dice', 'gameOver', 'turn', 'timer'];
  assert.deepEqual(audible(all, { ...DEFAULT_PREFERENCES, muted: true }), []);
  assert.deepEqual(audible(all, { ...DEFAULT_PREFERENCES, volume: 0 }), []);
  assert.deepEqual(audible(all, { ...DEFAULT_PREFERENCES, sounds: { ...DEFAULT_PREFERENCES.sounds, turn: false } }), ['move', 'dice', 'gameOver', 'timer']);
});
test('playing sounds without Web Audio or before a click does nothing and does not throw', () => {
  assert.doesNotThrow(() => { unlockAudio(); playSounds(['turn', 'dice']); });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/sound/sounds.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Implement** `sounds.ts`, `synth.ts` and `useStateSounds.ts` with the signatures and rules above; wire `installAudioUnlock` in `main.tsx` and the hook in `GameView`.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test src/sound/sounds.test.ts`
Expected: PASS

- [ ] **Step 5: Browser check.** `npm start`; Alice in a normal window, Bob in a private window, Yahtzee. Click once in each window. Bob rolls: Alice hears the rattle; Bob scores: Alice hears the click and the turn chime. Put Alice's tab in the background before Bob's move: the chime still plays. Ask for an undo of Alice's move, approve: no chime for Alice. Reload Alice on her turn: no chime. Mute all: silence. Volume slider changes loudness.

- [ ] **Step 6: Document** in `docs/architecture.md` a `/src/sound/` entry: the five sounds, the `soundsFor` rules, the unlock on first gesture, and `playSounds(['timer'])` as the timer hook point.

- [ ] **Step 7: Commit**

```bash
git add src/sound src/main.tsx src/components/GameView.tsx docs/architecture.md
git commit -m "Play sounds for turns, moves, dice and game over"
```

---

### Task 4: History dialog Sounds option

**Files:**
- Modify: `src/components/HistoryDialog.tsx`, `src/App.scss` (`.history-sounds` like `.history-animations`)
- Modify: `e2e/settings.spec.ts`
- Modify: `docs/architecture.md` (the History dialog paragraph)

**Interfaces:**
- Consumes: `loadHistorySounds`, `saveHistorySounds` (Task 1); `useStateSounds` (Task 3)

In `HistorySteps`: `const [sounds, setSounds] = useState(loadHistorySounds)`, a `label.history-sounds` checkbox "Sounds" right after the Animations label (it moves into the UI polish PR's History settings gear when combined), and `useStateSounds(boardState, null, sounds)`.

- [ ] **Step 1: Write the failing e2e test** in `e2e/settings.spec.ts`

```ts
test('the History dialog has a Sounds option, off by default and kept for next time', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  await alice.getByRole('button', { name: 'History' }).click();
  const sounds = alice.getByRole('dialog', { name: 'History' }).getByLabel('Sounds');
  await expect(sounds).not.toBeChecked();
  await sounds.check();
  await alice.getByRole('button', { name: 'Close' }).click();
  await alice.getByRole('button', { name: 'History' }).click();
  await expect(sounds).toBeChecked();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/settings.spec.ts -g "Sounds option"`
Expected: FAIL, no "Sounds" label

- [ ] **Step 3: Implement** as described.

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test e2e/settings.spec.ts`
Expected: PASS

- [ ] **Step 5: Browser check.** With Sounds on, step forward one move: the move's click (or rattle) plays and no chime; drag from the start to the end: silence. At 375 px the controls row wraps without overlap, light and dark.

- [ ] **Step 6: Document** the Sounds checkbox in the History dialog paragraph of `docs/architecture.md`.

- [ ] **Step 7: Commit**

```bash
git add src/components/HistoryDialog.tsx src/App.scss e2e/settings.spec.ts docs/architecture.md
git commit -m "Add a Sounds option to the History dialog"
```

---

### Task 5: Color symbol table and component

**Files:**
- Create: `src/components/colorSymbols.ts`, `src/components/ColorSymbol.tsx`
- Test: `src/components/colorSymbols.test.ts`
- Modify: `src/App.scss` (`.color-symbol` default)
- Modify: `docs/architecture.md` (new "Color-blind symbols" section with the table)

**Interfaces:**
- Consumes: `usePreferences` (Task 1)
- Produces:
  - `export type SymbolColor = 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white' | 'orange' | 'pink' | 'purple' | 'cyan'`
  - `export type SymbolShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'ring' | 'hexagon' | 'heart' | 'cross' | 'pentagon'`
  - `export const COLOR_SYMBOLS: Record<SymbolColor, SymbolShape>`
  - `export const SHAPE_PATHS: Record<SymbolShape, string>` (SVG path data in a 24 by 24 box)
  - `export default function ColorSymbol({ color, className }: { color: SymbolColor | null | undefined; className?: string }): JSX.Element | null` renders `<svg class="color-symbol color-symbol-<shape> <className>" viewBox="0 0 24 24" aria-hidden="true">` while `colorSymbols` is on and `color` is set, otherwise `null`

The table (document it verbatim in `docs/architecture.md`):

| Color | Symbol | Also covers |
|---|---|---|
| red | circle | |
| blue | square | |
| green | triangle | |
| yellow | star | Splendor gold |
| black | diamond | Risk's and Carcassonne's dark gray seats |
| white | ring | |
| orange | hexagon | |
| pink | heart | |
| purple | cross | |
| cyan | pentagon | |
| gray | none | Ticket to Ride gray routes and Risk neutral armies: "any" or "nobody", told apart by having no symbol |

Default style: `display: inline-block; width: 0.9em; height: 0.9em; vertical-align: middle; fill: currentColor;` plus a 1 px contrasting stroke so it reads on any fill. Games position it.

- [ ] **Step 1: Write the failing test**

```ts
test('every color has its own shape and every shape has a path', () => {
  const shapes = Object.values(COLOR_SYMBOLS);
  assert.equal(new Set(shapes).size, shapes.length);
  assert.deepEqual(Object.keys(COLOR_SYMBOLS).sort(), ['black', 'blue', 'cyan', 'green', 'orange', 'pink', 'purple', 'red', 'white', 'yellow']);
  assert.equal(COLOR_SYMBOLS.red, 'circle');
  assert.equal(COLOR_SYMBOLS.blue, 'square');
  assert.equal(COLOR_SYMBOLS.green, 'triangle');
  assert.equal(COLOR_SYMBOLS.yellow, 'star');
  for (const shape of shapes) assert.ok(SHAPE_PATHS[shape].length > 0, shape);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/components/colorSymbols.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Implement** `colorSymbols.ts`, `ColorSymbol.tsx` and the style.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/components/colorSymbols.test.ts`
Expected: PASS

- [ ] **Step 5: Document** the table and the `ColorSymbol` component in `docs/architecture.md`.

- [ ] **Step 6: Commit**

```bash
git add src/components/colorSymbols.ts src/components/colorSymbols.test.ts src/components/ColorSymbol.tsx src/App.scss docs/architecture.md
git commit -m "Add the color-blind symbol table and component"
```

---

### Task 6: Color symbols on cards: Phase 10, Uno, Rummikub, The Crew

**Files:**
- Modify: `games/phase10/client/CardView.tsx`, `games/uno/client/Card.tsx`, `games/rummikub/client/Tile.tsx`, `games/thecrew/client/Card.tsx`, plus any other place in these clients that shows a color swatch alone (Uno's `color-swatch` current color and `color-choice` buttons in `Table.tsx` / `GameScreen.tsx`)
- Modify: each game's SCSS (symbol in the card's top left corner; small cards keep it legible)
- Modify: `e2e/phase10.spec.ts`, `e2e/uno.spec.ts`, `e2e/rummikub.spec.ts`, `e2e/thecrew.spec.ts`
- Modify: each game's `README.md` (one Controls line) and `client/faq.ts` (one item)

**Interfaces:**
- Consumes: `ColorSymbol`, `SymbolColor` (Task 5); `setPreference` (Task 2)

Mapping: each game's color names are already `SymbolColor` names (Phase 10 and Uno red, blue, green, yellow; Rummikub black, blue, orange, red; The Crew pink, blue, green, yellow). Wilds, Skips, jokers and The Crew's rocket already carry a letter or glyph and get no symbol.

README line (adapt the noun per game): "With Color-blind symbols on in Settings, each color also shows its shape: red circle, blue square, green triangle, yellow star". FAQ item: question "Can I tell the colors apart without seeing color?", answer naming the setting and this game's shapes.

- [ ] **Step 1: Write the failing e2e tests**, one per game in its "controls" describe block. Phase 10 (uses its `deal`, `n`, `handCards` helpers):

```ts
test('with Color-blind symbols on, every number card shows its color shape, in the hand and in the History', async ({ seat }) => {
  const { table, alice } = await start(seat);
  await deal(table, { hands: { 1: [n(3, 'red'), n(4, 'blue'), n(5, 'green'), n(6, 'yellow'), wild(0)], 2: tenCards('red', 1) } });
  await expect(alice.locator('.color-symbol')).toHaveCount(0);
  await setPreference(alice, 'Color-blind symbols', true);
  for (const shape of ['circle', 'square', 'triangle', 'star']) await expect(handCards(alice).locator(`.color-symbol-${shape}`)).toHaveCount(1);
  await drawPile(alice).click();
  await alice.getByRole('button', { name: 'History' }).click();
  await expect(alice.locator('.history-board .color-symbol').first()).toBeVisible();
});
```

Uno, Rummikub and The Crew: the same shape, using each spec's existing deal helper; assert one `.color-symbol-<shape>` per colored card in the hand after `setPreference`, and none before.

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/phase10.spec.ts e2e/uno.spec.ts e2e/rummikub.spec.ts e2e/thecrew.spec.ts -g "Color-blind"`
Expected: FAIL, no `.color-symbol`

- [ ] **Step 3: Implement**: render `<ColorSymbol color={...} />` inside each card component (so the hand, the table, the History board and saved games all get it), and style its corner position in each game's SCSS.

- [ ] **Step 4: Run to verify they pass** (same command, without `E2E_SKIP_BUILD` so the client is rebuilt)
Expected: PASS

- [ ] **Step 5: Browser check** each game with symbols on, at 375 px and 1280 px, light and dark: the symbol never covers the number, small Phase 10 group cards and Rummikub table tiles stay legible, nothing shifts when the setting is toggled.

- [ ] **Step 6: Update** the four READMEs and FAQs as above.

- [ ] **Step 7: Commit**

```bash
git add games/phase10 games/uno games/rummikub games/thecrew e2e/phase10.spec.ts e2e/uno.spec.ts e2e/rummikub.spec.ts e2e/thecrew.spec.ts
git commit -m "Show color-blind symbols on Phase 10, Uno, Rummikub and The Crew cards"
```

---

### Task 7: Color symbols on tiles, gems and trains: Azul, Splendor, Ticket to Ride

**Files:**
- Modify: `games/azul/client/Tile.tsx` (and the wall's empty-cell color hints in `PlayerBoard.tsx`, which are color alone)
- Modify: `games/splendor/client/pieces.tsx` (`GemToken`, the bonus and `Cost` pips)
- Modify: `games/tickettoride/client/pieces.tsx` (`CardFace`), `games/tickettoride/client/MapBoard.tsx` (one symbol on the middle car of each unclaimed colored route)
- Modify: each game's SCSS, `e2e/azul.spec.ts`, `e2e/splendor.spec.ts`, `e2e/tickettoride.spec.ts`, each `README.md` and `client/faq.ts`

**Interfaces:**
- Consumes: `ColorSymbol`, `SymbolColor` (Task 5); `setPreference` (Task 2)

Mapping: Azul blue, yellow, red, black, cyan as named; Splendor white, blue, green, red, black as named and `gold` to `yellow`; Ticket to Ride train colors as named, `locomotive` and gray routes get none (a gray route's lack of a symbol is what says "any color").

- [ ] **Step 1: Write the failing e2e tests**, one per game, each turning the setting on with `setPreference` and asserting, with that spec's existing helpers:
  - Azul: each factory tile shows `.color-symbol-<shape>` for its color (e.g. a crafted factory of `['red', 'blue', 'cyan', 'black']` shows one circle, square, pentagon and diamond), and none with the setting off
  - Splendor: each gem token shows its shape, gold a star
  - Ticket to Ride: each train card in the hand and market shows its shape and a locomotive none; a red route on the map shows a circle and a gray route none

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/azul.spec.ts e2e/splendor.spec.ts e2e/tickettoride.spec.ts -g "Color-blind"`
Expected: FAIL

- [ ] **Step 3: Implement** the symbols in the listed components and their placement in SCSS (map route symbols as an SVG `<use>` or nested `<svg>` at the middle car's center, sized to the car).

- [ ] **Step 4: Run to verify they pass** (same command)
Expected: PASS

- [ ] **Step 5: Browser check** at 375 px and 1280 px, light and dark: Azul tiles in factories, pattern lines and wall; Splendor tokens and card costs; Ticket to Ride map symbols readable at phone width and not covering city names.

- [ ] **Step 6: Update** the three READMEs and FAQs (same wording pattern as Task 6).

- [ ] **Step 7: Commit**

```bash
git add games/azul games/splendor games/tickettoride e2e/azul.spec.ts e2e/splendor.spec.ts e2e/tickettoride.spec.ts
git commit -m "Show color-blind symbols on Azul tiles, Splendor gems and Ticket to Ride trains"
```

---

### Task 8: Color symbols for player colors: Risk, Parchisi, Connect Four, Catan, Mancala

**Files:**
- Modify: `games/risk/client/layout.ts` (next to `seatClass`), `WorldMap.tsx`, `PlayerList.tsx`
- Modify: `games/parchisi/client/Pawn.tsx`, `PlayerList.tsx`, `Board.tsx` (nests and home lanes)
- Create: `games/connectfour/client/seatSymbols.ts` (the map stays out of `rules.ts`, which the server imports); Modify: `games/connectfour/client/Board.tsx` (discs), `GameStatus.tsx` (player dots)
- Modify: `games/catan/client/layout.ts`, `Board.tsx` (settlements, cities, and a small symbol at each road's midpoint), `PlayerList.tsx` (swatch)
- Modify: `games/mancala/client/Board.tsx` (banks, bank labels, seat-colored stones)
- Modify: each game's SCSS, its e2e spec, `README.md`, `client/faq.ts`

**Interfaces:**
- Consumes: `ColorSymbol`, `SymbolColor` (Task 5); `setPreference` (Task 2)
- Produces, one per game, in its client: `export const SEAT_SYMBOLS: Record<Seat, SymbolColor>`
  - Risk `{ 1: 'red', 2: 'blue', 3: 'green', 4: 'yellow', 5: 'purple', 6: 'black' }` (neutral: none)
  - Parchisi `{ 1: 'blue', 2: 'red', 3: 'green', 4: 'purple' }`
  - Connect Four `{ 1: 'red', 2: 'yellow' }`
  - Catan `{ 1: 'red', 2: 'blue', 3: 'orange', 4: 'purple' }`
  - Mancala `{ 1: 'blue', 2: 'red' }`

- [ ] **Step 1: Write the failing e2e tests**, one per game, asserting with the setting on that each seat's pieces and its player list entry show that seat's shape (Connect Four: after Alice drops a disc, `.disc.player1 .color-symbol-circle` has count 1 and Bob's next disc a star; Risk: an owned territory disc shows its owner's shape and a neutral one none), and none with the setting off.

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/risk.spec.ts e2e/parchisi.spec.ts e2e/connectfour.spec.ts e2e/catan.spec.ts e2e/mancala.spec.ts -g "Color-blind"`
Expected: FAIL

- [ ] **Step 3: Implement** the maps and symbols.

- [ ] **Step 4: Run to verify they pass** (same command)
Expected: PASS

- [ ] **Step 5: Browser check** at 375 px and 1280 px, light and dark: symbols fit inside pawns, discs and territory discs without hiding army counts; Catan road symbols do not cover numbers; Mancala stone symbols stay legible in a full pit.

- [ ] **Step 6: Update** the five READMEs and FAQs.

- [ ] **Step 7: Commit**

```bash
git add games/risk games/parchisi games/connectfour games/catan games/mancala e2e/risk.spec.ts e2e/parchisi.spec.ts e2e/connectfour.spec.ts e2e/catan.spec.ts e2e/mancala.spec.ts
git commit -m "Show color-blind symbols for player colors in Risk, Parchisi, Connect Four, Catan and Mancala"
```

---

### Task 9: Color symbols for the other player colors: Quoridor, Carcassonne, Monopoly, Ticket to Ride

The spec's list is a starting list and says symbols apply "anywhere color alone tells things apart". These four also tell players apart by color alone. Checkers (red against cream) and every other game are told apart by light against dark or by a printed symbol, so they get nothing; say so in the architecture table's notes.

**Files:**
- Modify: `games/quoridor/client/Pawn.tsx`, `GoalList.tsx`
- Modify: Carcassonne's meeple and player list components in `games/carcassonne/client/`
- Modify: `games/monopoly/client/Board.tsx` (`Token`) and its player list
- Modify: Ticket to Ride's claimed routes in `MapBoard.tsx` and `PlayerList.tsx`
- Modify: each game's SCSS, e2e spec, `README.md`, `client/faq.ts`

**Interfaces:**
- Consumes: `ColorSymbol`, `SymbolColor` (Task 5)
- Produces `SEAT_SYMBOLS` per game, same shape as Task 8:
  - Quoridor `{ 1: 'blue', 2: 'red', 3: 'green', 4: 'purple' }`
  - Carcassonne `{ 1: 'red', 2: 'blue', 3: 'yellow', 4: 'green', 5: 'black' }`
  - Monopoly `{ 1: 'red', 2: 'blue', 3: 'green', 4: 'orange', 5: 'purple', 6: 'cyan' }`
  - Ticket to Ride players `{ 1: 'red', 2: 'blue', 3: 'green', 4: 'yellow', 5: 'purple' }` (a claimed route shows its owner's shape instead of the route color's)

- [ ] **Step 1: Write the failing e2e tests**, one per game, as in Task 8 (Quoridor pawn 1 shows a square; a Monopoly token shows its seat's shape; a claimed Ticket to Ride route shows its owner's shape).

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/quoridor.spec.ts e2e/carcassonne.spec.ts e2e/monopoly.spec.ts e2e/tickettoride.spec.ts -g "Color-blind"`
Expected: FAIL

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run to verify they pass** (same command)
Expected: PASS

- [ ] **Step 5: Browser check** at 375 px and 1280 px, light and dark, as in Task 8.

- [ ] **Step 6: Update** the four READMEs and FAQs, and the architecture table's notes.

- [ ] **Step 7: Commit**

```bash
git add games/quoridor games/carcassonne games/monopoly games/tickettoride e2e docs/architecture.md
git commit -m "Show color-blind symbols for player colors in Quoridor, Carcassonne, Monopoly and Ticket to Ride"
```

---

### Task 10: Phase 10 move animations

**Files:**
- Modify: `src/animation/motion.ts` (add `flash`, `ghostSlide`)
- Modify: `games/scrabble/client/animateMove.ts` (its `ghostToBag` uses `ghostSlide`)
- Create: `games/phase10/client/animateMove.ts`
- Test: `games/phase10/client/animateMove.test.ts`
- Modify: `games/phase10/client/CardView.tsx` (`animKey` prop), `Piles.tsx`, `Table.tsx` (`seatKey` on each seat section, `animKey` on group cards), `GameScreen.tsx` (ref on `.game-screen`, `useMoveAnimation`, hand cards and staged cards get `animKey`), `HistoryBoard.tsx`, `LayDownPanel.tsx`, `index.ts` (`animateMove`), `phase10.scss` (ghost card position, flash)
- Modify: `e2e/phase10.spec.ts`, `games/phase10/README.md`

**Interfaces:**
- Consumes: `MoveChange` (`src/animation/useMoveAnimation.ts`), `slideFrom`, `MOVE_DURATION_MS`, `seatKey` (`src/animation/animKeys.ts`)
- Produces:
  - `src/animation/motion.ts`:
    - `export function flash(element: Element, durationMs = MOVE_DURATION_MS * 2): void` (a brightness pulse; cancels a running one; none under reduced motion)
    - `export function ghostSlide(root: HTMLElement, ghost: HTMLElement, from: DOMRect, to: DOMRect, delayMs = 0): void` (appends `ghost` fixed at `from`'s size, slides center to center, removes it when finished or canceled; under reduced motion appends nothing)
  - `games/phase10/client/animateMove.ts`:
    - `export const cardKey = (id: number) => \`card-${id}\``, `export const PILE_KEY = 'pile'`, `export const DISCARD_KEY = 'discard'`
    - `export type Phase10Plan = { slides: [string, string][]; ghosts: { card: Card | null; from: string; to: string }[]; flash: string | null }` (slides are `[from key, to key]`, as in Azul)
    - `export function plan(previous: PublicGameState, next: PublicGameState): Phase10Plan`
    - `export default function animateMove(change: MoveChange<PublicGameState>): void` (runs the plan; a ghost is a `span.card` built like `CardView`, or `.card.card-back` for `null`; a missing element or rect is skipped)

"Mine" is told from the viewer's own hand, so the plan needs no viewer: a drawn card is mine when its id is new in `next.myHand`; a played card is mine when its id was in `previous.myHand`.

- [ ] **Step 1: Write the failing tests** in `games/phase10/client/animateMove.test.ts`, in the style of `games/azul/client/animateMove.test.ts`: a `game(overrides)` builder for a full `GameState` (Alice and Bob, Alice to move), `after(state, move, seat)` over `applyMove` with a fixed `random`, and `view(state, viewer)` as `{ ...toPublicState(state, false, viewer), moveCount }`

```ts
test('your draw from the pile slides the new card from the pile into your hand', () => {
  // drawPile ends in red 9 (id 8)
  assert.deepEqual(plan(view(before, 1), view(after(before, { type: 'draw', source: 'pile' }), 1)),
    { slides: [[PILE_KEY, cardKey(8)]], ghosts: [], flash: null });
});
test('your draw from the discard pile slides it from the discard pile', () => { /* [[DISCARD_KEY, cardKey(id)]] */ });
test("another player's draw sends a card back from the pile to their seat", () => {
  // viewed by Bob: ghosts [{ card: null, from: PILE_KEY, to: seatKey(1) }], no slides
});
test("another player's take from the discard pile sends that card to their seat", () => {
  // ghosts [{ card: <the discard top>, from: DISCARD_KEY, to: seatKey(1) }]
});
test('a discard slides to the discard pile from your hand, or from the seat of whoever discarded', () => {
  // Alice's view: [[cardKey(id), DISCARD_KEY]]; Bob's view: [[seatKey(1), DISCARD_KEY]]
});
test('laying down a phase slides each card of the new groups from the hand to the table', () => {
  // Alice's view: every laid id as [cardKey(id), cardKey(id)]; Bob's view: [seatKey(1), cardKey(id)]
});
test('a hit slides only the added cards onto the group', () => { /* the added ids only */ });
test('a Skip slides to the discard pile and the skipped seat flashes', () => {
  // flash: seatKey(2)
});
test('a discard that ends the hand still slides to the discard pile', () => {
  // Alice discards her last card: handSummary is set and slides still holds [cardKey(id), DISCARD_KEY]
});
test('nothing moves without a last move', () => {
  assert.deepEqual(plan(view(game(), 1), view(game(), 1)), { slides: [], ghosts: [], flash: null });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test games/phase10/client/animateMove.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Implement** `flash` and `ghostSlide` in `motion.ts`, move Scrabble's ghost onto `ghostSlide` (its letter and delay stay), then `plan` and `animateMove`, the `data-anim-key`s listed under Files, and register `animateMove` in `phase10Client`.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test games/phase10/client/animateMove.test.ts games/scrabble/client/animateMove.test.ts`
Expected: PASS

- [ ] **Step 5: Add the e2e test** in the Phase 10 controls block, in the style of `e2e/splendor.spec.ts`'s "pieces slide" test (`seat('phase10', names, { motion: true })` against the default reduced motion):

```ts
test('cards slide where they went, and nothing animates with reduced motion', async ({ seat }) => {
  // animated: Alice draws from the pile; poll Bob's document.getAnimations().length > 0
  // still: same draw with the default table; Bob's count is 0 once the turn message updates
});
```

Run: `npx playwright test e2e/phase10.spec.ts e2e/scrabble.spec.ts`
Expected: PASS

- [ ] **Step 6: Browser check** with two windows at 375 px and 1280 px, light and dark: each of the six movements in the spec looks right live and in the History dialog with Animations on (Table only and View as Alice), the ghost lands on the right seat, the flash is visible, nothing is left behind on the page after a fast sequence of moves. Scrabble's exchange still sends tiles to the bag.

- [ ] **Step 7: Update** `games/phase10/README.md` (Controls: "Moves slide into place: draws, discards, laid-down phases and hits; a skipped player's seat flashes") and the architecture animation paragraph (`flash`, `ghostSlide`, Phase 10).

- [ ] **Step 8: Commit**

```bash
git add src/animation/motion.ts games/scrabble/client/animateMove.ts games/phase10 e2e/phase10.spec.ts docs/architecture.md
git commit -m "Animate Phase 10 moves"
```

---

### Task 11: Rack-O move animations

**Files:**
- Create: `games/racko/client/animateMove.ts`
- Test: `games/racko/client/animateMove.test.ts`
- Modify: `games/racko/client/Tile.tsx` (`animKey` prop), `Table.tsx` (keys on the deck tile, discard tile, held tile and every rack slot tile), `GameScreen.tsx` (ref, `useMoveAnimation`), `index.ts`
- Modify: `e2e/racko.spec.ts`, `games/racko/README.md`

**Interfaces:**
- Consumes: `MoveChange`, `slideFrom`
- Produces:
  - `export const DECK_KEY = 'deck'`, `export const DISCARD_KEY = 'discard'`, `export const HELD_KEY = 'held'`, `export const slotKey = (seat: Seat, slot: number) => \`slot-${seat}-${slot}\``
  - `export function slides(previous: PublicGameState, next: PublicGameState): [string, string][]` (`[from key, to key]`; the same for every viewer, since other racks are keyed per seat too)
  - `export default function animateMove(change: MoveChange<PublicGameState>): void`

- [ ] **Step 1: Write the failing tests**, built like Task 10's (`game`, `after`, `view`)

```ts
test('a draw slides the card from its pile to the holding spot, for every player', () => {
  assert.deepEqual(slides(view(before, 2), view(after(before, { type: 'draw', from: 'deck' }), 2)), [[DECK_KEY, HELD_KEY]]);
  // from the discard pile: [[DISCARD_KEY, HELD_KEY]]
});
test('a swap slides the held card into the slot and the replaced card to the discard pile', () => {
  // place slot 4 by Alice: [[HELD_KEY, slotKey(1, 4)], [slotKey(1, 4), DISCARD_KEY]], in Alice's and in Bob's view
});
test('discarding a card from the draw pile slides it from the holding spot to the discard pile', () => {
  // [[HELD_KEY, DISCARD_KEY]]
});
test('a swap that calls Rack-O and ends the round slides like any swap', () => {
  // roundSummary set; same two slides
});
test('nothing slides without a last move', () => { /* [] */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test games/racko/client/animateMove.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement** the keys, `slides`, `animateMove`, and register it in `rackoClient`.

- [ ] **Step 4: Run to verify they pass** (same command)
Expected: PASS

- [ ] **Step 5: Add the e2e test** "cards slide where they went, and nothing animates with reduced motion" in "Rack-O controls and platform", as in Task 10, using its `drawPile` and `slot` helpers.

Run: `npx playwright test e2e/racko.spec.ts`
Expected: PASS

- [ ] **Step 6: Browser check** at 375 px and 1280 px, light and dark: the held card arrives from the right pile; a swap slides in and the replaced card leaves for the discard pile; the other player sees a card back go to and from the right slot; live and in History.

- [ ] **Step 7: Update** `games/racko/README.md` (Controls: "Cards slide from the pile to the card in hand, into the rack slot, and from the slot to the discard pile").

- [ ] **Step 8: Commit**

```bash
git add games/racko e2e/racko.spec.ts
git commit -m "Animate Rack-O moves"
```

---

### Task 12: Yahtzee move animations

**Files:**
- Modify: `src/animation/motion.ts` (add `tumble`)
- Create: `games/yahtzee/client/animateMove.ts`
- Test: `games/yahtzee/client/animateMove.test.ts`
- Modify: `games/yahtzee/client/GameScreen.tsx` (ref, `useMoveAnimation`, `animKeyPrefix="die"` and a `DICE_KEY` wrapper on the dice), `HistoryBoard.tsx` (same keys), `ScoreSheet.tsx` (`cellKey` on every cell), `index.ts`
- Modify: `e2e/yahtzee.spec.ts`, `games/yahtzee/README.md`

**Interfaces:**
- Consumes: `MoveChange`, `slideFrom`, `Dice` (`animKeyPrefix`)
- Produces:
  - `src/animation/motion.ts`: `export function tumble(element: Element, durationMs = MOVE_DURATION_MS): void` (a short rotate and bounce; cancels a running one; none under reduced motion)
  - `games/yahtzee/client/animateMove.ts`:
    - `export const DICE_KEY = 'dice'`, `export const dieKey = (index: number) => \`die-${index}\``, `export const cellKey = (seat: Seat, category: Category) => \`cell-${seat}-${category}\``
    - `export function tumbling(next: PublicGameState): number[]` (indexes of the dice that rolled)
    - `export function scoreSlide(next: PublicGameState): [string, string] | null` (`[from key, to key]`)
    - `export default function animateMove(change: MoveChange<PublicGameState>): void`

- [ ] **Step 1: Write the failing tests**, built on `applyMove` with queued dice like the other tests

```ts
test('the first roll of a turn tumbles all five dice', () => {
  assert.deepEqual(tumbling(after(start, { type: 'roll', hold: [false, false, false, false, false] })), [0, 1, 2, 3, 4]);
});
test('a reroll tumbles only the dice not held', () => {
  assert.deepEqual(tumbling(after(rolled, { type: 'roll', hold: [true, false, true, false, false] })), [1, 3, 4]);
});
test('scoring tumbles nothing and slides the points from the dice to their box', () => {
  const next = after(rolled, { type: 'score', category: 'chance' });
  assert.deepEqual(tumbling(next), []);
  assert.deepEqual(scoreSlide(next), [DICE_KEY, cellKey(1, 'chance')]);
});
test('scoring the last box of the game still slides the points', () => { /* isGameOver, same slide */ });
test('a roll slides nothing', () => { assert.equal(scoreSlide(after(start, roll)), null); });
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test games/yahtzee/client/animateMove.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement** `tumble`, the keys, `tumbling`, `scoreSlide`, `animateMove`, and register it in `yahtzeeClient`.

- [ ] **Step 4: Run to verify they pass** (same command)
Expected: PASS

- [ ] **Step 5: Add the e2e test** "dice tumble and the score slides to its box, and nothing animates with reduced motion" to `e2e/yahtzee.spec.ts`, as in Task 10, queuing faces with `table.dice(...)`.

Run: `npx playwright test e2e/yahtzee.spec.ts`
Expected: PASS

- [ ] **Step 6: Browser check** at 375 px and 1280 px, light and dark: held dice stay still while the others tumble; the score lands in the right row and column (the sheet scrolls sideways at phone width, and the slide still ends in the cell); live and in History.

- [ ] **Step 7: Update** `games/yahtzee/README.md` (Controls: "Rolled dice tumble while held dice stay still; the score slides from the dice into its box") and the architecture animation paragraph (`tumble`).

- [ ] **Step 8: Commit**

```bash
git add src/animation/motion.ts games/yahtzee e2e/yahtzee.spec.ts docs/architecture.md
git commit -m "Animate Yahtzee rolls and scores"
```

---

### Task 13: Highlight newly drawn cards: shared hook, Phase 10, Rack-O

**Files:**
- Create: `src/hooks/newlyDrawn.ts` (pure), `src/hooks/useNewlyDrawn.ts`
- Test: `src/hooks/newlyDrawn.test.ts`
- Modify: `src/App.scss` (`.newly-drawn` default outline, `--newly-drawn-outline`)
- Create: `games/phase10/client/drawn.ts`; Test: `games/phase10/client/drawn.test.ts`
- Modify: `games/phase10/client/CardView.tsx` (`drawn` prop adds `newly-drawn`), `GameScreen.tsx`
- Modify: `games/racko/client/Tile.tsx` (`drawn` prop), `Table.tsx` (the held tile is `drawn` while `myHeld !== null` and the preference is on)
- Modify: `e2e/phase10.spec.ts`, `e2e/racko.spec.ts`, both READMEs and FAQs, `docs/architecture.md`

**Interfaces:**
- Consumes: `usePreferences` (Task 1); `setPreference` (Task 2)
- Produces:
  - `src/hooks/newlyDrawn.ts`:
    - `export type DrawnStep<K> = { add: K[]; clear: boolean }`
    - `export function nextDrawn<K>(current: K[], previousMoveCount: number | null, nextMoveCount: number, step: () => DrawnStep<K>): K[]` (null previous: `[]`; same count: `current`; one more: `clear ? add : [...current, ...add]`; anything else: `[]`)
  - `src/hooks/useNewlyDrawn.ts`: `export default function useNewlyDrawn<P extends BasePublicState, K>(state: P, step: (previous: P, next: P) => DrawnStep<K>): K[]` (live screens only; returns `[]` while `highlightDrawn` is off; the slide animation is independent)
  - `games/phase10/client/drawn.ts`: `export function drawnStep(previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<number>` (card ids)

The end of the highlight, per game (state it in each README):
- Phase 10: from your draw until your discard ends the turn (laying down and hitting keep it)
- Rack-O: while the drawn card is held, until you swap it into the rack or discard it

- [ ] **Step 1: Write the failing tests**

`src/hooks/newlyDrawn.test.ts`:
```ts
const step = (add: number[], clear = false) => () => ({ add, clear });
test('the first state highlights nothing', () => { assert.deepEqual(nextDrawn([], null, 4, step([1])), []); });
test('one more move adds what the step drew', () => { assert.deepEqual(nextDrawn([1], 4, 5, step([2])), [1, 2]); });
test('a clearing step drops the earlier cards first', () => { assert.deepEqual(nextDrawn([1], 4, 5, step([2], true)), [2]); });
test('a vote, an action or a disconnect (same move count) keeps the highlight', () => { assert.deepEqual(nextDrawn([1], 5, 5, step([9])), [1]); });
test('an undo or a jump of several moves clears it', () => {
  assert.deepEqual(nextDrawn([1], 5, 4, step([9])), []);
  assert.deepEqual(nextDrawn([1], 5, 7, step([9])), []);
});
```

`games/phase10/client/drawn.test.ts` (Task 10's builders):
```ts
test('your draw highlights the drawn card and starts fresh', () => { /* { add: [id], clear: true } */ });
test('laying down and hitting keep the highlight', () => { /* { add: [], clear: false } */ });
test('your discard clears it', () => { /* { add: [], clear: true } */ });
test("another player's moves change nothing", () => { /* { add: [], clear: false } */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/hooks/newlyDrawn.test.ts games/phase10/client/drawn.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement** `nextDrawn`, `useNewlyDrawn`, Phase 10's `drawnStep` and the `drawn` props; the default outline in `App.scss` (`:where([data-game] .newly-drawn) { outline: 3px solid var(--newly-drawn-outline, #f5b301); outline-offset: 2px; }`), overridden in a game's SCSS only where it clashes with that game's selected outline.

- [ ] **Step 4: Run to verify they pass** (same command)
Expected: PASS

- [ ] **Step 5: Add the e2e tests**

Phase 10:
```ts
test('the card you drew is outlined until you discard, and not with the setting off', async ({ seat }) => {
  // deal with drawTop [n(9, 'red')]; draw from the pile: handCards(alice).locator('.newly-drawn') has 1, labelled "Red 9"
  // discard another card: count 0
  // setPreference(alice, 'Highlight newly drawn cards', false) then draw on the next turn: count 0
});
```
Rack-O: "the card you drew is outlined while you hold it": draw from the draw pile, the held tile has class `newly-drawn`; after `slot(alice, 2).click()` none does.

Run: `npx playwright test e2e/phase10.spec.ts e2e/racko.spec.ts -g "outlined"`
Expected: PASS

- [ ] **Step 6: Browser check** at 375 px and 1280 px, light and dark: the outline is visible against the card and the table, does not clip in the hand's row, and does not look like Phase 10's selected state.

- [ ] **Step 7: Update** both READMEs (Controls line with the end rule above), both FAQs ("Why is a card in my hand outlined?"), and `docs/architecture.md` (`useNewlyDrawn`, `.newly-drawn`).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/newlyDrawn.ts src/hooks/newlyDrawn.test.ts src/hooks/useNewlyDrawn.ts src/App.scss games/phase10 games/racko e2e/phase10.spec.ts e2e/racko.spec.ts docs/architecture.md
git commit -m "Highlight newly drawn cards in Phase 10 and Rack-O"
```

---

### Task 14: Highlight newly drawn cards: Uno, Skip-Bo, Rummikub, Go Fish, Ticket to Ride

**Files:**
- Create and test, per game: `games/<id>/client/drawn.ts` and `drawn.test.ts` for `uno`, `skipbo`, `rummikub`, `gofish`, `tickettoride`
- Modify: `games/uno/client/Card.tsx` and `GameScreen.tsx`; `games/skipbo/client/CardView.tsx` and `Hand.tsx`; `games/rummikub/client/Tile.tsx` and `PlayArea.tsx` (the rack); `src/components/PlayingCard.tsx` (`drawn` prop adds `newly-drawn`) and `games/gofish/client/Hand.tsx`; `games/tickettoride/client/pieces.tsx` (`CardFace` `drawn`) and `HandPanel.tsx`
- Modify: each game's e2e spec, README, FAQ; `docs/architecture.md` (`PlayingCard`'s `drawn`)

**Interfaces:**
- Consumes: `DrawnStep`, `useNewlyDrawn` (Task 13)
- Produces, each `export function drawnStep(previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<K>`:
  - Uno, `K = Card`: `add` the cards new in `hand` (as a multiset), `clear` when `lastMove.playerNumber === seat`. Also `export function markDrawn(hand: Card[], drawn: Card[]): boolean[]` (each drawn card marks one matching slot of the sorted hand)
  - Skip-Bo, `K = number` (card id): `add` the ids new in `myHand`, `clear` on your `discard` or `endTurn`
  - Rummikub, `K = number` (tile id): `clear` on any move of yours, `add` the new rack ids on your `draw`
  - Go Fish, `K = string` (`cardKey`): `clear` when `lastMove.asker === seat`, `add` the fished card when it is in your hand
  - Ticket to Ride, `K = Card` (color): `add` the colors whose count grew on your `drawCard`, `clear` on any move of yours except the second card of a draw

End rules for the READMEs: Uno "until your next move"; Skip-Bo "until your discard ends the turn"; Rummikub "until your move on your next turn"; Go Fish "until your next ask"; Ticket to Ride "both cards of a draw stay outlined until your next turn's move".

- [ ] **Step 1: Write the failing unit tests**, one file per game, built on that game's `applyMove` and `toPublicState`:
  - Uno: "your draw outlines the card you drew"; "cards a Draw Two makes you take stay outlined until your next move"; "your next play clears them"; and for `markDrawn`: "two copies of one card mark only as many as were drawn"
  - Skip-Bo: "the cards dealt for your turn are outlined"; "refilling an emptied hand mid-turn outlines the new cards"; "your discard clears them"
  - Rummikub: "a drawn tile is outlined until your next move"; "a play draws nothing"
  - Go Fish: "a card fished from the stock is outlined until your next ask"; "cards handed to you are not"
  - Ticket to Ride: "both cards of a draw stay outlined"; "claiming a route clears them"; "another player's draw changes nothing"

- [ ] **Step 2: Run to verify they fail**

Run: `node --test games/uno/client/drawn.test.ts games/skipbo/client/drawn.test.ts games/rummikub/client/drawn.test.ts games/gofish/client/drawn.test.ts games/tickettoride/client/drawn.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement** the step functions and the `drawn` props in the listed components.

- [ ] **Step 4: Run to verify they pass** (same command)
Expected: PASS

- [ ] **Step 5: Add one e2e test per game**, "the card you drew is outlined <end rule>", asserting `.newly-drawn` count 1 after the draw and 0 after the clearing action, with that spec's existing helpers.

Run: `npx playwright test e2e/uno.spec.ts e2e/skipbo.spec.ts e2e/rummikub.spec.ts e2e/gofish.spec.ts e2e/tickettoride.spec.ts -g "outlined"`
Expected: PASS

- [ ] **Step 6: Browser check** each game at 375 px and 1280 px, light and dark, as in Task 13; in Rummikub also drag a highlighted tile within the rack and confirm the outline follows it.

- [ ] **Step 7: Update** the five READMEs and FAQs, and the `PlayingCard` line in `docs/architecture.md`.

- [ ] **Step 8: Commit**

```bash
git add games/uno games/skipbo games/rummikub games/gofish games/tickettoride src/components/PlayingCard.tsx e2e docs/architecture.md
git commit -m "Highlight newly drawn cards in Uno, Skip-Bo, Rummikub, Go Fish and Ticket to Ride"
```

---

### Task 15: Final docs check and full verification

**Files:**
- Modify (only if a gap is found): `README.md`, `docs/architecture.md`

- [ ] **Step 1: Read** `docs/architecture.md` and `README.md` end to end: the Settings dialog, the sound rules and timer hook point, the symbol table, `useNewlyDrawn`, the new `motion.ts` helpers, and the new App.scss selectors are all there, with no em-dashes (`grep -nP "\x{2014}" README.md docs/architecture.md games/*/README.md games/*/client/faq.ts` prints nothing).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exits 0, no warnings

- [ ] **Step 3: Unit tests**

Run: `npm test`
Expected: all pass, 0 failures

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: typecheck and Vite build succeed

- [ ] **Step 5: End-to-end tests**

Run: `npm run test:e2e`
Expected: all pass

- [ ] **Step 6: Final browser pass.** `npm start`; at 375 px and 1280 px, in light and dark: the landing page and three game headers with the gear (Connect Four, Azul, Quoridor); the Settings dialog; a saved game opened from the landing page with symbols on shows them; a Phase 10 game with sounds, symbols, highlight and animations all on, played for a few turns in two windows, with no overlap, blank rows or misplaced controls.

- [ ] **Step 7: Commit** any doc fixes

```bash
git add README.md docs/architecture.md
git commit -m "Document preferences and game feel"
```
