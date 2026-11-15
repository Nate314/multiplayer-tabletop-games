import { clock } from '../rules.ts';
import { shapeLabel } from '../shapes.ts';
import type { PublicGameState } from '../types.ts';

// The step that produced this state, for the history dialog: a placement, the one that filled a board, or the pop
export function describeMove({ lastMove, playerNames, popped, finishTimes, layout }: PublicGameState): string {
  if (popped) return 'Time ran out';
  if (!lastMove || !layout) return '';
  const name = playerNames[lastMove.playerNumber];
  const time = finishTimes[lastMove.playerNumber];
  // A finished seat places nothing more, so its last placement is the one that filled the board
  if (time !== undefined) return `${name} filled the board in ${clock(time)}`;
  return `${name} placed the ${shapeLabel(layout.tray[lastMove.shape]).toLowerCase()}`;
}
