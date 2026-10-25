import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { Preferences, SoundName } from '../services/settings.ts';

type Loose = BasePublicState & { lastMove?: { type?: string }; dice?: unknown };

const ROLLING_MOVES = ['roll', 'attack', 'blitz'];

const isTurn = (s: BasePublicState, viewer: Seat): boolean =>
  s.currentPlayer === viewer && s.activePlayers.length >= 2 && !s.isGameOver;

// Parchisi rolls for the next turn by itself: fresh unused dice that differ from the last ones
function rolledAutomatically(previous: Loose, next: Loose): boolean {
  const dice = next.dice;
  return Array.isArray(dice) && dice.length > 0
    && dice.every(die => typeof die === 'object' && die !== null && (die as { used?: boolean }).used === false)
    && JSON.stringify(dice) !== JSON.stringify(previous.dice);
}

// The sounds a viewer hears when the state changes from previous to next; undo and History jumps play nothing
export function soundsFor(previous: BasePublicState | null, next: BasePublicState, viewer: Seat | null): SoundName[] {
  if (!previous) return [];
  const forward = next.moveCount === previous.moveCount + 1;
  if (!forward && next.moveCount !== previous.moveCount) return [];
  const names: SoundName[] = [];
  if (forward) {
    if (ROLLING_MOVES.includes((next as Loose).lastMove?.type ?? '')) names.push('dice');
    else {
      names.push('move');
      if (rolledAutomatically(previous, next)) names.push('dice');
    }
  }
  if (!previous.isGameOver && next.isGameOver) names.push('gameOver');
  if (viewer !== null && isTurn(next, viewer) && !isTurn(previous, viewer)) names.push('turn');
  return names;
}

export function audible(names: SoundName[], preferences: Preferences): SoundName[] {
  if (preferences.muted || preferences.volume <= 0) return [];
  return names.filter(name => preferences.sounds[name]);
}
