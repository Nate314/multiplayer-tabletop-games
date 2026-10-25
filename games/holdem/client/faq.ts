import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Win chips. Everyone starts with 1,000 play chips. The game ends when one player has every chip, or when every player still holding chips votes to end it between hands; then the most chips wins.'
  },
  {
    question: 'How does a hand go?',
    answer: 'Each player is dealt two private cards. There is a round of betting, then three shared cards are dealt (the flop) and another round, then a fourth (the turn) and a round, then a fifth (the river) and a last round. A card is burned before each deal. If more than one player is still in, the hands are shown and the best five cards from your two and the five shared cards win.'
  },
  {
    question: 'What are the button and the blinds?',
    answer: 'The D marks the dealer button, which moves one player to the left each hand, skipping players who are out of chips. The player left of it posts the small blind of 10 and the next player the big blind of 20. With two players the button posts the small blind and acts first before the flop. The first player to join has the first button.'
  },
  {
    question: 'Who acts first?',
    answer: 'Before the flop, the player left of the big blind. After it, the first player still in left of the button. A player who is all in is skipped.'
  },
  {
    question: 'How do I bet?',
    answer: 'On your turn click Fold, Check (when there is nothing to call) or Call. To bet or raise, type the total you want your bet to be this round in Amount and click Bet or Raise to, or click All in.'
  },
  {
    question: 'How much must a raise be?',
    answer: 'A first bet is at least the big blind, 20. A raise must add at least as much as the last bet or raise this round. You may always go all in for less. An all-in that is less than a full raise does not let players who already acted raise again, unless the raises since they acted add up to a full one.'
  },
  {
    question: 'When does a betting round end?',
    answer: 'When every player still in has acted and has put in the same amount, or is all in. When nobody can bet any more, the rest of the board is dealt and the hands are shown.'
  },
  {
    question: 'What are side pots?',
    answer: 'A player who is all in can win only what they could match from each other player. Chips above that go into a side pot that only the players who put them in can win. The table lists each pot, and each side pot with who can win it. A bet nobody called goes back to the player who made it.'
  },
  {
    question: 'How are hands ranked?',
    answer: 'From high to low: straight flush (a royal flush is the best), four of a kind, full house, flush, straight, three of a kind, two pair, one pair, high card. Ties are broken by the remaining cards (kickers). Aces are high, but A-2-3-4-5 is the lowest straight. Suits never count.'
  },
  {
    question: 'What if hands tie?',
    answer: 'The pot is split equally. Any odd chips go one each to the winners closest to the left of the button.'
  },
  {
    question: 'Who sees which cards?',
    answer: 'You see only your own two cards. At a showdown the hands still in are shown with their best hand named. A player who folds, or who wins because everyone else folded, keeps their cards hidden. The order of the deck is hidden from everyone.'
  },
  {
    question: 'What happens after a hand?',
    answer: 'The result shows each pot and who won it. Every connected player with chips clicks Continue to deal the next hand. Between hands, players with chips may click Vote to end the game; the game ends when all of them have voted. Votes are cleared when the next hand starts.'
  },
  {
    question: 'What if I run out of chips?',
    answer: 'You are out for the rest of the game. You can keep watching, but you are not dealt in and you do not vote.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every connected player approves. The deck is reshuffled, so an undo cannot show the next card. Continue and votes are not moves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn and the others may vote to dismiss them. A dismissed player folds their hand, and their chips leave the table; what they already bet stays in the pot and the hand goes on.'
  },
  {
    question: 'How many can play?',
    answer: 'Two to 8 players. Ticking \'I know what I\'m doing\' in the house rules lets the host seat up to 10. Everyone has to agree to the table before play starts.'
  }
];
