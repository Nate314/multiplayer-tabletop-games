# Keyboard play for Shape Race and Jigsaw

Approved approach in conversation on 2026-11-15 (option 1: pick it up, then choose a target).

## Why

Shape Race and Jigsaw place pieces only by dragging with a mouse or a finger. A keyboard-only player (including a
screen reader user) cannot finish either game:

- Shape Race: Tab reaches the tray shapes and Enter turns one, but the holes are not focusable, so nothing can be placed.
- Jigsaw: the pieces are svg groups with pointer handlers only; nothing on the table is reachable from the keyboard.

Every other game already has a keyboard path. Tri-Tiles is the model: its lit spaces are `role="button"` polygons with
`tabIndex={0}`, an Enter/Space handler and a label like "Space 3 of 7" (`games/tritiles/client/Board.tsx`).

## Goals

- A keyboard-only player can finish a Shape Race board and a Jigsaw, at a pace that keeps up in a timed race.
- Each step is announced sensibly to a screen reader.
- Pointer play (mouse, finger, tap to turn) is unchanged.

## Non-goals

- No server, rules or message changes: keyboard play sends the actions a drag already sends.
- No keyboard way to leave a Jigsaw piece loose at an arbitrary spot on the table (the cost of this approach; a mouse
  player can still arrange pieces anywhere).
- No hints: a keyboard player is not told which hole or spot is right before trying it, any more than a mouse player is.
- No other games.

## Anti-goals

- A keyboard path that changes what a tap or click does.
- Keys that fire while the player is typing in an input (chat, names).

## Approaches

1. **Pick it up, then choose a target (picked).** Enter picks a piece up, Tab or the arrow keys move through the targets,
   Enter drops, Escape puts it back. Fast, matches Tri-Tiles, reads well with a screen reader. Cost: Jigsaw keyboard
   drops land only on board spots.
2. Arrow keys slide the held piece and Enter drops it. Copies the mouse exactly, loose placement included, but slow, and
   hard to judge without seeing it. Hurts most in the timed race.

## Design

### Shared behavior (both games)

- **Pick up:** Enter or Space on a piece the player can move picks it up. It shows as held (the same look as a piece
  being dragged, sitting in place) and focus moves to the first target.
- **Targets:** while a piece is held, the targets are focusable `role="button"` elements, in reading order (row by
  row). They are one tab stop (a roving tabindex): the arrow keys move to the neighbouring target in that direction on
  the grid (no wrap), and Tab leaves the board. Targets are not focusable while nothing is held. *(My call: Jigsaw has
  up to 150 spots, so one tab stop per target would be too slow.)*
- **One hold at a time, kept apart from the drag** *(my call)*: the keyboard hold is its own state, separate from the
  pointer drag state, so the existing drag effects (`lost`, `cancel`) are untouched. A pointer press on any piece while
  a keyboard hold is active cancels the hold first (as Escape would), then the press works as today. Enter on another
  piece while one is held does the same: the first goes back, the second is picked up. Focus leaving the board (Tab,
  a click elsewhere) keeps the hold; Escape, a drop or a lost hold ends it.
- **Screen reader exposure** *(my call)*: the board svg (`RaceBoard`, the Jigsaw table) is `role="group"` with its
  label while it has focusable targets or pieces, since children of `role="img"` are hidden from screen readers. A
  read-only board (History) stays `role="img"`.
- **Drop:** Enter or Space on a target sends the same action a pointer drop on that target sends. Focus then returns to
  the tray (Shape Race: the next unplaced shape; Jigsaw: the next liftable piece), so play continues without the mouse.
- **Cancel:** Escape puts the piece back where it was and returns focus to it.
- **Turn:** R turns the held piece (Shape Race: the `turn` action; Jigsaw: its existing R handler, only when the
  Rotation house rule is on). Ignored while focus is in an input, textarea or select, and with Ctrl, Meta or Alt.
- **Lost hold:** anything that ends the hold from outside (the race ends, a pause (`paused` in the public state), an
  undo vote, someone else takes a Jigsaw piece, an error) drops the keyboard hold the same way it ends a drag, and focus
  returns to the tray.
- **Announcements:** a polite live region says what happened: "Kite picked up. Choose a hole, R turns it, Escape puts it
  back", "Kite placed", "That shape does not fit there", "Piece put back".

### Shape Race

- **Key change:** Enter or Space on a tray shape now picks it up instead of turning it. A tap or click still turns it
  (the click that a keyboard Enter would also fire must not turn it; tell the two apart in the handler). R turns the
  held shape. The tray hint for keyboard users becomes "Enter picks a shape up, R turns it, then choose its hole".
- **Targets:** every empty hole on "Your board". Label: "Hole N of M, <shape name>" (the hole's shape is already
  visible to sighted players).
- **Drop:** if `fits(layout, placed, shape, hole, turns)` it sends `place` and shows the shape landed, exactly like a
  pointer drop; otherwise nothing is sent, the shape stays held, focus stays on the hole, and the live region says "That
  shape does not fit there".

### Jigsaw

- **Pieces:** the liftable pieces (`canLift`) are `role="button"` and one tab stop (a roving tabindex), in piece-index
  order: the arrow keys step to the previous or next liftable piece, Tab leaves the table. A piece someone else holds,
  or a placed one, is not in that order. Label: "Piece N, loose" or "Piece N, loose, turned 90 degrees" (no picture
  description). *(My call: 150 tab stops would be too slow.)*
- **Pick up:** sends `pickUp`, as a drag start does, and sets the touched piece so the turn handle shows.
- **Targets:** the board spots (`.jigsaw-spot`, one per cell). Label: "Spot row R, column C".
- **Where it would go** *(my call)*: the held piece is drawn at the focused spot, the way a dragged piece follows the
  pointer, so a sighted keyboard player sees the fit before dropping. The spot also gets the focus outline.
- **Drop:** sends `drop` with that spot's home x, y, and shows the piece there until the state answers (the existing
  `landing` logic). The server snaps it when it is the piece's home and unturned; otherwise it lands loose on that spot,
  as a mouse drop there would. The announcement waits for that answer: "Piece N placed" once the piece arrives placed,
  or "Piece N left loose at row R, column C" once it arrives loose.
- **Cancel:** sends `drop` at the position the piece was picked up from, so the server releases it, using `landing` so
  it does not flick. *(My calls: a turn made during the hold stays, as it does when a mouse player drops a piece back;
  a pick-up in the lobby starts play just as a mouse lift does; in the rare case the piece was lying unturned within
  snap distance of its home, the cancel snaps it, which is the correct result anyway.)*
- **Zoom:** the focused target scrolls into view inside the zoomed table.

## Left to the builder

- Where the shared keyboard logic lives (a hook in `src/` or `shared/`, per the shared-code rule, if both games use it;
  otherwise in each game's client).
- Focus outline styling, matching the existing focus styles.
- The exact way to tell a keyboard Enter's click from a tap in Shape Race.
- E2e tests in `e2e/shaperace.spec.ts` and `e2e/jigsaw.spec.ts` that finish a small board with the keyboard only.
