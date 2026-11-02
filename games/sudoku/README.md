# Sudoku

Fill the grid so every row, column and box holds 1 to 9, alone, together or as a race, for 1 to 8 players.

## Rules

- **The grid.** Nine rows and nine columns of squares, split into nine 3x3 boxes. Fill every empty square with a digit from 1 to 9 so that each row, each column and each box holds every digit exactly once
- **Givens.** The digits already in the grid at the start are givens, shown bold. They cannot be changed or selected. Every puzzle has exactly one solution, and its givens are symmetric: the square mirrored through the center of a given is also a given
- **Modes.** The mode is a house rule, set before play starts. Solo is the only mode with one player. With two or more players, Together (the standard) gives everyone one shared board, and Race gives everyone their own copy of the same puzzle. Nobody takes turns in any mode: every player can fill in squares at any time
- **Difficulty.** The difficulty is a house rule; Medium is the standard. Easy gives 36 or 37 givens and can be solved by singles alone (a square with only one possible digit, or a digit with only one possible square in its row, column or box). Medium gives 30 or 31 givens. Hard is a minimal symmetric puzzle (no symmetric pair of givens can be taken away without allowing a second solution) that needs more than singles and has fewer givens than Medium (fewer than 30). A new puzzle is made when the table opens or the difficulty changes, not when someone joins
- **Pencil marks.** Each player can write small notes of possible digits in empty squares. They are their own: nobody else sees them, even in Together. Writing a digit in a square clears your own notes there
- **Together.** Everyone fills in the same board. A wrong entry is marked wrong for everyone at once. A correct entry is locked: nobody can change or erase it, not even the player who made it. Anyone may replace or erase a wrong entry, whoever made it, so you may erase your own entry only while it is wrong
- **Race.** Each player fills in their own board and sees only that board. Of the others they see only how much of the puzzle each has filled in, as a whole percentage of the non-given squares, right or wrong. Nothing is marked wrong during a race; when your board is full but not solved you are told so (only you), and you can keep changing it
- **Solo.** Mistakes are not marked unless you turn on Show mistakes, which marks every entry that does not match the solution for as long as it is on
- **Winning.** Solo and Together end as soon as the board is solved ("Solved!" or "Solved together!"), and everyone still at the table wins. The Together standings show how many squares each player filled in. A race ends when the first player solves their own board, and they win. The standings put the winner first and the rest by the share of non-given squares they have right, as a whole percent; equal shares share a place, and the next place follows on (1, 2, 2, 3). Once the race is over, everyone can see every board
- **Leaving.** A disconnected player keeps their seat, and nobody waits for them, since there are no turns. A dismissed player leaves the game: in Together their entries stay on the board, and in Race their board leaves with them. With the others gone the last player keeps going and must still finish the puzzle to win
- **Undo.** In Solo, Undo takes back your last entry or erase at once. It restores the game as it was before that entry, so pencil marks and the Show mistakes toggle changed since then are dropped too. In Together and Race there is no undo vote: Undo my last move takes back your own last entry or erase that is still on the board. A move of yours that someone else has since changed is skipped, and nobody else's move is touched
- **Spectators and the table screen.** An ordinary spectator sees every Race board and every racer's progress. A table screen is in view of the racers, so during a race it sees only the progress, over a grid of givens. Nobody sees the solution, or anyone else's pencil marks, before the game ends
- **History.** History shows each entry and erase, and each Undo my last move. For a race it shows only who moved and the progress until the final step, which shows every board

## Controls

- Click or tap an empty square to select it. Its row, column and box are shaded, and so is every other square holding the same digit. The square changed last is outlined
- Click a digit on the pad, or type 1 to 9, to write it in the selected square. Erase, Backspace, Delete or 0 clears it
- The arrow keys move the selection, passing over givens and stopping at the edge of the grid; with nothing selected an arrow starts at the top left
- Click Pencil, or press N, to switch the pad and the keys to pencil marks; pick a digit again to remove its mark. Click Pencil (or press N) again to go back to entries
- A wrong entry is shaded red (in Together always, in Solo while Show mistakes is on)
- In Solo, click Show mistakes to turn the marking on or off, and Undo to take back your last entry or erase
- In Together and Race, click Undo my last move to take back your own last move
- Whenever more than one Race board is in view (a spectator during the race, anyone once it is over, the last step of History), buttons above the grid name each player with their progress, such as "Alice 40%"; click one to show that player's board. You start on your own board, or with none, on the board of whoever moved last. The square changed last is outlined only on the board of the player who changed it
- In a race the side panel lists every other racer's progress, and says "Your board is full, but something is wrong" when yours is
- The side panel shows the status, the mode and difficulty, and in Together who is playing (a player who left is marked "(left)")
- Click Rules at the top of the page for these rules, and FAQ in it for a short guide to the rules and controls

## Differences from Wikipedia

These follow [Wikipedia's Sudoku article](https://en.wikipedia.org/wiki/Sudoku). What is different:

- **Modes.** Wikipedia describes a puzzle for one solver. Together (one shared board) and Race (identical copies, first to finish wins) are added
- **Difficulty.** Wikipedia says puzzles are rated but not how. Here it is the number of givens and whether singles alone solve it
- **Mistakes.** Wikipedia has no checking. Together flags a wrong entry at once and locks a correct one; Race checks a board only when it is full; Solo flags only with Show mistakes on
- **Pencil marks.** Not in the article. Each player has their own, seen only by them
- **Leaving and undo.** Not in the article. With others gone the last player keeps going and must still finish; Together and Race take back only your own last move
