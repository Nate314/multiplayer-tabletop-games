import { pointsText } from '../../../shared/standings.ts';
import { plural } from '../../../shared/text.ts';
import { COMMODITIES } from '../cards.ts';
import type { Card, Corner, PublicGameState } from '../types.ts';

const EXTRAS = { bull: { name: 'Bull', mark: 'Wild' }, bear: { name: 'Bear', mark: '-20' } };

export function faceOf(kind: Card['kind']): { name: string; mark: string } {
  if (kind === 'bull' || kind === 'bear') return EXTRAS[kind];
  const { name, value } = COMMODITIES.find(c => c.kind === kind)!;
  return { name, mark: String(value) };
}

// What a card says, for its button's name: "Saffron 100", "Bull Wild"
export function cardLabel(kind: Card['kind']): string {
  const { name, mark } = faceOf(kind);
  return `${name} ${mark}`;
}

export function corneredText(name: string, { commodity, points, double }: Corner): string {
  const commodityName = COMMODITIES.find(c => c.kind === commodity)!.name;
  return `${name} cornered ${commodityName}${double ? ' with the Bull' : ''} for ${pointsText(points)}`;
}

// The step that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: PublicGameState): string {
  if (!lastMove) return '';
  if (lastMove.type === 'corner') return corneredText(playerNames[lastMove.playerNumber], lastMove);
  const [a, b] = lastMove.seats;
  return `${playerNames[a]} and ${playerNames[b]} swapped ${plural(lastMove.count, 'card')}`;
}
