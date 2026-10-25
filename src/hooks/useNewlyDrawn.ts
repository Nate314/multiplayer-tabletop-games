import { useState } from 'react';
import usePreferences from './usePreferences.ts';
import { nextDrawn, type DrawnStep } from './newlyDrawn.ts';
import type { BasePublicState } from '../../shared/types.ts';

type Tracked<P, K> = { state: P; drawn: K[] };

// The keys of the cards to outline as newly drawn, for live screens only. Empty while "Highlight newly drawn cards" is off.
// The slide animation does not depend on this.
export default function useNewlyDrawn<P extends BasePublicState, K>(state: P, step: (previous: P, next: P) => DrawnStep<K>): K[] {
  const { highlightDrawn } = usePreferences();
  const [tracked, setTracked] = useState<Tracked<P, K>>({ state, drawn: [] });
  let { drawn } = tracked;
  if (tracked.state !== state) {
    drawn = nextDrawn(drawn, tracked.state.moveCount, state.moveCount, () => step(tracked.state, state));
    setTracked({ state, drawn });
  }
  return highlightDrawn ? drawn : [];
}
