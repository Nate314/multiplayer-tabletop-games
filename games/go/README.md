# Go

Surround more of the board than your opponent with black and white stones.

The first player to join plays black and moves first; the second plays white. Nobody can join after the first move.

## Rules

- The board is a grid of lines, and stones are played on the points where the lines cross. Black moves first and the players alternate, each placing one stone of their color on an empty point or passing. Stones never move once placed
- Stones of one color joined along the lines form a group, and the empty points next to a group are its liberties. A stone that takes the last liberty of an enemy group captures it: the whole group leaves the board. One stone can capture several groups at once. Each player's captures are counted
- Captures come first: a stone with no liberties of its own is allowed when it captures, since the capture gives it liberties
- Suicide is forbidden: a stone that would leave its own group with no liberties, and captures nothing, is refused
- Ko: no move may put the board back exactly as it was just before the opponent's last move. After a single stone is captured in a ko, the other player must play elsewhere before taking back. Longer repeating cycles are allowed
- Two passes in a row end play. Then both players mark the dead stones: clicking a stone marks its whole group dead, and clicking it again brings it back. Either player can mark any stone, and each change clears both agreements. The count happens when both players agree
- Instead of agreeing, either player can resume play. The marks and passes are cleared and play continues with the player who would have moved; two more passes in a row bring the game back to marking
- Area scoring: each player scores one point for each of their stones on the board and one for each empty point surrounded only by their stones. Dead stones are taken off first. White gets a komi of 7.5 points for moving second, so there are no ties. The higher total wins
- Board size is a house rule: 9x9, 13x13 or 19x19, 19x19 being the standard. The host picks it before the first move and both players must agree
- A player may resign at any time, on either player's turn, and the opponent wins. There are no draw offers
- If a player disconnects, the game waits for them to rejoin. If they are dismissed, the other player wins
- Either player can ask to undo the last move. It is undone only if the other player approves

## Controls

- On your turn, click or tap an empty point to place a stone. With a mouse, a faint stone shows where yours would go on every point you can play
- A refused point (taken, suicide or ko) shows why in the status and nothing is played
- The last stone played is ringed
- Click Pass to pass your turn
- While marking dead stones, click a stone to mark its group dead (faded, with a cross) or to bring it back. A small square on each empty point shows whose territory it is, and the projected count shows under the players
- Click Agree when the marks look right; it reads Agreed until the marks change, and "Waiting for <name> to agree" shows who has not agreed yet. Click Resume play to go back to playing instead
- The side panel shows the status, whose turn it is, each player's color and captures, and the projected or final count: stones, territory, komi and total for each color
- Click Resign and then Confirm resign to resign, at any time; click Keep playing to change your mind
- Click Undo to ask your opponent to undo the last move
- History shows each move, the board after it with that stone ringed, and the final count
- Click Rules at the top of the page for these rules, and FAQ in it for a short guide to the rules and controls

## Differences from Wikipedia

These follow [Wikipedia's Rules of Go article](https://en.wikipedia.org/wiki/Rules_of_Go). What is different:

- Simple ko only; positional superko, which Wikipedia lists for Chinese and AGA rules, is not enforced.
- Suicide is forbidden; Wikipedia's basic rules allow it and most rulesets forbid it.
- Always area scoring (Chinese style) with komi 7.5; no territory scoring and no komi choice.
- Dead stones are agreed by both players; a disagreement is settled by Resume play, as under Chinese rules, with no hypothetical play.
- No handicap stones.
- Board sizes 9x9, 13x13 and 19x19 only, 19x19 standard.
- Resigning, which the Rules article does not cover.
- No game clock or byo-yomi (the platform turn timer only warns).
