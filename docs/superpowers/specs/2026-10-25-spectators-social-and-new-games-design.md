# Spectators, rematch, alerts, in-person play, stats, and two new games: design

Date: 2026-10-25

## Intent

The user plays these games with friends, usually over a Discord call, and wants them to work just as well in person. Today a finished game simply stops, nobody can watch, a background tab gives no sign that it is your turn, there is no way to find a game without a link, and nothing is remembered once a game ends. This changeset makes the site more fun to come back to: people can watch, play again, get pinged, react to each other, play around one phone or a TV, and look back at their record. It also adds Pictionary and Jenga.

Delivery (proposed by me, not objected to): one PR per feature below, each built in its own git worktree in parallel, then merged into one combined branch and PR, with the per-feature PRs closed (not merged), as in PR #37. The combined PR body follows the format of PR #37.

## Goals, non-goals, anti-goals

Goals:
- Every feature below, as described.

Non-goals (the user deferred these to a later round):
- Bots for empty seats.
- House rule variants beyond the turn timer described here.

Anti-goals (a failure even if it technically works):
- A spectator, or a pass-and-play neighbor, seeing a hand or private piece they were not allowed to see. Hidden information must never leak through any view, history, export, notification or stats.
- Stats about a game you did not play being visible to you, or anyone being able to clear someone else's data.
- A game becoming stuck: a vote nobody can finish, a rematch that never starts, a turn timer that blocks play.
- Breaking resume after a server restart, history playback or the existing export for any game.

## Constraints

- Follow docs/architecture.md: server, shared and non-client game files never import from `src/` or `games/<id>/client/`; game SCSS is nested under `[data-game="<id>"]`.
- No new npm dependencies, with one exception the user approved: Jenga may use three.js and Rapier (see below), loaded only with the Jenga chunk.
- Persistence uses the existing `node:sqlite` store (server/store.ts). Server settings are environment variables read in server/server.ts, next to `PORT` and `DATABASE_PATH`, and documented in the README.
- Every new picture or icon is a server SVG (shared/svg, `ServerSvg`), per the user's rule from PR #37. The one exception is reactions, which show the sender's chosen emoji as text.
- Update docs/architecture.md, README.md, affected game READMEs, the Rules/FAQ text, and add READMEs for the two new games.
- `npm run lint`, `npm test`, `npm run build` pass, and the full e2e suite for anything touching every game. Every UI change is checked in Chrome, light and dark, at desktop width and at 390 px and 320 px (iframes, since the Chrome window cannot be resized on this machine). Never use port 6000.
- No em-dashes in any prose, commits or PR bodies.

## The features

### 1. Spectators (branch `spectators`)

Decided with the user:
- Anyone can join a game as a spectator, through the same share link or the landing page join dialog.
- The join dialog gets a Player / Spectator switch at the top (mockup choice B). The main button reads Join or Watch to match. The switch remembers the last choice.
- A spectator sees the whole table, laid out as the normal table on top and a row of player names below (mockup choice B). Picking a name shows that player's hand at full size, or an Ask button if the spectator is not allowed yet.
- Ask sends that player a prompt: "Dana (watching) wants to see your hand", Allow or Don't allow. Only that spectator and that player are involved, like the undo vote. Allow lasts for the rest of the game. After a no, the spectator can ask again later.

Confirmed from my guesses:
- The presence bar shows "Watching: Dana, Eli" to everyone.
- A spectator can switch to playing only while the game is still in its lobby. Once started they keep watching; a rematch is their next chance to play.
- Joining a full or started game as Player says so and offers to watch instead.
- The ask rule covers everything private to a player, not just card hands: Ticket to Ride tickets, Catan development cards, the Scrabble rack, and so on.
- Spectators never vote: undo, dismiss, rematch or house rules.

Builder's notes:
- `toPublicState(state, undoAvailable, viewer)` takes one seat. A spectator view is the public view (viewer null) plus the private parts of each seat they were allowed. The builder chooses how: for example a per-game hook that returns one seat's private part, or calling `toPublicState` per allowed seat and taking that seat's hand. Whatever the shape, a test for every game must prove a spectator view with no permissions equals the history view's hidden information (nothing private).
- Permissions live in the room state so they survive a restart, and are cleared by a rematch (a new game).
- Spectators have no seat, so they need their own identity in the room (a spectator key, like `seatKeys`) for reconnects and for asking.
- Mockups: .superpowers/brainstorm/37174-1792941160/content/spectator-layout.html and join-dialog.html (gitignored; the descriptions above are the source of truth).

### 2. Game-over screen (branch `game-over`)

Decided with the user:
- Every game shows the same summary screen when it ends. How close the game was does not change it.
- It offers History (the existing history view, with its export) and Rematch (feature 3).

Confirmed from my guesses (mockup game-over.html):
- It shows the winner, or "Draw"; the game name, ID and length (rounds or moves); and final standings in that game's own terms (points in Hearts and Yahtzee, victory points in Catan, finishing order in UNO, winner and loser in Chess).
- Buttons: Rematch, History, See the table (closes the summary to look at the final board, with a button to reopen it), Back to games.
- The nine card games keep their round summary between rounds; the last round's summary is folded into this screen rather than shown first.
- Spectators see it without Rematch.

Builder's notes:
- Standings need a per-game source. The builder adds an optional game hook (for example `finalStandings(state)` returning rows of name, score text and place), falling back to `winners` when a game has no scores.

### 3. Rematch (branch `rematch`, builds on the game-over screen)

Decided with the user:
- Any player can press Rematch on the game-over screen. That opens a vote like the undo vote, where each player picks Join or Drop, so a subset of the players can keep going.
- The vote stays open until every player has answered. Players can vote to remove someone who is not answering.

Confirmed from my guesses:
- The presser counts as Join.
- Removing a non-responder reuses the existing dismiss vote, and counts them as Drop.
- Those who joined land in a fresh lobby for the same game at the same link and game ID. Those who dropped go back to the game list.
- If fewer join than the game needs, the lobby opens anyway and waits for more players.
- It is a normal lobby: open seats fill through the link until the first move; last game's house rules are the starting point and everyone agrees again; who goes first follows the game's normal rule.
- Spectators stay and keep watching. Hand permissions start fresh.
- If the vote fails (only possible if everyone drops), Rematch can be pressed again later.

Builder's notes:
- The finished game must remain viewable in History and is what stats record (feature 10) before the room is reset.
- My call (after the builder check): each finished game is archived under its own key, for example the game ID plus a rematch number (`fun1 #2`), and kept for 90 days. History, the export and Stats "recent games" links all point at the archived game, not the reused room.

Decided with the user after the builder check:
- History and the game file download (`/api/history`, `/api/game-file`) stay open only to people who were in the game, not to anyone who knows the game ID. That matters now because spectators and the open games list make IDs easy to get, and the file shows every hand at every step.
- "In the game" means its players and its spectators (the user confirmed spectators). Players prove it with their seat key (or, after the room is gone, their stats device ID); spectators with their spectator key, and they get the public steps plus only the hands they were allowed to see. Anyone else gets a "not available" error (my call on the wording and the key details).

### 4. Turn alerts (branch `turn-alerts`)

Decided with the user:
- A notification when it is your turn, when a vote is waiting on you, and when the game ends, including on a locked phone.
- The tab title reflects the game and how many players are in it.

Confirmed from my guesses:
- Notifications fire only when you are not looking at the game, so they never double up with the in-tab chime.
- Locked phones get real push notifications from the server. On iPhone this needs the site added to the home screen (Apple's rule), and the game says so when an iPhone user turns notifications on.
- A newer push replaces the previous one for the same game.
- The browser's permission prompt appears the first time you join a game, not on the landing page. A setting turns notifications off.
- Votes that notify: undo, dismiss, rematch, and a spectator asking to see your hand.
- Tab titles: lobby `Hearts · 2 of 4 players`; in game `Hearts · 4 players`; your turn `● Your turn · Hearts · 4 players`; a vote waiting on you `● Vote · Hearts · 4 players`. Spectators get the plain form. The landing page keeps its title.

Decided with the user after the builder check:
- The site may be served from anywhere, so build the full push support. Browsers only allow notifications, service workers and push over HTTPS or localhost. On plain http (for example `http://<ip>:3000` on a home network) the notification setting explains this and stays off, and the tab title alerts still work. The README says push needs HTTPS. HTTPS setup itself is not part of this changeset (my call).

Builder's notes:
- VAPID keys are generated on first start and kept in the sqlite store, so they survive restarts; the VAPID contact can come from an optional environment variable (my call).
- Web Push must be implemented without new packages. One option that avoids payload encryption: send pushes with no payload, and have the service worker fetch what to show from the server. VAPID signing works with `node:crypto`. The existing service worker (`sw.js`) is the place for the push handler. Push subscriptions are stored in the sqlite store per seat and are removed when the game ends or the seat is dropped.
- Clicking a notification opens or focuses the game's tab.

### 5. Open games list (branch `open-games`)

Decided with the user:
- Off unless an environment variable is set when the server starts. Off means today's behavior: people join with an invite link or a known game ID.
- When on, the landing page lists current games with player names and status, for example `Alice in the lobby` or `Alice, Bob currently playing Chess`, and shows each game's ID.

Confirmed from my guesses:
- The variable is `SHOW_OPEN_GAMES=true` and is documented in the README.
- A "Games happening now" section above the game list, hidden when empty, refreshing on its own.
- Tapping a lobby opens the join dialog with the ID filled in and Player selected; tapping a game in progress selects Spectator.
- Finished games and games every player has left are not listed. A game waiting on a disconnected player is still "currently playing".

Builder's notes:
- When the variable is off, the server must not serve the list at all (not just hide it in the client).

### 6. Reactions (branch `reactions`)

Decided with the user:
- Any player or spectator can react to any player during the game.
- Any emoji is allowed.
- A 15 second cooldown per sender.
- Reactions are saved in the game's history.

Confirmed from my guesses:
- Sending: tap a player's name in the presence bar, then pick from a row of your recent reactions or a box that opens the device's emoji keyboard (Win + . on Windows).
- The server accepts exactly one emoji (one grapheme that is an emoji) and refuses anything else, so this cannot become a chat.
- Shown as the device's own emoji (the one exception to the server SVG rule), beside the target's name for about 3 seconds as "Ann → Bo 😂", with a soft sound for the target. Spectators are labeled "(watching)".
- The cooldown shows as a countdown on the react button.
- History and export include reactions; playback shows them at the point they were sent.

Builder's notes:
- Reactions are not moves: they must not affect undo, the move count or turn order. The builder chooses how to record them alongside the history steps without breaking files exported before this change.
- The cooldown is enforced on the server.

### 7. Turn timer house rule (branch `turn-timer`)

Decided with the user:
- Every game gets an optional "Turn timer" house rule with a configurable time per turn.
- When time runs out it is only a warning. Nothing is forced.

Confirmed from my guesses:
- Off by default; choices 30 seconds, 1, 2 or 5 minutes.
- Chess and Scrabble keep their own clocks; the new timer is offered there too.
- The time left shows beside the current player in the presence bar, turns red for the last 10 seconds and uses the existing tick sound.
- At zero the current player gets a "Time's up" nudge with a sound, the others see "Bo is over time", and the timer keeps counting overtime ("+0:42"). The dismiss vote remains the tool for someone who has really left.
- It pauses while any vote is open.

Builder's notes:
- The platform's house rule list is per game (`options.ts`). The builder adds the timer once at the platform level, rather than 31 times.
- The existing `deadline` / `onDeadline` machinery records a move; a warning is not a move, so the builder must not reuse it in a way that puts timer events on the undo timeline.

### 8. Pass-and-play (branch `pass-and-play`)

Decided with the user:
- One device is passed around. Between turns the board shows only public information until the next player confirms they are holding the device.

Confirmed from my guesses:
- The join dialog gets a third choice, Pass and play, where you type two or more names. All those seats belong to that device.
- The handoff screen is the public table with a large "Pass to Bo" banner and an "I'm Bo, show my hand" button.
- The handoff also appears when someone must make a private choice out of turn (passing cards in Hearts, answering a Catan trade) and for votes, one player at a time.
- Mixing is allowed: other seats can still fill through the link from other devices.

Builder's notes:
- One connection holds several seats. The server already ties a seat to a seat key; the builder decides whether the device holds several keys on one socket or one socket per seat, as long as each seat's private view is only rendered after its handoff.

### 9. Shared table screen (branch `table-screen`, builds on spectators)

Decided with the user:
- A TV or laptop shows the table for everyone, with phones as hands.
- When a table screen is in the game, each player chooses on their phone whether to see the whole board and hand, or just their hand.

Confirmed from my guesses:
- The TV joins through a fourth join dialog choice, "Table screen": a spectator that never sees any hand and never asks.
- It fills the screen with the public table, presence bar, turn timer and reactions, sized to read from a couch.
- In the lobby it shows a QR code of the game link.
- It shows the game-over screen without Rematch.
- Phones show a "Board and hand" / "Hand only" switch only while a table screen is connected, defaulting to Hand only and remembered.
- Hand only shows your hand or private pieces, the actions you can take now, whose turn it is and your score. Each game gets its own trimmed layout; games with nothing private get the action controls and turn status.

Builder's notes:
- This touches every game (and Pictionary and Jenga), so it runs the full e2e suite. QR codes must be generated in-house (server SVG), with no package.

### 10. Stats and history (branch `stats`)

Decided with the user:
- A Stats page showing win rates per person, which games the group plays most, and similar.
- You only see stats from games you played in.
- You can clear only your own data.
- Devices can be combined by sharing a code or link.

Confirmed from my guesses:
- Identity: each browser gets a private random ID, kept on the device. The server records which IDs played each finished game. Spectators are not recorded. Pass-and-play records all its players under that device's ID, each by name.
- Recording: game, date, length, players, final standings and winner for each finished game. Abandoned games are not counted.
- People are shown by the name they typed, case-insensitive.
- The page: per person (games, wins, win rate, favorite game, current streak), per game (times played, usual length, high score where there is one), head to head between two names, and recent games linking to their History while it is still saved. Filters by game and time range (this month, all time). Everything is limited to games your ID played in, including people and head to head.
- Clearing removes you from every game you played; for the others your seat becomes "Former player". Your ID is replaced. It cannot be undone and says so.
- Linking: "Link another device" shows a one-time code and link (for example `/link/K7P-4QX`) as text and a server SVG QR code, valid for 10 minutes or one use. Using it merges that device's past games into yours and both share one ID from then on. Any number of devices; clearing applies to all linked devices and says how many.

Builder's notes:
- The device ID is a secret: it must never appear in any game view, history, export or the open games list. The server should store a hash or an internal ID, not the raw token, next to results.

### 11. Pictionary (branch `pictionary`)

Decided with the user:
- One person draws; everyone else guesses in a chat beside the drawing.
- The word shows as blanks across the top, like hangman.
- When all players have guessed, the next player draws.
- Before the game starts: the time per turn and the number of word choices (3 to 5) are configurable.
- The drawer picks one of the offered words.
- A correct guess shows in the chat as a highlighted "Alice guessed the word!" instead of the guess.

Confirmed from my guesses:
- A built-in word list on the server; guessers never receive it or the word.
- Blanks show spaces and hyphens.
- Players who have guessed can still chat, but only with others who have guessed.
- The turn also ends when time runs out, and then the word is revealed.
- A guess one letter off shows only to the guesser as "So close!".
- Tools: a few pen colors, three sizes, eraser, fill, undo and clear; mouse, finger or stylus; strokes reach everyone live.
- Each player draws a set number of times, 3 by default (a house rule), then the game-over screen.
- Spectators see the drawing, the chat and the word, and cannot guess.
- My call (after the builder check): a table screen is not an ordinary spectator here. It shows the blanks and the public chat only, never the word or the chat among players who have guessed, since the guessers can see the TV. Pass-and-play is not offered for Pictionary, because everyone guesses at once and the word would be on the device being passed.
- Points: guessers score more the faster they guess; the drawer scores for each correct guesser.

Builder's notes:
- Live strokes and chat are not moves; only the turn changes, guesses that score and the end of a turn need to be on the timeline. The builder decides what History shows for a turn (at least the finished drawing and who guessed).

### 12. Jenga (branch `jenga`)

Decided with the user:
- A 3D tower where each block has its own hidden stickiness or slickness.
- A physics engine drives pulls: a player tries to take a block out, can slide it back in and try another, like the real game.
- Built with libraries (the user's choice).

Confirmed from my guesses:
- A turn is pulling one block and placing it on top; then the next player goes.
- Whoever makes the tower fall loses; everyone else ties for the win.
- Everyone watches the pull live, and each viewer can turn the camera around the tower.
- The server runs the physics, so every screen sees the same tower and nobody can cheat a block loose.

My calls:
- three.js for drawing and Rapier for physics. Rapier gives the same result on every machine, so the server's simulation is the truth and each client can run a matching preview between server updates. Both are loaded only in the Jenga chunk (and in the server's Jenga module), never in the main bundle.

Builder's notes:
- The builder picks exact library versions and how pulls are input (drag on the block, with force from drag speed, is the expected feel), and how History replays a turn (at least the tower before and after).
- Hidden block grip must stay on the server; clients only learn it from how the block moves.

## Order and dependencies

- Spectators come before the table screen. The game-over screen comes before rematch. The join dialog is touched by spectators, pass-and-play and the table screen, so it should be merged in that order or given a shared shape early.
- Stats record from the game-over moment, so they rely on the game-over screen's standings hook.
- Pictionary and Jenga should get the game-over standings hook and the hand-only layout (or be marked as having nothing private) once those land.
- The builder may adjust the waves; the user only asked that everything ships in one combined PR.

## Left to the builder

Anything not stated above, including exact message names, state field names, layout details not covered by the mockups, word list contents, sound choices, and the database tables, as long as the anti-goals hold.
