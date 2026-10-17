# Multiplayer Tabletop Games: Design

Date: 2026-10-17
Repo: `Nate314/multiplayer-tabletop-games` (private, new)
Sources: `Nate314/quoridor` and `Nate314/azul`

## Intent

Quoridor and Azul are two separate repos built on the same stack, with the same folder layout and much of the same code: joining, seating, undo voting, the WebSocket plumbing, Docker and CI. Keeping that plumbing in two places is already causing drift, and the owner wants to add more games (chess and Scrabble were named). This repo combines both games into one site, with the shared plumbing written once, so that a new game is mostly its own rules and board.

Success has two parts:

1. Both games play exactly as they do today, from a single site.
2. Adding a third game means adding that game's own code plus one registration entry, with no edits to the platform (server, lobby, join dialog, undo voting, Docker, CI).

## What exists today (from reading both repos)

- Stack in both: React 19, Vite 6, TypeScript 5.9 in the browser; Express 5 and `ws` on one port; Node 22.18+ runs the server's `.ts` files directly (no server build); `node --test` for tests; ESLint 9; Docker multi-stage build; `docker-compose.yml`; `run.sh`/`run.ps1` stubs backed by the `compose-launcher` git submodule and a `run.conf`; GitHub Actions CI (lint, test, build) on PRs and pushes to `master`.
- Byte-for-byte identical: `JoinForm.tsx`, `UndoVote.tsx`, `ThemeToggle.tsx`, `Game.tsx`, `useGameConnection.ts`, `main.tsx`, `Dockerfile`, `docker-compose.yml`, `vite.config.ts`, `eslint.config.js`, CI workflow, `.gitmodules`.
- About 95% identical: `server/server.ts`, `server/games.ts` (in-memory game manager: join, leave, move, undo history, undo voting), `shared/messages.ts`, `src/services/gameService.ts`.
- Per game: `shared/rules.ts`, `shared/types.ts`, the board components, `GameScreen.tsx`, `GameStatus.tsx`, `Faq.tsx`, `App.css` (each about 665 lines, each defining its own palette as CSS variables on `:root`, with light and dark variants under `:root[data-theme="dark"]`).
- Each game's rules module already exposes the same shape: `createGameState`, `addPlayer`, `removePlayer`, `applyMove`, `nextActivePlayer`. Azul adds `toPublicState` (hides the bag and lid from browsers) and `acknowledgeRound` (everyone confirms the round summary before the next round is dealt).
- Drift between the two: Azul reads `PORT` from the environment, Quoridor hardcodes 3000. Azul has a public-state step, Quoridor sends its whole state. The FAQ button works differently (Quoridor's `Faq` renders its own "?" button; Azul's `App` owns an "FAQ" button and passes `onClose`). Quoridor's `index.css` still carries Vite starter styles that Azul removed.

## Goals

- One site, one server, one port, serving both games.
- A landing page that lists the games; picking one opens a join dialog.
- Both games keep their current rules, screens, controls, FAQs and visual themes.
- Platform concerns are written once and shared by every game.
- A clear, documented way to add a game.
- The existing tests for both games come across and pass; CI keeps running lint, tests and build.
- Docker, `docker compose up --build`, and the `run.sh`/`run.ps1` launcher keep working as they do now.

## Non-goals (not now)

- Hiding different information from different players (for example, Scrabble racks). Today only "hidden from everyone" exists (Azul's bag). The structure should not make per-player views hard to add later, but nothing is built for it until a game needs it.
- Spectators, accounts, persistence across server restarts, matchmaking, chat.
- Chess, Scrabble or any third game. They are the reason for the structure, not part of this work.
- Changing either game's rules or gameplay.

## Anti-goals (would count as failure even if it works)

- Adding a game requires editing the server, the lobby, the join dialog, undo voting, or the Docker/CI setup.
- One game's styles leak into the other game or into the landing page.
- Either game plays differently than it does today, or loses a feature (undo voting, last-move highlight, round summary, FAQ, theme toggle, leaving mid-game, four players).
- Platform logic (seating, undo) still duplicated per game.

## Decisions made by the owner

- **Repo:** new private repo `Nate314/multiplayer-tabletop-games`.
- **Landing page:** a list, one row per game: icon, name, one-line description, player count (layout "B" from the mockups). Adding a game adds a row.
- **Join flow:** clicking a row opens a dialog titled "Join <game>" with name and game ID inputs, Cancel and Join. Same fields and limits as today's join form.
- **Styling:** each game keeps its own look (Azul's blue theme, Quoridor's wood theme), including their light and dark variants. No unified visual style is imposed on the game screens.
- **Old repos:** once this ships, `quoridor` and `azul` are marked deprecated with a pointer to this repo.

## Decisions made by me (Claude), confirmed in playback

- The site is titled "Multiplayer Tabletop Games", matching the repo name, until the owner picks something else.
- Game IDs are separate per game: Azul "friday" and Quoridor "friday" are different games.
- Once joined, each game's screen looks as it does today, with a way back to the game list.
- Where the repos drifted, keep the better version: `PORT` from the environment; a public-state step for every game (a game that hides nothing simply returns its state); Azul's cleaned-up base CSS; one FAQ button that behaves the same for every game, with each game supplying only its FAQ content.
- The FAQ stays readable before joining, as it is today: the join dialog has an FAQ button for that game, and the game screen has one too. Both use Azul's text "FAQ" button style, so Quoridor's "?" button changes to match. This is the one visible change to an existing game screen.
- Existing rules tests are ported to the new game interface with the same behavior covered, not kept byte-for-byte. Seating tests move to the platform's tests where seating logic moves to the platform.
- Azul's "acknowledge the round" becomes a general mechanism: a game can accept actions other than moves. Unlike moves, these are not turn-bound (any seated player may send one when the game allows it) and are not recorded in undo history. The server and protocol stay generic; no Azul-specific message type.

## The split between platform and game

**The platform owns:**

- Express static serving and SPA fallback, WebSocket server, message parsing and routing, broadcast.
- The in-memory game manager, keyed by game type and game ID.
- Joining, seating in join order up to the game's max, refusing joins after the game has started, leaving mid-game, deleting a game when its last player leaves.
- Turn rotation that skips players who left.
- Undo: the history of states before each move, requesting an undo, voting, applying it once every remaining player approves, and keeping the current player list and names when restoring.
- Calling the game's public-state step before anything is sent to a browser.
- The landing page, the join dialog, the connection hook and service, the undo vote panel, the theme toggle, the FAQ button and dialog frame, error display, and the "back to games" control.
- Docker, compose, launcher, CI, lint and TypeScript config.

**Each game owns:**

- Its metadata: id (used in code and messages), display name, one-line description, player count range, icon.
- Its state shape and types.
- Creating its starting state, applying a move (validating untrusted input from the network), any extra non-move actions, deciding when the game is over and who won, its status text, and its public view.
- What happens to its own state when a player is seated or leaves (for example, Quoridor places a pawn; Azul may need to rebalance factories). The platform handles the seating list itself.
- Its board components, game screen, status panel, FAQ content, and styles.
- Its rules tests.

The builder designs the exact TypeScript interface between the two. Requirements on it:

- The server holds a registry of games; the client holds a registry of game UIs. Adding a game is one entry in each (or one entry in a single shared registry if the builder finds a clean way to keep server code free of React imports).
- The server must never import client code, and the Docker runtime stage (which copies only server and shared code plus `dist`) must still work.
- State that reaches browsers goes through the game's public-state step without exception.
- Untrusted network input is validated by the game before use, as both rules modules do today.

## Styling

Both games currently define their palettes on `:root`, so loaded together they would overwrite each other. Each game's styles must be scoped so they apply only while that game is on screen (for example, under a per-game root class or `data-game` attribute; the method is the builder's call). The landing page and join dialog get their own neutral theme. The theme toggle keeps working everywhere: the landing page and both games each honor light and dark. The saved theme choice is shared across the site.

## Landing page and join dialog

- Header with the site name, the theme toggle, and nothing else needed.
- Rows, in registry order. Each row: icon, name, one-line description, player count as "2 to 4".
- Clicking a row (or pressing Enter on it) opens the join dialog for that game. Escape and Cancel close it.
- The join dialog has an "FAQ" button that opens that game's FAQ, so the rules can be read before joining.
- The dialog shows server errors (game full, already started, name missing) inline and stays open so the player can fix the input.
- After a successful join, the game screen replaces the landing page.
- "Back to games" leaves the current game (the server treats it like a disconnect: the player's pieces stay, their turns are skipped, as today) and returns to the list.
- Losing the connection returns to the list with the "Disconnected from server" message, matching today's behavior of returning to the join form.

Suggested descriptions (builder may refine): Quoridor, "Race your pawn to the far side and block opponents with walls"; Azul, "Draft colored tiles and decorate your palace wall".

## Constraints

- Keep the current stack and versions. No new runtime dependencies unless a game truly needs one; prefer none.
- Node 22.18+ via `.nvmrc`; server TypeScript still runs directly with no server build step.
- Default branch `master`. Work goes on branches and lands through PRs, matching the source repos' CI triggers.
- No em-dashes in docs, README, or commit messages.
- Browser-test both games end to end (at least two windows per game, a move, an undo vote, leaving) and the landing page at desktop and phone widths before calling it done.

## Repo contents at the end

- One `README.md` covering the site, setup, Docker, the launcher, network play, and each game's rules and controls (carried over from both READMEs), plus a short "Adding a game" section.
- `docs/architecture.md` describing the platform/game split, updated from both existing architecture docs.
- `run.conf` with a single URL line for the site.
- Fresh git history. The old history stays readable in the archived source repos.

## After it ships

Each old repo gets a README notice at the top saying it is deprecated in favor of `Nate314/multiplayer-tabletop-games`, then is archived on GitHub. These are outward-facing actions on the owner's repos; confirm with the owner before doing them.

## Left to the builder

- Folder layout (for example `platform/` and `games/<id>/`, or keeping `server/`, `shared/`, `src/` with a `games/` subfolder in each).
- The exact game interface and message shapes, within the requirements above.
- How styles are scoped.
- Icons for the landing rows.
- Whether the URL reflects the chosen game. Not required.
- How tests are organized, as long as both games' existing tests come across and the platform's manager logic has its own tests.
