// Monopoly rules: the game's hooks for the platform, reading untrusted moves and actions, and the public view.
// The rules themselves live in board.ts, cards.ts, movement.ts, buildings.ts, auctions.ts, trades.ts and bankruptcy.ts.
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { JAIL_FINE, START_CASH, isSpace, ownable } from './board.ts';
import { DECKS } from './cards.ts';
import { bid, closeAuctionIfDone, nextAuction, passBid, startAuction } from './auctions.ts';
import { declareBankruptcy, goBankrupt } from './bankruptcy.ts';
import { build, liftMortgages, mortgage, sellBuilding, unmortgage } from './buildings.ts';
import { giveCash, settleDebts } from './money.ts';
import { leaveJail, returnJailCards, roll, rollDice } from './movement.ts';
import { LOG_SIZE, checkGameOver, inGame, money, nameOf, nextInGame, note, startTurn, syncTurn } from './state.ts';
import { answerTrade, cancelTrade, dropTradesOf, offerTrade, parseSide } from './trades.ts';
import type { DeckName, GameState, LastMove, Move, PublicGameState, Random, Result, Seat } from './types.ts';

const MAX_ROLL_OFFS = 100; // ties roll again; the cap only guards against a broken random

function freshDecks(random: Random): GameState['decks'] {
  const order = (deck: DeckName) => shuffle(DECKS[deck].map((_, index) => index), random);
  return { chance: order('chance'), chest: order('chest') };
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    cash: {},
    positions: {},
    jailed: {},
    jailCards: {},
    bankrupt: [],
    owners: {},
    buildings: {},
    mortgaged: [],
    decks: { chance: [], chest: [] },
    turnHolder: null,
    canRoll: false,
    doublesRolled: 0,
    dice: null,
    pendingBuy: null,
    auction: null,
    auctionQueue: [],
    debts: [],
    trade: null,
    mortgageDecisions: [],
    drawnCard: null,
    log: [],
    lastMove: null
  };
}

// Everyone rolls both dice and the highest total goes first; players tied for highest roll again
function rollOff(state: GameState, random: Random): { first: Seat; status: string } {
  let contenders = state.activePlayers;
  const rounds: string[] = [];
  for (let round = 0; round < MAX_ROLL_OFFS && contenders.length > 1; round++) {
    const rolled = contenders.map(seat => {
      const [a, b] = rollDice(random);
      return { seat, value: a + b };
    });
    const highest = Math.max(...rolled.map(({ value }) => value));
    rounds.push(rolled.map(({ seat, value }) => `${nameOf(state, seat)} ${value}`).join(', '));
    contenders = rolled.filter(({ value }) => value === highest).map(({ seat }) => seat);
  }
  const first = contenders[0];
  return { first, status: `Highest roll goes first: ${rounds.join('; tie: ')}. ${nameOf(state, first)} goes first` };
}

// Before the first move everyone has $1500 on GO with fresh decks, and once two are seated the roll-off picks who starts
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const each = <T>(value: () => T): Record<Seat, T> => Object.fromEntries(players.map(seat => [seat, value()]));
  const fresh: GameState = {
    ...createGameState(state.gameId),
    ...state,
    cash: each(() => START_CASH),
    positions: each(() => 0),
    jailed: {},
    jailCards: each((): DeckName[] => []),
    bankrupt: [],
    owners: {},
    buildings: {},
    mortgaged: [],
    decks: freshDecks(random),
    dice: null,
    auction: null,
    auctionQueue: [],
    debts: [],
    trade: null,
    mortgageDecisions: [],
    drawnCard: null,
    log: [],
    lastMove: null
  };
  if (players.length < 2) return syncTurn(startTurn(fresh, players[0] ?? null));
  const { first, status } = rollOff(fresh, random);
  return syncTurn({ ...startTurn(fresh, first), gameStatus: `${state.gameStatus}. ${status}` });
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const { decks, ...view } = state;
  return { ...view, deckCounts: { chance: decks.chance.length, chest: decks.chest.length }, undoAvailable };
}

const SPACE_MOVES = ['build', 'sellBuilding', 'mortgage', 'unmortgage'] as const;
const PLAIN_MOVES = ['roll', 'buy', 'decline', 'payJailFine', 'useJailCard', 'endTurn', 'declareBankruptcy'] as const;

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  const type = SPACE_MOVES.find(candidate => candidate === input?.type);
  if (type) return isSpace(input?.space) ? { type, space: input.space } : null;
  if (input?.type === 'liftMortgages') {
    const spaces = input.spaces;
    if (!Array.isArray(spaces) || !spaces.every(isSpace) || new Set(spaces).size !== spaces.length) return null;
    return { type: 'liftMortgages', spaces: [...spaces] };
  }
  const plain = PLAIN_MOVES.find(candidate => candidate === input?.type);
  return plain ? { type: plain } : null;
}

export function describeMove(lastMove: LastMove): string {
  return lastMove.events.join('. ');
}

// Everything that follows by itself: debts paid when they can be, the next queued auction, the end of the game,
// and who must act now
function settle(state: GameState): GameState {
  return syncTurn(checkGameOver(nextAuction(closeAuctionIfDone(settleDebts(state)))));
}

// The rules run with an empty log, so what they noted is exactly what this change did
function finish(before: GameState, after: GameState, lastMove?: Omit<LastMove, 'events'>): GameState {
  const settled = settle(after);
  const events = settled.log;
  return {
    ...settled,
    log: [...before.log, ...events].slice(-LOG_SIZE),
    gameStatus: events.length > 0 ? events.join('. ') : before.gameStatus,
    lastMove: lastMove ? { ...lastMove, events } : before.lastMove
  };
}

function buy(state: GameState, seat: Seat): Result<GameState> {
  const space = state.pendingBuy;
  const property = space === null ? null : ownable(space);
  if (space === null || !property) return { error: 'There is nothing to buy' };
  if ((state.cash[seat] ?? 0) < property.price) {
    return { error: `You need ${money(property.price)}: sell buildings or mortgage first, or decline to auction it` };
  }
  const bought = giveCash({ ...state, pendingBuy: null, owners: { ...state.owners, [space]: seat } }, seat, -property.price);
  return { state: note(bought, `${nameOf(state, seat)} bought ${property.name} for ${money(property.price)}`) };
}

function decline(state: GameState, seat: Seat): Result<GameState> {
  const space = state.pendingBuy;
  if (space === null) return { error: 'There is nothing to decline' };
  const declined = note({ ...state, pendingBuy: null }, `${nameOf(state, seat)} declined to buy ${ownable(space)?.name}`);
  return { state: startAuction(declined, space) };
}

function jailError(state: GameState, seat: Seat): string | null {
  if (!(seat in state.jailed)) return 'You are not in Jail';
  if (!state.canRoll) return 'Get out of Jail at the start of your turn, before rolling';
  return null;
}

function payJailFine(state: GameState, seat: Seat): Result<GameState> {
  const error = jailError(state, seat) ?? ((state.cash[seat] ?? 0) < JAIL_FINE ? `You need ${money(JAIL_FINE)}` : null);
  if (error) return { error };
  const paid = giveCash(leaveJail(state, seat), seat, -JAIL_FINE);
  return { state: note(paid, `${nameOf(state, seat)} paid ${money(JAIL_FINE)} to leave Jail`) };
}

function playJailCard(state: GameState, seat: Seat): Result<GameState> {
  const [card, ...rest] = state.jailCards[seat] ?? [];
  const error = jailError(state, seat) ?? (card === undefined ? 'You have no Get Out of Jail Free card' : null);
  if (error) return { error };
  const used: GameState = {
    ...leaveJail(state, seat),
    jailCards: { ...state.jailCards, [seat]: rest },
    decks: returnJailCards(state.decks, [card])
  };
  return { state: note(used, `${nameOf(state, seat)} used a Get Out of Jail Free card`) };
}

function endTurn(state: GameState, seat: Seat): Result<GameState> {
  if (state.pendingBuy !== null) return { error: 'Buy the property or decline it first' };
  if (state.canRoll) return { error: state.doublesRolled > 0 ? 'You rolled doubles: roll again' : 'Roll the dice first' };
  return { state: note(startTurn(state, nextInGame(state, seat)), `${nameOf(state, seat)} ended their turn`) };
}

// A debtor may only raise money (or give up); otherwise the turn holder plays, once any auction is over
function play(state: GameState, seat: Seat, move: Move, random: Random): Result<GameState> {
  if (move.type === 'declareBankruptcy') return { state: declareBankruptcy(state, seat) };
  if (move.type === 'sellBuilding') return sellBuilding(state, seat, move.space);
  if (move.type === 'mortgage') return mortgage(state, seat, move.space);
  if (state.debts.length > 0) return { error: 'Pay what you owe first: sell buildings, mortgage, trade, or declare bankruptcy' };
  if (move.type === 'liftMortgages') return liftMortgages(state, seat, move.spaces);
  if (state.mortgageDecisions.length > 0) return { error: 'Lift or keep the mortgages you received first' };
  if (state.auction) return { error: 'Wait for the auction to finish' };
  switch (move.type) {
    case 'build': return build(state, seat, move.space);
    case 'unmortgage': return unmortgage(state, seat, move.space);
    case 'buy': return buy(state, seat);
    case 'decline': return decline(state, seat);
    case 'payJailFine': return payJailFine(state, seat);
    case 'useJailCard': return playJailCard(state, seat);
    case 'endTurn': return endTurn(state, seat);
    case 'roll':
      if (state.pendingBuy !== null) return { error: 'Buy the property or decline it first' };
      if (!state.canRoll) return { error: 'You have rolled: end your turn' };
      return { state: roll(state, seat, random) };
  }
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (state.bankrupt.includes(seat)) return { error: 'You are bankrupt' };
  const result = play({ ...state, log: [] }, seat, parsed, random);
  if ('error' in result) return result;
  return { state: finish(state, result.state, { type: parsed.type, playerNumber: seat }) };
}

function act(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  switch (input?.type) {
    case 'bid': return bid(state, seat, input.amount);
    case 'passBid': return passBid(state, seat);
    case 'offerTrade': {
      const give = parseSide(input.give);
      const get = parseSide(input.get);
      if (!give || !get) return { error: 'Invalid trade' };
      return offerTrade(state, seat, input.to, give, get);
    }
    case 'answerTrade':
      if (typeof input.accept !== 'boolean') return { error: 'Invalid answer' };
      return answerTrade(state, seat, input.accept);
    case 'cancelTrade': return cancelTrade(state, seat);
    default: return { error: 'Unknown action' };
  }
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  if (inGame(state).length < 2) return { error: 'Waiting for more players' };
  const result = act({ ...state, log: [] }, seat, action);
  if ('error' in result) return result;
  return { state: finish(state, result.state) };
}

// A dismissed player is out as if bankrupt: to the player they owe, if they owe one still in the game, otherwise
// to the bank, whose auctions sell their properties to the others
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const working = { ...state, log: [] };
  if (state.bankrupt.includes(seat)) return finish(state, dropTradesOf(working, seat));
  const owed = state.debts.find(debt => debt.debtor === seat)?.creditor ?? null;
  const creditor = owed !== null && inGame(state).includes(owed) ? owed : null;
  const reason = creditor === null
    ? 'left the game, so their properties go to auction'
    : `left the game owing ${nameOf(state, creditor)}, who takes everything`;
  return finish(state, goBankrupt(working, seat, creditor, reason));
}

// A trade offer from or to a player who disconnects is dropped, so it never holds up other trades
export function onPlayerDisconnected(state: GameState, seat: Seat): GameState {
  if (state.trade?.from !== seat && state.trade?.to !== seat) return state;
  return finish(state, note(dropTradesOf({ ...state, log: [] }, seat), 'The open trade offer was dropped'));
}
