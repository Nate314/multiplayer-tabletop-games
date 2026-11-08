import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to six players. ' +
      'The game needs at least three, and nobody can join after the first move. Once three are seated a player is drawn ' +
      'at random to go first, and the 42 territories are dealt out from them with one army on each.'
  },
  {
    question: 'What is the goal?',
    answer: 'Conquer the world: control all 42 territories. A player who loses their last territory is eliminated.'
  },
  {
    question: 'How does the setup work?',
    answer: 'Each player has 35 armies with three players, 30 with four, 25 with five and 20 with six, less the one on each ' +
      'territory they were dealt. In turn order, each player places all their remaining armies in one move. Click your ' +
      'territories to add armies (choose 1, 5 or All per click), take one back with -1, then click Place all. You can also drag armies from the Your armies tray onto a territory.'
  },
  {
    question: 'How does a turn go?',
    answer: 'First reinforce: you get a third of your territories (rounded down, at least 3) plus the bonus of every whole ' +
      'continent you hold, plus any cards you trade. Place them by clicking your territories. Then attack as often as you ' +
      'like, then make one fortify move if you want, and the turn ends.'
  },
  {
    question: 'How do attacks work?',
    answer: 'Click one of your territories with at least 2 armies, then a highlighted enemy territory next to it (lines on ' +
      'the map are borders, dashed ones cross the sea; Alaska and Kamchatka meet across the edge). Choose 1 to 3 dice, ' +
      'never more than your armies there minus one, and roll. The defender always rolls as many dice as allowed: 2, or 1 ' +
      'with a single army. The highest dice are compared in pairs, each loses one army for the other side, and ties go to ' +
      'the defender. Blitz rolls the most dice again and again until the territory falls or you have 1 army left.'
  },
  {
    question: 'What happens when I capture a territory?',
    answer: 'Move armies in with the slider: at least as many as the dice you rolled, and one must stay behind. If that was ' +
      'the defender\'s last territory, they are eliminated and you take their cards.'
  },
  {
    question: 'How does fortifying work?',
    answer: 'Click Stop attacking and fortify, then a territory of yours, then a highlighted one connected to it through your ' +
      'own territories, choose how many armies with the slider and click Move. That ends your turn. You can also just click End turn.'
  },
  {
    question: 'How do cards work?',
    answer: 'End a turn in which you captured at least one territory and you draw a card. Trade three cards for armies while ' +
      'reinforcing: three of a kind, one each of infantry, cavalry and artillery, or any two with a wild. Sets are worth 4, ' +
      '6, 8, 10, 12 and 15 armies, then 5 more for each later set, counted over the whole game. If a traded card shows a ' +
      'territory you hold, 2 more armies go there (once a turn). With 5 or more cards at the start of your turn you must ' +
      'trade. Taking an eliminated player\'s cards that leaves you with 6 or more, you trade at once down to 4 or fewer and ' +
      'place those armies before attacking on.'
  },
  {
    question: 'Who can see my cards?',
    answer: 'Only you. Everyone sees how many cards each player holds and which cards are traded. The deck order is secret, ' +
      'and the History dialog shows no hands.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A player who disconnects keeps their seat, and their turn waits for them. A player dismissed by vote leaves their ' +
      'territories neutral (grey): neutral armies never attack and count for nobody, but they defend and can be captured. ' +
      'Their cards are discarded. If it was their turn, the next player\'s turn begins. When only one player holding ' +
      'territory is left, they win, so two players left keep fighting.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every player still in the game approves. ' +
      'An attack played again rolls new dice.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each color also shows its shape: red circle, blue square, green triangle, yellow star, purple cross, black diamond. Territory discs and the player list show it; neutral grey territories show none.'
  }
];
