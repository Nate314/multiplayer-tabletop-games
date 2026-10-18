import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Be the first player to play every card in your hand. The game is a single round: whoever empties their hand first wins, and there are no points.'
  },
  {
    question: 'What is in the deck?',
    answer: 'The standard 108 cards. Each of the four colors has one 0, two each of 1 to 9, and two each of Skip, Reverse and Draw Two. There are also 4 Wild and 4 Wild Draw Four cards.'
  },
  {
    question: 'How does the game start?',
    answer: 'Everyone is dealt 7 cards and the top card of the deck starts the discard pile. Player 1 goes first. If the starting card is an action card, it acts as if played just before Player 1: a Skip skips Player 1, a Reverse turns play around so the last player starts, and a Draw Two makes Player 1 draw 2 and lose their turn. After a starting Wild, the first player may play any card. A starting Wild Draw Four goes back into the deck and another card is flipped.'
  },
  {
    question: 'Which cards can I play?',
    answer: 'A card that matches the top of the discard pile by color, or by number or symbol. A Wild or a Wild Draw Four can be played on anything. The cards you can play are raised and outlined; the rest are dimmed.'
  },
  {
    question: 'How do I play a Wild?',
    answer: 'Click it, then click the color you want. The next player must match that color, or play a Wild. Click Cancel to put the Wild back.'
  },
  {
    question: 'What if I cannot or do not want to play?',
    answer: 'Click Draw, or the draw pile, to take one card. If that card can be played you may play it right away, or click Pass to keep it. If it cannot be played, your turn ends by itself. You may draw even when you hold a playable card, but only one card per turn.'
  },
  {
    question: 'What do the action cards do?',
    answer: 'Skip: the next player loses their turn. Reverse: the direction of play turns around; with two players it acts as a Skip. Draw Two: the next player draws 2 cards and loses their turn. Wild Draw Four: you choose the color, and the next player draws 4 cards and loses their turn.'
  },
  {
    question: 'Can a Wild Draw Four be challenged?',
    answer: 'No. This version has no challenge rule, so you may play a Wild Draw Four at any time, even when you hold a card of the current color.'
  },
  {
    question: 'Do I have to call UNO?',
    answer: 'No. There is no penalty for forgetting. A player with one card left shows an UNO! badge so everyone can see it.'
  },
  {
    question: 'What happens when the draw pile runs out?',
    answer: 'Every card in the discard pile except the top one is shuffled into a new draw pile. If every card is in someone\'s hand, there is nothing to draw and you may pass.'
  },
  {
    question: 'Can I see other players\' cards or the draw pile?',
    answer: 'No. You see only your own hand, and how many cards each other player holds. The order of the draw pile is hidden from everyone.'
  },
  {
    question: 'How do I know whose turn it is and which way play goes?',
    answer: 'The status panel says whose turn it is, and that player\'s name is outlined in the list of players. The players are listed in seat order, and the direction line shows an arrow pointing the way play goes. The current color is shown under the discard pile.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last turn. It is undone only if every player still in the game approves, and every hand and pile goes back to how it was before that turn.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn and the others may vote to dismiss them. A dismissed player\'s cards go to the bottom of the draw pile and their turns are skipped. If only one player is left, they win.'
  }
];
