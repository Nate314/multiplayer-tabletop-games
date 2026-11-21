import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Earn prestige by buying development cards and being visited by nobles. When a player reaches the prestige to win (15 unless the host chose another), the round is played to its end so everyone has had the same number of turns, and then the game ends. Most prestige wins.'
  },
  {
    question: 'What can I do on my turn?',
    answer: 'One of four things: take 3 gems of different colors; take 2 gems of one color, if at least 4 of that color are in the supply; reserve a card and take a gold; or buy a face-up card or one of your reserved cards.'
  },
  {
    question: 'How do I take gems?',
    answer: 'You take three gems of different colors, or two of one color; two works only when 4 or more of that color are left. When fewer than three colors are left, you take one of each color that remains.'
  },
  {
    question: 'How does buying work?',
    answer: 'You can buy a face-up card or one of your reserved cards. Each card you own gives a permanent bonus of its color, which lowers the price of later cards by one gem of that color. Your gems pay the rest, and gold pays for any color you are short of. The game pays with your colored gems first and uses gold only for what is missing. Cards you can afford are outlined.'
  },
  {
    question: 'How does reserving work?',
    answer: 'You can reserve a face-up card, or the top card of a deck without anyone seeing it. You also take a gold if any is left. You can hold at most 3 reserved cards, and the only way to get rid of one is to buy it. Others see your face-up reserved cards, but only the level of a card you took from a deck.'
  },
  {
    question: 'What if I have more than 10 tokens?',
    answer: 'At the end of your turn you must give tokens back until you hold 10, gold included. You pick which ones. Your turn does not pass until you do.'
  },
  {
    question: 'When does a noble visit?',
    answer: 'At the end of your turn, a noble visits you when your card bonuses (not your gems) meet the cost on its tile. Each noble is worth 3 prestige. Only one noble can visit per turn; if several qualify, you choose, and the others may visit on a later turn. You cannot refuse a visit.'
  },
  {
    question: 'Who wins a tie?',
    answer: 'The player who bought the fewest development cards. If that is tied too, the player with the fewest reserved cards wins, and if even that is tied the win is shared.'
  },
  {
    question: 'What if I cannot do anything?',
    answer: 'If there are no gems to take, no card or deck you can reserve, and nothing you can afford, a Pass button appears instead.'
  },
  {
    question: 'What happens if a player leaves?',
    answer: 'A dismissed player\'s gems go back to the supply, their reserved cards leave the game and their turns are skipped. Their bought cards and nobles stay on show. If they were in the middle of their turn, that turn ends. The last player left wins.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each gem color also shows its shape: white ring, blue square, green triangle, red circle, black diamond, gold star. Gem tokens, card bonuses and card costs show it.'
  },
  {
    question: 'Can I undo?',
    answer: 'Yes. Giving back tokens and choosing a noble are moves of their own. The last move is undone only if every player still in the game approves.'
  },
  {
    question: 'Can the rules be changed?',
    answer: 'Before play starts the host can choose the prestige to win: 10, 15 or 21. Everyone has to agree before play starts, and the rules cannot change afterwards.'
  }
];
