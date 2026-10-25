# Themed Form Controls Everywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every checkbox, dropdown and number box in the app is themed by default, in light and dark.

**Architecture:** Move the `.themed-select` / `.themed-checkbox` / `.themed-input` looks in `src/App.scss` onto the native elements (`select`, `input[type=checkbox]`, `input[type=number]`, and the text-like inputs `.themed-input` covers) inside `:where()` so any game SCSS still overrides them. Remove the classes from markup.

**Tech Stack:** SCSS, React 19, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md` (changeset 7). Read the index plan for Global Constraints, ports (PORT 3107, E2E_PORT_BASE 6230) and delivery.

## Review Focus (this changeset)

- A disabled control (a guest's read-only house rules) reads clearly as set but not editable, not faint grey (browser check, Task 2).
- Games that retheme controls (Azul, Catan, Monopoly; grep each game's SCSS for `select`, `checkbox`, `themed-`) keep their look (browser check).
- A checkbox not wrapped in a label (Monopoly property lists, house rules) still gets the themed box and a visible focus ring (browser check).
- Number boxes keep usable width at 320 px (Hold'em raise, Monopoly trade) (browser check).

---

### Task 1: Native controls themed by default

**Files:** Modify `src/App.scss` (and `src/index.scss` if base resets live there), every component using `themed-select`, `themed-checkbox`, `themed-input` (grep), `games/catan/client/catan.scss`, `games/monopoly/client/monopoly.scss` where they reference the classes.
- Checkbox: `appearance: none` box with the theme's border, background and check mark, `:checked`, `:focus-visible` and `:disabled` states. Select: themed border, background, text and arrow, options readable in dark mode. Number and text inputs: themed border and background. Keep the label-as-pill look in Settings (`.modal.settings`) where it exists today.
- [ ] Steps: `grep -rn "themed-select\|themed-checkbox\|themed-input" src games` returns nothing after the change (keep `themed-chip`, which is a button); `npm run lint`, `npm test`, `npm run build` pass; commit `Theme every checkbox, select and number box by default`.

### Task 2: Check every screen

- [ ] In Chrome, light and dark, open each screen with a control and fix what looks wrong: the Settings dialog, History playback gear, landing filters, house rules panel as host and as guest (Mancala, Chess clock, UNO), and in-game: Catan (bank trade, player trade, discard), Monopoly (trade, auction, mortgage), Rook (bid, called cards), Spades (bid), Phase 10 (lay down), Ticket to Ride, Risk, The Crew, War, Hold'em (raise). Use the e2e test hooks or the e2e specs' setup helpers to reach mid-game states quickly.
- [ ] `E2E_PORT_BASE=6230 npx playwright test e2e/settings.spec.ts e2e/houseRules.spec.ts e2e/landing.spec.ts e2e/history.spec.ts e2e/catan.spec.ts e2e/monopoly.spec.ts e2e/rook.spec.ts e2e/spades.spec.ts` pass.
- [ ] Screenshots of before and after for a few screens in the PR description is optional; list every screen checked. Commit fixes, open the PR titled "Theme every checkbox and dropdown".
