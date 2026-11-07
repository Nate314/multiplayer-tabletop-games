# Whodunit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Whodunit, an original deduction board game (a seaside hotel, 6 suspects, 6 objects, 9 rooms) for 3 to 6 players in Classic board games, where leaving only holds the seat and only a dismissal turns a player's cards face up.

**Architecture:** A new folder `games/whodunit/` on the `GameDefinition` contract. Pure data and geometry live apart from the rules: `content.ts` (cards), `board.ts` (the grid, doors, passages, starts) and `movement.ts` (where a roll can take a token). `rules.ts` holds the turn, suggestion, showing and accusation flow; `toPublicState` shows each seat only its own hand, notes and the cards it saw or showed, and `secretState` names the solution until the game ends. Leaving uses the platform as it is: a disconnect or Back to games holds the seat with no game hook, and `onPlayerLeft` (reached only by a dismissal) turns the leaver's cards face up.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Goals", "Rules for every agent", "Whodunit" and "Left to the builders".

**Branch:** `game-whodunit` in its own worktree `C:/Users/Natha/Documents/code/mtg-wt/game-whodunit`, from `party-games-and-polish`. Site `PORT=3405`, e2e `E2E_PORT_BASE=8500` (never 6000). PR into `party-games-and-polish`.

## Global Constraints

- Id `whodunit`, name `Whodunit`, category `'classic'` (Classic board games), `minPlayers: 3`, `maxPlayers: 6`.
- "An original setting (my call: a seaside hotel) with 6 suspects, 6 objects and 9 rooms, each with an original name and drawn art. One of each is the hidden solution; the rest are dealt out."
- No name, character, art, card text or board layout copied from the commercial game. None of these words is a card name: Scarlet, Mustard, White, Green, Peacock, Plum, Candlestick, Dagger, Knife, Lead Pipe, Revolver, Rope, Wrench, Spanner, Kitchen, Ballroom, Conservatory, Dining Room, Billiard Room, Library, Lounge, Hall, Study. The commercial game's name appears in no file of the game except the one Wikipedia link in the README.
- Rules from [Wikipedia's Cluedo article](https://en.wikipedia.org/wiki/Cluedo), rules only. Every difference goes in `games/whodunit/README.md` under "Differences from Wikipedia", in the format of `games/rook/README.md`. Where the spec disagrees with Wikipedia, the spec wins.
- "Suggestion results go only to the two players concerned. The solution is in `secretState` until the game ends." `viewer: null` (History), game files, spectators and the table screen see neither a hand nor a shown card until the game reveals it.
- Leaving: "going Back to games, closing the tab or losing the connection mid-game only holds the seat, as the platform already does, so nothing is revealed and the player rejoins with their cards." "Only a player who is actually removed from the game by a dismiss vote has their cards turned face up for everyone."
- Every turn move is undoable by vote, except that an undo never reveals a secret it did not hide (see Task 5). Notes are game actions, not recorded.
- Files outside `games/whodunit/`: one line each in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, `shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`; and `e2e/whodunit.spec.ts`. Not the root README game list or count, not `e2e/landing.spec.ts`, not `docs/architecture.md`, not `e2e/fixtures.ts`. A needed platform or fixture change not listed here: stop and report it.
- New e2e specs reach header controls (History, Share, Rules, Hide, Pause, Settings, Theme) only through `headerButton(page, name)` from `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in code comments, README, FAQ or commit messages.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

## Coordinator decisions to confirm (reported, not silently resolved)

- **End of play.** The spec says both "If everyone is out, nobody wins" and "Play goes on while two or more players can still accuse". Wikipedia: "If all but one player accuse wrongly, the remaining player wins by default." This plan builds one rule for accusations and dismissals alike: the game ends when fewer than two seated players can still accuse; the one left, if any, wins; with none left nobody wins and the solution is shown. "Everyone out" is then reachable only through a dismissal. It lives in one function, `settleEnd`, so the other reading is a one-line change.
- **Notes and undo.** An approved undo restores the whole saved state, so notes taken after the undone move are lost. Keeping them needs a platform change (`onUndo` sees only the restored state), which this chunk may not make. The README states it.

## Review Focus

1. The player who must show a card goes Back to games or loses the connection: the game waits for them with nothing revealed, and on rejoin they get the same show prompt (Task 5 rules test, Task 8 e2e).
2. A spectator, the table screen, History (`viewer: null`), a downloaded game file or `lastMove` shows which card was shown, or another seat's hand: the views test reads every view and every history step (Task 6).
3. An undo after a card was shown, or after a wrong accusation, lets the suggester see a second card or accuse again: `allowsUndoVote` is false right after a sealed step (Task 5).
4. A dismissal while that player must show a card, or while it is their turn mid-suggestion, or of the next player in turn order: the suggestion moves on clockwise past them, the turn goes to the next player who can still accuse, and play ends by `settleEnd` (Task 5).
5. A roll that cannot be used: every corridor path is blocked by tokens or dead ends and no door is in reach, or every door of the player's room is blocked: the player may press Stay put and the turn goes on to its suggestion or end (Tasks 3 and 4).

---

### Task 1: Worktree, branch and port

**Files:** none in the repo.

- [ ] **Step 1: Create the worktree** from the pushed `party-games-and-polish`:
  ```bash
  cd C:/Users/Natha/Documents/code/multiplayer-tabletop-games
  git fetch origin
  git worktree add -b game-whodunit C:/Users/Natha/Documents/code/mtg-wt/game-whodunit origin/party-games-and-polish
  ```
  Expected: `Preparing worktree (new branch 'game-whodunit')`. All later paths are relative to the worktree.
- [ ] **Step 2: Install.** If `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH (memory note). Run `npm ci`. Expected: exit 0.
- [ ] **Step 3: Check the ports are free:** `netstat -ano | grep -E ':(3405|850[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3405 or 8500, and say so in the PR.
- [ ] **Step 4: Baseline:** `npm test && npm run typecheck && npm run lint`. Expected: PASS (note any failure that already exists, so it is not blamed on this chunk).

### Task 2: Content, info, types and board data

**Files:**
- Create: `games/whodunit/info.ts`, `games/whodunit/types.ts`, `games/whodunit/content.ts`, `games/whodunit/board.ts`
- Test: `games/whodunit/content.test.ts`, `games/whodunit/board.test.ts`

**Interfaces:**
- Produces (`content.ts`):
  - `SUSPECTS`, `OBJECTS`, `ROOMS`: `readonly { id: string; name: string }[]` of lengths 6, 6, 9. Ids are lowercase slugs, unique across all three lists. Each suspect also has `color: string` (a CSS variable name such as `--wd-suspect-1`) for its token.
  - `type SuspectId`, `type ObjectId`, `type RoomId` (string unions from the lists, `as const`), `type CardId = SuspectId | ObjectId | RoomId`.
  - `CARDS: readonly CardId[]` (all 21), `kindOf(card: CardId): 'suspect' | 'object' | 'room'`, `nameOf(card: CardId): string`.
- Produces (`info.ts`): `whodunitInfo: GameInfo` with `id: 'whodunit'`, `name: 'Whodunit'`, `category: 'classic'`, description `Move through a seaside hotel, make suggestions and be first to name who, with what and where`, `minPlayers: 3`, `maxPlayers: 6`, `passAndPlay: false` (hands are secret). No house rules.
- Produces (`board.ts`):
  - `ROWS`, `COLS` (the builder's size, at most 25 by 25), `type Cell = { row: number; col: number }`, `type Position = { room: RoomId } | Cell`.
  - `isCorridor(cell: Cell): boolean`, `roomAt(cell: Cell): RoomId | null` (for drawing).
  - `DOORS: readonly { room: RoomId; outside: Cell }[]`: `outside` is the corridor cell in front of the door.
  - `PASSAGES: Readonly<Partial<Record<RoomId, RoomId>>>`: exactly two pairs, each joining diagonally opposite corner rooms, both directions listed.
  - `STARTS: Readonly<Record<SuspectId, Cell>>`: one corridor cell on the board edge per suspect.
  - `ROOM_CELLS: Readonly<Record<RoomId, Cell[]>>`, so the client places tokens inside a room.
- Produces (`types.ts`):
  ```ts
  type Solution = { suspect: SuspectId; object: ObjectId; room: RoomId };
  type Mark = 'yes' | 'no' | 'maybe';
  type Suggestion = Solution & { by: Seat; passed: Seat[]; shownBy: Seat | null; awaiting: Seat | null }; // awaiting: who must show now
  type Seen = { suggestion: number; from: Seat; to: Seat; card: CardId };          // index into suggestions
  type Accusation = Solution & { by: Seat; correct: boolean };
  type Phase = 'start' | 'move' | 'room' | 'showing' | 'end';
  type Move =
    | { type: 'roll' } | { type: 'passage' } | { type: 'stay' }
    | { type: 'moveTo'; to: Position } | { type: 'stayPut' }
    | { type: 'suggest'; suspect: SuspectId; object: ObjectId }
    | { type: 'show'; card: CardId }
    | { type: 'accuse'; suspect: SuspectId; object: ObjectId; room: RoomId }
    | { type: 'endTurn' };
  type Action = { type: 'note'; card: CardId; mark: Mark | null };
  type LastMove = { type: Move['type']; playerNumber: Seat; dice?: [number, number]; to?: Position; sealed?: true }; // sealed: the step showed a card or judged an accusation
  type GameState = BaseGameState & {
    solution: Solution | null;                          // null only before the deal
    hands: Record<Seat, CardId[]>;
    faceUp: Record<Seat, CardId[]>;                     // dismissed players' cards, public
    suspectOf: Record<Seat, SuspectId>;                 // seat n plays SUSPECTS[n - 1]
    positions: Record<SuspectId, Position>;
    objectRooms: Record<ObjectId, RoomId>;
    phase: Phase;
    dice: [number, number] | null;
    destinations: Position[];                           // phase 'move' only
    leftRoom: RoomId | null;                            // the room the mover left this turn
    movedIn: SuspectId[];                               // moved into a room by a suggestion since their last turn
    suggestions: Suggestion[];
    seen: Seen[];
    accusations: Accusation[];
    out: Seat[];                                        // accused wrongly
    notes: Record<Seat, Partial<Record<CardId, Mark>>>;
    lastMove: LastMove | null;
  };
  type PublicGameState = Omit<GameState, 'solution' | 'hands' | 'seen' | 'notes'> & BasePublicState & {
    solution: Solution | null;                          // null until the game is over
    hand: CardId[];                                     // the viewer's own; [] for null
    handSizes: Record<Seat, number>;
    seen: Seen[];                                       // only entries whose from or to is the viewer
    notes: Partial<Record<CardId, Mark>>;               // the viewer's own; {} for null
  };
  ```

Decisions:
- Board layout is the builder's (spec "Left to the builders"): 9 rooms in a rough 3 by 3 arrangement with the four corner rooms holding the passages, corridors between them, each room with one to four doors. Encode it as an array of strings (one character per cell: `.` corridor, `#` blocked, a letter per room) plus the `DOORS` list, so the client and tests read the same data.

- [ ] **Step 1: Write the failing tests.**
  `content.test.ts`:
  - `'six suspects, six objects and nine rooms with unique ids'`: lengths, `new Set(CARDS).size === 21`, every `kindOf` right.
  - `'no card uses a name from the commercial game'`: no `nameOf(card)` matches, case-insensitively as a whole word, any word in the Global Constraints list.
  - `'no file of the game names the commercial game'`: walk `games/whodunit/` and `e2e/whodunit.spec.ts` with `fs`, assert none matches `new RegExp(['clu', 'edo'].join(''), 'i')` or `new RegExp('\\b' + ['clu', 'e'].join('') + '\\b', 'i')` (so the US name, and the plain word, are avoided everywhere), except the one Wikipedia link line in `README.md` (skip lines containing `en.wikipedia.org/wiki/`).
  `board.test.ts`:
  - `'every door opens from its room onto a corridor cell'`: for each door `isCorridor(outside)` and `outside` is orthogonally next to a cell of `ROOM_CELLS[room]`.
  - `'every room has a door and every start is an edge corridor cell'`.
  - `'two passage pairs join diagonally opposite corner rooms'`: `Object.keys(PASSAGES).length === 4`, `PASSAGES[PASSAGES[r]!] === r` for each.
  - `'every room is reachable from every start'`: a BFS over corridor cells and doors from each start reaches all 9 rooms.
- [ ] **Step 2: Run** `node --test games/whodunit/*.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the four files.
- [ ] **Step 4: Run** `node --test games/whodunit/*.test.ts`. Expected: PASS (the file walk passes while the README does not exist yet).
- [ ] **Step 5: Commit** `Whodunit: cards, board and types`.

### Task 3: Movement

**Files:**
- Create: `games/whodunit/movement.ts`
- Test: `games/whodunit/movement.test.ts`

**Interfaces:**
- Consumes: `board.ts` (Task 2).
- Produces: `destinations(from: Position, steps: number, occupied: Cell[], leftRoom: RoomId | null): Position[]`, deduplicated, rooms as `{ room }`.

Decisions (Wikipedia is silent on these; each goes in the README):
- A token moves exactly `steps` squares orthogonally through corridor cells, never entering the same cell twice in one move and never entering a cell in `occupied` (other tokens in corridors).
- Stepping from a door's `outside` cell into its room counts one step and ends the move, so a room may be entered with fewer than `steps`. A token may not re-enter `leftRoom` in the same move.
- From a room, the first step goes onto any of its doors' `outside` cells (blocked if occupied).
- Depth-first search over simple paths of length `steps` (at most 12); corridors are narrow, so no memo is needed.

- [ ] **Step 1: Write the failing tests** with cells read from the real board (pick them in the test from `DOORS` and `STARTS`, not hand-typed coordinates):
  - `'a corridor move uses the whole roll'`: from a start with 2, every result is a corridor cell at walking distance exactly 2 with no revisit, or a room whose door is 1 step away.
  - `'a door within the roll lets the token enter early'`: from a door's `outside` with 6, the result contains `{ room }`.
  - `'an occupied cell blocks the path'`: with the only corridor neighbor occupied, from that start with 3, the result is `[]`.
  - `'leaving a room starts at its doors and cannot come straight back in'`: from `{ room: r }` with 1, the results are exactly the free `outside` cells of `r`'s doors; with `leftRoom: r` and steps 2, `{ room: r }` is not in the result.
  - `'all doors blocked leaves no destination'`.
- [ ] **Step 2: Run** `node --test games/whodunit/movement.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `destinations`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `Whodunit: movement`.

### Task 4: Rules: deal, turns, suggestions, showing and accusations

**Files:**
- Create: `games/whodunit/rules.ts`
- Test: `games/whodunit/rules.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3; `shuffle` from `shared/shuffle.ts`; `rollDice` from `shared/dice.ts`; `seeded`, `dealt` from `games/testStates.ts`.
- Produces: `createGameState(gameId)`, `resetLobby(state, random)`, `applyMove(state, seat, move, random)`, `allowsOutOfTurn(state, seat, move): boolean`, `applyAction(state, seat, action)`, `waitingOn(state): Seat[]`, `nextTurn(state, after: Seat): GameState`, `settleEnd(state): GameState`, `canAccuse(state): Seat[]` (`activePlayers` not in `out`), `holderOrder(state, suggester: Seat): Seat[]` (the other seated players clockwise, that is in seat order after the suggester, wrapping).

Decisions:
- `resetLobby` deals: one random suspect, object and room as `solution`; the other 18 shuffled and dealt one at a time from seat 1, so lower seats may hold one more. Tokens on `STARTS`, each object in a different random room. `phase: 'start'`, `currentPlayer` seat 1. It runs after every join, so the deal always fits the seats.
- `start`: `roll` (two dice, sets `dice` and `destinations`, phase `move`), `passage` (only in a room with `PASSAGES`, moves there, phase `room`), `stay` (only when the mover's suspect is in `movedIn` and in a room, phase `room`), or `accuse`.
- `move`: `moveTo` one of `destinations` (a room: phase `room`; a corridor: phase `end`), or `stayPut` only when `destinations` is empty (phase `room` if in a room, else `end`).
- `room`: `suggest` with the current room, or `accuse`, or `endTurn`. A suggestion moves the named suspect's token and the named object into the room and adds that suspect to `movedIn` unless it is the suggester's own.
- Showing: walk `holderOrder`; players with no match go in `passed`. The first holder with exactly one match shows it at once (the suggest step is then `sealed`); with two or more, phase `showing` and `awaiting` is that seat; nobody holds one: `shownBy: null`. Each shown card adds a `Seen`. After the suggestion resolves, phase `end`. A wrong-accused (out) player still shows cards.
- `show` is a move by `awaiting` only, through `allowsOutOfTurn`; a card that is not one of the three in their hand: `Show one of the cards asked about`. The step is `sealed`.
- `end`: `accuse` or `endTurn`.
- `accuse` (once, on your own turn in `start`, `room` or `end`, any room): right: `isGameOver`, `winners: [seat]`, status `<name> solved it: <suspect> with the <object> in the <room>`. Wrong: seat goes to `out`, status `<name> accused wrongly and is out of turns`, then `settleEnd`, then `nextTurn` if not over. Sealed either way.
- `endTurn` and `nextTurn`: the next seat in seat order among `canAccuse`; it starts in `start` with `dice: null` and `leftRoom: null`. The seat whose turn ends has its own suspect removed from `movedIn`, so a Stay is offered only on the first turn after being moved in.
- `settleEnd`: see "Coordinator decisions": `canAccuse` of length 1 wins (status `<name> wins: everyone else is out`), length 0 ends with `winners: []` (status `Nobody solved it`).
- `waitingOn`: `[awaiting]` during `showing`, else `[]`.
- `applyAction` note: a valid card and mark from a seated player, any time before game over; `mark: null` clears. Not recorded.
- Errors: `Roll first`, `Not a square you can reach`, `No secret passage here`, `You can stay only in a room a suggestion moved you into`, `Suggest from inside a room`, `Show one of the cards asked about`, `Wait for the card to be shown`, `Not now`.

- [ ] **Step 1: Write the failing tests** (three or four seats from `dealt`, dice queued with a random that returns `(face - 0.5) / 6`):
  - `'the deal hides one of each kind and deals the rest'`: 3 seats hold 6 each, 4 seats hold 5, 5, 4, 4; the solution's cards are in no hand; hands plus solution are all 21 once.
  - `'a roll offers only reachable squares and a move must pick one'`: after `roll`, `destinations` equals `destinations(...)` from Task 3; a `moveTo` elsewhere is `{ error: 'Not a square you can reach' }`.
  - `'a passage goes to the opposite corner room'`; `'no passage outside a corner room'`.
  - `'a suggestion moves the suspect and object into the room'`.
  - `'the first holder clockwise shows; one match is shown at once'`: seat 3 holds one card, seat 2 none: `passed: [2]`, `shownBy: 3`, a `Seen` from 3 to 1.
  - `'a holder with two matches chooses'`: phase `showing`, `waitingOn` is `[2]`; seat 3 trying `show` is refused as out of turn; seat 2 showing a non-matching card gets `Show one of the cards asked about`.
  - `'nobody can show'`: `shownBy: null`, phase `end`.
  - `'a token moved by a suggestion may stay and suggest there'`: seat 2's suspect named by seat 1; on seat 2's turn `stay` works; on a later turn without being moved it is refused.
  - `'a wrong accusation puts the player out but they still show'`: out, their turns skipped, they still appear as shower.
  - `'a right accusation wins and reveals'`.
  - `'all but one out: the last one wins'`: with three seats, two wrong accusations end the game with `winners: [3]`.
  - `'Stay put only when the roll has nowhere to go'` (Review Focus 5): patch tokens to block every path; `destinations` is `[]`, `stayPut` succeeds, and with a destination present it is refused `Not now`.
  - `'notes are kept per seat'`: an action note by seat 1 sets `notes[1][card]`; `mark: null` clears it.
- [ ] **Step 2: Run** `node --test games/whodunit/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `rules.ts`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `Whodunit: turns, suggestions and accusations`.

### Task 5: Leaving and sealed undo

**Files:**
- Modify: `games/whodunit/rules.ts`
- Test: `games/whodunit/leaving.test.ts`

**Interfaces:**
- Consumes: Task 4; `removePlayer`, `disconnectPlayer` from `shared/seating.ts` (to drive the platform's own paths in tests).
- Produces: `onPlayerLeft(state, seat, random): GameState`, `allowsUndoVote(state): boolean` (`!state.lastMove?.sealed`).

Decisions:
- No `onPlayerDisconnected`: a disconnect, closed tab or Back to games holds the seat and the game waits, including when the held seat is `awaiting` a show.
- `onPlayerLeft` (a dismissal only, per `shared/seating.ts`): move `hands[seat]` to `faceUp[seat]` (status `<name> was dismissed; their cards are face up`); their suspect token stays as a non-player suspect. If they were `awaiting`, continue the suggestion clockwise after them (a holder found shows as usual; none: `shownBy: null`). If the platform moved the turn off them, reset the new current player's turn to `start` (skipping anyone in `out` with `nextTurn`). Then `settleEnd`.
- Face-up cards are never asked for again (the dismissed seat is no longer in `holderOrder`).

- [ ] **Step 1: Write the failing tests:**
  - `'a disconnect reveals nothing and the game waits for the shower'`: seat 2 `awaiting`; `disconnectPlayer(whodunit, state, 2)` leaves `faceUp` `{}`, `hands[2]` unchanged, `awaiting: 2`, `waitingOn` `[2]`.
  - `'a dismissal turns the leaver's cards face up'`: `removePlayer(whodunit, started, 3)` gives `faceUp[3]` equal to the old `hands[3]`, and every viewer's `toPublicState` shows them.
  - `'dismissing the shower passes the suggestion on clockwise'`.
  - `'dismissing the current player starts the next player's turn at start'`, skipping an `out` seat.
  - `'a dismissal that leaves one accuser ends the game with them winning'`, and `'one that leaves none ends with nobody winning and the solution shown'`.
  - `'no undo vote right after a shown card or an accusation'`: `allowsUndoVote` false after a `show`, after an auto-shown `suggest`, after an `accuse`; true after a `roll`, and after a suggestion nobody could answer.
- [ ] **Step 2: Run** `node --test games/whodunit/leaving.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test games/whodunit/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Whodunit: leaving holds the seat, a dismissal shows the cards`.

### Task 6: Views, registration and manager test

**Files:**
- Modify: `games/whodunit/rules.ts` (`toPublicState`)
- Create: `games/whodunit/index.ts`, `games/whodunit/views.test.ts`, `games/whodunit/manager.test.ts`
- Modify (one line each): `games/registry.ts` (import and `whodunit` in `GAMES` between `war` and `yahtzee`), `games/infos.ts` (`whodunitInfo`, same place), `games/secretState.test.ts` (`'whodunit'` in `WITH_SECRET`), `games/privateSeatView.test.ts` (a `whodunit` entry in `CASES`), `games/standings.test.ts` (`'whodunit'` in `FALLBACK_GAMES`), `shared/categories.test.ts` (`'whodunit'` in `classic`, and both counts up by one)

**Interfaces:**
- Consumes: Tasks 4 and 5; `seatFields` from `shared/spectators.ts`; `createGameManager` from `server/games.ts`; `rememberingKeys`, `agreeAll`, `stepsOf`, `fileOf` from `server/testing.ts`.
- Produces (`index.ts`): `whodunit: GameDefinition<GameState, PublicGameState>` with `info`, `createGameState`, `resetLobby`, `onPlayerLeft`, `applyMove`, `allowsOutOfTurn`, `applyAction`, `allowsUndoVote`, `waitingOn`, `toPublicState`, `privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand', 'seen', 'notes'])`, `secretState: state => state.isGameOver ? {} : seatFields(state, ['solution'])`. No `finalStandings` (winner and the rest: the platform fallback).

Decisions:
- `toPublicState(state, undo, viewer)`: drop `hands`; `hand` is `hands[viewer]` or `[]`; `handSizes` from every hand; `seen` filtered to `from === viewer || to === viewer` (none for `null`); `notes` the viewer's; `solution` only when `isGameOver`. `lastMove` and `gameStatus` never name a shown card.
- `CASES.whodunit`: the dealt state with a `Seen` from 2 to 1, seat 1 notes, and a `showing` state with seat 2 `awaiting`.

- [ ] **Step 1: Write the failing tests.**
  `views.test.ts`, with a helper that serializes a view and looks for a card id:
  - `'each seat sees only its own hand'`: every other seat's cards absent from seat 1's view outside `faceUp`; `null` holds no hand card at all.
  - `'a shown card is seen only by the two players concerned'`: views of the other seat and of `null` hold no `Seen`; `gameStatus` and `lastMove` hold no card id.
  - `'the solution shows only after the game ends'`.
  - `'notes are private'`.
  `manager.test.ts` through `rememberingKeys(createGameManager([whodunit], seeded(5)))`:
  - `'a game plays to a right accusation'`: three joins, `agreeAll`, roll, move into a room, suggest, show, end turn, then the current player accuses the patched solution; over with that winner.
  - `'no history step shows a hand or a shown card'`: after a suggestion with a choice and a show, every step in `stepsOf(manager, 'whodunit')` has `hand: []`, `seen: []` and `solution: null`.
  - `'Undo is refused right after a card is shown'`: `requestUndo` returns an error.
  - `'a disconnect and rejoin keeps the hand'`: `manager.disconnect(room, 2)`, then rejoin by name with the remembered key: `getState(room, 2).hand` is unchanged and `faceUp` is `{}`.
- [ ] **Step 2: Run** `node --test games/whodunit/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the views, `index.ts` and the registration lines.
- [ ] **Step 4: Run** the same command and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Whodunit: hidden views and registration`.

### Task 7: Card art and client

**Files:**
- Create: `games/whodunit/svg.ts`; in `games/whodunit/client/`: `GameScreen.tsx`, `Board.tsx`, `Hand.tsx`, `CardPicker.tsx` (suggest and accuse), `ShowPrompt.tsx`, `NotesSheet.tsx`, `SuggestionLog.tsx`, `HistoryBoard.tsx`, `animateMove.ts`, `describeMove.ts`, `faq.ts`, `index.ts`, `whodunit.scss`
- Modify (one line each): `server/assets/registry.ts` (`WHODUNIT_ASSETS`), `src/clientGames.ts` (`whodunit` loader), `shared/svg/gameIcons.ts` (a magnifying glass over a key, drawn with `lineIcon`)
- Test: `games/whodunit/client/describeMove.test.ts`, `games/whodunit/svg.test.ts`

**Interfaces:**
- Consumes: `PublicGameState` (Task 2); `GameScreenProps`, `ClientGame` from `src/clientGames.ts`; `gameService.makeMove`, `gameService.sendAction` (default export of `src/services/gameService.ts`); `ServerSvg` (`src/assets/ServerSvg.tsx`), `svgUrl` (`src/assets/svgCache.ts`), `usePreloadSvgs` (`src/assets/usePreloadSvgs.ts`); `Die` from `src/components/Dice.tsx`.
- Produces: `WHODUNIT_ASSETS: SvgAsset[]` with one asset `whodunit-card`, `params: ['card']`, samples every `CardId`, `render` returning `null` for an unknown id; `whodunitClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `animateMove`.

Decisions:
- Art: an original drawing per card in the house style (`lineIcon`, `currentColor`, CSS variables), themed by `.wd-card-<kind>` in the game's SCSS.
- Board: page markup (clickable), one button per destination with `aria-label` `Move to <room>` or `Move to row <r>, column <c>`; tokens with the suspect's color and initial; object chips inside rooms.
- Controls by phase: Roll, Secret passage, Stay in <room>, Stay put, Suggest (suspect and object pickers, room fixed), Accuse (three pickers and a confirm `Accuse <suspect> with the <object> in the <room>?`), End turn. The shower's `ShowPrompt` lists only their matching cards. Out players see `You are out of turns, but still show cards`.
- `NotesSheet`: every card in three groups, a button per card cycling blank, yes, no, maybe (`aria-label` `<card>: <mark>`); own cards and face-up cards marked as such.
- `SuggestionLog`: every suggestion with who passed and who showed; the card name only in the viewer's own `seen` rows.
- `describeMove` texts: `Alice rolled 4 and 3`; `Alice moved to the <room>`; `Alice took the secret passage to the <room>`; `Alice stayed in the <room>`; `Alice stayed put`; `Alice suggested <suspect> with the <object> in the <room>`; `Bob showed Alice a card`; `Nobody could show Alice a card`; `Alice accused <suspect> with the <object> in the <room> and was right`; `... and was wrong`; `Alice ended the turn`.
- Layout: board and side panel side by side at laptop width, stacked below 720 px; touch targets at least 32 px.

- [ ] **Step 1: Write the failing tests.** `describeMove.test.ts`: one public state per `LastMove` kind, the texts above exactly. `svg.test.ts`: `'every card has art'` (every `CardId` renders a string starting with `<svg`), `'an unknown card renders null'`.
- [ ] **Step 2: Run** `node --test games/whodunit/client/*.test.ts games/whodunit/svg.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the art, client and the three registration lines.
- [ ] **Step 4: Run** `node --test games/whodunit/**/*.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Whodunit: art, screen, history and FAQ`.

### Task 8: README and end-to-end tests

**Files:**
- Create: `games/whodunit/README.md`, `e2e/whodunit.spec.ts`

**Interfaces:**
- Consumes: Task 7 labels; `seat`, `table.patch`, `table.dice`, `table.state`, `leave`, `dismiss`, `undo`, `headerButton`, `openFaq`, `joinGame` from `e2e/fixtures.ts` (unchanged).

README (`Rules`, `Controls`, `Differences from Wikipedia`, linking Wikipedia's Cluedo article). Differences to list at least: original setting, names and art; 9 rooms with no central staircase; exact-roll movement with early entry to a room, no revisits, occupied squares block (Wikipedia silent); Stay put when a roll has nowhere to go; the first seat starts and turns go in seat order; uneven deal from seat 1; a single matching card is shown at once; objects move into the room too; the notes sheet kept by the game; leaving holds the seat; a dismissed player's cards go face up; end of play per `settleEnd`; undo refused right after a shown card or an accusation; notes taken after an undone move are undone with it.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/whodunit.spec.ts`**, one test per rule, control and difference in the README, patching hands, solution and token positions with `table.patch` and queuing dice with `table.dice`. At least:
  - the deal: each page shows its own hand, and neither the page text nor the WebSocket frames hold the solution;
  - roll and move highlights only reachable squares; a door within the roll enters the room; Stay put;
  - secret passage; Stay after being moved in by a suggestion;
  - suggest: tokens move; the first holder clockwise gets the prompt with only matching cards; the suggester's log names the card; the third page shows `Bob showed Alice a card` with no card name; nobody can show;
  - wrong accusation: out of turns, still prompted to show; right accusation wins and shows the solution to all;
  - all but one out: the last one wins;
  - notes survive a reload;
  - **leaving to the game list and rejoining a minute later with nothing revealed** (spec): `test.setTimeout(150_000)`; Bob clicks `Back to games`; `await bob.waitForTimeout(61_000)`; Alice's and Cara's pages show no face-up cards and `(await table.state()).faceUp` is `{}`; Bob clicks `Back to Whodunit (<gameId>)` (the `RejoinButton` label) and sees exactly his old hand;
  - a dismissed player's cards turn face up on every page (`leave(cara)`, `dismiss('Cara', alice, bob)`);
  - the Undo button is gone right after a shown card, and present after a roll;
  - History (via `headerButton(page, 'History')`) shows no hand or shown card;
  - FAQ opens (via `openFaq`).
- [ ] **Step 3: Run** `npx vite build` then `E2E_PORT_BASE=8500 npx playwright test --workers=2 e2e/whodunit.spec.ts`. Expected: PASS.
- [ ] **Step 4: Run** `node --test games/whodunit/content.test.ts`. Expected: PASS (the README passes the name check).
- [ ] **Step 5: Commit** `Whodunit: README and end-to-end tests`.

### Task 9: Browser check

**Files:** none new.

- [ ] **Step 1:** In the worktree, `npx vite build`, then `PORT=3405 node server/server.ts` (nvm PATH workaround if needed; never port 6000).
- [ ] **Step 2: Play in Chrome**, one tab per player (three and then four tabs): a full game to a right accusation, and a forced end where all but one accuse wrongly. Along the way: a suggestion with a choice, one nobody can answer, a passage, a Stay. Go Back to games in one tab mid-game, wait a minute, check the others see nothing, rejoin. Dismiss a closed tab and check its cards are face up.
- [ ] **Step 3: Check History** (no hand or shown card for the table view), **download the game file** after game over and open it with View as each seat (each sees only its own hand and shown cards), and watch as a spectator and as a table screen mid-game (no hand, no card).
- [ ] **Step 4: Check layout** at a laptop width and at phone width (same-origin iframes at 390 px and 320 px, per the memory note), light and dark: no overlap, no blank rows, every control reachable, the board readable.

### Task 10: Full checks and pull request

**Files:** none new.

- [ ] **Step 1: Run** `npm test && npm run typecheck && npm run lint && E2E_PORT_BASE=8500 npx playwright test --workers=2 e2e/whodunit.spec.ts`. Expected: PASS (apart from any failure noted in Task 1 Step 4).
- [ ] **Step 2: Push:** `git push -u origin game-whodunit`.
- [ ] **Step 3: Open the PR:** `gh pr create --base party-games-and-polish --title "Whodunit"`, the body listing the rules, the Differences from Wikipedia, the one-line registration edits (so the coordinator can resolve conflicts), the two coordinator decisions above, and ending with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
