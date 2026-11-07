import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to six ' +
      'players. The game needs at least two players, and nobody can join after the first move.'
  },
  {
    question: 'Which board is played?',
    answer: 'The Board house rule picks one before the game starts. Road to Retirement is a career race along a ' +
      'winding road with a spinner of 1 to 10. 1860 Checkered is a race across a checkerboard of named squares ' +
      'with a teetotum of 1 to 6. Game length and Starting cash apply to the Road to Retirement board only.'
  },
  {
    question: 'How does a turn work on the road?',
    answer: 'Press Spin and your token moves that many spaces. Every payday you pass or land on pays your salary. ' +
      'The space you land on then acts: a gain or a loss of money, a job, a house, family, or a risk. Turns go ' +
      'around in seat order and skip anyone who has retired. Hover over a space to read what it does.'
  },
  {
    question: 'College or straight to work?',
    answer: 'On your first turn you choose. College costs $50,000 and leads along the college road to ' +
      'Graduation, where you pick one of two careers that need a degree (Nurse to Surgeon, $55,000 to ' +
      '$100,000). Straight to work offers two careers that need no degree ($20,000 to $50,000) at once, and ' +
      'the work road is shorter.'
  },
  {
    question: 'How do jobs and careers work?',
    answer: 'A Job space offers two careers you can take: any career with a degree, or one that needs no degree ' +
      'without. Pick one, or keep the career you have. Your career sets the salary each payday pays.'
  },
  {
    question: 'What are the stop spaces?',
    answer: 'Graduation, the Wedding, the house stop, the fork and Retirement have a thick border. A spin that ' +
      'reaches Graduation, the Wedding, the house stop or Retirement stops there and the rest of the spin is ' +
      'lost. At the fork the move pauses ' +
      'while you choose the Safe road or the Fast lane, then goes on with the steps left. The fast lane is ' +
      'shorter but full of risk spaces.'
  },
  {
    question: 'What are risk spaces?',
    answer: 'Landing on a risk space spins again: 1 to 4 loses $20,000, 5 to 7 breaks even, and 8 to 10 wins ' +
      '$50,000.'
  },
  {
    question: 'What happens when I run out of money?',
    answer: 'You take loans of $20,000, as many as it takes to cover what you owe. Each loan costs $25,000 to repay ' +
      'when you retire, and that can leave your final worth below zero.'
  },
  {
    question: 'How do houses and family work?',
    answer: 'A house space offers two houses nobody owns yet. Buy one or choose No house; a house you buy sells for ' +
      'more than it cost when you retire. The first family space or the Wedding brings a partner; each family ' +
      'space after that brings a child, worth $25,000 at retirement.'
  },
  {
    question: 'How is the winner decided on the road?',
    answer: 'Reaching Retirement ends your road. Your worth is your cash, plus what your houses sell for, plus ' +
      '$25,000 for each child, minus $25,000 for each loan. Once everyone has retired, the highest worth wins; ' +
      'players who tie share the win.'
  },
  {
    question: 'What do the house rules change on the road?',
    answer: 'Game length Short leaves out the dimmed spaces, so the road is about 30 spaces shorter. Starting ' +
      'cash sets the money everyone starts with: $10,000, $25,000 or $50,000.'
  },
  {
    question: 'How do I move on the 1860 Checkered board?',
    answer: 'Pieces stand only on the light squares and start on Infancy, bottom left. Press Spin: 1 moves up or ' +
      'down to the next light square in the same column, 2 left or right to the next one in the same row, 3 one ' +
      'square diagonally; 4, 5 and 6 move the same ways one or two squares. The squares you can reach are ' +
      'highlighted; click one. With one choice you move there by yourself, and with none the turn passes.'
  },
  {
    question: 'What do the named squares do?',
    answer: 'An arrow sends you on once, for example from Bravery to Honor or from Crime to Prison; the square ' +
      'you are sent to acts but never sends you again. Wealth scores 10 points; Honor, Happiness, College, ' +
      'Success, Fat Office and Congress score 5 each. Prison loses your next turn. Despair sends you back to ' +
      'Infancy with every point lost. Speculation spins again: 3 or 6 goes to Wealth, anything else to Ruin.'
  },
  {
    question: 'How do I win on the 1860 board?',
    answer: 'Land on Happy Old Age, top right, with at least 100 points counting its 50. Arriving short, you keep ' +
      'playing and collect more; the 50 is not kept.'
  },
  {
    question: 'What do Undo and History do?',
    answer: 'Undo asks everyone to take back the last move; it happens only if every player still in the game ' +
      'approves. A move played again after an undo spins again, so it may land somewhere else. History, at the ' +
      'top of the page, steps through every move so far with the mover\'s space outlined.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their token leaves the board and their turns are skipped. On the road, the game ends once everyone ' +
      'still playing has retired.'
  }
];
