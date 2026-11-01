import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Work out a hidden row of colored pegs. After each guess you get answer pegs that tell you how close you came. ' +
      'You have 10 guesses for each code.'
  },
  {
    question: 'How big is the code?',
    answer: '4 pegs from 6 colors, unless the host picked 5 pegs from 8 colors under the Code house rule. Colors may repeat, ' +
      'in the code and in your guesses.'
  },
  {
    question: 'What do the answer pegs mean?',
    answer: 'A dark filled peg means one of your pegs is the right color in the right place. A light ringed peg means one is ' +
      'the right color in the wrong place. The answer pegs do not say which of your pegs they mean. Each peg of the code is ' +
      'counted at most once, right places first, so guessing four greens against a code with two greens earns 2 pegs, not 4. ' +
      'Hover over the answer pegs to read them in words, for example 2 right place, 1 right color.'
  },
  {
    question: 'How do I make a guess?',
    answer: 'Click the colors under Your guess: each fills the first empty slot of the row. Click a peg in the row to empty ' +
      'it, or Clear to empty the whole row. Submit guess sends the row once every slot is filled. The row you are building ' +
      'is only on your screen until you send it.'
  },
  {
    question: 'What are the modes?',
    answer: 'Solo is for one player. Classic is for exactly two: you take turns making the code and breaking it. Together and ' +
      'Race are for two or more. In Together everyone guesses on one shared board, at any time, and each guess shows who made ' +
      'it. In Race everyone breaks the same code on their own board. The standard is Solo with one player, Classic with two ' +
      'and Together with three or more.'
  },
  {
    question: 'How does Classic work?',
    answer: 'There are 4 rounds, and each player makes the code twice. The maker picks a code with the colors and presses ' +
      'Set code; the breaker waits until then. The breaker scores 1 point for every guess used, plus 1 more for failing all ' +
      '10, so 11. After each round the code is shown with the points, and the next round starts once both players press ' +
      'Continue. The lowest total after 4 rounds wins, and equal totals share the win.'
  },
  {
    question: 'How does Race work?',
    answer: 'Whoever breaks the code in the fewest guesses wins. If two players tie, the one who finished first wins. The ' +
      'race ends once nobody still guessing can match or beat the best result. You never see the other boards while the ' +
      'race is on: only how many guesses each player has used and how close their best guess came, as the share of pegs ' +
      'in the right place. Every board is shown once the game ends.'
  },
  {
    question: 'Who can see the code?',
    answer: 'In Classic only its maker, until the round ends. In Solo, Together and Race nobody, not even spectators, until ' +
      'the code is broken or the guesses run out. The History dialog keeps it hidden too.'
  },
  {
    question: 'What does Undo do?',
    answer: 'In Classic, Undo asks the other player to take back the last move, and it happens only if they approve. In Solo ' +
      'it takes back your last guess at once. In Together and Race, Undo my last move takes back your own latest guess with ' +
      'no vote. A finished Race board cannot be undone.'
  },
  {
    question: 'What are the shapes on the pegs?',
    answer: 'Turn on Color-blind symbols in Settings and every peg shows a shape for its color, so the colors can be told ' +
      'apart without seeing them.'
  },
  {
    question: 'What happens if a player leaves?',
    answer: 'In Classic the player left behind wins at once. In Together the others play on. In Race the leaver\'s board is ' +
      'dropped, which ends the race if nobody left can match or beat the best result.'
  }
];
