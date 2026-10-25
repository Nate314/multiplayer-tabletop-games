import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'You and your partner, who sits across from you, try to capture counters in tricks. Seats 1 and 3 play against seats 2 and 4 (six players play in teams of three or two). The first team to reach the target score (500 unless the host chose another) wins.'
  },
  {
    question: 'What is in the deck?',
    answer: '41 cards: 5 to 14 in red, yellow, green and black, and the Rook. With four players each gets 9 cards and 5 go face down to the nest; with six, 6 each and a 5-card nest.'
  },
  {
    question: 'Which cards count?',
    answer: 'Each 5 is worth 5 points, each 10 and 14 is worth 10, and the Rook 20. That makes 120 points in a hand. Counters show their value in a corner.'
  },
  {
    question: 'How does bidding work?',
    answer: 'Starting left of the dealer, each player bids or passes. Bids go from 70 to 120 in steps of 5 and must beat the last one. A pass is final for that hand. When only one bidder is left, or someone bids 120, they win the bid. If everyone passes, the next dealer deals again.'
  },
  {
    question: 'What happens with the nest?',
    answer: 'The bid winner adds the nest to their hand, picks as many cards as the nest held to lay aside (5 with four or six players), and names trump. Only they see the cards laid aside. Whoever takes the last trick also takes those cards and their counters.'
  },
  {
    question: 'How do I play a trick?',
    answer: 'The player left of the dealer leads the first trick, and whoever takes a trick leads the next. Follow the color led if you can; if you cannot, play anything. The highest trump takes the trick, otherwise the highest card of the color led. 14 is high and 5 is low. Cards you may play are outlined.'
  },
  {
    question: 'What is special about the Rook?',
    answer: 'It is the highest trump, whatever color is trump. You may play it at any time, even when you could follow suit. When it is led, everyone must play trump if they can, and if trump is led and the Rook is your only trump, you must play it.'
  },
  {
    question: 'How is a hand scored?',
    answer: 'If the bidding team took at least its bid, it scores what it took; otherwise it loses the amount of its bid. The other team always scores what it took; with three teams of two, the host chooses whether each defending team scores its own counters or what both took together. Scores can go below zero. After the scoring, everyone clicks Continue for the next hand, and the deal passes to the left.'
  },
  {
    question: 'What if several teams pass the target in the same hand?',
    answer: 'The highest total wins. If the leading totals are equal, another hand is played.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A disconnected player keeps their seat and the game waits for them on their turn. If they are dismissed, their partnership is broken, so the game ends and the highest-scoring team without them wins.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every connected player approves. Continue is not a move, so an undo goes back past it.'
  },
  {
    question: 'Can the rules be changed?',
    answer: 'Before play starts the host can choose a target score of 300, 500 or 1,000 points. Everyone has to agree before play starts, and the rules cannot change afterwards.'
  },
  {
    question: 'Can more than four play?',
    answer: 'Yes, up to 7, when the host ticks "I know what I\'m doing". With six the host picks two teams of three (seats 1, 3 and 5 against 2, 4 and 6) or three teams of two, partners sitting three apart, and with three teams how the two defending teams score. Teams are fixed for the game, and the hands and nest are sized so the 41 cards deal evenly.'
  }
];
