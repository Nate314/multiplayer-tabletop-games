import { useState } from 'react';
import { JAIL_FINE, ownable } from '../board.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

type TurnPanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canMove: boolean; // it is this player's move and no vote is running
  onMove: (move: Move) => void;
};

// What the player who must act now can do: pay a debt, buy or decline, get out of jail, roll, end the turn, or give up
export default function TurnPanel({ gameState, playerNumber, canMove, onMove }: TurnPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const { debts, auction, pendingBuy, canRoll, doublesRolled, jailed, jailCards, cash, playerNames, currentPlayer, isGameOver } = gameState;
  if (isGameOver || currentPlayer === null) return null;

  const debt = debts[0];
  const giveUp = (
    <div className="bankruptcy">
      {confirming ? (
        <>
          <span>{debt ? `Give everything to ${debt.creditor === null ? 'the bank' : playerNames[debt.creditor]}?` : 'Leave the game and give your properties to the bank for auction?'}</span>
          <button type="button" className="danger" onClick={() => { setConfirming(false); onMove({ type: 'declareBankruptcy' }); }}>
            Confirm bankruptcy
          </button>
          <button type="button" onClick={() => setConfirming(false)}>Keep playing</button>
        </>
      ) : (
        <button type="button" className="danger-outline" onClick={() => setConfirming(true)}>Declare bankruptcy</button>
      )}
    </div>
  );

  if (!canMove) {
    const waiting = debt ? `Waiting for ${playerNames[debt.debtor]} to pay` : `Waiting for ${playerNames[currentPlayer]}`;
    return <section className="panel turn-panel" aria-label="Turn"><div className="turn-waiting">{auction ? 'Auction in progress' : waiting}</div></section>;
  }

  let body;
  if (debt) {
    const to = debt.creditor === null ? 'the bank' : playerNames[debt.creditor];
    body = (
      <p className="turn-note">
        You owe {to} ${debt.amount} ({debt.reason}) and have ${cash[playerNumber]}. Sell buildings or mortgage (choose a
        property on the board), or trade for cash. The debt is paid as soon as you have enough.
      </p>
    );
  } else if (auction) {
    body = <p className="turn-note">Your turn goes on once the auction is over.</p>;
  } else if (pendingBuy !== null) {
    const property = ownable(pendingBuy);
    body = (
      <div className="turn-buttons">
        <button type="button" className="primary" onClick={() => onMove({ type: 'buy' })} disabled={(cash[playerNumber] ?? 0) < (property?.price ?? 0)}>
          Buy {property?.name} for ${property?.price}
        </button>
        <button type="button" onClick={() => onMove({ type: 'decline' })}>Decline and auction</button>
      </div>
    );
  } else if (canRoll && playerNumber in jailed) {
    body = (
      <div className="turn-buttons">
        <button type="button" className="primary" onClick={() => onMove({ type: 'roll' })}>Roll for doubles</button>
        <button type="button" onClick={() => onMove({ type: 'payJailFine' })} disabled={(cash[playerNumber] ?? 0) < JAIL_FINE}>Pay ${JAIL_FINE}</button>
        <button type="button" onClick={() => onMove({ type: 'useJailCard' })} disabled={(jailCards[playerNumber] ?? []).length === 0}>Use jail card</button>
      </div>
    );
  } else if (canRoll) {
    body = (
      <div className="turn-buttons">
        <button type="button" className="primary" onClick={() => onMove({ type: 'roll' })}>{doublesRolled > 0 ? 'Doubles: roll again' : 'Roll the dice'}</button>
      </div>
    );
  } else {
    body = (
      <div className="turn-buttons">
        <button type="button" className="primary" onClick={() => onMove({ type: 'endTurn' })}>End turn</button>
      </div>
    );
  }

  return (
    <section className="panel turn-panel" aria-label="Your turn">
      <div className="panel-title">{debt ? 'You owe money' : 'Your turn'}</div>
      {body}
      {!auction && giveUp}
    </section>
  );
}
