import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How does a round go?',
    answer: 'Everyone sees the same letter and the same list of categories. Type an answer for each category that starts with the letter, within the time limit (2 minutes unless the host changed it). Press Done when you are finished; the round ends when the timer runs out or everyone is done. Answers stay hidden until then.'
  },
  {
    question: 'What counts as a valid answer?',
    answer: 'It must start with the round\'s letter. A leading "a", "an" or "the" is ignored, so "The Tiger" is valid for T, while "The Eagle" is not. An answer with the wrong letter is rejected automatically.'
  },
  {
    question: 'How is a round scored?',
    answer: 'You score 1 point for each valid answer that no one else gave. Answers that are equal once capitals, spaces, hyphens and apostrophes are ignored (and a leading "a", "an" or "the") are duplicates and score 0, so "a dog" matches "Dog" but not "dogs". The highest total after the last round wins; equal totals share the win.'
  },
  {
    question: 'How do I challenge an answer?',
    answer: 'In the review, press Challenge on another player\'s scoring answer. Everyone except its author then votes Keep or Reject, and your challenge counts as your vote to reject. If more than half of the voters reject, the answer scores 0. The round moves on once everyone presses Continue and no vote is owed.'
  },
  {
    question: 'Which letters are used?',
    answer: 'A random letter each round. The hard letters Q, U, V, X, Y and Z are left out unless the Hard letters house rule is on.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'No. Answers, challenges and votes cannot be undone.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A player who drops their connection only holds their seat and can rejoin. A player who is dismissed leaves the round: their answers, the challenges on them and their votes are dropped (so an answer that matched theirs can now score), and the round carries on with the players left. If only one player is left, that player wins.'
  }
];
