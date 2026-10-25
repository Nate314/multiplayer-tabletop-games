// Development cards: 14 Knights, 5 Victory Points, 2 each of Road Building, Year of Plenty and Monopoly
// (the 5-6 player extension: 20, 5 and 3 each).
// One may be played a turn, at any time in it, but not a card bought that turn; Victory Point cards are never played,
// they count for their owner and are shown when the game ends.
import { piecesLeft, roadSpots } from './building.ts';
import { giveFromBank } from './dice.ts';
import { COSTS, add, covers, describeResources, noResources, subtract } from './resources.ts';
import { nameOf, note } from './state.ts';
import type { DevCard, GameState, Resource, Result, Seat } from './types.ts';

export const DEV_DECK: DevCard[] = [
  ...Array<DevCard>(14).fill('knight'), ...Array<DevCard>(5).fill('victoryPoint'),
  ...Array<DevCard>(2).fill('roadBuilding'), ...Array<DevCard>(2).fill('yearOfPlenty'), ...Array<DevCard>(2).fill('monopoly')
];

export const FIVE_SIX_DEV_DECK: DevCard[] = [
  ...Array<DevCard>(20).fill('knight'), ...Array<DevCard>(5).fill('victoryPoint'),
  ...Array<DevCard>(3).fill('roadBuilding'), ...Array<DevCard>(3).fill('yearOfPlenty'), ...Array<DevCard>(3).fill('monopoly')
];

export const DEV_CARD_NAMES: Record<DevCard, string> = {
  knight: 'Knight', victoryPoint: 'Victory Point', roadBuilding: 'Road Building', yearOfPlenty: 'Year of Plenty', monopoly: 'Monopoly'
};

export function buyDevCard(state: GameState, seat: Seat): Result<GameState> {
  const [card, ...rest] = state.devDeck;
  if (card === undefined) return { error: 'The development deck is empty' };
  const hand = state.hands[seat] ?? noResources();
  if (!covers(hand, COSTS.devCard)) return { error: `You need ${describeResources(COSTS.devCard)}` };
  return {
    state: note({
      ...state,
      devDeck: rest,
      boughtThisTurn: [...state.boughtThisTurn, card],
      hands: { ...state.hands, [seat]: subtract(hand, COSTS.devCard) },
      bank: add(state.bank, COSTS.devCard)
    }, `${nameOf(state, seat)} bought a development card`)
  };
}

// Takes one `card` out of `seat`'s playable cards, or explains why it cannot be played
function playCard(state: GameState, seat: Seat, card: DevCard): Result<GameState> {
  if (state.devPlayed) return { error: 'You have played a development card this turn' };
  if (state.pending) return { error: 'Finish the robber, discards or free roads first' };
  const held = state.devCards[seat] ?? [];
  const index = held.indexOf(card);
  if (index < 0) {
    return { error: state.boughtThisTurn.includes(card) ? 'A card bought this turn can be played from your next turn' : `You have no ${DEV_CARD_NAMES[card]} card` };
  }
  const devCards = { ...state.devCards, [seat]: [...held.slice(0, index), ...held.slice(index + 1)] };
  return { state: note({ ...state, devCards, devPlayed: true }, `${nameOf(state, seat)} played ${DEV_CARD_NAMES[card]}`) };
}

export function playKnight(state: GameState, seat: Seat): Result<GameState> {
  const played = playCard(state, seat, 'knight');
  if ('error' in played) return played;
  const knights = { ...played.state.knights, [seat]: (played.state.knights[seat] ?? 0) + 1 };
  return { state: { ...played.state, knights, pending: { kind: 'robber' } } };
}

// Two free roads, placed at once; fewer if the player is short of road pieces or places
export function playRoadBuilding(state: GameState, seat: Seat): Result<GameState> {
  if (roadSpots(state, seat).length === 0) return { error: 'There is nowhere for you to build a road' };
  const played = playCard(state, seat, 'roadBuilding');
  if ('error' in played) return played;
  const roads = Math.min(2, piecesLeft(state, seat).road);
  return { state: { ...played.state, pending: { kind: 'roadBuilding', roads } } };
}

export function playYearOfPlenty(state: GameState, seat: Seat, chosen: [Resource, Resource]): Result<GameState> {
  const gained = noResources();
  for (const resource of chosen) gained[resource]++;
  if (!covers(state.bank, gained)) return { error: 'The bank does not have those cards' };
  const played = playCard(state, seat, 'yearOfPlenty');
  if ('error' in played) return played;
  return { state: note(giveFromBank(played.state, seat, gained), `${nameOf(state, seat)} took ${describeResources(gained)} from the bank`) };
}

// Every other player hands over all their cards of one resource
export function playMonopoly(state: GameState, seat: Seat, resource: Resource): Result<GameState> {
  const played = playCard(state, seat, 'monopoly');
  if ('error' in played) return played;
  const hands = { ...played.state.hands };
  let taken = 0;
  for (const other of state.activePlayers) {
    if (other === seat) continue;
    const hand = hands[other] ?? noResources();
    taken += hand[resource];
    hands[other] = { ...hand, [resource]: 0 };
  }
  hands[seat] = { ...(hands[seat] ?? noResources()), [resource]: (hands[seat]?.[resource] ?? 0) + taken };
  return { state: note({ ...played.state, hands }, `${nameOf(state, seat)} took ${taken} ${resource} from the other players`) };
}
