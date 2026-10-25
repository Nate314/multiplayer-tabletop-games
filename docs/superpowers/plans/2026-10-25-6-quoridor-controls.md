# Quoridor Action Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The walls box is the one place to choose Move or a wall; the Horizontal Wall, Vertical Wall and Rotate buttons go away.

**Architecture:** Delete `TurnActions.tsx`. `PieceTray` gains a way to show a non-piece button first (Move), so the tray holds `[Move][Wall n]`. Tapping the wall uses the existing `nextWallAction(action, 'tap')` (pick up horizontal, then rotate); R still rotates; drag unchanged.

**Tech Stack:** React 19, SCSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md` (changeset 6). Read the index plan for Global Constraints, ports (PORT 3106, E2E_PORT_BASE 6210) and delivery.

## Review Focus (this changeset)

- No walls left: the wall is disabled with its reason as title and Move stays selected (Task 1).
- Not your turn: Move and the wall cannot change the board; the selection still shows (match current behavior) (Task 1).
- Tapping Move while holding a wall drops the wall and returns to moving (Task 1).
- Phone width 320 px: Move and the wall fit one row (browser check).

---

### Task 1: Move button in the walls box

**Files:** Modify `games/quoridor/client/GameScreen.tsx`, `src/components/PieceTray.tsx` (add optional `leading?: ReactNode` rendered before the pieces inside `.piece-tray-pieces`; Quoridor is its only user, so keep it minimal), `games/quoridor/client/quoridor.scss`; delete `games/quoridor/client/TurnActions.tsx`; update `e2e/quoridor.spec.ts`, `games/quoridor/README.md`, `games/quoridor/client/faq.ts`, `docs/architecture.md` if they mention the old buttons.
- The tray's label becomes "Your action". Move is a button with `aria-pressed={selectedAction === 'move'}` styled like a tray piece (a small pawn icon plus "Move"); clicking it sets `'move'`. The wall piece's `aria-pressed` is true while a wall is held; its icon shows the held orientation. No Rotate button.
- [ ] **Step 1: Failing e2e**: no buttons named "Horizontal Wall", "Vertical Wall" or "Rotate"; the "Your action" section contains Move and "Wall, 10 left"; click the wall, a horizontal wall can be placed; click it twice, a vertical wall can be placed; click Move, the pawn moves; press R while holding, the orientation changes.
- [ ] Steps 2 to 4: run, implement, `E2E_PORT_BASE=6210 npx playwright test e2e/quoridor.spec.ts` passes, browser check both themes at desktop, 390 and 320 px.
- [ ] **Step 5:** Commit `Put Move with the walls in Quoridor`, open the PR titled "Quoridor: Move and walls in one box".
