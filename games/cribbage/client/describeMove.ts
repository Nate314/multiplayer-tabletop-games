import { cardName } from '../../../shared/playingCards.ts';
import { describeItems, itemsList, totalOf } from '../scoring.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames, dealer }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'dealer'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'discard':
      return `${name} laid cards in the crib`;
    case 'cut':
      return `${name} cut the ${cardName(lastMove.starter)}${lastMove.heels && dealer !== null ? `. His heels: ${playerNames[dealer]} scores 2` : ''}`;
    case 'play':
      return `${name} played the ${cardName(lastMove.card)}${lastMove.items.length ? ` for ${itemsList(lastMove.items)}` : ''}`;
    case 'go':
      return lastMove.lastCard ? `${name} said Go, and the last to play scored 1` : `${name} said Go`;
    case 'claim':
      return `${name} claimed ${lastMove.points} for ${lastMove.crib ? 'the crib' : 'their hand'}`;
    case 'count': {
      // Under Muggins the owner scores only their claim, which can be less than the true count
      const scored = lastMove.points === totalOf(lastMove.items) ? `counted ${lastMove.points}` : `scored the ${lastMove.points} claimed`;
      return `${name} ${scored}${lastMove.crib ? ' in the crib' : ''}: ${describeItems(lastMove.items)}`;
    }
    case 'muggins':
      return lastMove.points < 0 ? `${name} called Muggins, but nothing was missed: it cost ${-lastMove.points}` : `${name} called Muggins and took ${lastMove.points}`;
    case 'noMuggins':
      return `${name} said No Muggins`;
  }
}
