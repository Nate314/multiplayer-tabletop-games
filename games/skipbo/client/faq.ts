import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Be the first to play every card of your stock pile onto the building piles. The game is a single round with no points.'
  },
  {
    question: 'What is in the deck?',
    answer: '162 cards: twelve each of the numbers 1 to 12 and 18 Skip-Bo cards, which are wild. Each player gets a stock pile of 30 cards with 2 to 4 players, or 20 with 5 or 6. Only the top card of each stock is face up.'
  },
  {
    question: 'How does a turn work?',
    answer: 'Your hand is filled to 5 cards from the draw pile when your turn starts. Then play as many cards as you like onto the four building piles, from your hand, the top of your stock or the top of any of your four discard piles. If you play your whole hand, you draw 5 more and keep going. End your turn by putting one hand card on one of your discard piles.'
  },
  {
    question: 'How do building piles work?',
    answer: 'There are four shared building piles. An empty one starts with a 1 or a Skip-Bo, and each pile takes the next number up: 2 on 1, 3 on 2, and so on to 12. A Skip-Bo counts as whatever number the pile needs next, and shows that number. A pile that reaches 12 is shuffled into the draw pile and the space is free again.'
  },
  {
    question: 'How do discard piles work?',
    answer: 'Each player has four. Any hand card can go on any of your own discard piles, but only as the move that ends your turn. Only the top card of a discard pile can be played, and only onto a building pile, never onto another discard pile. Everyone can see every card in every discard pile.'
  },
  {
    question: 'How do I play a card?',
    answer: 'On your turn, click a card in your hand, your stock top or the top of one of your discard piles. The building piles it fits light up; click one to play it. With a hand card picked, your discard piles light up too; click one to discard and end your turn. Click the card again or Put back to change your mind.'
  },
  {
    question: 'What if the draw pile runs out?',
    answer: 'Completed building piles go back into the draw pile, so it usually refills. If it is empty, you simply draw fewer cards. With no cards in your hand you cannot discard, so click End turn after playing what you can. If every player in a row has to end their turn this way, nobody can ever play again, and the players with the fewest stock cards left win.'
  },
  {
    question: 'How do I read the screen?',
    answer: 'The draw pile and the four building piles are at the top, each showing what it needs next. Below them are your hand, your stock and your four discard piles, then every other player with their hand size, stock top and count, and discard piles. The player whose turn it is is outlined.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every player still in the game approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A disconnected player keeps their seat, and their turn waits for them. If the others vote to dismiss them, their hand, stock and discard piles are shuffled into the draw pile and their turns are skipped. The last player left wins. Nobody can join after the first move.'
  }
];
