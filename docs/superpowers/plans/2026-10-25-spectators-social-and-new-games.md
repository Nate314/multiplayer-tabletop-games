# Spectators, rematch, alerts, in-person play, stats, and two new games: Implementation Plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twelve changesets, each built in its own worktree and PR, combined into one PR.

**Architecture:** Each changeset has its own plan file below. Some build on others, so they run in three waves. Each wave's PRs are merged into the integration branch `spectators-social`, and the next wave branches from it. The names in Shared contracts are fixed here so changesets built in parallel agree.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6, SCSS, Express 5, ws, node:sqlite, node:test, Playwright. Node runs server TypeScript directly (type stripping, so no JSX and no enums in server-imported files). Jenga alone adds three.js and Rapier.

**Spec:** `docs/superpowers/specs/2026-10-25-spectators-social-and-new-games-design.md`

## The changesets

| # | Plan | Branch | Wave | Starts from | Server PORT | E2E_PORT_BASE |
|---|------|--------|------|-------------|-------------|---------------|
| 1 | `2026-10-25-01-spectators.md` | `spectators` | 1 | master | 3101 | 6110 |
| 2 | `2026-10-25-02-game-over.md` | `game-over` | 1 | master | 3102 | 6130 |
| 5 | `2026-10-25-05-open-games.md` | `open-games` | 1 | master | 3105 | 6190 |
| 6 | `2026-10-25-06-reactions.md` | `reactions` | 1 | master | 3106 | 6210 |
| 7 | `2026-10-25-07-turn-timer.md` | `turn-timer` | 1 | master | 3107 | 6230 |
| 11 | `2026-10-25-11-pictionary.md` | `pictionary` | 1 | master | 3111 | 6310 |
| 12 | `2026-10-25-12-jenga.md` | `jenga` | 1 | master | 3112 | 6330 |
| 3 | `2026-10-25-03-rematch.md` | `rematch` | 2 | `spectators-social` after wave 1 | 3103 | 6150 |
| 8 | `2026-10-25-08-pass-and-play.md` | `pass-and-play` | 2 | `spectators-social` after wave 1 | 3108 | 6250 |
| 9 | `2026-10-25-09-table-screen.md` | `table-screen` | 2 | `spectators-social` after wave 1 | 3109 | 6270 |
| 4 | `2026-10-25-04-turn-alerts.md` | `turn-alerts` | 3 | `spectators-social` after wave 2 | 3104 | 6170 |
| 10 | `2026-10-25-10-stats.md` | `stats` | 3 | `spectators-social` after wave 2 | 3110 | 6290 |

Plan numbers follow the spec's feature numbers.

## Shared contracts

These names are fixed. A plan that introduces one implements it exactly; a plan that consumes one may rely on it.

- **Join roles** (plan 1 adds the type and the Player/Spectator switch; plans 8 and 9 add their values to the same switch):
  `type JoinRole = 'player' | 'spectator' | 'passAndPlay' | 'tableScreen'` in `shared/types.ts`. `JOIN_GAME` gains `role?: JoinRole` (missing means `'player'`). The last role is remembered in the existing join form preference.
- **Spectators** (plan 1), on `BaseGameState`:
  `spectators?: Spectator[]` with `type Spectator = { id: string; name: string; tableScreen: boolean; allowedSeats: Seat[] }`.
  `handRequests?: HandRequest[]` with `type HandRequest = { spectator: string; seat: Seat }`.
  Spectator secrets live in `spectatorKeys?: Record<string, string>`, stripped from every view like `seatKeys`. `GAME_JOINED` for a spectator carries `playerNumber: null` and `spectatorId`. A spectator's view is built by `spectatorView(definition, state, spectator)` in `shared/spectators.ts`.
  Each game may supply `privateSeatView?(state: S, seat: Seat): unknown` on `GameDefinition`, returning everything private to that seat. Plan 9's hand-only layouts render from the same data.
- **Standings** (plan 2): `type Standing = { seat: Seat; place: number; score?: string }` in `shared/types.ts`. `GameDefinition.finalStandings?(state: S): Standing[]`, with the platform fallback `standingsOf(definition, state)` in `shared/standings.ts` (winners first at place 1, everyone else at place 2).
- **Game end** (plan 2 adds it, plans 3 and 10 consume it): the server room manager calls `onGameFinished(result: GameResult)` once, when `isGameOver` first becomes true. Here `type GameResult = { archiveId: string; gameType: string; gameId: string; startedAt: number; finishedAt: number; moveCount: number; standings: Standing[]; players: { seat: Seat; name: string; deviceId?: string }[] }`. `archiveId` is `<gameType>/<gameId>#<n>`, where `n` counts the games played under that ID, starting at 1.
- **Rematch vote** (plan 3): `rematchVote?: RematchVote | null` with `type RematchVote = { requestedBy: Seat; votes: Record<Seat, boolean> }`, where `true` is Join and `false` is Drop.
- **Votes waiting on a seat** (plan 4 reads these): `undoVote`, `dismissVote`, `rematchVote`, and `handRequests` whose `seat` is the viewer.
- **Turn timer** (plan 7): a platform house rule with id `turnTimer` and values `0 | 30 | 60 | 120 | 300` (seconds, 0 means off), offered for every game. `turnStartedAt?: number | null` on `BaseGameState`.
- **Device ID** (plan 10): `JOIN_GAME` gains `deviceId?: string`, a random secret made once per browser and kept in `src/services/storage.ts` under the key `deviceId`. Plan 3's archive access accepts it for players after the room is gone.
- **Reactions** (plan 6): `REACT` client message `{ target: Seat; emoji: string }`. The server broadcasts `REACTION { from: string; fromSpectator: boolean; target: Seat; emoji: string; at: number }` and records it with the current `moveCount`.

### Contract additions found while planning

The plans below add these on top of the list above. Each is owned by the plan named.

- **Plan 1:**
  - The spectator key travels in the existing `seatKey` field of `JOIN_GAME` and `GAME_JOINED`.
  - The join call becomes `join(..., role?, deviceId?)`.
  - Connected spectators are tracked in memory on the room. Permissions stay in the saved state.
- **Plan 2:**
  - `standings?`, `startedAt?` and `finishedAt?` go on `BasePublicState`, in game-over views only.
  - `standingsOf` with no winners puts every seat at place 1.
  - `GameResult` gains `abandoned?: boolean`. It is true when the platform ended the game because fewer than two players remained after leaves or dismissals, rather than the game's own rules ending it. Plan 2 sets it and plan 10 skips those games.
- **Plan 3:**
  - `gameNumber?` goes on `BaseGameState`; missing means 1.
  - Plan 3 adds `ManagerHooks.reseated` and the `LEFT_GAME` server message.
  - Plan 3 adds `hashDeviceId(raw): string | null` in `server/devices.ts` and `seatDevices`, which plan 10 reuses.
  - `GameResult.players[].deviceId` holds the hash, never the raw ID.
- **Plan 5:** `OpenGame = { gameType; gameId; players: string[]; playing: boolean }` goes in `shared/types.ts`. Unknown `/api/` paths now return 404 instead of the app page.
- **Plan 6:** `RecordedReaction = Reaction & { moveCount }`. History steps gain an optional `reactions?`, and the game file stays at version 2.
- **Plan 7:**
  - `turnPausedAt?: number | null` goes next to `turnStartedAt`.
  - The signature becomes `needsAgreement(info, values)`, so a lobby needs Agree only when a game's own rules exist or the timer is on.
  - Scrabble's own rule is renamed "Turn limit".
  - `votePauses()` lives in `shared/turnTimer.ts`. Undo, dismiss and rematch votes pause the timer. Hand requests do not, since they involve only two people.
  - The timer is not offered in Pictionary, which has its own time per turn.
- **Plan 8:**
  - `GameDefinition.waitingOn?(state): Seat[]` covers out-of-turn waits. Plan 4 uses it too.
  - `GameInfo.passAndPlay?: boolean`, false for Pictionary.
  - `JOIN_GAME` gains `playerNames?: string[]`, plus `seatKeys?: string[]` on a rejoin.
  - One socket per device. The server sends only the view of the seat currently holding the device.
- **Plan 9:** `GameDefinition.spectatorState?(state, undoAvailable, tableScreen)` lets a game override the spectator view. Pictionary uses it so ordinary spectators see the word and the table screen doesn't.
- **Plan 11:**
  - `applyAction` gains `now`, and the new `recordsAction?(state, seat, action)` puts an action on the timeline.
  - The new category `party` ("Party games") is shared with Jenga.
  - When wave 1 is merged, the merger wires Pictionary's exported `privateSeatView` and `finalStandings` into `games/pictionary/index.ts`, so plan 1's every-game test passes.
- **Plan 4:** `joinLink` moves to `shared/links.ts`.
- **Plan 7 and 11:** `GameInfo.ownTurnLimit?: true` opts a game out of the platform turn timer; Pictionary sets it at the wave 1 merge.
- **Plan 12:** Jenga adds the platform hooks `simulating` and `simulate` for a pull in progress, and uses the `party` category.

## Global Constraints

Every task in every changeset includes these:

- No new npm dependencies, except plan 12: `three@0.186.1` and `@dimforge/rapier3d-deterministic-compat@0.21.0`, imported only by the Jenga game, plus `@types/three@0.186.0` as a dev dependency (types only, never bundled).
- Server, `shared/`, and the non-client files of each game never import from `src/` or `games/<id>/client/`.
- Game SCSS stays nested under `[data-game="<id>"]`. New pictures and icons are server SVGs (`shared/svg`, `ServerSvg`). Reaction emoji are the one exception.
- Hidden information never reaches a spectator, pass-and-play neighbor, table screen, history, export, notification or stats unless the spec allows it. Every plan that adds a view or an endpoint carries a test for this.
- Saved rooms and exported game files from before this change still load and play back.
- Update `docs/architecture.md`, README.md, affected game READMEs, and FAQ text wherever behavior changes.
- No em-dashes in any prose, comments, commits or PR bodies.
- Match the surrounding code: comment density, naming, idiom (one-line "why" comments, no JSDoc blocks).
- Node: if `node` is not found in Git Bash, run `export PATH=/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH`.
- Ports: use only the PORT and E2E_PORT_BASE in the table above for your changeset. Never port 6000.
- Gates before the PR: `npm run lint`, `npm test`, `npm run build` all pass; the e2e specs named in your plan pass (`E2E_PORT_BASE=<yours> npx playwright test <specs>`, full suite where the plan says so). A failure is rerun alone once to separate a flake, and both results go in the PR.
- Browser check: load the Chrome tools in one ToolSearch call, open your own new tab (other agents share Chrome; never touch other tabs), run `PORT=<yours> node server/server.ts` after `npx vite build`, and use the changed UI in light and dark mode, at desktop width and at 390 px and 320 px. The window cannot be resized, so check phone widths with same-origin iframes of those widths and set `data-theme` on each iframe's documentElement. Never trigger alert or confirm dialogs.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ga3pVQGT97diBzeRnAgfbG
  ```
- PR (`gh pr create --base <the branch you started from>`): the body has Summary, Rulings (calls you made), Known gaps and Verification (the exact commands and results), and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, a blank line, and `https://claude.ai/code/session_01Ga3pVQGT97diBzeRnAgfbG`.

## Review Focus

These are the most likely to hurt a player. Each is pinned by a test in the plan that owns it:

1. A spectator, a table screen or the other pass-and-play players see a private hand. The cause would be a game whose private data sits outside `privateSeatView`, or a history or export endpoint that ignores who is asking (plans 1, 3, 8, 9).
2. A rematch or hand-request vote never finishes, because a player disconnects, is dismissed, or the game was saved mid-vote and the server restarted (plans 1 and 3).
3. A room saved before this change, or an old exported game file, fails to load because a new field is required rather than optional (plans 1, 2, 3, 6, 7).
4. Push or notification code throws on plain http, or on a browser without the Notification API, and breaks the game page (plan 4).
5. The open games list or the stats page exposes a device ID, a seat key or a spectator key (plans 5 and 10).

## Combining

1. Create `spectators-social` from master and add this plan and the spec to it.
2. After each wave's PRs are green, merge them into `spectators-social` in table order, resolving conflicts toward the later changeset's intent. Rerun `npm run lint`, `npm test`, `npm run build` and the full e2e suite on the merged branch before the next wave branches from it.
3. Known overlaps:
   - `JoinDialog.tsx`: plans 1, 8 and 9.
   - `PresenceBar.tsx`: plans 1, 6 and 7.
   - `server/games.ts` room handling: almost all plans.
   - `GameDefinition` hooks: plans 1, 2 and 9.
   - The game-over screen: plans 2, 3 and 9.
   - The house rules panel: plan 7 and the per-game house rules in plans 11 and 12.
4. After wave 3, open the combined PR from `spectators-social` to master in the format of PR #37: one bullet per temporary PR linking it, then the integration work, known gaps and verification. Then close the twelve temporary PRs with a comment pointing to the combined PR. Delete their remote branches only after confirming that each delete succeeded.
