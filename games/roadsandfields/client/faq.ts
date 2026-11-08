import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to five players. ' +
      'The game needs at least two, and nobody can join after the first move. The first player to join goes first, and turns go up through the seats.'
  },
  {
    question: 'What is the goal?',
    answer: 'Lay land tiles one at a time to build a countryside of cities, roads, monasteries and fields, and claim them ' +
      'with your seven meeples. Points come from finished features during the game and from everything still claimed at ' +
      'the end. The highest score when the last tile is placed wins; tied players share the win.'
  },
  {
    question: 'How does a turn go?',
    answer: 'The tile you must place is drawn for you and shown to everyone. Click one of the highlighted squares to put it ' +
      'there (or drag the tile onto one), turn it with the Turn buttons, and click Place tile. Then click one of the circles on your tile to put a ' +
      'meeple there (or drag the meeple from the tray onto it) and click Place meeple, or click No meeple. Anything you finished scores at once.'
  },
  {
    question: 'Where can a tile go?',
    answer: 'Next to at least one tile on the board, with every touching side matching: city to city, road to road and ' +
      'field to field. The board only highlights squares where the tile fits, and turning the tile only offers the turns ' +
      'that fit there. A drawn tile that fits nowhere at all is set aside out of the game and another is drawn for you.'
  },
  {
    question: 'Where can a meeple go?',
    answer: 'Only on the tile you just placed: on a city (a knight), a road (a thief), the monastery (a monk) or a field ' +
      '(a farmer, lying down). The road, city or field it joins must not already have a meeple on it anywhere, even far ' +
      'away. Two separately claimed features can still grow together later, and then they are shared.'
  },
  {
    question: 'How is scoring done during the game?',
    answer: 'A road is finished when both ends stop (at a junction, a city, a monastery, or by looping) and scores 1 point a ' +
      'tile. A city is finished when its walls close and scores 2 points a tile and 2 for each pennant. A monastery is ' +
      'finished when all eight squares around it are filled and scores 9. The meeples on a finished feature go back to their players.'
  },
  {
    question: 'Who scores a shared feature?',
    answer: 'The player with the most meeples on it takes all its points. Players tied for most each score the full points. ' +
      'Everyone else on it scores nothing, but still gets their meeples back.'
  },
  {
    question: 'What happens at the end?',
    answer: 'After the last tile, everything still claimed scores: an unfinished road 1 a tile, an unfinished city 1 a tile and ' +
      '1 a pennant, an unfinished monastery 1 plus 1 for each tile around it. Each field scores 3 points for every finished ' +
      'city it touches, for the player with the most farmers on it. The table under the scores shows what the end added.'
  },
  {
    question: 'How do I move around the board?',
    answer: 'Drag the board to pan it, and use the mouse wheel or the + and − buttons to zoom. Fit shows the whole board again. ' +
      'The tile placed last is outlined.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A dismissed player scores nothing more. Their meeples stay on the board, still holding their features, but they ' +
      'count for nobody when those features score. If they had placed their tile but not chosen a meeple, their turn ends ' +
      'without one; if they had not placed it, the next player places that tile. The last player left wins.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Any player can ask to undo the last move: placing a tile and choosing a meeple are each one move. It is undone ' +
      'only if every player still in the game approves.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each meeple color also shows its shape: red circle, blue square, yellow star, green triangle, black diamond. Meeples on the board, the meeple you are about to place and the player list show it.'
  }
];
