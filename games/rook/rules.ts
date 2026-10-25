// Rook rules shared by the browser (playable cards) and the server (validation).
//
// From Wikipedia's "Rook (card game)" article, section "Official rules", which it calls Tournament Rook, also known
// as Kentucky Discard:
// - Deck: the 1s to 4s are taken out of the 57-card Rook deck and the Rook Bird card is kept: 5 to 14 in red, yellow,
//   green and black, plus the Rook, 41 cards. Four players in two partnerships, partners sitting across.
// - Rank: 14 high down to 5 in each color. The Rook counts as the highest card of the trump suit, whatever trump is.
//   It may be played at any time, even when its holder could follow suit. If it is led, the others must play trump
//   if they can, and its holder must play it when trump is led and they hold no other trump.
// - Counters: each 5 is worth 5, each 10 and 14 is worth 10, and the Rook 20, so 120 points in all.
// - Deal: a five-card nest is set aside face down and the rest dealt, 9 cards each.
// - Bidding: starts left of the dealer and goes around in steps of 5, from 70 up to 120 (all the counters).
//   A player who passes cannot bid again that hand.
// - The high bidder takes the nest, lays any five cards aside, then names trump. The player left of the dealer
//   leads the first trick; players follow suit if they can, the highest trump or else the highest card of the
//   suit led takes the trick, and its winner leads next.
// - Last trick: whoever takes it captures the nest and scores the counters in it (the article's only last-trick bonus).
// - Scoring: a bidding team that takes at least its bid scores what it took, otherwise it loses its bid; the other
//   team scores what it took. The article plays to 300 and gives the win to the higher total if both pass it.
//   This game plays to 500 by default (the owner's choice), or the host's target; see the README.
// - More players (this game's house rules, not the article's): with "I know what I'm doing", 4 to 7 play. The seats
//   go around in seat order and the hand and nest sizes change so the 41 cards deal evenly (dealSizes). At 6 the
//   teams are two of three or three of two. At 5 and 7 each player scores alone, and after naming trump the bidder
//   calls one card (two at 7) that they do not hold: whoever holds a called card is their partner for the hand, kept
//   secret until the card is played. A called card may be among the cards laid aside, leaving the bidder fewer
//   partners or none. Each member of the bidding side scores what the side took if it made the bid, else loses the
//   bid; each defender scores what all the defenders took. Equal top totals at the target share the win.
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule, targetScoreRule, type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { teamOf } from '../../shared/partnerships.ts';
import { baseGameState } from '../../shared/seating.ts';
import { canFollow, describeTrickPlay, trickWinner as sharedTrickWinner } from '../../shared/tricks.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type {
  Bidding, Card, Color, GameState, HandSummary, LastMove, Move, Play, PublicGameState, Result, RookCard, Seat, TeamScores
} from './types.ts';

// Seats 1 and 3 against 2 and 4, the teams of every four-player game
export { teamOf };

export const COLORS: Color[] = ['red', 'yellow', 'green', 'black'];
export const NUMBERS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const ROOK: RookCard = { color: 'rook' };
export const HAND_SIZE = 9; // at four players
export const NEST_SIZE = 5; // at four players, and the smallest nest at any count
export const MIN_PLAYERS = 4;
const DECK_SIZE = 41;
export const MIN_BID = 70;
export const MAX_BID = 120;
export const BID_STEP = 5;
const TARGET_RULE = targetScoreRule(500, [300, 1000]);

export type SixTeams = 'twoOfThree' | 'threeOfTwo';
export const SIX_TEAMS: ChoiceRule<SixTeams> = {
  id: 'sixTeams', label: 'Teams at 6 players', kind: 'choice', standard: 'twoOfThree',
  choices: [{ value: 'twoOfThree', label: 'Two teams of three' }, { value: 'threeOfTwo', label: 'Three teams of two' }],
  offered: seats => seats === 6
};

// How the teams that did not win the bid score: each the counters it took, or each what all of them took together
export const DEFENDERS: ChoiceRule<'separate' | 'together'> = {
  id: 'defenders', label: 'Defending teams score', kind: 'choice', standard: 'separate',
  choices: [{ value: 'separate', label: 'Each team its own counters' }, { value: 'together', label: 'Together, both teams\' counters' }],
  offered: (seats, values) => seats === 6 && values.sixTeams === 'threeOfTwo'
};

export const ROOK_RULES: HouseRule[] = [TARGET_RULE, SIX_TEAMS, DEFENDERS];

// How many cards the bidder calls for partners: one at 5 players, two at 7, none with fixed teams
export function calledCount(players: number): number {
  return players === 5 ? 1 : players === 7 ? 2 : 0;
}

export const targetScore = (state: Pick<GameState, 'houseRules'>): number => houseRule(state, TARGET_RULE);
const ROOK_POINTS = 20;

// The teams for these seats, in seat order. Four: partners across. Six: two teams of three sitting alternately, or
// three teams of two sitting three apart. Five and seven: one team per seat
export function rookTeams(seats: Seat[], sixTeams: SixTeams): Seat[][] {
  const pairs = seats.length === 6 && sixTeams === 'threeOfTwo';
  const count = pairs ? 3 : seats.length === 4 || seats.length === 6 ? 2 : seats.length;
  return Array.from({ length: count }, (_, team) => seats.filter((_seat, index) => index % count === team));
}

// The cards per hand and in the nest: the nest holds at least five and the rest deal evenly, 41 cards each time
export function dealSizes(players: number): { hand: number; nest: number } {
  const hand = Math.floor((DECK_SIZE - NEST_SIZE) / players);
  return { hand, nest: DECK_SIZE - players * hand };
}

// A game saved before teams existed had four players, partners across
const FOUR_PLAYER_TEAMS: Seat[][] = [[1, 3], [2, 4]];

export function teamsOf(state: Pick<GameState, 'teams'>): Seat[][] {
  return state.teams ?? FOUR_PLAYER_TEAMS;
}

// The index of the seat's team in `teams`, which is also its index in the scores
export function teamOfSeat(state: Pick<GameState, 'teams' | 'activePlayers'>, seat: Seat): number {
  return teamsOf(state).findIndex(team => team.includes(seat));
}

// Every seat dealt in, in seat order. A dismissed player stays in it, since a dismissal ends the game
export function seatsInPlay(state: Pick<GameState, 'teams'>): Seat[] {
  return teamsOf(state).flat().sort((a, b) => a - b);
}

// The next seat around the table, which plays after `seat`; the last seat is followed by the first
export function seatAfter(state: Pick<GameState, 'teams'>, seat: Seat): Seat {
  const seats = seatsInPlay(state);
  return seats[(seats.indexOf(seat) + 1) % seats.length];
}

// Words joined for a sentence, e.g. 'red 14', 'red 14 and the Rook' or 'Bob, Dan and Fay'
export function listOf(words: string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// The seats' names, e.g. 'Alice and Cara' or 'Bob, Dan and Fay'
export function namesOf(seats: Seat[], playerNames: Record<Seat, string>): string {
  return listOf(seats.map(seat => playerNames[seat]));
}

// The bidder and the called partners revealed so far, in seat order
export function biddingSide(state: Pick<GameState, 'bidder' | 'called'>): Seat[] {
  if (state.bidder === null) return [];
  return [state.bidder, ...(state.called?.partners ?? [])].sort((a, b) => a - b);
}

// How many cards the bid winner lays aside: as many as the nest held
export const nestSize = (state: Pick<GameState, 'teams'>): number => dealSizes(seatsInPlay(state).length).nest;

export function buildDeck(): Card[] {
  return [...COLORS.flatMap(color => NUMBERS.map((number): Card => ({ color, number }))), ROOK];
}

export function sameCard(a: Card, b: Card): boolean {
  if (a.color === 'rook' || b.color === 'rook') return a.color === b.color;
  return a.color === b.color && a.number === b.number;
}

export function cardName(card: Card): string {
  return card.color === 'rook' ? 'the Rook' : `${card.color} ${card.number}`;
}

export function cardPoints(card: Card): number {
  if (card.color === 'rook') return ROOK_POINTS;
  if (card.number === 5) return 5;
  return card.number === 10 || card.number === 14 ? 10 : 0;
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}

// The Rook belongs to the trump suit
export function suitOf(card: Card, trump: Color | null): Color | null {
  return card.color === 'rook' ? trump : card.color;
}

// The Rook always plays; otherwise a player who holds the suit led (the Rook counting as trump) must follow it
export function canPlayCard(hand: Card[], card: Card, trick: Play[], trump: Color | null): boolean {
  return card.color === 'rook' || canFollow(hand, card, trick, held => suitOf(held, trump));
}

// The Rook ranks above every number, so it beats every trump
const rank = (card: Card) => (card.color === 'rook' ? 15 : card.number);

export function trickWinner(plays: Play[], trump: Color | null): Seat {
  return sharedTrickWinner(plays, card => suitOf(card, trump), rank, trump);
}

const NO_BIDDING: Bidding = { high: null, passed: [] };

// Everything that lasts only for one hand
const HAND_START = {
  phase: 'bidding',
  bidding: NO_BIDDING,
  bidder: null,
  bid: null,
  trump: null,
  called: null,
  trick: [],
  lastTrick: null,
  tricksWon: [0, 0],
  captured: [0, 0],
  roundSummary: null,
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    ...HAND_START,
    handNumber: 1,
    dealer: null,
    scores: [0, 0],
    hands: {},
    nest: []
  };
}

// A fresh shuffle: the nest from the top, then the hands (nine cards each at four players). The dealer's left bids first.
export function dealHand(state: GameState, dealer: Seat, random: Random): GameState {
  const seats = seatsInPlay(state);
  const { hand, nest } = dealSizes(seats.length);
  const deck = shuffle(buildDeck(), random);
  const hands = Object.fromEntries(seats.map((seat, index) => [seat, deck.slice(nest + index * hand, nest + (index + 1) * hand)]));
  const zeros = teamsOf(state).map(() => 0);
  return {
    ...state, ...HAND_START, tricksWon: zeros, captured: [...zeros], dealer, hands, nest: deck.slice(0, nest),
    currentPlayer: seatAfter(state, dealer)
  };
}

// Before the first move the cards are dealt afresh, once four players are seated, and the teams are set from the
// seats and the house rules. The last seat deals the first hand.
export function resetLobby(state: GameState, random: Random): GameState {
  const { teams: _teams, ...lobby } = state;
  const empty: GameState = { ...lobby, ...HAND_START, handNumber: 1, dealer: null, scores: [0, 0], hands: {}, nest: [] };
  const seats = state.activePlayers;
  if (seats.length < MIN_PLAYERS) return empty;
  const teams = rookTeams(seats, houseRule(state, SIX_TEAMS));
  return dealHand({ ...empty, teams, scores: teams.map(() => 0) }, seats[seats.length - 1], random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, nest, captured: _captured, ...view } = state;
  const laidAside = state.bidder !== null && viewer === state.bidder && state.phase !== 'discard' && state.phase !== 'bidding';
  return {
    ...view,
    hand: viewHand(hands, viewer),
    handCounts: handCounts(hands),
    nestCount: nest.length,
    discards: laidAside ? nest : [],
    undoAvailable
  };
}

function isColor(value: unknown): value is Color {
  return COLORS.some(color => color === value);
}

function parseCard(value: unknown): Card | null {
  const input = asRecord(value);
  if (input?.color === 'rook') return ROOK;
  const number = input?.number;
  if (!isColor(input?.color) || typeof number !== 'number' || !NUMBERS.includes(number)) return null;
  return { color: input.color, number };
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'pass':
      return { type: 'pass' };
    case 'bid':
      return typeof input.amount === 'number' && Number.isFinite(input.amount) ? { type: 'bid', amount: input.amount } : null;
    case 'nameTrump':
      return isColor(input.color) ? { type: 'nameTrump', color: input.color } : null;
    case 'play': {
      const card = parseCard(input.card);
      return card ? { type: 'play', card } : null;
    }
    case 'discard':
    case 'callPartner': {
      if (!Array.isArray(input.cards)) return null;
      const cards = input.cards.map(parseCard);
      return cards.every(card => card !== null) ? { type: input.type, cards: cards as Card[] } : null;
    }
    default:
      return null;
  }
}

// How the status line and the history describe a move, e.g. 'Bob bid 85' or 'Dan played red 12 and took the trick'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'bid':
      return lastMove.won ? `${name} bid ${lastMove.amount}, the most there is, and takes the nest` : `${name} bid ${lastMove.amount}`;
    case 'pass':
      if (lastMove.redeal) return `${name} passed. Everyone passed, so the cards are dealt again`;
      if (lastMove.won) return `${name} passed. ${playerNames[lastMove.won.seat]} won the bidding at ${lastMove.won.amount} and takes the nest`;
      return `${name} passed`;
    case 'discard':
      return `${name} laid aside ${lastMove.count ?? NEST_SIZE} cards`;
    case 'nameTrump':
      return `${name} named ${lastMove.color} trump`;
    case 'callPartner':
      return `${name} called ${listOf(lastMove.cards.map(cardName))} for ${lastMove.cards.length === 1 ? 'a partner' : 'partners'}`;
    case 'play': {
      const played = `${name} played ${cardName(lastMove.card)}`;
      const described = describeTrickPlay(played, lastMove.playerNumber, lastMove.trickWinner, playerNames);
      return lastMove.partnerOf === undefined ? described : `${described}. ${name} is ${playerNames[lastMove.partnerOf]}'s partner`;
    }
  }
}

function recorded(state: GameState, lastMove: LastMove, gameStatus = describeMove(lastMove, state.playerNames)): GameState {
  return { ...state, lastMove, gameStatus };
}

// The next bidder who has not passed, or null when only the high bidder is left
function nextBidder(state: GameState, bidding: Bidding, from: Seat): Seat | null {
  let seat = seatAfter(state, from);
  for (let i = 1; i < seatsInPlay(state).length; i++, seat = seatAfter(state, seat)) {
    if (!bidding.passed.includes(seat)) return seat;
  }
  return null;
}

// The high bidder adds the nest to their hand
function winBidding(state: GameState, high: { seat: Seat; amount: number }): GameState {
  return {
    ...state,
    phase: 'discard',
    bidder: high.seat,
    bid: high.amount,
    hands: { ...state.hands, [high.seat]: [...state.hands[high.seat], ...state.nest] },
    nest: [],
    currentPlayer: high.seat
  };
}

function bid(state: GameState, seat: Seat, amount: number): Result<GameState> {
  const high = state.bidding.high;
  if (!Number.isInteger(amount) || amount < MIN_BID) return { error: `Bid at least ${MIN_BID}` };
  if (amount > MAX_BID) return { error: `The highest bid is ${MAX_BID}` };
  if (amount % BID_STEP !== 0) return { error: `Bid in steps of ${BID_STEP}` };
  if (high && amount <= high.amount) return { error: `Bid more than ${high.amount}` };

  const bidding: Bidding = { ...state.bidding, high: { seat, amount } };
  const next = { ...state, bidding };
  const bidder = nextBidder(state, bidding, seat);
  if (amount === MAX_BID || bidder === null) {
    return { state: recorded(winBidding(next, { seat, amount }), { type: 'bid', playerNumber: seat, amount, won: true }) };
  }
  return { state: recorded({ ...next, currentPlayer: bidder }, { type: 'bid', playerNumber: seat, amount, won: false }) };
}

// A pass is final. When only the high bidder is left they win; when everyone passes the deal moves left and starts again.
function pass(state: GameState, seat: Seat, random: Random): Result<GameState> {
  const bidding: Bidding = { ...state.bidding, passed: [...state.bidding.passed, seat] };
  const { high } = bidding;
  const players = seatsInPlay(state).length;
  if (bidding.passed.length === players) {
    const dealer = seatAfter(state, state.dealer ?? seat);
    return { state: recorded(dealHand(state, dealer, random), { type: 'pass', playerNumber: seat, won: null, redeal: true }) };
  }
  // Everyone else passing leaves only the high bidder
  if (high && bidding.passed.length === players - 1) {
    const lastMove: LastMove = { type: 'pass', playerNumber: seat, won: high, redeal: false };
    const status = `${state.playerNames[high.seat]} won the bidding at ${high.amount} and takes the nest`;
    return { state: recorded(winBidding({ ...state, bidding }, high), lastMove, status) };
  }
  const next = { ...state, bidding, currentPlayer: nextBidder(state, bidding, seat) };
  return { state: recorded(next, { type: 'pass', playerNumber: seat, won: null, redeal: false }) };
}

function discard(state: GameState, seat: Seat, cards: Card[]): Result<GameState> {
  const count = nestSize(state);
  if (cards.length !== count) return { error: `Lay aside exactly ${count} cards` };
  if (cards.some((card, i) => cards.findIndex(other => sameCard(other, card)) !== i)) {
    return { error: `Lay aside ${count} different cards` };
  }
  const hand = state.hands[seat];
  if (!cards.every(card => hand.some(held => sameCard(held, card)))) return { error: 'You do not have those cards' };
  const next: GameState = {
    ...state,
    phase: 'trump',
    hands: { ...state.hands, [seat]: hand.filter(held => !cards.some(card => sameCard(card, held))) },
    nest: cards
  };
  return { state: recorded(next, { type: 'discard', playerNumber: seat, count }) };
}

// The player left of the dealer leads the first trick
const firstLeader = (state: GameState, seat: Seat): Seat => seatAfter(state, state.dealer ?? seat);

// At 5 and 7 players the bidder calls partners next; otherwise play starts
function nameTrump(state: GameState, seat: Seat, color: Color): GameState {
  const lastMove: LastMove = { type: 'nameTrump', playerNumber: seat, color };
  if (calledCount(seatsInPlay(state).length) > 0) return recorded({ ...state, phase: 'callPartner', trump: color }, lastMove);
  return recorded({ ...state, phase: 'play', trump: color, currentPlayer: firstLeader(state, seat) }, lastMove);
}

// The called cards are public; who holds them is not, so `partners` starts empty and fills as the cards are played
function callPartner(state: GameState, seat: Seat, cards: Card[]): Result<GameState> {
  const count = calledCount(seatsInPlay(state).length);
  if (cards.length !== count) return { error: `Call exactly ${count} ${count === 1 ? 'card' : 'cards'}` };
  if (cards.some((card, i) => cards.findIndex(other => sameCard(other, card)) !== i)) {
    return { error: `Call ${count} different cards` };
  }
  if (cards.some(card => state.hands[seat].some(held => sameCard(held, card)))) {
    return { error: 'You cannot call a card in your own hand' };
  }
  const next: GameState = { ...state, phase: 'play', called: { cards, partners: [] }, currentPlayer: firstLeader(state, seat) };
  return { state: recorded(next, { type: 'callPartner', playerNumber: seat, cards }) };
}

// Scores a finished hand. The bidding side is the bidder's team, or at 5 and 7 the bidder and their called partners.
// The first team at or over the target score wins, the highest total if several are; on a tie for the lead another
// hand is played, except that players scoring alone (5 and 7) share the win.
function endHand(state: GameState, lastTrick: Seat): GameState {
  const teams = teamsOf(state);
  const bidder = state.bidder ?? lastTrick;
  const bid = state.bid ?? 0;
  const nestPoints = handPoints(state.nest);
  const points: TeamScores = [...state.captured];
  points[teamOfSeat(state, lastTrick)] += nestPoints;
  const called = state.called ?? null;
  const side = biddingSide({ bidder, called });
  const sideTeams = new Set(side.map(seat => teamOfSeat(state, seat)));
  const took = points.reduce((sum, taken, team) => (sideTeams.has(team) ? sum + taken : sum), 0);
  const made = took >= bid;
  // With "together", and always with called partners, each defending team scores what all the defending teams took
  const defended = points.reduce((sum, taken, team) => (sideTeams.has(team) ? sum : sum + taken), 0);
  const together = called !== null || houseRule(state, DEFENDERS) === 'together';
  const change: TeamScores = points.map((taken, team) => {
    if (sideTeams.has(team)) return made ? took : -bid;
    return together ? defended : taken;
  });
  const scores: TeamScores = state.scores.map((score, team) => score + change[team]);
  const summary: HandSummary = {
    handNumber: state.handNumber, bidder, bid, made, points, change, nestPoints, lastTrick, acknowledged: [],
    ...(called && { partners: called.partners })
  };
  const scored: GameState = { ...state, phase: 'handOver', scores, currentPlayer: null, roundSummary: summary };

  const bidders = called ? namesOf(side, state.playerNames) : `${state.playerNames[bidder]}'s team`;
  const outcome = `${bidders} bid ${bid} and took ${took}: ${made ? `they score ${took}` : `they lose ${bid}`}`;
  const top = Math.max(...scores);
  if (top < targetScore(state)) return { ...scored, gameStatus: outcome };
  const leaders = teams.filter((_team, index) => scores[index] === top);
  if (leaders.length > 1 && called) {
    const winners = leaders.flat().sort((a, b) => a - b);
    return { ...scored, isGameOver: true, winners, gameStatus: `${namesOf(winners, state.playerNames)} win with ${top} points!` };
  }
  if (leaders.length > 1) {
    const tied = teams.length === 2 ? 'Both teams are' : 'The leading teams are';
    return { ...scored, gameStatus: `${outcome}. ${tied} tied at ${top}, so another hand is played` };
  }
  const [winner] = leaders;
  return {
    ...scored,
    isGameOver: true,
    winners: winner,
    gameStatus: `${namesOf(winner, state.playerNames)} ${winner.length === 1 ? 'wins' : 'win'} with ${top} points!`
  };
}

function play(state: GameState, seat: Seat, card: Card): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  if (!canPlayCard(hand, card, state.trick, state.trump)) {
    return { error: `Follow suit: play ${suitOf(state.trick[0].card, state.trump)}` };
  }
  const trick = [...state.trick, { seat, card }];
  // Playing a called card reveals its holder as a partner
  const called = state.called ?? null;
  const reveals = called !== null && called.cards.some(other => sameCard(other, card)) && !called.partners.includes(seat);
  const partnerOf = reveals && state.bidder !== null ? { partnerOf: state.bidder } : {};
  const played: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: hand.filter(held => !sameCard(held, card)) },
    trick,
    called: reveals ? { ...called, partners: [...called.partners, seat].sort((a, b) => a - b) } : called
  };
  if (trick.length < seatsInPlay(state).length) {
    const next = { ...played, currentPlayer: seatAfter(state, seat) };
    return { state: recorded(next, { type: 'play', playerNumber: seat, card, trickWinner: null, ...partnerOf }) };
  }

  const winner = trickWinner(trick, state.trump);
  const team = teamOfSeat(state, winner);
  const tricksWon: TeamScores = [...state.tricksWon];
  const captured: TeamScores = [...state.captured];
  tricksWon[team] += 1;
  captured[team] += handPoints(trick.map(p => p.card));
  const taken: GameState = { ...played, trick: [], lastTrick: { plays: trick, winner }, tricksWon, captured, currentPlayer: winner };
  const lastMove: LastMove = { type: 'play', playerNumber: seat, card, trickWinner: winner, ...partnerOf };
  if (Object.values(taken.hands).some(rest => rest.length > 0)) return { state: recorded(taken, lastMove) };
  const ended = endHand(taken, winner);
  return { state: { ...ended, lastMove } };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  const { phase } = state;
  switch (parsed.type) {
    case 'bid':
    case 'pass':
      if (phase !== 'bidding') return { error: 'The bidding is over' };
      return parsed.type === 'bid' ? bid(state, seat, parsed.amount) : pass(state, seat, random);
    case 'discard':
      if (phase !== 'discard') return { error: 'Only the bid winner lays aside cards, after the bidding' };
      return discard(state, seat, parsed.cards);
    case 'nameTrump':
      if (phase === 'discard') return { error: `Lay aside ${nestSize(state)} cards first` };
      if (phase !== 'trump') return { error: 'Trump is named by the bid winner after the bidding' };
      return { state: nameTrump(state, seat, parsed.color) };
    case 'callPartner':
      if (phase !== 'callPartner') return { error: 'Only the bid winner calls partners, after naming trump' };
      return callPartner(state, seat, parsed.cards);
    case 'play':
      if (phase === 'bidding') return { error: 'Finish the bidding first' };
      if (phase === 'callPartner') return { error: `Wait for ${state.playerNames[state.bidder ?? seat]} to call a partner` };
      if (phase !== 'play') return { error: 'Wait for trump to be named' };
      return play(state, seat, parsed.card);
  }
}

const ROUND: RoundAccess<GameState, HandSummary> = {
  get: state => state.roundSummary,
  set: (state, roundSummary) => ({ ...state, roundSummary }),
  noun: 'hand'
};

// Deals the next hand once every connected player has acknowledged the summary. The deal passes to the next seat.
function startNextHandIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;
  const seats = seatsInPlay(state);
  const dealer = seatAfter(state, state.dealer ?? seats[seats.length - 1]);
  const handNumber = state.handNumber + 1;
  const next = dealHand({ ...state, handNumber }, dealer, random);
  return { ...next, gameStatus: `Hand ${handNumber}: ${state.playerNames[dealer]} deals` };
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  return acknowledge(state, seat, ROUND, next => startNextHandIfReady(next, random));
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  if (asRecord(action)?.type === 'acknowledgeRound') return acknowledgeRound(state, seat, random);
  return { error: 'Unknown action' };
}

// A dismissal ends the game: the highest-scoring team without the dismissed player wins, every such team on a tie.
// With called partners (5 and 7 players) each player is their own team, so there is no partnership to break
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const others = teamsOf(state).map((team, index) => ({ team, score: state.scores[index] })).filter(({ team }) => !team.includes(seat));
  const top = Math.max(...others.map(({ score }) => score));
  const winners = others.filter(({ score }) => score === top).flatMap(({ team }) => team).sort((a, b) => a - b);
  const reason = calledCount(seatsInPlay(state).length) > 0 ? 'the game ends' : 'the partnership is broken';
  return {
    ...state,
    isGameOver: true,
    currentPlayer: null,
    winners,
    undoVote: null,
    gameStatus: `${state.playerNames[seat]} left, so ${reason}: ${namesOf(winners, state.playerNames)} ${winners.length === 1 ? 'wins' : 'win'}`
  };
}

// The next hand may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextHandIfReady(state, random);
}
