import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to four ' +
      'players. The game needs at least two players, and nobody can join after the first move. With two players ' +
      'you sit on opposite sides of the board.'
  },
  {
    question: 'What is the goal?',
    answer: 'Move all four of your pawns from your nest (your colored corner) once around the track, ' +
      'counterclockwise, then up your colored home column to the center. The first player with all four pawns ' +
      'home wins.'
  },
  {
    question: 'How do the dice work?',
    answer: 'The dice are rolled for you at the start of your turn and shown beside the board. Each die moves one ' +
      'pawn by its number, and you can use them in either order, on the same pawn or on two pawns. A used die ' +
      'is faded. You must move while any die can be used. Your turn ends when both dice are used or neither can ' +
      'be used, and if no move is possible at all the turn passes on by itself with a message.'
  },
  {
    question: 'How do I move a pawn?',
    answer: 'On your turn, the pawns you can move glow. Click one to select it: each square it can reach is ' +
      'marked with the die that gets it there, such as 4, 2+3 or +20. Click a marked square to move. Click the ' +
      'selected pawn again to unselect it. The board is dimmed when it is not your turn.'
  },
  {
    question: 'How do I get a pawn out of the nest?',
    answer: 'With a 5. Either die showing 5, or both dice adding up to 5 (1 and 4, or 2 and 3, which uses both), ' +
      'moves a pawn from your nest onto your entry square, the safe square in your color next to your nest.'
  },
  {
    question: 'What happens when I roll doubles?',
    answer: 'You roll again once both dice are used or cannot be used. If you roll doubles three times in a row, ' +
      'your pawn furthest along the track (not one in your home column) goes back to your nest and your turn ends.'
  },
  {
    question: 'How do I capture?',
    answer: 'Land exactly on a single opponent pawn on a square that is not safe. It goes back to its nest and you ' +
      'earn a bonus move of 20 squares. Safe squares (marked with a ring, 12 in all) cannot be captured on, and ' +
      'two different colors may share one. The one exception: entering a pawn onto your entry square captures an ' +
      'opponent standing there.'
  },
  {
    question: 'How do bonus moves work?',
    answer: 'A capture earns +20 and getting a pawn home earns +10. A bonus is shown next to the dice and must be ' +
      'used whole by one pawn that is already out of the nest, at any point in the same turn. A bonus that no ' +
      'pawn can use when your turn ends is lost. Bonuses cannot bring a pawn out of the nest.'
  },
  {
    question: 'What is a blockade?',
    answer: 'Two pawns of the same color on one square form a blockade. Nobody, including their owner, can pass or ' +
      'land on it. A square never holds more than two pawns.'
  },
  {
    question: 'How do I get home?',
    answer: 'After going once around, a pawn turns into your home column. Reaching the center takes an exact ' +
      'roll; a die that would go past it cannot be used on that pawn.'
  },
  {
    question: 'How is this different from the box rules?',
    answer: 'Some rules are simplified. Each die is a separate move, except two dice adding up to 5 to enter. ' +
      'Entering with a 5 is never forced. Doubles do not add the faces underneath. A bonus goes to one pawn and ' +
      'is lost if it cannot be used. Entering on your entry square captures one opponent there, even if two ' +
      'pawns are on it.'
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
