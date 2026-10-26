# Chess

Checkmate the enemy king in the classic two-player strategy game.

The first player to join plays white and moves first; the second plays black. Each player sees their own pieces at the bottom of the board.

## Rules

- Standard chess: the king moves one square in any direction, the queen any distance in a straight line or diagonally, the rook any distance in a straight line, the bishop any distance diagonally, and the knight in an L shape, jumping over pieces. A pawn moves one square forward, or two from its starting square, and captures one square diagonally forward
- Castling: the king moves two squares toward a rook and the rook jumps to its other side. Neither piece may have moved, the squares between them must be empty, and the king may not be in check, pass through an attacked square, or land on one
- En passant: a pawn that has just moved two squares can be captured by an enemy pawn beside it, as if it had moved one square, but only on the very next move
- Promotion: a pawn reaching the far rank becomes a queen, rook, bishop or knight of the player's choice
- A move may never leave your own king in check
- Checkmate wins
- A player may resign at any time, on either player's turn, and the opponent wins. If the opponent could never checkmate by any series of legal moves (they have only their king left), the resignation is a draw instead
- Draw by agreement: either player may offer a draw at any time. The opponent accepts or declines; the offer lapses when they decline or make a move
- These draws happen at once: stalemate, a dead position (see below), fivefold repetition (the same position, with the same player to move, the same castling rights and the same en passant chance, five times), and the 75-move rule (seventy-five moves each without a capture or pawn move). A checkmate on the move that would reach five repetitions or 75 moves still wins
- These draws must be claimed by the player to move: threefold repetition and the 50-move rule (fifty moves each without a capture or pawn move). The player may claim when the position on the board qualifies, or together with the move that would produce it. Until someone claims, play goes on
- Dead positions detected: kings alone, king and one bishop or one knight against a lone king, any number of bishops (on either side) that all stand on squares of one color, and positions with only kings and pawns where every pawn is permanently blocked (a pawn stands right in front of it and it has nothing to capture) and neither king can ever walk onto an enemy pawn without stepping onto a square an enemy pawn attacks
- If a player disconnects, the game waits for them to rejoin. If they are dismissed, the other player wins
- Either player can ask to undo the last move. It is undone only if the other player approves

## House rules

Before the first move the host picks the rules and both players must agree. They cannot change once play starts.

- **Clock.** Off (standard), 5, 10 or 15 minutes per player. The clocks start when both players have agreed, with White's time running
- **Increment per move.** Offered only with the clock on: none (standard), 2, 5 or 10 seconds added to a player's time after each move they make
- Each move charges the mover the time since their clock started, then adds the increment. A move that arrives after the mover's time has run out is refused as a loss on time
- Running out of time loses: "<name> ran out of time. <other> wins!" This holds even when the opponent could never checkmate
- The clock keeps running through disconnects and votes. Undo puts both clocks back to what they showed when the undone move's turn began and restarts the running clock from the moment of the undo, so time spent on an undone move is given back. A server restart restarts the running clock from the moment the server is back, so neither the downtime nor the time the player to move had already used on that turn is charged
- **Turn timer.** The platform rule offered in every game (Off, 30 seconds, 1, 2 or 5 minutes) is separate from the clock and can run alongside it. It only warns: the countdown beside the current player's name goes red in the last 10 seconds and then shows Time's up and overtime, and the turn is never skipped
- The clock stops when the game ends, by resignation, draw or checkmate

## Controls

- On your turn, click one of your pieces to see its legal moves: a dot marks an empty square and a ring marks a capture. Click a marked square to move
- Click the piece again, or an unmarked square, to put it down, or click another of your pieces to pick that one instead
- Or drag one of your pieces onto a marked square, with the mouse or a finger; drop it anywhere else to put it back. A drag to the far rank opens the same box for the pawn's new piece
- When a pawn reaches the far rank, choose its new piece in the box over the board, or click Cancel
- The last move's squares are tinted, and a king in check stands on a red square
- The side panel shows the status, whose turn it is, each player's color and the pieces each player has captured
- The board is dimmed when it is not your turn
- Click Resign and then Confirm resign to resign, at any time; click Keep playing to change your mind
- Click Offer draw to offer a draw; the button reads Draw offered until it is answered. When your opponent offers, Accept draw and Decline appear in the side panel
- On your turn, Claim draw appears when the position allows a claim by threefold repetition or the 50-move rule. When the move you pick would produce such a position, a box over the board offers Move and claim draw, Just move, or Cancel
- Click Undo to ask your opponent to undo the last move
- With the clock on, each player's time shows beside their name in the side panel, and the running one is highlighted. In your last 10 seconds a tick plays each second (Timer warnings in Settings)
- Click Rules at the top of the page for these rules, and FAQ in it for a short guide to the rules and controls

## Differences from Wikipedia

- Dead positions are found only in the cases listed under Rules. Other dead positions, such as a blocked position where a king can reach an enemy pawn but no capture could ever lead to mate, are not detected, so play goes on in them until another rule ends the game. The check never declares a position dead wrongly: when unsure (a king in check, or an en passant capture on offer) it says nothing
- The clock is optional. When it is on, running out of time always loses, even against a side that could never checkmate; the rule that draws such a game does not apply. Without the clock the rules on time do not apply
- There is no arbiter: a claim with nothing to claim is refused instead of being penalized, and a claim made with a move is only offered when that move really produces the claimable position
