# Nine New Games: Design

Date: 2026-10-31
Repo: `Nate314/multiplayer-tabletop-games`
Builds on: the platform as of `a22cb37` (pause and resume, #60)

## Intent

The owner's group plays on Discord calls when they cannot meet in person, and wants a bigger menu of games to pick from. This batch adds nine: Chinese Checkers, Tic-Tac-Toe, Ultimate Tic-Tac-Toe, Go, Sudoku, Jigsaw, Snakes and Ladders, Code Breaker and Naval Battle.

Three of them (Sudoku, Jigsaw, Code Breaker) are puzzles people usually play alone. The owner wants a mode choice for these: Solo, Together on one shared board, or a Race on identical copies. That needs the platform to allow a one-player game for the first time, and Jigsaw needs uploaded photos, so a small piece of shared ground is built before those three games.

Scope note: the owner's list also had commercial games (Pit, Poetry for Neanderthals, Mad Gab, Carcassonne expansions, Blokus, Blokus Trigon, Clue, The Game of Life, Operation, Candy Land, Codenames, Balderdash, Scattergories, Guesstures). These are skipped this round (owner's decision). Chutes and Ladders, Mastermind and Battleship are built as their traditional public-domain forms: Snakes and Ladders, a Bulls and Cows style code-breaking game named Code Breaker, and the pencil-and-paper grid naval game named Naval Battle. Fictionary, Categories and Charades were considered and dropped (owner's decision).

## Goals

- Each game is complete and playable, built the same way as the existing games: a `games/<id>/` folder with `types.ts`, `info.ts`, `index.ts`, `rules.ts`, rules tests, a manager test, `README.md` and a `client/` folder (`GameScreen`, `HistoryBoard`, `describeMove`, `faq`, `index.ts`, scoped SCSS, `animateMove` where it fits). Follow the nearest existing game: Checkers or Chess for the 2-player boards, Parchisi for Snakes and Ladders, Pictionary for options in `options.ts`.
- Each game works with everything the platform gives a game: seating, rejoin, held seats, dismiss votes, undo votes, the History dialog, game files with "View as", spectators, the table screen, pause and resume, stats, house rules and the turn timer.
- **Rules from Wikipedia.** The builder reads the game's Wikipedia article before writing rules code. Every difference is listed in the README under "Differences from Wikipedia", in the format of `games/rook/README.md`. Where this document disagrees with Wikipedia, this document wins and the README lists it.
- **End-to-end tests** in `e2e/<id>.spec.ts`: one test per rule, control and difference in the README.
- Hidden information stays hidden: Naval Battle fleets, the Code Breaker secret, Race boards of other players and puzzle solutions go through `toPublicState`, `privateSeatView` and `secretState`, and `viewer: null` sees none of them.
- No new npm dependency.

## Non-goals

- The skipped commercial games and the three dropped party games.
- Computer opponents, except the computer setting a Code Breaker code.
- Refactoring existing games.
- Leaderboards or best times saved across games.

## Anti-goals

- A game that looks finished but has a rule wrong in a way a regular player would notice (Go capture and ko are the riskiest).
- A hidden ship, secret code, or puzzle solution reaching a browser that should not see it, including through History, a game file or a spectator.
- Re-sending an uploaded photo with every state broadcast.
- Together mode refusing a player's move because a friend moved a moment earlier.
- A screen that is unusable on a laptop window or overlaps itself at a narrow width.

## Shared ground (chunk 0, built before the three puzzle games)

Built on its own branch `shared-puzzle-modes` off `nine-new-games`, with a PR into `nine-new-games`, merged before the Sudoku, Jigsaw and Code Breaker agents start.

1. **One-player games.** `minPlayers: 1` must work: the game starts with one seated player once the house rules are agreed. With exactly one connected player, Ask to undo applies at once with no vote (today `resolveUndoVote` and the request refuse with fewer than two). Dismiss, pause and rematch votes with one player behave sensibly (one vote decides). Everything else (seating, rejoin, stats, game over) is unchanged. Platform tests cover it.
   - **Keeping going with one player left** (my call): today `removePlayer` in `shared/seating.ts` ends a started game when one player remains ("X wins! Everyone else left"). A game may opt out (a new optional `GameDefinition` flag, for example `continuesAlone`), and then `onPlayerLeft` is called with one player left too. The three puzzle games opt in. The last player keeps playing in the same mode and must still finish the puzzle to win; nobody wins by default.
2. **Own-move undo** (owner's decision): in Together and Race, each player can take back their own last move at once, with no vote, and it never touches anyone else's board or entries. The room-wide undo vote is not offered in those modes. Chunk 0 adds the platform hook for this: an optional `GameDefinition` method the game implements (for example `undoOwn(state, seat)`, returning the state with that seat's last move taken back, or an error when it has none), sent by the client as a new message, refused while paused or after game over, and recorded as a step like an action so History stays truthful. The Undo button in those modes sends it instead of opening a vote, labeled Undo my last move. Solo uses the normal undo, which applies at once with one player.
3. **The mode rule**, `shared/puzzleModes.ts`: a `ChoiceRule` with id `mode` and choices Solo, Together and Race, and helpers the three games share:
   - **Solo** is offered only when one player is seated; **Together** and **Race** only when two or more are. With one seat the standard is Solo, with two or more it is Together (my call: the mode follows the seat count, so nothing has to block a friend from taking a seat; a friend who wants to watch joins as a spectator).
   - **House rules extension** (my call): today `offered(seats)` hides a whole rule, `standard` is one fixed value, and a value that stops being offered is kept. Chunk 0 extends `shared/houseRules.ts` so a choice can carry its own `offered(seats, values)` and a rule's standard can depend on the seat count (for example `standardFor?(seats)`). A kept value whose choice is no longer offered at the new seat count falls back to the standard. Existing rules behave as today. `puzzleModes.ts` exports a function that builds the mode rule from a list of extra choices, so Code Breaker adds Classic without touching `shared/`.
   - **Together**: no turns. Every seated player may play at any time. Moves are sent as game actions with `recordsAction` true, so they are recorded for undo and History but never refused as "Someone else moved first". The game records who placed each piece or entry, and the end screen shows each player's count. Everyone shares the win.
   - **Race**: every player has their own copy of the same puzzle, kept per seat in state. A player's view shows their own board and the others' progress as a percentage only; other boards are hidden from them through `toPublicState`. Moves are actions, as in Together. The first to finish wins, the rest are ranked by progress. Spectators see every board. After the game is over, everyone sees every board.
   - The current mode shows in the lobby and the Rules dialog like any house rule.
   - Helpers: reading the mode, a `RaceBoards` shape keyed by seat, and the progress view. The games own their own boards and moves.
4. **Uploaded images**, for Jigsaw:
   - The browser shrinks the photo before upload (longest side 1600 px, JPEG, my call) using a canvas, so no package is needed.
   - `POST /api/images` takes the bytes (at most 1 MB after shrinking, refused otherwise, JPEG or PNG only, checked by the file's leading bytes), stores them in a new SQLite table in `server/store.ts`, and returns an id. `GET /api/images/<id>` serves it. The game state holds only the id, so broadcasts stay small and the 64 KB WebSocket limit is untouched.
   - Upload is allowed for a seated player of an existing game room, including in the lobby before the first move (the room exists from the moment its first player joins), proven by the seat key the client already holds. The image is tied to that room. Deleting a game deletes its images. An image no game refers to is deleted too.
   - Pause files and downloaded game files include the image (base64 inside the file) so resuming or viewing on another server still shows the picture.
5. **Puzzles category.** `shared/categories.ts` gains `{ id: 'puzzle', name: 'Puzzles' }`, after Classic board games (my call). Sudoku, Jigsaw and Code Breaker go there.

Everything in chunk 0 updates `docs/architecture.md` where it describes the platform.

## Rules for every game agent

- **Branch and PR.** Each agent works in its own git worktree on `game-<id>` (Tic-Tac-Toe and Ultimate Tic-Tac-Toe share one, `game-tictactoe`), started from `nine-new-games` (from `nine-new-games` after chunk 0 is merged, for the three puzzle games). Each agent follows its plan with subagent-driven development, and opens a PR into `nine-new-games` when done (owner's decision). The coordinator merges them all into `nine-new-games` and opens **one PR** against `master`.
- **Files outside its folder:** one-line registration entries in `games/registry.ts`, `src/clientGames.ts`, `games/infos.ts`, `shared/svg/gameIcons.ts` (the game's landing icon), and the lists existing tests keep of every game (`shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`, the game count in `e2e/landing.spec.ts`), plus the game's line in `server/assets/registry.ts` if it draws server SVGs, the README's game list and the count in its first sentence, `docs/architecture.md` only where it lists games by name, and its own `e2e/<id>.spec.ts`. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`. If a game needs a platform or fixture change, the agent stops and reports it. The coordinator resolves the conflicts these shared lines cause.
- **Undo.** Every move undoable by vote, except in Together and Race, which use own-move undo (shared ground). Things not bound to a turn (setup choices, Continue between rounds) are game actions. A Naval Battle undo never reveals a ship the undo itself did not hide.
- **Leaving.** As the nearest existing game does: for the 2-player games the remaining player wins, as in Chess. For Chinese Checkers and Snakes and Ladders, the leaver's pieces are removed and play goes on, as in Parchisi. Together and Race carry on with whoever is left.
- **Tests.** Rules tests cover setup, every move type, game end and the hidden-information views. A manager test plays a short game through `createGameManager` with a seeded random. `npm test`, `npm run typecheck`, `npm run lint` and the game's e2e spec pass.
- **Browser check.** The agent runs the site on its own port and plays the game in Chrome, one tab per player, through a full game or a forced game end, checks History and a downloaded game file, and checks the screen at a laptop size and a narrow (phone) size for overlap.
- **Writing.** No em-dashes in READMEs, FAQs, comments or commit messages.

## The games

"My call" marks a choice the owner has not made; the owner can overrule any. Everything not named here follows Wikipedia.

### Chinese Checkers (`chinesecheckers`, Classic board games)

- 2, 3, 4 or 6 players on the 121-hole star board, 10 marbles each. Starting points for each player count follow Wikipedia (2 players opposite, 3 alternating points, 4 two opposite pairs, 6 all).
- A move is a step to an adjacent empty hole, or a chain of jumps over single marbles (own or others') into the empty hole beyond. The player may stop the chain at any landing. No captures.
- The first to fill the opposite point wins; play continues for the remaining places (my call: the game ends at the first winner, others ranked by marbles home).
- Blocking: a marble left in an opponent's destination point does not stop them winning when every other hole there is theirs (Wikipedia's anti-spoiling rule, if it lists one; else my call to apply it).
- Screen: the star board, click a marble then a hole, the jump path drawn as you build it, an End move button for a chain.

### Tic-Tac-Toe (`tictactoe`, Classic board games)

- 2 players, 3x3, X moves first. Three in a row wins, a full board is a draw.
- Single game per match; the platform rematch covers "again", with the first player alternating on rematch if the platform makes that easy (else X is always seat 1, my call).

### Ultimate Tic-Tac-Toe (`ultimatetictactoe`, Classic board games)

- 2 players, nine 3x3 boards in a 3x3. The cell you play sends your opponent to the matching small board. If that board is won or full, they may play anywhere open.
- Winning a small board claims it; three claimed boards in a row wins. A drawn small board counts for nobody. All boards decided with no line is a draw.
- Shares win-line checking with Tic-Tac-Toe through a small module inside `games/tictactoe/` that Ultimate imports (my call; it is game code, not platform).
- Screen: the big board with the board you must play in highlighted.

### Go (`go`, Strategy board games)

- 2 players, Black first. **Board size** house rule: 9x9, 13x13 or 19x19, standard 19x19.
- Capture, suicide forbidden, the simple ko rule (no move that recreates the position just before the opponent's last move). Positional superko is not enforced (my call).
- Passing: two passes in a row end play. **Scoring:** area scoring (Chinese rules) with komi 7.5 (my call). After two passes both players mark dead stones; each change clears the other's agreement; when both agree the score is counted. Either may resume play instead, which continues with the player who would have moved.
- Resign through `shared/drawOffer.ts` as in Chess (resign only, no draw offers).
- Handicap stones are not offered (my call).
- Screen: the board with star points, the last move marked, captures shown, Pass and Resign, the dead-stone marking step with the projected score.

### Sudoku (`sudoku`, Puzzles)

- Modes: Solo, Together, Race (shared ground).
- **Difficulty** house rule: Easy, Medium, Hard (standard Medium). Puzzles are generated on the server with a seeded random and have exactly one solution. Difficulty is by the number of givens and by needing only singles (Easy) versus harder techniques (my call on the method; the builder documents it in the README).
- Players enter digits and pencil marks. Pencil marks are per player, never recorded for undo (my call).
- **Together:** a wrong entry is shown as wrong at once, to everyone.
- **Race:** wrong entries are not flagged. When a player's board is full, it is checked: correct wins, wrong tells only them that something is wrong so they keep going.
- **Solo:** wrong entries are not flagged unless the player turns on a Show mistakes toggle in the screen (my call).
- The solution is hidden from every browser until the game ends.
- Screen: the 9x9 grid, a digit pad, pencil mode, erase, and in Race the others' percentages.

### Jigsaw (`jigsaw`, Puzzles)

- Modes: Solo, Together, Race (shared ground).
- **Picture:** before play, the host picks one of the built-in pictures or uploads a photo (owner's decision). This is a game setup action, not a house rule, since house rule values come from fixed choice lists (my call): stored in state, kept by `resetLobby` and seat changes, shown to everyone in the lobby as a preview, and locked by the first move. Changing it clears nobody's house rule agreement.
- **Recording** (my call): only snaps are recorded steps (for undo and History). Picking up and dropping a loose piece updates state without recording, so History stays small. Built-in pictures are SVG drawings served by the asset registry as `jigsaw-picture/<name>`, at least 8 of them, in the style of the site (my call: landscapes, animals, food and patterns drawn with simple shapes).
- **Piece count** house rule: 24, 48, 96 or 150 (my call), standard 48.
- Pieces have tab and blank edges generated from a seed, scattered face up around the board area. A piece dragged within a small distance of its true spot snaps in place and locks. Pieces do not snap to each other off the board (my call).
- **Together:** a piece held by one player is shown as held to everyone and cannot be taken by another until dropped. Dragging is not sent move by move; only pick-up, drop and snap are.
- **Race:** each player has their own scatter of the same pieces.
- The game ends when every piece is placed.
- Screen: the board outline with an optional faint picture guide (a toggle in the screen, my call), the scattered pieces, a preview of the full picture.

### Code Breaker (`codebreaker`, Puzzles)

- Bulls and Cows style with colored pegs. **Code** house rule: 4 pegs from 6 colors (standard), or 5 pegs from 8 colors. Repeated colors are allowed (my call). 10 guesses per code.
- Each guess is answered with the number of pegs right in color and place, and the number right in color but in the wrong place, worked out by the server.
- **Modes:** Classic, Solo, Together, Race. Classic is offered at exactly two seats; Solo at one; Together and Race at two or more. With two seats the standard is Classic (my call). Code Breaker extends the shared mode rule with Classic.
- **Classic:** players take turns as code maker and breaker, 2 rounds each (my call). The maker sets a code in secret; the breaker scores 1 point per guess used, plus 1 more if they fail all 10 (Wikipedia's scoring if it gives one). Lowest total after all rounds wins.
- **Solo, Together, Race:** the server sets the code at random. In Together, anyone may submit the next guess. In Race, everyone breaks the same code on their own board; fewest guesses wins, ties broken by who finished first. The game ends once no player still guessing can match or beat the best result (my call).
- The code is hidden from every browser except its maker until it is broken or the guesses run out.
- Screen: the guess rows with answer pegs, the color picker, Submit guess, and the code row hidden until revealed. Colors carry the site's color-blind symbols.

### Snakes and Ladders (`snakesladders`, Classic board games)

- 2 to 6 players on a 10x10 board numbered 1 to 100, with a fixed set of snakes and ladders (the builder chooses one fixed layout, documented in the README, my call).
- Roll one die and move. Landing on a ladder's foot climbs it; landing on a snake's head slides down.
- **Exact finish** house rule, off by default (my call): with it on, a roll that would pass 100 does not move.
- Rolling a 6 gives another roll (Wikipedia variant only if its main rules include it; else not, my call).
- First to 100 wins; the game ends there.
- Screen: the board with snakes and ladders drawn, tokens in player colors, a die using the shared `Dice`, and a move animation along the path.

### Naval Battle (`naval`, Classic board games)

- 2 players, each with a 10x10 grid and a fleet of ships of lengths 5, 4, 3, 3 and 2, placed in secret, horizontal or vertical, not overlapping (touching allowed, my call).
- Placement happens at once for both players as a game action; a Random placement button is offered. Play begins when both have confirmed.
- One shot per turn. The answer is miss, hit, or hit and sunk with the ship's length named. The game does not give an extra shot for a hit (my call).
- **Salvo** house rule, off by default: each turn you fire one shot per ship you still have afloat.
- Sinking every enemy ship wins.
- Hidden: each fleet from the other player and from History viewers until the game ends. A spectator sees both fleets only as the platform's privateSeatView allows.
- Screen: your fleet with incoming shots, the target grid with your shots, the placement step with rotate and drag.

## Order of work

1. Coordinator: this document, approval, one plan per chunk, all committed to `nine-new-games` and pushed.
2. In parallel: chunk 0 (shared ground) and the six games that do not need it (Chinese Checkers, Tic-Tac-Toe with Ultimate, Go, Snakes and Ladders, Naval Battle: five agents), each by its own agent in its own worktree and port, each opening a PR into `nine-new-games`.
3. Once chunk 0 is merged: Sudoku, Jigsaw and Code Breaker in parallel, the same way.
4. Coordinator: review and merge every PR into `nine-new-games`, resolve the conflicts on the registry, client registry, README and architecture lines, run `npm test`, `npm run typecheck`, `npm run lint` and the full `npm run test:e2e`, play a few games in the browser, then open one PR against `master`.

## Left to the builders

- Each game's state shape, move and action types, and component breakdown.
- Exact screen layout and styling, within scoped SCSS and the light and dark themes.
- Which moves animate, and how.
- FAQ wording.
- The Snakes and Ladders layout and the built-in jigsaw pictures.
