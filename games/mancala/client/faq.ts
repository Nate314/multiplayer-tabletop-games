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
    question: 'What happens when my last stone lands in a pit with stones?',
    answer: 'You keep going. If that pit, on either side of the board, already had stones, you pick up every stone ' +
      'in it, including the one that just landed, and drop them the same way. This repeats until your last stone ' +
      'lands in an empty pit or in your bank, so one click can send stones all around the board. The whole chain ' +
      'plays out on the board, faster when it is long.'
  },
  {
    question: 'When does my turn end?',
    answer: 'When your last stone lands in an empty pit, on your side or your opponent\'s, your turn ends. There ' +
      'are no captures: the stones stay where they are.'
  },
  {
    question: 'When do I get an extra turn?',
    answer: 'When your last stone lands in your own bank, whether on the first pickup or later in the chain, you ' +
      'move again. The status says so.'
  },
  {
    question: 'How does the game end?',
    answer: 'As soon as either row is empty after a turn, each player moves every stone left on their own side into ' +
      'their own bank. Whoever has the most stones in their bank wins. Equal banks are a draw.'
  },
  {
    question: 'What is highlighted on the board?',
    answer: 'The pit the last move started from has a dashed outline and the hole where its chain ended has a solid ' +
      'one. The board is dimmed when it is not your turn.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks your opponent to take back the last turn; it happens only if they approve.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each color also shows its shape: blue square, red circle. Stones, banks and bank labels show it.'
  }
];
