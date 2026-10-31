# Pause and Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A table can vote to pause a started game, every player downloads a pause file, and the game resumes later either from the server (players rejoin) or, if the server lost it, from everyone's files together.

**Architecture:** The pause vote is a pure state change in `shared/pause.ts`, wired into the game manager like the undo vote. When it passes, the manager strips the room to its game content (`SealedRoom`), seals it with AES-256-GCM under a random key split into XOR shares (`server/pauseSeal.ts`), and keeps the seal and the shares on the paused state (`pause`, stripped from every view like `seatKeys`). A pause file (`shared/pauseFile.ts`) is built on demand from that seal plus the plain table, the seat's own `privateSeatView` and the table history, all computed by view functions moved out of the manager closure into `server/views.ts`. Files travel over HTTP (the WebSocket refuses frames over 64 KB): a download route, an upload route that either takes a seat in the paused room or collects files in an in-memory resume lobby, and a status route the landing page's waiting room polls. When every seat's file is in, `checkPauseFiles` rebuilds the key, checks the fingerprint and every plain part, and the manager restores the room paused, with every seat held for its uploader. In both paths play continues when every seat is connected and a player presses Resume.

**Tech Stack:** TypeScript 5.9, React 19, Express 5, ws, node:test, Playwright; `node:crypto` (`randomBytes`, `createCipheriv`, `createDecipheriv`, `createHmac`, `createHash`, `hkdfSync`, `timingSafeEqual`) and `node:zlib` (`deflateRawSync`, `inflateRawSync`).

**Spec:** `docs/superpowers/specs/2026-10-31-pause-resume-jenga-and-fixes-design.md`, section 9. Index plan: `docs/superpowers/plans/2026-10-31-pause-resume-jenga-and-fixes.md`. Branch `pause-resume` from `pause-resume-jenga-and-fixes`. Server `PORT=3209`, `E2E_PORT_BASE=6570`.

## Global Constraints

All of the index plan's Global Constraints, plus:

- Contract names are exact: `GameDefinition.secretState?(state: S): unknown`, `BaseGameState.pauseVote?: { requestedBy: Seat; votes: Record<Seat, boolean> } | null` (type `PauseVote` in `shared/types.ts`) and `BaseGameState.paused?: boolean`. The header button reads "Pause".
- Contract additions (this plan's own names other plans may meet):
  - `BaseGameState.pause?: PauseRecord` (`{ seal: PauseSeal; shares: Record<Seat, string> }`), present only while paused and stripped from every view, history step, game file, spectator view and pause file's plain parts, like `seatKeys`.
  - Every `secretState` returns `seatFields(state, [...keys])`: a pick of the state's own top-level fields. Plan 8 keeps Jenga's grips in `grip`.
  - Messages `REQUEST_PAUSE` (no payload), `VOTE_PAUSE { approve: boolean }`, `RESUME_GAME` (no payload).
  - Routes `GET /api/pause-file/:gameType/:gameId/:seat`, `POST /api/resume`, `GET /api/resume/:gameType/:gameId`, and the test hook `DELETE /api/e2e/room/:gameType/:gameId`.
  - `VotePanel`'s `className` gains `'pause-vote'`.
- A pause needs every seated player connected; every one of them must approve. A pass-and-play device requests and approves for every seat it holds.
- No key outlives the paused room: `pause` is removed when the game resumes and goes with the room when it is deleted. The resume lobby is in memory only.
- Pause files are JSON: `format: 'multiplayer-tabletop-games-pause'`, `version: 1`. The finished-game export (`shared/gameFile.ts`) is untouched.
- Copy, exactly: "Pause"; "<name> wants to pause the game"; "<name> declined to pause"; "Game paused"; "Play resumed"; "Download my pause file"; "Download <name>'s pause file"; "Waiting for <names>" (names joined with ", "); "Everyone is here"; "Resume"; "Resume a game"; "<name>'s pause file does not match the others"; "The pause files from <names> do not match".
- Error copy, exactly: "The game has not started", "The game is over", "The game is already paused", "A vote is already in progress", "Everyone must be here to pause", "No pause vote in progress", "You already voted", "The game is paused", "A pause vote is in progress", "The game is not paused", "This file is not a pause file", "This pause file is for a game this site does not have", "These files are from different games", "Another game with this ID is on this server", "<name>'s file is already in", "This game is waiting for its pause files. Choose Resume a game and upload yours".

## Review Focus

1. A share, a seat key, the draw pile or another seat's hand reaching a pause file's plain parts, a live view, a spectator, a history step or the store's history rows in readable form. Owned by Task 3 (every game) and Task 5 (views); the tests search the serialized output for the secret values.
2. A paused room deleted by the 10 minute empty-room timer, on the first timer or after a server restart (Task 5).
3. A refresh, a disconnect or a game hook changing a paused game: a seat's `onPlayerDisconnected` dealing a round, a Jenga tick, a deadline firing (Tasks 1 and 5).
4. Undo after a resume from files: the restored step must carry the new seat keys, or the next rejoin fails (Task 7).
5. A file uploaded to the wrong game: a different paused game with the same ID, a running game with that ID, or the same seat twice (Task 7).

---

### Task 1: Pause vote state, guards and alerts

**Files:**
- Modify: `shared/types.ts`, `shared/seating.ts`, `shared/turnTimer.ts`, `shared/alerts.ts`
- Create: `shared/pause.ts`
- Test: create `shared/pause.test.ts`; add to `shared/seating.test.ts`, `shared/turnTimer.test.ts`, `shared/alerts.test.ts`

**Interfaces:**
- Produces, in `shared/types.ts`: `type PauseVote = { requestedBy: Seat; votes: Record<Seat, boolean> }`; on `BaseGameState`: `pauseVote?: PauseVote | null` and `paused?: boolean` (comments: "missing in rooms saved before pausing"). `pause?: PauseRecord` is added in Task 4, where its type lives.
- Produces, in `shared/pause.ts`:
  - `openPauseVote<S extends BaseGameState>(state: S, seat: Seat): Result<S>`: refuses, in this order, "The game has not started", "The game is over", "The game is already paused", "A vote is already in progress" (any of `undoVote`, `dismissVote`, `rematchVote`, `pauseVote`), "Everyone must be here to pause" (`disconnected.length > 0`). Opens `{ requestedBy: seat, votes: { [seat]: true } }` with status "<name> wants to pause the game".
  - `castPauseVote<S extends BaseGameState>(state: S, seat: Seat, approve: unknown): Result<S>`: "No pause vote in progress", "You already voted"; `approve !== true` closes the vote with "<name> declined to pause"; otherwise records `true`.
  - `pauseVotePassed(state: BaseGameState): boolean`: an open vote with `true` from every seat in `activePlayers`.
- `shared/seating.ts`:
  - `applyMove` refuses "The game is paused" when `state.paused`, and "A pause vote is in progress" when `state.pauseVote`, both after the game-over check.
  - `disconnectPlayer` clears any open `pauseVote` (the vote needs everyone), and runs no `onPlayerDisconnected` while `state.paused`, so a paused game changes only its `disconnected` list.
- `shared/turnTimer.ts`: `votePauses` also returns true for `pauseVote`.
- `shared/alerts.ts`: `votesWaitingOn` adds `vote:pause:<requestedBy>` for an active seat that has not voted (before the hand requests); `alertFor` returns null while `state.paused`, after the vote check.

- [ ] **Step 1: Write the failing tests.** In `shared/pause.test.ts`, on a started two-seat `baseGameState` with names Alice and Bob:
  - `openPauseVote refuses before the start, after the end, while paused, during another vote and with a seat disconnected`: one assertion per error string above, in order.
  - `openPauseVote opens a vote the requester has approved`: `pauseVote` deep-equals `{ requestedBy: 1, votes: { 1: true } }`, `gameStatus` is "Alice wants to pause the game".
  - `castPauseVote declines, refuses a second vote and records an approval`: a decline gives `pauseVote: null` and "Bob declined to pause"; seat 1 voting again gives "You already voted"; with no vote, "No pause vote in progress".
  - `pauseVotePassed needs every seated player`: false with only seat 1, true once seat 2 approves.
  In `shared/seating.test.ts`: `applyMove refuses while paused or during a pause vote` (the two strings); `a disconnect cancels a pause vote`; `a disconnect while paused runs no game hook` (a game whose `onPlayerDisconnected` throws). In `shared/turnTimer.test.ts`: `a pause vote holds the turn timer` (`votePauses` true). In `shared/alerts.test.ts`: `a pause vote waits on every seat that has not voted` (key `vote:pause:1` for seat 2 only) and `a paused game alerts nobody` (`alertFor` null for the current player).
- [ ] **Step 2:** `node --test shared/pause.test.ts shared/seating.test.ts shared/turnTimer.test.ts shared/alerts.test.ts` fails (module not found, then the new assertions).
- [ ] **Step 3:** Implement the types, `shared/pause.ts` and the four edits as above.
- [ ] **Step 4:** The same command passes; `npm run typecheck` passes.
- [ ] **Step 5:** Commit `Add the pause vote to the shared game state`.

### Task 2: `secretState` on every game with a secret

**Files:**
- Modify: `shared/gameDefinition.ts`, the `index.ts` of each game listed below, `games/privateSeatView.test.ts`
- Create: `games/testStates.ts`, `games/secretState.test.ts`

**Interfaces:**
- `shared/gameDefinition.ts`: `secretState?(state: S): unknown`, commented "Everything hidden from every player (draw piles, bags, grips), as a pick of the state's own fields; a seat's own hand is privateSeatView, not this".
- `games/testStates.ts` (moved out of `games/privateSeatView.test.ts`, which then imports them): `seeded(seed: number): Random`, `FOUR_SEATS`, `NAMES`, `dealt(game): Loose`, `type Loose`.
- Each entry is `secretState: state => seatFields(state, [<keys>])`, keys exactly:
  - azul `bag`; carcassonne `drawPile`; catan `devDeck`; dominoes `boneyard`; euchre `kitty`; gofish `stock`; holdem `deck`; jenga `grip`; monopoly `decks`; phase10 `drawPile`; pictionary `deck`; racko `drawPile`; risk `deck`; rook `nest`, `captured`; rummikub `pool`; scrabble `bag`; skipbo `drawPile`, `stocks`; splendor `decks`; thecrew `tasks`, `tricks`; tickettoride `deck`, `ticketDeck`; uno `drawPile`; war `piles`.
  - Every other game (hearts and spades hide only hands) has none.

- [ ] **Step 1: Write the failing tests** in `games/secretState.test.ts`:
  - `exactly the games with a secret declare one`: `GAMES.filter(g => g.secretState).map(g => g.info.id).sort()` deep-equals the 22 ids above, sorted.
  - Per game with `secretState`, `no view shows a secret field as it is`: for `dealt(game)` and each of `null` and every seat, for each `[key, value]` of `secretState(state)` that is not empty (non-empty array, or an object with a key), `toPublicState(state, false, viewer)[key]` is not deep-equal to `value`.
  - Per game, `secretState keys are fields of the state`: every key is `in` the state.
- [ ] **Step 2:** `node --test games/secretState.test.ts` fails on the first test.
- [ ] **Step 3:** Move the helpers to `games/testStates.ts`, add the hook to `GameDefinition` and the 22 entries.
- [ ] **Step 4:** `node --test games/secretState.test.ts games/privateSeatView.test.ts` passes.
- [ ] **Step 5:** Commit `Declare each game's secret state`.

### Task 3: Sealing a room

**Files:**
- Create: `server/pauseSeal.ts`, `shared/pauseFile.ts` (the `PauseSeal` type only)
- Test: `server/pauseSeal.test.ts`

**Interfaces:**
- Produces:
  - `type SealedRoom = { state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[] }`
  - `type PauseSeal = { iv: string; tag: string; data: string; fingerprint: string; shareHashes: Record<Seat, string> }` (base64 for `iv`, `tag`, `data`; hex for the rest). This task creates `shared/pauseFile.ts` holding only this type (so the browser can type a file); Task 4 adds the rest of that module.
  - `sealRoom(room: SealedRoom, seats: Seat[]): { seal: PauseSeal; shares: Record<Seat, string> }`
  - `openSeal(seal: PauseSeal, shares: Record<Seat, string>): SealedRoom | null`
  - `shareHash(share: string): string` (SHA-256 hex of the share's bytes)
- Algorithm (the parts the signatures do not fix):
  - `key = randomBytes(32)`. Every seat but the last gets `randomBytes(32)`; the last gets `key` XOR all the others. Shares are base64.
  - `encKey = hkdfSync('sha256', key, '', 'pause-encrypt', 32)`, `macKey = hkdfSync('sha256', key, '', 'pause-fingerprint', 32)`.
  - `plain = JSON.stringify(room)`; `data` = AES-256-GCM (12-byte random IV) of `deflateRawSync(plain)`; `fingerprint` = HMAC-SHA256(`macKey`, `plain`) hex.
  - `openSeal` XORs the shares (any missing or not 32 bytes is null), decrypts (a bad tag is null, caught), inflates, recomputes the HMAC and compares with `timingSafeEqual` (a mismatch is null), then `JSON.parse`.

- [ ] **Step 1: Write the failing tests:**
  - `a sealed room opens with every share`: `openSeal(seal, shares)` deep-equals the room (a three-seat state with a `secret` field, one history step).
  - `no share or pair of shares opens it`: dropping any one share gives null; replacing one with `randomBytes(32)` gives null.
  - `the sealed data does not show the room`: `Buffer.from(seal.data, 'base64').toString('latin1')` does not include the secret string, nor does `JSON.stringify(seal)`.
  - `a changed byte is refused`: flipping one byte of `data` gives null.
  - `share hashes name each seat's share`: `seal.shareHashes[seat] === shareHash(shares[seat])` for every seat.
  - `two seals of one room differ but both open`: different `iv` and `data`, same opened room.
- [ ] **Step 2:** `node --test server/pauseSeal.test.ts` fails.
- [ ] **Step 3:** Implement `server/pauseSeal.ts`.
- [ ] **Step 4:** The test passes.
- [ ] **Step 5:** Commit `Seal a paused room under split keys`.

### Task 4: The pause file and the view functions it uses

**Files:**
- Create: `server/views.ts`, `server/pauseFiles.ts`
- Modify: `shared/pauseFile.ts` (from Task 3), `shared/types.ts`
- Modify: `server/games.ts` (move the view functions out, import them back)
- Test: create `shared/pauseFile.test.ts`, `server/pauseFiles.test.ts`

**Interfaces:**
- `shared/pauseFile.ts`:
  - `PAUSE_FILE_FORMAT = 'multiplayer-tabletop-games-pause'`, `PAUSE_FILE_VERSION = 1`
  - `type PauseSeal` (as in Task 3), `type PauseRecord = { seal: PauseSeal; shares: Record<Seat, string> }`; add `pause?: PauseRecord` to `BaseGameState` in `shared/types.ts`, commented "only while paused; the server strips it from every view, like seatKeys".
  - `type PauseFile = { format; version: 1; gameType: string; gameId: string; pausedAt: string; seat: Seat; playerName: string; players: Record<Seat, string>; table: BasePublicState; hand: unknown; history: HistoryStep[]; seal: PauseSeal; share: string }`. `hand` is the seat's `privateSeatView`, or null for a game without one. `table` carries the house rules.
  - `parsePauseFile(text: string, knownGameTypes: readonly string[]): { file: PauseFile } | { error: string }`: JSON, `format`, `version === 1`, string `gameType`, `gameId` of 1 to `MAX_NAME_LENGTH`, integer `seat` that is a key of `players` whose name is `playerName`, object `table`, array `history`, `seal` with the five string fields, string `share`; else "This file is not a pause file". An unknown game type is "This pause file is for a game this site does not have".
  - `pauseFileName(gameType: string, gameId: string, playerName: string): string` = `gameFileName(gameType, \`${gameId}-${playerName}-paused\`)`, so `uno-g1-Alice-paused.json`.
  - `type ResumeStatus = { gameType: string; gameId: string; players: { seat: Seat; name: string; ready: boolean }[]; ready: boolean; error: string | null }` and `type ResumeUpload = ResumeStatus & { seat: Seat; seatKey: string; playerName: string }`.
- `server/views.ts` (moved verbatim from the `createGameManager` closure, which uses none of its variables): `type ViewRoom = { game: GameDefinition<any, BasePublicState>; state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[] }` (with the existing eslint comment), `publicView`, `platformView`, `hasEndMoment`, `historyMoments`, `historyStep`, `STAMP_KEYS`, `type HistoryMoment`. `Room` in `games.ts` becomes `ViewRoom & { ...the in-memory fields }`. `platformView` also strips `pause`.
- `server/pauseFiles.ts`:
  - `sealedRoomOf(room: ViewRoom): SealedRoom`: the state and every history and timeline entry without `seatKeys`, `seatDevices`, `spectatorKeys`, `spectators`, `handRequests`, `reactions`, `pause`, `turnStartedAt`, `turnPausedAt`.
  - `pausePlainParts(game, room: SealedRoom, seat: Seat): { table: BasePublicState; hand: unknown; history: HistoryStep[] }`: `publicView(room, room.state, false, room.timeline.length, null)`, `game.privateSeatView?.(room.state, seat) ?? null`, `historyMoments(room).map(m => historyStep(room, m, null))`.
  - `buildPauseFile(game, room: SealedRoom, seat: Seat, pause: PauseRecord, pausedAt: Date): PauseFile`.
  - `canonicalJson(value: unknown): string`: `JSON.stringify` with object keys sorted at every depth and `undefined` fields dropped; every comparison in Task 6 uses it.

- [ ] **Step 1: Write the failing tests.** `shared/pauseFile.test.ts`: `parsePauseFile accepts a built file` (round trip of a minimal valid file); `refuses broken files` (each of: not JSON, wrong format, version 2, seat not in players, name not the seat's, missing seal field) gives "This file is not a pause file"; `refuses an unknown game type`; `pauseFileName` gives `uno-g1-Alice-paused.json` and `uno-g-1-A-b-paused.json` for game ID `g/1` and name `A b`.
  `server/pauseFiles.test.ts`, for every game in `GAMES`, on `{ ...dealt(game), started: true, paused: true, seatKeys: { 1: 'key-one', 2: 'key-two' }, pause: <any record> }` with one history step:
  - `<id>: a pause file's plain parts show no secret and no other seat's hand`: for each seat, `JSON.stringify({ ...file, seal: null, share: null })` includes no `key-one`, no `key-two`, no JSON of a non-empty `secretState` value, and no JSON of another seat's non-empty `privateSeatView` value whose JSON is at least 12 characters (shorter values such as `[]` or `3` match by chance).
  - `<id>: the plain hand is the seat's own private view` (deep-equal to `privateSeatView(state, seat)`, or null).
  - `sealedRoomOf strips keys from history entries too`: no `seatKeys` in any `history` or `timeline` entry.
- [ ] **Step 2:** `node --test shared/pauseFile.test.ts server/pauseFiles.test.ts` fails.
- [ ] **Step 3:** Move the view functions to `server/views.ts`, then implement the two modules.
- [ ] **Step 4:** The command passes, and `node --test server/games.test.ts server/spectators.test.ts` still passes after the move.
- [ ] **Step 5:** Commit `Build pause files from the sealed room`.

### Task 5: Pausing and resuming in the manager and over the socket

**Files:**
- Modify: `server/games.ts`, `server/server.ts`, `shared/messages.ts`
- Test: create `server/pause.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- `shared/messages.ts`: `REQUEST_PAUSE`, `VOTE_PAUSE`, `RESUME_GAME` in `MESSAGE_TYPES` and `ClientMessage`.
- Manager methods (all `Result<BasePublicState>` through `findPlayer`, like `requestUndo`):
  - `requestPause(roomId, seat)` and `votePause(roomId, seat, approve: unknown)`: apply `openPauseVote` / `castPauseVote`, then `settlePause(room)`, then `save`.
  - `resumeGame(roomId, seat)`: "The game is not paused"; with any seat in `disconnected`, "Waiting for <names>". Otherwise drops `pause`, `pauseVote: null`, `paused: false`, `turnStartedAt: null`, applies `resumeClock(state, now())` when the game has one, status "Play resumed", and saves (not a move).
  - `pauseFile(gameType, gameId, seat: unknown, credential: unknown, now: Date): { file: PauseFile } | { error: string }`: `NOT_AVAILABLE` unless the room is paused, `seat` is a seated number, and the credential is that seat's key or a device ID whose `hashDeviceId` equals `seatDevices[seat]` (compared with `sameSecret`); otherwise `buildPauseFile(game, sealedRoomOf(room), seat, state.pause, now)`.
  - `removeRoom(roomId): boolean`: only for the e2e hooks; `deleteRoom` when it exists.
- `settlePause(room)` (closure helper): when `pauseVotePassed`, first `state = game.onUndo(state, random)` if `game.simulating?.(state)` (a mid-pull Jenga tower goes back to its turn start), then `paused: true`, `pauseVote: null`, status "Game paused", no stamp keys; `pause = sealRoom(sealedRoomOf({ ...room, state }), state.activePlayers)`.
- Guards: `requestUndo` adds "The game is paused" and "A pause vote is in progress"; `requestDismiss` and `requestRematch` refuse "The game is paused" and treat `pauseVote` as "A vote is already in progress"; `action` refuses "The game is paused".
- Lifecycle: `startEmptyTimer` returns early while `paused`; `loadRoom` clears `pauseVote` with the other votes and keeps `paused` and `pause`; `clockMayRun` is false while paused, so no deadline is scheduled; `stampRoom`'s `running` is false while paused; `scheduleSimulation` does not tick while paused.
- `server/server.ts`: in `handleMessage`, `REQUEST_PAUSE`, `VOTE_PAUSE` (`payload?.approve`) and `RESUME_GAME` call the three methods through `respond`. In `handleLocalMessage` (before the handoff check, so it works with no seat shown): `REQUEST_PAUSE` requests as `localSeats[0]` and approves for the rest; `VOTE_PAUSE` votes for every local seat; `RESUME_GAME` resumes as `localSeats[0]`; each responds with the first result without an error, else the first. Route `GET /api/pause-file/:gameType/:gameId/:seat` with `bearer(req)` and `Number(req.params.seat)`: the file as JSON, 404 `NOT_AVAILABLE_BODY`, or 409 `{ error }`.

- [ ] **Step 1: Write the failing tests** in `server/pause.test.ts`, with `handGame`, `rememberingKeys` and a fake clock, on a started two-seat game:
  - `a pause needs every seat and then closes the game for play`: after both approve, `paused` is true, status "Game paused", and a move by the current player is "The game is paused"; an action is "The game is paused".
  - `a pause vote blocks moves and other votes`: during the vote a move is "A pause vote is in progress" and `requestUndo` is "A pause vote is in progress".
  - `a paused room outlives the empty-room timer`: both disconnect, the clock passes `EMPTY_ROOM_TIMEOUT_MS + 1` (use `mock.timers`), the room still exists.
  - `a paused room survives a restart`: with `openGameStore(':memory:')` shared, a second manager loads it paused, with `pause` kept and no empty timer deletion after the timeout.
  - `resume waits for everyone, then play continues on the same turn`: with seat 2 disconnected, `resumeGame` is "Waiting for Bob"; after Bob rejoins it succeeds, `currentPlayer` is unchanged, `pause` is gone from `rawState`, and the next move is accepted.
  - `no view carries the shares`: while paused, `JSON.stringify` of `getState` for each seat and null, every `history` step and the spectator view includes none of `rawState().pause.shares` values.
  - `pauseFile gives each seat its own file`: seat 1's key gets seat 1's file with `hand` from `privateSeatView`; seat 2's key asking for seat 1 is `NOT_AVAILABLE`; a running (not paused) game is `NOT_AVAILABLE`; a device ID passed to `join` opens its seat's file.
  - `the files of every seat open the seal`: `openSeal(file1.seal, { 1: file1.share, 2: file2.share })` deep-equals `sealedRoomOf` of the paused room.
  - `a mid-simulation pause puts the action back`: a test game whose `simulating` is true and whose `onUndo` sets a marker; after the pause the marker is set and the room does not tick.
  - `a disconnect while paused leaves the game alone`: the sealed room opened from the shares deep-equals `sealedRoomOf` of the live room after the disconnect, apart from `disconnected`.
- [ ] **Step 2:** `node --test server/pause.test.ts` fails.
- [ ] **Step 3:** Implement the manager methods, guards, lifecycle changes, messages and server wiring.
- [ ] **Step 4:** `node --test server/pause.test.ts server/games.test.ts server/spectators.test.ts server/store.test.ts` passes.
- [ ] **Step 5:** Commit `Pause and resume a game on the server`.

### Task 6: Checking a full set of pause files

**Files:**
- Modify: `server/pauseFiles.ts`
- Test: add to `server/pauseFiles.test.ts`

**Interfaces:**
- Produces `checkPauseFiles(game, files: PauseFile[]): { room: SealedRoom } | { error: string; seats: Seat[] }`. `seats` are the seats whose files the caller should drop. In order:
  1. The shared part of each file is `canonicalJson` of `{ format, version, gameType, gameId, players, table, history, seal }`. Group the files by it. Every file outside the strictly largest group is named; with no strictly largest group (two files that differ), every file is named.
  2. A file whose `shareHash(share)` is not `seal.shareHashes[seat]` is named.
  3. Seats must be exactly the keys of `players`, once each (the caller guarantees this; assert it).
  4. `openSeal` of the shares; null is "The pause files from <every name> do not match", naming every seat.
  5. Recompute `pausePlainParts` from the opened room for each seat: a `table` or `history` that differs names every seat (they all agreed on it); a `hand` that differs names that seat.
  - Errors: one named seat is "<name>'s pause file does not match the others"; several are "The pause files from <names> do not match", names joined with ", " in seat order.

- [ ] **Step 1: Write the failing tests** on a paused three-seat `handGame` room's files (built with Task 4 and 5's functions):
  - `three good files open the room`: `{ room }` deep-equals `sealedRoomOf` of the paused room.
  - `a changed hand names its seat`: Cara's `hand` set to `'card1'` gives "Cara's pause file does not match the others" and `seats: [3]`.
  - `a changed table names the odd file out`: Bob's `table.gameStatus` changed gives Bob's message and `seats: [2]`.
  - `a swapped share names its seat`: Bob's `share` replaced with Alice's.
  - `two files that disagree name both`: a two-seat game with Bob's `table` changed gives "The pause files from Alice and Bob do not match" and `seats: [1, 2]`.
  - `files that agree on a lie are refused`: every file's `table.gameStatus` changed the same way names all three.
- [ ] **Step 2:** `node --test server/pauseFiles.test.ts` fails on the new tests.
- [ ] **Step 3:** Implement `checkPauseFiles`.
- [ ] **Step 4:** The test passes.
- [ ] **Step 5:** Commit `Check a set of pause files before resuming`.

### Task 7: Resuming from files on the server

**Files:**
- Modify: `server/games.ts`, `server/server.ts`, `server/e2e.ts`
- Test: add to `server/pause.test.ts`

**Interfaces:**
- Consumes: Tasks 4 to 6.
- Manager:
  - `uploadPauseFile(file: unknown, deviceId: unknown): ResumeUpload | { error: string }`. Parses with `parsePauseFile(JSON.stringify(file), ...)` (refusals as there). Then:
    - A room with that ID that is not paused, or whose `pause.seal.fingerprint` differs: "Another game with this ID is on this server".
    - A paused room with the same fingerprint: the seat must be held ("<name> is already in this game" while connected) and the file's `share` must equal `pause.shares[seat]` (else "<name>'s pause file does not match the others"); gives the seat a new `randomUUID()` key and the uploader's device hash, saves, and returns `ready: true`.
    - Otherwise the file joins the resume lobby for that room ID, created on the first file. A file with another fingerprint is "Another game with this ID is on this server"; a seat already in is "<name>'s file is already in". When every seat is in, `checkPauseFiles` runs: an error drops the named seats' files and sets `error`; success calls `restoreRoom` and removes the lobby.
  - `resumeStatus(gameType, gameId, credential: unknown): ResumeStatus | { error: typeof NOT_AVAILABLE }`: the lobby's status for a key one of its uploads holds (and touches its timer), or for a room whose `seatKeys` hold it, `ready: true` with every seat ready.
  - `restoreRoom(roomId, lobby, room: SealedRoom)` (closure helper): the state gets the uploads' `seatKeys` and `seatDevices`, `disconnected` = every seat, `spectators: []`, `spectatorKeys: {}`, `handRequests: []`, `pause: { seal, shares }` from the files; every `history` and `timeline` entry gets the same `seatKeys` and `seatDevices`, so an undo keeps the new keys. Writes the store as `remove`, then one `save` per step (`{ type: 'push', index, before, after }`), then `save(roomId, room)`.
  - `type ResumeLobby = { game; gameId: string; fingerprint: string; players: Record<Seat, string>; uploads: Map<Seat, { file: PauseFile; seatKey: string; device: string | null }>; error: string | null; timer: ReturnType<typeof setTimeout> }`, in a `Map` beside `rooms`. Each upload or status read resets its `EMPTY_ROOM_TIMEOUT_MS` timer (`unref`), which deletes it.
  - `join` and `joinLocal` for a room ID with a lobby and no room: "This game is waiting for its pause files. Choose Resume a game and upload yours".
- `server/server.ts`: `POST /api/resume` with `express.json({ limit: '20mb' })`, body `{ file, deviceId }`: 200 `ResumeUpload` or 400 `{ error }`. `GET /api/resume/:gameType/:gameId` with `bearer(req)`: 200 or 404 `NOT_AVAILABLE_BODY`.
- `server/e2e.ts`: `DELETE /api/e2e/room/:gameType/:gameId` calls `manager.removeRoom`, 404 when there was none.

- [ ] **Step 1: Write the failing tests** in `server/pause.test.ts` (files from Task 5's paused game; "lost" means a new manager with no store):
  - `files resume a lost game in the same seats on the same turn`: Alice's upload gives `ready: false` with Bob not ready; Bob's gives `ready: true`; both rejoin by name with their new keys; `resumeGame` succeeds; `currentPlayer`, the hands and `history` steps equal the original's.
  - `the uploader's device takes the seat`: `rawState().seatDevices[1]` is `hashDeviceId` of Alice's upload device ID.
  - `undo works after a resume from files`: after resuming, a move, `requestUndo` and approval restore the previous step, and Alice can still rejoin with her uploaded key.
  - `a tampered file is refused and can be replaced`: Bob's `hand` changed gives `error` "Bob's pause file does not match the others" in the status, Bob not ready; Bob's real file then resumes it.
  - `a file goes to its paused game on the server`: with the original manager still holding the paused room and Bob disconnected, Bob's upload returns `ready: true` and a new key that rejoins.
  - `a file from another game is refused`: a running game with the same ID, and a different paused game's file uploaded to a lobby, are both "Another game with this ID is on this server".
  - `the same seat twice is refused`: "Alice's file is already in".
  - `joining a game waiting for files is refused` with the lobby message.
  - `a lobby nobody touches is forgotten`: after `EMPTY_ROOM_TIMEOUT_MS + 1`, `resumeStatus` is `NOT_AVAILABLE`.
- [ ] **Step 2:** `node --test server/pause.test.ts` fails on the new tests.
- [ ] **Step 3:** Implement the manager methods, routes and the e2e hook.
- [ ] **Step 4:** The test passes.
- [ ] **Step 5:** Commit `Resume a lost game from everyone's pause files`.

### Task 8: Pause in the game page

**Files:**
- Create: `src/components/PauseButton.tsx`, `src/components/PauseVote.tsx`, `src/components/PausedScreen.tsx`, `src/services/pauseFiles.ts`, `e2e/pause.spec.ts`
- Modify: `src/services/gameService.ts`, `src/components/GameView.tsx`, `src/components/VotePanel.tsx`, `src/App.scss`
- Test: `src/services/pauseFiles.test.ts`, `e2e/pause.spec.ts`

**Interfaces:**
- `gameService`: `requestPause()`, `votePause(approve: boolean)`, `resumeGame()`.
- `src/services/pauseFiles.ts`: `fetchPauseFile(gameType: string, gameId: string, seat: Seat): Promise<PauseFile | null>` (Bearer `deviceId()`, null on any failure); `downloadPauseFile(file: PauseFile): void` (`downloadJson(pauseFileName(...), file)`).
- `PauseButton({ disabled, onPause })`: `<button type="button" className="pause-button">Pause</button>`. `GameView` shows it for a seated player or a pass-and-play device, only while `started && !isGameOver && !paused`, disabled while any vote is open or anyone is disconnected (title "Everyone must be here to pause"). At 480 px or less the header copy is hidden by the existing rule outside `:where()` and a "Pause the game" row with the same button sits in `phoneControls`.
- `PauseVote({ gameState, voter: Seat | null, onVote })`: `VotePanel` with `className="pause-vote"`, title "<name> wants to pause the game", `voters={gameState.activePlayers}`. `GameView` passes `voter = playerNumber ?? localSeats?.[0]?.seat ?? null`, so a device mid-handoff still votes (for all its seats, on the server).
- `PausedScreen({ game, gameState, seats: { seat: Seat; name: string }[], onResume })`: replaces the game screen, the handoff screen, the spectator view and the table screen view while `gameState.paused`. Heading "Game paused"; for players the line "Keep your pause file. If the server loses this game, everyone's files together bring it back."; one button "Download my pause file" for a single seat or "Download <name>'s pause file" per local seat, with "Could not download the pause file" inline on failure; then "Waiting for <names>" from `gameState.disconnected`, or "Everyone is here" and a Resume button. `seats` is empty for a spectator or table screen, which sees only the heading and the waiting line. `PresenceBar`'s `onDismiss` is null while paused.

- [ ] **Step 1: Write the failing tests.** `src/services/pauseFiles.test.ts`: `fetchPauseFile sends the device ID and returns null on a 404` (stub `fetch`). `e2e/pause.spec.ts` (`seat('uno', ['Alice', 'Bob'])`, then `table.patch({ started: true })`):
  - `everyone agrees to pause, each downloads a file, and Resume continues`: Alice clicks Pause; both pages show "Alice wants to pause the game"; Bob clicks Approve; both show "Game paused" and "Everyone is here"; Alice's `waitForEvent('download')` on "Download my pause file" gives `uno-<id>-Alice-paused.json` whose JSON has `seat: 1`; Bob clicks Resume; both show the game screen and "Play resumed".
  - `a declined pause leaves the game running`: "Bob declined to pause", no paused screen.
  - `a paused game waits for a missing player`: Bob presses Back to games; Alice sees "Waiting for Bob" and no Resume; Bob rejoins with the rejoin button; Alice sees "Everyone is here".
  - `a pass and play device pauses for every seat it holds`: `joinPassAndPlay(page, 'uno', id, ['Alice', 'Bob'])`, patch started, Pause gives "Game paused" at once, with "Download Alice's pause file" and "Download Bob's pause file".
  - `a spectator sees the pause but no download`.
- [ ] **Step 2:** `node --test src/services/pauseFiles.test.ts` fails; `npx vite build` then `E2E_PORT_BASE=6570 npx playwright test e2e/pause.spec.ts` fails.
- [ ] **Step 3:** Implement the components and wiring; style `.pause-vote*` like `.undo-vote*` and `.paused-screen` in `src/App.scss` with existing tokens.
- [ ] **Step 4:** Both commands pass.
- [ ] **Step 5:** Browser check per the index plan: the Pause button, vote panel and paused screen in light and dark, at desktop, 390 px and 320 px (header still one row at 320 px).
- [ ] **Step 6:** Commit `Pause button, vote and paused screen`.

### Task 9: Resume a game from the landing page

**Files:**
- Create: `src/components/ResumeGame.tsx`, `src/components/ResumeWaitingRoom.tsx`
- Modify: `src/services/pauseFiles.ts`, `src/hooks/useGameConnection.ts`, `src/App.tsx`, `src/App.scss`, `e2e/pause.spec.ts`
- Test: `src/services/pauseFiles.test.ts`, `e2e/pause.spec.ts`

**Interfaces:**
- `src/services/pauseFiles.ts`: `RESUME_POLL_MS = 2000`; `uploadPauseFile(file: PauseFile): Promise<ResumeUpload | { error: string }>` (POST `/api/resume` with `{ file, deviceId: deviceId() }`; a network failure is "Could not reach the server"); `fetchResumeStatus(gameType, gameId, seatKey): Promise<ResumeStatus | null>`; `sessionForResume(uploads: ResumeUpload[]): Session`: one upload is `{ gameType, gameId, playerName, seatKey, inGame: true }`; several are `role: 'passAndPlay'` with `localSeats` in seat order and `playerName` the first.
- `useGameConnection` returns `resume(session: Session): void`: `updateSession(session)`, then `rejoin()`.
- `ResumeGame({ games, onReady })`: a "Resume a game" button (`.open-saved-game` look) beside Open a saved game, with a hidden `<input type="file" accept=".json,application/json" multiple>`. Each file goes through `parsePauseFile`; files for more than one `gameType`/`gameId` are "These files are from different games"; then each is uploaded in turn. Errors show inline under the button. Once uploads succeed it shows `ResumeWaitingRoom`.
- `ResumeWaitingRoom({ game, uploads, onReady, onCancel })`: `.modal.resume-waiting` titled "Resuming <game name> <game ID>"; one line per player, "<name>: file in" or "<name>: waiting"; the server's `error`; the join link's QR code (`ServerSvg` of `svgUrl('qr', joinLink(...))`) with "Everyone else chooses Resume a game and uploads their own file"; Cancel (Escape too). Polls `fetchResumeStatus` every `RESUME_POLL_MS` with the first upload's key; `ready` calls `onReady(sessionForResume(uploads))`; a null status is "This game is no longer waiting. Upload your file again".
- `App.tsx` renders `ResumeGame` in `.lobby-actions` and passes `resume` as `onReady`.

- [ ] **Step 1: Write the failing tests.** `src/services/pauseFiles.test.ts`: `sessionForResume` for one and for two uploads. `e2e/pause.spec.ts`:
  - `a lost game resumes from everyone's files`: pause a two-seat UNO game, both download, both press Back to games, `fetch(DELETE /api/e2e/room/uno/<id>)`; Alice picks her file with "Resume a game" (`setInputFiles`) and sees "Bob: waiting"; Bob picks his; both pages reach "Everyone is here"; Alice presses Resume; `table.state()` has the same `currentPlayer` and `hands` as before the pause.
  - `a changed file is named in the waiting room`: Bob's file with `hand` edited shows "Bob's pause file does not match the others" on Alice's page.
  - `joining by ID while files are awaited explains what to do`: Bob uses the join dialog and sees "This game is waiting for its pause files. Choose Resume a game and upload yours".
- [ ] **Step 2:** The tests fail.
- [ ] **Step 3:** Implement the services, hook change and components.
- [ ] **Step 4:** `node --test src/services/pauseFiles.test.ts` and `E2E_PORT_BASE=6570 npx playwright test e2e/pause.spec.ts` pass.
- [ ] **Step 5:** Browser check: the button and waiting room in light and dark, at desktop, 390 px and 320 px.
- [ ] **Step 6:** Commit `Resume a game from pause files on the landing page`.

### Task 10: Docs and gates

**Files:**
- Modify: `docs/architecture.md`, `README.md`

- [ ] **Step 1:** `docs/architecture.md`: in the platform list, pausing and resuming (vote, seal, paused rooms kept, resume lobby); in Contracts, `secretState`, `pauseVote`, `paused`, `pause` (stripped like `seatKeys`), `shared/pause.ts`, `shared/pauseFile.ts`, `server/pauseSeal.ts`, `server/pauseFiles.ts`, `server/views.ts`; the three messages and three routes; the components `PauseButton`, `PauseVote`, `PausedScreen`, `ResumeGame`, `ResumeWaitingRoom`. Replace "deleting a game 10 minutes after its last connected player leaves" with the paused exception.
- [ ] **Step 2:** `README.md`: a "Pausing a game" step under How to Play Multiplayer (vote, files, resuming from the server or from files, every seat needed, a lost file cannot be replaced, the files give "a bit" of protection: all of them together unlock the hidden cards); in Saved games, that a paused game is not deleted after 10 minutes; in Notifications, that a pause vote is a vote.
- [ ] **Step 3:** Run the index plan's gates: `npm run lint`, `npm test`, `npm run build`, `E2E_PORT_BASE=6570 npx playwright test e2e/pause.spec.ts e2e/passAndPlay.spec.ts e2e/spectators.spec.ts e2e/jenga.spec.ts e2e/alerts.spec.ts`. All pass (a failure rerun alone once, both results recorded).
- [ ] **Step 4:** Commit `Document pausing and resuming`, then open the PR as the index plan says. Rulings for the PR body: a pause needs everyone connected and a disconnect ends the vote; play continues on Resume once everyone is back, not on the last arrival (so a refresh never restarts a paused game); files go over HTTP because sockets refuse frames over 64 KB; the plain history is the table's view only; the resume lobby is memory only, so a restart while waiting means uploading again.
