import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Yahtzee is for 2 to 8 players. Joining closes after the first roll.'
  },
  {
    question: 'How does a turn work?',
    answer: 'Click Roll to roll all five dice. You may then roll up to two more times. Before each roll, click the dice you want to keep to hold them (they get a green outline), and only the other dice are rolled. After your last roll, or sooner if you like, you must score the dice in one empty box on your score sheet.'
  },
  {
    question: 'How do I score?',
    answer: 'After your first roll, each empty box in your column shows the points your dice would score there. Click one to write it in. You can score a zero in any box that does not fit your dice, and each box is filled only once. The game lasts 13 rounds, one for each box.'
  },
  {
    question: 'What does each box score?',
    answer: 'Ones to sixes: the sum of the dice showing that number. Three of a kind and four of a kind: the sum of all five dice. Full house (three of one number and two of another): 25. Small straight (four in a row): 30. Large straight (five in a row): 40. Yahtzee (five of a kind): 50. Chance: the sum of all five dice.'
  },
  {
    question: 'What is the upper bonus?',
    answer: 'If the six boxes from Ones to Sixes add up to 63 or more, you earn a bonus of 35 points. That is three of each number.'
  },
  {
    question: 'What happens with a second Yahtzee?',
    answer: 'If you already scored 50 in the Yahtzee box, each further Yahtzee earns a 100 point bonus. If the Yahtzee box holds a zero, there is no bonus. Either way the Joker rule applies: you must use the box for the number you rolled if it is empty. If it is full, you may use any empty lower box, and full house, small straight and large straight then score their full 25, 30 or 40. If every lower box is full, you must score a zero in an empty upper box.'
  },
  {
    question: 'Who wins?',
    answer: 'After every player has filled all 13 boxes, the highest total wins. Totals include the upper bonus and any Yahtzee bonuses. Tied players share the win.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A player who drops out keeps their seat so they can rejoin. If the others dismiss them, they are skipped from then on and their sheet is not counted. If only one player is left, that player wins.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask the other players to take back the last roll or score. It is undone only if they all approve. A roll that is taken back and made again may come out differently.'
  }
];
