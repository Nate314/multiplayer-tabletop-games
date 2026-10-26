import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How does a turn go?',
    answer: 'Players draw in seat order. The drawer is offered 3 words (4 or 5 as a house rule) and clicks one; only the drawer sees them. From the second turn on, if 20 seconds pass without a choice, one is picked at random. The drawer then has 90 seconds (or the time per turn the host set) to draw it while everyone else guesses. Then the word is shown to everyone for 5 seconds and the next player chooses.'
  },
  {
    question: 'How do I draw?',
    answer: 'On your turn, drag on the paper with a mouse, a finger or a pen. Pick a color and a brush size (Small, Medium or Large) in the toolbar under the drawing. Eraser paints white, Fill fills the area you click with the chosen color, Take back removes your last line or fill, and Clear wipes the paper. Letters, numbers and spoken hints are not allowed; the picture is the only clue.'
  },
  {
    question: 'How do I guess?',
    answer: 'Type in the box under the chat, labelled Guess, and press Enter. A guess is correct when it holds the word as whole words, ignoring capitals, spaces, hyphens and apostrophes, so "is it an ice-cream?" guesses "ice cream", but "catapult" does not guess "cat". The correct guess is never shown; the chat says that you guessed the word. Guess as often as you like.'
  },
  {
    question: 'What do the boxes above the drawing mean?',
    answer: 'One box for each letter of the word, with a gap between words and a hyphen where the word has one, so you know how long it is. Once you guess the word, or while you draw it, the boxes show its letters.'
  },
  {
    question: 'What does "So close!" mean?',
    answer: 'Your guess was one letter away from the word: one letter added, missing or wrong. Only you see it.'
  },
  {
    question: 'Why can some players not see my messages?',
    answer: 'Once you have guessed the word, what you type until the turn ends is seen only by the drawer and the others who have guessed, so nobody can give the word away. Those lines are marked "Only players who guessed can see this". Everyone sees them when the word is shown. The drawer cannot chat while drawing.'
  },
  {
    question: 'How is a guess scored?',
    answer: 'A correct guess scores 10 + 90 x the share of the drawing time left, rounded: 100 for a guess at once, 55 halfway, 10 at the buzzer. The drawer scores 25 for each player who guesses the word.'
  },
  {
    question: 'When does a turn end?',
    answer: 'When time runs out or when everyone has guessed. In the last 10 seconds a tick plays each second for the drawer and for anyone still guessing, unless Timer warnings is off in Settings.'
  },
  {
    question: 'When does the game end?',
    answer: 'After every player has drawn 3 times (1 to 5 as a house rule). The highest score wins; players with equal scores share the win.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last scored guess or turn change. It is undone only if everyone else approves, and any drawing since then is lost.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A player who leaves keeps their seat and can rejoin. Dismissing the drawer ends their turn and shows the word. Dismissing a guesser ends the turn when everyone left has guessed. If only one player is left, that player wins.'
  }
];
