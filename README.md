# Multiplayer Tabletop Games

A website for playing board games with friends in the browser. It has ten games: Quoridor, Azul, Parchisi and Scrabble (two to four players), Chess, Checkers, Backgammon and Mancala (two players), UNO (two to eight players) and Phase 10 (two to six players). The landing page lists the games; pick one, enter your name and a game ID, and join.

## Setup and Running

1. Use Node.js 22.18 or newer (the server runs its TypeScript files directly). With nvm:

```bash
nvm install 22
nvm use 22
```

(On macOS or Linux, `nvm use` with no version also works; it reads `.nvmrc`.)

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm run start
```

This type-checks the code, builds the client, and starts the server. Open `http://localhost:3000`. To use another port, set the `PORT` environment variable.

## Run with Docker

With Docker installed (no local Node needed), build and start the site with one command:

```bash
docker compose up --build
```

Then open `http://localhost:3000`. Stop it with Ctrl+C, or run `docker compose down` if you started it with `-d`.

To use a different host port, set `APP_PORT`:

```bash
APP_PORT=3055 docker compose up --build        # macOS, Linux, Git Bash
```

```powershell
$env:APP_PORT = 3055; docker compose up --build   # Windows PowerShell
```

The image builds the client with Vite, then runs the same Express and WebSocket server as `npm run start`, as a non-root user.

### Running next to other projects

Port 3000 is a common default, so another project may already hold it. The launcher picks a free host port for you, writes it to a git-ignored `.env`, starts the site in the background and prints the URL:

```
./run.sh          # macOS, Linux, Git Bash
.\run.ps1         # Windows PowerShell
```

Any arguments are passed straight to `docker compose`, for example `./run.sh down` or `./run.sh logs -f`. Running it again while the site is up leaves the port alone. To pin a port, edit `.env`.

`run.sh` and `run.ps1` are small stubs. The launcher itself lives in [compose-launcher](https://github.com/Nate314/compose-launcher), which is included here as a git submodule in the `compose-launcher` folder. A plain `git clone` leaves that folder empty, so the first launcher run fetches it with `git submodule update --init compose-launcher`. That step needs network access and a real git clone (a zip download cannot fetch it). To get it up front, clone with `git clone --recurse-submodules`. The port and the printed URL are configured in `run.conf`. Plain `docker compose up --build` does not use the launcher or the submodule.

## Development

- `npm test` runs the unit tests
- `npm run typecheck` checks the TypeScript types for the browser and server code
- `npm run lint` runs ESLint
- `npm run dev` starts the Vite dev server for the browser code (UI only; play games through `npm start`)

## How to Play Multiplayer

1. Open the site in one browser window per player
2. In each window, click a game in the list. The join dialog asks for your name and a game ID (any string); use the same game ID to join the same game. The dialog has an FAQ button, so you can read a game's rules before joining
3. Players are seated in join order. The lowest-numbered player moves first once at least two players have joined. Nobody can join after the first move
4. Game IDs are separate per game: Azul "friday" and Quoridor "friday" are different games
5. Each game screen has a header with Back to games, FAQ and the light/dark theme toggle. Back to games returns to the list but keeps your seat, the same as closing the tab or losing the connection
6. Once the first move is made, a player who disconnects keeps their seat. The others see them as disconnected; play goes on until their turn, then waits for them. Before the first move, disconnecting frees the seat
7. To rejoin, enter the same game ID and the same name (capitalization does not matter), from any device. After a refresh the page rejoins by itself, and after Back to games the list shows a "Back to <game> (<game ID>)" button that rejoins with one click. A name that is still connected cannot be taken; a device that drops off without closing its connection frees the seat within about 30 seconds
8. The other players can vote to dismiss a disconnected player with the Dismiss button next to their name. Every connected player must approve; one decline cancels it. A dismissed player is out for good: their turns are skipped, they cannot rejoin, and if only one player is left, that player wins
9. A game whose players have all disconnected is kept for 10 minutes, then deleted

## Network Setup

The server handles both the web pages and the WebSocket connections on one port (3000 by default).

- On the same machine, open `http://localhost:3000` in one browser window per player
- Across computers on the same network, find the IP address of the computer running the server (for example with `ipconfig` or `ifconfig`) and open `http://<server-ip>:3000` on each one (for example `http://192.168.1.100:3000`)

Make sure every player can reach the server computer over the network.

## Technical Details

- Built with React, Vite and TypeScript
- Uses WebSocket for real-time multiplayer communication
- The server validates every move with the game's rules code
- Games are held in memory and are lost when the server restarts

See `docs/architecture.md` for more.

## Games

### Quoridor

Race your pawn to the far side and block opponents with walls.

Players are seated in join order: Player 1 (blue) starts at the bottom, Player 2 (red) at the top, Player 3 (green) on the left, Player 4 (purple) on the right.

#### Rules

- Players take turns either moving their pawn or placing a wall
- Pawns can move one square orthogonally (up, down, left, right)
- Pawns can jump straight over an adjacent pawn if the square beyond is free and not walled off
- Walls block pawn movement but cannot completely block a player's path to their goal
- Each player has 10 walls in a two-player game, or 5 walls with three or four players
- First player to reach their opposite edge wins
- If a player leaves mid-game, their pawn and walls stay on the board and their turns are skipped
- Any player can ask to undo the last turn. It is undone only if every player still in the game approves

#### Controls

- Click "Move" and then click a valid square to move your pawn
- Click "Horizontal Wall" or "Vertical Wall" to place walls
- Valid moves and wall placements are highlighted
- The game board is dimmed when it's not your turn; its frame stays colored to show each player's goal side
- Click "FAQ" at the top of the page for FAQs on moving, placing walls and the rules
- Click Undo to ask everyone to undo the last turn; it happens only if every player still in the game approves
- Hover or click Show Last Move to highlight the previous move

### Azul

Draft colored tiles and decorate your palace wall.

#### Rules

Each round, players take turns picking tiles and placing them on their own board.

- **Picking.** Take every tile of one color from one factory; the factory's other tiles move to the center. Or take every tile of one color from the center. The first player to take from the center in a round also takes the first-player marker, which goes on their floor line.
- **Placing.** Put the tiles on one of your five pattern lines. A line holds one color, and line 1 holds one tile up to line 5 holding five. You cannot use a line whose wall row already has that color. Tiles that do not fit go to your floor line. You may also put all of them on the floor line.
- **End of the round.** When the factories and the center are empty, each full pattern line moves one tile onto the wall, and lines that are not full stay as they are. A tile placed alone scores 1. Otherwise it scores the length of the row of tiles it joins plus the length of the column it joins. Then the floor line costs 1, 1, 2, 2, 2, 3 and 3 points for its seven spaces. A score never drops below zero. A scoring screen shows why everyone scored what they did, and the next round is dealt once every player has pressed Continue. Whoever holds the marker starts the next round.
- **End of the game.** The game ends after the round in which someone completes a horizontal row of their wall. Bonuses: 2 points for each complete row, 7 for each complete column, and 10 for each color placed five times. The highest score wins. A tie goes to the player with more complete rows.
- If a player leaves mid-game, their board stays and their turns are skipped. The last player left wins.
- Any player can ask to undo the last turn. It is undone only if every player still in the game approves.

#### Controls

- On your turn, click a tile in a factory or the center to pick up every tile of that color there. Click it again to put them back
- Your legal pattern lines and your floor line are outlined. Click one to place the tiles
- The table is dimmed when it is not your turn
- The source of the last move is outlined
- Boards are shown in turn order starting with yours, so play always passes to the board on the right
- In the center, each color stays together on one row
- Click Undo to ask everyone to undo the last turn; it happens only if every player still in the game approves
- After each round, read the scoring screen and click Continue; the next round starts once everyone has
- Click FAQ at the top of the page for a short guide to the rules and controls

### Chess

Checkmate the enemy king in the classic two-player strategy game.

The first player to join plays white and moves first; the second plays black. Each player sees their own pieces at the bottom of the board.

#### Rules

- Standard chess: the king moves one square in any direction, the queen any distance in a straight line or diagonally, the rook any distance in a straight line, the bishop any distance diagonally, and the knight in an L shape, jumping over pieces. A pawn moves one square forward, or two from its starting square, and captures one square diagonally forward
- Castling: the king moves two squares toward a rook and the rook jumps to its other side. Neither piece may have moved, the squares between them must be empty, and the king may not be in check, pass through an attacked square, or land on one
- En passant: a pawn that has just moved two squares can be captured by an enemy pawn beside it, as if it had moved one square, but only on the very next move
- Promotion: a pawn reaching the far rank becomes a queen, rook, bishop or knight of the player's choice
- A move may never leave your own king in check
- Checkmate wins. A player may also resign on their turn, and the opponent wins
- Draws happen automatically by stalemate, insufficient material (neither side can checkmate), threefold repetition of a position, or the 50-move rule (fifty moves each without a capture or pawn move)
- If a player disconnects, the game waits for them to rejoin. If they are dismissed, the other player wins
- Either player can ask to undo the last move. It is undone only if the other player approves

#### Controls

- On your turn, click one of your pieces to see its legal moves: a dot marks an empty square and a ring marks a capture. Click a marked square to move
- Click the piece again, or an unmarked square, to put it down, or click another of your pieces to pick that one instead
- When a pawn reaches the far rank, choose its new piece in the box over the board, or click Cancel
- The last move's squares are tinted, and a king in check stands on a red square
- The side panel shows the status, whose turn it is, each player's color and the pieces each player has captured
- The board is dimmed when it is not your turn
- Click Resign and then Confirm resign to resign; click Keep playing to change your mind
- Click Undo to ask your opponent to undo the last move
- Click FAQ at the top of the page for a short guide to the rules and controls

### Checkers

Jump diagonally to capture, and crown a king on the far row.

Exactly two players: Player 1 plays Red and moves first, Player 2 plays White. Each player sees their own pieces at the bottom of the board.

#### Rules

- Each side starts with 12 men on the dark squares of the three rows nearest them
- Men move one square diagonally forward; kings move one square diagonally forward or backward
- Capture by jumping diagonally over an opposing piece next to you onto the empty square beyond it. Men capture forward only; kings capture both ways
- Capturing is mandatory. If the piece can jump again from where it lands, it must keep jumping in the same turn; where the jumps branch, you choose the way
- A man that reaches the far row is crowned a king. A man crowned by a jump ends the turn there
- You win by capturing all of your opponent's pieces or leaving them with no legal move on their turn
- If both sides make 40 moves each with no capture and no man moving, the game is a draw
- If a player is dismissed mid-game, the other player wins
- Either player can ask to undo the last turn. It is undone only if the other player approves

#### Controls

- On your turn, click one of your pieces, then click a highlighted square to move there
- For a multi-jump, click each landing square in turn; the move is sent once no more jumps are left. Click the piece again to start over, or click another of your pieces to choose that one
- Pieces that must capture glow orange
- The squares of the last move are outlined in yellow, and captured pieces' squares are marked with a cross
- The board is dimmed when it is not your turn
- Click Undo to ask your opponent to undo the last turn
- Click FAQ at the top of the page for a short guide to the rules and controls

### Backgammon

Race your fifteen checkers home and bear them off before your opponent.

Exactly two players. The first to join plays white and moves first; the second plays red.

#### Rules

- Standard backgammon, single game, with no doubling cube and no points kept
- Both players start with fifteen checkers in the standard layout
- The dice are rolled for you at the start of each turn. Each die moves one checker that many points, and doubles are played four times
- A checker may land on an empty point, your own point, or a point with one opposing checker (a blot). Landing on a blot hits it and sends it to the bar. A point with two or more opposing checkers is blocked
- A checker on the bar must enter in your opponent's home board before you move anything else
- You must use both dice if you can. If only one can be used, you must use the higher one when possible. If you cannot move at all, your turn passes automatically and the status line says so
- Once all fifteen checkers are in your home board you may bear off. A die bears off from the point with its number, and a higher die bears off from your highest occupied point
- The first player to bear off all fifteen checkers wins. The status notes a gammon (the loser bore off none) or a backgammon (the loser also still has a checker on the bar or in the winner's home board)
- If a player leaves mid-game, the other player wins
- Either player can ask to undo the last checker move. It is undone only if the other player approves

#### Controls

- Each player sees the board from their own side, with their home board at the bottom right and points numbered 1 to 24 from that side
- On your turn, the checkers that can move are ringed. Click one, then click one of its highlighted points, or your tray on the right to bear off
- Click the selected checker again, or anywhere else, to pick a different one
- Each click moves one checker by one die. This turn's dice are shown beside the board and used dice are faded
- The board is dimmed when it is not your turn, and the last move is outlined
- Click Undo to ask your opponent to undo the last checker move
- Click FAQ at the top of the page for a short guide to the rules and controls

### Mancala

Sow seeds around the board and capture the most in your store.

Two players. The first to join moves first.

#### Rules

- The board has six pits per player and a store at each end. Every pit starts with four seeds
- On your turn, pick up all the seeds in one of your non-empty pits and sow them one at a time into the following holes, counter-clockwise. Your own store gets a seed; your opponent's store is skipped
- If your last seed lands in your own store, you take another turn
- If your last seed lands in an empty pit on your side and the pit across has seeds, you capture both: that seed and every seed across go into your store
- As soon as either row is empty, each player moves the seeds left on their side into their own store and the game ends
- The player with the most seeds in their store wins. Equal stores are a draw
- If a player leaves mid-game, the other player wins
- Any player can ask to undo the last turn. It is undone only if the other player approves

#### Controls

- Your row is always along the bottom, with your store on the right; your opponent's row and store are at the top and on the left
- On your turn, click one of your outlined pits to sow it
- The number in each pit and store is its seed count, and the store totals are listed under the board
- The pit the last move started from has a dashed outline and the hole where its last seed landed has a solid one
- The board is dimmed when it is not your turn
- The status shows extra turns, captures and the final score
- Click Undo to ask the other player to undo the last turn
- Click FAQ at the top of the page for the rules and controls

### Parchisi

Roll two dice and race your four pawns around the cross to home.

Players are seated in join order: Player 1 (blue) at the bottom, Player 2 (red) at the top, Player 3 (green) on the right, Player 4 (purple) on the left. With two players they sit on opposite sides.

#### Rules

- Each player has four pawns in their nest. The track has 68 squares around the cross, 12 of them safe, and each color has a home column of 7 squares leading to the center
- The dice are rolled for you at the start of your turn. Each die moves one pawn by its number, in either order. You must move while any die can be used, and if no move is possible the turn passes on by itself with a message
- A 5 on either die, or two dice adding up to 5 (which uses both), moves a pawn from the nest onto your entry square
- Doubles give another roll after the turn. Three doubles in a row send your pawn furthest along the track (not one in your home column) back to the nest and end your turn
- Landing on a single opponent pawn on a square that is not safe captures it: it goes back to its nest and you earn a 20 square bonus move. Safe squares cannot be captured on, except that entering a pawn captures an opponent standing on your entry square
- Getting a pawn home earns a 10 square bonus move. A bonus must be used whole by one pawn already out of the nest during the same turn, or it is lost
- Two pawns of the same color on a square form a blockade that nobody can pass or land on, including their owner. A square never holds more than two pawns
- Reaching the center takes an exact roll. The first player with all four pawns home wins
- If a player leaves mid-game, their pawns are removed from the board and their turns are skipped. The last player left wins
- Any player can ask to undo the last move. It is undone only if every player still in the game approves

#### Controls

- On your turn, the pawns you can move glow. Click one to select it, and every square it can reach is marked with the die that gets it there, such as 4, 2+3 or +20
- Click a marked square to move. Click the selected pawn again to unselect it
- The dice beside the board show the current roll; used dice are faded and bonus moves appear next to them
- The board is dimmed when it is not your turn, and the last move's squares are outlined
- Click Undo to ask everyone to undo the last move; it happens only if every player still in the game approves
- Click FAQ at the top of the page for a short guide to the rules and controls

### Scrabble

Build crossing words from your letter tiles on the premium-square board.

#### Rules

- Standard English Scrabble for two to four players: a 15x15 board with double and triple letter and word squares (the center star is a double word), and the standard 100 tiles with their usual values, including two blanks worth 0
- Everyone holds 7 tiles and draws back up to 7 after each play. Player 1 starts and play passes in seat order
- On your turn, play tiles, exchange tiles, or pass
- **Playing.** Place one or more tiles in a single row or column. Together with any tiles already in that line they must form one unbroken run. The first word covers the center star and uses at least two tiles. Every later word must touch a tile already on the board
- **Scoring.** Every word the play forms is scored: the main word and each crossing word. Letter and word premiums count only on the turn a tile is placed on them. Using all seven tiles adds 50 points. A blank stands for the letter you choose and scores 0
- **There is no dictionary.** Any letters placed by these rules are accepted. To dispute a word, ask for an Undo: the play is taken back only if every player still in the game approves
- **Exchanging.** Swap any of your tiles for new ones while the bag holds at least 7 tiles. This uses your turn and scores nothing
- **End of the game.** The game ends when a player uses their last tile while the bag is empty. That player gains the value of every other rack, and each other player loses the value of their own. It also ends after six scoreless turns in a row (passes, exchanges or plays worth 0), and then everyone loses the value of their rack. The highest score wins; tied players share the win
- Nobody sees another player's tiles. The screen shows how many tiles each player holds and how many are left in the bag
- If a player leaves mid-game, their tiles go back in the bag and their turns are skipped. The last player left wins
- Any player can ask to undo the last turn. It is undone only if every player still in the game approves

#### Controls

- Click a tile on your rack, then an empty square, to place it. Click a tile you placed this turn to take it back, or click Recall to take them all back
- Placing a blank shows a row of letters under your rack; click the letter it stands for
- The line under your rack shows the words you are making and their score, or why the tiles cannot be played yet. Click Play to play them
- Click Exchange, select the tiles to swap, then click Exchange again to confirm, or Cancel
- Click Pass to skip your turn
- Click Shuffle to mix the order of your rack. Only you see it
- The tiles of the last play are outlined, and the board and rack are dimmed when it is not your turn
- Click Undo to ask everyone to undo the last turn; it happens only if every player still in the game approves
- Click FAQ at the top of the page for a short guide to the rules and controls

### UNO

Match colors and numbers and be the first to empty your hand, for 2 to 8 players.

#### Rules

- The standard 108-card deck: in each of four colors one 0, two each of 1 to 9, and two each of Skip, Reverse and Draw Two, plus 4 Wild and 4 Wild Draw Four cards
- Everyone is dealt 7 cards and the top card of the deck starts the discard pile. Player 1 goes first. A starting action card acts as if played just before Player 1: a Skip skips Player 1, a Reverse lets the last player start, and a Draw Two makes Player 1 draw 2 and lose their turn. After a starting Wild any card may be played. A starting Wild Draw Four goes back into the deck and another card is flipped
- On your turn, play a card that matches the top of the discard pile by color, or by number or symbol, or play a Wild and choose the next color. A Wild Draw Four may be played at any time; there is no challenge rule
- Instead you may draw one card. If it can be played you may play it at once or pass to keep it; otherwise your turn ends
- Skip: the next player loses their turn. Reverse: play changes direction (with two players it acts as a Skip). Draw Two and Wild Draw Four: the next player draws 2 or 4 cards and loses their turn
- When the draw pile runs out, the discards except the top card are shuffled into a new draw pile
- You see only your own hand and how many cards everyone else holds. The draw pile is hidden from everyone
- The first player to empty their hand wins. There is no penalty for not calling UNO, but a player with one card shows an UNO! badge
- A dismissed player's cards go to the bottom of the draw pile and their turns are skipped
- Any player can ask to undo the last turn. It is undone only if every player still in the game approves

#### Controls

- Playable cards in your hand are raised and outlined; click one to play it
- To play a Wild, click it and then pick a color, or click Cancel to put it back
- Click Draw, or the draw pile, to draw a card. After drawing, play the highlighted card or click Pass to keep it
- The table shows every player's card count in seat order, an arrow for the direction of play, the top discard and the current color. The player whose turn it is is outlined
- Click Undo to ask everyone to undo the last turn
- Click FAQ at the top of the page for a short guide to the rules and controls

### Phase 10

Collect sets and runs to complete ten phases first.

#### Rules

- 108 cards: 1 to 12 in red, blue, green and yellow, twice each, plus 8 Wilds and 4 Skips. Each player is dealt 10 cards and one card starts the discard pile
- The phases, in order: 1: 2 sets of 3. 2: 1 set of 3 + 1 run of 4. 3: 1 set of 4 + 1 run of 4. 4: 1 run of 7. 5: 1 run of 8. 6: 1 run of 9. 7: 2 sets of 4. 8: 7 cards of one color. 9: 1 set of 5 + 1 set of 2. 10: 1 set of 5 + 1 set of 3
- **A turn.** Draw one card from the draw pile or the top of the discard pile (a Skip cannot be picked up). You may then lay down your current phase, once per hand, using exactly the cards it asks for. Once your phase is down you may hit: add cards to any group on the table. End your turn by discarding one card
- **Wilds and Skips.** A Wild stands for any card in a group, but every group needs at least one real number card. Discarding a Skip makes the player you choose lose their next turn
- **End of a hand.** A hand ends when a player has no cards left, by discarding or hitting their last card. Everyone else scores the cards left in their hand: 5 points for each 1 to 9, 10 for each 10 to 12, 15 for a Skip and 25 for a Wild. Everyone who laid down their phase moves on to the next one. A scoring screen shows the results, and the next hand is dealt once every connected player has pressed Continue. The deal moves one seat on
- **End of the game.** The game ends after a hand in which someone completes phase 10. Among those who completed it, the lowest score wins, and a tie shares the win
- When the draw pile runs out, the discards under the top card are shuffled into a new draw pile
- You see only your own hand and how many cards everyone else holds
- If a player leaves mid-game, their groups stay on the table and their turns are skipped. The last player left wins
- Any player can ask to undo the last move. It is undone only if every player still in the game approves

#### Controls

- On your turn, click the draw pile or the discard pile to draw. Both piles are outlined while you can draw
- Click cards in your hand to select them; selected cards lift up. Sort your hand by number or color with the Sort buttons
- To lay down your phase, select cards and click "Add selected to group 1" (or group 2). Click a staged card to put it back, or Clear to start over. "Lay down phase" is enabled once every group is right
- After your phase is down, select cards and click "Hit here" on any group to add them
- Select one card and click "Discard selected card" to end your turn. For a Skip, click the player to skip
- Every player is listed with their phase, score, card count and laid-down groups, and the current player is outlined. Your hand is dimmed when it is not your turn
- After each hand, read the scoring screen and click Continue; the next hand starts once everyone has
- Click Undo to ask everyone to undo the last move; it happens only if every player still in the game approves
- Click FAQ at the top of the page for the rules, the ten phases and the controls

## Inspirations

This site grew out of two earlier projects, [Quoridor](https://github.com/Nate314/quoridor) and [Azul](https://github.com/Nate314/azul). Both are deprecated; this repo replaces them.

## Adding a game

The platform (server, landing page, join dialog, undo voting, Docker, CI) needs no edits. Add the game's own code and register it in two places.

1. Create `games/<id>/` with:
   - `types.ts`: the game's state and public state, extending `BaseGameState` and `BasePublicState` from `shared/types.ts`
   - `rules.ts`: pure functions over immutable state
   - `index.ts`: exports a `GameDefinition` object (see `shared/gameDefinition.ts`). Its properties are `info` (`id`, `name`, `description`, `minPlayers`, `maxPlayers`), `createGameState`, `resetLobby`, `applyMove`, `toPublicState`, and optionally `onPlayerLeft` and `applyAction`. `applyMove` receives a `random` function for dice and reshuffles. `toPublicState` receives the seat the view is for (`null` for the history), so a game can show each player only their own hand The platform does not block `applyAction` during an undo vote or after the game is over, so refuse actions there yourself if the game needs to
   - tests, for example `rules.test.ts` and `manager.test.ts`
2. Create `games/<id>/client/` with:
   - `index.ts`: exports a `ClientGame` (see `src/clientGames.ts`) with `id`, `Screen`, `faq`, `icon`, `HistoryBoard` and `describeMove`
   - a `HistoryBoard` component: a read-only board for one public state from the history, with its `lastMove` highlighted
   - `describeMove.ts`: one line about the move that produced a public state, such as `Alice placed a wall`, shown as "Move 7 of 23: ..." in the history dialog
   - `faq.ts`: the FAQ items shown by the FAQ button
   - optionally a CSS file whose rules are all scoped under `[data-game="<id>"]`, so the game's colors never leak into other games or the landing page
   - optionally move animations: give the elements to animate a `data-anim-key` and call `useMoveAnimation(rootRef, gameState, animate)` (`src/animation/useMoveAnimation.ts`) in the game's screen, not in its `HistoryBoard`. It calls `animate({ previous, next, root, rectOf })` only when exactly one move was added, so the first render, a rejoin and an undo snap into place. `rectOf(key)` is where that keyed element was before the move. `slideFrom` and `fadeIn` (`src/animation/motion.ts`) last `MOVE_DURATION_MS` (300 ms) and do nothing under `prefers-reduced-motion: reduce`. Nothing animates unless the game asks for it
3. Add one line to `games/registry.ts`: put the game in the `GAMES` array.
4. Add one line to `src/clientGames.ts`: put the client in `CLIENT_GAMES`.

The platform styles its own pieces by default (in `src/App.css`): the game header with Back to games, History, FAQ and the theme toggle, the FAQ and history dialogs, and the undo vote panel. A game without CSS gets a neutral look in light and dark mode. To theme them, either:

- set any of these variables on `[data-game="<id>"]`: `--platform-page-bg`, `--platform-text`, `--platform-button-bg`, `--platform-button-hover-bg`, `--platform-button-text`, `--platform-panel-bg`, `--platform-panel-text`, `--platform-backdrop`; or
- write your own rules for the classes: `.game-root`, `.game-header`, `.back-button`, `.history-button`, `.faq-button`, `.theme-toggle`, `.overlay`, `.modal`, `.faq` (`dl`, `dt`, `dd`), `.history` (`.history-move`, `.history-slider`, `.history-board`), `.primary-button`, `.undo-vote`, `.undo-vote-panel`, `.undo-vote-title`, `.undo-vote-list`, `.undo-vote-actions`. The defaults have no specificity, so any rule scoped under `[data-game="<id>"]` wins. Quoridor and Azul do this.

Server code (`server/`, `shared/`, and the non-client files of a game) must not import from `src/` or any `games/<id>/client/`.
