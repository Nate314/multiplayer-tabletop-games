import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Be the highest scorer once someone has reached the target score (10,000 unless the host chose another) and everyone else has had one last turn.'
  },
  {
    question: 'How does a turn work?',
    answer: 'Roll all six dice. Click the scoring dice you want to set aside, then roll the rest again or bank the points. Each roll after the first must set aside at least one scoring die. You can keep going as long as you like, but the points you have not banked are lost if a roll has nothing that scores.'
  },
  {
    question: 'What is a Farkle?',
    answer: 'A roll in which no die scores. You lose every point you collected this turn and the turn passes to the next player.'
  },
  {
    question: 'What are hot dice?',
    answer: 'If you set aside all six dice, you may roll all six again and keep adding to your turn total. There is no limit to how many times this can happen in one turn.'
  },
  {
    question: 'What scores?',
    answer: 'Each 1 is 100 and each 5 is 50. Three of a kind is the face times 100 (three 2s are 200), except three 1s, which are 1,000. Four of a kind is 1,000, five of a kind 2,000 and six of a kind 3,000. Three pairs are 1,500 and a run of 1 to 6 is 2,500. Every die you set aside must be part of a scoring combination, and a combination must come from a single roll.'
  },
  {
    question: 'Is there a minimum to get on the board?',
    answer: 'No. You can bank any score on your first turn.'
  },
  {
    question: 'How does the game end?',
    answer: 'When a player banks to the target score or more, each other player gets one last turn. Then the highest total wins, and players with equal totals share the win.'
  },
  {
    question: 'Can the rules be changed?',
    answer: "Before the first roll the host chooses the target score: 5,000, 10,000, 15,000 or 20,000. Everyone has to agree before play starts. Ticking \"I know what I'm doing\" lets the host seat up to 10 players instead of 8."
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask to undo the last move. It is undone only if everyone approves. A roll that is undone may come out differently when you roll again.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn and the others may vote to dismiss them. A dismissed player drops out of the game with their score, and the turn passes on.'
  }
];
