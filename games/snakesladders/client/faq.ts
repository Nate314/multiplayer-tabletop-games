import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I play?',
    answer: 'Enter your name and a Game ID; anyone who enters the same Game ID joins the same game, up to six ' +
      'players. The game needs at least two, and nobody can join after the first roll. Seat 1 rolls first, then ' +
      'the turn passes in join order. On your turn press Roll: the die is rolled for you and your token moves ' +
      'that many squares. A ladder\'s foot takes you up to its top and a snake\'s head takes you down to its tail. ' +
      'The first to reach 100 wins.'
  },
  {
    question: 'What happens when I roll a 6?',
    answer: 'You move, then roll again. There is no limit on how many sixes in a row you can roll. A 6 that ' +
      'reaches 100 wins, so there is no roll after it.'
  },
  {
    question: 'What if my roll would take me past 100?',
    answer: 'Normally your token stops on 100 and you win. With the Exact finish house rule on, a roll that would ' +
      'pass 100 does not move your token at all, and you need the exact number to land on 100. A 6 still rolls again.'
  },
  {
    question: 'Can two tokens share a square?',
    answer: 'Yes. Any number of tokens can stand on one square; nobody is sent back and nothing is captured. ' +
      'Tokens on the same square are drawn side by side inside it.'
  },
  {
    question: 'What do Undo and History do?',
    answer: 'Undo asks everyone to take back the last roll; it happens only if every player still in the game ' +
      'approves. An undone roll is rolled again fresh, so the die may show a different number. History, at the ' +
      'top of the page, steps through every roll so far, with the squares the token left and reached outlined.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each color also shows its shape: red circle, blue ' +
      'square, green triangle, orange hexagon, purple cross, cyan pentagon. Tokens and the player list show it.'
  }
];
