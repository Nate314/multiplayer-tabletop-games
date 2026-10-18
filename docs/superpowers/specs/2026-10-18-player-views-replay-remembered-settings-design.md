# Player Views, Replay and Remembered Settings: Design

Date: 2026-10-18
Repo: `Nate314/multiplayer-tabletop-games`, same PR as round 1 (#4, branch `history-start-saved-games`)
Builds on: `docs/superpowers/specs/2026-10-18-history-start-persistence-export-design.md` (round 1, already built on the branch)

## Intent

Three additions, all in PR #4 (owner's decision):

1. A downloaded game file holds what each player saw, their own hand included. Anyone opening the file can watch the game as any player, and switch between players at any point.
2. The History dialog gets an "Animations" checkbox, so stepping forward one move glides the pieces like a live game. It also gets a Play button that steps through the game on its own.
3. The browser remembers the animations setting, plus the name and game ID last used to join, and fills them in next time.

The point of 1 is the same sharing as round 1, made richer: someone reviewing a Uno or Scrabble game wants to see why a player made a move, which needs that player's hand.

## Goals

- Works for all ten games. Games with hands (Uno, Phase 10, Scrabble) show the chosen player's hand. Every game draws the board from the chosen player's seat, the way that player saw it live (for example chess flipped for black).
- Old files (version 1) still open, with table-only viewing.
- No new npm dependency.

## Non-goals

- Seeing hands in the live in-game History dialog, during or after the game (my guess, stated to the owner, not objected to). It stays table only, so it can't be used to peek.
- Showing what no player ever saw: Azul's bag and lid order, Uno's and Phase 10's draw piles, Scrabble's tile bag. The file holds each player's own view, not the full game state.
- A speed control for Play. One fixed speed for now (owner's decision).

## Anti-goals

- Hidden information reaches anyone before the game is over.
- A malformed or hand-edited file breaks the page (round 1's error boundary keeps applying).
- Playback that fights the user: Play running on after they grab the slider in a way that feels broken, or animations stacking up.

## 1. Player views in the file

**Building the file moves to the server.** Round 1 built the file in the browser from the table-only steps. Now the per-player views need the full states, which only the server has (`room.history` and `room.timeline` hold full states). So a new endpoint, for example `GET /api/game-file/<type>/<id>`, returns the finished file. The client's Download button fetches it and saves it (my call on the endpoint name).

- The server refuses with an error while `room.state.isGameOver` is false. The Download button is still only shown when the latest step is game over.
- Like the History endpoint, it needs no credentials: anyone with the game ID can download a finished game's file (owner's decision).
- Undo stays allowed after a game ends, as today (owner's decision). So players could download the file, vote to undo the final move and play on knowing every hand. That risk is accepted and noted in `docs/architecture.md`.
- Actions that never reach the timeline (for example Uno's catch penalty or a round acknowledgement) have no step of their own, as in round 1. Phase 10 sorts hands in the browser, so a replayed hand's order may differ from what the player saw. Both are acceptable (my call).
- Each step carries the table view it has today (`viewer: null`) plus one view per seat, from `toPublicState(state, false, seat)` with the same `moveCount` and `historyStep`. The seats are every seat in that step's `playerNames` (my call). For a seat that has left by that step, the game's view simply shows whatever it shows a seated-out player.
- The end step (round 1) gets per-seat views the same way, from the live state.
- The file `version` becomes 2. Exact shape left to the builder, for example each step as `{ ...tableView, views: { "1": seatView, ... } }`, as long as the table view stays the step itself, so v1-reading code paths keep working.
- `parseGameFile` accepts version 1 and 2. A v1 file opens with the picker hidden.

**Viewing a file.** The History dialog for an opened file gets a "View as" picker above the board: "Table only" first, then each player by name (from the start step's `playerNames`). It starts on "Table only" (my guess). The picker can be changed at any step, and the board switches in place without moving the slider (owner's decision). The chosen player stays selected while the slider moves or Play runs.

**Drawing a chosen player's view.** Each game's `HistoryBoard` takes a new `viewer: Seat | null` prop (null for table only) and passes it to the board pieces it already shares with its game screen, so:

- Uno, Phase 10 and Scrabble show that player's hand, read only, nothing clickable.
- Every game draws from that player's seat as their live screen does (chess and checkers flip for the second player, seat rings start at that player where a game does that today).
- The last-move highlight and "(you)" style markers follow the game's existing rules for a viewer. The builder checks each game and drops anything that reads oddly in a replay, such as "Your turn".

This means each game's `HistoryBoard` file changes, unlike round 1.

## 2. Animations and Play

**Animations checkbox.** In the History dialog's controls, in both the live History and an opened file (my call). Off by default, then remembered (section 3).

- When on, a step that moves forward by exactly one move animates with that game's own `animateMove`, via the existing `useMoveAnimation` (which already only animates when `moveCount` goes up by one). Going backward, jumping several steps, start to start, the last move to the end step (same `moveCount`), and switching "View as" never animate. They just change.
- `ClientGame` gains the game's `animateMove` so the dialog can use it. The builder checks each `HistoryBoard` renders the `data-anim-key` elements its `animateMove` expects. Round 1's error boundary is keyed per step, which remounts the board and would lose the measured positions, so the builder keeps the measured root outside anything that remounts per step.
- When off, behavior is round 1's.

**Play button.** Next to the slider. It moves forward one step at a fixed pace, then stops on the last step. While playing, it reads "Pause".

- Pace: one step every 1.5 seconds (my call), long enough for any game's move animation to finish.
- Works with animations on or off.
- Pressing Play on the last step starts from the start of the game (my guess, stated).
- Dragging the slider or changing "View as" while playing keeps it playing from the new spot (my guess, stated).
- Closing the dialog stops it.

## 3. Remembered settings

Saved in `localStorage`, every access wrapped so blocked or full storage never breaks anything (as `src/services/session.ts` does). Without storage the page works and simply doesn't remember.

- **Animations checkbox:** saved whenever it changes, and read when any History dialog opens.
- **Name and game ID:** saved when the player presses Join. When the page loads, the join box's name and game ID start filled with them. One pair for every game, as the join box already shares them across games today. They are kept separate from `lastGame` in `session.ts`, because `lastGame` is cleared when a player leaves, and these should outlive that (my call).
- Key names and the module layout are left to the builder.

## Docs and tests

- `docs/architecture.md`: the file now holds per-player views, the new endpoint, `HistoryBoard`'s `viewer` prop, and `animateMove` on `ClientGame`. README: viewing a saved game as any player, Play, and that settings are remembered. No em-dashes in any prose.
- Unit tests (`node --test`): the file endpoint refuses before game over; each step has a view per seat and the table view; a seat's view holds only that seat's hand (Uno or the test game); the end step gets views; the parser accepts v1 and v2 and rejects others; the settings storage reads defaults when storage throws.
- Browser checks (Chrome): finish a Uno game, download, open it, switch "View as" mid-slider and see each hand; the same for Scrabble or Phase 10; chess viewed as black is flipped; a v1 file still opens; animations on, step forward in a few games; Play through a short game, with and without animations, and grab the slider mid-play; reload and see the checkbox, name and game ID remembered. Check at a narrow and a wide window.

## Left to the builder

- The endpoint path, the exact v2 step shape, and where the picker, checkbox and Play button sit in the dialog, within the existing look.
- How each game hides anything that reads oddly in a replay.
- localStorage key names.
