import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How do I place a word?',
    answer: 'On your turn, click a tile on your rack, then click an empty square on the board. Repeat for each letter. Click a tile you placed this turn to put it back on your rack, or click Recall to take them all back. You can also drag a tile from your rack onto an empty square, drag a placed tile to another empty square to move it, or drag it onto your rack to take it back. When the word is ready, click Play.'
  },
  {
    question: 'Where can tiles go?',
    answer: 'All the tiles you place in one turn go in a single row or a single column, with no gaps except squares already filled. The first word must cover the center star and use at least two tiles. Every later word must touch a tile already on the board.'
  },
  {
    question: 'Is there a dictionary?',
    answer: 'No. The site does not check words, so any letters placed by the rules above are accepted. If you think a word is not real, ask for an Undo: the play is taken back only if every player still in the game approves, so the player who made it can agree or argue their case.'
  },
  {
    question: 'How is a play scored?',
    answer: 'Every word the play forms is scored: the main word and each word crossing it. A word is the sum of its letter values. DL and TL double or triple the letter on them, and DW and TW (and the center star, a DW) double or triple the whole word. Premium squares count only on the turn a tile is placed on them. Using all seven tiles in one turn earns 50 bonus points.'
  },
  {
    question: 'What does the Play button show?',
    answer: 'While you place tiles, the line below your rack shows every word the play forms and its score, or why the tiles cannot be played yet. Play is enabled only when the placement follows the rules.'
  },
  {
    question: 'How do blank tiles work?',
    answer: 'There are two blanks, worth 0 points. When you place one, pick the letter it stands for from the letters shown under your rack. It stays that letter for the rest of the game and is shown in a different color.'
  },
  {
    question: 'Can I swap tiles?',
    answer: 'Yes, while the bag holds at least 7 tiles. Click Exchange, select the tiles to swap, then click the Exchange button again to confirm. You draw new tiles first and the old ones go back in the bag. An exchange uses your turn and scores nothing. You can also click Pass to skip your turn.'
  },
  {
    question: 'What does Shuffle do?',
    answer: 'It mixes the order of the tiles on your rack, to help you spot words. Only you see it, and you can shuffle at any time. To put a tile in a place of your choosing, drag it to that place on your rack, even when it is not your turn.'
  },
  {
    question: 'How many tiles are there?',
    answer: 'The standard 100 English tiles. Common letters are worth 1, and Q and Z are worth 10. Each tile shows its value. You hold 7, and after each play you draw back up to 7 while the bag has tiles. The side panel shows how many tiles each player holds and how many are left in the bag, but nobody sees another player\'s rack.'
  },
  {
    question: 'When does the game end?',
    answer: 'When a player uses their last tile while the bag is empty, that player adds the value of every other rack to their score, and each other player loses the value of their own rack. After six scoreless turns in a row (passes, exchanges or plays worth 0), any player may click End game, and then everyone loses the value of their rack; until someone does, play goes on. The highest score wins; tied players share the win.'
  },
  {
    question: 'Who goes first?',
    answer: 'Each player draws a tile from the bag, and the one closest to A goes first; a blank beats every letter. Tied players draw again. The tiles go back in the bag before the racks are dealt, and the status line shows the draw. Play then passes in seat order. The draw is redone whenever someone joins or leaves before the first move, and nobody can join after it.'
  },
  {
    question: 'How does the turn limit work?',
    answer: 'The host can turn on a turn limit of 1, 2, 3 or 5 minutes per turn, and every player must agree to the house rules first. The limit starts when everyone has agreed and begins again at every turn. If your time runs out, your turn passes and counts as a scoreless turn, and any tiles you had put on the board go back to your rack. Undo gives the restored turn a full limit. In the last 10 seconds of your turn a tick plays each second, unless Timer warnings is off in Settings.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last turn. It is undone only if every player still in the game approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their tiles go back in the bag and their turns are skipped. Their score stays on the scoreboard, but they cannot win. The last player left wins.'
  }
];
