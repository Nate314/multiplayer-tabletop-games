# History Start, Saved Games and Game Files: Design

Date: 2026-10-18
Repo: `Nate314/multiplayer-tabletop-games` (one new PR against `master`)
Builds on: `docs/superpowers/specs/2026-10-18-history-animation-rejoin-design.md` and the code merged in PR #3

## Intent

Three changes, all in one PR (owner's decision):

1. In every game's History dialog, the earliest step is the starting board, before anyone has moved.
2. Games survive a server restart: the server keeps them in a SQLite database and loads them back on start.
3. A finished game can be downloaded as a JSON file, and anyone can open such a file from the landing page to step through it in the same History dialog.

The point of 3 is sharing: a player sends the file to someone, and that person reviews the game without joining anything.

## Goals

- All three work for all ten games through platform code; no game's own files need to change (except where a game's `describeMove` or `HistoryBoard` turns out not to handle a state with `lastMove: null`, which should not happen, see section 1).
- A restart (deploy, crash, `docker compose restart`) loses no started game. Players get back in with the existing rejoin flow.
- The project gains no new npm dependency.

## Non-goals

- Keeping finished games longer than today. A game is still deleted 10 minutes after its last connected player leaves, finished or not (owner's decision, by approving the playback). Players download the file before they leave.
- A list of past games, or any server-side storage of exported files.
- Uploading an imported file to the server. Import happens entirely in the browser.
- Resuming play from an imported file. An imported game is review only.
- Exporting a game that is still running.

## Anti-goals

- A shared file, or the History dialog, contains hidden information (Azul's bag and lid, any player's hand in Uno, Phase 10 or Scrabble, Scrabble's tile bag).
- A malformed or hand-edited file blanks or breaks the page.
- A restart drops players' seats, or makes a saved game impossible to rejoin.
- Saving slows play noticeably.

## 1. The starting board in the History dialog

The history the server returns becomes the starting board followed by the state after each move: `[start, ...timeline]`.

- `start` is `room.history[0]` when there has been at least one move (the state right before move 1, with everyone seated), otherwise `room.state`. It goes through `publicView` with `viewer: null` and `moveCount: 0`, like every other step.
- The slider runs from 0 to N. Step 0's label is "Start of the game" (my call on the wording); step k is "Move k of N: <describeMove>" as today. The dialog never calls `describeMove` for step 0.
- Every game's starting state already has `lastMove: null`, and the `describeMove` functions checked return `''` for it, so each `HistoryBoard` draws step 0 with no highlight. The builder confirms this for all ten games in the browser.
- The History button is no longer disabled before the first move, since there is always a step to show (my call). "No moves yet" goes away.
- The slider still opens on the latest step.

**The end of the game as a last step (my call).** Many games end outside a move: resigning and agreed draws (`shared/drawOffer.ts`), Scrabble's `endGame` action, Azul's final round (dealt from the `acknowledgeRound` action), possibly Phase 10's `acknowledgeHand`, and "everyone else left" after dismissals. In those, the last timeline step still has `isGameOver: false`. So when the live state has `isGameOver: true` and the last timeline step does not, the history appends the live state (viewer `null`, `moveCount` equal to the timeline length) as a final step: `[start, ...timeline, end]`.

- Its label is "End of the game: <gameStatus>"; the dialog never calls `describeMove` for it, and its board is drawn with `lastMove` cleared to `null` so the previous move is not highlighted twice. The dialog tells the start and end steps apart by position plus a flag the server adds, for example `historyStep: 'start' | 'move' | 'end'` on each step (the builder picks the exact shape, and it goes into the file too).
- The end step is built on each history request from the live state, never stored, so undo, the timeline and saving are unchanged. If an undo is allowed after the game ends (today `requestUndo` has no game-over check, and this design does not add one), the end step simply disappears with it.
- When the last move itself ended the game, no end step is added; that move's step is already the game-over step.

## 2. Saving games in SQLite

**Engine.** Node's built-in `node:sqlite` (`DatabaseSync`), so no package is added. It is available without a flag on the pinned Node 22.23 (`.nvmrc` and the Dockerfile). It prints an "experimental" warning on start; that is acceptable (my call). The builder confirms the module loads under Node 22.23 in Docker, not only under a newer local Node.

**What is saved.** One row per started room: room ID (`<game type>/<game ID>`), game type, and the room's `state`, `history` and `timeline` as JSON. A room is saved when `state.started` is true (so a game undone back to zero moves, which still holds seats, is saved). Lobbies are not saved, because a lobby's seats are freed on disconnect anyway, so after a restart it would be empty (my call). Every game's state is plain JSON (no `Map` or `Set`), so it round-trips.

**When.** Write-through, synchronously, after every change to a started room: moves, actions, undo and dismiss requests and votes, joins, rejoins and disconnects. A room's row is deleted when the room is deleted (empty-room timer, or last player removed). The schema is created with `CREATE TABLE IF NOT EXISTS` on start; there is no migration system (YAGNI).

**Design.** The game manager stays testable without a database: `createGameManager` takes a small store (load all, save room, delete room) as a parameter. The server passes the SQLite store; tests pass an in-memory one or none. The manager owns the "after every change" calls, so `server.ts` only opens the store and hands it over.

**Loading on start.** Every saved room is loaded. Nobody is connected after a restart, so on load:

- every active seat is marked disconnected (seats held, so the existing rejoin flow works),
- any open undo or dismiss vote is cleared,
- the 10-minute empty-room timer starts for each room (the clock restarts at boot, my call).

A row that fails to parse, or whose game type no longer exists, is skipped with a log line and deleted. A game whose state shape changed between versions is not migrated (YAGNI); if that ever matters it is a new piece of work.

**After a restart in the browser.** The existing behavior already covers it: the socket closes, the landing page shows "Back to <game> (<game ID>)", and clicking it rejoins with `rejoin: true`. A page that is reloaded while the server is down rejoins automatically once it is back, as it does today. No client change is needed for this part; the builder checks it end to end.

**Where the file lives.**

- `DATABASE_PATH` environment variable, default `data/games.sqlite` relative to the repo root. The server creates the folder if needed. `data/` goes in `.gitignore` and `.dockerignore`.
- Docker: the container is `read_only`, so `docker-compose.yml` mounts a named volume at `/app/data`. The Dockerfile creates `/app/data` owned by `node` before `USER node`, so the volume is writable.
- Tests never touch the real file (in-memory store, or SQLite `:memory:` for the store's own tests).

## 3. Exporting a finished game

- In the History dialog, a "Download game" button appears when the latest step has `isGameOver: true` (my label).
- The file is built in the browser from the steps the dialog already fetched, so there is no new endpoint and no second way of building views (DRY). Those steps are built with `viewer: null`, so nothing hidden is in them.
- File name: `<game type>-<game ID>.json`, with characters unsafe in file names replaced by `-` (my call).
- Contents (my call on the shape):

  ```json
  {
    "format": "multiplayer-tabletop-games",
    "version": 1,
    "gameType": "chess",
    "gameId": "friday",
    "exportedAt": "2026-10-18T20:15:00.000Z",
    "steps": [ /* public states, starting board first */ ]
  }
  ```

  Player names and the result are already in the steps (`playerNames`, `winners`, `gameStatus`), so they are not repeated.

## 4. Importing a game file

- The landing page gets an "Open a saved game" button (my label) near the game list. It opens a file picker limited to `.json`.
- The file is read in the browser. It is accepted when it parses as JSON, `format` matches, `version` is 1, `gameType` is a game in `CLIENT_GAMES`, and `steps` is a non-empty array of objects. Anything else shows one plain error on the landing page, for example "This file is not a saved game" or "This saved game is for a game this site does not have".
- An accepted file opens the same History dialog, with that game's `HistoryBoard` and `describeMove` and its `data-game` styling, starting on the last step. The dialog title says it is a saved game and shows the game ID (my call). There is no Download button on an imported game (it is already a file).
- Each game's state inside the steps is not validated field by field. Instead the dialog's board is wrapped in an error boundary: if a hand-edited step makes a board throw, the dialog shows "This step could not be shown" and the slider keeps working. React escapes all text, so names in a file cannot inject markup.

## Docs and tests

- `docs/architecture.md`: the history now starts with the starting board; the store and SQLite file; loading on start; the export and import flow; `DATABASE_PATH`. README: that games survive restarts, where the database lives, and the Docker volume. No em-dashes in any prose.
- Unit tests (`node --test`): the history starts with the starting board, before and after moves and after an undo back to zero; it ends with an end step when the game ended by an action or dismissal, and has none when a move ended it; the manager calls the store on each kind of change and deletes on room removal; loading marks seats disconnected, clears votes, starts timers and skips bad rows; the SQLite store round-trips a room against `:memory:`; the import validator accepts a good file and rejects each bad case.
- Browser checks (Chrome): step 0 in several games, including one with hidden information (Azul or Uno); a chess game ended by resigning shows the end step and the Download button; finish a game, download, open the file from the landing page; a bad file shows the error; restart the server mid-game and rejoin. Check the dialog and the landing page at a narrow and a wide window.

## Left to the builder

- Table and column names, the store's exact interface, and the file layout inside `server/` and `src/`.
- Where on the landing page the import button sits and how it is styled, within the existing look.
- Whether the import validator lives in `shared/` or `src/`.
- Whether saving is per change or batched per message, as long as nothing is lost on a clean restart and play does not slow down.
