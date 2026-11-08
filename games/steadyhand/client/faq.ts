import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How do I take a turn?',
    answer: 'On your turn, press a part that is still in its slot and drag it along the slot to the round exit at the slot\'s far end, with the mouse or a finger. Reach the exit and the part is out, scoring the number shown under it.'
  },
  {
    question: 'What happens if I touch a wall?',
    answer: 'The bay buzzes, your turn ends and the part goes back to its rest spot for anyone to try. Dragging off the edge of the bay counts as touching a wall. If you let go before the exit, the part goes back and it is still your turn.'
  },
  {
    question: 'Why are some parts worth more?',
    answer: 'Long, narrow, twisting slots are harder, so their parts score more. The Coil is worth the most at 40 points.'
  },
  {
    question: 'How many buzzes do I get?',
    answer: 'Three, unless the house rules say Unlimited, 1 or 5. Everyone\'s buzzes left are shown beside their score. A player with none left is out of turns.'
  },
  {
    question: 'When does the game end?',
    answer: 'When every part is out, or when nobody has buzzes left. The highest score wins.'
  },
  {
    question: 'How does solo play score?',
    answer: 'Playing alone, your score is the value of the parts you got out. If you clear the whole bay, each buzz you have left adds 10 points (none under Unlimited buzzes).'
  },
  {
    question: 'What does wall tolerance do?',
    answer: 'It is a house rule that widens every slot (Easy) or narrows it (Hard). Normal is the standard.'
  },
  {
    question: 'Can I take back a buzz?',
    answer: 'Press Undo to ask the table. If everyone agrees, the last turn is taken back.'
  }
];
