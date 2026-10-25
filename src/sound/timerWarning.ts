// The tick in the last seconds of a chess clock or Scrabble turn timer
export const TIMER_WARNING_MS = 10_000;

// The whole second (10 down to 1) that `msLeft` falls in during the warning, or null outside it. One tick plays each
// time this changes
export function warningSecond(msLeft: number | null): number | null {
  if (msLeft === null || msLeft <= 0 || msLeft > TIMER_WARNING_MS) return null;
  return Math.ceil(msLeft / 1000);
}
