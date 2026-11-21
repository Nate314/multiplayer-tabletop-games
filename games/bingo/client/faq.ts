import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Be first to mark the pattern on one of your cards and shout Bingo. The pattern is a Line (any full row, column or diagonal) unless the house rules pick Four corners or Blackout.'
  },
  {
    question: 'What is on a card?',
    answer: 'Five columns under B I N G O: B holds numbers from 1 to 15, I from 16 to 30, N from 31 to 45, G from 46 to 60 and O from 61 to 75. The center square is free and counts as marked. Every player gets the same number of cards, one unless the house rules say more.'
  },
  {
    question: 'How are numbers called?',
    answer: 'Players take turns. On your turn you call: the next of the 75 numbers is drawn, which everyone sees, and the turn passes on. The last call shows large at the top with every call so far below it.'
  },
  {
    question: 'Which numbers can I mark?',
    answer: 'Only a called number can be marked, and you can mark at any time, not just on your turn. A called number you have not marked yet is softly highlighted.'
  },
  {
    question: 'How do I claim a Bingo?',
    answer: 'A claim checks the marks on all your cards. If none has the pattern, you are told Not a Bingo yet, with no penalty. Numbers called but not marked do not count.'
  },
  {
    question: 'What if two players get Bingo at once?',
    answer: 'A place stays open until the next Call or three seconds after its first Bingo, whichever comes first. Everyone who claims while it is open shares that place.'
  },
  {
    question: 'When does the game end?',
    answer: 'When the place the house rules play until (1st, 2nd or 3rd) is filled, when every player has a place, or ten seconds after the 75th number is called. Players without a place rank after everyone with one.'
  },
  {
    question: 'Can I take back a call?',
    answer: 'Everyone connected is asked to undo the last call or Bingo. It is undone only if every connected player approves. Marks are never undone on their own, and an undone call puts the uncalled numbers in a new order.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'The game goes on while two or more players remain.'
  }
];
