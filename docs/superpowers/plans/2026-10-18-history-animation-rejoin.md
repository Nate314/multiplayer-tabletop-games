# History, Animation, Rejoining and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add American spelling, README credits, a GitHub link, a move history dialog, move animations, and seat-holding disconnect/rejoin with dismiss votes, in one PR.

**Architecture:** Seat holding, dismiss votes, the move timeline and the history endpoint are platform features in `shared/`, `server/` and `src/`, tested against the fake `testGame`. Each game adds only a read-only history board, a move description, and its own animations built on a small platform helper. Azul gets one rules change: disconnected players count as having clicked Continue.

**Tech Stack:** React 19, Vite 6, TypeScript 5.9, Express 5, `ws` 8, Node 22.18+, `node --test` (with `mock.timers`), ESLint 9. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-history-animation-rejoin-design.md`

## Global Constraints

- Branch `history-animation-rejoin` off `master`; one PR; CI green.
- No new runtime or dev dependencies.
- No em-dashes (U+2014) in prose, UI text, comments or commit messages.
- Server code (`server/`, `shared/`, `games/<id>/*.ts` outside `client/`) never imports `src/` or `games/<id>/client/`.
- Game CSS stays scoped under `[data-game="<id>"]`; new platform UI gets `:where()` default styles in `src/App.css` like the existing ones.
- Every state reaching a browser, by WebSocket or HTTP, goes through the game's `toPublicState`.
- Animation duration about 300 ms (`MOVE_DURATION_MS = 300`); none under `prefers-reduced-motion: reduce`.
- Empty-game grace period `EMPTY_ROOM_TIMEOUT_MS = 10 * 60 * 1000`; heartbeat ping every 15 s, a socket that misses a pong is terminated (dead within about 30 s).
- Repo URL for the GitHub link: `https://github.com/Nate314/multiplayer-tabletop-games`.
- Run tests with plain `node --test`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Browser checks use the Claude in Chrome tools in new tabs; same-origin iframes of 1280px and 390px wide stand in for window resizing.

## Review Focus

1. Rejoining as `" alice "` when the seat is held for `Alice` reclaims seat and keeps the display name `Alice`. Test in Task 3.
2. `GET` history for an unknown game type, an unknown ID, or an ID containing `/` or `%` returns 404 JSON and the server keeps running. Test in Task 3 (manager) and manual curl in Task 3.
3. Undoing the move made just before a now-disconnected player's turn restores a state whose current player is that disconnected seat: the game waits on them instead of skipping. Test in Task 3.
4. The undo requester refreshes while their vote is open: the vote is cancelled on disconnect and nothing is stuck after they rejoin. Test in Task 3.
5. An opponent's move arrives while the previous animation is still running: pieces end in the right place with no duplicate or stuck tile. Browser check in Tasks 7 and 8.

---

## File Structure

```
shared/types.ts            + DismissVote, disconnected, dismissVote on BaseGameState; moveCount on BasePublicState
shared/seating.ts          + connectedPlayers, findSeatByName, disconnectPlayer, reconnectPlayer, resolveDismissVote; dismissal strings
shared/gameDefinition.ts   + onPlayerDisconnected hook
shared/messages.ts         + REQUEST_DISMISS, VOTE_DISMISS; JOIN_GAME.rejoin
server/games.ts            rejoin, disconnect, empty-room timer, dismiss votes, timeline, history(), moveCount
server/server.ts           heartbeat, GET /api/history/:gameType/:gameId, new messages
games/azul/rules.ts        disconnected players count as acknowledged; onPlayerDisconnected
src/services/session.ts    remembered game in localStorage
src/hooks/useGameConnection.ts, src/services/gameService.ts, src/App.tsx
src/components/GitHubLink.tsx, RejoinButton.tsx, PresenceBar.tsx, DismissVote.tsx, HistoryButton.tsx, HistoryDialog.tsx
src/animation/motion.ts, src/animation/useMoveAnimation.ts
src/clientGames.ts         + HistoryBoard, describeMove on ClientGame
games/<id>/client/HistoryBoard.tsx, describeMove.ts, animations in existing components
```

---

### Task 1: American spelling, README credits, GitHub link

**Files:** every tracked file with a British spelling; `README.md`; Create `src/components/GitHubLink.tsx`; Modify `src/App.tsx` (lobby header), `src/components/GameView.tsx` (game header), `src/App.css`.

- [ ] **Step 1:** Create branch `history-animation-rejoin` from `master`; commit the spec and this plan ("docs: design and plan for history, animation and rejoining").
- [ ] **Step 2:** Replace British spellings everywhere tracked (code identifiers, strings, tests, comments, CSS, README, all docs): colour(s/ed), centre(d), cancelled, behaviour, neighbours, and any other British forms found by searching (-ise/-isation/-yse verbs, grey, favour, honour, labelled in prose, catalogue, whilst, amongst). Keep `aria-labelledby`. Test assertions change in step with the messages (for example `'No tiles of that color there'`).
- [ ] **Step 3:** README: add an "Inspirations" section linking `https://github.com/Nate314/quoridor` and `https://github.com/Nate314/azul`, saying both are deprecated and this repo grew out of them.
- [ ] **Step 4:** `GitHubLink()`: an `<a className="github-link">` to the repo URL, `target="_blank"`, `rel="noopener noreferrer"`, `aria-label="View source on GitHub"`, containing the GitHub mark as inline SVG using `currentColor`. Render it right before `<ThemeToggle />` in the lobby header and the game header. Style it like `.theme-toggle` (lobby rule and `:where()` game default).
- [ ] **Step 5: Verify:** `git grep -niE "colour|centre|behaviour|neighbour|cancelled"` returns nothing; `npm run typecheck && npm run lint && node --test && npm run build`; browser: the button sits beside the theme toggle on the landing page and on both games, in light and dark, at 1280 and 390, and opens the repo in a new tab.
- [ ] **Step 6:** Commit "chore: American spelling, credits and GitHub link".

---

### Task 2: Platform seat holding and dismiss votes (pure state)

**Files:** Modify `shared/types.ts`, `shared/gameDefinition.ts`, `shared/seating.ts`, `shared/testGame.ts` (if needed); Test `shared/seating.test.ts`.

**Interfaces (produces):**

```ts
// shared/types.ts
export type DismissVote = { target: Seat; requestedBy: Seat; votes: Record<Seat, boolean> };
// BaseGameState gains:
disconnected: Seat[];             // held seats, sorted ascending; always a subset of activePlayers
dismissVote: DismissVote | null;
// BasePublicState gains (filled by the manager in Task 3):
moveCount: number;                // moves on the timeline; undo lowers it

// shared/gameDefinition.ts
// Mid-game, after the platform marked `seat` disconnected and settled votes.
onPlayerDisconnected?(state: S, seat: Seat, random: Random): S;

// shared/seating.ts
export function connectedPlayers(state: Pick<BaseGameState, 'activePlayers' | 'disconnected'>): Seat[];
export function findSeatByName(state: BaseGameState, name: string): Seat | undefined; // trimmed, case-insensitive, over every name in playerNames
export function disconnectPlayer<S extends BaseGameState>(game: GameDefinition<S, BasePublicState>, state: S, seat: Seat, random?: Random): S;
export function reconnectPlayer<S extends BaseGameState>(state: S, seat: Seat): S;
export function resolveDismissVote<S extends BaseGameState>(game: GameDefinition<S, BasePublicState>, state: S, random?: Random): S;
```

Behavior:
- `baseGameState` starts `disconnected: []`, `dismissVote: null`.
- `disconnectPlayer` before the first move is `removePlayer` (seat freed, as today). After it: add the seat to `disconnected`; `gameStatus = \`${name} disconnected\``; if the seat requested the open undo vote, clear `undoVote`; if a dismiss vote is open, call `resolveDismissVote`; then `onPlayerDisconnected` if defined. Already-disconnected seats are a no-op. (The manager re-resolves an open undo vote, since that needs history.)
- `reconnectPlayer`: remove from `disconnected`; `gameStatus = \`${name} is back\``; clear `dismissVote` if it targets this seat.
- `resolveDismissVote`: if every connected seat has voted yes, `removePlayer` the target, clear the vote and set `gameStatus = \`${name} was dismissed\`` (the last-player-wins status from `removePlayer` takes precedence).
- `removePlayer` mid-game (now reached only by dismissal) also drops the seat from `disconnected`; its mid-game status becomes `\`${name} was dismissed\``.
- `applyMove` adds a guard after the undo-vote guard: `'A dismiss vote is in progress'`.

- [ ] **Step 1: Write failing tests** in `shared/seating.test.ts`:
  - `a lobby disconnect frees the seat`: two players, seat 2 disconnects before any move; `activePlayers` `[1]`, `disconnected` `[]`.
  - `a mid-game disconnect holds the seat and the turn waits`: three players, one move, current player disconnects; `activePlayers` unchanged, `disconnected` contains them, `currentPlayer` unchanged, status `'C disconnected'` (use the names your fixture uses).
  - `findSeatByName ignores case and spaces`: `findSeatByName(state, '  a ')` returns the seat named `'A'`.
  - `reconnecting clears the seat and a dismiss vote against it`.
  - `a dismiss vote passes only when every connected player approves`; after passing, target not in `activePlayers` or `disconnected`, status `'C was dismissed'`.
  - `dismissing the last opponent wins`: status `'A wins! Everyone else left.'`, `winners` `[1]`.
  - `moves are refused during a dismiss vote`: `'A dismiss vote is in progress'`.
  - `the undo requester disconnecting cancels the undo vote`.
  - Update the existing `leaving mid-game ...` expectation to the dismissal wording.
- [ ] **Step 2:** `node --test` shows the new tests failing.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run typecheck && npm run lint && node --test` pass (fix game fixtures that build `BaseGameState` literals).
- [ ] **Step 5:** Commit "feat: hold seats on disconnect and dismiss by vote".

---

### Task 3: Manager, protocol, history endpoint and heartbeat

**Files:** Modify `server/games.ts`, `server/server.ts`, `shared/messages.ts`; Test `server/games.test.ts`.

**Interfaces:**
- Consumes: Task 2 exports.
- Produces:

```ts
// shared/messages.ts
MESSAGE_TYPES += { REQUEST_DISMISS: 'REQUEST_DISMISS', VOTE_DISMISS: 'VOTE_DISMISS' }
ClientMessage JOIN_GAME gains `rejoin?: boolean`
  | { type: 'REQUEST_DISMISS'; payload: { seat: Seat } }
  | { type: 'VOTE_DISMISS'; payload: { approve: boolean } }

// server/games.ts
export const EMPTY_ROOM_TIMEOUT_MS = 10 * 60 * 1000;
join(gameType: unknown, gameId: unknown, playerName: unknown, rejoin?: unknown): JoinResult;
disconnect(roomId: string, seat: Seat): { state: BasePublicState } | null;  // replaces leave()
requestDismiss(roomId: string, seat: Seat, target: unknown): Result<BasePublicState>;
voteDismiss(roomId: string, seat: Seat, approve: unknown): Result<BasePublicState>;
history(gameType: unknown, gameId: unknown): BasePublicState[] | null;    // null when the game does not exist

// HTTP
GET /api/history/:gameType/:gameId  -> 200 { steps: BasePublicState[] } | 404 { error: 'Game not found' }
```

Behavior:
- Room gains `timeline: BaseGameState[]` (state right after each move) and an empty-room timer. `move` pushes onto `history` (before) and `timeline` (after); an applied undo pops both. `view` returns `{ ...game.toPublicState(state, history.length > 0), moveCount: timeline.length }`. `history()` returns each timeline entry through `toPublicState(entry, false)` with its `moveCount` = 1-based index.
- `join` order: unknown game; trim/cap and blanks (unchanged); room missing: with `rejoin === true` return `'Game not found'`, else create. Then `findSeatByName`: seat in `activePlayers` and not disconnected: `\`${storedName} is already in this game\``; seat disconnected: `reconnectPlayer`, clear the empty-room timer, return that seat; name found but not in `activePlayers` after start (dismissed): `'You were removed from this game'`; no match with `rejoin === true`: `'You are not in this game'`; otherwise `addPlayer`.
- `disconnect`: `disconnectPlayer`; then re-resolve an open undo vote over connected seats; delete the room if `activePlayers` is empty; if started and no connected seats remain, start a `setTimeout(EMPTY_ROOM_TIMEOUT_MS)` that deletes the room.
- Undo: `requestUndo` refuses with `'Not enough players to vote'` when fewer than 2 connected, and `'A dismiss vote is in progress'` while one is open; `resolveUndoVote` requires every connected seat; restore keeps current `activePlayers`, `playerNames`, `disconnected`, and clears both votes.
- `requestDismiss`: target must be a disconnected seat (`'That player is not disconnected'`); refuses while any vote is open (`'A vote is already in progress'`); opens `{ target, requestedBy, votes: { [seat]: true } }` with status `\`${name} wants to dismiss ${targetName}\``, then `resolveDismissVote` (a lone connected player passes immediately). `voteDismiss` mirrors `voteUndo`: decline clears it with `\`${name} declined to dismiss ${targetName}\``.
- `server.ts`: register `app.get('/api/history/:gameType/:gameId', ...)` before `express.static` and the fallback; route `REQUEST_DISMISS`/`VOTE_DISMISS`; pass `message.rejoin`; on close call `manager.disconnect`; heartbeat with `ws.ping()` every 15 s, `terminate()` sockets that did not answer the previous ping (`isAlive` flag set on `'pong'`), cleared on server close.

- [ ] **Step 1: Write failing tests** (testGame, `mock.timers` from `node:test` for the timer):
  - `a disconnected player rejoins their seat by name` with `' a '` for `'A'`: same seat, name stays `'A'`, status `'A is back'` (Review Focus 1).
  - `a connected name cannot be taken`: `'A is already in this game'`; lobby duplicate name refused the same way.
  - `a dismissed player cannot rejoin`: `'You were removed from this game'`.
  - `rejoin never creates a game`: `join('test','nope','A', true)` gives `'Game not found'`.
  - `an empty started game survives ten minutes`: all disconnect, advance 599 999 ms, rejoin works; separate test: advance 600 000 ms, `getState` undefined.
  - `undo counts only connected players` and `undo needs two connected players`.
  - `undo back to a disconnected player's turn waits on them` (Review Focus 3).
  - `the undo requester disconnecting cancels the vote, and rejoining leaves no vote` (Review Focus 4).
  - `dismiss vote: target must be disconnected; one at a time; decline cancels; approval removes`.
  - `history lists the state after each move, hides secrets, and drops undone moves`: 3 moves, `history()` length 3 with `moveCount` 1..3 and no `secret`; after an approved undo, length 2; unknown type, unknown id, and id `'a/b'` return null (Review Focus 2).
  - `actions add no history steps`.
  - Port existing tests that used `leave` to `disconnect` with the new semantics (a lobby leave still frees the seat; a mid-game leave now holds it).
- [ ] **Step 2:** Confirm failures.
- [ ] **Step 3:** Implement manager, messages, server.
- [ ] **Step 4:** `npm run typecheck && npm run lint && node --test`; then `npm start` and `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/history/azul/missing` prints `404`, and `.../api/history/azul/a%2Fb` prints `404`.
- [ ] **Step 5:** Commit "feat: rejoin, dismiss votes, history endpoint and heartbeat".

---

### Task 4: Azul round summary skips disconnected players

**Files:** Modify `games/azul/rules.ts`, `games/azul/index.ts`; Test `games/azul/rules.test.ts`.

- `startNextRoundIfReady` deals when every seat in `connectedPlayers(state)` has acknowledged. `azul.onPlayerDisconnected = (state, seat, random) => startNextRoundIfReady(state, random)`.

- [ ] **Step 1: Failing tests:** `the next round does not wait for a disconnected player` (3 players, round ends, A and B acknowledge, C disconnects: round 2 dealt); `a disconnect after everyone else continued deals the round` (A, B acknowledged, then C disconnects via `disconnectPlayer`: round 2 dealt).
- [ ] **Step 2-4:** Confirm failure, implement, `node --test` and lint/typecheck pass.
- [ ] **Step 5:** Commit "feat: Azul's next round does not wait for disconnected players".

---

### Task 5: Client rejoining, presence and dismiss UI

**Files:** Create `src/services/session.ts`, `src/components/RejoinButton.tsx`, `src/components/PresenceBar.tsx`, `src/components/DismissVote.tsx`; Modify `src/services/gameService.ts`, `src/hooks/useGameConnection.ts`, `src/App.tsx`, `src/components/GameView.tsx`, `src/App.css`, README, `docs/architecture.md`.

**Interfaces:**

```ts
// src/services/session.ts (every storage access in try/catch; works with storage unavailable)
export type Session = { gameType: string; gameId: string; playerName: string; inGame: boolean };
export function loadSession(): Session | null;   // key 'lastGame'
export function saveSession(session: Session): void;
export function clearSession(): void;

// gameService
connect(gameType, gameId, playerName, rejoin = false): void;
requestDismiss(seat: Seat): void; voteDismiss(approve: boolean): void;

// useGameConnection returns also
{ session: Session | null, rejoin(): void }
```

Behavior:
- On `GAME_JOINED`, save the session with `inGame: true`. "Back to games" disconnects and saves `inGame: false`. Opening or closing the join dialog must not touch the session.
- On page load with `inGame: true`, call `connect(..., rejoin = true)` automatically. If the error is `\`... is already in this game\``, retry up to 5 times, 1 s apart. Any other join error, or retries exhausted: `clearSession()` and show the error on the game list.
- A lost server connection keeps the session with `inGame: false`.
- Landing: when a session exists with `inGame: false`, `RejoinButton` shows `Back to ${gameName} (${gameId})` above the game list and calls `rejoin()`.
- `App` shows `GameView` for `session.gameType` after an automatic or button rejoin.
- `PresenceBar` (in `GameView`, above the screen, hidden when nobody is disconnected): each disconnected player as `${name} (disconnected)` with a `Dismiss` button (disabled while any vote is open), and `Waiting for ${name} to reconnect` when `currentPlayer` is disconnected and the game is not over. `DismissVote` mirrors `UndoVote` (`${requester} wants to dismiss ${target}`, Approve/Decline for connected players who have not voted). Platform default styles via `:where()`.
- Docs: README play instructions and `docs/architecture.md` describe holding seats, rejoining and dismissing.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npm run typecheck && npm run lint && node --test && npm run build`.
- [ ] **Step 3: Browser check** (two tabs, both games): mid-game refresh rejoins automatically into the same seat; "Back to games" shows `Back to Azul (<id>)` and one click rejoins; other tab sees `(disconnected)` and, on that player's turn, `Waiting for ... to reconnect`; join from a third tab with the same name in different case takes the held seat; dismiss vote approve and decline; dismissed player sees `You were removed from this game`; with localStorage blocked (javascript `Storage.prototype.setItem = () => { throw new Error() }` before load) the site still works; 390px layout.
- [ ] **Step 4:** Commit "feat: rejoin automatically, one-click rejoin, and dismiss UI".

---

### Task 6: History dialog

**Files:** Create `src/components/HistoryButton.tsx`, `src/components/HistoryDialog.tsx`, `games/quoridor/client/HistoryBoard.tsx`, `games/quoridor/client/describeMove.ts`, `games/azul/client/HistoryBoard.tsx`, `games/azul/client/describeMove.ts`; Modify `src/clientGames.ts`, `src/components/GameView.tsx`, both `client/index.ts`, `src/App.css`, README "Adding a game", `docs/architecture.md`.

**Interfaces:**

```ts
// src/clientGames.ts, added to ClientGame
HistoryBoard: ComponentType<{ gameState: any }>;   // read-only board of one public state with its lastMove highlighted
describeMove(gameState: any): string;              // e.g. 'Alice placed a wall', from the state's lastMove and playerNames
```

Behavior:
- `HistoryButton` in the game header (before FAQ), labelled `History`, disabled while `gameState.moveCount === 0`. Opening fetches `/api/history/${gameType}/${encodeURIComponent(gameId)}` once; shows a loading line, then the dialog; a failed fetch shows `Could not load the history`.
- `HistoryDialog`: title `History`; a native `<input type="range">` from 1 to N, starting at N; `Move ${k} of ${N}: ${describeMove(step)}`; the game's `HistoryBoard` for step k; Close button and Escape. Rendered inside the game root so the game's CSS applies. No animation.
- Quoridor `HistoryBoard`: reuse `Board` with no interaction, `showLastMove` on. Descriptions: `${name} moved` and `${name} placed a wall`.
- Azul `HistoryBoard`: reuse `Factories` and `PlayerBoard` for every seat with no interaction and no round summary panel; the last-source highlight shows; the destination pattern line or floor line is highlighted too (add a scoped class if none exists). Description: `${name} took ${count} ${color} from factory ${n}` or `the center`, to `line ${line + 1}` or `the floor` (match `games/azul/rules.ts` status wording).

- [ ] **Step 1:** Implement; unit-test both `describeMove` functions in `games/<id>/client/describeMove.test.ts` against fixture states (Quoridor move and wall; Azul factory-to-line and center-to-floor).
- [ ] **Step 2:** `npm run typecheck && npm run lint && node --test && npm run build`.
- [ ] **Step 3: Browser check:** both games, several moves, slider from first to last with arrow keys, highlights match, other tab unaffected; Azul step on a round-ending move shows scored walls without the summary panel; undo then reopen drops the step; 390px and dark mode.
- [ ] **Step 4:** Commit "feat: move history dialog".

---

### Task 7: Animation helper and Quoridor animations

**Files:** Create `src/animation/motion.ts`, `src/animation/useMoveAnimation.ts`; Modify Quoridor `Board.tsx` (and `Pawn.tsx`/`WallPiece.tsx` as needed); README "Adding a game", `docs/architecture.md`.

**Interfaces:**

```ts
// src/animation/motion.ts
export const MOVE_DURATION_MS = 300;
export function prefersReducedMotion(): boolean;
export function slideFrom(element: Element, from: DOMRect, durationMs?: number): void; // Web Animations API translate(from - to) -> 0; no-op with reduced motion
export function fadeIn(element: Element, durationMs?: number): void;

// src/animation/useMoveAnimation.ts
export function useMoveAnimation<P extends BasePublicState>(
  rootRef: RefObject<HTMLElement | null>,
  state: P,
  animate: (change: { previous: P; next: P; root: HTMLElement; rectOf: (key: string) => DOMRect | undefined }) => void
): void;
```

- `useMoveAnimation` runs in a layout effect. It calls `animate` only when `next.moveCount === previous.moveCount + 1` (so first render, rejoin and undo snap). `rectOf(key)` returns the rect, measured after the previous render, of the element with `data-anim-key="<key>"`. After animating it re-measures every `[data-anim-key]` in the root. A new animation on an element cancels its running one (`element.getAnimations().forEach(a => a.cancel())`) so a fast follow-up move ends in the right place.
- Quoridor: squares carry `data-anim-key="square-<row>-<col>"`; on a pawn move the pawn element slides from `rectOf(square-<from>)`; a new wall element gets `fadeIn`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** typecheck, lint, tests, build.
- [ ] **Step 3: Browser check:** two tabs; both see the pawn glide (including a jump) and the wall fade; undo snaps; refresh and history dialog do not animate; with reduced motion emulated (javascript `matchMedia` override before load, or CSS media emulation) pieces move instantly; two quick moves end with pieces in the right squares (Review Focus 5).
- [ ] **Step 4:** Commit "feat: animate Quoridor moves".

---

### Task 8: Azul animations

**Files:** Modify `games/azul/client/Factories.tsx`, `PlayerBoard.tsx`, `GameScreen.tsx`, `Tile.tsx` as needed.

- Keys: factory slots `factory-<i>-<j>`, center slots `center-<j>`, pattern line slots `line-<seat>-<row>-<k>`, floor slots `floor-<seat>-<k>`, wall cells `wall-<seat>-<row>-<col>`.
- Using `lastMove` and the previous/next states: picked tiles slide from their source slots to the newly filled pattern line slots; overflow tiles slide to the newly filled floor slots (the first-player marker too); tiles left in a factory slide to their new center slots; on a round-ending move, each newly placed wall tile slides from the last slot of its pattern line. The next-round deal after Continue does not animate (it does not change `moveCount`).

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** typecheck, lint, tests, build.
- [ ] **Step 3: Browser check:** two tabs; factory pick, center pick with marker, overflow to floor, leftovers to center, a round end with wall placement; reduced motion; fast consecutive moves (Review Focus 5); 390px.
- [ ] **Step 4:** Commit "feat: animate Azul moves".
