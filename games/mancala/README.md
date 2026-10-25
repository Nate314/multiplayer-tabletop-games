# Mancala

Drop stones around the board, play Avalanche or Kalah, and fill your bank.

Two players. The first to join moves first. By default it is played Avalanche style, and the host can switch to Kalah (see House rules).

## Rules

- The board has six pits per player and a bank at each end. Every pit starts with four stones
- On your turn, pick up all the stones in one of your non-empty pits and drop one stone in each following hole, counter-clockwise. Your own bank gets a stone; your opponent's bank is skipped
- Avalanche: if your last stone lands in a pit on either side that already had stones, pick up every stone in that pit, including the one you just dropped, and keep dropping from there. This repeats as long as the last stone lands in a pit that had stones
- If your last stone lands in your own bank, you take another turn
- If your last stone lands in an empty pit, your turn ends. In Avalanche there are no captures
- When your side is empty on your turn, you pick any non-empty pit on the other player's side and sow from it counter-clockwise as usual; your own bank gets stones as you pass it, and the opponent's bank is skipped. The game ends only when every pit is empty, and nothing is swept
- Kalah (Avalanche off): there are no relays, so each turn is one lap. A last stone in your own bank still gives another turn, and a last stone in an empty pit on your side captures that stone and every stone in the pit opposite, if it has any, into your bank. A pit chosen on the other side follows the same rule
- The player with the most stones in their bank wins. Equal banks are a draw
- If a player leaves mid-game, the other player wins
- Any player can ask to undo the last turn. It is undone only if the other player approves

## House rules

The host can change these before the first move, and everyone must agree before play starts.

- **When your side is empty, play from the other side** (on by default). Off, the game ends as soon as either row is empty after a turn, and each player moves the stones left on their side into their own bank
- **Avalanche (off plays Kalah, with captures)** (on by default). Off plays Kalah

A game saved before house rules existed has none set, so it plays with both rules on. The only difference for such a game is that a row running empty no longer ends it, because the other player can then play from the opposite side.

## Controls

- Your row is always along the bottom, with your bank on the right; your opponent's row and bank are at the top and on the left
- Arrows around the board show the counter-clockwise direction the stones travel
- Each bank is tinted in its owner's color and labeled with their name, or Your bank for your own
- The first player's stones are blue and the second player's are red. Stones keep their color as they move, so a bank shows whose stones ended up in it
- Each pit and bank shows its stones and a count. A pit draws up to 18 stones one by one and a bank all 48; the count is always exact. The bank totals are also listed under the board
- On your turn, click one of your outlined pits to play it. When your side is empty and playing from the other side is on, the outlined pits are on your opponent's side
- A move animates: the stones are picked up and dropped one at a time, then each pit the chain keeps going from is picked up and dropped the same way, a Kalah capture flies into your bank, and when play from the other side is off the rows are swept into the banks at the end of the game. A long chain plays faster, so a move takes about three seconds at most. Nothing animates when your system asks for reduced motion
- The pit the last move started from has a dashed outline and the hole where its chain ended has a solid one
- The board is dimmed when it is not your turn
- The status describes the last turn, such as "Alice picked up 4 stones and kept going 3 times, ending in an empty pit", and shows the final score
- Click Undo to ask the other player to undo the last turn
- Click FAQ at the top of the page for the rules and controls
- With Color-blind symbols on in Settings, each player color also shows its shape: blue square, red circle. Stones, banks and bank labels show it

## Differences from Wikipedia

Avalanche is a variant played in mancala apps and at home, and Wikipedia has no article of its own for it. It combines the relay sowing that [Wikipedia's Mancala article](https://en.wikipedia.org/wiki/Mancala) describes, where a last seed landing in an occupied pit means that pit's seeds are lifted and sown onward, with the banks, the skipped opposing bank and the extra turn of [Kalah](https://en.wikipedia.org/wiki/Kalah). Unlike Kalah, it has no captures. Turning Avalanche off plays Kalah as Wikipedia describes it: one lap per turn, an extra turn for a last stone in your bank, and a capture when the last stone lands in an empty pit on your side opposite a pit with stones. Playing from the other side when your side is empty is a house rule that Wikipedia does not describe: with it on, the game ends only when every pit is empty, where Wikipedia's Kalah ends as soon as one side is empty and the other player keeps the rest. Wikipedia calls the stones seeds and the banks stores.
