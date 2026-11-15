import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Score points by pegging and by counting your hand, and be the first to move your front peg to 121 (or 61 if the host chose the short game). The game ends the moment a side reaches the target, even in the middle of a hand.'
  },
  {
    question: 'How many can play?',
    answer: '2, 3 or 4. With 2, each player gets 6 cards and lays 2 in the crib. With 3, each gets 5 and lays 1, and one card from the deck goes to the crib. With 4, seats 1 and 3 play as partners against seats 2 and 4, each gets 5 and lays 1, and partners share one score.'
  },
  {
    question: 'Who deals?',
    answer: 'At the start each player is dealt one card and the lowest deals (ace is low); a tie deals again. After each hand the deal passes to the left. The crib belongs to the dealer.'
  },
  {
    question: 'How do I lay cards in the crib?',
    answer: 'Everyone discards at the same time. Tap the cards you want to give away, then click Send to crib. Once everyone has, the player after the dealer clicks Cut to turn up the starter. If the starter is a jack, the dealer scores 2 for his heels.'
  },
  {
    question: 'How does pegging work?',
    answer: 'Starting after the dealer, each player plays a card and the count goes up by its value (face cards are 10, aces 1). The count may never pass 31: cards that would take it past are greyed out, and when none of yours fit, click Go. A count of 15 or exactly 31 scores 2, a pair 2, three of a kind 6, four of a kind 12, and a run of three or more cards scores one per card. When nobody can play, the last player to play scores 1 for the go and the count starts again at 0. The very last card of the hand scores 1, unless it made 31.'
  },
  {
    question: 'How are hands counted?',
    answer: 'After pegging, each hand is counted with the starter: the player after the dealer first, the dealer last, then the dealer counts the crib. Each set of cards adding to 15 scores 2, each pair 2, each run of three or more one per card, four cards of one suit in the hand 4 (5 if the starter matches), and the jack of the starter\'s suit 1 (his nobs). The crib scores a flush only when all four crib cards and the starter share a suit. Every count shows its breakdown, such as "Fifteen two, fifteen four, and a pair is six".'
  },
  {
    question: 'What is Muggins?',
    answer: 'A house rule the host can turn on. You count your own hand and crib by entering a number and clicking Claim. If you claim too much, the score is corrected to the true total. If you claim too little, the opponents have 20 seconds to press Muggins! and take the points you missed, or No Muggins. If nobody presses, you keep only what you claimed. With 3 players the first opponent to press takes the points; with 4 they go to the presser\'s partnership. Pegging is always counted for you.'
  },
  {
    question: 'What are the Muggins styles?',
    answer: 'Name the points (the standard): the opponents see only your cards and your claim; after pressing Muggins! they tap the cards of a combination you missed and click Claim these, and a wrong choice is refused with no cost. Single press: one press takes the whole difference, but pressing when nothing was missed costs the presser 2 points (never below 0). Shown total: the breakdown is shown to everyone during the 20 seconds, and the first opponent to press takes the missed points.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A disconnected player keeps their seat and the game waits for them. If a player leaves a 2-player game, they lose. With 3, the hand in progress is dropped, the scores are kept, and a new hand is dealt for the two who remain. With 4, the partnership is broken, so the game ends and the other team wins.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every connected player approves. The cards nobody has seen are shuffled again, so an undone cut turns up a new starter. Continue is not a move, so an undo goes back past it.'
  },
  {
    question: 'Can the rules be changed?',
    answer: 'Before play starts the host can choose a game of 121 or 61 points and turn on Muggins with its style. Everyone has to agree before play starts, and the rules cannot change afterwards.'
  }
];
