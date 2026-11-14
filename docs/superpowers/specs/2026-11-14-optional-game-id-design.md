# Optional game ID

## Intent

Let a player start a game without making up a game ID. A blank ID gets a new GUID, and the player invites others with the existing Share button.

## Goals, non-goals, anti-goals

- Goal: joining as Player or Pass and play with a blank Game ID starts a new game whose ID is a full 36-character GUID (owner's choice over a short ID).
- Goal: the Game ID placeholder says the ID is optional and one is generated if left blank.
- Non-goal: generated IDs for Spectator or Table screen. Those still need an ID, since there is no game to watch yet.
- Anti-goal: a generator that fails on plain `http://` LAN addresses. `crypto.randomUUID()` exists only in secure contexts, so the GUID is built from `crypto.getRandomValues()`, which works everywhere.

## Approaches

- **Generate on the client (chosen).** On submit, a blank ID is replaced with a GUID, written into the form, then joined as usual. The server, join links and Share button need no change.
- Generate on the server. Rejected: the join reply would have to carry the new ID back, a protocol change for no gain.

## Design

- `shared/types.ts`: split the limit. `MAX_NAME_LENGTH` stays 20 for player names; a new `MAX_GAME_ID_LENGTH = 36` applies to game IDs.
- `server/games.ts`: a new `cleanGameId` (trim, cut to `MAX_GAME_ID_LENGTH`) replaces `cleanName` for every game ID: join, rejoin, room lookup, history, resume, pause-file check and game-file export (today lines 444, 792, 853, 1164, 1188, 1238, 1321, 1328). Missing one would make a GUID game fail on that path. Player names keep `cleanName` and the 20 limit.
- `shared/gameFile.ts`, `shared/pauseFile.ts`: saved and paused game files accept game IDs up to `MAX_GAME_ID_LENGTH`, so a GUID game can be saved and reopened.
- A small shared `newGameId()` returns a version 4 GUID from `crypto.getRandomValues()`, with a unit test for its format.
- `src/App.tsx` `onJoin`: for Player and Pass and play, a blank (or whitespace) ID becomes `newGameId()`, set into the form state, saved with `saveJoinForm`, and used for the join.
- `src/components/JoinDialog.tsx`: Game ID input `maxLength` becomes 36, placeholder "Optional: leave blank to start a new game".
- Unchanged: the remembered join form still prefills the last ID used, as it does for typed IDs today.

## Verification

Unit tests for `newGameId()`, and a server test that a GUID game can be joined, rejoined, read for history, exported and paused then resumed, plus the 36-character limit in game files and pause files. In Chrome, at desktop and phone width, loading the app over plain HTTP from the machine's LAN address (`http://<LAN IP>:3000`, not `localhost`, which browsers treat as secure): join with a blank ID, see the GUID in the game, press Share, open the link in a second tab and land in the same game; check the long ID does not overflow the game screen or the "Games happening now" list.

## Left to the builder

Where `newGameId()` lives in `shared/`, and test wording.
