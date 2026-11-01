import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Sudoku is for ' +
      'one to eight players.'
  },
  {
    question: 'What are the rules?',
    answer: 'Fill every empty square with a digit from 1 to 9 so that each row, each column and each 3x3 box holds ' +
      'every digit exactly once. The bold digits are givens and cannot be changed. Every puzzle has exactly one solution.'
  },
  {
    question: 'What are the modes?',
    answer: 'Solo is for one player. With two or more, choose Together, where everyone fills in one shared board at ' +
      'the same time, or Race, where everyone gets the same puzzle on their own board and the first to solve it wins. ' +
      'Nobody waits for a turn in any mode.'
  },
  {
    question: 'What do the difficulties mean?',
    answer: 'Easy gives about 36 digits and can be solved by singles alone: a square with only one possible digit, or ' +
      'a digit with only one possible square in its row, column or box. Medium gives about 30 digits. Hard gives ' +
      'fewer still and needs more than singles.'
  },
  {
    question: 'How do I fill in a square?',
    answer: 'Click or tap an empty square to select it, then click a digit on the pad or type it. Erase, Backspace, ' +
      'Delete or 0 clears the square. The arrow keys move the selection. The selected square\'s row, column and box ' +
      'are highlighted, and so is every other square holding the same digit.'
  },
  {
    question: 'What are pencil marks?',
    answer: 'Turn on Pencil (or press N) and the digits you pick become small notes in the square instead of an ' +
      'entry; pick a digit again to remove its note. Your pencil marks are yours alone: nobody else sees them, even ' +
      'in Together. Writing a digit in a square clears your notes there.'
  },
  {
    question: 'How do I see my mistakes?',
    answer: 'In Solo, turn on Show mistakes to mark every entry that does not match the solution. In Together, wrong ' +
      'entries are always marked. In Race nothing is marked, but when your board is full and something is wrong you ' +
      'are told so.'
  },
  {
    question: 'What can I change in Together?',
    answer: 'You can fill any empty square, and anyone may replace or erase a wrong entry, whoever made it. A correct ' +
      'entry is locked: nobody can change or erase it, not even the player who made it.'
  },
  {
    question: 'What does Undo do?',
    answer: 'In Solo, Undo takes back your last entry or erase. In Together and Race, Undo my last move takes back ' +
      'your own last move that is still on the board; a move someone else has since changed is skipped.'
  },
  {
    question: 'What do I see of the other racers?',
    answer: 'Only how much of the puzzle each of them has filled in, as a percentage, right or wrong. Their digits ' +
      'are hidden until the race ends.'
  },
  {
    question: 'How does the game end?',
    answer: 'Solo and Together end as soon as the board is solved, and everyone at the table wins. A race ends when ' +
      'the first player solves their board; the others are ranked by how much of their board is correct.'
  },
  {
    question: 'What happens if a player leaves?',
    answer: 'The game goes on without them. In Together their entries stay on the board; in Race their board leaves ' +
      'with them.'
  }
];
