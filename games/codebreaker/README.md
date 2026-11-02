# Code Breaker

Work out a hidden row of colored pegs from the answer pegs each guess earns, for 1 to 6 players. Classic is for two players who take turns making and breaking the code; Solo, Together and Race break a code the computer draws.

## Rules

- **The code.** A row of 4 pegs from 6 colors (red, blue, green, yellow, orange, purple), or 5 pegs from 8 colors (adding pink and cyan) when the host sets the Code house rule. Colors may repeat, in the code and in a guess
- **Guesses.** Each guess is a full row of pegs. There are 10 guesses for each code
- **Answer pegs.** Each guess earns a dark peg for every peg of the right color in the right place, and a light peg for every other peg of the right color in the wrong place. The answer pegs do not say which of the guess's pegs they mean. Right places are counted first, then right colors from the code pegs left over, and each code peg is counted at most once: four greens against red, red, green, green earn 2 dark pegs and nothing else. A guess with every peg dark breaks the code
- **Modes.** The host picks the Mode as a house rule. Solo is offered at 1 seat, Classic at exactly 2 seats, Together and Race at 2 or more. The standard is Solo with one player, Classic with two and Together with three or more
- **Classic.** Two players, 4 rounds, and each player makes the code twice: seat 1 makes the first code, then the makers alternate. The maker sets a code and the breaker then guesses. The breaker scores 1 point for every guess used, plus 1 more for failing all 10 (so 11). After each round the code is shown with the points, and the next round starts once every connected player has pressed Continue. After 4 rounds the lowest total wins, and equal totals share the win
- **Solo.** The computer draws the code and you have 10 guesses to break it
- **Together.** Everyone guesses on one shared board, at any time, and each guess shows who made it. Breaking the code wins for everyone; 10 misses lose for everyone
- **Race.** Everyone breaks the same code, drawn by the computer, on their own board, at any time. Whoever breaks it in the fewest guesses wins, and of two with the same count, the one who finished first. The race ends once nobody still guessing can match or beat the best result. If nobody breaks it, nobody wins. During the race you see only your own board, and for every other player how many guesses they have used and how close their best guess came (the share of pegs in the right place); every board is shown once the game ends
- **Who sees the code.** In Classic only the maker, until the round ends. In Solo, Together and Race nobody, until the code is broken or the guesses run out. History, saved game files and the move descriptions keep it hidden too
- **Spectators.** A spectator never sees the code before it is revealed. In Race a spectator sees every player's board, so once someone breaks the code the spectator can read it from that board. In Classic a spectator sees the code only if the maker lets them see the maker's view (Ask to see the maker's hand, then Allow)
- **Leaving.** In Classic the player left behind wins at once. In Together the others play on. In Race the leaver's board is dropped, which ends the race if nobody left can match or beat the best result
- **Undo.** In Classic, Undo asks the other player to take back the last move, and it happens only if they approve. In Solo it takes back your last guess at once. In Together and Race, Undo my last move takes back your own latest guess with no vote; a finished Race board cannot be undone. The Undo button is off once the game is over, but the site, as in every game here, still accepts an undo request after the game ends, so a Solo player could take back the last guess after the code was shown. This is an accepted risk

## Controls

- Click the colors under Your guess (Your code when you set a Classic code): each fills the first empty slot of the row. The colors are off once the row is full
- Click a peg in the row to empty that slot, or click Clear to empty the whole row
- Click Submit guess (Set code for a Classic maker) once every slot is filled. The row you are building is only on your screen until you send it
- The board shows the code row on top (covered with ? until it is revealed), then the 10 guess rows, oldest first, each with its answer pegs. Hover over the answer pegs to read them in words, for example 2 right place, 1 right color
- In Classic the side panel shows the round, its maker and each player's points; between rounds the Round scoring screen shows the code and the points, and Continue starts the next round
- In Race the side panel shows each other player's guess count and progress, or Broken once they break the code
- Click Undo (Classic and Solo) or Undo my last move (Together and Race) to take back a guess, as in Rules
- With Color-blind symbols on in Settings, every peg shows a shape for its color
- Click Rules at the top of the page for these rules, and FAQ in it for a short guide to the rules and controls

## Differences from Wikipedia

These follow [Wikipedia's Bulls and Cows article](https://en.wikipedia.org/wiki/Bulls_and_Cows). What is different:

- **Colored pegs, not digits.** Wikipedia plays with secret numbers, usually of four digits, all different, and each guess must have all different digits too. Here the code is 4 pegs from 6 colors, or 5 from 8, and colors may repeat. So the count is right places first, then right colors from what is left, each code peg counted once
- **Answer pegs.** Wikipedia's "bulls" (right digit, right place) and "cows" (right digit, wrong place) are shown here as dark and light answer pegs, labeled right place and right color
- **Classic.** In Wikipedia each player writes a secret number, the players take turns guessing the other's, and the first to reveal the other's number wins, with no guess limit and no scoring. Here Classic has one maker and one breaker per round, 4 rounds with each player making the code twice, 10 guesses each, and the breaker scores 1 per guess plus 1 for failing; the lowest total wins
- **Other modes.** Solo, Together and Race, in which the computer draws the code, are not in the article. It mentions computer versions of the game but not their rules, and a team variant in which teammates talk over each guess; Together instead lets everyone guess on one shared board at any time
- **No word version.** Wikipedia's version with letters that must spell a word is not offered
- **Leaving.** The article does not cover a player leaving. Here the Classic player left behind wins, Together plays on, and Race drops the leaver's board
