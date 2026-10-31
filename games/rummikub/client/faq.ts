import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What are the tiles?',
    answer: 'There are 106 tiles: the numbers 1 to 13 in four colors (black, blue, orange and red), two of each, and two jokers. Everyone starts with 14 tiles on their rack and the rest stay face down in the pool. Nobody sees another player\'s rack or the pool, only how many tiles each holds.'
  },
  {
    question: 'What can I lay down?',
    answer: 'Groups of at least three tiles. A set is three or four tiles of the same number, all in different colors. A run is three or more numbers in a row in one color, such as blue 4, 5, 6. A run does not wrap around: 13 is never followed by 1.'
  },
  {
    question: 'What is the first meld?',
    answer: 'Your first play must be groups made only from your own tiles that add up to at least 30 points, counting each tile at its number and a joker as the tile it stands for. In that turn you may not add to or move the tiles already on the table. Players who have made their first meld are marked with a check.'
  },
  {
    question: 'How do I play tiles?',
    answer: 'On your turn, click a tile to pick it up, then click the tile it should go in front of, the + at the end of a group, or New group. You can also drag tiles, with the mouse or a finger, and drop them in the same places; a tile dropped anywhere else goes back. On a phone, drag a table tile sideways, since a swipe up or down on the table scrolls the page, or pick it with a tap. Click a held tile again to put it down. When every group is valid, click Play. The line under your rack says what is wrong, or that the play is ready.'
  },
  {
    question: 'How do I rearrange the table?',
    answer: 'After your first meld you may change the table freely during your turn: move tiles between groups, split a group with the thin bar between two of its tiles, or pick up a whole group with its handle and put it at the end of another group to merge them. At the end of the turn every group must be a valid set or run and you must have added at least one tile from your rack. Tiles that were on the table cannot go back to your rack. Click Reset to put the table back as it was.'
  },
  {
    question: 'Do other players see my changes?',
    answer: 'No. While you rearrange, the others see the table as it was at the start of your turn. They see your changes only when you click Play.'
  },
  {
    question: 'How do jokers work?',
    answer: 'A joker stands for any tile. In a run it stands for the number of its place, so put it where it belongs, for example between the red 4 and the red 6 to be a red 5 (hover over it to see what it stands for). In a set it stands for a missing color. After your first meld you may take a joker from the table by putting the tile it stands for, from your rack, in its place (in a set of three, either missing color). You must then play the freed joker in the same turn, in a new or existing group, together with at least two more tiles from your rack.'
  },
  {
    question: 'What if I cannot or do not want to play?',
    answer: 'Click Draw a tile to take one tile from the pool, which ends your turn. Drawing also throws away any changes you made to the table. When the pool is empty the button says Pass instead.'
  },
  {
    question: 'How does the game end?',
    answer: 'The first player to empty their rack wins. Everyone else loses the total of the tiles left on their rack, with a joker worth 30, and the winner gains the sum of those totals. If the pool is empty and every player passes in turn, the player with the lowest rack total wins and scores the same way; tied players share the win. The game is a single round.'
  },
  {
    question: 'Who goes first?',
    answer: 'Each player draws a tile and the highest number goes first; a joker counts lowest, and tied players draw again. The tiles go back in the pool before the racks are dealt, and the status line shows the draw. Play then passes in seat order. There is no turn timer.'
  },
  {
    question: 'How do I sort my rack?',
    answer: 'Click Color or Number above your rack. You can also pick up a rack tile, or drag it, and put it in front of another one at any time, even when it is not your turn. Only you see the order.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each color also shows its shape: black diamond, blue square, orange hexagon, red circle. Each numbered tile shows it in its top left corner; jokers have no color.'
  },
  {
    question: 'Why is a tile in my rack outlined?',
    answer: 'It is the tile you just drew. The outline stays until your move on your next turn, and it follows the tile when you rearrange your rack. Turn it off with Highlight newly drawn cards in Settings.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last turn. It is undone only if every player still in the game approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their tiles go back into the pool and their turns are skipped. The last player left wins.'
  }
];
