# Filter Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home screen shows only the search box and a Filter button; sort, categories, Players and Clear filters move into a panel the button opens.

**Architecture:** `GameFilters.tsx` keeps owning the controls; a new `FilterPanel` holds all but search, opened by a button showing the active count. The existing outside-press hook (`src/hooks/useDismiss.ts`) and `useEscapeKey` close it.

**Tech Stack:** React 19, SCSS, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md` (changeset 4). Read the index plan for Global Constraints, ports (PORT 3104, E2E_PORT_BASE 6170) and delivery.

## Review Focus (this changeset)

- Filters remembered from a past visit are on but the panel is closed: the button reads "Filter (n)" and the "No games match these filters" message offers Clear filters (Task 1, Task 2).
- Phone width: the panel fits at 320 px without sideways scroll and above the cards (browser check).
- Keyboard: the button has `aria-expanded`, focus moves into the panel on open and back to the button on Escape (Task 2).

---

### Task 1: Active filter count

**Files:** Modify `src/components/gameFilters.ts`; test `src/components/gameFilters.test.ts`
- Produces: `activeFilterCount(filters: LandingFilters): number` = number of selected categories + (players set ? 1 : 0). Search and sort are not counted (search is visible; sort is not a filter, Clear keeps it).
- [ ] Failing test (`{ categories: ['classic','cards'], players: 4 }` is 3; defaults are 0; search text alone is 0), implement, pass, commit `Count the active landing filters`.

### Task 2: Filter button and panel

**Files:** Modify `src/components/GameFilters.tsx`, `src/components/GameList.tsx` (Clear filters next to the no-match message), `src/App.scss`; update `e2e/landing.spec.ts` (open the panel before using sort, chips or Players).
- The row is `[search box][Filter button]`. Button label "Filter" or "Filter (n)", `aria-expanded`, `aria-controls`. The panel is a popover under the row on desktop and full width on phones, holding sort, category chips, Players and Clear filters as today. Outside press or Escape closes it; changing a filter leaves it open.
- [ ] **Step 1: Failing e2e**: on load, sort, chips and Players are not visible; click Filter, they are; pick a category, the button reads "Filter (1)"; press Escape, the panel closes and still reads "Filter (1)"; reload, it still reads "Filter (1)"; a filter that matches nothing shows the no-match message with Clear filters, which empties the count.
- [ ] Steps 2 to 4: run, implement, `E2E_PORT_BASE=6170 npx playwright test e2e/landing.spec.ts` passes; browser check at desktop, 390 and 320 px, both themes.
- [ ] **Step 5:** Update `docs/architecture.md` (GameList paragraph). Commit `Tuck the landing filters behind a Filter button`, open the PR titled "Hide the home screen filters behind a Filter button".
