import { tileName } from '../tiles.ts';
import type { FeatureKind, PublicGameState, ScoreEvent } from '../types.ts';

const ON: Record<FeatureKind, string> = { city: 'a city', road: 'a road', field: 'a field', monastery: 'the monastery' };

function scoredText(event: ScoreEvent, names: Record<number, string>): string {
  const kind = event.kind;
  if (event.seats.length === 0) return `a ${kind} was completed`;
  const who = event.seats.map(seat => names[seat]).join(' and ');
  return `${who} scored ${event.points} for a ${kind}`;
}

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'place') return `${name} placed ${tileName(lastMove.tile)}`;
  const parts = [lastMove.feature ? `${name} put a meeple on ${ON[lastMove.feature.kind]}` : `${name} placed no meeple`];
  parts.push(...lastMove.scored.map(event => scoredText(event, playerNames)));
  const discarded = lastMove.discarded.length;
  if (discarded > 0) parts.push(`${discarded === 1 ? 'a tile' : `${discarded} tiles`} fit nowhere and left the game`);
  return parts.join(', ');
}
