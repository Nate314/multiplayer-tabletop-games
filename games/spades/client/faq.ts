import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'You and your partner, who sits across from you, bid how many tricks you will take and then try to take exactly that many. Seats 1 and 3 play against seats 2 and 4. The first team to reach 500 points wins, and a team that falls to -200 loses.'
  },
  {
    question: 'How are the cards dealt?',
    answer: 'The whole 52-card deck is dealt, 13 cards each. Seat 4 deals first and the deal passes to the left after each hand.'
  },
  {
    question: 'How does bidding work?',
    answer: 'Starting left of the dealer, each player bids once, from 1 to 13 tricks, or nil to take none. The dealer bids last. Your team\'s contract is your bid and your partner\'s added up; a nil does not add to it. Everyone sees every bid.'
  },
  {
    question: 'How do I play a trick?',
    answer: 'The player left of the dealer leads the first trick, and whoever takes a trick leads the next. Follow the suit led if you can; if you cannot, play anything, a spade included. The highest spade takes the trick, otherwise the highest card of the suit led. Aces are high. Cards you may play are raised and outlined.'
  },
  {
    question: 'When can I lead a spade?',
    answer: 'Only once spades are broken, which happens the first time someone plays a spade, or when your hand holds nothing but spades. The table shows whether spades are broken.'
  },
  {
    question: 'How is a hand scored?',
    answer: 'A team that takes at least its contract scores 10 points per trick bid, plus 1 point for each extra trick, called a bag. A team that takes fewer loses 10 points per trick bid. Both partners\' tricks count, a nil bidder\'s too. Scores can go below zero.'
  },
  {
    question: 'What do bags cost?',
    answer: 'Bags add up from hand to hand. When a team reaches 10 bags it loses 100 points and its bag count drops by 10, so extra bags carry on toward the next 10.'
  },
  {
    question: 'How does nil score?',
    answer: 'A player who bids nil and takes no trick wins 100 points for the team; one who takes any trick loses 100. This is scored on its own, on top of whatever the partner\'s bid scores. If both partners bid nil, there is no contract and only the two nils score.'
  },
  {
    question: 'What if both teams pass 500 in the same hand?',
    answer: 'The higher total wins. If the totals are equal, another hand is played. The same goes when a team falls to -200: the other team wins unless the scores are tied.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A disconnected player keeps their seat and the game waits for them on their turn. If they are dismissed, their partnership is broken, so the game ends and the other team wins.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every connected player approves. Continue is not a move, so an undo goes back past it.'
  }
];
