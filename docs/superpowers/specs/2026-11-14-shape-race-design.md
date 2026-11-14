# Shape Race

## Intent

Add Shape Race (`shaperace`, display name "Shape Race"), a timed shape-sorting race in the style of Perfection, under a generic name. The owner wants it as one more game; no deeper driver.

## Goals, non-goals, anti-goals

- Goal: every player races the same board at once against one shared countdown.
- Goal: playable by dragging on a phone.
- Non-goal: any trademarked name, art or branding.
- Anti-goal: a race decided by device speed or network lag rather than the player.

## Approaches

- **A. Everyone races at once (chosen by the owner).**
- B. Timed turns on a shared board, like Steady Hand. Rejected: players sit idle.
- C. Solo score attack only. Rejected: not multiplayer.

## Design

- **Race.** All players get the same holes and the same shuffled shapes. One countdown starts for everyone. First to fill their board wins; when time runs out, most shapes placed wins, equal counts share the place. Others' progress shows as bars ("Ana 12/16").
- **Players.** 1 to 8. Solo is a race against your own best time (`continuesAlone`).
- **House rules:**
  - Board size: 9, 16 (default), 25 shapes.
  - Timer: 30, 60 (default), 90 seconds.
- **Placing.** Drag a shape onto a hole; it drops in only for the matching shape within a rotation tolerance, otherwise it springs back. Shapes start at a random rotation; tap to rotate a step. Placements are out-of-turn moves the server validates; the server owns the countdown through the platform `deadline`/`onDeadline`.
- **Pop.** At the deadline the boards spring up and the unplaced shapes scatter (client animation), then a results screen shows places and times with Race again.
- **Watching.** Spectators and the table screen show every board side by side.
- **Undo.** Off (`allowsUndoVote` false), as in the other live games such as Jigsaw and Sudoku.
- **Leaving.** The race continues for the players left.
- **Look.** Shapes and board as SVG; dragging follows Steady Hand's pointer handling.
- **Docs.** README with Rules and Controls, plus a FAQ.

## Calls made by Claude (owner approved the summary)

1-8 players, board sizes and timers, rotation by tapping, server-owned clock, pop animation, side-by-side spectator view, undo off, leaving.

## Left to the builder

The shape set, the rotation step and tolerance, board layout per size at phone width, the pop animation, and how Race again restarts (a new game in the same room, as other games do after game over).

## Settled after the builder check (Claude's calls)

- **Solo.** No stored personal best. A solo race shows your time; you win by filling the board before the pop. This replaces "a race against your own best time" above.
- **Close finishes.** Server arrival order decides; no client timestamps. Finishes the server receives in the same tick share the place.
- **No own-move undo.** A wrong drop already springs back, so there is no `undoOwn` either.
