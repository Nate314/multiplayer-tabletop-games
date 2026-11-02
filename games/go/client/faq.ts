import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Go needs ' +
      'exactly two players. The first to join plays black and moves first, the second plays white, and nobody ' +
      'can join after the first move.'
  },
  {
    question: 'How do I place a stone?',
    answer: 'On your turn, click or tap an empty point where the lines cross. With a mouse, a faint stone shows ' +
      'where yours would go on every point you can play. Stones never move once placed.'
  },
  {
    question: 'How do captures work?',
    answer: 'Stones of one color joined along the lines form a group. The empty points next to a group are its ' +
      'liberties. When your stone takes the last liberty of an enemy group, that group is captured and leaves ' +
      'the board. Captures are counted beside each player\'s name.'
  },
  {
    question: 'What is ko?',
    answer: 'You cannot make a move that puts the board back exactly as it was just before your opponent\'s last ' +
      'move. In practice this means that after a single stone is captured in a ko, the other player must play ' +
      'elsewhere for one turn before taking back. Longer repeating cycles are allowed.'
  },
  {
    question: 'Can I play where my stone would have no liberties?',
    answer: 'Only if it captures. Captures are checked first, so a move that takes the last liberty of an enemy ' +
      'group is legal even when your stone had no liberty before. Otherwise a move that leaves your own group ' +
      'without liberties is suicide and is refused.'
  },
  {
    question: 'How do I pass, and how does the game end?',
    answer: 'Click Pass to skip your turn. When both players pass in a row, play stops and the game moves to ' +
      'marking dead stones. A player can also resign at any time: click Resign, then Confirm resign. A player ' +
      'who leaves during the game loses.'
  },
  {
    question: 'How do I mark dead stones?',
    answer: 'After both players pass, click a stone to mark its whole group dead, and click it again to bring it ' +
      'back. Either player can mark any stone. Dead stones are drawn faded with a cross and count as captured ' +
      'for scoring. When the marks look right, click Agree. Every change to the marks clears both agreements, ' +
      'and the count happens once both players agree.'
  },
  {
    question: 'What if we disagree about which stones are dead?',
    answer: 'Click Resume play. The marks and passes are cleared and play continues with the player who would ' +
      'have moved, so you can settle it on the board. Two more passes in a row bring you back to marking.'
  },
  {
    question: 'How is the score counted?',
    answer: 'Go here uses area scoring. Each player scores one point for every stone of theirs on the board and ' +
      'one for every empty point surrounded only by their stones. White also gets a komi of 7.5 points to make ' +
      'up for moving second, so there are no ties. The higher total wins. While marking, the projected count ' +
      'is shown under the players, and a small square on each empty point shows whose territory it is.'
  },
  {
    question: 'Which board sizes can I play?',
    answer: 'The host picks the Board size house rule before the first move: 9x9, 13x13 or the standard 19x19, ' +
      'and both players must agree to it. Smaller boards make shorter games. There are no handicap stones.'
  }
];
