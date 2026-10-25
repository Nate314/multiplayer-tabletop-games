import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Complete the ten phases in order, one per hand at most. The game ends after a hand in which someone completes phase 10. Among the players who completed it, the lowest score wins. If that score is tied, the tied players play a tiebreaker hand of phase 10 on their own, decided the same way.'
  },
  {
    question: 'What are the ten phases?',
    answer: '1: 2 sets of 3. 2: 1 set of 3 and 1 run of 4. 3: 1 set of 4 and 1 run of 4. 4: 1 run of 7. 5: 1 run of 8. 6: 1 run of 9. 7: 2 sets of 4. 8: 7 cards of one color. 9: 1 set of 5 and 1 set of 2. 10: 1 set of 5 and 1 set of 3.'
  },
  {
    question: 'What are sets, runs and color groups?',
    answer: 'A set is cards of the same number, in any colors. A run is numbers in a row, such as 4 5 6 7, in any colors; runs go from 1 to 12. A color group is cards of one color with any numbers.'
  },
  {
    question: 'What is in the deck?',
    answer: '108 cards: the numbers 1 to 12 in red, blue, green and yellow, twice each, plus 8 Wilds and 4 Skips. Each player is dealt 10 cards, and one card starts the discard pile.'
  },
  {
    question: 'How does a turn work?',
    answer: 'First draw one card, from the draw pile or the top of the discard pile. Then you may lay down your phase, and once your phase is down you may hit. End your turn by discarding one card. The turn stays with you until you discard.'
  },
  {
    question: 'How do I lay down my phase?',
    answer: 'After drawing, select cards in your hand and click "Add selected to group 1" (or group 2). Click a staged card to put it back, or Clear to start over. "Lay down phase" is enabled once every group is right. You must use exactly the cards the phase asks for, and you can lay down only once per hand.'
  },
  {
    question: 'How do Wilds work?',
    answer: 'A Wild stands for any number or color in a set, run or color group. Each group needs at least one real number card. In a run, a Wild shows the number it stands for under its W.'
  },
  {
    question: 'What is hitting?',
    answer: 'Once your own phase is down, you can add cards to any group on the table, yours or another player\'s: matching numbers on a set, the next number at either end of a run, the same color on a color group, or a Wild. Select the cards, then click "Hit here" on the group.'
  },
  {
    question: 'What does a Skip do?',
    answer: 'Discard a Skip and choose another player: they lose their next turn. A player already waiting to be skipped cannot be chosen again. A Skip cannot be picked up from the discard pile, and it cannot go in a group. If the card turned up to start the discard pile is a Skip, the first player of the hand is skipped.'
  },
  {
    question: 'How does a hand end?',
    answer: 'When a player has no cards left, by discarding their last card or by hitting it. Everyone else scores the cards left in their hand: 5 points for each 1 to 9, 10 for each 10 to 12, 15 for a Skip and 25 for a Wild. Everyone who laid down their phase moves on to the next phase; the rest try the same phase again.'
  },
  {
    question: 'What happens between hands?',
    answer: 'A scoring screen shows each player\'s phase, the cards they had left and their total. The next hand is dealt once every connected player has clicked Continue. The deal moves one seat on, and the player after the dealer starts.'
  },
  {
    question: 'What if the draw pile runs out?',
    answer: 'The discard pile, except its top card, is shuffled to make a new draw pile.'
  },
  {
    question: 'How do I read the screen?',
    answer: 'The draw pile and discard top are at the top. Your hand is below them; sort it by number or color with the Sort buttons. Every player is listed with their phase, score, card count and the groups they laid down. The player whose turn it is is outlined, and your hand is dimmed when it is not your turn.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every player still in the game approves.'
  },
  {
    question: 'Can the rules be changed?',
    answer: 'Before play starts the host can turn on "Phases in any order". Then each hand you choose which phase to lay down, any phase you have not completed yet, instead of the next one in order. Completing all ten finishes the game, with the same lowest-score win and tiebreaker hand of phase 10. Everyone has to agree before play starts, and the rules cannot change afterwards. Ticking \'I know what I\'m doing\' lets the host seat up to 8 players instead of 6.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their groups stay on the table, but their turns are skipped and they cannot win. The last player left wins. Nobody can join after the first move.'
  }
];
