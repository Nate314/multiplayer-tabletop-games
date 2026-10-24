import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Put the ten cards in your rack in ascending order, lowest in slot 1 and highest in slot 10. The first player to do it calls Rack-O and ends the round. The first player to reach 500 points wins the game.'
  },
  {
    question: 'What is in the deck?',
    answer: 'Cards numbered 1 to 60 for four players, 1 to 50 for three and 1 to 40 for two. Everyone gets ten cards, dealt into their rack one at a time from slot 10 down to slot 1. The next card is turned face up to start the discard pile.'
  },
  {
    question: 'How does a turn work?',
    answer: 'Take the top card of the draw pile or of the discard pile. Then swap it for the card in any one slot of your rack: the card you take out goes face up on the discard pile. A card from the draw pile may instead be discarded straight away. A card taken from the discard pile must go into your rack. Cards cannot be moved between slots, only replaced.'
  },
  {
    question: 'How do I play a turn on the screen?',
    answer: 'Click the draw pile or the discard pile. The card you took appears beside the piles, and every slot of your rack becomes a button: click one to swap. A card from the draw pile also has a Discard button. Only you can see a card you took from the draw pile.'
  },
  {
    question: 'How is a round scored?',
    answer: 'The player who calls Rack-O scores 75 points. Every other player scores 5 points for each card in ascending order counting from slot 1, stopping where the order breaks. A scoring screen shows every rack, and the next round is dealt once every connected player has pressed Continue.'
  },
  {
    question: 'What if the draw pile runs out?',
    answer: 'The discard pile, except its top card, is shuffled to make a new draw pile. If there is nothing to shuffle, only the discard pile can be drawn from.'
  },
  {
    question: 'Why is the card in my hand outlined?',
    answer: 'It is the card you just drew. The outline stays while you hold it, until you swap it into your rack or discard it. Turn it off with Highlight newly drawn cards in Settings.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every connected player approves. The draw pile is reshuffled after an undo, so redrawing does not show what was coming.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A disconnected player keeps their seat, and their turn waits for them. If the others vote to dismiss them, their rack goes back into the draw pile and their turns are skipped. The last player left wins. Nobody can join after the first move.'
  }
];
