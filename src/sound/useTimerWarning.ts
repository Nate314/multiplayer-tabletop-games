import { useEffect, useRef } from 'react';
import { playSounds } from './synth.ts';
import { warningSecond } from './timerWarning.ts';

// Ticks once a second in the last 10 seconds of a running timer, for the player whose time it is (`enabled`).
// The Timer warnings setting and the volume apply, as for every sound
export default function useTimerWarning(msLeft: number | null, enabled: boolean): void {
  const second = enabled ? warningSecond(msLeft) : null;
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (second !== null && second !== last.current) playSounds(['timer']);
    last.current = second;
  }, [second]);
}
