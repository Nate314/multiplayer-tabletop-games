import { useEffect, useRef } from 'react';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import { soundsFor } from './sounds.ts';
import { playSounds } from './synth.ts';

// Plays the sounds for each state change; the first state (mount, join, rejoin, reload) is silent
export default function useStateSounds(state: BasePublicState, viewer: Seat | null, enabled: boolean): void {
  const previousRef = useRef<BasePublicState | null>(null);
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = state;
    if (enabled && previous !== state) playSounds(soundsFor(previous, state, viewer));
  }, [state, viewer, enabled]);
}
