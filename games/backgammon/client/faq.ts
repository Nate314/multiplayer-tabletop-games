import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Backgammon ' +
      'is for exactly two players. The first player to join plays white; the second plays red.'
  },
  {
    question: 'Who moves first?',
    answer: 'Once both players are seated, each rolls one die, again on a tie. The higher roller moves first ' +
      'using both numbers, so the opening move is never a double. The status line shows both rolls.'
  },
  {
    question: 'How is the board laid out?',
    answer: 'Each player sees the board from their own side, with points numbered 1 to 24 from that side. You ' +
      'move your checkers from your 24 point, top right, across the top, then along the bottom to your home ' +
      'board, points 1 to 6 at the bottom right. Your tray for borne off checkers is on the far right of the ' +
      'bottom row and your bar is in the middle of the bottom row.'
  },
  {
    question: 'How are the dice rolled?',
    answer: 'After the opening roll, click Roll at the start of your turn. The dice are shown beside the board, ' +
      'with the used ones faded. Each die moves one checker that many points. You may move one checker for ' +
      'both dice. A double is played four times.'
  },
  {
    question: 'How does the doubling cube work?',
    answer: 'The game is played for the value on the cube, which starts in the middle at 1. Before rolling, ' +
      'you may click Double if the cube is in the middle or it is yours. Your opponent clicks Take to play on ' +
      'for twice the stake and own the cube, so only they can redouble next, or Drop to concede the game at ' +
      'the value before the double. There is no limit on redoubles.'
  },
  {
    question: 'How do I move?',
    answer: 'On your turn, the checkers that can move are highlighted. Click one, then click one of its ' +
      'highlighted destinations. Click the checker again, or anywhere else, to choose a different one. Each ' +
      'click moves one checker by one die, and your turn ends once your dice are used.'
  },
  {
    question: 'Where can a checker land?',
    answer: 'On an empty point, a point with your own checkers, or a point with exactly one opposing checker, ' +
      'called a blot. Landing on a blot hits it: it goes to the bar. A point with two or more opposing checkers ' +
      'is blocked.'
  },
  {
    question: 'What happens when I have a checker on the bar?',
    answer: 'You must bring it back in before moving anything else. It enters in your opponent\'s home board: a ' +
      'roll of 1 enters on your 24 point, a 6 on your 19 point. If both entry points for your roll are blocked, ' +
      'you cannot move this turn.'
  },
  {
    question: 'Do I have to use both dice?',
    answer: 'Yes, whenever you can. Only moves that let you use as many of your dice as possible are ' +
      'highlighted. If you can use either die but not both, you must use the higher one. If you cannot move ' +
      'at all, you forfeit the roll, the turn passes and the status line says so.'
  },
  {
    question: 'How do I bear off?',
    answer: 'Once all fifteen of your checkers are in your home board, a die can take a checker off from the ' +
      'point with its number. A higher die can bear off from your highest occupied point. Select the checker ' +
      'and click your highlighted tray. When either die could bear it off, buttons under the board ask which ' +
      'die to use.'
  },
  {
    question: 'How do I win, and how many points is it worth?',
    answer: 'Be the first to bear off all fifteen checkers, or have your opponent drop your double. Bearing ' +
      'off wins the cube\'s value, twice that for a gammon (your opponent has borne off none) and three times ' +
      'for a backgammon (they also still have a checker on the bar or in your home board). A drop wins the ' +
      'value before the double. The points won are shown when the game ends.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks your opponent to take back the last move: a checker move, a roll, a double, a take or ' +
      'a drop. It happens only if they approve. A roll that is undone may come up differently when rolled again.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If a player leaves mid-game, the other player wins.'
  }
];
