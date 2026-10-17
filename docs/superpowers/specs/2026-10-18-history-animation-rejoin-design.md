# History, Animation, Rejoining and Polish: Design

Date: 2026-10-18
Repo: `Nate314/multiplayer-tabletop-games` (one new PR against `master`)
Builds on: `docs/superpowers/specs/2026-10-17-multiplayer-tabletop-games-design.md` and the code merged in PR #1

## Intent

The combined site works. This round makes it nicer to play with friends and fixes rough edges:

1. Credit the two original repos.
2. Use American spelling everywhere.
3. Let any player look back through every move of the game, not only the last one.
4. Animate moves so the board changes smoothly instead of jumping.
5. Link to the GitHub repo from the app.
6. Let a player who drops out (refresh, closed tab, dead battery, or "Back to games") get back into their seat, unless the others vote to dismiss them.

Everything goes in one PR.

## Goals

- All six features above, working for both Quoridor and Azul.
- History and rejoining are platform features: a new game gets them through the platform, needing only the game-specific pieces listed under "What a game provides".
- Animations are per game, built on a shared platform helper so a new game can add its own with little code.
- Both games otherwise look and play as they do now.

## Non-goals

- Accounts or any proof of identity.
- Spectators.
- Persisting games across a server restart.
- Animating undo, the history dialog, or the board on first load or rejoin.
- Credits in the app UI (README only).

## Anti-goals

- A player loses their seat because of a refresh, a dropped connection, or clicking "Back to games".
- The history dialog leaks hidden information (Azul's bag, lid, round bookkeeping).
- Browsing history changes anything any other player sees.
- Animations make the game feel slow, or ignore the operating system's reduced-motion setting.
- A new game must edit platform code to get history or rejoining.

## 1. Inspirations credit (owner's decision)

README only. Add a short "Inspirations" section linking `https://github.com/Nate314/quoridor` and `https://github.com/Nate314/azul`, saying both are deprecated and this repo grew out of them. Nothing in the app.

## 2. American spelling (owner's decision)

Replace British spellings with American ones in everything tracked in the repo: UI text, FAQ text, error and status messages, tests that assert those messages, code identifiers, comments, CSS, README, and docs (including the earlier spec and plan). Found today (about 65 occurrences): colour, colours, coloured, centre, centred, cancelled, behaviour, neighbours. The builder searches for other British forms too (for example -ise/-isation, grey, favour, labelled in prose).

Exceptions: `aria-labelledby` (an HTML attribute name) and existing commit messages.

## 3. GitHub link (owner's decision)

A round button with the GitHub mark, styled like the theme toggle and placed next to it, on the landing page and on every game screen. It links to `https://github.com/Nate314/multiplayer-tabletop-games`.

My calls: the mark is inline SVG (no dependency, no external request); the link opens in a new tab with `rel="noopener noreferrer"`; it has an accessible label such as "View source on GitHub"; it follows the light/dark theme.

## 4. Move history dialog

Owner's decisions:

- History is browsed in a dialog separate from the game board, opened from a button on the game screen.
- The slider runs from the first move to the last move, and the dialog opens on the last move.
- Opening the dialog fetches the history with HTTP GET request(s), separate from the WebSocket game updates.
- Each step shows a read-only copy of the whole board as it was right after that move, with that move highlighted the way Quoridor's "Show Last Move" highlights today (Quoridor: the pawn's from and to squares, or the wall just placed; Azul: the factory or center the tiles came from and the pattern line or floor line they went to), plus a line such as "Move 7 of 23: Alice placed a wall".
- Browsing changes nothing for other players.

My calls:

- The server already keeps, for undo, the state before every move. The history is those states after each move: every entry after the first, plus the current state. Each state already carries the game's `lastMove`, which is what gets highlighted.
- Every state the endpoint returns goes through the game's `toPublicState`, exactly like WebSocket updates. Azul's bag and lid never leave the server.
- Anyone who knows the game type and game ID can fetch the history, the same as anyone can join or watch that game today. If the game does not exist the endpoint returns 404.
- History exists only while the game does. An undone move disappears from history (it was popped). Azul's "Continue" acknowledgements are not moves and add no steps; the round-end scoring is part of the move that emptied the table, so it shows on that step.
- The dialog shows the history as of when it was opened. It does not live-update; closing and reopening refreshes it. A game with no moves shows a short "No moves yet" message and the button may be disabled.
- The GET route lives under `/api/...` and is registered before the SPA fallback. Its exact path and whether it returns all steps in one response or one step per request are the builder's call; one request returning every step is fine at these game sizes.
- With N moves the slider has N steps: step k is the board right after move k. There is no step showing the board before the first move. After an undo, numbering simply reflects the remaining moves.
- A step shows the full public state after that move. For Azul, the move that emptied the table shows the scored walls; the round summary panel and every control are hidden or disabled in the read-only view.
- The "Move 7 of 23: ..." text is built from that step's state alone (its `lastMove` and player names).
- Keyboard: the slider is a native range input, so arrow keys step through moves; Escape closes the dialog.

What a game provides: a read-only board view that renders a given public state with its `lastMove` highlighted, and a one-line description of a move (for the "Move 7 of 23: ..." line). Quoridor and Azul already render `lastMove` highlights, so their board components are reused with interaction turned off; the builder decides the exact `ClientGame` addition.

## 5. Move animations

Owner's decisions:

- Quoridor: the pawn glides from its old square to its new one, including jumps.
- Azul: the picked tiles slide from the factory or center to the player's pattern line.

Agreed in playback (my proposals, approved):

- Quoridor: a newly placed wall fades or drops into place instead of popping in.
- Azul: tiles that do not fit slide to the floor line; tiles left in a factory slide to the center; at the end of a round, the tile from each full pattern line slides onto the wall. The round-end animation is the largest piece; the plan may order it last.
- Every player sees every animation, including the player who moved.
- Each animation is short, about 300 ms.
- With `prefers-reduced-motion: reduce`, pieces move instantly.
- Undo snaps back with no reverse animation. The history dialog does not animate. The first render of a game and a rejoin do not animate.
- The platform provides a shared helper (for example a hook or utility for animating an element from its old position to its new one) so each game's animations stay small. Each game decides what animates; nothing animates automatically.
- No animation library: CSS transitions and the browser's own APIs only.
- My call: animations are worked out in the browser by comparing the previous and new public state (plus `lastMove`); the server sends no extra animation data. Dealing a new Azul round after "Continue" is not animated.

## 6. Disconnecting and rejoining

Owner's decisions:

- A refresh, closed tab, lost connection, or clicking "Back to games" all count the same: the player's seat is held, not given up. To the other players they all look like "Alice disconnected".
- The game waits when it reaches a disconnected player's turn.
- Azul's round summary does not wait for disconnected players: a disconnected player counts as having clicked Continue, so the next round is dealt once every connected player has clicked it. This includes the moment a player disconnects while the summary is open and everyone else has already clicked. A player who comes back finds the next round already dealt. Because the disconnected list is platform state, the game's rules can read it; the builder decides whether the platform also needs a hook (like `onPlayerLeft`) so the game can react the moment someone disconnects.
- The other players can vote to dismiss a disconnected player.
- Rejoining is by entering the same game ID and the same name, from any device. Anyone typing "Alice" can take Alice's held seat; that is intended, so a player whose battery dies can come back on another device.
- After clicking "Back to games", the game list shows a button like "Back to Azul (friday)" that rejoins with one click.

Agreed in playback (my proposals, approved):

- Names are matched ignoring case (after trimming, as today).
- After a refresh, the page remembers the game and rejoins automatically.
- A disconnected player's seat, pieces and name stay, shown as disconnected. Play continues until their turn, then waits.
- Before the first move, a disconnect frees the seat right away, as today.
- A dismiss vote can be started by any connected player against a disconnected player. It passes only if every connected player approves; one decline cancels it (like the undo vote).
- A dismissed player is out for good: their turns are skipped, they cannot rejoin ("You were removed from this game"), and if one player is left, that player wins. This is today's mid-game leave behavior.
- Undo votes count only connected players.
- If every player is disconnected, the game is kept for 10 minutes so people can come back, then deleted. A rejoin cancels the countdown.

My calls (a builder may refine these without changing what gets built):

- Detecting dead connections: a dropped device (dead battery, lost network) may not close its socket cleanly. The server pings sockets (the `ws` ping/pong pattern) and treats one that stops answering as disconnected within about 30 seconds.
- Joining with the name of a player who is still connected is refused ("Alice is already in this game"). Because of the heartbeat, a dead device frees its seat for rejoining within about 30 seconds.
- Names are unique within a game, ignoring case, so rejoining is never ambiguous. Joining the lobby with a name already taken there is refused. This is a small change: today two players may share a name.
- A rejoining player gets the same seat number, so their pawn color, board and turn order are unchanged.
- A new name still cannot join after the first move ("Game already in progress").
- An undo restore keeps the current disconnected list, as it keeps the current player list today.
- With exactly one connected player, an undo still needs two connected players ("Not enough players to vote"); a dismiss vote with one connected player passes as soon as that player starts it.
- After the game is over, disconnecting and rejoining work the same; no dismiss is needed.
- Status lines follow the existing style, for example "Alice disconnected", "Alice is back", "Waiting for Alice to reconnect", "Bob wants to dismiss Alice", "Alice was dismissed". Exact wording is the builder's call.
- The browser remembers only the most recent game (game type, game ID, name), in `localStorage`. On page load, if the player was in that game when the page went away, it rejoins automatically; if they had clicked "Back to games", the list shows the "Back to <Game> (<id>)" button instead. If a rejoin fails (game gone, dismissed), the remembered game is forgotten and the error is shown on the list.
- Data model: `activePlayers` keeps meaning "still in the game", so held (disconnected) seats stay in it and turn order does not skip them. The platform adds a list of disconnected seats to its state. Dismissal is today's mid-game removal from `activePlayers`. A lone connected player whose opponents are all disconnected does not win; only dismissing them does.
- Votes: only one vote (undo or dismiss) is open at a time. While a dismiss vote is open, moves and other votes are refused, as during an undo vote. A vote re-resolves over the remaining connected players when a voter disconnects, as a vote re-resolves today when someone leaves. A dismiss vote is cancelled if its target reconnects. If the player who requested an undo disconnects, the undo vote is cancelled.
- Name details: uniqueness applies in the lobby too. A rejoin keeps the original display name's capitalization. If two devices rejoin the same seat at once, the first wins and the second is refused.
- After a refresh, the old socket may still look connected for a moment. The browser retries an automatic rejoin a few times over a few seconds before showing "already in this game".
- Every platform state sent to browsers says which seats are disconnected, so both games can mark them (for example a dimmed name with "(disconnected)"). The UI shows a dismiss button next to a disconnected player's name, and a vote panel like the undo vote panel.

## Constraints

- Same stack, no new runtime or dev dependencies.
- No em-dashes in any prose, UI text, comments or commit messages.
- Platform/game split from the first spec holds: server code never imports from `src/` or any `games/<id>/client/`; game CSS stays scoped under `[data-game="<id>"]`; platform UI keeps its `:where()` default styles.
- Every state that reaches a browser, by WebSocket or HTTP, goes through the game's `toPublicState`.
- Existing tests keep passing, with message-string updates for the spelling change. New platform behavior (disconnect, rejoin, dismiss, empty-game timer, history endpoint) gets tests against the fake test game; game-specific pieces get tests where they have logic.
- Browser-test before calling it done: both games, at least two tabs, at desktop and phone widths, light and dark mode. Cover the history dialog, the animations (and reduced motion), refresh-and-rejoin, "Back to games" and the one-click rejoin button, rejoining from another tab with the same name, waiting on a disconnected player's turn, and a dismiss vote.
- One branch, one PR, CI green.

## Left to the builder

- The exact HTTP route and response shape for history.
- The exact `ClientGame` additions for the read-only history board and the move description.
- The shared animation helper's API.
- Where the history button and dismiss controls sit on each game screen, within each game's current style.
- Timer and heartbeat implementation details, within the numbers above.
- Splitting the work into tasks and their order.
