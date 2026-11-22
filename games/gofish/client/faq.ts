import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Collect books: all four cards of one rank. The game ends when all 13 books are down, and the player with the most books wins. Players tied for the most books share the win.'
  },
  {
    question: 'How are the cards dealt?',
    answer: 'A standard 52-card deck is shuffled. With 2 or 3 players everyone gets 7 cards, with 4 to 6 players everyone gets 5. The rest is the stock, face down. A random player goes first, and play goes up the seats.'
  },
  {
    question: 'What can I ask for?',
    answer: 'On your turn you ask one player for a rank. You may only ask for a rank you hold at least one card of, and only a player who still has cards.'
  },
  {
    question: 'What happens when I ask?',
    answer: 'If the player has any cards of that rank, they hand you all of them and you ask again. If not, they say "go fish" and you draw the top card of the stock. If it is the rank you asked for, everyone sees it and you ask again; otherwise the turn passes to the next player.'
  },
  {
    question: 'When are books laid down?',
    answer: 'As soon as you hold all four of a rank, they go down as a book in front of you, even right after the deal. The table shows each player\'s books.'
  },
  {
    question: 'What if I run out of cards?',
    answer: 'You draw one card from the stock straight away. If the stock is empty you are out of cards: your turns are skipped and nobody can ask you, but your books still count at the end.'
  },
  {
    question: 'What if the stock is empty when I go fish?',
    answer: 'You draw nothing and the turn passes to the next player.'
  },
  {
    question: 'Can I see other players\' cards?',
    answer: 'No. You see your own hand and how many cards everyone else holds. Every ask and its answer is listed under Asks so far, as everyone at a real table would hear it. A card you draw is shown to you; it is shown to everyone only when it was the rank you asked for.'
  },
  {
    question: 'Why is a card in my hand outlined?',
    answer: 'It is the card you fished from the stock. The outline stays until your next ask. Cards another player hands you are not outlined. Turn it off with Highlight newly drawn cards in Settings.'
  },
  {
    question: 'Can I take back an ask?',
    answer: 'Undo takes back the last ask, but only if every player still in the game approves. Every hand and the stock go back to how they were.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn, and the others may vote to dismiss them. A dismissed player\'s cards are shuffled into the stock, their books stay down, and the turn moves on. If only one player is left, they win.'
  }
];
