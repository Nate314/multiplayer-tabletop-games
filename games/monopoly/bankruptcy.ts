// Bankruptcy. Owing a player: buildings are sold to the bank at half price, then the creditor takes all cash,
// properties (paying 10% interest on each mortgaged one) and Get Out of Jail Free cards. Owing the bank, or leaving
// the game: buildings go back to the bank, jail cards to the bottom of their decks, and every property is auctioned unmortgaged.
import { BOARD, mortgageInterest } from './board.ts';
import { dropBidder, nextAuction } from './auctions.ts';
import { sellAllBuildings } from './buildings.ts';
import { charge, giveCash } from './money.ts';
import { leaveJail, returnJailCards } from './movement.ts';
import { checkGameOver, nameOf, nextInGame, note, startTurn } from './state.ts';
import { dropTradesOf } from './trades.ts';
import type { GameState, Seat } from './types.ts';

function propertiesOf(state: GameState, seat: Seat): number[] {
  return Object.entries(state.owners).filter(([, owner]) => owner === seat).map(([space]) => Number(space));
}

function toPlayer(state: GameState, seat: Seat, creditor: Seat): GameState {
  const spaces = propertiesOf(state, seat);
  const owners = { ...state.owners };
  for (const space of spaces) owners[space] = creditor;
  const cash = state.cash[seat] ?? 0;
  const handed: GameState = giveCash(giveCash({
    ...state,
    owners,
    jailCards: { ...state.jailCards, [seat]: [], [creditor]: [...(state.jailCards[creditor] ?? []), ...(state.jailCards[seat] ?? [])] }
  }, seat, -cash), creditor, cash);
  return spaces
    .filter(space => state.mortgaged.includes(space))
    .reduce((next, space) => charge(next, creditor, null, mortgageInterest(space), `10% interest on ${BOARD[space].name}`), handed);
}

function toBank(state: GameState, seat: Seat): GameState {
  const spaces = propertiesOf(state, seat).sort((a, b) => a - b);
  const owners = { ...state.owners };
  for (const space of spaces) delete owners[space];
  return {
    ...state,
    owners,
    mortgaged: state.mortgaged.filter(space => !spaces.includes(space)),
    cash: { ...state.cash, [seat]: 0 },
    jailCards: { ...state.jailCards, [seat]: [] },
    decks: returnJailCards(state.decks, state.jailCards[seat] ?? []),
    auctionQueue: [...state.auctionQueue, ...spaces]
  };
}

// `seat` is out of the game, owing `creditor` (null for the bank). Their other debts are dropped, as are debts owed to them.
export function goBankrupt(state: GameState, seat: Seat, creditor: Seat | null, reason: string): GameState {
  const debts = state.debts.filter(debt => debt.debtor !== seat && debt.creditor !== seat);
  const sold = sellAllBuildings({ ...leaveJail(state, seat), debts }, seat).state;
  const handed = creditor === null ? toBank(sold, seat) : toPlayer(sold, seat, creditor);
  const out = note(dropTradesOf({ ...handed, bankrupt: [...handed.bankrupt, seat], pendingBuy: state.turnHolder === seat ? null : handed.pendingBuy }, seat),
    `${nameOf(state, seat)} ${reason}`);
  const over = checkGameOver(dropBidder(out, seat));
  if (over.isGameOver) return over;
  const turned = state.turnHolder === seat ? startTurn(over, nextInGame(over, seat)) : over;
  return nextAuction(turned);
}

// A player whose turn it is may give up (to the bank); a player who owes money goes bankrupt to whoever they owe
export function declareBankruptcy(state: GameState, seat: Seat): GameState {
  const debt = state.debts.find(owed => owed.debtor === seat);
  const creditor = debt ? debt.creditor : null;
  return goBankrupt(state, seat, creditor, `went bankrupt to ${nameOf(state, creditor)}`);
}
