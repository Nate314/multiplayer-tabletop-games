import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Take as few points as you can. Each heart you take in a trick is 1 point and the queen of spades 13. The game ends when someone reaches the target score (100 unless the host chose another), and the lowest score wins. Equal lowest scores share the win.'
  },
  {
    question: 'How many players?',
    answer: 'Exactly 4, each playing for themselves. All 52 cards are dealt, 13 each. Ace is high and there is no trump.'
  },
  {
    question: 'How does passing work?',
    answer: 'Before each hand everyone picks three cards and passes them: to the left in the first hand, then to the right, then across, then no pass, and around again. The cards you are passed arrive only once all four have passed. The first pass locks the seats, so a player who drops after that keeps their seat and their pass.'
  },
  {
    question: 'Who leads?',
    answer: 'Whoever holds the 2 of clubs leads it to the first trick. The winner of each trick leads the next.'
  },
  {
    question: 'How do I play a trick?',
    answer: 'Follow the suit led if you can; if you cannot, play anything. The highest card of the suit led takes the trick. Cards you may play are raised and outlined.'
  },
  {
    question: 'Are there limits on what I can play?',
    answer: 'On the first trick you may not play a heart or the queen of spades unless you have nothing else. A heart cannot be led until a heart has been played on an earlier trick, unless your hand is all hearts.'
  },
  {
    question: 'What is shooting the moon?',
    answer: 'If you take all 13 hearts and the queen of spades in one hand, you score nothing and everyone else takes 26.'
  },
  {
    question: 'What happens after a hand?',
    answer: 'A scoring screen shows what everyone took. The next hand is dealt once every connected player has clicked Continue.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'Once the first pass has been made, a disconnected player keeps their seat and the game waits for them (before that, a disconnect frees the seat and the cards are redealt). If they are dismissed, the game ends, since it needs four, and the lowest score among those left wins. The hand in progress is not scored.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask everyone to undo the last card played. It is undone only if every connected player approves. Passing and Continue are not moves, so an undo goes back past them.'
  },
  {
    question: 'Can the rules be changed?',
    answer: 'Before play starts the host can choose the score that ends the game: 50, 75, 100 or 150 points. Everyone has to agree before play starts, and the rules cannot change afterwards.'
  }
];
