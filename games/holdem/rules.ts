// No-limit Texas Hold'em rules shared by the browser (what the viewer may do) and the server (validation)
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, connectedPlayers } from '../../shared/seating.ts';
import { standardDeck } from '../../shared/playingCards.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import { bestHand, compareHands } from './handRank.ts';
import type { HandRank } from './handRank.ts';
import type {
  GameState, HandResult, LastMove, Move, PaidPot, PlayingCard, Pot, PublicGameState, Result, Seat, Street
} from './types.ts';

export const STARTING_CHIPS = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

const NEXT_STREET: Record<Street, { street: Street; cards: number } | null> = {
  preflop: { street: 'flop', cards: 3 },
  flop: { street: 'turn', cards: 1 },
  turn: { street: 'river', cards: 1 },
  river: null
};

export const chipText = (amount: number) => amount.toLocaleString('en-US');

// The seats after `from` going clockwise (up the seat numbers, wrapping), `from` itself last if it is among them
function clockwise(seats: Seat[], from: Seat): Seat[] {
  const sorted = [...seats].sort((a, b) => a - b);
  return [...sorted.filter(seat => seat > from), ...sorted.filter(seat => seat <= from)];
}

const withChips = (state: Pick<GameState, 'activePlayers' | 'chips'>) =>
  state.activePlayers.filter(seat => (state.chips[seat] ?? 0) > 0);

// Dealt in and not folded
export const liveSeats = (state: Pick<GameState, 'dealtIn' | 'folded'>) =>
  state.dealtIn.filter(seat => !state.folded.includes(seat));

// Live and not all in: the players who can still bet
const ableSeats = (state: GameState) => liveSeats(state).filter(seat => (state.chips[seat] ?? 0) > 0);

const betOf = (state: Pick<GameState, 'bets'>, seat: Seat) => state.bets[seat] ?? 0;

// Whether `seat` still has to act this betting round
function needsToAct(state: GameState, seat: Seat): boolean {
  return ableSeats(state).includes(seat) && (state.actedAt[seat] === undefined || betOf(state, seat) < state.currentBet);
}

// Over once every player who can bet has acted and matched the bet, or nobody is left to bet against
function roundComplete(state: GameState): boolean {
  const able = ableSeats(state);
  if (able.length === 0) return true;
  if (able.length === 1) return betOf(state, able[0]) >= Math.max(...liveSeats(state).map(seat => betOf(state, seat)));
  return able.every(seat => !needsToAct(state, seat));
}

type Options = { toCall: number; canCheck: boolean; canRaise: boolean; minTo: number; maxTo: number };

// What `seat` may do now. `minTo` is the smallest raise (or bet) to, `maxTo` all in; an all-in below minTo is allowed.
export function options(
  state: Pick<GameState, 'bets' | 'chips' | 'currentBet' | 'raiseSize' | 'actedAt' | 'dealtIn' | 'folded'>,
  seat: Seat
): Options {
  const bet = betOf(state, seat);
  const stack = state.chips[seat] ?? 0;
  const toCall = Math.min(state.currentBet - bet, stack);
  const acted = state.actedAt[seat];
  // A short all-in does not reopen the betting to a player who has acted, until the raises since add up to a full one
  const open = acted === undefined || state.currentBet - acted >= state.raiseSize;
  const someoneToAnswer = liveSeats(state).some(other => other !== seat && (state.chips[other] ?? 0) > 0);
  const maxTo = bet + stack;
  return {
    toCall,
    canCheck: toCall === 0,
    canRaise: open && someoneToAnswer && maxTo > state.currentBet,
    minTo: state.currentBet + state.raiseSize,
    maxTo
  };
}

// The main pot, then the side pots, from what each player put in this hand. A side pot starts above each live
// all-in player's total; a pot is shared by the live players who put in at least its level, or can still bet.
export function computePots(state: Pick<GameState, 'contributed' | 'chips' | 'dealtIn' | 'folded'>): Pot[] {
  const { contributed } = state;
  const live = liveSeats(state);
  const amounts = Object.values(contributed);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const allIn = live.filter(seat => (state.chips[seat] ?? 0) === 0).map(seat => contributed[seat] ?? 0);
  const top = Math.max(0, ...live.map(seat => contributed[seat] ?? 0));
  const levels = [...new Set([...allIn, top])].filter(level => level > 0).sort((a, b) => a - b);
  const pots: Pot[] = [];
  let previous = 0;
  for (const level of levels) {
    const amount = amounts.reduce((sum, put) => sum + Math.min(put, level) - Math.min(put, previous), 0);
    const eligible = live.filter(seat => (contributed[seat] ?? 0) >= level || (state.chips[seat] ?? 0) > 0).sort((a, b) => a - b);
    pots.push({ amount, eligible });
    previous = level;
  }
  // Chips a folded player put in above every live player's total (possible only after a player leaves) join the last pot
  const counted = pots.reduce((sum, pot) => sum + pot.amount, 0);
  if (pots.length > 0) pots[pots.length - 1].amount += total - counted;
  return pots;
}

// Shares a pot equally; the odd chips go one each to the first winners after the button, going clockwise
export function splitPot(amount: number, winners: Seat[], button: Seat): Record<Seat, number> {
  const share = Math.floor(amount / winners.length);
  const odd = amount - share * winners.length;
  const ordered = clockwise(winners, button);
  return Object.fromEntries(ordered.map((seat, index) => [seat, share + (index < odd ? 1 : 0)]));
}

// Takes `count` cards off the top of the deck
function draw(deck: PlayingCard[], count: number): { deck: PlayingCard[]; cards: PlayingCard[] } {
  return { deck: deck.slice(0, deck.length - count), cards: deck.slice(deck.length - count).reverse() };
}

// Everything that lasts only for one hand
const HAND_START = {
  holeCards: {},
  deck: [],
  board: [],
  street: 'preflop',
  dealtIn: [],
  folded: [],
  bets: {},
  contributed: {},
  currentBet: 0,
  raiseSize: BIG_BLIND,
  actedAt: {},
  handResult: null,
  endVotes: [],
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...HAND_START, handNumber: 0, button: null, chips: {} };
}

// Moves `amount` of `seat`'s chips into their bet
function putIn(state: GameState, seat: Seat, amount: number): GameState {
  return {
    ...state,
    chips: { ...state.chips, [seat]: state.chips[seat] - amount },
    bets: { ...state.bets, [seat]: betOf(state, seat) + amount },
    contributed: { ...state.contributed, [seat]: (state.contributed[seat] ?? 0) + amount }
  };
}

// The next player clockwise from `from` who has to act
function nextToAct(state: GameState, from: Seat): Seat | null {
  return clockwise(state.dealtIn, from).find(seat => needsToAct(state, seat)) ?? null;
}

// Deals a hand to everyone holding chips: the button moves to the next of them, then the blinds are posted left of it.
// Heads-up the button posts the small blind. Before the flop the player left of the big blind acts first.
export function dealHand(state: GameState, random: Random): GameState {
  const players = withChips(state);
  const button = state.button === null ? players[0] : clockwise(players, state.button)[0];
  const order = clockwise(players, button); // the button last
  const small = players.length === 2 ? button : order[0];
  const big = clockwise(players, small)[0];

  let deck = shuffle(standardDeck(), random);
  const holeCards: Record<Seat, PlayingCard[]> = {};
  for (const seat of order) {
    const dealt = draw(deck, 2);
    deck = dealt.deck;
    holeCards[seat] = dealt.cards;
  }
  const handNumber = state.handNumber + 1;
  let next: GameState = {
    ...state,
    ...HAND_START,
    handNumber,
    button,
    holeCards,
    deck,
    dealtIn: players,
    bets: Object.fromEntries(players.map(seat => [seat, 0])),
    contributed: Object.fromEntries(players.map(seat => [seat, 0])),
    currentBet: BIG_BLIND,
    gameStatus: `Hand ${handNumber}: ${state.playerNames[button]} has the button`
  };
  next = putIn(next, small, Math.min(SMALL_BLIND, next.chips[small]));
  next = putIn(next, big, Math.min(BIG_BLIND, next.chips[big]));
  // Blinds that put everyone all in leave nothing to bet
  if (roundComplete(next)) return { ...nextStreet(next), gameStatus: next.gameStatus };
  return { ...next, currentPlayer: nextToAct(next, big) };
}

// Before the first move, every seated player gets their starting chips and the first hand is dealt afresh.
// Nothing is dealt until two players are seated. The first player to join has the first button.
export function resetLobby(state: GameState, random: Random): GameState {
  const chips = Object.fromEntries(state.activePlayers.map(seat => [seat, STARTING_CHIPS]));
  const empty: GameState = { ...state, ...HAND_START, handNumber: 0, button: null, chips };
  if (state.activePlayers.length < 2) return empty;
  return dealHand(empty, random);
}

// Every live hand at the showdown, and each pot to the best of the hands that may win it.
// Without a showdown each pot has one player left in it.
function endHand(state: GameState, showdown: boolean): GameState {
  const live = liveSeats(state);
  const button = state.button ?? live[0];
  const ranks: Record<Seat, HandRank> = showdown
    ? Object.fromEntries(live.map(seat => [seat, bestHand([...state.holeCards[seat], ...state.board])]))
    : {};
  const pots: PaidPot[] = computePots(state).map(({ amount, eligible }) => {
    if (eligible.length === 1) return { amount, winners: eligible, hand: null };
    const top = eligible.reduce((best, seat) => compareHands(ranks[seat], ranks[best]) > 0 ? seat : best);
    const winners = eligible.filter(seat => compareHands(ranks[seat], ranks[top]) === 0);
    return { amount, winners, hand: ranks[top].name };
  });
  const won: Record<Seat, number> = {};
  for (const pot of pots) {
    for (const [seat, amount] of Object.entries(splitPot(pot.amount, pot.winners, button))) {
      won[Number(seat)] = (won[Number(seat)] ?? 0) + amount;
    }
  }
  const chips = { ...state.chips };
  for (const [seat, amount] of Object.entries(won)) chips[Number(seat)] += amount;
  const shown = showdown
    ? Object.fromEntries(live.map(seat => [seat, { cards: state.holeCards[seat], hand: ranks[seat].name }]))
    : {};
  const handResult: HandResult = { handNumber: state.handNumber, showdown, shown, pots, won, acknowledged: [] };

  const names = (seats: Seat[]) => seats.map(seat => state.playerNames[seat]).join(' and ');
  const paid = pots.map(pot => {
    if (showdown && pot.hand === null) return `${names(pot.winners)} gets back ${chipText(pot.amount)} uncalled`;
    const verb = pot.winners.length === 1 ? 'wins' : 'split';
    return `${names(pot.winners)} ${verb} ${chipText(pot.amount)}${pot.hand ? ` with ${pot.hand}` : ''}`;
  }).join('; ');

  const ended: GameState = {
    ...state,
    chips,
    bets: {},
    currentBet: 0,
    actedAt: {},
    handResult,
    currentPlayer: null
  };
  const holders = withChips(ended);
  if (holders.length === 1) {
    const winner = holders[0];
    return {
      ...ended,
      isGameOver: true,
      winners: [winner],
      gameStatus: `${paid}. ${state.playerNames[winner]} has every chip and wins!`
    };
  }
  const busted = state.dealtIn.filter(seat => chips[seat] === 0);
  const out = busted.length === 0 ? '' : `. ${names(busted)} ${busted.length === 1 ? 'is' : 'are'} out of chips`;
  return { ...ended, gameStatus: `${paid}${out}` };
}

// The bets go into the pot and the next cards are dealt, after a burn card. When nobody can bet any more,
// the board is dealt out to the showdown.
function nextStreet(state: GameState): GameState {
  const step = NEXT_STREET[state.street];
  if (!step) return endHand(state, true);
  const burned = draw(state.deck, 1);
  const dealt = draw(burned.deck, step.cards);
  const next: GameState = {
    ...state,
    deck: dealt.deck,
    board: [...state.board, ...dealt.cards],
    street: step.street,
    bets: Object.fromEntries(state.dealtIn.map(seat => [seat, 0])),
    currentBet: 0,
    raiseSize: BIG_BLIND,
    actedAt: {}
  };
  if (roundComplete(next)) return nextStreet(next);
  return { ...next, currentPlayer: nextToAct(next, state.button ?? next.dealtIn[0]) };
}

// After a move or a player leaving: the hand ends when one player is left in it, the round when the betting is done
function settle(state: GameState, from: Seat): GameState {
  if (liveSeats(state).length === 1) return endHand(state, false);
  if (roundComplete(state)) return nextStreet(state);
  const current = state.currentPlayer;
  const keep = current !== null && current !== from && needsToAct(state, current);
  return { ...state, currentPlayer: keep ? current : nextToAct(state, from) };
}

const STREET_NAMES: Record<Street, string> = { preflop: '', flop: 'The flop is dealt', turn: 'The turn is dealt', river: 'The river is dealt' };

// What happened to the hand after a move, for the status line
function aftermath(before: GameState, after: GameState): string {
  if (after.handResult) {
    const runOut = after.handResult.showdown && before.board.length < 5 && after.board.length - before.board.length > 1;
    return runOut ? `The board is dealt out. ${after.gameStatus}` : after.gameStatus;
  }
  if (after.street !== before.street) {
    return after.board.length - before.board.length > (before.street === 'preflop' ? 3 : 1)
      ? 'The board is dealt out'
      : STREET_NAMES[after.street];
  }
  return '';
}

// How the status line and the history describe a move, e.g. 'Alice raised to 60', 'Bob called 40 (all in)'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  const allIn = lastMove.allIn ? ' (all in)' : '';
  switch (lastMove.type) {
    case 'fold': return `${name} folded`;
    case 'check': return `${name} checked`;
    case 'call': return `${name} called ${chipText(lastMove.paid)}${allIn}`;
    case 'raise': return `${name} ${lastMove.bet ? 'bet' : 'raised to'} ${chipText(lastMove.to)}${allIn}`;
  }
}

function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'fold':
    case 'check':
    case 'call':
      return { type: input.type };
    case 'raise':
      return typeof input.to === 'number' && Number.isSafeInteger(input.to) ? { type: 'raise', to: input.to } : null;
    default:
      return null;
  }
}

// The total bet a move leaves the player with, or why it is not allowed
function betTo(state: GameState, seat: Seat, move: Move): number | { error: string } {
  const { toCall, canCheck, canRaise, minTo, maxTo } = options(state, seat);
  const bet = betOf(state, seat);
  switch (move.type) {
    case 'fold': return bet;
    case 'check': return canCheck ? bet : { error: `You must call ${chipText(toCall)}, raise or fold` };
    case 'call': return canCheck ? { error: 'Nothing to call: check instead' } : bet + toCall;
    case 'raise': {
      const first = state.currentBet === 0;
      if (move.to > maxTo) return { error: `You have only ${chipText(maxTo)} chips` };
      if (move.to <= state.currentBet || (move.to < minTo && move.to < maxTo)) {
        return { error: first ? `The smallest bet is ${chipText(minTo)}` : `The smallest raise is to ${chipText(minTo)}` };
      }
      return canRaise ? move.to : { error: 'The betting is not open to you' };
    }
  }
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (state.handResult || !needsToAct(state, seat)) return { error: 'Not your turn' };
  const to = betTo(state, seat, parsed);
  if (typeof to !== 'number') return to;

  const paid = to - betOf(state, seat);
  let next = putIn(state, seat, paid);
  if (parsed.type === 'fold') next = { ...next, folded: [...state.folded, seat] };
  const raise = to - state.currentBet;
  if (raise > 0) {
    next = { ...next, currentBet: to };
    if (raise >= state.raiseSize) next = { ...next, raiseSize: raise }; // a full raise; a short all-in leaves it
  }
  next = { ...next, actedAt: { ...next.actedAt, [seat]: next.currentBet } };
  const allIn = parsed.type !== 'fold' && next.chips[seat] === 0 && paid > 0;
  const lastMove: LastMove = { type: parsed.type, playerNumber: seat, to, paid, allIn, bet: parsed.type === 'raise' && state.currentBet === 0 };
  const said = describeMove(lastMove, state.playerNames);
  const settled = settle({ ...next, lastMove }, seat);
  const after = aftermath(state, settled);
  return { state: { ...settled, gameStatus: after ? `${said}. ${after}` : said } };
}

// Deals the next hand once every connected player with chips has pressed Continue
function startNextHandIfReady(state: GameState, random: Random): GameState {
  const result = state.handResult;
  if (!result || state.isGameOver) return state;
  if (!connectedPlayers(state).filter(seat => (state.chips[seat] ?? 0) > 0).every(seat => result.acknowledged.includes(seat))) {
    return state;
  }
  return dealHand(state, random);
}

// Ends the game once every player still holding chips has voted yes; the most chips wins
function settleEndVote(state: GameState): GameState {
  const holders = withChips(state);
  if (state.endVotes.length === 0 || !holders.every(seat => state.endVotes.includes(seat))) return state;
  const ranked = [...state.activePlayers].sort((a, b) => (state.chips[b] ?? 0) - (state.chips[a] ?? 0) || a - b);
  const most = state.chips[ranked[0]];
  return {
    ...state,
    isGameOver: true,
    currentPlayer: null,
    winners: ranked.filter(seat => state.chips[seat] === most),
    gameStatus: `The game ends by vote: ${ranked.map(seat => `${state.playerNames[seat]} ${chipText(state.chips[seat] ?? 0)}`).join(', ')}`
  };
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  const result = state.handResult;
  if (!result) return { error: 'Nothing to continue' };
  if (result.acknowledged.includes(seat)) return { state };
  const next: GameState = {
    ...state,
    handResult: { ...result, acknowledged: [...result.acknowledged, seat] },
    gameStatus: `${state.playerNames[seat]} is ready for the next hand`
  };
  return { state: startNextHandIfReady(next, random) };
}

function voteEnd(state: GameState, seat: Seat, yes: boolean): Result<GameState> {
  if (!state.handResult) return { error: 'Vote to end between hands' };
  if (!state.chips[seat]) return { error: 'Only players with chips vote' };
  const endVotes = state.endVotes.filter(voter => voter !== seat);
  const name = state.playerNames[seat];
  const next: GameState = {
    ...state,
    endVotes: yes ? [...endVotes, seat].sort((a, b) => a - b) : endVotes,
    gameStatus: yes ? `${name} voted to end the game` : `${name} wants to keep playing`
  };
  return { state: settleEndVote(next) };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  const input = asRecord(action);
  if (input?.type === 'acknowledgeRound') return acknowledgeRound(state, seat, random);
  if (input?.type === 'voteEnd' && typeof input.yes === 'boolean') return voteEnd(state, seat, input.yes);
  return { error: 'Unknown action' };
}

// The leaver's hand is folded and their chips leave the table; what they bet stays in the pot and the hand goes on.
// Their end vote, if they had one, is cleared.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: _gone, ...chips } = state.chips;
  const voted = state.endVotes.includes(seat);
  let next: GameState = { ...state, chips, endVotes: voted ? [] : state.endVotes };
  if (!state.handResult && liveSeats(state).includes(seat)) {
    next = settle({ ...next, folded: [...state.folded, seat] }, seat);
    if (next.handResult) return next;
  }
  if (next.handResult && withChips(next).length === 1 && !next.isGameOver) {
    const winner = withChips(next)[0];
    return { ...next, isGameOver: true, currentPlayer: null, winners: [winner], gameStatus: `${next.playerNames[winner]} has every chip and wins!` };
  }
  return startNextHandIfReady(settleEndVote(next), random);
}

// The next hand may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextHandIfReady(state, random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { holeCards, deck: _deck, ...view } = state;
  return {
    ...view,
    myCards: viewer === null ? [] : holeCards[viewer] ?? [],
    pots: computePots(state),
    undoAvailable
  };
}
