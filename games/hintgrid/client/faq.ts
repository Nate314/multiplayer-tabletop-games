import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How do I set up the teams?',
    answer: 'Before the game, each player picks a team, Red or Blue, and a role: clue-giver or guesser. Each team needs exactly one clue-giver and at least one guesser. Even out balances the teams for you and keeps the clue-givers already chosen. The game starts when a clue-giver gives the first clue, once both teams are ready.'
  },
  {
    question: 'What is on the grid?',
    answer: 'Twenty-five words in five rows. Behind them is a hidden key: 9 words for the team that starts, 8 for the other team, 7 bystanders and 1 trap. Only the two clue-givers see the key, as a mark on each word: R for Red, B for Blue, a circle for a bystander and a cross for the trap.'
  },
  {
    question: 'What does the clue-giver do?',
    answer: 'On your team\'s turn, type one word and pick a number from 1 to 9, then press Give clue. The word should lead your guessers to your team\'s words, and the number says how many. A clue that is a word on the grid is refused, and so is a clue of more than one word.'
  },
  {
    question: 'What do the guessers do?',
    answer: 'Any guesser on the team whose turn it is taps a word to turn it over. You get up to the number plus one guesses, and may press End guessing to stop early once you have turned over a word. Your own team\'s word lets you keep going. A bystander or the other team\'s word ends the turn.'
  },
  {
    question: 'What is the trap?',
    answer: 'Turning over the trap ends the game at once, and the other team wins.'
  },
  {
    question: 'How do I win?',
    answer: 'The first team to turn over all its words wins, and every player on it is a winner.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last clue, guess or End guessing. It is undone only if everyone else approves. A guess that ends the game cannot be undone, because it shows the key.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A player who leaves keeps their seat and can rejoin. If a team is left without a clue-giver or a guesser, the game ends and the team with fewer words left to find wins. If both teams have the same number left, it is a draw.'
  }
];
