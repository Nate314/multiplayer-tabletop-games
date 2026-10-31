# Phase 10: Play Beyond the Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When laying down a phase, each part may hold more cards than the phase asks for (a run of 8 or more for a run of 7, a set of 4 or more for a set of 3, 8 or more cards of one color for 7), while the number of groups stays exactly what the phase calls for.

**Architecture:** The only rule that pins a group's size is the first line of `buildGroup` in `games/phase10/rules.ts` (`cards.length !== requirement.size`). It becomes a minimum. `layDown` already refuses a different number of groups than the phase has, so extra groups stay refused with no change. The browser's `LayDownPanel` uses the same `buildGroup`, so "Lay down phase" enables for an overplayed group with no logic change; only its label and the docs that say "exactly" change. This is the default rule, not a house rule.

**Tech Stack:** TypeScript, React 19, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-pause-resume-jenga-and-fixes-design.md`, section 3. Index plan: `docs/superpowers/plans/2026-10-31-pause-resume-jenga-and-fixes.md` (shared contracts, global constraints, combining). Branch `phase10-overplay` from `pause-resume-jenga-and-fixes`. Server PORT 3203, E2E_PORT_BASE 6450.

## Global Constraints

All of the index plan's Global Constraints, plus:

- No new house rule, no new state field, no change to `Move`, `Group` or `Requirement` types. Saved rooms and game files load unchanged (they only ever hold groups of exact size, which stay valid).
- A group still needs at least one natural card and no Skip (`usable`), and a run still tops out at 12 cards (`runOf` already returns `null` when `length > MAX_VALUE`).
- Extra groups beyond the phase stay refused with today's error, `Phase ${phase} needs ${phaseName(phase)}`. Error messages for an invalid group stay as today (`Group 2 is not a set of 3`).
- `requirementName` and `phaseName` are unchanged (they feed errors, the FAQ phase list and the panel); "or more" is added only in the panel label.
- Panel label copy, exactly: `Group {n}: {requirementName} or more ({count} card|cards)`, e.g. `Group 1: a set of 3 or more (4 cards)`, `Group 2: a set of 2 or more (1 card)`, `Group 1: a run of 7 or more (0 cards)`.
- Contract additions: none. This plan touches only `games/phase10/` and `e2e/phase10.spec.ts`. Plan 9 adds `secretState` to the Phase 10 `GameDefinition` in `games/phase10/index.ts`, which this plan does not edit.

## Review Focus

1. A lay down that uses every card in the hand (11 cards for phase 1 after drawing): the hand must end at once with the player marked as going out and their phase completed, exactly as hitting the last card does today (Task 1 test).
2. A run overplayed with Wilds near 12 (9, 10, 11, 12 and four Wilds for a run of 7): the Wilds must go below the naturals so the run is 5 to 12, not past 12 (Task 1 test).
3. An overplayed run that would pass 12 cards (all twelve numbers plus a Wild): still refused (Task 1 test).
4. An extra third group for a two-part phase: refused with `Phase 1 needs 2 sets of 3`, not silently dropped (Task 1 test).
5. A group with a wrong card added to reach "more" (a 7 in the set of 5s): the panel must keep "Lay down phase" disabled (Task 2 e2e).

---

### Task 1: Groups may hold more cards than the phase part asks for

**Files:**
- Modify: `games/phase10/rules.ts:132-134` (`buildGroup` and its comment)
- Test: `games/phase10/rules.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildGroup(owner: Seat, requirement: Requirement, cards: Card[]): Group | null`, same signature, now returning a group for `cards.length >= requirement.size`. Its comment becomes "The group these cards make for one part of a phase (at least its size), or null if they do not make it". `LayDownPanel` (Task 2) and `layDown` rely on it unchanged.

- [ ] **Step 1: Write the failing tests** in `games/phase10/rules.test.ts`, using the file's `num`, `wild`, `ids`, `ok`, `move`, `readyToLayDown` helpers:
  - New test `a group may have more cards than its part of the phase asks for`, next to the existing `buildGroup` tests (around line 93):
    - `buildGroup(1, { kind: 'set', size: 3 }, [num(7), num(7, 'blue'), wild(), num(7, 'green')])` has `kind` `'set'`, `value` 7 and 4 cards.
    - A run of size 7 from `num(3)` to `num(10)` (8 naturals, in shuffled order) gives `start` 3 and 8 cards.
    - A run of size 7 from `[num(9), num(10), num(11), num(12), wild(), wild(), wild(), wild()]` gives `start` 5, 8 cards, and `cards.slice(4)` are the four naturals 9 to 12 in order (Review Focus 2).
    - A run of size 4 from `num(1)` to `num(12)` plus `wild()` (13 cards) is `null` (Review Focus 3).
    - `buildGroup(1, { kind: 'color', size: 7 }, <9 red numbers>)?.kind` is `'color'`.
    - Fewer still fails: the existing `buildGroup(1, { kind: 'set', size: 3 }, [num(7), num(7)])` stays `null` (already at line 97, leave it).
  - Rename `a lay down must use the exact cards of the current phase` to `a lay down must meet each part of the current phase, with no extra groups`, keep its assertions, and add:
    - `layDown([ids(sevens), ids(twos), [extra[0].id, extra[1].id]])` deep-equals `{ error: 'Phase 1 needs 2 sets of 3' }` (Review Focus 4).
  - New test `a lay down may put more cards in a group than the phase asks for`: from `readyToLayDown()`, `ok(move(state, 1, { type: 'layDown', groups: [[...ids(sevens), extra[0].id], ids(twos)] }))` has `groups[0].cards.length` 4, `groups[1].cards.length` 3, `ids(hands[1])` equal to `[extra[1].id]`, `laidPhase` `{ 1: 1 }` and `gameStatus` `'Alice laid down phase 1'`.
  - New test `laying down every card in the hand goes out`: `game({ hands: { 1: [...sevens, extra[0], ...twos], 2: [num(1)] }, drawnBy: 1 })` with `sevens`, `twos`, `extra` built as in `readyToLayDown`; laying down `[[...ids(sevens), extra[0].id], ids(twos)]` gives `handSummary?.wentOut` 1, `handSummary?.seats[1].completed` true, `phases[1]` 2, `currentPlayer` `null`, and `gameStatus` starting with `'Alice went out.'` (Review Focus 1).

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test games/phase10/rules.test.ts`
Expected: FAIL in the three new tests that lay down or build 4 or more cards for a smaller part (`buildGroup` returns `null`, `layDown` returns `Group 1 is not a set of 3`). The 13-card run and extra-group assertions already pass.

- [ ] **Step 3: Implement** in `games/phase10/rules.ts`: change the guard in `buildGroup` to `if (cards.length < requirement.size || !usable(cards)) return null;` and update its comment as in Interfaces. Nothing else in `rules.ts` changes.

- [ ] **Step 4: Run the Phase 10 unit tests**

Run: `node --test games/phase10/rules.test.ts games/phase10/manager.test.ts`
Expected: PASS (`manager.test.ts`'s `findPhase` picks exactly `size` cards, which is still valid).

- [ ] **Step 5: Commit**

```bash
git add games/phase10/rules.ts games/phase10/rules.test.ts
git commit -m "Phase 10: lay down more cards than a phase part asks for"
```

### Task 2: Lay down panel label, e2e and docs

**Files:**
- Modify: `games/phase10/client/LayDownPanel.tsx:43-45` (the `.group-label` text)
- Modify: `games/phase10/README.md` (lines 9 and 23), `games/phase10/client/faq.ts` (the "How do I lay down my phase?" answer, line 26)
- Test: `e2e/phase10.spec.ts` (the test at line 132)

**Interfaces:**
- Consumes: `buildGroup` from Task 1 (unchanged signature, now a minimum size).
- Produces: nothing other tasks use.

- [ ] **Step 1: Update the e2e test** at `e2e/phase10.spec.ts:132`. Rename it `you may lay down your phase once per hand, with more cards in a group than it asks for`. Same deal. Then:
  - After staging group 1 (`red 5`, `blue 5`, `green 5`, `yellow 7`) and group 2 (`red 7`, `blue 7`, `green 7`): expect `.lay-down` to contain `Group 1: a set of 3 or more (4 cards)` and "Lay down phase" disabled, with the comment changed to `// a 7 in the set of 5s` (Review Focus 5).
  - Click the staged `yellow 7` to return it; expect `Group 1: a set of 3 or more (3 cards)`.
  - `await stage(alice, 2, 'yellow 7')`; expect `Group 2: a set of 3 or more (4 cards)` and "Lay down phase" enabled; click it.
  - Expect `group(alice, 'Set of 5s').locator('.card')` count 3, `group(alice, 'Set of 7s').locator('.card')` count 4, `handRegion(alice)` to contain `Your hand (4)`, and `.lay-down` count 0.

- [ ] **Step 2: Run it to see it fail**

Run: `E2E_PORT_BASE=6450 npx playwright test e2e/phase10.spec.ts -g "more cards in a group"`
Expected: FAIL on the `or more (4 cards)` text (the label still reads `(4/3)`).

- [ ] **Step 3: Implement the label** in `LayDownPanel.tsx`: `Group {part + 1}: {requirementName(requirement)} or more ({cards.length} {cards.length === 1 ? 'card' : 'cards'})`. No other change to the panel: `valid` already uses `buildGroup`.

- [ ] **Step 4: Update the docs** (no em-dashes):
  - `games/phase10/README.md` line 9: replace "using exactly the cards it asks for" with "using at least the cards each part asks for: a group may have more, such as a run of 8 or more for a run of 7, a set of 4 or more for a set of 3, or 8 or more cards of one color. You cannot lay down a group the phase does not ask for; play extra cards by hitting afterwards".
  - `games/phase10/README.md` line 23: after "Lay down phase" is enabled once every group is right, add "; each group's label shows how many cards it holds, and a group may hold more than its part asks for".
  - `games/phase10/client/faq.ts` line 26: replace "You must use exactly the cards the phase asks for, and you can lay down only once per hand." with "Each group needs at least the cards its part asks for and may have more, such as a run of 8 for a run of 7 or a set of 4 for a set of 3, but you cannot add a group the phase does not ask for: play extra cards by hitting afterwards. You can lay down only once per hand."
  - `docs/architecture.md` and the root `README.md`: `grep -n -i "phase 10" docs/architecture.md README.md` and confirm no line describes the lay down size; no change expected. The README's "Differences" paragraph (line 37) needs no change, since the official rules allow overplay.

- [ ] **Step 5: Run the Phase 10 e2e specs**

Run: `E2E_PORT_BASE=6450 npx playwright test e2e/phase10.spec.ts e2e/handOnly.spec.ts`
Expected: PASS, including the `stage cards with Add selected to group...` test at line 520, which checks card counts, not label text.

- [ ] **Step 6: Commit**

```bash
git add games/phase10/client/LayDownPanel.tsx games/phase10/README.md games/phase10/client/faq.ts e2e/phase10.spec.ts
git commit -m "Phase 10: show overplay in the lay down panel and docs"
```

### Task 3: Gates, browser check and PR

**Files:** none changed unless a gate fails.

**Interfaces:** none.

- [ ] **Step 1: Run the gates**

Run: `npm run lint && npm test && npm run build`
Expected: all pass. Then `E2E_PORT_BASE=6450 npx playwright test e2e/phase10.spec.ts e2e/handOnly.spec.ts e2e/rules.spec.ts`, all pass (a failure is rerun alone once; both results go in the PR).

- [ ] **Step 2: Browser check.** `npx vite build`, then `PORT=3203 node server/server.ts`. In your own new Chrome tab, start a 2-player Phase 10 game (second player in a second tab of yours). On your turn after drawing, stage a part with one more card than it asks for and confirm the label reads `... or more (N cards)` and "Lay down phase" enables only once every group is valid, then lay it down and confirm the longer group shows on the table and in History. Check the panel and the laid-down group in light and dark mode, at desktop width and in same-origin iframes of 390 px and 320 px (set `data-theme` on each iframe's documentElement): the longer label must not overflow or overlap the "Add selected to group" button. Open Rules and FAQ and confirm the new text.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin phase10-overplay
gh pr create --base pause-resume-jenga-and-fixes --title "Phase 10: play beyond the phase" --body-file <scratchpad file>
```

Body: Summary; Rulings (extra groups refused with the existing error; "or more" and a card count in the panel label instead of `n/size`; error messages unchanged; going out by laying down every card is allowed, as it already was for hits); Known gaps; Verification (exact commands and results); ending with the index plan's attribution lines.
