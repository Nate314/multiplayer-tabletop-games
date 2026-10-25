import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Empty your hand to win the round. You then score the cards left in everyone else\'s hands, and the first player to reach the target score (500 unless the host chose another) wins the game.'
  },
  {
    question: 'What is in the deck?',
    answer: 'The standard 108 cards. Each of the four colors has one 0, two each of 1 to 9, and two each of Skip, Reverse and Draw Two. There are also 4 Wild and 4 Wild Draw Four cards.'
  },
  {
    question: 'Who deals and who goes first?',
    answer: 'For the first round, each player draws a card and the highest number deals; a card that is not a number counts lowest, and tied players draw again. The deck is then reshuffled and everyone is dealt 7 cards. The player to the dealer\'s left (the next seat) goes first, and the deal passes one seat on each round. The table marks the dealer.'
  },
  {
    question: 'What if the first card is an action card or a Wild?',
    answer: 'It acts as if the dealer had played it. A Skip skips the player to the dealer\'s left. A Draw Two makes that player draw 2 and lose their turn. A Reverse lets the dealer play first, and play then goes the other way. After a Wild, the player to the dealer\'s left names the first color and then plays. A Wild Draw Four is shuffled back into the deck and another card is flipped.'
  },
  {
    question: 'Which cards can I play?',
    answer: 'A card that matches the top of the discard pile by color, or by number or symbol. A Wild can be played on anything. A Wild Draw Four may be played only when you hold no card of the current color, but the game does not stop you: see the challenge question. The cards you can play are raised and outlined; the rest are dimmed.'
  },
  {
    question: 'How do I play a Wild?',
    answer: 'Click it, then click the color you want. The next player must match that color, or play a Wild. Click Cancel to put the Wild back.'
  },
  {
    question: 'What if I cannot or do not want to play?',
    answer: 'Click Draw, or the draw pile, to take one card. If that card can be played you may play it right away, or click Pass to keep it. If it cannot be played, your turn ends by itself. You may draw even when you hold a playable card, but only one card per turn.'
  },
  {
    question: 'What do the action cards do?',
    answer: 'Skip: the next player loses their turn. Reverse: the direction of play turns around; with two players it acts as a Skip. Draw Two: the next player draws 2 cards and loses their turn. Wild Draw Four: you choose the color, and the next player draws 4 cards and loses their turn, unless they challenge.'
  },
  {
    question: 'How does a Wild Draw Four challenge work?',
    answer: 'When a Wild Draw Four is played on you, click Accept to draw 4 and lose your turn, or Challenge. On a challenge you alone see the other player\'s hand. If they held a card of the color that was current before the Wild Draw Four, they draw 4 instead and you take your turn. If not, you draw 6 and lose your turn. Cards that match only the number, and Wilds, do not count.'
  },
  {
    question: 'How do I call UNO?',
    answer: 'When you hold two cards on your turn, click UNO! and then play your next-to-last card. If you forget, you can still click UNO! afterwards. Until the next player moves, any other player can click Catch while you have not called it, and you draw 2 cards. A player who called UNO shows an UNO! badge.'
  },
  {
    question: 'How is a round scored?',
    answer: 'The player who goes out scores every card left in the other hands: number cards at face value, Skip, Reverse and Draw Two at 20, and Wild and Wild Draw Four at 50. If the last card is a Draw Two or Wild Draw Four, the next player draws those cards first and they count too. A scoring screen shows the round, and the next round is dealt once every connected player clicks Continue. Every player\'s score is shown on the table.'
  },
  {
    question: 'What happens when the draw pile runs out?',
    answer: 'Every card in the discard pile except the top one is shuffled into a new draw pile. If every card is in someone\'s hand, there is nothing to draw and you may pass.'
  },
  {
    question: 'Can I see other players\' cards or the draw pile?',
    answer: 'No. You see only your own hand, and how many cards each other player holds. The only exception is the hand of a player you challenge, shown to you alone until your next move. The order of the draw pile is hidden from everyone.'
  },
  {
    question: 'How do I know whose turn it is and which way play goes?',
    answer: 'The status panel says whose turn it is, and that player\'s name is outlined in the list of players. The players are listed in seat order, and the direction line shows an arrow pointing the way play goes. The current color is shown under the discard pile.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each color also shows its shape: red circle, blue square, green triangle, yellow star. Colored cards, the current color and the color buttons show it; Wild cards carry no color.'
  },
  {
    question: 'Why is a card in my hand outlined?',
    answer: 'It is a card you just drew, including the cards a Draw Two or Wild Draw Four made you take. The outline stays until your next move. The 2 cards a caught missed UNO makes you draw are not outlined. Turn it off with Highlight newly drawn cards in Settings.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every player still in the game approves, and every hand and pile goes back to how it was before that move. Calling UNO, catching and Continue are not moves, so an undo goes back past them too.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn, the scoring screen does not wait for them, and the others may vote to dismiss them. A dismissed player\'s cards go to the bottom of the draw pile and their turns are skipped. If only one player is left, they win.'
  },
  {
    question: 'Can the rules be changed?',
    answer: 'Before play starts the host can choose a target score of 250, 500 or 1,000 points, and turn on four house rules: stacking, 7-0, drawing until you can play, and jump-in. Everyone has to agree before play starts, and the rules cannot change afterwards. The host can also set Most players to as many as 10 instead of 8.'
  },
  {
    question: 'How does stacking work?',
    answer: 'When the host turns on stacking, a Draw Two or Wild Draw Four does not make the next player draw at once. They may play another Draw Two on a Draw Two, or a Wild Draw Four on either, and the count grows and passes to the next player. Or they click Accept, draw the whole count and lose their turn. A Draw Two cannot go on a Wild Draw Four, and a Wild Draw Four can be challenged only while it is the only card in the stack. The table shows how many cards are waiting.'
  },
  {
    question: 'How does 7-0 work?',
    answer: 'When the host turns on 7-0, playing a 7 swaps your hand with another player of your choice: click the 7, then click their name. Playing a 0 passes every hand one seat in the direction of play. A 7 or 0 that is your last card goes out and swaps nothing. A player left with one card by a swap or a pass has no UNO to call and cannot be caught for it.'
  },
  {
    question: 'What does drawing until you can play do?',
    answer: 'When the host turns it on, Draw takes cards until one can be played, or until there are no cards left. You may then play that card or pass. If nothing could be played, your turn ends.'
  },
  {
    question: 'How does jump-in work?',
    answer: 'When the host turns on jump-in, you may play a number card out of turn if it is exactly the same color and number as the top card, for example a red 7 on a red 7. Play then continues from you in the same direction, and the player whose turn it was loses it, along with any card they had drawn. Only number cards can jump in, and not while cards are waiting to be drawn, a Wild Draw Four is waiting to be answered, or the round is over. If two players jump in on the same card, the first one the server receives counts and the other is told that someone else moved first. A jump-in is a move like any other, so it can be undone. It also counts as a move for UNO: a player who has not yet called UNO can no longer be caught once someone jumps in.'
  }
];
