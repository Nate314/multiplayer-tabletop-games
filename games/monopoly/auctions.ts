// Auctions: a property the lander declines, or one a player bankrupt to the bank gave up, goes to the highest bidder.
// Every player still in the game may bid, the lander included, in whole dollars up to the cash they hold.
// A pass is final, and the auction ends when everyone but the high bidder has passed.
import { BOARD } from './board.ts';
import { charge } from './money.ts';
import { inGame, money, nameOf, note } from './state.ts';
import type { Auction, GameState, Result, Seat } from './types.ts';

export function startAuction(state: GameState, space: number): GameState {
  const auction: Auction = { space, highBid: 0, highBidder: null, passed: [] };
  return note({ ...state, auction }, `${BOARD[space].name} is up for auction`);
}

// Starts the next queued auction when none is running
export function nextAuction(state: GameState): GameState {
  if (state.auction || state.auctionQueue.length === 0 || state.isGameOver) return state;
  const [space, ...auctionQueue] = state.auctionQueue;
  return startAuction({ ...state, auctionQueue }, space);
}

function stillBidding(state: GameState, auction: Auction): Seat[] {
  return inGame(state).filter(seat => !auction.passed.includes(seat));
}

// Sells to the high bidder once everyone else has passed; with no bid at all the bank keeps it
export function closeAuctionIfDone(state: GameState): GameState {
  const { auction } = state;
  if (!auction) return state;
  const bidding = stillBidding(state, auction);
  const name = BOARD[auction.space].name;
  const winner = auction.highBidder;
  if (winner !== null && bidding.length === 1 && bidding[0] === winner) {
    const sold = note({ ...state, auction: null, owners: { ...state.owners, [auction.space]: winner } },
      `${nameOf(state, winner)} won ${name} for ${money(auction.highBid)}`);
    return nextAuction(charge(sold, winner, null, auction.highBid, `auction for ${name}`));
  }
  if (bidding.length === 0) return nextAuction(note({ ...state, auction: null }, `Nobody bid, so ${name} stays with the bank`));
  return state;
}

function bidderError(state: GameState, seat: Seat): string | null {
  const { auction } = state;
  if (!auction) return 'There is no auction';
  if (!inGame(state).includes(seat)) return 'You are out of the game';
  if (auction.passed.includes(seat)) return 'You have passed in this auction';
  if (state.debts.length > 0) return `Wait for ${nameOf(state, state.debts[0].debtor)} to pay`;
  return null;
}

export function bid(state: GameState, seat: Seat, amount: unknown): Result<GameState> {
  const error = bidderError(state, seat);
  if (error) return { error };
  const auction = state.auction!;
  if (!Number.isInteger(amount) || (amount as number) <= auction.highBid) {
    return { error: `Bid a whole number of dollars above ${money(auction.highBid)}` };
  }
  const value = amount as number;
  if (value > (state.cash[seat] ?? 0)) return { error: 'You cannot bid more cash than you have' };
  const next = note({ ...state, auction: { ...auction, highBid: value, highBidder: seat } }, `${nameOf(state, seat)} bid ${money(value)}`);
  return { state: closeAuctionIfDone(next) };
}

export function passBid(state: GameState, seat: Seat): Result<GameState> {
  const error = bidderError(state, seat);
  if (error) return { error };
  const auction = state.auction!;
  if (auction.highBidder === seat) return { error: 'You hold the high bid' };
  const next = note({ ...state, auction: { ...auction, passed: [...auction.passed, seat] } }, `${nameOf(state, seat)} passed`);
  return { state: closeAuctionIfDone(next) };
}

// A player leaving the auction (bankrupt or dismissed): if they held the high bid, bidding starts over
export function dropBidder(state: GameState, seat: Seat): GameState {
  const { auction } = state;
  if (!auction) return state;
  const restarted = auction.highBidder === seat ? { ...auction, highBid: 0, highBidder: null, passed: [] } : auction;
  return closeAuctionIfDone({ ...state, auction: restarted });
}
