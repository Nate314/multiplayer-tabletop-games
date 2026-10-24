import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Checkers is for ' +
      'exactly two players, and nobody can join after the first move. The first player plays Red and moves first; ' +
      'the second plays White.'
  },
  {
    question: 'How do the pieces move?',
    answer: 'Pieces stay on the dark squares. A man moves one square diagonally forward, toward the other side. A ' +
      'king moves one square diagonally forward or backward. Each player sees their own pieces at the bottom of the ' +
      'board.'
  },
  {
    question: 'How do I move?',
    answer: 'On your turn, click one of your pieces, then click a highlighted square. Click the piece again to let ' +
      'it go, or click another of your pieces to choose that one instead. Or drag one of your pieces onto a ' +
      'highlighted square; drop it anywhere else to put it back. A multi-jump drag stops at each landing: drag the ' +
      'piece again, or click the next landing square.'
  },
  {
    question: 'How do captures work?',
    answer: 'Jump diagonally over an opposing piece next to you onto the empty square just beyond it, and the ' +
      'jumped piece is removed. Men capture forward only; kings capture both ways. If you can capture, you must, ' +
      'and the pieces that can capture glow orange.'
  },
  {
    question: 'How do multi-jumps work?',
    answer: 'If the piece can jump again from where it lands, it must keep jumping in the same turn. Click each ' +
      'landing square in turn; the move is sent once no more jumps are left. Where the jumps branch, you choose ' +
      'the way. To start over, click the piece again.'
  },
  {
    question: 'How does a piece become a king?',
    answer: 'A man that reaches the far row is crowned and can then move backward too. A man crowned by a jump ' +
      'ends the turn there, even if it could jump again as a king.'
  },
  {
    question: 'How do I win?',
    answer: 'Capture all of your opponent\'s pieces, or leave them with no legal move on their turn.'
  },
  {
    question: 'Can the game be drawn?',
    answer: 'Only by agreement. Click Offer draw at any time; your opponent sees Accept draw and Decline. The ' +
      'offer lapses if they decline or make a move instead.'
  },
  {
    question: 'How do I resign?',
    answer: 'At any time, on either player\'s turn, click Resign and then Confirm resign. Your opponent wins. ' +
      'Click Keep playing to change your mind.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks your opponent to take back the last turn; it happens only if they approve.'
  },
  {
    question: 'What is highlighted on the board?',
    answer: 'The squares of the last move are outlined in yellow, and the squares of pieces it captured are ' +
      'marked. The board is dimmed when it is not your turn.'
  },
  {
    question: 'What happens if my opponent leaves?',
    answer: 'If they are dismissed, you win.'
  }
];
