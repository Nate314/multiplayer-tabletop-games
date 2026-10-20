// Hearts rules shared by the browser (playable cards) and the server (validation).
//
// From Wikipedia's "Hearts (card game)" article, section "Modern rules", with the queen of spades of Black Lady, which
// the article calls the standard game of the Hearts group in the United States, "often, somewhat confusingly, also
// called 'Hearts'":
// - Four players, no partnerships. All 52 cards are dealt, 13 each. Ace is high and there is no trump.
// - Passing: each player passes three cards, the direction changing each hand. Here, as the spec says: left, right,
//   across, then no pass, repeating. Everyone passes at once and the cards arrive when all four have passed.
// - The player holding the 2 of clubs leads it to the first trick (the article's minor variant, used here).
//   Players follow suit if they can, otherwise play anything; the highest card of the suit led takes the trick and
//   its winner leads next.
// - No penalty card (a heart or the queen of spades) may be played to the first trick, unless the hand has nothing else.
// - A heart may not be led until a heart has been played, unless the leader holds only hearts.
// - Each heart taken is 1 point and the queen of spades 13. A player who takes all 26 shoots the moon: each other
//   player takes 26 instead.
// - The game ends when a player reaches 100; the lowest score wins, and equal lowest scores share the win.
import { asRecord } from '../../shared/messages.ts';
import { RANKS, SUITS, cardName, rankValue, sameCard, standardDeck } from '../../shared/playingCards.ts';
import { baseGameState, connectedPlayers } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { canFollow, trickWinner } from '../../shared/tricks.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, HandSummary, LastMove, PassDirection, Play, PlayingCard, PublicGameState, Result, Seat } from './types.ts';

export const SEATS: Seat[] = [1, 2, 3, 4];
export const HAND_SIZE = 13;
export const PASS_SIZE = 3;
export const TARGET_SCORE = 100;
export const MOON = 26;
const PASS_CYCLE: PassDirection[] = ['left', 'right', 'across', 'none'];
const TWO_OF_CLUBS: PlayingCard = { suit: 'clubs', rank: '2' };
const QUEEN_OF_SPADES: PlayingCard = { suit: 'spades', rank: 'Q' };

const suitOf = (card: PlayingCard) => card.suit;
const rankOf = (card: PlayingCard) => rankValue(card.rank, true);

export function cardPoints(card: PlayingCard): number {
  if (card.suit === 'hearts') return 1;
  return sameCard(card, QUEEN_OF_SPADES) ? 13 : 0;
}

// Suit by suit, two to ace
export function sortHand(hand: PlayingCard[]): PlayingCard[] {
  const order = (card: PlayingCard) => SUITS.indexOf(card.suit) * 100 + rankOf(card);
  return [...hand].sort((a, b) => order(a) - order(b));
}

// The seat to the left, which plays next
export function nextSeat(seat: Seat): Seat {
  return seat % 4 + 1;
}

export function passDirection(handNumber: number): PassDirection {
  return PASS_CYCLE[(handNumber - 1) % PASS_CYCLE.length];
}

export function passTarget(seat: Seat, direction: PassDirection): Seat {
  const steps = { left: 1, across: 2, right: 3, none: 0 }[direction];
  return (seat - 1 + steps) % 4 + 1;
}

const perSeat = (value: (seat: Seat) => number): Record<Seat, number> =>
  Object.fromEntries(SEATS.map(seat => [seat, value(seat)]));

// Why `card` may not be played from `hand` now, or null when it may
export function playError(hand: PlayingCard[], card: PlayingCard, state: Pick<GameState, 'trick' | 'tricksPlayed' | 'heartsBroken'>): string | null {
  const { trick, tricksPlayed, heartsBroken } = state;
  const firstTrick = tricksPlayed === 0;
  if (trick.length === 0) {
    if (firstTrick) return sameCard(card, TWO_OF_CLUBS) ? null : 'Lead the 2 of clubs';
    if (card.suit === 'hearts' && !heartsBroken && hand.some(held => held.suit !== 'hearts')) return 'Hearts have not been broken';
    return null;
  }
  if (!canFollow(hand, card, trick, suitOf)) return `Follow suit: play ${trick[0].card.suit}`;
  // Void in clubs on the first trick: a penalty card only when nothing else is left
  if (firstTrick && cardPoints(card) > 0 && hand.some(held => cardPoints(held) === 0 && canFollow(hand, held, trick, suitOf))) {
    return 'No hearts or the queen of spades on the first trick';
  }
  return null;
}

// Everything that lasts only for one hand
const HAND_START = {
  phase: 'passing',
  passes: {},
  trick: [],
  lastTrick: null,
  tricksPlayed: 0,
  heartsBroken: false,
  roundSummary: null,
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...HAND_START, handNumber: 1, scores: perSeat(() => 0), taken: perSeat(() => 0), hands: {} };
}

// Starts play: the holder of the 2 of clubs leads
function startPlay(state: GameState): GameState {
  const leader = SEATS.find(seat => state.hands[seat].some(card => sameCard(card, TWO_OF_CLUBS))) ?? 1;
  return { ...state, phase: 'play', currentPlayer: leader };
}

// A fresh shuffle dealt 13 to each player, then the pass, or play at once on a hand without one
export function dealHand(state: GameState, random: Random): GameState {
  const deck = shuffle(standardDeck(), random);
  const hands = Object.fromEntries(SEATS.map((seat, index) => [seat, sortHand(deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE))]));
  const dealt: GameState = { ...state, ...HAND_START, hands, taken: perSeat(() => 0), currentPlayer: null };
  const direction = passDirection(state.handNumber);
  if (direction === 'none') return { ...startPlay(dealt), gameStatus: `Hand ${state.handNumber}: no pass this hand` };
  return { ...dealt, gameStatus: `Hand ${state.handNumber}: pass three cards to the ${direction}` };
}

// Before the first pass completes the cards are dealt afresh, once four players are seated
export function resetLobby(state: GameState, random: Random): GameState {
  const empty: GameState = { ...state, ...HAND_START, handNumber: 1, scores: perSeat(() => 0), taken: perSeat(() => 0), hands: {} };
  if (state.activePlayers.length < SEATS.length) return empty;
  return { ...dealHand(empty, random), gameStatus: state.gameStatus };
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, passes, ...view } = state;
  return {
    ...view,
    hand: viewer === null ? [] : hands[viewer] ?? [],
    handCounts: Object.fromEntries(Object.entries(hands).map(([seat, hand]) => [seat, hand.length])),
    passed: SEATS.filter(seat => passes[seat]),
    myPass: viewer === null ? [] : passes[viewer] ?? [],
    undoAvailable
  };
}

function parseCard(value: unknown): PlayingCard | null {
  const input = asRecord(value);
  const suit = SUITS.find(candidate => candidate === input?.suit);
  const rank = RANKS.find(candidate => candidate === input?.rank);
  return suit && rank ? { suit, rank } : null;
}

// How the status line and the history describe a move, e.g. 'Dan played queen of spades; Bob took the trick'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const played = `${playerNames[lastMove.playerNumber]} played ${cardName(lastMove.card)}`;
  if (lastMove.trickWinner === null) return played;
  if (lastMove.trickWinner === lastMove.playerNumber) return `${played} and took the trick`;
  return `${played}; ${playerNames[lastMove.trickWinner]} took the trick`;
}

// The names of the seats with the lowest score, and that score
function lowest(state: GameState, seats: Seat[]): { winners: Seat[]; text: string } {
  const low = Math.min(...seats.map(seat => state.scores[seat]));
  const winners = seats.filter(seat => state.scores[seat] === low);
  const names = winners.map(seat => state.playerNames[seat]);
  const text = winners.length === 1
    ? `${names[0]} wins with ${low} points!`
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)} share the win with ${low} points!`;
  return { winners, text };
}

// Scores a finished hand; the game ends once anyone has 100 or more
function endHand(state: GameState): GameState {
  const moon = SEATS.find(seat => state.taken[seat] === MOON) ?? null;
  const change = moon === null ? state.taken : perSeat(seat => (seat === moon ? 0 : MOON));
  const scores = perSeat(seat => state.scores[seat] + change[seat]);
  const summary: HandSummary = { handNumber: state.handNumber, taken: state.taken, change, moon, acknowledged: [] };
  const scored: GameState = { ...state, phase: 'handOver', scores, currentPlayer: null, roundSummary: summary };
  const outcome = moon === null ? `Hand ${state.handNumber} is scored` : `${state.playerNames[moon]} shot the moon: everyone else takes ${MOON}`;
  if (Math.max(...Object.values(scores)) < TARGET_SCORE) return { ...scored, gameStatus: outcome };
  const { winners, text } = lowest(scored, SEATS);
  return { ...scored, isGameOver: true, winners, gameStatus: text };
}

function play(state: GameState, seat: Seat, card: PlayingCard): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  const refused = playError(hand, card, state);
  if (refused) return { error: refused };

  const trick: Play[] = [...state.trick, { seat, card }];
  const played: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: hand.filter(held => !sameCard(held, card)) },
    trick,
    heartsBroken: state.heartsBroken || card.suit === 'hearts'
  };
  if (trick.length < SEATS.length) {
    const lastMove: LastMove = { type: 'play', playerNumber: seat, card, trickWinner: null };
    return { state: { ...played, currentPlayer: nextSeat(seat), lastMove, gameStatus: describeMove(lastMove, state.playerNames) } };
  }

  const winner = trickWinner(trick, suitOf, rankOf, null);
  const points = trick.reduce((sum, p) => sum + cardPoints(p.card), 0);
  const lastMove: LastMove = { type: 'play', playerNumber: seat, card, trickWinner: winner };
  const taken: GameState = {
    ...played,
    trick: [],
    lastTrick: { plays: trick, winner },
    tricksPlayed: state.tricksPlayed + 1,
    taken: { ...state.taken, [winner]: state.taken[winner] + points },
    currentPlayer: winner,
    lastMove,
    gameStatus: describeMove(lastMove, state.playerNames)
  };
  return { state: taken.tricksPlayed === HAND_SIZE ? endHand(taken) : taken };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  const card = input?.type === 'play' ? parseCard(input.card) : null;
  if (!card) return { error: 'Invalid move' };
  if (state.phase === 'passing') return { error: 'Pass three cards first' };
  if (state.phase !== 'play') return { error: 'The hand is over' };
  return play(state, seat, card);
}

// Three different places in the sender's hand, or null
function parsePass(value: unknown, handSize: number): number[] | null {
  if (!Array.isArray(value) || value.length !== PASS_SIZE) return null;
  if (!value.every(index => Number.isInteger(index) && index >= 0 && index < handSize)) return null;
  return new Set(value).size === PASS_SIZE ? value : null;
}

// The cards leave the sender's hand at once, and arrive when the fourth player has passed.
// The first time that happens the game starts, so nobody can join after the cards have moved.
function passCards(state: GameState, seat: Seat, cards: unknown): Result<GameState> {
  if (!state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
  if (state.activePlayers.length < SEATS.length) return { error: 'Waiting for more players' };
  if (state.phase !== 'passing') return { error: passDirection(state.handNumber) === 'none' ? 'There is no pass this hand' : 'The pass is over' };
  if (state.passes[seat]) return { error: 'You have passed already' };
  const hand = state.hands[seat];
  const indexes = parsePass(cards, hand.length);
  if (!indexes) return { error: `Pick ${PASS_SIZE} different cards to pass` };

  const passes = { ...state.passes, [seat]: indexes.map(index => hand[index]) };
  const hands = { ...state.hands, [seat]: hand.filter((_, index) => !indexes.includes(index)) };
  const passed: GameState = { ...state, passes, hands, gameStatus: `${state.playerNames[seat]} passed three cards` };
  if (SEATS.some(other => !passes[other])) return { state: passed };

  const direction = passDirection(state.handNumber);
  const received = Object.fromEntries(SEATS.map(sender => [passTarget(sender, direction), passes[sender]]));
  const dealt = Object.fromEntries(SEATS.map(other => [other, sortHand([...hands[other], ...received[other]])]));
  const started = startPlay({ ...passed, started: true, passes: {}, hands: dealt });
  const leader = started.currentPlayer ?? 1;
  return { state: { ...started, gameStatus: `Everyone passed. ${state.playerNames[leader]} leads the 2 of clubs` } };
}

// Deals the next hand once every connected player has acknowledged the summary
function startNextHandIfReady(state: GameState, random: Random): GameState {
  const summary = state.roundSummary;
  if (!summary || state.isGameOver) return state;
  if (!connectedPlayers(state).every(seat => summary.acknowledged.includes(seat))) return state;
  return dealHand({ ...state, handNumber: state.handNumber + 1 }, random);
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  const summary = state.roundSummary;
  if (!summary) return { error: 'Nothing to continue' };
  if (summary.acknowledged.includes(seat)) return { state };
  const next: GameState = {
    ...state,
    roundSummary: { ...summary, acknowledged: [...summary.acknowledged, seat] },
    gameStatus: `${state.playerNames[seat]} is ready for the next hand`
  };
  return { state: startNextHandIfReady(next, random) };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  const input = asRecord(action);
  if (input?.type === 'pass') return passCards(state, seat, input.cards);
  if (input?.type === 'acknowledgeRound') return acknowledgeRound(state, seat, random);
  return { error: 'Unknown action' };
}

// The game needs four, so it ends; the hand in progress is not scored and the lowest score among those left wins
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const { winners, text } = lowest(state, state.activePlayers);
  return {
    ...state,
    isGameOver: true,
    currentPlayer: null,
    winners,
    undoVote: null,
    gameStatus: `${state.playerNames[seat]} left, so the game ends: ${text}`
  };
}

// The next hand may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextHandIfReady(state, random);
}
