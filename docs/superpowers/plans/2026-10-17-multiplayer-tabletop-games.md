# Multiplayer Tabletop Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine `Nate314/quoridor` and `Nate314/azul` into one private repo and site where shared plumbing is written once and each game is a self-contained folder.

**Architecture:** A platform layer (`shared/`, `server/`, `src/`) owns seating, turn guards, undo, the WebSocket protocol, the landing page, the join dialog and the FAQ frame. Each game lives in `games/<id>/` and exports a `GameDefinition` (pure rules, server-safe) plus a `ClientGame` (React screen, FAQ data, icon, scoped CSS). Adding a game means a new `games/<id>/` folder plus one line in `games/registry.ts` and one line in `src/clientGames.ts`.

**Tech Stack:** React 19, Vite 6, TypeScript 5.9, Express 5, `ws` 8, Node 22.18+ (runs server `.ts` directly), `node --test`, ESLint 9, Docker, compose-launcher submodule.

**Spec:** `docs/superpowers/specs/2026-10-17-multiplayer-tabletop-games-design.md`

**Source repos (reference while porting):** clone `Nate314/quoridor` and `Nate314/azul` into a scratch directory outside this repo. File paths below written as `quoridor:<path>` or `azul:<path>` refer to those clones.

## Global Constraints

- Repo: `Nate314/multiplayer-tabletop-games`, private, default branch `master`.
- Node `>=22.18` in `package.json` `engines`; `.nvmrc` is `22`.
- No new dependencies beyond what both source `package.json` files already list.
- Player names and game IDs are trimmed and cut to 20 characters (`MAX_NAME_LENGTH = 20`).
- Server reads `PORT` from the environment, default 3000.
- No em-dashes in any prose: README, docs, code comments, commit messages, UI text.
- Site title: "Multiplayer Tabletop Games".
- Every state sent to a browser goes through the game's `toPublicState`.
- Server code (`server/`, `shared/`, `games/<id>/*.ts` outside `client/`) never imports from `src/` or any `games/<id>/client/`.
- Work after the bootstrap commit happens on branch `combine-games` and lands through a PR.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. A crafted `JOIN_GAME` with a missing or unknown `gameType` gets the error "Unknown game" and the socket stays usable. Test in Task 3.
2. The same game ID used in Quoridor and in Azul makes two separate games. Test in Task 3.
3. A `GAME_ACTION` sent to a game with no `applyAction` (Quoridor) gets "This game has no actions" and changes nothing. Test in Task 3.
4. "Back to games" followed by joining the same game ID with the same name from the same tab, in the lobby, gets the freed seat back with no "Disconnected" error. Browser check in Task 6.
5. Visiting Azul, going back, then opening Quoridor (and the reverse) leaves no colors or layout from the previous game, in light and dark mode. Browser check in Task 8.

---

## File Structure

```
.github/workflows/ci.yml        copied unchanged from azul
.gitignore                      azul's plus `.superpowers/`
.dockerignore .nvmrc Dockerfile docker-compose.yml eslint.config.js vite.config.ts
run.sh run.ps1 run.conf compose-launcher/ (submodule) .gitmodules
package.json tsconfig.json tsconfig.app.json tsconfig.node.json index.html public/favicon.svg
README.md docs/architecture.md

shared/
  types.ts            Seat, Result, Random, UndoVote, BaseGameState, BasePublicState
  messages.ts         MESSAGE_TYPES, ClientMessage, ServerMessage, asRecord
  gameDefinition.ts   GameInfo, GameDefinition
  seating.ts          nextActivePlayer, addPlayer, removePlayer, applyMove (platform guards)
  seating.test.ts
  testGame.ts         a tiny fake GameDefinition used only by platform tests
server/
  games.ts            createGameManager (rooms, undo history, votes)
  games.test.ts
  server.ts           Express + ws wiring
games/
  registry.ts         GAMES list, findGame
  quoridor/  index.ts rules.ts types.ts rules.test.ts manager.test.ts
             client/  index.ts faq.ts quoridor.css GameScreen.tsx GameStatus.tsx Board.tsx ...
  azul/      index.ts rules.ts types.ts rules.test.ts manager.test.ts
             client/  index.ts faq.ts azul.css GameScreen.tsx GameStatus.tsx Factories.tsx ...
src/
  main.tsx App.tsx index.css App.css clientGames.ts
  components/  GameList.tsx JoinDialog.tsx FaqButton.tsx FaqDialog.tsx GameView.tsx ThemeToggle.tsx UndoVote.tsx
  hooks/useGameConnection.ts
  services/gameService.ts
```

---

### Task 1: Bootstrap the repo

**Files:**
- Create: everything in the tooling block of the File Structure above, copied from `azul:` unless noted.
- Keep: `docs/superpowers/specs/...` and this plan.

**Interfaces:**
- Produces: a buildable empty skeleton on `master` on GitHub, and branch `combine-games` checked out locally.

- [ ] **Step 1:** `git init -b master` in `C:\Users\Natha\Documents\code\multiplayer-tabletop-games`. Copy from azul: `.github/workflows/ci.yml`, `.dockerignore`, `.gitattributes`, `.nvmrc`, `.gitignore`, `docker-compose.yml`, `eslint.config.js`, `vite.config.ts`, `run.sh`, `run.ps1`, `tsconfig.json`, `public/favicon.svg`. Append `.superpowers/` to `.gitignore`. Run `git submodule add https://github.com/Nate314/compose-launcher.git compose-launcher`.
- [ ] **Step 2:** Copy `azul:package.json`; set `"name": "multiplayer-tabletop-games"`. Copy `package-lock.json` and run `npm install` to rename it in the lock.
- [ ] **Step 3:** `tsconfig.app.json`: `"include": ["src", "shared", "games"]`, `"exclude": ["**/*.test.ts"]`. `tsconfig.node.json`: `"include": ["server", "shared", "games", "vite.config.ts"]`, `"exclude": ["games/*/client"]`.
- [ ] **Step 4:** `Dockerfile`: copy azul's, add `COPY games ./games` after `COPY shared ./shared`. `run.conf`: first line `# compose-launcher config for multiplayer-tabletop-games (https://github.com/Nate314/multiplayer-tabletop-games)`, `port APP_PORT 3000`, `url Multiplayer Tabletop Games: http://localhost:{APP_PORT}`.
- [ ] **Step 5:** `index.html`: azul's, with `<title>Multiplayer Tabletop Games</title>`. Add a placeholder `src/main.tsx` rendering `<h1>Multiplayer Tabletop Games</h1>` so `npm run build` passes.
- [ ] **Step 6: Verify:** `npm run lint && npm run build` exit 0. (`npm test` finds no tests yet; that is fine.)
- [ ] **Step 7: Commit and publish.** Commit as "chore: bootstrap repo with tooling, design and plan". Run `gh repo create Nate314/multiplayer-tabletop-games --private --source . --push`. Then `git switch -c combine-games`.

---

### Task 2: Platform core types and seating

**Files:**
- Create: `shared/types.ts`, `shared/messages.ts`, `shared/gameDefinition.ts`, `shared/seating.ts`, `shared/testGame.ts`
- Test: `shared/seating.test.ts`

**Interfaces:**
- Produces (exact):

```ts
// shared/types.ts
export type Seat = number; // 1-based, seated in join order
export type Result<T> = { state: T } | { error: string };
export type Random = () => number;
export type UndoVote = { requestedBy: Seat; votes: Record<Seat, boolean> };
export type BaseGameState = {
  gameId: string;
  started: boolean;            // true after the first move; locks joining
  currentPlayer: Seat | null;
  activePlayers: Seat[];       // always sorted ascending
  playerNames: Record<Seat, string>;
  gameStatus: string;
  isGameOver: boolean;
  winners: Seat[];             // Quoridor's old `winner` becomes a one-element list
  undoVote: UndoVote | null;
};
export type BasePublicState = BaseGameState & { undoAvailable: boolean };

// shared/gameDefinition.ts
export type GameInfo = {
  id: string;            // lowercase, used in messages and as data-game
  name: string;
  description: string;   // one line for the landing page
  minPlayers: number;
  maxPlayers: number;
};
export type GameDefinition<S extends BaseGameState = BaseGameState, P extends BasePublicState = BasePublicState> = {
  info: GameInfo;
  createGameState(gameId: string): S;
  // Before the first move, after anyone joins or leaves. currentPlayer is already activePlayers[0].
  resetLobby(state: S, random: Random): S;
  // Mid-game, after the platform has removed `seat` and moved the turn on; only while 2+ remain and the game is not over.
  onPlayerLeft?(state: S, seat: Seat, random: Random): S;
  // Called only after the platform's turn guards pass. Validates untrusted `move`.
  applyMove(state: S, seat: Seat, move: unknown): Result<S>;
  // Not turn-bound and not recorded for undo. Validates untrusted `action`.
  applyAction?(state: S, seat: Seat, action: unknown, random: Random): Result<S>;
  toPublicState(state: S, undoAvailable: boolean): P;
};

// shared/seating.ts
export function nextActivePlayer(state: Pick<BaseGameState, 'activePlayers'>, fromSeat: Seat): Seat | null;
export function addPlayer<S extends BaseGameState>(game: GameDefinition<S, BasePublicState>, state: S, name: string, random?: Random): { state: S; seat: Seat } | { error: string };
export function removePlayer<S extends BaseGameState>(game: GameDefinition<S, BasePublicState>, state: S, seat: Seat, random?: Random): S;
export function applyMove<S extends BaseGameState>(game: GameDefinition<S, BasePublicState>, state: S, seat: Seat, move: unknown): Result<S>;
export function baseGameState(gameId: string): BaseGameState; // all fields at their empty values

// shared/testGame.ts: a fake game for platform tests
// State adds `moves: number`. Move must be { type: 'tick' } else error 'Invalid move'.
// applyMove increments `moves`, sets gameStatus `${name} ticked`, passes the turn; reaching 3 moves ends the game with the mover as winner.
// applyAction { type: 'ping' } sets gameStatus `${name} pinged`; anything else errors 'Unknown action'.
// toPublicState hides `secret: string` (set to 'hidden' by createGameState). min 2, max 4 players. id 'test', name 'Test'.
export const testGame: GameDefinition<TestState, TestPublicState>;
```

- `shared/messages.ts`: azul's `asRecord` unchanged; message types in Task 3.

Behavior copied from both `rules.ts` files, now generic:
- `nextActivePlayer`: the first seat in `activePlayers` greater than `fromSeat`, else `activePlayers[0]`, else `null` (same result as today's modulo-4 loop, with no fixed max).
- `addPlayer`: errors `'Game already in progress'` if started, `'Game is full'` at `info.maxPlayers`. Takes the lowest free seat, sorts `activePlayers`, sets the name, `gameStatus = \`${name} joined (${count}/${maxPlayers} players)\``, `currentPlayer = activePlayers[0]`, then `game.resetLobby`.
- `removePlayer` before start: drop seat and name, `gameStatus = \`${name} left\``, `currentPlayer = activePlayers[0] ?? null`, then `resetLobby`.
- `removePlayer` mid-game: drop from `activePlayers` only (name stays), `gameStatus = \`${name} left the game\``. If already over: clear `undoVote` when fewer than 2 remain, return. If exactly 1 remains: `isGameOver: true`, `currentPlayer: null`, `winners: [last]`, `undoVote: null`, `gameStatus = \`${lastName} wins! Everyone else left.\``. Otherwise advance `currentPlayer` if it was the leaver, then call `onPlayerLeft` if defined.
- `applyMove` guards in order: `'The game is over'`, `'Waiting for more players'` (fewer than `minPlayers`), `'An undo vote is in progress'`, `'Not your turn'`; then `game.applyMove`; on success set `started: true`.

- [ ] **Step 1: Write the failing tests** in `shared/seating.test.ts` using `testGame` and `node:test` + `node:assert/strict`:
  - `nextActivePlayer wraps and skips missing seats`: `[1,3,4]` from 4 is 1, from 1 is 3; `[]` is null.
  - `seats fill the lowest free seat and the lobby resets`: join A, B, C; remove B before start; join D gets seat 2; status `'D joined (3/4 players)'`.
  - `join is refused when full or started`: fifth join is `{ error: 'Game is full' }`; after one move, join is `{ error: 'Game already in progress' }`.
  - `move guards`: one player gives `'Waiting for more players'`; wrong seat `'Not your turn'`; with `undoVote` set `'An undo vote is in progress'`; after game over `'The game is over'`; a valid move sets `started` to true.
  - `leaving mid-game passes the turn and keeps the name`: 3 players, seat 1 to move, seat 1 leaves, `currentPlayer` is 2, `playerNames[1]` still present, status `'A left the game'`.
  - `the last player left wins`: 2 players after a move, seat 2 leaves, `winners` is `[1]`, `currentPlayer` null, status `'A wins! Everyone else left.'`.
- [ ] **Step 2:** Run `node --test shared/` and confirm the tests fail because the modules do not exist.
- [ ] **Step 3:** Implement the four files above.
- [ ] **Step 4:** Run `node --test shared/` (all pass), then `npm run typecheck && npm run lint`.
- [ ] **Step 5:** Commit "feat: platform seating and game definition contract".

---

### Task 3: Generic game manager, protocol and server

**Files:**
- Modify: `shared/messages.ts`
- Create: `server/games.ts`, `server/server.ts`, `games/registry.ts` (empty `GAMES` for now)
- Test: `server/games.test.ts`

**Interfaces:**
- Consumes: Task 2 exports.
- Produces:

```ts
// shared/messages.ts
export const MESSAGE_TYPES = { JOIN_GAME, GAME_JOINED, MAKE_MOVE, GAME_ACTION, REQUEST_UNDO, VOTE_UNDO, GAME_STATE, GAME_ERROR } as const; // string values equal the keys
export type ClientMessage =
  | { type: 'JOIN_GAME'; gameType: string; gameId: string; playerName: string }
  | { type: 'MAKE_MOVE'; payload: { move: unknown } }
  | { type: 'GAME_ACTION'; payload: { action: unknown } }
  | { type: 'REQUEST_UNDO' }
  | { type: 'VOTE_UNDO'; payload: { approve: boolean } };
export type ServerMessage =
  | { type: 'GAME_JOINED'; payload: { playerNumber: Seat; gameState: BasePublicState } }
  | { type: 'GAME_STATE'; payload: BasePublicState }
  | { type: 'GAME_ERROR'; payload: { message: string } };

// games/registry.ts
export const GAMES: GameDefinition<any, any>[];   // landing page order; the one place `any` is allowed (eslint-disable-next-line with a comment)
export function findGame(id: unknown): GameDefinition<any, any> | undefined;

// server/games.ts
export type JoinResult = { roomId: string; seat: Seat; state: BasePublicState } | { error: string };
export function createGameManager(games: readonly GameDefinition<any, any>[], random?: Random): {
  join(gameType: unknown, gameId: unknown, playerName: unknown): JoinResult;
  leave(roomId: string, seat: Seat): { state: BasePublicState } | null;
  move(roomId: string, seat: Seat, move: unknown): Result<BasePublicState>;
  action(roomId: string, seat: Seat, action: unknown): Result<BasePublicState>;
  requestUndo(roomId: string, seat: Seat): Result<BasePublicState>;
  voteUndo(roomId: string, seat: Seat, approve: unknown): Result<BasePublicState>;
  getState(roomId: string): BasePublicState | undefined;
};
```

- Port `azul:server/games.ts` into the generic manager. A room is `{ game: GameDefinition; state; history: state[] }` keyed by `roomId = \`${gameType}/${gameId}\``. `join` validates the game type first (`'Unknown game'`), then trims and caps ID and name exactly as today. Undo request, vote and restore logic are unchanged from azul, using `nextActivePlayer` from `shared/seating.ts`. `action` returns `'This game has no actions'` when `applyAction` is missing and is never pushed to `history`. `view` is `game.toPublicState(state, history.length > 0)`.
- Port `azul:server/server.ts`: connections hold `{ roomId, seat }`; `JOIN_GAME` passes `message.gameType`; add a `GAME_ACTION` case calling `manager.action(roomId, seat, payload?.action)`; drop `ACKNOWLEDGE_ROUND`. The manager is created with `GAMES`.

- [ ] **Step 1: Write the failing tests** in `server/games.test.ts` using `createGameManager([testGame], seededRandom)`. Port every platform test from `azul:server/games.test.ts` and `quoridor:server/games.test.ts` (join trimming and blanks, 20-character caps, full and started refusals, lobby leave and last-one-out deletion, undo approve, decline, validation, leaving during a vote, repeated undos staying locked, undo returning the turn to a departed player, undo after a win canceled when the winner or requester leaves), rewritten against `testGame` moves. Add:
  - `an unknown or missing game type is refused`: `join('chess', 'g', 'A')` and `join(undefined, 'g', 'A')` both give `{ error: 'Unknown game' }`.
  - `the same game ID in two game types is two rooms`: register `testGame` and a copy with `info.id: 'test2'`; join both with ID `'friday'`; both seats are 1 and `roomId`s differ.
  - `actions are not recorded for undo`: two players, one move, one `ping` action; `requestUndo` then approve restores the state before the move.
  - `a game without actions refuses them`: definition copy without `applyAction` gives `'This game has no actions'`.
  - `browsers never receive hidden fields`: no `secret` key in any returned state.
- [ ] **Step 2:** Run `node --test server/` and confirm failures.
- [ ] **Step 3:** Implement `shared/messages.ts`, `server/games.ts`, `games/registry.ts`, `server/server.ts`.
- [ ] **Step 4:** `node --test` all pass; `npm run typecheck && npm run lint` pass.
- [ ] **Step 5:** Commit "feat: generic game manager and WebSocket protocol".

---

### Task 4: Quoridor rules as a game definition

**Files:**
- Create: `games/quoridor/types.ts`, `games/quoridor/rules.ts`, `games/quoridor/index.ts`
- Test: `games/quoridor/rules.test.ts`, `games/quoridor/manager.test.ts`
- Modify: `games/registry.ts` (add `quoridor`)

**Interfaces:**
- Consumes: `BaseGameState`, `GameDefinition`, `nextActivePlayer`, `Result`, `asRecord`.
- Produces: `export const quoridor: GameDefinition<GameState, PublicGameState>` from `games/quoridor/index.ts`, with `info = { id: 'quoridor', name: 'Quoridor', description: 'Race your pawn to the far side and block opponents with walls', minPlayers: 2, maxPlayers: 4 }`. `games/quoridor/types.ts` keeps today's exports, with `GameState = BaseGameState & { pawns; wallCounts; walls; lastMove }` and `PublicGameState = GameState & { undoAvailable: boolean }`.

- Copy `quoridor:shared/rules.ts` and `types.ts`. Remove `addPlayer`, `removePlayer`, the local `nextActivePlayer`, `MAX_PLAYERS`, and from `applyMove` the four guards and `next.started = true`. `withLobbyDefaults` becomes `resetLobby(state)`: pawns for every active seat at `SEATS[seat].start`, wall counts from `wallsPerPlayer`. Replace `winner: Seat | null` with `winners`. `toPublicState` is `(state, undoAvailable) => ({ ...state, undoAvailable })`. No `onPlayerLeft`, no `applyAction`.

- [ ] **Step 1: Write the failing tests.** Copy `quoridor:shared/rules.test.ts` into `games/quoridor/rules.test.ts`. Tests that called `addPlayer`/`removePlayer`/`applyMove` now call the `shared/seating.ts` versions with `quoridor` as the first argument; assertions on `winner` become `winners` (`[seat]` or `[]`). Copy the Quoridor-specific tests from `quoridor:server/games.test.ts` (`the winning move can be undone`, `moves are validated and recorded for undo`) into `games/quoridor/manager.test.ts` using `createGameManager([quoridor])` and `'quoridor'` as game type. Keep every assertion value.
- [ ] **Step 2:** `node --test games/quoridor/` fails.
- [ ] **Step 3:** Implement the three files and register `quoridor` first in `GAMES`.
- [ ] **Step 4:** `node --test` all pass; `npm run typecheck && npm run lint` pass.
- [ ] **Step 5:** Commit "feat: port Quoridor rules to the game definition".

---

### Task 5: Azul rules as a game definition

**Files:**
- Create: `games/azul/types.ts`, `games/azul/rules.ts`, `games/azul/index.ts`
- Test: `games/azul/rules.test.ts`, `games/azul/manager.test.ts`
- Modify: `games/registry.ts` (add `azul` second)

**Interfaces:**
- Produces: `export const azul: GameDefinition<GameState, PublicGameState>` with `info = { id: 'azul', name: 'Azul', description: 'Draft colored tiles and decorate your palace wall', minPlayers: 2, maxPlayers: 4 }`. Action shape: `{ type: 'acknowledgeRound' }`.

- Copy `azul:shared/rules.ts` and `types.ts`. Remove `addPlayer`, `removePlayer`, local `nextActivePlayer`, `MAX_PLAYERS`, and the four guards and `started: true` in `applyMove`. `withLobbyDefaults` becomes `resetLobby(state, random)` (keeps the deal, `roundStarter` from `currentPlayer`). `onPlayerLeft(state, seat, random)` is `startNextRoundIfReady(state, random)`. `applyAction(state, seat, action, random)`: `asRecord(action)?.type === 'acknowledgeRound'` calls `acknowledgeRound`, else `{ error: 'Unknown action' }`. `toPublicState` is unchanged. `GameState` becomes `BaseGameState & { ...azul fields, bag, lid, roundStarter, markerHolder }`.

- [ ] **Step 1: Write the failing tests.** Copy `azul:shared/rules.test.ts`, switching seating calls to `shared/seating.ts` with `azul` as the first argument. Copy the Azul-specific manager tests (`what browsers receive never includes the bag or the lid`, `moves are validated`, `the next round waits for every player to acknowledge the summary`, `undoing the move that ended a round brings the round back`, `leaving mid-game hands the win to the last player`) into `games/azul/manager.test.ts`, sending acknowledgements through `manager.action(roomId, seat, { type: 'acknowledgeRound' })`. Add `an unknown action is refused` expecting `'Unknown action'`.
- [ ] **Step 2:** `node --test games/azul/` fails.
- [ ] **Step 3:** Implement and register.
- [ ] **Step 4:** `node --test` all pass; typecheck and lint pass.
- [ ] **Step 5:** Commit "feat: port Azul rules to the game definition".

---

### Task 6: Platform client with the Quoridor screen

**Files:**
- Create: `src/App.tsx`, `src/App.css`, `src/index.css`, `src/clientGames.ts`, `src/services/gameService.ts`, `src/hooks/useGameConnection.ts`, `src/components/{GameList,JoinDialog,FaqButton,FaqDialog,GameView,ThemeToggle,UndoVote}.tsx`
- Create: `games/quoridor/client/` with every Quoridor component except `Faq.tsx`, `Game.tsx`, `JoinForm.tsx`, `ThemeToggle.tsx`, `UndoVote.tsx`; plus `faq.ts`, `index.ts`, `quoridor.css`
- Modify: `src/main.tsx` (azul's)

**Interfaces:**
- Consumes: `GAMES`, `findGame`, message types, game types.
- Produces:

```ts
// src/clientGames.ts
export type FaqItem = { question: string; answer: string };
export type GameScreenProps<P extends BasePublicState> = { gameState: P; playerNumber: Seat; error: string | null };
export type ClientGame = {
  id: string;                                      // matches GameInfo.id
  Screen: ComponentType<GameScreenProps<any>>;     // the registry boundary
  faq: FaqItem[];
  icon: string;                                    // a short glyph or emoji shown in the landing row
};
export const CLIENT_GAMES: Record<string, ClientGame>;

// src/services/gameService.ts: azul's, with
connect(gameType: string, gameId: string, playerName: string): void;
makeMove(move: unknown): void;
sendAction(action: unknown): void;   // replaces acknowledgeRound
requestUndo(): void; voteUndo(approve: boolean): void; disconnect(): void;

// src/hooks/useGameConnection.ts: azul's, returning
{ playerNumber, gameState, error, join(gameType, gameId, playerName), leave() }
// leave(): gameService.disconnect(), then clear playerNumber, gameState and error (no "Disconnected" message)
```

- `App.tsx` holds the selected game type and the join form fields. No game joined: `<GameList>` (one button-like row per `GAMES` entry: `CLIENT_GAMES[id].icon`, name, description, `${min} to ${max} players`) and, when a row is chosen, `<JoinDialog>` (title `Join ${name}`, name and game ID inputs with `maxLength={20}`, the error inline, Cancel, Join, and a `FaqButton`; Escape closes it; the dialog stays open on server errors). Joined: `<GameView>`.
- When the server connection drops mid-game, the hook's existing `onDisconnect` clears the game and sets `'Disconnected from server'`; `App` shows that error above the game list while no dialog is open.
- `GameView` renders `<div className="game-root" data-game={id}>` with a header (Back to games, `<h1>` game name, `FaqButton`, `ThemeToggle`) and `<Screen>`.
- `FaqButton` is azul's "FAQ" text button; `FaqDialog` is azul's `Faq.tsx` markup taking `title` and `items`, always rendered inside `<div data-game={id}>` so the game's theme applies on the landing page too.
- Styling scope: each game's CSS defines its variables on `[data-game="<id>"]` and dark variants on `:root[data-theme="dark"] [data-game="<id>"]`; every other selector is nested under `[data-game="<id>"]`; page background and layout rules from `body`/`.app` move to `.game-root[data-game="<id>"]` (min-height 100vh). `src/App.css` holds the neutral landing theme, light and dark, with classes prefixed `lobby-`. `src/index.css` is azul's.
- Quoridor client: `faq.ts` exports today's `FAQS` array unchanged. Its CSS restyles the azul FAQ markup classes with the wood palette, replacing the old `.faq-overlay`/`.faq-panel` rules. Components import platform pieces from `src/` and rules from `games/quoridor/rules.ts`.

- [ ] **Step 1:** Implement the platform client and the Quoridor client; register `quoridor` in `CLIENT_GAMES`.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test` pass.
- [ ] **Step 3: Browser check** (`npm start`, Chrome tool, two windows): landing list at 1280px and 390px wide, no horizontal scroll; open the Quoridor dialog, FAQ opens from it with the wood theme; Escape closes; blank name shows "Please enter your name"; join two players, move a pawn, place a wall, request and approve an undo, leave with Back to games; Review Focus 4 (rejoin same ID and name gets seat 1 back, no "Disconnected" text); theme toggle in landing and game.
- [ ] **Step 4:** Commit "feat: landing page, join dialog and Quoridor screen".

---

### Task 7: Azul screen

**Files:**
- Create: `games/azul/client/` with every Azul component except the platform ones listed in Task 6, plus `faq.ts`, `index.ts`, `azul.css`
- Modify: `src/clientGames.ts`

- Azul's `GameScreen` calls `gameService.sendAction({ type: 'acknowledgeRound' })` where it called `acknowledgeRound()`. `faq.ts` exports today's `QUESTIONS` array unchanged. `selection.ts` moves to `games/azul/client/selection.ts`. CSS scoped as in Task 6.

- [ ] **Step 1:** Port, scope the CSS, register `azul` in `CLIENT_GAMES`.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test` pass.
- [ ] **Step 3: Browser check** (two windows): join Azul, take tiles from a factory and the center, finish a round, both players press Continue on the round summary, request and decline an undo, FAQ from dialog and game, Back to games. Repeat at 390px wide.
- [ ] **Step 4:** Commit "feat: Azul screen".

---

### Task 8: Docs, Docker and end-to-end check

**Files:**
- Create: `README.md`, `docs/architecture.md`

- `README.md`: merge both READMEs: site intro, setup with nvm, `npm start`, Docker and launcher sections (paths and names updated), development commands, network play, then a "Games" section with each game's rules and controls copied from its README (Quoridor's "?" line now says "FAQ"), and an "Adding a game" section listing: create `games/<id>/` with `rules.ts`, `types.ts`, `index.ts` exporting a `GameDefinition`, tests, and `client/` with `index.ts` exporting a `ClientGame`, `faq.ts` and a CSS file scoped under `[data-game="<id>"]`; add one line to `games/registry.ts` and one to `src/clientGames.ts`.
- `docs/architecture.md`: azul's mermaid diagram updated with the registry, then the platform/game split from the spec.

- [ ] **Step 1:** Write both docs. Search them and all UI text for the em-dash character and remove any.
- [ ] **Step 2:** `docker compose up --build -d`, open `http://localhost:3000`, join one game of each type, then `docker compose down`. Also run `./run.sh` and `./run.sh down` from Git Bash.
- [ ] **Step 3: Browser check, Review Focus 5:** Azul, Back, Quoridor, Back, Azul in light mode, then again in dark mode; screenshot each screen and confirm no leftover colors or layout. Check 1280px and 390px.
- [ ] **Step 4:** Commit "docs: README and architecture for the combined site".
- [ ] **Step 5:** Push `combine-games`, open the PR with `gh pr create`, confirm CI passes.

---

### Task 9: Retire the old repos (after the PR merges, with the owner's go-ahead)

- [ ] **Step 1:** Ask the owner to confirm before touching `Nate314/quoridor` or `Nate314/azul`.
- [ ] **Step 2:** In each, on a branch, add at the top of `README.md`: `> **Deprecated:** this game now lives in [Nate314/multiplayer-tabletop-games](https://github.com/Nate314/multiplayer-tabletop-games).` Open a PR; after merge run `gh repo archive Nate314/<repo> --yes`.
- [ ] **Step 3:** Here, `git switch master && git pull`.
