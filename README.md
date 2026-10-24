# Multiplayer Tabletop Games

A website for playing board games with friends in the browser. It has thirty-one games: Azul, Dominoes, Parchisi, Quoridor, Rack-O, Rummikub, Scrabble and Splendor (two to four players), Backgammon, Checkers, Chess, Connect Four, Mancala and War (two players), Catan (three to four players), The Crew (three to five players), Euchre, Hearts, Rook and Spades (four players), Carcassonne and Ticket to Ride (two to five players), Go Fish, Phase 10 and Skip-Bo (two to six players), Risk (three to six players), and Farkle, Monopoly, Texas Hold'em, UNO and Yahtzee (two to eight players). The landing page lists the games in groups (card, dice, tile, classic board and strategy board games); pick one, enter your name and a game ID, and join.

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
- `npm run test:e2e` runs the end-to-end tests: every rule and control in each game's README, played in real browsers. Run `npx playwright install chromium` once first. It builds the client, then each worker starts its own server with test hooks on (`E2E=1`, see `server/e2e.ts`), so a test can set up a game state and pick the next dice before playing it in the browser. Set `E2E_SKIP_BUILD=1` to reuse the last build. Each run also writes an HTML report to `playwright-report/`; open it with `npx playwright show-report`
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
7. To rejoin, enter the same game ID and the same name (capitalization does not matter) in the same browser. The browser keeps a secret key for the seat, so nobody else can take it by typing your name. After a refresh the page rejoins by itself, and after Back to games the list shows a "Back to <game> (<game ID>)" button that rejoins with one click. A name that is still connected cannot be taken; a device that drops off without closing its connection frees the seat within about 30 seconds
8. The other players can vote to dismiss a disconnected player with the Dismiss button next to their name. Every connected player must approve; one decline cancels it. A dismissed player is out for good: their turns are skipped, they cannot rejoin, and if only one player is left, that player wins
9. A game whose players have all disconnected is kept for 10 minutes, then deleted
10. The History button shows the starting board, every move, and, if the game ended by resigning, a draw or everyone else leaving, the end of the game. When a game is over, Download game in that dialog saves it as a `.json` file, which includes every player's view of the game. Anyone can open that file with Open a saved game on the landing page and step through it, without joining anything. A saved game is for review only. In an opened file, View as shows the game from any player's seat, including their hand in Dominoes, Euchre, Go Fish, Hearts, Phase 10, Rack-O, Rook, Rummikub, Scrabble, Skip-Bo, Spades, Texas Hold'em, The Crew and Uno and the cards they reserved from a deck in Splendor, or Table only. The Animations checkbox animates each step forward, and Play steps through the game on its own, one step every 1.5 seconds. The Animations setting and the name and game ID you last joined with are remembered in this browser

## Settings

The gear button in the landing page header and every game header opens Settings. Every setting belongs to the player and is kept in this browser only; it is never sent to the server and does not change what other players see or hear.

- Volume and Mute all set how loud the sounds are, and Mute all silences them
- Your turn chime, Moves, Dice, Game over and Timer warnings turn each group of sounds on or off
- Color-blind symbols adds a symbol next to colors that carry meaning
- Highlight newly drawn cards marks the cards you just drew

## Saved games

The database is `data/games.sqlite` in the repo, created on first start and git-ignored. Set `DATABASE_PATH` to put it elsewhere. With Docker, the `game-data` volume holds it, so it survives `docker compose restart` and rebuilds; `docker compose down -v` deletes it. After a restart every player is shown as disconnected until they rejoin, and a game with nobody back within 10 minutes is deleted.

## Network Setup

The server handles both the web pages and the WebSocket connections on one port (3000 by default).

- On the same machine, open `http://localhost:3000` in one browser window per player
- Across computers on the same network, find the IP address of the computer running the server (for example with `ipconfig` or `ifconfig`) and open `http://<server-ip>:3000` on each one (for example `http://192.168.1.100:3000`)

Make sure every player can reach the server computer over the network.

## Installing as an app

The site can be installed and then opens full screen like an app:

- **Android (Chrome):** open the site, then choose "Install app" or "Add to Home screen" from the menu.
- **iPhone (Safari):** open the site, tap Share, then "Add to Home Screen".
- **Desktop (Chrome):** click the install icon at the right of the address bar.

Installing needs HTTPS, or `localhost` on the server computer itself; over plain `http://<server-ip>:3000` the browser offers only a shortcut. The site always loads fresh when the server answers, so a new version shows on the next reload. Without a connection the installed app only opens its start screen: games need the server.

## Technical Details

- Built with React, Vite and TypeScript
- Uses WebSocket for real-time multiplayer communication
- The server validates every move with the game's rules code
- Started games are kept in a SQLite database (Node's built-in `node:sqlite`, which prints an experimental warning), so they survive a server restart. Players rejoin with the same game ID and name, from the browser they joined in. Games not yet started are not saved

See `docs/architecture.md` for more.

## Games

Each game's rules and controls are in its own README. The rules follow the Wikipedia page linked for each game; any difference is listed in that game's README.

- [Azul](games/azul/README.md): draft colored tiles and decorate your palace wall. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Azul_(board_game)).
- [Backgammon](games/backgammon/README.md): race your fifteen checkers home and bear them off before your opponent. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Backgammon).
- [Carcassonne](games/carcassonne/README.md): lay land tiles to build cities, roads and fields, and claim them with your meeples, for 2 to 5 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Carcassonne_(board_game)).
- [Catan](games/catan/README.md): settle an island, trade resources and build roads, settlements and cities to reach 10 points, for 3 to 4 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Catan) and the official base game rules.
- [Checkers](games/checkers/README.md): jump diagonally to capture, and crown a king on the far row. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/English_draughts).
- [Chess](games/chess/README.md): checkmate the enemy king in the classic two-player strategy game. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Rules_of_chess).
- [Connect Four](games/connectfour/README.md): drop discs into the grid and line up four in a row. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Connect_Four).
- [Dominoes](games/dominoes/README.md): match tile ends to build a line, draw from the boneyard when stuck, and be first to play out your hand, for 2 to 4 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Dominoes).
- [Euchre](games/euchre/README.md): make trump with your partner and take three of five tricks, with the jacks on top, first team to 10, for exactly 4 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Euchre).
- [Farkle](games/farkle/README.md): roll six dice, bank your points or push your luck and risk them all, for 2 to 8 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Farkle).
- [Go Fish](games/gofish/README.md): ask for ranks, go fish, and collect the most books of four, for 2 to 6 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Go_Fish).
- [Hearts](games/hearts/README.md): pass three cards, then dodge the hearts and the queen of spades or shoot the moon, lowest score when someone reaches 100 wins, for exactly 4 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Hearts_(card_game)), Black Lady.
- [Mancala](games/mancala/README.md): drop stones around the board, keep going from every full pit, and fill your bank. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Mancala).
- [Monopoly](games/monopoly/README.md): buy, trade and build on properties, and bankrupt every other player, for 2 to 8 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Monopoly_(game)).
- [Parchisi](games/parchisi/README.md): roll two dice and race your four pawns around the cross to home. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Parcheesi).
- [Phase 10](games/phase10/README.md): collect sets and runs to complete ten phases first. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Phase_10).
- [Quoridor](games/quoridor/README.md): race your pawn to the far side and block opponents with walls. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Quoridor).
- [Rack-O](games/racko/README.md): draw and swap cards to put your ten-slot rack in ascending order, for 2 to 4 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Rack-O).
- [Risk](games/risk/README.md): raise armies, roll for battles and conquer all 42 territories of the world, for 3 to 6 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Risk_(game)).
- [Rook](games/rook/README.md): bid for the nest, name trump and take counters with your partner, first team to 500, for exactly 4 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Rook_(card_game)), Kentucky Discard.
- [Rummikub](games/rummikub/README.md): lay down sets and runs of numbered tiles and rearrange the table to empty your rack. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Rummikub).
- [Scrabble](games/scrabble/README.md): build crossing words from your letter tiles on the premium-square board. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Scrabble).
- [Skip-Bo](games/skipbo/README.md): build piles from 1 to 12 with your hand, stock and discard piles, and be first to empty your stock, for 2 to 6 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Skip-Bo).
- [Spades](games/spades/README.md): bid your tricks with your partner, spades are always trump, first team to 500, for exactly 4 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Spades_(card_game)).
- [Splendor](games/splendor/README.md): collect gems, buy development cards and attract nobles to reach 15 prestige. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Splendor_(game)).
- [Texas Hold'em](games/holdem/README.md): no-limit poker with two private cards and five shared ones, betting with play chips, for 2 to 8 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Texas_hold_%27em).
- [The Crew](games/thecrew/README.md): play the 50 cooperative missions of The Quest for Planet Nine, winning the right tricks with little talking, for 3 to 5 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/The_Crew_(card_game)) and the publisher's logbook.
- [Ticket to Ride](games/tickettoride/README.md): collect train cards, claim railway routes across the USA and connect your destination tickets, for 2 to 5 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Ticket_to_Ride_(board_game)).
- [UNO](games/uno/README.md): match colors and numbers, empty your hand to score the cards left in the others, and reach 500 points first, for 2 to 8 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Uno_(card_game)).
- [War](games/war/README.md): flip cards, the higher card takes both, and win the whole deck, for 2 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/War_(card_game)).
- [Yahtzee](games/yahtzee/README.md): roll five dice up to three times and fill every scoring box, for 2 to 8 players. Rules follow [Wikipedia](https://en.wikipedia.org/wiki/Yahtzee).

## Inspirations

This site grew out of two earlier projects, [Quoridor](https://github.com/Nate314/quoridor) and [Azul](https://github.com/Nate314/azul). Both are deprecated; this repo replaces them.

## Adding a game

The platform (server, landing page, join dialog, undo voting, Docker, CI) needs no edits. Add the game's own code and register it in two places.

1. Create `games/<id>/` with:
   - `types.ts`: the game's state and public state, extending `BaseGameState` and `BasePublicState` from `shared/types.ts`
   - `rules.ts`: pure functions over immutable state
   - `index.ts`: exports a `GameDefinition` object (see `shared/gameDefinition.ts`). Its properties are `info` (`id`, `name`, `description`, `minPlayers`, `maxPlayers`), `createGameState`, `resetLobby`, `applyMove`, `toPublicState`, and optionally `onPlayerLeft`, `onUndo` and `applyAction`. A game with face-down cards or tiles reshuffles them in `onUndo`, so an undone draw shows nothing about the next one. `applyMove` receives a `random` function for dice and reshuffles. `toPublicState` receives the seat the view is for (`null` for the history), so a game can show each player only their own hand The platform does not block `applyAction` during an undo vote or after the game is over, so refuse actions there yourself if the game needs to
   - optionally resigning and draws by agreement, for a two-player game: add `DrawOfferState` (`shared/drawOffer.ts`) to the state with `drawOffer: null`, pass actions to `applyEndingAction` from `applyAction` (it refuses them before the first move, after the game is over and during a vote), and wrap each move's new state in `lapseDrawOffer(state, seat)`. Show the controls with `src/components/DrawAndResign.tsx` in the side panel; it takes the game's own buttons, such as Undo, as children. Chess and Checkers do this
   - tests, for example `rules.test.ts` and `manager.test.ts`
   - `README.md`: the game's rules and controls, linked from the Games list above
2. Create `games/<id>/client/` with:
   - `index.ts`: exports a `ClientGame` (see `src/clientGames.ts`) with `id`, `Screen`, `faq`, `icon`, `HistoryBoard` and `describeMove`, and optionally `animateMove`
   - a `HistoryBoard` component: a read-only board for one public state from the history, with its `lastMove` highlighted. It receives `viewer` (a seat, or `null` for the table only), so a game with hands shows that player's hand
   - `describeMove.ts`: one line about the move that produced a public state, such as `Alice placed a wall`, shown as "Move 7 of 23: ..." in the history dialog
   - `faq.ts`: the FAQ items shown by the FAQ button
   - optionally an SCSS file (`<id>.scss`) whose rules are all nested in one `[data-game="<id>"] { ... }` block, so the game's colors never leak into other games or the landing page
   - optionally move animations: give the elements to animate a `data-anim-key` and call `useMoveAnimation(rootRef, gameState, animate)` (`src/animation/useMoveAnimation.ts`) in the game's screen, not in its `HistoryBoard`. It calls `animate({ previous, next, root, rectOf })` only when exactly one move was added, so the first render, a rejoin and an undo snap into place. `rectOf(key)` is where that keyed element was before the move. `slideFrom` and `fadeIn` (`src/animation/motion.ts`) last `MOVE_DURATION_MS` (300 ms), `slideFrom` can wait a delay first so pieces follow one another, and do nothing under `prefers-reduced-motion: reduce`. Nothing animates unless the game asks for it
3. Add one line to `games/registry.ts`: put the game in the `GAMES` array.
4. Add one line to `src/clientGames.ts`: put the client in `CLIENT_GAMES`.

The platform styles its own pieces by default (in `src/App.scss`): the game header with Back to games, History, FAQ and the theme toggle, the FAQ and history dialogs, and the undo vote panel. A game without CSS gets a neutral look in light and dark mode. To theme them, either:

- set any of these variables on `[data-game="<id>"]`: `--platform-page-bg`, `--platform-text`, `--platform-button-bg`, `--platform-button-hover-bg`, `--platform-button-text`, `--platform-panel-bg`, `--platform-panel-text`, `--platform-backdrop`; or
- write your own rules for the classes: `.game-root`, `.game-header`, `.back-button`, `.history-button`, `.faq-button`, `.theme-toggle`, `.overlay`, `.modal`, `.faq` (`dl`, `dt`, `dd`), `.history` (`.history-move`, `.history-slider`, `.history-board`), `.primary-button`, `.undo-vote`, `.undo-vote-panel`, `.undo-vote-title`, `.undo-vote-list`, `.undo-vote-actions`, and, for `DrawAndResign`, `.ending-controls`, `.ending-buttons`, `.draw-offer`, `.draw-offer-title`, `.draw-offer-actions` (the Confirm resign button also has `.danger`). The defaults have no specificity, so any rule scoped under `[data-game="<id>"]` wins. Quoridor and Azul do this.

Server code (`server/`, `shared/`, and the non-client files of a game) must not import from `src/` or any `games/<id>/client/`.
