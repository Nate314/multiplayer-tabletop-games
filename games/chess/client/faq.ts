import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Chess needs ' +
      'exactly two players. The first to join plays white and moves first, the second plays black, and nobody ' +
      'can join after the first move.'
  },
  {
    question: 'How do I move?',
    answer: 'On your turn, click one of your pieces. Its legal moves are marked: a dot for an empty square and a ' +
      'ring for a capture. Click a marked square to move there. Click the piece again, or an empty unmarked ' +
      'square, to put it down, or click another of your pieces to pick that one instead. Your pieces are always ' +
      'at the bottom of the board. Or drag one of your pieces onto a marked square; drop it anywhere else to put ' +
      'it back.'
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
    answer: 'Click your king, then the square two to its left or right. The rook jumps to the other side of the ' +
      'king. You can castle only if neither the king nor that rook has moved, the squares between them are ' +
      'empty, and the king is not in check, does not pass through an attacked square, and does not land on one.'
  },
  {
    question: 'What is en passant?',
    answer: 'When a pawn moves two squares and lands beside one of your pawns, your pawn may capture it as if it ' +
      'had moved only one square, moving diagonally onto the square it skipped. You can do this only on your ' +
      'very next move.'
  },
  {
    question: 'How does promotion work?',
    answer: 'When your pawn reaches the far rank, choose a queen, rook, bishop or knight in the box that appears. ' +
      'Click Cancel to pick a different move.'
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
    answer: 'On your turn, when the same position with you to move has happened three times, or fifty moves ' +
      'each have passed without a capture or a pawn move, a Claim draw button appears. If the move you pick ' +
      'would itself make the third repetition or the fiftieth move, a box asks whether to make the move and claim ' +
      'the draw, or just move. Nobody has to claim, and the game goes on until someone does.'
  },
  {
    question: 'How do I offer a draw?',
    answer: 'Click Offer draw at any time. Your opponent sees Accept draw and Decline; accepting ends the game in ' +
      'a draw. The offer lapses if they decline or make a move instead.'
  },
  {
    question: 'How do I resign?',
    answer: 'At any time, on either player\'s turn, click Resign and then Confirm resign. Your opponent wins, ' +
      'unless they could never checkmate you (they have only their king left), in which case it is a draw. Click ' +
      'Keep playing to change your mind.'
  },
  {
    question: 'What do the highlights and the side panel show?',
    answer: 'The squares of the last move are tinted. The side panel lists both players with their color, ' +
      'whose turn it is, and the pieces each player has captured. The board is dimmed when it is not your turn.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks your opponent to take back the last move; it happens only if they approve.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If your opponent disconnects, the game waits for them to come back. If they are dismissed, you win.'
  }
];
