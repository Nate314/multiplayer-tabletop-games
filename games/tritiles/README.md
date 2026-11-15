# Tri-Tiles

Lay triangle tiles so their corner numbers match, build hexagons and bridges for bonus points, and play out your hand, first to the target score (400 points unless the host chose another), for 2 to 6 players.

## Rules

- **Tiles.** 56 triangle tiles with a number from 0 to 5 at each corner: every combination of three numbers, each once. A tile's numbers read clockwise in rising order from the lowest, so 0-1-2 is in the set and its mirror 0-2-1 is not. Tiles turn on the board but are never flipped
- **Deal.** Each player is dealt 9 tiles with 2 players, 7 with 3 or 4, and 6 with 5 or 6. The rest form the pool, hidden from everyone
- **Opening.** Every round, the player holding the highest triple (5-5-5 first, then 4-4-4 and so on) opens with it and scores its sum plus 10; opening with 0-0-0 scores 40. If nobody holds a triple, the tile with the highest sum opens and scores its sum only
- **Placing.** A tile goes next to the tiles on the board, sharing at least one edge with one of them. Every corner it touches must match: the numbers along each shared edge, and the number at any point where it touches another tile only at a corner. A placed tile scores its sum
- **Hexagon.** A house rule, on by default. A tile that completes a hexagon, six tiles around one point, scores 50 more. Completing two hexagons with one tile scores 100 more
- **Bridge.** A house rule, on by default. A tile that matches an edge on one side and touches a tile only at the point across from that edge completes a bridge and scores 40 more
- **Drawing.** A player with no tile that fits must draw from the pool, one tile at a time, losing 5 points for each. You may draw at most 3 tiles a turn, and you may not draw while you hold a tile that fits. A drawn tile that fits may be played at once
- **Passing.** After 3 draws with nothing playable, the player passes and loses another 10 points (25 in all). With the pool empty and nothing playable, the player passes and loses 10
- **Going out.** A round ends when a player plays their last tile. They score 25 plus the sum of the numbers left in every other hand
- **Blocked.** A round also ends when the pool is empty and nobody can play. The player with the lowest sum left scores the difference between each other hand and theirs. If two or more players tie for the lowest, nobody scores
- **Winning.** A house rule sets the target: 200, 400 (the default) or 600 points. The target is checked only when a round ends. If anyone has reached it, the highest total wins, and equal totals share the win. A scoring screen shows each round, and the next round is dealt once every connected player has pressed Continue (disconnected players are not waited for)
- You see only your own hand, how many tiles each other player holds and how many tiles are in the pool
- **Leaving.** A disconnected player keeps their seat and the game waits for them on their turn. A dismissed player's tiles go back into the pool and their turns are skipped. If only one player is left, they win
- Any player can ask to undo the last move. It is undone only if every player still in the game approves, and the pool is shuffled again so an undone draw cannot show the next tile. Continue is not a move, so an undo goes back past it too

## Controls

- Playable tiles in your hand are raised and outlined. Tap or click one, or start dragging it, and every space it fits lights up on the board. Tap a lit space, or drop the tile on one, to play it there. Tapping the tile again, or dropping it anywhere else, puts it back
- When a space takes the tile in more than one rotation, the tile is shown on it: click Rotate to turn it to the next rotation that fits, then Confirm to play it, or Cancel to put it back
- The board scrolls inside its box: drag it with a finger, or use the scroll wheel or scroll bars. Zoom in and Zoom out change its size and keep the middle of the box where it was. The last tile played is outlined
- Click Draw to draw when nothing fits, and Pass when you may not draw. The hint says how many tiles you have drawn this turn
- The table shows the round, the target, every player's tile count and score in seat order, and the pool. The player whose turn it is is outlined
- After each round, read the scoring screen and click Continue; the last round's scoring is on the game-over screen
- Click Undo to ask everyone to undo the last move
- With a table screen connected, on Hand only (the default) the other players and the pool are hidden, and the board shows only on your turn
- Open the ☰ menu and choose Rules for these rules, and FAQ in it for a short guide to the rules and controls

## Differences from Wikipedia

These follow the [Triominoes article](https://en.wikipedia.org/wiki/Triominoes). What remains different:

- **House rules.** The hexagon and bridge bonuses and the target score are house rules here, on by default with a target of 400
- **Game end.** Here the game ends in the round someone reaches the target. Wikipedia plays one final round after that
- **Blocked rounds.** Here a tie for the lowest hand in a blocked round scores nothing
- **Bridges.** Wikipedia's bridge bonus also counts adding a tile to a bridge. Here only completing a bridge counts
