import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'Whose turn is it?',
    answer: 'Nobody\'s. Everyone trades at once, so make offers and accept them as fast as you like.'
  },
  {
    question: 'What is an offer?',
    answer: 'It is 1 to 4 cards of one commodity from your hand. Everyone sees only how many cards you offer, such as "Alice: 3!". Your offered cards are shown raised. You can take the offer back, or make a new one to replace it.'
  },
  {
    question: 'How does a trade work?',
    answer: 'Put up an offer with the same number of cards as someone else\'s, then accept theirs. The cards swap blind: you only find out what you got once it lands in your hand.'
  },
  {
    question: 'What does "Already taken" mean?',
    answer: 'Someone else accepted that offer a moment before you, or its owner changed it. Nothing is lost: your own offer stays open for the next trade.'
  },
  {
    question: 'How do I win a round?',
    answer: 'Collect all 9 cards of one commodity and corner them to score the value printed on its cards; Saffron is worth the most at 100. The first to the target score, 500 unless the house rules say 250, wins the game.'
  },
  {
    question: 'What are the Bull and the Bear?',
    answer: 'With the Bull and Bear house rule, two extra cards join the deck, and either can ride along in any offer. The Bull is wild: 8 of a commodity plus the Bull corners for its value, and all 9 plus the Bull corners for double. You cannot corner while holding the Bear. When a round ends, whoever holds the Bear loses 20 points, and so does whoever holds the Bull without cornering.'
  },
  {
    question: 'What happens between rounds?',
    answer: 'The round scoring shows the winning corner, its hand and every penalty. When everyone continues, new hands are dealt.'
  }
];
