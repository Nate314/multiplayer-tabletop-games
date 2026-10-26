# Jenga

Pull blocks from a wobbly tower and stack them on top without knocking it over.

For 2 to 8 players, who take turns in join order. Nobody can join after the first block is grabbed. Jenga has no house rules.

## Rules

- The tower starts as 54 blocks in 18 levels of 3, each level laid across the one below
- On your turn, pull one block out of the tower and place it on top
- You may take any block below the top level. While the top level has fewer than 3 blocks, the level under it is off limits too
- During your turn you may slide a block, push it back in, let go and try another as often as you like
- A block is in your hand once it is pulled clear of the tower, or once it lies on the table outside the tower after you let go
- Place the block on the top level, in the left, middle or right spot. Once the top level has 3 blocks, the next block starts a new level laid across it. You can place only once the tower has stopped moving. Placing ends your turn
- The tower has toppled when any block other than the one you last grabbed drops more than half a block height, or tips more than 30 degrees, from where it was at the start of your turn. The same check runs after you place, until the tower is still again: a fall then is yours, and the next player can grab only once it is still
- Whoever topples the tower loses, and everyone else wins. The game ends once the falling blocks come to rest
- Each block has its own grip, from slick to sticky, picked at random for every game. Nobody can see it, so you find out by pulling: a block that will not budge may be sticky, or carrying the weight above it
- If you lose connection mid-pull, you let go of the block and the tower settles where it is; a fall while it settles still counts as your topple. Your turn waits for you to come back, and a block already in your hand stays there
- If the player who is pulling is dismissed, the tower goes back to how it stood at the start of their turn, unless they had already toppled it
- Anyone can ask to undo the last turn. If everyone else approves, the tower goes back to how it stood at the start of that turn, with nobody holding a block

## Controls

- **Mouse:** press on a block you may take and drag it out. A slow drag slides it gently; a fast drag jerks it harder, up to a limit. Drag it back to push it in, and let go to choose another. Press on empty space and drag to turn the tower, and scroll to zoom
- **Touch:** drag a block with one finger to pull it, drag empty space to turn the tower, and pinch to zoom
- **Keyboard:** click the tower or tab to it. The arrow keys choose a block (Up and Down change level, Left and Right move along it), and the line under the tower names the chosen block. Enter grabs it. Then Down pulls it out and Up pushes it back; each press the same way pulls harder. Escape lets go
- When the block is in your hand, click Place on top, left, middle or right. A spot that is taken is greyed out, and all three are greyed out until the tower stops moving
- The block you are pulling, or have chosen, is drawn in a brighter color
- Click Undo to ask everyone else to undo the last turn
- History shows the tower after every placement, with the placed block highlighted and a faint ghost where it was pulled from, and the fallen tower at the end
- A device that cannot draw 3D shows "This device cannot draw the 3D tower" instead; the keyboard controls, the status line and the Place buttons still work
- With a table screen connected, on Hand only (the default) the tower shows only on your turn
- Click Rules at the top of the page for these rules, and FAQ in it for a short guide to the rules and controls

## How it works

The server runs the tower's physics (Rapier, deterministic build) 20 times a second while anyone pulls or the tower moves, and is the only judge of what happens. Each browser runs the same physics between the server's updates so the tower moves smoothly, and draws it with three.js. The grips never leave the server: the browser simulates every block with the same middling grip, and the server's next update corrects it.

The physics costs server CPU. Measured on a Windows dev machine, a tick during a pull takes a median of about 18 to 20 ms (90th percentile 34 to 43 ms) of the 50 ms between ticks, a tick during a collapse up to about 50 ms, and each placement settles synchronously in about 210 to 410 ms, so a few Jenga rooms playing at once can slow the server.

## Differences from Wikipedia

Rules follow [Wikipedia's Jenga article](https://en.wikipedia.org/wiki/Jenga). What is different:

- **Who wins.** The article makes the last player to complete a turn before the collapse the winner. Here everyone but the player who toppled the tower wins
- **When the tower has fallen.** The article ends the game when any portion of the tower collapses. Here a fall is a block other than the one being pulled dropping more than half a block height or tipping more than 30 degrees
- **End of a turn.** The article ends a turn when the next player touches the tower, or 10 seconds after the placement. Here placing the block ends the turn, and you can place only once the tower is still
- **One hand.** The article allows one hand on the tower at a time. Here you hold one block at a time with one pointer or the keyboard
- **Hidden grip.** The article does not cover it. Here each block's grip is picked at random from slick to sticky and kept secret
