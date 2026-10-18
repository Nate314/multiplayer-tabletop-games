import { CARDS } from '../cards.ts';
import { MAX_RESERVED, payment, takeThreeCount } from '../rules.ts';
import type { Gem, MarketSlot, Move, PublicGameState, Seat } from '../types.ts';

// What the player has picked up on their turn, before sending it
export type Selection =
  | { kind: 'gems'; colors: Gem[] }  // the same color twice means take two
  | { kind: 'card'; source: MarketSlot | { kind: 'reserved'; index: number } }
  | { kind: 'deck'; level: 1 | 2 | 3 };

// Clicking a supply color: add it, take a second of it (when 4 or more are left), or put it back
export function toggleGem(selection: Selection | null, gem: Gem, state: Pick<PublicGameState, 'supply'>): Selection | null {
  const colors = selection?.kind === 'gems' ? selection.colors : [];
  if (state.supply[gem] === 0) return selection;
  if (colors.includes(gem)) {
    if (colors.length === 1 && state.supply[gem] >= 4) return { kind: 'gems', colors: [gem, gem] };
    const rest = colors.filter((color, index) => color !== gem || index !== colors.lastIndexOf(gem));
    return rest.length === 0 ? null : { kind: 'gems', colors: rest };
  }
  if (colors.length >= 3 || (colors.length === 2 && colors[0] === colors[1])) return selection;
  return { kind: 'gems', colors: [...colors, gem] };
}

// The move the picked gems make, or null while they are not a legal take
export function gemMove(colors: Gem[], state: Pick<PublicGameState, 'supply'>): Move | null {
  if (colors.length === 2 && colors[0] === colors[1]) {
    return state.supply[colors[0]] >= 4 ? { type: 'takeTwo', color: colors[0] } : null;
  }
  return colors.length > 0 && colors.length === takeThreeCount(state.supply) ? { type: 'takeThree', colors } : null;
}

// The card a selection points at, if it is face up or the viewer's own
export function selectedCard(selection: Selection, state: PublicGameState, seat: Seat): number | null {
  if (selection.kind !== 'card') return null;
  const { source } = selection;
  if (source.kind === 'market') return state.market[source.level][source.slot] ?? null;
  return state.players[seat]?.reserved[source.index]?.card ?? null;
}

export function canBuy(state: PublicGameState, seat: Seat, card: number | null): boolean {
  const player = state.players[seat];
  return card !== null && !!player && payment(player, CARDS[card]) !== null;
}

export function canReserve(state: PublicGameState, seat: Seat): boolean {
  return (state.players[seat]?.reserved.length ?? MAX_RESERVED) < MAX_RESERVED;
}
