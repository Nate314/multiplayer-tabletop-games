import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'You and your partner, who sits across from you, try to take at least three of the five tricks when your team makes trump. Seats 1 and 3 play against seats 2 and 4. The first team to reach 10 points wins.'
  },
  {
    question: 'What is in the deck?',
    answer: '24 cards: 9, 10, jack, queen, king and ace in each suit. Each player gets 5 cards, one card is turned up and the other three stay face down in the kitty.'
  },
  {
    question: 'How is trump made?',
    answer: 'Starting left of the dealer, each player may order up the turned card, making its suit trump, or pass. If someone orders it up, the dealer adds the turned card to their hand and discards one card face down. If all four pass, the card is turned down and each player in turn may name any other suit as trump, or pass. If all four pass again, the hand is thrown in and the next player deals.'
  },
  {
    question: 'What are the bowers?',
    answer: 'The jack of trump is the right bower, the highest card. The other jack of the same color is the left bower, the second highest. The left bower counts as a trump for the whole hand, not as its own suit: when its own suit is led you do not have to play it, and when trump is led it follows. Then come the ace, king, queen, 10 and 9 of trump.'
  },
  {
    question: 'What is going alone?',
    answer: 'The player who made trump may go alone. Their partner sits out the hand and the other three play tricks of three cards. If the dealer sits out, they do not pick up the turned card. A lone player who takes all five tricks scores 4.'
  },
  {
    question: 'How do I play a trick?',
    answer: 'The player left of the dealer leads the first trick (the next player, if they sit out), and whoever takes a trick leads the next. Follow the suit led if you can; if you cannot, play anything. The highest trump takes the trick, otherwise the highest card of the suit led. Cards you may play are raised and outlined.'
  },
  {
    question: 'How is a hand scored?',
    answer: 'If the team that made trump takes 3 or 4 tricks it scores 1 point, and all 5 (a march) scores 2, or 4 when going alone. If it takes fewer than 3 it is euchred and the other team scores 2. After the scoring, everyone clicks Continue for the next hand, and the deal passes to the left.'
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
