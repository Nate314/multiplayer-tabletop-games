import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Score the most points. You score for every route you claim, for each destination ticket whose two cities you connect with your own routes, and 10 points if you have the longest continuous path. Each ticket you do not complete costs its points at the end.'
  },
  {
    question: 'How does the game start?',
    answer: 'Everyone gets 45 trains, 4 train cards and 3 destination tickets. In seat order, each player keeps 2 or 3 of their tickets; the others go under the ticket deck. Then the first seat takes the first turn.'
  },
  {
    question: 'What can I do on my turn?',
    answer: 'One of three things: take 2 train cards, claim one route, or draw 3 destination tickets and keep at least 1.'
  },
  {
    question: 'How do I take train cards?',
    answer: 'Click a face-up card or the deck, twice. A face-up locomotive is your whole draw, and you cannot take one as your second card. A locomotive from the deck counts as one card. When three face-up cards are locomotives, all five are discarded and five more are turned up. When the deck runs out, the discards are shuffled into a new one.'
  },
  {
    question: 'How do I claim a route?',
    answer: 'Click the route on the map, then click a way to pay. A colored route takes cards of its color; a gray route takes any one color. Locomotives stand in for any color. You need as many cards and trains as the route has spaces. The route then shows in your color.'
  },
  {
    question: 'What about double routes?',
    answer: 'Some cities are joined by two tracks side by side. With 4 or 5 players, two different players may each take one, but nobody can take both. With 2 or 3 players only one of the two can be used: once one is claimed, the other is closed and drawn faded.'
  },
  {
    question: 'How many points is a route worth?',
    answer: 'By its length: 1 space scores 1, 2 score 2, 3 score 4, 4 score 7, 5 score 10 and 6 score 15. The points beside each player are their route points until the game ends.'
  },
  {
    question: 'How do I know which tickets are done?',
    answer: 'Your tickets are listed under your hand, and a completed one has a check mark. Point at a ticket to ring its two cities on the map. Nobody else sees your tickets, only how many you hold, until the final scoring.'
  },
  {
    question: 'When does the game end?',
    answer: 'When a player ends their turn with 2 trains or fewer, everyone, that player included, gets one last turn. Then tickets are shown and scored and the longest path bonus is given; players who tie for the longest path all get it.'
  },
  {
    question: 'Who wins a tie?',
    answer: 'The player who completed the most destination tickets, then the player with the longest path. If that is tied too, the win is shared.'
  },
  {
    question: 'What happens if a player leaves?',
    answer: 'A dismissed player\'s routes stay on the map, but they are out of the scoring. Their train cards are discarded and their tickets leave the game. If they were in the middle of their turn, the next player starts a fresh turn.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each train color also shows its shape: red circle, blue square, green triangle, yellow star, black diamond, white ring, orange hexagon, pink heart. Train cards and the middle car of each open colored route show it; locomotives and gray routes (any color) show none. A claimed route shows its owner\'s shape instead: red circle, blue square, green triangle, yellow star, purple cross, which the player list shows too.'
  },
  {
    question: 'Why is a train card in my hand outlined?',
    answer: 'It is a color you just drew. Both cards of a draw stay outlined until your move on your next turn. Turn it off with Highlight newly drawn cards in Settings.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask everyone to undo the last move. Each card drawn and each ticket choice is a move of its own. The undo happens only if every player still in the game approves.'
  }
];
