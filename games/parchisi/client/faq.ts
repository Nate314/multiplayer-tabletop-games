import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to four ' +
      'players. The game needs at least two players, and nobody can join after the first move. With two players ' +
      'you sit on opposite sides of the board.'
  },
  {
    question: 'Who goes first, and whose turn is next?',
    answer: 'Once two players are seated, everyone rolls one die and the lowest roll goes first; players tied for ' +
      'the lowest roll again. Turns then pass to the player on the left, clockwise around the board: bottom, ' +
      'left, top, right. The player list shows the players in turn order.'
  },
  {
    question: 'What is the goal?',
    answer: 'Move all four of your pawns from your nest (your colored corner) once around the track, ' +
      'counterclockwise, then up your colored home column to the center. The first player with all four pawns ' +
      'home wins.'
  },
  {
    question: 'How do the dice work?',
    answer: 'The dice are rolled for you at the start of your turn and shown beside the board. Move one pawn by ' +
      'each die, in either order, or one pawn by the total of both dice. A pawn moved by the total goes one die ' +
      'at a time: the square the first die reaches must be one it could land on, and it captures there. A used ' +
      'die is faded. Every die that can be used must be, and if only one of the two can be used, it must be the ' +
      'larger. If no move is possible at all the turn passes on by itself with a message.'
  },
  {
    question: 'How do I move a pawn?',
    answer: 'On your turn, the pawns you can move glow. Click one to select it: each square it can reach is ' +
      'marked with the dice that get it there, such as 4 for one die, 2+3 for the total of both, or +20 for a ' +
      'bonus. Click a marked square to move. Click the selected pawn again to unselect it. The board is dimmed ' +
      'when it is not your turn.'
  },
  {
    question: 'How do I get a pawn out of the nest?',
    answer: 'With a 5. Either die showing 5, or both dice adding up to 5 (1 and 4, or 2 and 3, which uses both), ' +
      'moves a pawn from your nest onto your entry square, the safe square in your color next to your nest. ' +
      'You cannot enter while two pawns stand on your entry square.'
  },
  {
    question: 'What happens when I roll doubles?',
    answer: 'Each die is a move. If all four of your pawns are out of the nest (home counts as out), you also get ' +
      'the two faces underneath, 7 minus the top face, shown with dashed edges: double 2 gives 2, 2, 5 and 5. ' +
      'You roll again only if you used every die. If you roll doubles three times in a row, your pawn closest ' +
      'to home, even one in your home column, goes back to your nest and your turn ends.'
  },
  {
    question: 'How do I capture?',
    answer: 'Land exactly on a single opponent pawn on a square that is not safe. It goes back to its nest and you ' +
      'earn a bonus move of 20 squares. Safe squares are marked with a ring, 12 in all, and you cannot land on ' +
      'one held by an opponent. The one exception: entering a pawn onto your entry square captures a single ' +
      'opponent standing there.'
  },
  {
    question: 'How do bonus moves work?',
    answer: 'A capture earns +20 and getting a pawn home earns +10. A bonus is shown next to the dice and is taken ' +
      'after all your dice, used whole by one pawn that is already out of the nest. A bonus that no pawn can use ' +
      'is lost. Bonuses cannot bring a pawn out of the nest.'
  },
  {
    question: 'What is a blockade?',
    answer: 'Two pawns of the same color on one square form a blockade. Nobody, including their owner, can pass or ' +
      'land on it, and an opponent cannot enter onto it. A square never holds more than two pawns. On doubles, ' +
      'once one pawn leaves a blockade, the other stays put for the rest of that roll, so the pair never moves ' +
      'forward together.'
  },
  {
    question: 'How do I get home?',
    answer: 'After going once around, a pawn turns into your home column. Reaching the center takes an exact ' +
      'roll; a die that would go past it cannot be used on that pawn.'
  },
  {
    question: 'How is this different from the rules on Wikipedia?',
    answer: 'Three doubles in a row are penalized, which Wikipedia lists as a variant. Breaking a blockade with ' +
      'double one and local limits on how long a blockade may stay are not used. A pawn always turns into its ' +
      'home column after one lap. The dice are rolled for you and the turn ends by itself once no move is left.'
  },
  {
    question: 'What do Undo and History do?',
    answer: 'Undo asks everyone to take back the last move; it happens only if every player still in the game ' +
      'approves. An undone move that ended a turn may roll different dice when it is played again. History, at ' +
      'the top of the page, steps through every move so far with the moved pawn\'s squares outlined.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their pawns are taken off the board and their turns are skipped. The last player left wins.'
  }
];
