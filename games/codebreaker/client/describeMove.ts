import { plural } from '../../../shared/text.ts';
import type { Color, Feedback, PublicGameState } from '../types.ts';

// A color as its button and peg are named, e.g. 'Red'
export const colorName = (color: Color): string => color[0].toUpperCase() + color.slice(1);

// The answer pegs in words, e.g. '2 right place, 1 right color'
export const feedbackText = ({ exact, colorOnly }: Feedback): string => `${exact} right place, ${colorOnly} right color`;

const brokeIn = (name: string, count: number): string => `${name} broke the code in ${plural(count, 'guess', 'guesses')}`;

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames, board }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'board'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'setCode': return `${name} set a code`;
    case 'guess':
      if (lastMove.broken) return brokeIn(name, board.guesses.length);
      return lastMove.outOfGuesses ? `${name} ran out of guesses` : `${name} guessed: ${feedbackText(lastMove.feedback)}`;
    case 'raceGuess': return lastMove.broken ? brokeIn(name, lastMove.guessNumber) : `${name} made guess ${lastMove.guessNumber}`;
    case 'undoOwn': return `${name} took back a guess`;
  }
}
