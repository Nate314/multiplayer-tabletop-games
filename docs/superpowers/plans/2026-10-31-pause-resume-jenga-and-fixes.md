# Pause and resume, Jenga turntable, Rummikub and other fixes: Implementation Plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nine changesets, each built in its own worktree and PR, combined into one PR.

**Architecture:** Each changeset has its own plan file below. They are independent, so all nine run in one wave, each branching from the integration branch `pause-resume-jenga-and-fixes` (which holds the spec and these plans). Their PRs target that branch and are merged into it in table order, then one combined PR goes to master. The names in Shared contracts are fixed here so changesets built in parallel agree.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6, SCSS, Express 5, ws, node:sqlite, node:test, Playwright, three.js and Rapier (Jenga only). Node runs server TypeScript directly (type stripping, so no JSX and no enums in server-imported files). Node's built-in `crypto` covers AES-GCM and HMAC for plan 9.

**Spec:** `docs/superpowers/specs/2026-10-31-pause-resume-jenga-and-fixes-design.md`. Plan numbers follow the spec's section numbers.

## The changesets

| # | Plan | Branch | Server PORT | E2E_PORT_BASE |
|---|------|--------|-------------|---------------|
| 1 | `2026-10-31-01-storage-prefix.md` | `storage-prefix` | 3201 | 6410 |
| 2 | `2026-10-31-02-rummikub.md` | `rummikub-rules-and-save` | 3202 | 6430 |
| 3 | `2026-10-31-03-phase10-overplay.md` | `phase10-overplay` | 3203 | 6450 |
| 4 | `2026-10-31-04-hide-button.md` | `hide-button` | 3204 | 6470 |
| 5 | `2026-10-31-05-os-accent.md` | `os-accent` | 3205 | 6490 |
| 6 | `2026-10-31-06-scrabble-ghost-tile.md` | `scrabble-ghost-tile` | 3206 | 6510 |
| 7 | `2026-10-31-07-join-and-table-screen.md` | `join-and-table-screen` | 3207 | 6530 |
| 8 | `2026-10-31-08-jenga.md` | `jenga-turntable` | 3208 | 6550 |
| 9 | `2026-10-31-09-pause-resume.md` | `pause-resume` | 3209 | 6570 |

## Shared contracts

These names are fixed. A plan that introduces one implements it exactly; a plan that consumes one may rely on it.

- **Storage prefix** (plan 1): `STORAGE_PREFIX = 'multiplayer-tabletop-games:'` exported from `src/services/storage.ts`. Every browser storage read and write goes through that module. Other plans that add a storage key use the module and pass the bare key.
- **Header buttons** (plans 4, 7 and 9 each add one to the game page header): add each button next to the existing header controls without restructuring the header. Plan 4's is "Hide" / "Show", plan 7's (table screen only) is "Show QR code", plan 9's is "Pause".
- **Secret state** (plan 9 introduces, plan 8 must respect): `GameDefinition.secretState?(state: S): unknown` returns everything hidden from every player (draw piles, bags, Jenga grips). `privateSeatView` (existing) returns a seat's own private part. Plan 9 adds `secretState` to every game. Plan 8 keeps Jenga's turntable angle in public state and leaves grips where they are, so plan 9's Jenga entry holds at merge.
- **Votes** (plan 9): `pauseVote?: { requestedBy: Seat; votes: Record<Seat, boolean> } | null` and `paused?: boolean` on `BaseGameState`, following the undo vote pattern.
- **Jenga house rule** (plan 8): id `freePlacement`, label "Free placement", off by default.
- **Rummikub house rules** (plan 2): ids `freeJokers` ("Jokers move freely") and `addOnFirstMeld` ("Add to melds on your first turn"), both off by default.

Planners: when you need a new cross-plan name, add it to your plan's Global Constraints under "Contract additions" and keep it inside your own files where possible.

## Global Constraints

Every task in every changeset includes these:

- No new npm dependencies.
- Server, `shared/`, and the non-client files of each game never import from `src/` or `games/<id>/client/`.
- Game SCSS stays nested under `[data-game="<id>"]`. New pictures and icons are server SVGs (`shared/svg`, `ServerSvg`).
- Hidden information never reaches a spectator, pass-and-play neighbor, table screen, history, export, pause file (except as the spec allows), notification or stats.
- Saved rooms and exported game files from before this change still load and play back. New state fields are optional.
- Update `docs/architecture.md`, README.md, affected game READMEs, and FAQ text wherever behavior changes.
- No em-dashes in any prose, comments, commits or PR bodies.
- Match the surrounding code: comment density, naming, idiom (one-line "why" comments, no JSDoc blocks).
- Node: if `node` is not found in Git Bash, run `export PATH=/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH` (check `ls /c/Users/Natha/AppData/Local/nvm` for the installed version matching `.nvmrc`).
- Ports: use only the PORT and E2E_PORT_BASE in the table above for your changeset. Never port 6000.
- Gates before the PR: `npm run lint`, `npm test`, `npm run build` all pass; the e2e specs named in your plan pass (`E2E_PORT_BASE=<yours> npx playwright test <specs>`). A failure is rerun alone once to separate a flake, and both results go in the PR.
- Browser check: load the Chrome tools in one ToolSearch call, open your own new tab (other agents share Chrome; never touch other tabs), run `PORT=<yours> node server/server.ts` after `npx vite build`, and use the changed UI in light and dark mode, at desktop width and at 390 px and 320 px. The window cannot be resized, so check phone widths with same-origin iframes of those widths and set `data-theme` on each iframe's documentElement. Never trigger alert or confirm dialogs.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akft2et2RTSSiSNUMGJ
  ```
- PR (`gh pr create --base pause-resume-jenga-and-fixes`): the body has Summary, Rulings (calls you made), Known gaps and Verification (the exact commands and results), and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, a blank line, and `https://claude.ai/code/session_01ME2Akft2et2RTSSiSNUMGJ`.

## Review Focus

1. A pause file, history step or another player's view carrying someone else's hand or the draw pile in readable form (plan 9).
2. Players lose their device ID, theme or seat after the storage prefix update because migration missed a key or the inline theme script (plan 1).
3. A Rummikub house rule that lets an invalid table through, or the strict joker fix rejecting a legal official play (plan 2).
4. The Jenga turntable desyncing between the server's physics and the browser's prediction, or a spin outside your turn moving the tower (plan 8).
5. A paused game deleted by the 10 minute cleanup, or resumed with a seat missing (plan 9).

## Combining

1. After all nine PRs are green, merge them into `pause-resume-jenga-and-fixes` in table order, resolving conflicts toward the later changeset's intent. Rerun `npm run lint`, `npm test`, `npm run build` and the full e2e suite on the merged branch.
2. Known overlaps:
   - Game page header: plans 4, 7 and 9. On phones, plan 4 puts Hide in the title row and plan 9 puts Pause in the Settings dialog's phone controls; check all three together at 320 px. A dialog rendered as a direct child of `.game-root` is hidden by plan 4's Hide.
   - `src/animation/useMoveAnimation.ts` and `motion.ts`: plan 2. Plan 6 adds `src/assets/pieceArt.ts` and stays out of both.
   - `e2e/fixtures.ts`: plans 4 and 6 both add exports.
   - Jenga `manager.test.ts`, and Rummikub's: both gain a house rule, so both need `agreeAll`.
   - `src/services/storage.ts` and its callers: plan 1, and any plan that adds a key.
   - Jenga state and definition: plans 8 and 9 (turntable angle in the pause file and `secretState`).
   - `server/games.ts` room lifecycle: plans 7 and 9.
   - Rummikub and Phase 10 `GameDefinition`s: plans 2, 3 and 9.
3. Browser-check the merged branch, then open the combined PR from `pause-resume-jenga-and-fixes` to master in the format of PR #50: one bullet per temporary PR linking it, then the integration work, known gaps and verification. Then close the nine temporary PRs with a comment pointing to the combined PR. Delete their remote branches only after confirming that each delete succeeded.
