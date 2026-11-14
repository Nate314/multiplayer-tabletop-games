# Open Games Flag and Optional Game ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-run flag in `run.ps1`/`run.sh` that turns on the "Games happening now" list, and a blank Game ID that starts a new game with a generated GUID.

**Architecture:** The flag is stripped from the arguments in this project's wrappers and passed to the container through `docker-compose.yml`. Game IDs get their own 36-character limit used by every server lookup and by saved/paused game files; the browser fills a blank ID with a GUID built from `crypto.getRandomValues()` before joining.

**Tech Stack:** PowerShell 7, bash, Docker Compose, Node (`node --test`), React + Vite.

**Spec:** `docs/superpowers/specs/2026-11-14-open-games-flag-design.md`, `docs/superpowers/specs/2026-11-14-optional-game-id-design.md`

## Global Constraints

- No new npm dependencies. The shared `compose-launcher` submodule is not changed.
- The server keeps reading `SHOW_OPEN_GAMES === 'true'`; any other value is off.
- Flags: `-ShowOpenGames` (case-insensitive) in `run.ps1`, `--show-open-games` in `run.sh`. A run without the flag sets `SHOW_OPEN_GAMES=false`.
- `MAX_NAME_LENGTH = 20` stays for player names; new `MAX_GAME_ID_LENGTH = 36` for game IDs.
- Generated IDs: lowercase version 4 GUID, 36 characters, from `crypto.getRandomValues()` (never `crypto.randomUUID()`, missing on plain HTTP).
- Only roles `player` and `passAndPlay` generate an ID. Placeholder text: `Optional: leave blank to start a new game`.
- No em-dashes in README or commit messages.

## Review Focus

- A whitespace-only Game ID counts as blank and gets a GUID (Task 3 test).
- Spectator or Table screen with a blank ID still gets the server's `Please enter a game ID` (Task 3, browser check).
- A GUID game survives every server path, not just join: rejoin, pause/resume, export (Task 2 test).
- `-showopengames` in any case and in any position, including after `share`, is removed before the launcher or ngrok see it (Task 1 check).
- A 36-character GUID does not overflow the game screen or the open games list at 320 px wide (Task 3 browser check).

---

### Task 1: Per-run open games flag

**Files:**
- Modify: `docker-compose.yml` (the `app` service)
- Modify: `run.ps1`, `run.sh`
- Modify: `README.md:30` (the `SHOW_OPEN_GAMES` paragraph)

**Interfaces:**
- Produces: the container sees `SHOW_OPEN_GAMES` as `true` or `false`.

- [ ] **Step 1:** In `docker-compose.yml` add to `app`: `environment:` with `SHOW_OPEN_GAMES: ${SHOW_OPEN_GAMES:-false}`. Run `docker compose config` and confirm it shows `SHOW_OPEN_GAMES: "false"`.
- [ ] **Step 2:** In `run.ps1`, before `& ./compose-launcher/run.ps1`, split `$args` into the flag and the rest (`-ieq '-ShowOpenGames'`), set `$env:SHOW_OPEN_GAMES` to `'true'` or `'false'`, and pass the rest with `@rest`. Keep the no-`param()` comment true.
- [ ] **Step 3:** In `run.sh`, loop over `"$@"` building the rest with `set --`, `export SHOW_OPEN_GAMES=true|false`, then `exec bash compose-launcher/run.sh "$@"`.
- [ ] **Step 4:** README: after the existing paragraph, add that `.\run.ps1 -ShowOpenGames` or `./run.sh --show-open-games` turns it on for that run, and a run without the flag turns it off.
- [ ] **Step 5: Verify.** `.\run.ps1 -ShowOpenGames`, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:<APP_PORT>/api/open-games` prints `200`; `.\run.ps1` prints `404`. Repeat with `./run.sh --show-open-games` and `./run.sh` in Git Bash. Run `.\run.ps1 ps -showopengames` and confirm `docker compose ps` output (flag removed, any case). With the flag on, the landing page in Chrome shows "Games happening now" once a game is open.
- [ ] **Step 6: Commit** `Add a per-run flag to show open games` with the four files.

### Task 2: A 36-character game ID limit on every path

**Files:**
- Modify: `shared/types.ts:5`, `server/games.ts:113` and lines 444, 792, 853, 1164, 1188, 1238, 1321, 1328, `shared/gameFile.ts:80`, `shared/pauseFile.ts:77`
- Test: `server/games.test.ts:81`, `shared/gameFile.test.ts:75,84`, `shared/pauseFile.test.ts:43`

**Interfaces:**
- Produces: `export const MAX_GAME_ID_LENGTH = 36` in `shared/types.ts`; `cleanGameId(value: unknown): string` in `server/games.ts` (trim, slice to 36).

- [ ] **Step 1: Write the failing tests.**
  - `server/games.test.ts`: rename the test at line 81 to `names are cut to 20 characters and game IDs to 36`; join with `'x'.repeat(40)`, assert `state.gameId === 'x'.repeat(36)`, `roomId === \`test/${'x'.repeat(36)}\``, name still `'y'.repeat(20)`.
  - `server/games.test.ts`: new test `a 36-character GUID game works on every path`: with `const id = '3f2b8c1e-9a4d-4e7b-b6c2-1d5e8f0a7c39'`, join two players, rejoin seat 1 with its seat key, then use the existing helpers in this file for pause file, resume status and game file export with the same `id`, asserting each returns no `error` and the file's `gameId === id`.
  - `shared/gameFile.test.ts`: the rejected case becomes `'x'.repeat(37)`; the accept test becomes `parseGameFile accepts a gameId of exactly 36 characters`.
  - `shared/pauseFile.test.ts`: the rejected case becomes `'x'.repeat(37)`, plus an accepted file with a 36-character `gameId`.
- [ ] **Step 2:** `npm test` fails on exactly these tests.
- [ ] **Step 3:** Add the constant, `cleanGameId`, use it at all eight game ID call sites (names keep `cleanName`), and use `MAX_GAME_ID_LENGTH` in the two file parsers. Update the `MAX_NAME_LENGTH` comment to "applies to player names".
- [ ] **Step 4:** `npm test` passes; `npm run lint` and `npm run typecheck` clean.
- [ ] **Step 5: Commit** `Allow 36-character game IDs everywhere`.

### Task 3: Generate a GUID for a blank game ID

**Files:**
- Create: `shared/gameId.ts`, `shared/gameId.test.ts`
- Modify: `src/App.tsx:128-131`, `src/components/JoinDialog.tsx:140-146`, `README.md:3`

**Interfaces:**
- Consumes: `MAX_GAME_ID_LENGTH` (Task 2).
- Produces: `newGameId(): string` and `gameIdForJoin(typed: string, role: JoinRole): string` in `shared/gameId.ts`. `gameIdForJoin` returns `typed` unchanged unless it is blank after trim and `role` is `player` or `passAndPlay`, then `newGameId()`.

- [ ] **Step 1: Write the failing tests** in `shared/gameId.test.ts`:
  - `newGameId is a lowercase version 4 GUID`: matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`, length `MAX_GAME_ID_LENGTH`; 100 calls give 100 distinct values.
  - `gameIdForJoin fills a blank ID only for players`: `''` and `'   '` with `player` and `passAndPlay` give a GUID; `''` with `spectator` and `tableScreen` gives `''`; `'friday'` with `player` gives `'friday'`.
- [ ] **Step 2:** `node --test shared/gameId.test.ts` fails (module missing).
- [ ] **Step 3:** Implement with 16 bytes from `crypto.getRandomValues`, set byte 6 high nibble to 4 and byte 8 top bits to `10`, hex-format 8-4-4-4-12.
- [ ] **Step 4:** Test passes.
- [ ] **Step 5:** `App.tsx` `onJoin`: `const id = gameIdForJoin(gameId, joinRole)`, `setGameId(id)`, then `saveJoinForm` and `join` with `id`. `JoinDialog.tsx` Game ID input: `maxLength={MAX_GAME_ID_LENGTH}`, placeholder `Optional: leave blank to start a new game`. Leave the blank check in `src/hooks/useGameConnection.ts:236` as is: it still gives Spectator and Table screen their error. `README.md:3`: change "enter your name and a game ID, and join" to say the game ID is optional and a new one is made when left blank.
- [ ] **Step 6: Verify in Chrome.** `npm test`, `npm run lint`, `npm run build` pass. Start the app, open it at `http://<LAN IP>:<port>` (not localhost). Join a game as Player with a blank ID: the game opens and shows a GUID. Press Share, open the link in a second tab, join as a second player in the same game. A blank ID as Spectator shows `Please enter a game ID`. With `SHOW_OPEN_GAMES=true`, check the open games list and game screen at desktop width and at 320 px (iframe method from memory) for overflow.
- [ ] **Step 7: Commit** `Start a new game with a generated ID when the Game ID is blank`.
