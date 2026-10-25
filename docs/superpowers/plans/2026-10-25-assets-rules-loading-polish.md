# Server assets, rules dialog, per-game loading, and polish: Implementation Plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eight independent changesets, each built in its own worktree and PR, then combined into one PR.

**Architecture:** Each changeset has its own plan file below and touches only its own area. They are built in parallel from master, then merged in the order under Combining.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6, SCSS, Express 5, ws, node:test, Playwright. Node runs server TypeScript directly (type stripping, so no JSX and no enums in server-imported files).

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md`

## The changesets

| # | Plan | Branch | Server PORT | E2E_PORT_BASE |
|---|------|--------|-------------|---------------|
| 1 | `2026-10-25-1-server-assets.md` | `server-assets` | 3101 | 6110 |
| 2 | `2026-10-25-2-rules-dialog.md` | `rules-dialog` | 3102 | 6130 |
| 3 | `2026-10-25-3-lazy-game-chunks.md` | `lazy-game-chunks` | 3103 | 6150 |
| 4 | `2026-10-25-4-filter-button.md` | `filter-button` | 3104 | 6170 |
| 5 | `2026-10-25-5-player-count-rule.md` | `player-count-rule` | 3105 | 6190 |
| 6 | `2026-10-25-6-quoridor-controls.md` | `quoridor-controls` | 3106 | 6210 |
| 7 | `2026-10-25-7-themed-controls.md` | `themed-controls` | 3107 | 6230 |
| 8 | `2026-10-25-8-azul-drag.md` | `azul-drag` | 3108 | 6250 |

## Global Constraints

Every task in every changeset includes these:

- No new npm dependencies, and no changes to package.json dependencies.
- Server, `shared/`, and the non-client files of each game never import from `src/` or `games/<id>/client/`.
- Game SCSS stays nested under `[data-game="<id>"]`.
- Update `docs/architecture.md`, affected game READMEs, and FAQ text wherever behavior changes.
- No em-dashes in any prose, comments, commits or PR bodies.
- Match the surrounding code: comment density, naming, idiom (one-line "why" comments, no JSDoc blocks).
- Node: if `node` is not found in Git Bash, run `export PATH=/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH`.
- Ports: use only the PORT and E2E_PORT_BASE in the table above for your changeset. Never port 6000.
- Gates before the PR: `npm run lint`, `npm test`, `npm run build` all pass; the e2e specs named in your plan pass (`E2E_PORT_BASE=<yours> npx playwright test <specs>`); a failure is rerun alone once to separate a flake, and both results go in the PR.
- Browser check: load the Chrome tools in one ToolSearch call, open your own new tab (other agents share Chrome; never touch other tabs), run `PORT=<yours> node server/server.ts` after `npx vite build`, and use the changed UI in light and dark mode, at desktop width and at 390 px and 320 px. The window cannot be resized, so check phone widths by replacing a tab's body with same-origin iframes of those widths and setting `data-theme` on each iframe's documentElement. Never trigger alert or confirm dialogs.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ga3pVQGT97diBzeRnAgfbG
  ```
- PR (`gh pr create --base master`): body has Summary, Rulings (calls you made), Known gaps, Verification (the exact commands and results), and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

Most likely to bite a player, across changesets. Each is pinned by a test in the owning plan:

1. A piece rendered before its server SVG has loaded shows nothing, or the board jumps (plan 1, Task 3 and Task 7).
2. A game chunk fails to load (offline, a deploy replaced the hashed file) and the player is stuck on a blank screen (plan 3, Task 2).
3. A two-player Catan table can no longer start, or a table above the normal maximum loses its seats when an old saved room with `override` is loaded (plan 5, Task 1).
4. A filter hidden behind the closed Filter panel empties the list with no sign of why (plan 4, Task 1 and Task 2).
5. A README link or HTML-looking text in a README renders as live HTML (plan 2, Task 1).

## Combining (after all eight PRs are green)

1. Create branch `assets-rules-loading-polish` from master.
2. Merge in this order, resolving conflicts toward the later changeset's intent: 3 (lazy chunks, reshapes the client registry), 1 (server assets), 2 (rules dialog), 5 (player count), 7 (themed controls), 4 (filter button), 6 (Quoridor), 8 (Azul drag).
3. Known overlaps: 3 vs 1, 2, 8 (ClientGame shape, FAQ, Azul client); 4, 5, 7 (`src/App.scss`, `GameFilters.tsx`, `HouseRulesPanel.tsx`); 1 vs 6, 8 (Quoridor and Azul pieces become server SVGs, drag and controls wrap them); 1 vs 3 (`App.tsx` routing).
4. Rerun every gate on the combined branch, including the full e2e suite and a Chrome pass over each feature; restate the bundle sizes.
5. Open the combined PR in the format of PR #28 (one bullet per temporary PR linking it, integration work, known gaps, verification). Then close the eight temporary PRs with a comment pointing to the combined PR, and delete their remote branches only after the combined PR is open.
