# Snakes and Ladders

Roll the die, climb the ladders and dodge the snakes on the way to 100.

Players are seated in join order, each with a token of their own color: Player 1 red, Player 2 blue, Player 3 green, Player 4 orange, Player 5 purple, Player 6 cyan. Seat 1 rolls first, then the turn passes in join order.

## Rules

- The board has 100 squares. They run back and forth: 1 to 10 left to right on the bottom row, 11 to 20 right to left above it, and so on, with 100 at the top left
- The board has 8 ladders and 8 snakes. No square is both the end of one and the start of another, and none is on 1 or 100, so one move never takes two of them:
  - Ladders (foot to top): 3 to 22, 8 to 30, 21 to 42, 28 to 76, 36 to 57, 50 to 69, 71 to 92, 80 to 99
  - Snakes (head to tail): 27 to 5, 43 to 17, 55 to 34, 66 to 45, 74 to 53, 89 to 68, 96 to 77, 98 to 61
- Every token starts on square 1
- On your turn, roll one die and move your token that many squares forward
- Landing on the foot of a ladder climbs it to its top
- Landing on the head of a snake slides down it to its tail
- Any number of tokens may share a square
- A 6 gives you another roll after you move. There is no limit on sixes in a row
- A roll that would pass 100 stops on 100
- Exact finish (house rule, off unless the host turns it on and everyone agrees): a roll that would pass 100 does not move the token. A 6 still rolls again
- The first player to reach 100 wins and the game ends there
- If a player leaves mid-game, their token is removed from the board and their turns are skipped. The last player left wins
- Any player can ask to undo the last roll. It is undone only if every player still in the game approves. An undone roll is rolled again fresh

## Controls

Described with the board.

## Differences from Wikipedia

These follow the Gameplay section of [Wikipedia's Snakes and ladders article](https://en.wikipedia.org/wiki/Snakes_and_ladders). What is different:

- **The layout.** The ladders and snakes are this game's own layout, not one taken from the article
- **Who starts.** Wikipedia names no rule for who goes first. Here seat 1 always starts
- **Passing 100.** Wikipedia's Gameplay section does not say what happens to a roll past 100; its mathematics section ends the game on an overshoot. Here, without Exact finish, the token stops on 100 and wins
- **Exact finish.** Wikipedia's variant also allows a token to bounce back off 100 by the extra squares. That is not implemented: with Exact finish on, the token stays where it is
- **Sixes in a row.** Wikipedia does not say whether rolling again after a 6 has a limit. Here there is none
