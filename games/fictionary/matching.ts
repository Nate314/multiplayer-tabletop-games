// Matching a written definition against the real one, shared by the browser and the server; imports no rules code
import { isClose, isCorrect, normalize } from '../../shared/guess.ts';

// Close enough to the real definition (containing it, or one letter off) to score as finding it
export function matchesDefinition(submission: string, definition: string): boolean {
  const target = definition.replace(/[^a-zA-Z '-]/g, ' ');
  return isCorrect(submission, target) || isClose(submission, target);
}

// The same text once capitals, spaces and punctuation are ignored, so two equal fakes become one choice
export function sameText(a: string, b: string): boolean {
  const letters = (text: string) => normalize(text).replace(/[^a-z]/g, '');
  return letters(a) !== '' && letters(a) === letters(b);
}
