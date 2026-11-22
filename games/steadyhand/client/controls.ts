import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (onPointerDown picks a part near its rest spot within HIT_RADIUS_PX, pointermove drags it,
// pointerup, pointercancel and blur let go; Undo). There are no key handlers.
export const CONTROLS: ControlItem[] = [
  {
    action: 'Take a part out',
    pointer: 'On your turn, press a part that is still in its slot, near its starting end, with the mouse or a finger, and drag it along the slot to the round exit at the far end.'
  },
  {
    action: 'Let go of a part',
    pointer: 'Release the mouse button or lift your finger. Before the exit the part goes back to its rest spot. Switching to another window also lets go.'
  },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
