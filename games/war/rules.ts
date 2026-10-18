// War rules, from https://en.wikipedia.org/wiki/War_(card_game), for two players.
// Each player turns up their own card as a move; the battle settles on the second flip.
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { cardName, rankValue, standardDeck } from '../../shared/playingCards.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { PlayingCard } from '../../shared/playingCards.ts';
import type { Random } from '../../shared/types.ts';
import type { Battle, GameState, Laid, LastMove, Outcome, PublicCard, PublicGameState, Result, Seat } from './types.ts';

export const DECK_SIZE = 52;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), piles: {}, battle: null, lastBattle: null, lastMove: null };
}

// The deck is shuffled and dealt one card at a time, starting with seat 1, so each player has 26.
// Nothing is dealt until two players are seated. Seat 1 flips first.
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const base: GameState = { ...state, battle: null, lastBattle: null, lastMove: null };
  if (players.length < 2) return { ...base, piles: Object.fromEntries(players.map(seat => [seat, []])) };
  const deck = shuffle(standardDeck(), random);
  const piles = Object.fromEntries(players.map((seat, index) =>
    [seat, deck.filter((_, position) => position % players.length === index)]));
  return { ...base, piles };
}

const otherSeat = (state: GameState, seat: Seat): Seat => state.activePlayers.find(other => other !== seat) ?? seat;

// The card that counts for a player in the current round: the last one they turned up
const upCard = (laid: Laid[]): PlayingCard => {
  const up = [...laid].reverse().find(entry => entry.faceUp);
  if (!up) throw new Error('A battle card is missing');
  return up.card;
};

// How the status line and the history describe a flip, e.g. 'Bob turned up the ace of hearts and wins the battle, taking 2 cards'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  const up = cardName(lastMove.up);
  let flipped: string;
  if (!lastMove.fresh) flipped = `${name} has no cards left, so the ${up} stands`;
  else if (lastMove.down > 0) flipped = `${name} put a card face down and turned up the ${up}`;
  else if (lastMove.war) flipped = `${name} turned up the last card in the pile, the ${up}`;
  else flipped = `${name} turned up the ${up}`;

  const { outcome } = lastMove;
  switch (outcome.kind) {
    case 'waiting': return flipped;
    case 'war': return `${flipped}: a tie, so it is war!`;
    case 'returned': return `${flipped}: a tie, and both players are out of cards, so each takes their own cards back`;
    case 'won': {
      const winner = outcome.winner === lastMove.playerNumber ? '' : ` ${playerNames[outcome.winner]}`;
      return `${flipped} and${winner} wins the ${lastMove.war ? 'war' : 'battle'}, taking ${outcome.taken} cards`;
    }
  }
}

// Opening round: one card face up. In a war: one face down and one face up, or the last card face up,
// or nothing when the player has no cards left (their last face-up card stands).
function lay(pile: PlayingCard[], war: boolean): Laid[] {
  if (!war || pile.length === 1) return pile.slice(0, 1).map(card => ({ card, faceUp: true }));
  if (pile.length === 0) return [];
  return [{ card: pile[0], faceUp: false }, { card: pile[1], faceUp: true }];
}

// Both players have flipped this round: the higher face-up card takes everything in the battle, in random order,
// under the winner's pile. A tie goes to war, unless neither player has a card left to put in, in which case each
// takes their own cards back. The player who flipped second starts the next round.
function settle(state: GameState, seat: Seat, battle: Battle, random: Random): { state: GameState; outcome: Outcome } {
  const other = otherSeat(state, seat);
  const mine = rankValue(upCard(battle.cards[seat]).rank, true);
  const theirs = rankValue(upCard(battle.cards[other]).rank, true);
  const turn = { ...state, currentPlayer: seat };

  if (mine === theirs) {
    if (state.piles[seat].length > 0 || state.piles[other].length > 0) {
      return { state: { ...turn, battle: { ...battle, flipped: [], wars: battle.wars + 1 } }, outcome: { kind: 'war' } };
    }
    const piles = Object.fromEntries(Object.entries(battle.cards).map(([owner, laid]) =>
      [owner, shuffle(laid.map(entry => entry.card), random)]));
    return {
      state: { ...turn, piles, battle: null, lastBattle: { cards: battle.cards, winner: null, wars: battle.wars } },
      outcome: { kind: 'returned' }
    };
  }

  const winner = mine > theirs ? seat : other;
  const loser = winner === seat ? other : seat;
  const won = shuffle(state.activePlayers.flatMap(owner => battle.cards[owner].map(entry => entry.card)), random);
  const piles = { ...state.piles, [winner]: [...state.piles[winner], ...won] };
  const settled: GameState = { ...turn, piles, battle: null, lastBattle: { cards: battle.cards, winner, wars: battle.wars } };
  const outcome: Outcome = { kind: 'won', winner, taken: won.length };
  if (piles[loser].length > 0) return { state: settled, outcome };
  return { state: { ...settled, currentPlayer: null, isGameOver: true, winners: [winner] }, outcome };
}

function isFlip(move: unknown): boolean {
  return asRecord(move)?.type === 'flip' && !Array.isArray(move);
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  if (!isFlip(move)) return { error: 'Invalid move' };
  if (!state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
  const battle: Battle = state.battle ?? { cards: Object.fromEntries(state.activePlayers.map(owner => [owner, []])), flipped: [], wars: 0 };
  if (battle.flipped.includes(seat)) return { error: 'You already flipped this round' };

  const war = battle.wars > 0;
  const pile = state.piles[seat] ?? [];
  if (!war && pile.length === 0) return { error: 'You have no cards left' };
  const laid = lay(pile, war);
  const cards = { ...battle.cards, [seat]: [...battle.cards[seat], ...laid] };
  const next: Battle = { ...battle, cards, flipped: [...battle.flipped, seat] };
  const flipped: GameState = {
    ...state,
    piles: { ...state.piles, [seat]: pile.slice(laid.length) },
    lastBattle: null
  };
  const base = { type: 'flip' as const, playerNumber: seat, war, down: laid.filter(entry => !entry.faceUp).length, up: upCard(cards[seat]), fresh: laid.length > 0 };

  const result = next.flipped.length < state.activePlayers.length
    ? { state: { ...flipped, battle: next, currentPlayer: otherSeat(state, seat) }, outcome: { kind: 'waiting' } as Outcome }
    : settle(flipped, seat, next, random);
  const lastMove: LastMove = { ...base, outcome: result.outcome };
  let gameStatus = describeMove(lastMove, state.playerNames);
  if (result.state.isGameOver) {
    const winner = state.playerNames[result.state.winners[0]];
    gameStatus += `. ${winner} has all ${DECK_SIZE} cards and wins!`;
  }
  return { state: { ...result.state, lastMove, gameStatus } };
}

const hide = (laid: Laid[]): PublicCard[] => laid.map(entry => entry.faceUp ? entry.card : null);
const hideAll = (cards: Record<Seat, Laid[]>): Record<Seat, PublicCard[]> =>
  Object.fromEntries(Object.entries(cards).map(([seat, laid]) => [seat, hide(laid)]));

// Nobody sees the order of any pile, their own included, or a face-down war card
export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const { piles, battle, lastBattle, ...view } = state;
  return {
    ...view,
    pileCounts: Object.fromEntries(Object.entries(piles).map(([seat, pile]) => [seat, pile.length])),
    battle: battle && { ...battle, cards: hideAll(battle.cards) },
    lastBattle: lastBattle && { ...lastBattle, cards: hideAll(lastBattle.cards) },
    undoAvailable
  };
}
