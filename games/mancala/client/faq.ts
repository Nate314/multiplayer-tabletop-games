import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Mancala is for ' +
      'exactly two players, and nobody can join after the first move. The first player to join moves first.'
  },
  {
    question: 'What does the board look like?',
    answer: 'Each player has a row of six pits and a store. Your row is always along the bottom and your store is ' +
      'the big hole on the right. Your opponent\'s row is along the top and their store is on the left. Every pit ' +
      'starts with four seeds, and the number in each pit and store is how many seeds it holds.'
  },
  {
    question: 'How do I move?',
    answer: 'On your turn, click one of your pits that has seeds; those pits are outlined. All its seeds are picked ' +
      'up and sown one at a time into the following holes, counter-clockwise: to the right along your row, into ' +
      'your store, then right to left along your opponent\'s row and back around. Your opponent\'s store is ' +
      'skipped.'
  },
  {
    question: 'When do I get an extra turn?',
    answer: 'When the last seed you sow lands in your own store, you move again. The status says so.'
  },
  {
    question: 'How do captures work?',
    answer: 'When the last seed you sow lands in an empty pit on your own side, and the pit straight across from it ' +
      'has seeds, you capture both: that last seed and every seed across go into your store. If the pit across ' +
      'is empty, nothing is captured.'
  },
  {
    question: 'How does the game end?',
    answer: 'As soon as either row is empty, each player moves every seed left on their own side into their own ' +
      'store. Whoever has the most seeds in their store wins. Equal stores are a draw.'
  },
  {
    question: 'What is highlighted on the board?',
    answer: 'The pit the last move started from has a dashed outline and the hole where its last seed landed has a ' +
      'solid one. The board is dimmed when it is not your turn.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks your opponent to take back the last turn; it happens only if they approve.'
  }
];
