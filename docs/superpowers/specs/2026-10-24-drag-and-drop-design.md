# Drag and Drop Design

## Intent

Moving pieces and tiles should feel like the table: pick it up and put it down. Players use both phones and computers.

## Goals

- Drag and drop with mouse and touch for the games below, alongside today's click-to-move
- A piece tray for games where you place pieces from your supply (walls, roads, settlements, meeples, armies), used like a hand: drag from it, or tap to select and then tap a spot

## Non-goals

- Dominoes (its drag and drop is built in the Dominoes layouts PR, because that PR redraws the board)
- Games where you only pick something: Mancala pits, Monopoly, cards played from a hand, Ticket to Ride routes, Catan trades
- Dragging on another player's turn, except rearranging your own rack (below)

## Anti-goals

- A tap that used to work now starts a drag, or a phone page that can no longer scroll
- Click-to-move stops working

## Behavior (decided)

- Built on pointer events, with no library. A drag starts only after a small movement, so a tap stays a tap and the page still scrolls on a phone
- While dragging, the piece follows the pointer and the legal drop spots light up, using the same highlights a click shows today
- Dropping on a legal spot makes the same move a click would. Dropping anywhere else snaps the piece back
- Only when the move is yours. Off-turn, pieces do not lift, except that you can rearrange your own rack in Scrabble and Rummikub at any time, and the Catan tray works during your special build phase chance (added when combined with the Catan PR)
- The existing buttons keep working

## Games (decided)

- Chess and Checkers: pieces
- Backgammon: checkers; Parchisi: pawns
- Quoridor: the pawn, and walls from the tray
- Scrabble: rack tiles onto the board, tiles placed this turn back to the rack or to another square, and rearranging the rack
- Rummikub: tiles between your rack and the table and between sets on the table
- Carcassonne: the drawn tile onto the board, and meeples from the tray onto the tile just placed
- Connect Four: a disc dropped on a column
- Catan: roads, settlements and cities from the tray
- Risk: armies from the tray onto your territories while placing

## Piece tray (decided)

- Shown like a hand: the pieces you have left to place, with counts
- Drag a piece onto a lit-up spot, or tap it to select it and then tap a lit-up spot
- Quoridor walls: rotate with a Rotate button, a second tap on the selected wall, or the R key; the legal slots for the current orientation light up
- Catan: pieces you cannot afford or have no legal spot for are dimmed; dropping one builds it and pays, exactly like the build buttons
- Ticket to Ride stays click-to-claim (a route is not one piece)

## Constraints

- No new dependencies
- Accessible: everything stays possible with click or tap alone, and keyboard play that exists today keeps working
- Moves still go through the same messages; the server learns nothing new
- Check at phone width and a wide width, light and dark mode
- Styles in SCSS, matching PR #21
- Tests: unit tests for the shared drag logic; at least one e2e drag test per game using Playwright's mouse API, plus one touch test
- `docs/architecture.md`, the README and each game's README Controls section and FAQ are updated

## Left to the builder

- A shared drag hook or component in `src/` that every game uses (one implementation, not one per game)
- The drag image, drop highlight and tray look per game
