import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Win all 52 cards. A player who runs out of cards loses.'
  },
  {
    question: 'How are the cards dealt?',
    answer: 'The standard 52-card deck is shuffled and dealt out evenly, so each player starts with a face-down pile of 26. Nobody sees the order of any pile, not even their own.'
  },
  {
    question: 'How does a battle work?',
    answer: 'Each player turns up the top card of their pile. The higher card takes both; aces are high and suits do not matter. Here each player flips their own card: the player whose turn it is flips, then the other player, and the battle is settled on the second flip. The player who flipped second starts the next battle.'
  },
  {
    question: 'What happens on a tie?',
    answer: 'It is war. Each player puts one card face down and one face up, and the higher face-up card takes every card in the battle. Another tie means another war. The player who flipped second in the tied round starts the war, and each flip puts in both of that player\'s war cards.'
  },
  {
    question: 'What if I run out of cards during a war?',
    answer: 'If you have one card left, it goes face up with no face-down card. If you have none left, your last face-up card stands for the rest of the war. If you lose the war you lose the game. If both players run out of cards on a tie, each takes back their own cards and play goes on.'
  },
  {
    question: 'Where do won cards go?',
    answer: 'Under the winner\'s pile, in random order. The rules do not fix the order, and a fixed order can make a game go on forever.'
  },
  {
    question: 'What does Auto-flip do?',
    answer: 'When it is ticked, your card is flipped for you one second after your turn comes up, so a long game can play itself. It works only in your own browser tab and is off again when you reload the page.'
  },
  {
    question: 'How do I flip?',
    answer: 'Click Flip, or click your own pile at the bottom of the table, when it is your turn.'
  },
  {
    question: 'Can I take back a flip?',
    answer: 'Click Undo to ask to undo the last flip. It is undone only if both players approve.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn and the other player may vote to dismiss them. A dismissed player loses, and the player left wins.'
  }
];
