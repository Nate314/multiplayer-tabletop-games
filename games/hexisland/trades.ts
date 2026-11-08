// Trading: with the bank at 4:1, or at a port 3:1 (any resource) or 2:1 (its resource), as moves; and between players,
// offered by the turn holder to one player or to all and answered as actions, the first to accept making the trade
import { boardOf } from './board.ts';
import { add, covers, describeResources, noResources, subtract, total } from './resources.ts';
import { nameOf, note } from './state.ts';
import type { GameState, Resource, Resources, Result, Seat, Trade } from './types.ts';

// The best bank rate `seat` has for giving `resource`
export function tradeRatio(state: Pick<GameState, 'layout' | 'buildings'>, seat: Seat, resource: Resource): number {
  const { edges } = boardOf(state.layout);
  const ports = state.layout.ports.filter(port => edges[port.edge].some(vertex => state.buildings[vertex]?.seat === seat));
  if (ports.some(port => port.kind === resource)) return 2;
  return ports.some(port => port.kind === 'any') ? 3 : 4;
}

export function bankTrade(state: GameState, seat: Seat, give: Resource, get: Resource): Result<GameState> {
  if (give === get) return { error: 'Trade for a different resource' };
  const ratio = tradeRatio(state, seat, give);
  const hand = state.hands[seat] ?? noResources();
  if (hand[give] < ratio) return { error: `You need ${ratio} ${give}` };
  if (state.bank[get] < 1) return { error: `The bank has no ${get} left` };
  const given = { ...noResources(), [give]: ratio };
  const taken = { ...noResources(), [get]: 1 };
  return {
    state: note({
      ...state,
      hands: { ...state.hands, [seat]: add(subtract(hand, given), taken) },
      bank: add(subtract(state.bank, taken), given)
    }, `${nameOf(state, seat)} traded ${ratio} ${give} to the bank for 1 ${get}`)
  };
}

function offerError(state: GameState, seat: Seat): string | null {
  if (state.setup) return 'Trading starts after setup';
  if (state.specialBuild) return 'No trading during the special build phase';
  if (state.turnHolder !== seat) return 'Only the player whose turn it is can offer a trade';
  if (!state.rolled) return 'Roll the dice first';
  if (state.pending) return 'Finish the robber, discards or free roads first';
  if (state.trade) return 'Withdraw your open offer first';
  return null;
}

export function offerTrade(state: GameState, seat: Seat, to: unknown, give: Resources, get: Resources): Result<GameState> {
  const error = offerError(state, seat);
  if (error) return { error };
  const target = to === null ? null : state.activePlayers.find(other => other === to && other !== seat);
  if (target === undefined) return { error: 'Choose another player still in the game' };
  if (total(give) === 0 || total(get) === 0) return { error: 'Each side must give at least one card' };
  if ((Object.keys(give) as Resource[]).some(resource => give[resource] > 0 && get[resource] > 0)) {
    return { error: 'A resource cannot be on both sides' };
  }
  if (!covers(state.hands[seat] ?? noResources(), give)) return { error: 'You do not have those cards' };
  const trade: Trade = { from: seat, to: target, give, get, declined: [] };
  const toWhom = target === null ? 'everyone' : nameOf(state, target);
  return { state: note({ ...state, trade }, `${nameOf(state, seat)} offered ${toWhom} ${describeResources(give)} for ${describeResources(get)}`) };
}

export function cancelTrade(state: GameState, seat: Seat): Result<GameState> {
  if (state.trade?.from !== seat) return { error: 'You have no open offer' };
  return { state: note({ ...state, trade: null }, `${nameOf(state, seat)} withdrew the offer`) };
}

// Who may still answer an open offer
export function tradeAnswerers(state: Pick<GameState, 'activePlayers' | 'trade'>): Seat[] {
  const { trade } = state;
  if (!trade) return [];
  return state.activePlayers.filter(seat => seat !== trade.from && (trade.to === null || trade.to === seat) && !trade.declined.includes(seat));
}

export function answerTrade(state: GameState, seat: Seat, accept: boolean): Result<GameState> {
  const { trade } = state;
  if (!trade || !tradeAnswerers(state).includes(seat)) return { error: 'There is no offer for you to answer' };
  if (!accept) {
    const declined = { ...trade, declined: [...trade.declined, seat] };
    const noted = note({ ...state, trade: declined }, `${nameOf(state, seat)} declined the offer`);
    return { state: tradeAnswerers(noted).length === 0 ? { ...noted, trade: null } : noted };
  }
  if (state.pending) return { error: 'Wait until the robber or free roads are done' };
  const fromHand = state.hands[trade.from] ?? noResources();
  const toHand = state.hands[seat] ?? noResources();
  if (!covers(fromHand, trade.give)) return { error: `${nameOf(state, trade.from)} no longer has those cards` };
  if (!covers(toHand, trade.get)) return { error: 'You do not have those cards' };
  return {
    state: note({
      ...state,
      trade: null,
      hands: {
        ...state.hands,
        [trade.from]: add(subtract(fromHand, trade.give), trade.get),
        [seat]: add(subtract(toHand, trade.get), trade.give)
      }
    }, `${nameOf(state, seat)} accepted: ${nameOf(state, trade.from)} gave ${describeResources(trade.give)} for ${describeResources(trade.get)}`)
  };
}

// An offer from or to a player who leaves is dropped; an offer to everyone just loses that answerer
export function dropTradesOf(state: GameState, seat: Seat): GameState {
  const { trade } = state;
  if (!trade) return state;
  if (trade.from === seat || trade.to === seat) return { ...state, trade: null };
  const left = { ...state, activePlayers: state.activePlayers.filter(other => other !== seat) };
  return tradeAnswerers(left).length === 0 ? { ...state, trade: null } : state;
}
