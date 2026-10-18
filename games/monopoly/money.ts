// Paying the bank and other players. A payment that cannot be made at once becomes a debt, and the game
// waits for the debtor to raise the money (selling buildings, mortgaging, trading) or declare bankruptcy.
import { money, nameOf, note } from './state.ts';
import type { Debt, GameState, Seat } from './types.ts';

export function giveCash(state: GameState, seat: Seat, amount: number): GameState {
  return { ...state, cash: { ...state.cash, [seat]: (state.cash[seat] ?? 0) + amount } };
}

function transfer(state: GameState, from: Seat, to: Seat | null, amount: number): GameState {
  const paid = giveCash(state, from, -amount);
  return to === null ? paid : giveCash(paid, to, amount);
}

// Pays every debt at the front of the queue that its debtor can now afford, in order
export function settleDebts(state: GameState): GameState {
  let next = state;
  while (next.debts.length > 0) {
    const [debt, ...rest] = next.debts;
    if ((next.cash[debt.debtor] ?? 0) < debt.amount) break;
    next = note(
      { ...transfer(next, debt.debtor, debt.creditor, debt.amount), debts: rest },
      `${nameOf(next, debt.debtor)} paid ${nameOf(next, debt.creditor)} ${money(debt.amount)} (${debt.reason})`
    );
  }
  return next;
}

// `debtor` owes `amount` to `creditor` (null for the bank), paid now if the queue ahead of it allows
export function charge(state: GameState, debtor: Seat, creditor: Seat | null, amount: number, reason: string): GameState {
  if (amount <= 0) return state;
  const debt: Debt = { debtor, creditor, amount, reason };
  const queued = settleDebts({ ...state, debts: [...state.debts, debt] });
  if (!queued.debts.includes(debt)) return queued;
  return note(queued, `${nameOf(state, debtor)} owes ${nameOf(state, creditor)} ${money(amount)} (${reason})`);
}
