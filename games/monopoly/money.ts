// Paying the bank and other players. A payment that cannot be made at once becomes a debt, and the game
// waits for the debtor to raise the money (selling buildings, mortgaging, trading) or declare bankruptcy.
import { money, nameOf, note } from './state.ts';
import type { Debt, GameState, Seat } from './types.ts';

export function giveCash(state: GameState, seat: Seat, amount: number): GameState {
  return { ...state, cash: { ...state.cash, [seat]: (state.cash[seat] ?? 0) + amount } };
}

export const potOf = (state: Pick<GameState, 'freeParkingPot'>): number => state.freeParkingPot ?? 0;

export function addToPot(state: GameState, amount: number): GameState {
  return { ...state, freeParkingPot: potOf(state) + amount };
}

// Who a debt is paid to, as the log names it: a player, the bank, or the Free Parking pot
function payee(state: GameState, debt: Debt): string {
  return debt.toPot ? 'Free Parking' : nameOf(state, debt.creditor);
}

function transfer(state: GameState, debt: Debt): GameState {
  const paid = giveCash(state, debt.debtor, -debt.amount);
  if (debt.creditor !== null) return giveCash(paid, debt.creditor, debt.amount);
  return debt.toPot ? addToPot(paid, debt.amount) : paid;
}

// Pays every debt at the front of the queue that its debtor can now afford, in order
export function settleDebts(state: GameState): GameState {
  let next = state;
  while (next.debts.length > 0) {
    const [debt, ...rest] = next.debts;
    if ((next.cash[debt.debtor] ?? 0) < debt.amount) break;
    next = note(
      { ...transfer(next, debt), debts: rest },
      `${nameOf(next, debt.debtor)} paid ${payee(next, debt)} ${money(debt.amount)} (${debt.reason})`
    );
  }
  return next;
}

// `debtor` owes `amount` to `creditor` (null for the bank), paid now if the queue ahead of it allows
// With `toPot` a payment to the bank goes to the Free Parking pot instead
export function charge(state: GameState, debtor: Seat, creditor: Seat | null, amount: number, reason: string, toPot = false): GameState {
  if (amount <= 0) return state;
  const debt: Debt = toPot && creditor === null ? { debtor, creditor, amount, reason, toPot: true } : { debtor, creditor, amount, reason };
  const queued = settleDebts({ ...state, debts: [...state.debts, debt] });
  if (!queued.debts.includes(debt)) return queued;
  return note(queued, `${nameOf(state, debtor)} owes ${payee(state, debt)} ${money(amount)} (${reason})`);
}
