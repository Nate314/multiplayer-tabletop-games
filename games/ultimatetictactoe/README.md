# Ultimate Tic-Tac-Toe

Nine games of tic-tac-toe in one, where every move sends your opponent.

Exactly two players: one plays X and moves first, the other plays O. In the first game Player 1 plays X, and each rematch swaps the marks.

## Rules

- The grid holds nine small boards in a 3 by 3, each a small tic-tac-toe grid, and starts empty
- One player is X and the other is O. X moves first and may play any cell of any board
- Each later mark must go in the small board that matches the cell the opponent just played: the top right cell of any board sends your opponent to the top right board
- If that board is already won or full, the player may play in any open board instead
- Won and full boards take no more marks
- Three of your marks in a row in a small board claims that board
- The first player to claim three boards in a row, across, down or diagonally, wins
- A full small board with no line counts for nobody
- When every board is decided with no line of three claimed boards, the game is a draw
- A player may resign at any time, on either player's turn, and the opponent wins
- Players may also agree to a draw: either player may offer one at any time, and the opponent accepts or declines. The offer lapses when they decline or make a move
- If a player is dismissed mid-game, the other player wins
- Either player can ask to undo the last mark. It is undone only if the other player approves

## Controls

- The boards you may play in are highlighted. On your turn, click or tap an empty cell there to mark it
- A claimed board shows its owner's big mark, and a drawn board is greyed out
- The last mark is outlined, and the winning three boards glow
- The boards are dimmed, and their cells are off, when it is not your turn
- Click Undo to ask your opponent to undo the last mark
- Click Offer draw to offer a draw; the button reads Draw offered until it is answered. When your opponent offers, Accept draw and Decline appear in the side panel
- Click Resign and then Confirm resign to resign, at any time; click Keep playing to change your mind
- With a table screen connected, on Hand only (the default) the boards show only on your turn
- Click Rules at the top of the page for these rules, and FAQ in it for a short guide to the rules and controls

## Differences from Wikipedia

Rules follow [Wikipedia's Ultimate tic-tac-toe article](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe). What is different:

- **Who starts.** The article lets either X or O open. Here X always moves first, Player 1 is X in the first game, and the marks swap on each rematch
- **Drawn small boards.** The article does not say who a drawn small board counts for. Here it counts for nobody
- **Draw offers and resigning.** The article does not cover them. Here either player may resign, or offer a draw that the other accepts, at any time
- **Leaving.** The article does not cover a player leaving mid-game. Here a dismissed player loses and the other player wins
