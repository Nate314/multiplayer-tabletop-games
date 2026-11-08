import { useState } from 'react';
import { ownable } from '../board.ts';
import { inGame } from '../state.ts';
import type { Action, PublicGameState, Seat } from '../types.ts';

type AuctionPanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canAct: boolean;
  onAction: (action: Action) => void;
};

// The running auction: the high bid, who is still bidding, and this player's bid or pass
export default function AuctionPanel({ gameState, playerNumber, canAct, onAction }: AuctionPanelProps) {
  const { auction, playerNames, cash, debts } = gameState;
  const [amount, setAmount] = useState('');
  if (!auction) return null;
  const property = ownable(auction.space);
  const bidding = inGame(gameState).filter(seat => !auction.passed.includes(seat));
  const myCash = cash[playerNumber] ?? 0;
  const inIt = bidding.includes(playerNumber) && canAct && debts.length === 0;
  const holding = auction.highBidder === playerNumber;
  const minimum = auction.highBid + 1;
  const value = amount === '' ? minimum : Number(amount);
  const valid = Number.isInteger(value) && value >= minimum && value <= myCash;

  function bid(offer: number) {
    onAction({ type: 'bid', amount: offer });
    setAmount('');
  }

  return (
    <section className="panel auction-panel" aria-label="Auction">
      <div className="panel-title">Auction: {property?.name}</div>
      <div className="auction-bid">
        {auction.highBidder === null ? `No bids yet (list price $${property?.price})` : `High bid $${auction.highBid} by ${playerNames[auction.highBidder]}`}
      </div>
      <div className="auction-bidders">Still bidding: {bidding.map(seat => playerNames[seat]).join(', ') || 'nobody'}</div>
      {inIt && !holding && (
        <div className="auction-controls">
          {[1, 10, 50].map(step => (
            <button key={step} type="button" onClick={() => bid(auction.highBid + step)} disabled={auction.highBid + step > myCash}>
              ${auction.highBid + step}
            </button>
          ))}
          <label className="auction-amount">
            <span>Bid $</span>
            <input type="number" min={minimum} max={myCash} step={1} value={amount} placeholder={String(minimum)}
              onChange={event => setAmount(event.target.value)} />
          </label>
          <button type="button" className="primary" onClick={() => bid(value)} disabled={!valid}>Bid</button>
          <button type="button" onClick={() => onAction({ type: 'passBid' })}>Pass</button>
        </div>
      )}
      {holding && <div className="auction-note">You hold the high bid</div>}
      {canAct && auction.passed.includes(playerNumber) && <div className="auction-note">You passed</div>}
      {inIt && <div className="auction-note">You have ${myCash}. A pass is final.</div>}
    </section>
  );
}
