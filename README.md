# Multiplayer Tabletop Games

A website for playing board games with friends in the browser. It currently has two games, Quoridor (two to four players) and Azul (two to four players). The landing page lists the games; pick one, enter your name and a game ID, and join.

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

1. Open the site in two to four browser windows
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

- On the same machine, open `http://localhost:3000` in two to four browser windows
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

## Inspirations

This site grew out of two earlier projects, [Quoridor](https://github.com/Nate314/quoridor) and [Azul](https://github.com/Nate314/azul). Both are deprecated; this repo replaces them.

## Adding a game

The platform (server, landing page, join dialog, undo voting, Docker, CI) needs no edits. Add the game's own code and register it in two places.

1. Create `games/<id>/` with:
   - `types.ts`: the game's state and public state, extending `BaseGameState` and `BasePublicState` from `shared/types.ts`
   - `rules.ts`: pure functions over immutable state
   - `index.ts`: exports a `GameDefinition` object (see `shared/gameDefinition.ts`). Its properties are `info` (`id`, `name`, `description`, `minPlayers`, `maxPlayers`), `createGameState`, `resetLobby`, `applyMove`, `toPublicState`, and optionally `onPlayerLeft` and `applyAction`. The platform does not block `applyAction` during an undo vote or after the game is over, so refuse actions there yourself if the game needs to
   - tests, for example `rules.test.ts` and `manager.test.ts`
2. Create `games/<id>/client/` with:
   - `index.ts`: exports a `ClientGame` (see `src/clientGames.ts`) with `id`, `Screen`, `faq`, `icon`, `HistoryBoard` and `describeMove`
   - a `HistoryBoard` component: a read-only board for one public state from the history, with its `lastMove` highlighted
   - `describeMove.ts`: one line about the move that produced a public state, such as `Alice placed a wall`, shown as "Move 7 of 23: ..." in the history dialog
   - `faq.ts`: the FAQ items shown by the FAQ button
   - optionally a CSS file whose rules are all scoped under `[data-game="<id>"]`, so the game's colors never leak into other games or the landing page
3. Add one line to `games/registry.ts`: put the game in the `GAMES` array.
4. Add one line to `src/clientGames.ts`: put the client in `CLIENT_GAMES`.

The platform styles its own pieces by default (in `src/App.css`): the game header with Back to games, History, FAQ and the theme toggle, the FAQ and history dialogs, and the undo vote panel. A game without CSS gets a neutral look in light and dark mode. To theme them, either:

- set any of these variables on `[data-game="<id>"]`: `--platform-page-bg`, `--platform-text`, `--platform-button-bg`, `--platform-button-hover-bg`, `--platform-button-text`, `--platform-panel-bg`, `--platform-panel-text`, `--platform-backdrop`; or
- write your own rules for the classes: `.game-root`, `.game-header`, `.back-button`, `.history-button`, `.faq-button`, `.theme-toggle`, `.overlay`, `.modal`, `.faq` (`dl`, `dt`, `dd`), `.history` (`.history-move`, `.history-slider`, `.history-board`), `.primary-button`, `.undo-vote`, `.undo-vote-panel`, `.undo-vote-title`, `.undo-vote-list`, `.undo-vote-actions`. The defaults have no specificity, so any rule scoped under `[data-game="<id>"]` wins. Quoridor and Azul do this.

Server code (`server/`, `shared/`, and the non-client files of a game) must not import from `src/` or any `games/<id>/client/`.
