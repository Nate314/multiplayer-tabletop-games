import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How does a turn go?',
    answer: 'Players act in seat order. The actor is offered 3 prompts (4 or 5 as a house rule) and clicks one; only the actor sees them. From the second turn on, if 20 seconds pass without a choice, one is picked at random. The actor then has 90 seconds (or the time per turn the host set) to act it out while everyone else guesses. Then the prompt is shown to everyone for 5 seconds and the next player chooses.'
  },
  {
    question: 'How do I act?',
    answer: 'This site shows the prompt, the chat and the scores, not a camera, so play where the others can see you: in the same room or on a video call. Your prompt shows in large type at the top of your screen. Act it out without speaking, mouthing words or pointing at written letters; gestures and mime are the only clue. You cannot chat while acting.'
  },
  {
    question: 'How do I guess?',
    answer: 'Type in the box under the chat, labelled Guess, and press Enter. A guess is correct when it holds the prompt as whole words, ignoring capitals, spaces, hyphens and apostrophes, so "are you riding a horse?" guesses "riding a horse". The correct guess is never shown; the chat says that you guessed the prompt. Guess as often as you like.'
  },
  {
    question: 'What do the boxes at the top mean?',
    answer: 'One box for each letter of the prompt, with a gap between words and a hyphen where the prompt has one, so you know how long it is and how many words it has. Once you guess the prompt, the boxes show its letters.'
  },
  {
    question: 'What does "So close!" mean?',
    answer: 'Your guess was one letter away from the prompt: one letter added, missing or wrong. Only you see it.'
  },
  {
    question: 'Why can some players not see my messages?',
    answer: 'Once you have guessed the prompt, what you type until the turn ends is seen only by the actor and the others who have guessed, so nobody can give the prompt away. Those lines are marked "Only players who guessed can see this". Everyone sees them when the prompt is shown.'
  },
  {
    question: 'How is a guess scored?',
    answer: 'A correct guess scores 10 + 90 x the share of the acting time left, rounded: 100 for a guess at once, 55 halfway, 10 at the buzzer. The actor scores 25 for each player who guesses the prompt.'
  },
  {
    question: 'When does a turn end?',
    answer: 'When time runs out or when everyone has guessed. In the last 10 seconds a tick plays each second for the actor and for anyone still guessing, unless Timer warnings is off in Settings.'
  },
  {
    question: 'When does the game end?',
    answer: 'After every player has acted 3 times (1 to 5 as a house rule). The highest score wins; players with equal scores share the win.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last scored guess or turn change. It is undone only if everyone else approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A player who leaves keeps their seat and can rejoin. Dismissing the actor ends their turn and shows the prompt. Dismissing a guesser ends the turn when everyone left has guessed. If only one player is left, that player wins.'
  }
];
