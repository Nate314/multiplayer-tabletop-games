// The 5-6 player extension's special build phase, a house rule: after each turn every other player, in turn order
// from the next one, may build or buy a development card, without trading or playing cards
import { type ToggleRule, houseRule } from '../../shared/houseRules.ts';
import { buildCity, buildRoad, buildSettlement } from './building.ts';
import { buyDevCard } from './devCards.ts';
import { FIVE_SIX_FROM } from './editions.ts';
import { noResources, total } from './resources.ts';
import { nameOf, note } from './state.ts';
import type { GameState, Move, Result, Seat } from './types.ts';

export const SPECIAL_BUILD: ToggleRule = {
  id: 'specialBuild',
  kind: 'toggle',
  standard: false,
  label: 'Special build phase',
  help: 'After each turn, every other player in turn order may build or buy a development card, without trading or playing cards',
  offered: seats => seats >= FIVE_SIX_FROM
};

const CHEAPEST_PIECE = 2; // a road; a player holding fewer cards cannot pay for anything

export function buildChance(state: Pick<GameState, 'specialBuild'>, seat: Seat | null): boolean {
  return seat !== null && state.specialBuild?.builders[0] === seat;
}

function canBuild(state: GameState, seat: Seat): boolean {
  return state.activePlayers.includes(seat) && !state.disconnected.includes(seat)
    && total(state.hands[seat] ?? noResources()) >= CHEAPEST_PIECE;
}

// Called once the next turn has started
export function startSpecialBuild(state: GameState, ended: Seat): GameState {
  if (!houseRule(state, SPECIAL_BUILD)) return { ...state, specialBuild: null };
  const players = state.activePlayers.filter(seat => seat !== ended);
  const order = [...players.filter(seat => seat > ended), ...players.filter(seat => seat < ended)];
  const builders = order.filter(seat => canBuild(state, seat));
  if (builders.length === 0) return { ...state, specialBuild: null };
  return note({ ...state, specialBuild: { builders } }, `Special build phase: ${builders.map(seat => nameOf(state, seat)).join(', ')}`);
}

// A builder away when their chance comes is skipped, as is one who can no longer pay for anything
export function withoutBuilder(state: GameState, seat: Seat): GameState {
  if (!state.specialBuild) return state;
  let next = state;
  let builders = state.specialBuild.builders.filter(other => other !== seat);
  while (builders.length > 0 && !canBuild(next, builders[0])) {
    if (next.disconnected.includes(builders[0])) next = note(next, `${nameOf(state, builders[0])} is away, so their build chance is skipped`);
    builders = builders.slice(1);
  }
  if (builders.length > 0) return { ...next, specialBuild: { builders } };
  return note({ ...next, specialBuild: null }, `${nameOf(state, state.turnHolder)}'s turn`);
}

// A card bought now goes straight to the buyer's held cards, so it is playable from their next turn
function buyInPhase(state: GameState, seat: Seat): Result<GameState> {
  const bought = buyDevCard(state, seat);
  if ('error' in bought) return bought;
  const card = bought.state.boughtThisTurn.at(-1);
  if (card === undefined) return bought;
  const devCards = { ...bought.state.devCards, [seat]: [...(bought.state.devCards[seat] ?? []), card] };
  return { state: { ...bought.state, devCards, boughtThisTurn: state.boughtThisTurn } };
}

export function playSpecialBuild(state: GameState, seat: Seat, move: Move): Result<GameState> {
  const builder = state.specialBuild?.builders[0];
  if (builder === undefined) return { error: 'You cannot do that now' };
  if (seat !== builder) return { error: `Wait for ${nameOf(state, builder)} to build` };
  switch (move.type) {
    case 'buildRoad': return buildRoad(state, seat, move.edge);
    case 'buildSettlement': return buildSettlement(state, seat, move.vertex);
    case 'buildCity': return buildCity(state, seat, move.vertex);
    case 'buyDevCard': return buyInPhase(state, seat);
    case 'passBuild': return { state: withoutBuilder(note(state, `${nameOf(state, seat)} is done building`), seat) };
    case 'bankTrade': return { error: 'No trading during the special build phase' };
    case 'playKnight':
    case 'playRoadBuilding':
    case 'playYearOfPlenty':
    case 'playMonopoly':
      return { error: 'No development cards during the special build phase' };
    default: return { error: 'Click Done building first' };
  }
}
