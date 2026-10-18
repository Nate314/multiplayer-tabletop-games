import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Mancala is for ' +
      'exactly two players, and nobody can join after the first move. The first player to join moves first.'
  },
  {
    question: 'What does the board look like?',
    answer: 'Each player has a row of six pits and a bank. Your row is always along the bottom and your bank is ' +
      'the big hole on the right, labeled Your bank. Your opponent\'s row is along the top and their bank is on the ' +
      'left. Each bank is tinted in its owner\'s color. Every pit starts with four stones: blue on the first ' +
      'player\'s side, red on the second player\'s. Stones keep their color wherever they go. The number on each ' +
      'pit and bank is how many stones it holds.'
  },
  {
    question: 'How do I move?',
    answer: 'On your turn, click one of your pits that has stones; those pits are outlined. You pick up all its ' +
      'stones and drop one stone in each following hole, counter-clockwise, as the arrows around the board show: ' +
      'to the right along your row, into your bank, then right to left along your opponent\'s row and back around. ' +
      'Your opponent\'s bank is skipped.'
  },
  {
    question: 'When do I get an extra turn?',
    answer: 'When the last stone you drop lands in your own bank, you move again. The status says so.'
  },
  {
    question: 'How do captures work?',
    answer: 'When the last stone you drop lands in an empty pit on your own side, and the pit straight across from it ' +
      'has stones, you capture both: that last stone and every stone across go into your bank. If the pit across ' +
      'is empty, nothing is captured.'
  },
  {
    question: 'How does the game end?',
    answer: 'As soon as either row is empty, each player moves every stone left on their own side into their own ' +
      'bank. Whoever has the most stones in their bank wins. Equal banks are a draw.'
  },
  {
    question: 'What is highlighted on the board?',
    answer: 'The pit the last move started from has a dashed outline and the hole where its last stone landed has a ' +
      'solid one. The board is dimmed when it is not your turn.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks your opponent to take back the last turn; it happens only if they approve.'
  }
];
