// Trades between any two players at any time: properties without buildings in their color group, cash and
// Get Out of Jail Free cards. One offer is open at a time; it happens only when the other player accepts.
// Whoever receives a mortgaged property then lifts the mortgage at once for 110%, or pays 10% and keeps it.
import { BOARD, isSpace, ownable } from './board.ts';
import { groupHasBuildings, interestOn, receiveProperties } from './buildings.ts';
import { asRecord } from '../../shared/messages.ts';
import { giveCash } from './money.ts';
import { inGame, money, nameOf, note, waitError } from './state.ts';
import type { GameState, Result, Seat, Trade, TradeSide } from './types.ts';

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

// Reads one side of an offer from the network, or null if it is not shaped like one
export function parseSide(value: unknown): TradeSide | null {
  const input = asRecord(value);
  const properties = input?.properties;
  if (!input || !Array.isArray(properties) || !properties.every(isSpace)) return null;
  if (new Set(properties).size !== properties.length) return null;
  if (!isCount(input.cash) || !isCount(input.jailCards)) return null;
  return { properties: [...properties], cash: input.cash, jailCards: input.jailCards };
}

const isEmpty = (side: TradeSide) => side.properties.length === 0 && side.cash === 0 && side.jailCards === 0;

function sideError(state: GameState, seat: Seat, side: TradeSide): string | null {
  const name = nameOf(state, seat);
  for (const space of side.properties) {
    if (!ownable(space) || state.owners[space] !== seat) return `${name} does not own ${BOARD[space].name}`;
    if (groupHasBuildings(state, space)) return `Sell the buildings in ${BOARD[space].name}'s color group before trading it`;
  }
  if (side.cash > (state.cash[seat] ?? 0)) return `${name} does not have ${money(side.cash)}`;
  if (side.jailCards > (state.jailCards[seat] ?? []).length) return `${name} does not have that many Get Out of Jail Free cards`;
  return null;
}

// Each receiver must be able to pay, after the trade, at least the 10% interest on the mortgaged properties they get
function interestError(state: GameState, seat: Seat, gives: TradeSide, gets: TradeSide): string | null {
  const after = (state.cash[seat] ?? 0) - gives.cash + gets.cash;
  if (after >= interestOn(state, gets.properties)) return null;
  return `${nameOf(state, seat)} could not pay the 10% interest on the mortgaged property`;
}

function tradeError(state: GameState, trade: Trade): string | null {
  const players = inGame(state);
  if (!players.includes(trade.from) || !players.includes(trade.to)) return 'Both players must still be in the game';
  if (state.mortgageDecisions.length > 0) return waitError(state);
  return sideError(state, trade.from, trade.give) ?? sideError(state, trade.to, trade.get) ??
    interestError(state, trade.from, trade.give, trade.get) ?? interestError(state, trade.to, trade.get, trade.give);
}

export function offerTrade(state: GameState, seat: Seat, to: unknown, give: TradeSide, get: TradeSide): Result<GameState> {
  const waiting = state.mortgageDecisions.length > 0 ? waitError(state) : null;
  if (waiting) return { error: waiting };
  if (state.trade) return { error: 'Another trade is waiting for an answer' };
  const target = inGame(state).find(other => other === to);
  if (target === undefined || target === seat) return { error: 'Choose another player still in the game' };
  if (isEmpty(give) && isEmpty(get)) return { error: 'Offer or ask for something' };
  const trade: Trade = { from: seat, to: target, give, get };
  const error = tradeError(state, trade);
  if (error) return { error };
  return { state: note({ ...state, trade }, `${nameOf(state, seat)} offered ${nameOf(state, target)} a trade`) };
}

export function cancelTrade(state: GameState, seat: Seat): Result<GameState> {
  if (state.trade?.from !== seat) return { error: 'You have no open offer' };
  return { state: note({ ...state, trade: null }, `${nameOf(state, seat)} withdrew the trade offer`) };
}

// Hands one side's things from `from` to `to`; mortgaged properties then wait for `to` to lift or keep them
function handOver(state: GameState, from: Seat, to: Seat, side: TradeSide): GameState {
  const owners = { ...state.owners };
  for (const space of side.properties) owners[space] = to;
  const cards = state.jailCards[from] ?? [];
  const moved: GameState = giveCash(giveCash({
    ...state,
    owners,
    jailCards: {
      ...state.jailCards,
      [from]: cards.slice(side.jailCards),
      [to]: [...(state.jailCards[to] ?? []), ...cards.slice(0, side.jailCards)]
    }
  }, from, -side.cash), to, side.cash);
  return receiveProperties(moved, to, side.properties);
}

export function answerTrade(state: GameState, seat: Seat, accept: boolean): Result<GameState> {
  const { trade } = state;
  if (!trade || trade.to !== seat) return { error: 'There is no offer for you to answer' };
  if (!accept) return { state: note({ ...state, trade: null }, `${nameOf(state, seat)} declined the trade`) };
  const error = tradeError(state, trade);
  if (error) return { error };
  const cleared = note({ ...state, trade: null }, `${nameOf(state, seat)} accepted ${nameOf(state, trade.from)}'s trade`);
  return { state: handOver(handOver(cleared, trade.from, trade.to, trade.give), trade.to, trade.from, trade.get) };
}

// An offer from or to a player who is out of the game is dropped
export function dropTradesOf(state: GameState, seat: Seat): GameState {
  return state.trade && (state.trade.from === seat || state.trade.to === seat) ? { ...state, trade: null } : state;
}
