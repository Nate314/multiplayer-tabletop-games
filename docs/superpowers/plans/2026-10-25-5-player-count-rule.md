# Player Count House Rule Without the Checkbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove "I know what I'm doing"; the host sets "Most players" directly, and a seat count outside the normal range is a house rule everyone agrees to.

**Architecture:** In `shared/houseRules.ts`, drop the `override` flag. `maxPlayers` alone says whether the table was raised; the stretched minimum always applies, and seating below the normal minimum is described as a house rule line. Old saved states with `override` are normalized on read.

**Tech Stack:** TypeScript, node:test, React 19, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md` (changeset 5). Read the index plan for Global Constraints, ports (PORT 3105, E2E_PORT_BASE 6190) and delivery.

## Review Focus (this changeset)

- Old saved room with `override: true, maxPlayers: 8` loads with a table of 8; `override: false` loads with the normal table (Task 1).
- Catan with 2 seated can start after both agree, and a third can still join before the first move (Task 1, Task 3).
- Lowering "Most players" below the seated count is refused (the field minimum is the seated count) (Task 2).
- Any seat change still clears agreements, so a 2-player Catan that becomes 3 must agree again (Task 1).

---

### Task 1: Model

**Files:** Modify `shared/houseRules.ts`, `shared/seating.ts` and `server/games.ts` where they read `override`, game rule files and tests that build `override` (grep `override` in `shared/ server/ games/`); test `shared/houseRules.test.ts`
- `HouseRulesState` drops `override`; `maxPlayers: number | null` (null: the normal maximum). `HouseRulesProposal = { values: HouseRuleValues; maxPlayers: number | null }`; a proposal still carrying `override` is accepted and ignored.
- `tableLimit(info, state) = state.houseRules?.maxPlayers ?? info.maxPlayers`.
- `minimumToStart(info, state) = info.stretchedPlayers?.min ?? info.minPlayers`, unchanged for games without a stretched range.
- `describeHouseRules(info, rules, seated: number)` (add the seated count; update callers) adds `{ label: 'Players', value: '<seated>', standard: false }` when `seated < info.minPlayers`, and `{ label: 'Most players', value: '<maxPlayers>', standard: false }` when `maxPlayers > info.maxPlayers`.
- `houseRulesOf` normalizes a stored state: `override === false` gives `maxPlayers: null`; `override` is then dropped.
- `setHouseRules` validates `maxPlayers` is null or an integer from `max(seated, stretchedPlayers.min)` to `stretchedPlayers.max`, refusing anything else with the existing error style; a value equal to `info.maxPlayers` is stored as null.
- [ ] **Step 1: Failing tests**: the bullets above, plus Catan (`minPlayers 3`, stretched `{min 2, max 6}`): `minimumToStart` is 2; with 2 seated `describeHouseRules` lists "Players: 2" as non-standard; with 3 it does not. UNO stretched to 10: `maxPlayers: 10` gives `tableLimit` 10 and a "Most players: 10" line. Old `{ override: false, maxPlayers: null }` and `{ override: true, maxPlayers: 8 }` load as described in Review Focus.
- [ ] Steps 2 to 5: run, implement, `npm test` (all game tests), commit `Make the player count a plain house rule`.

### Task 2: Panel and copy

**Files:** Modify `src/components/HouseRulesPanel.tsx` (remove the checkbox; always show `MostPlayersField` for a game with `stretchedPlayers`, value `rules.maxPlayers ?? game.maxPlayers`, min `max(seated, stretched.min)`, max `stretched.max`; committing the normal maximum proposes `maxPlayers: null`), `src/components/HouseRulesSection.tsx` (pass the seated count), `src/components/gameFilters.ts` comment, every FAQ and README mentioning "I know what I'm doing" (Catan, Farkle, Hold'em, Phase 10, Rook, UNO, and any grep finds), `docs/architecture.md`, `e2e/houseRules.spec.ts` and any spec that ticks the checkbox.
- New FAQ wording example (Catan): "Two players can play when the host is fine with it: the table shows "Players: 2 (house rule)" and everyone has to agree before play starts."
- [ ] **Step 1: Failing e2e**: no "I know what I'm doing" text anywhere in the house rules panel; UNO host sets Most players to 10 and 9 players can join; Catan with 2 seated shows "Players: 2 (house rule)" in the panel, both agree, the first roll works.
- [ ] Steps 2 to 4: run, implement, `E2E_PORT_BASE=6190 npx playwright test e2e/houseRules.spec.ts e2e/catan.spec.ts e2e/uno.spec.ts e2e/rook.spec.ts` pass; grep for the old phrase returns nothing outside git history; browser check of the panel as host and guest, both themes, 390 and 320 px.
- [ ] **Step 5:** Commit `Remove the "I know what I'm doing" checkbox`, open the PR titled "Player count as a house rule without the checkbox".
