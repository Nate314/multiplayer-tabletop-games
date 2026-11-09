import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How does a round go?',
    answer: 'Everyone sees the same rare word at the top of the screen. Each player writes a made-up definition that sounds real. The game holds the real one. Once writing ends, every definition is shown in a shuffled list, with no names, and everyone votes for the one they think is real. Then the reveal shows which one was real, who wrote each fake, who voted for what and the points.'
  },
  {
    question: 'How do I write a definition?',
    answer: 'Type it in the box labelled Your definition (up to 150 characters) and click Submit. You can change it until writing ends: type a new one and click Update. Nobody else sees what you wrote until the reveal; the others only see that you have written.'
  },
  {
    question: 'How long do we have?',
    answer: 'Writing lasts 2 minutes (1 minute, 90 seconds or 3 minutes as a house rule) and voting lasts 1 minute. Each ends early once everyone has written or voted. In the last 10 seconds a tick plays each second for anyone who has not written or voted yet, unless Timer warnings is off in Settings.'
  },
  {
    question: 'How do I vote?',
    answer: 'Click the definition you think is real. Your own fake is marked Yours and cannot be picked. You can change your vote by clicking another one until everyone has voted or the time runs out.'
  },
  {
    question: 'How is it scored?',
    answer: 'Voting for the real definition scores 2 points. Each vote for your fake scores you 1 point. Writing the real definition scores 3 points.'
  },
  {
    question: 'What if I write the real definition?',
    answer: 'If what you wrote contains the real definition as whole words, ignoring capitals and punctuation, or is one letter away from it, you score 3 points. Your entry is not shown as a separate choice, and you do not vote that round, since you already know the answer.'
  },
  {
    question: 'What if two players write the same fake?',
    answer: 'Definitions that are the same once capitals, spaces and punctuation are ignored are shown once, and every vote for it scores 1 point for each of its authors.'
  },
  {
    question: 'What if nobody can be fooled?',
    answer: 'When no fake was written, or every voter could only pick the real definition, the vote is skipped and the reveal follows at once.'
  },
  {
    question: 'When does the game end?',
    answer: 'After 8 words (5 or 10 as a house rule). Everyone clicks Continue after each reveal to start the next word. The highest score wins; players with equal scores share the win.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'No. There are no turns to undo: you can change your definition or your vote while the phase is open instead.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A player who leaves keeps their seat and can rejoin. A dismissed player\'s definition and vote are removed, though a fake already shown stays a choice. If fewer than 3 players are left, the game ends at once with the scores as they stand.'
  }
];
