# Jenga

Pull blocks from a wobbly tower and stack them on top without knocking it over.

For 2 to 8 players, who take turns in join order. Nobody can join after the first block is grabbed. House rule: Free placement (off by default), where you set the block on top yourself and the physics decides what happens.

## Rules

- The tower starts as 54 blocks in 18 levels of 3, each level laid across the one below, standing on a turntable. Marks on it show which way it faces
- On your turn you can turn the turntable. A hard or jerky turn can shake or topple the tower, and that is your topple. The turntable stays where the last player left it, and a turntable that is still spinning, like a moving tower, must stop before the next grab
- On your turn, pull one block out of the tower and place it on top
- You may take any block below the top level. While the top level has fewer than 3 blocks, the level under it is off limits too
- During your turn you may slide a block, push it back in, let go and try another as often as you like
- A block is in your hand once it is pulled clear of the tower, or once it lies on the table outside the tower after you let go
- Place the block on the top level, in the left, middle or right spot. Once the top level has 3 blocks, the next block starts a new level laid across it. You can place only once the tower has stopped moving. Placing ends your turn
- To place, drag the block to an open spot on top and it snaps in, ending your turn. Let go anywhere else and the block lies on the ground beside the turntable, to pick up again
- Free placement (house rule): where you let go, the physics decides. It ends your turn once the block rests on top and everything is still. A block that slides off comes back to your hand, and any blocks it knocks down are a topple. Each drop is recorded when it is made, so its History step shows the block just above the top, and a block that slid off still has its own step: one undo puts the whole turn back, and a second undo removes the leftover step
- The tower has toppled when any block other than the one you last grabbed drops more than half a block height, or tips more than 30 degrees, from where it was at the start of your turn. The same check runs after you place, until the tower is still again: a fall then is yours, and the next player can grab only once it is still
- Whoever topples the tower loses, and everyone else wins. The game-over screen waits for the fallen tower to come to rest
- Each block has its own grip, from slick to sticky, picked at random for every game. Nobody can see it, so you find out by pulling: a block that will not budge may be sticky, or carrying the weight above it
- If you lose connection mid-pull, you let go of the block and the tower settles where it is; a fall while it settles still counts as your topple. Your turn waits for you to come back, and a block already in your hand stays there
- If the player who is pulling is dismissed, the tower goes back to how it stood at the start of their turn, unless they had already toppled it
- Anyone can ask to undo the last turn. If everyone else approves, the tower goes back to how it stood at the start of that turn, with nobody holding a block

## Controls

- **Mouse:** press on a block you may take and drag it out. A slow drag slides it gently; a fast drag jerks it harder, up to a limit. Drag it back to push it in, and let go to choose another. On your turn, press on empty space and drag left or right to turn the turntable and up or down to tilt the view; between turns the same drag turns the camera freely. Scroll to zoom
- **Touch:** drag a block with one finger to pull it, drag empty space to turn the turntable or tilt the view on your turn (between turns it turns the camera), and pinch to zoom
- **Keyboard:** click the tower or tab to it. The arrow keys choose a block (Up and Down change level, Left and Right move along it), and the line under the tower names the chosen block. Enter grabs it. Then Down pulls it out and Up pushes it back; each press the same way pulls harder. Escape lets go
- **Turntable keys:** Q turns the turntable left and E turns it right, at 1 rad/s while held. They work while the tower has focus
- **Camera:** on your turn there is no left or right camera orbit; turning is done to the turntable. Your turn starts from the view you ended your last turn with, measured against the turntable (the default view on your first turn). Saved views live in memory for each seat, so reloading the page starts again from the default view
- When the block is in your hand, drag it to an open spot on top, or click Place on top, left, middle or right. A spot that is taken is greyed out, and all three are greyed out until the tower stops moving
- The block you are pulling, or have chosen, is drawn in a brighter color
- Click Undo to ask everyone else to undo the last turn
- History starts from the untouched tower, then shows the tower after every placement, with the placed block highlighted and a faint ghost where it was pulled from, and the fallen tower at the end
- A device that cannot draw 3D shows "This device cannot draw the 3D tower" instead; the keyboard controls, the status line and the Place buttons still work
- With a table screen connected, on Hand only (the default) the tower shows only on your turn
- Click Rules at the top of the page for these rules, and FAQ in it for a short guide to the rules and controls

## How it works

The server runs the tower's physics (Rapier, deterministic build) 20 times a second while anyone pulls, turns or the tower moves, and is the only judge of what happens. Each browser runs the same physics between the server's updates so the tower moves smoothly, and draws it with three.js. The grips never leave the server: the browser simulates every block with the same middling grip, and the server's next update corrects it.

The physics runs in the turntable's frame. The turntable is a static disc collider in Rapier and never rotates there; turning acts on the blocks through the rotating frame's Euler, centrifugal and Coriolis forces, and the turntable's angle is integrated without trig. State poses stay world poses. A turntable that Rapier carried by friction drifted every block outward and toppled the tower after about two thirds of a turn at any speed, so it is not done that way. The spin values are `MAX_SPIN` 10 rad/s, `SPIN_ACCEL` 300 rad/s^2 and `COAST_DECEL` 3 rad/s^2: a steady turn at 6 rad/s or less stands, while a held full-speed turn or a back-and-forth jerk can topple. The player's speed request is clamped to `MAX_SPIN`, and letting go makes the turntable coast to a stop.

The physics costs server CPU. Measured on a Windows dev machine over five runs, a tick during a pull takes a median of about 8 ms (90th percentile 13 ms) of the 50 ms between ticks, a tick while turning the turntable and coasting a median of about 12 ms (90th percentile 14 ms), a tick during a collapse a median of about 10 ms (90th percentile 14 ms), and each placement settles synchronously in a median of about 96 ms (90th percentile 121 ms), so a few Jenga rooms playing at once can slow the server.

## Differences from Wikipedia

Rules follow [Wikipedia's Jenga article](https://en.wikipedia.org/wiki/Jenga). What is different:

- **Who wins.** The article makes the last player to complete a turn before the collapse the winner. Here everyone but the player who toppled the tower wins
- **When the tower has fallen.** The article ends the game when any portion of the tower collapses. Here a fall is a block other than the one being pulled dropping more than half a block height or tipping more than 30 degrees
- **End of a turn.** The article ends a turn when the next player touches the tower, or 10 seconds after the placement. Here placing the block ends the turn, and you can place only once the tower is still
- **One hand.** The article allows one hand on the tower at a time. Here you hold one block at a time with one pointer or the keyboard
- **Hidden grip.** The article does not cover it. Here each block's grip is picked at random from slick to sticky and kept secret
- **The turntable.** The article's tower stands on a table. Here it stands on a turntable that the player can spin, and a hard turn can topple it
- **Free placement.** The house rule lets the block stay where you let go, and the physics decides what happens, instead of snapping it into an open spot
