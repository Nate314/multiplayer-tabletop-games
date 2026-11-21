import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Chess needs ' +
      'exactly two players. The first to join plays white and moves first, the second plays black, and nobody ' +
      'can join after the first move.'
  },
  {
    question: 'How do the pieces move?',
    answer: 'The king moves one square in any direction. The queen moves any distance in a straight line or ' +
      'diagonally, the rook any distance in a straight line, and the bishop any distance diagonally. None of ' +
      'them can jump over pieces. The knight moves in an L shape, two squares one way and one square to the ' +
      'side, and can jump. A pawn moves one square forward, or two from its starting square, and captures one ' +
      'square diagonally forward.'
  },
  {
    question: 'How do I castle?',
    answer: 'Castling moves the king two squares toward a rook, and the rook jumps to the other side of the king. You ' +
      'can castle only if neither the king nor that rook has moved, the squares between them are empty, and the ' +
      'king is not in check, does not pass through an attacked square, and does not land on one.'
  },
  {
    question: 'What is en passant?',
    answer: 'When a pawn moves two squares and lands beside one of your pawns, your pawn may capture it as if it ' +
      'had moved only one square, moving diagonally onto the square it skipped. You can do this only on your ' +
      'very next move.'
  },
  {
    question: 'How does promotion work?',
    answer: 'When your pawn reaches the far rank, you choose a queen, rook, bishop or knight to replace it.'
  },
  {
    question: 'What are check and checkmate?',
    answer: 'A king that is attacked is in check, and its square turns red. You must get out of check on your ' +
      'move, and you can never make a move that leaves your own king attacked, so pieces that would expose it ' +
      'show no moves. If the player to move is in check and has no legal move, it is checkmate and the other ' +
      'player wins.'
  },
  {
    question: 'Which draws happen by themselves?',
    answer: 'The game ends in a draw at once by stalemate (the player to move is not in check but has no legal ' +
      'move), by a dead position (no series of legal moves could ever checkmate: kings alone, a lone bishop or ' +
      'knight, bishops all on one square color, or pawns locked together that neither king can ever reach), by ' +
      'fivefold repetition (the same position with the same player to move five times), or by the 75-move rule ' +
      '(seventy-five moves each without a capture or a pawn move). Checkmate on the last of those moves still wins.'
  },
  {
    question: 'How do I claim a draw?',
    answer: 'On your turn, when the same position with you to move has happened three times, or fifty moves each have ' +
      'passed without a capture or a pawn move, you can claim a draw. If the move you pick would itself make the ' +
      'third repetition or the fiftieth move, you can make the move and claim the draw in one go. Nobody has to ' +
      'claim, and the game goes on until someone does.'
  },
  {
    question: 'How do I offer a draw?',
    answer: 'Either player can offer a draw at any time. If the opponent accepts, the game ends in a draw. The offer ' +
      'lapses if they decline or make a move instead.'
  },
  {
    question: 'How do I resign?',
    answer: 'At any time, on either player\'s turn. Your opponent wins, unless they could never checkmate you (they ' +
      'have only their king left), in which case it is a draw.'
  },
  {
    question: 'What do the highlights and the side panel show?',
    answer: 'The squares of the last move are tinted. The side panel lists both players with their color, ' +
      'whose turn it is, and the pieces each player has captured. The board is dimmed when it is not your turn.'
  },
  {
    question: 'How does the clock work?',
    answer: 'The host can turn on a clock of 5, 10 or 15 minutes per player, with an optional increment of 2, 5 or ' +
      '10 seconds added after each move you make. Both players must agree to the house rules first. The clocks ' +
      'start when both have agreed, with White running first. Your clock runs while it is your turn, even if you ' +
      'disconnect or a vote is open. If your time runs out you lose, even if your opponent could not checkmate. ' +
      'Undo gives back the time spent on the undone move. In your last 10 seconds a tick plays each second, unless Timer warnings is off in Settings.'
  },
  {
    question: 'Can I use the turn timer with the clock?',
    answer: 'Yes. The Turn timer house rule is separate from the clock, and both can run together. It only warns: the countdown beside the current player\'s name goes red in the last 10 seconds, then shows Time\'s up and overtime, and nobody loses or skips a turn because of it.'
  },
  {
    question: 'What does Undo do?',
    answer: 'It takes back the last move, but only if your opponent approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If your opponent disconnects, the game waits for them to come back. If they are dismissed, you win.'
  }
];
