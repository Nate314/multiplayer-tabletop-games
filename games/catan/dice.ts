// Rolling: production on the rolled number, or on a 7 the discards and the robber, which also moves for a Knight
import { HEX_VERTICES, RESOURCES } from './board.ts';
import { add, covers, describeResources, noResources, subtract, total } from './resources.ts';
import { nameOf, note } from './state.ts';
import type { GameState, Random, Resource, Resources, Result, Seat } from './types.ts';

export const HAND_LIMIT = 7; // more than this on a 7 discards half

export function rollDie(random: Random): number {
  return Math.min(6, Math.floor(random() * 6) + 1);
}

export function roll(state: GameState, seat: Seat, random: Random): GameState {
  const dice: [number, number] = [rollDie(random), rollDie(random)];
  const sum = dice[0] + dice[1];
  const rolled = note({ ...state, dice, rolled: true }, `${nameOf(state, seat)} rolled ${dice[0]} and ${dice[1]}`);
  return sum === 7 ? sevenRolled(rolled) : produce(rolled, sum);
}

// Every player with more than 7 cards discards half, rounded down; then the robber moves
function sevenRolled(state: GameState): GameState {
  const counts: Record<Seat, number> = {};
  for (const seat of state.activePlayers) {
    const cards = total(state.hands[seat] ?? noResources());
    if (cards > HAND_LIMIT) counts[seat] = Math.floor(cards / 2);
  }
  const waiting = Object.keys(counts).map(Number);
  if (waiting.length === 0) return { ...state, pending: { kind: 'robber' } };
  const names = waiting.map(seat => `${nameOf(state, seat)} ${counts[seat]}`).join(', ');
  return note({ ...state, pending: { kind: 'discard', counts } }, `Discard half: ${names}`);
}

// Each settlement takes one and each city two of the resource of every hex rolled, except under the robber.
// When the bank cannot pay everyone their share of a resource, nobody takes it, unless only one player is owed it,
// who then takes what is left.
export function produce(state: GameState, sum: number): GameState {
  const owed: Record<Seat, Resources> = {};
  state.layout.hexes.forEach((hex, index) => {
    if (hex.number !== sum || hex.resource === null || index === state.robber) return;
    for (const vertex of HEX_VERTICES[index]) {
      const building = state.buildings[vertex];
      if (!building || !state.activePlayers.includes(building.seat)) continue;
      owed[building.seat] ??= noResources();
      owed[building.seat][hex.resource] += building.city ? 2 : 1;
    }
  });
  let next = state;
  const gains: Record<Seat, Resources> = {};
  for (const resource of RESOURCES) {
    const owing = Object.keys(owed).map(Number).filter(seat => owed[seat][resource] > 0);
    const wanted = owing.reduce((sum, seat) => sum + owed[seat][resource], 0);
    if (wanted === 0) continue;
    const available = state.bank[resource];
    if (wanted > available && owing.length > 1) {
      next = note(next, `The bank is short of ${resource}, so nobody takes any`);
      continue;
    }
    for (const seat of owing) {
      gains[seat] ??= noResources();
      gains[seat][resource] = Math.min(owed[seat][resource], available);
    }
  }
  const seats = Object.keys(gains).map(Number).sort((a, b) => a - b);
  for (const seat of seats) next = giveFromBank(next, seat, gains[seat]);
  if (seats.every(seat => total(gains[seat]) === 0)) return note(next, 'Nobody produced anything');
  return seats.reduce((noted, seat) => total(gains[seat]) > 0
    ? note(noted, `${nameOf(state, seat)} took ${describeResources(gains[seat])}`) : noted, next);
}

export function giveFromBank(state: GameState, seat: Seat, gained: Resources): GameState {
  return {
    ...state,
    hands: { ...state.hands, [seat]: add(state.hands[seat] ?? noResources(), gained) },
    bank: subtract(state.bank, gained)
  };
}

// A discard after a 7, made as an action by whoever must discard
export function discard(state: GameState, seat: Seat, cards: Resources): Result<GameState> {
  const { pending } = state;
  if (pending?.kind !== 'discard' || !(seat in pending.counts)) return { error: 'You have nothing to discard' };
  const count = pending.counts[seat];
  if (total(cards) !== count) return { error: `Discard exactly ${count} cards` };
  const hand = state.hands[seat] ?? noResources();
  if (!covers(hand, cards)) return { error: 'You do not have those cards' };
  const counts = { ...pending.counts };
  delete counts[seat];
  const discarded = note({
    ...state,
    hands: { ...state.hands, [seat]: subtract(hand, cards) },
    bank: add(state.bank, cards)
  }, `${nameOf(state, seat)} discarded ${describeResources(cards)}`);
  return { state: { ...discarded, pending: afterDiscards(counts) } };
}

export function afterDiscards(counts: Record<Seat, number>): GameState['pending'] {
  return Object.keys(counts).length === 0 ? { kind: 'robber' } : { kind: 'discard', counts };
}

// The players `seat` could steal from with the robber on `hex`: others with a building there and a card in hand
export function robberVictims(state: Pick<GameState, 'activePlayers' | 'buildings'>, seat: Seat, hex: number, cardCount: (seat: Seat) => number): Seat[] {
  const owners = new Set(HEX_VERTICES[hex].map(vertex => state.buildings[vertex]?.seat).filter(owner => owner !== undefined));
  return state.activePlayers.filter(other => other !== seat && owners.has(other) && cardCount(other) > 0);
}

// The robber moves to another hex, and the mover steals one random card from a player there, if any has one
export function moveRobber(state: GameState, seat: Seat, hex: number, victim: Seat | null, random: Random): Result<GameState> {
  if (state.pending?.kind !== 'robber') return { error: 'The robber is not moving now' };
  if (hex === state.robber) return { error: 'Move the robber to a different hex' };
  const victims = robberVictims(state, seat, hex, other => total(state.hands[other] ?? noResources()));
  if (victims.length > 0 && (victim === null || !victims.includes(victim))) return { error: 'Choose a player to steal from' };
  if (victims.length === 0 && victim !== null) return { error: 'Nobody there can be stolen from' };
  const moved = note({ ...state, robber: hex, pending: null }, `${nameOf(state, seat)} moved the robber`);
  if (victim === null) return { state: moved };
  const hand = state.hands[victim];
  const cards = RESOURCES.flatMap(resource => Array<Resource>(hand[resource]).fill(resource));
  const resource = cards[Math.min(cards.length - 1, Math.floor(random() * cards.length))];
  const taken = { ...noResources(), [resource]: 1 };
  return {
    state: note({
      ...moved,
      hands: { ...moved.hands, [victim]: subtract(hand, taken), [seat]: add(moved.hands[seat] ?? noResources(), taken) },
      steal: { thief: seat, victim, resource }
    }, `${nameOf(state, seat)} stole a card from ${nameOf(state, victim)}`)
  };
}
