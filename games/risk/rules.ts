// Risk rules: the game's hooks for the platform, the setup, reading untrusted moves, ending a turn, and the public view.
// The rules themselves live in map.ts, state.ts, cards.ts, battle.ts and placement.ts.
import { handCounts } from '../../shared/hands.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { ALL_CARDS, TERRITORIES, isCard, isTerritory } from './map.ts';
import { attack, blitz, occupy } from './battle.ts';
import { drawCard, tradeCards } from './cards.ts';
import { fortify, placeReinforcements, placeStarting } from './placement.ts';
import {
  LOG_SIZE, STARTING_ARMIES, checkGameOver, inGame, nameOf, nextInGame, note, plural, startTurn
} from './state.ts';
import type { GameState, LastMove, Move, Placements, PublicGameState, Random, Result, Seat } from './types.ts';

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    phase: 'setup',
    firstPlayer: null,
    turnHolder: null,
    owners: {},
    armies: {},
    setupLeft: {},
    reinforcements: 0,
    midTurnTrade: false,
    bonusTaken: false,
    conqueredThisTurn: false,
    conquest: null,
    hands: {},
    deck: [],
    discard: [],
    tradeCount: 0,
    eliminated: [],
    turnNumber: 0,
    battle: null,
    log: [],
    lastMove: null
  };
}

// Before the first move: once 3 are seated, a random player goes first, the territories are dealt out from them
// with one army each, and the deck is shuffled
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const fresh: GameState = {
    ...createGameState(state.gameId),
    ...state,
    phase: 'setup',
    owners: {},
    armies: {},
    setupLeft: {},
    hands: Object.fromEntries(players.map(seat => [seat, []])),
    deck: [],
    discard: [],
    tradeCount: 0,
    eliminated: [],
    turnNumber: 0,
    battle: null,
    conquest: null,
    log: [],
    lastMove: null
  };
  const starting = STARTING_ARMIES[players.length];
  if (starting === undefined) return { ...fresh, firstPlayer: null, turnHolder: players[0] ?? null, currentPlayer: players[0] ?? null };

  const first = players[Math.floor(random() * players.length)];
  const order = [...players.filter(seat => seat >= first), ...players.filter(seat => seat < first)];
  const owners: Record<string, Seat> = {};
  shuffle(TERRITORIES.map(({ id }) => id), random).forEach((id, index) => { owners[id] = order[index % order.length]; });
  const held = (seat: Seat) => Object.values(owners).filter(owner => owner === seat).length;
  return {
    ...fresh,
    firstPlayer: first,
    turnHolder: first,
    currentPlayer: first,
    owners,
    armies: Object.fromEntries(TERRITORIES.map(({ id }) => [id, 1])),
    setupLeft: Object.fromEntries(players.map(seat => [seat, starting - held(seat)])),
    deck: shuffle(ALL_CARDS, random),
    gameStatus: `${state.gameStatus}. ${nameOf(state, first)} was drawn to go first. Each player has ${starting} armies`
  };
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, deck, discard, ...view } = state;
  return {
    ...view,
    handCounts: handCounts(hands),
    hand: viewer === null ? null : hands[viewer] ?? null,
    deckCount: deck.length,
    discardCount: discard.length,
    undoAvailable
  };
}

// Reading untrusted moves

function parsePlacements(value: unknown): Placements | null {
  const input = asRecord(value);
  if (!input || Array.isArray(input)) return null;
  const placements: Placements = {};
  for (const [territory, count] of Object.entries(input)) {
    if (!isTerritory(territory) || typeof count !== 'number') return null;
    placements[territory] = count;
  }
  return placements;
}

function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'place': {
      const placements = parsePlacements(input.placements);
      return placements ? { type: 'place', placements } : null;
    }
    case 'trade': {
      const { cards } = input;
      return Array.isArray(cards) && cards.every(isCard) ? { type: 'trade', cards: [...cards] } : null;
    }
    case 'attack':
      if (!isTerritory(input.from) || !isTerritory(input.to) || typeof input.dice !== 'number') return null;
      return { type: 'attack', from: input.from, to: input.to, dice: input.dice };
    case 'blitz':
      return isTerritory(input.from) && isTerritory(input.to) ? { type: 'blitz', from: input.from, to: input.to } : null;
    case 'occupy':
      return typeof input.armies === 'number' ? { type: 'occupy', armies: input.armies } : null;
    case 'fortify':
      if (!isTerritory(input.from) || !isTerritory(input.to) || typeof input.armies !== 'number') return null;
      return { type: 'fortify', from: input.from, to: input.to, armies: input.armies };
    case 'endAttack':
    case 'endTurn':
      return { type: input.type };
    default:
      return null;
  }
}

export function describeMove(lastMove: LastMove): string {
  return lastMove.events.join('. ');
}

// The territories a move touched, outlined in the history
function territoriesOf(move: Move, before: GameState): string[] {
  switch (move.type) {
    case 'place': return Object.keys(move.placements);
    case 'attack':
    case 'blitz':
    case 'fortify': return [move.from, move.to];
    case 'occupy': return before.conquest ? [before.conquest.from, before.conquest.to] : [];
    default: return [];
  }
}

// The rules run with an empty log, so what they noted is exactly what this change did
function finish(before: GameState, after: GameState, lastMove?: Omit<LastMove, 'events'>): GameState {
  const settled = checkGameOver(after);
  const events = settled.log;
  return {
    ...settled,
    log: [...before.log, ...events].slice(-LOG_SIZE),
    gameStatus: events.length > 0 ? events.join('. ') : before.gameStatus,
    lastMove: lastMove ? { ...lastMove, events } : before.lastMove
  };
}

// The next player who still has starting armies to place, after `from` in turn order, or null once everyone is done
function nextToPlace(state: GameState, from: Seat): Seat | null {
  const players = inGame(state);
  const order = [...players.filter(seat => seat > from), ...players.filter(seat => seat <= from)];
  return order.find(seat => (state.setupLeft[seat] ?? 0) > 0) ?? null;
}

// After a player's starting armies, the next player places theirs; after the last, the first player's turn begins
function afterSetupPlacement(state: GameState, seat: Seat): GameState {
  const next = nextToPlace(state, seat);
  if (next !== null) return { ...state, currentPlayer: next, turnHolder: next };
  const first = state.firstPlayer !== null && inGame(state).includes(state.firstPlayer)
    ? state.firstPlayer
    : nextInGame(state, state.firstPlayer ?? seat);
  return startTurn(note(state, 'Every army is placed: the war begins'), first);
}

function endTurn(state: GameState, seat: Seat, random: Random): Result<GameState> {
  if (state.phase !== 'attack' && state.phase !== 'fortify') return { error: 'You cannot end your turn yet' };
  const drawn = state.conqueredThisTurn ? drawCard(state, seat, random) : state;
  return { state: startTurn(note(drawn, `${nameOf(state, seat)} ended their turn`), nextInGame(state, seat)) };
}

function play(state: GameState, seat: Seat, move: Move, random: Random): Result<GameState> {
  if (state.phase === 'setup') {
    if (move.type !== 'place') return { error: 'Place your starting armies first' };
    const placed = placeStarting(state, seat, move.placements);
    return 'error' in placed ? placed : { state: afterSetupPlacement(placed.state, seat) };
  }
  if (state.phase === 'conquer' && move.type !== 'occupy') return { error: 'Move armies into the captured territory first' };
  switch (move.type) {
    case 'place':
      if (state.phase !== 'reinforce') return { error: 'You have no armies to place' };
      return placeReinforcements(state, seat, move.placements);
    case 'trade': return tradeCards(state, seat, move.cards);
    case 'attack': return attack(state, seat, move.from, move.to, move.dice, random);
    case 'blitz': return blitz(state, seat, move.from, move.to, random);
    case 'occupy': return occupy(state, seat, move.armies);
    case 'endAttack':
      if (state.phase !== 'attack') return { error: 'You are not attacking' };
      return { state: note({ ...state, phase: 'fortify' }, `${nameOf(state, seat)} stopped attacking`) };
    case 'fortify': {
      const fortified = fortify(state, seat, move.from, move.to, move.armies);
      return 'error' in fortified ? fortified : endTurn({ ...fortified.state, phase: 'fortify' }, seat, random);
    }
    case 'endTurn': return endTurn(state, seat, random);
  }
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (state.eliminated.includes(seat)) return { error: 'You have been eliminated' };
  if (state.firstPlayer === null) return { error: 'Waiting for more players' };
  const result = play({ ...state, log: [] }, seat, parsed, random);
  if ('error' in result) return result;
  const lastMove = { type: parsed.type, playerNumber: seat, territories: territoriesOf(parsed, state) };
  return { state: finish(state, result.state, lastMove) };
}

// A dismissed player's territories turn neutral, keeping their armies: they never attack and count for nobody, but
// defend and can be captured. Their cards are discarded. If it was their turn, the next player's turn begins.
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  let working: GameState = { ...state, log: [] };
  const { conquest } = working;
  if (state.turnHolder === seat && conquest) {
    const armies = { ...working.armies, [conquest.from]: working.armies[conquest.from] - conquest.minimum, [conquest.to]: conquest.minimum };
    working = { ...working, armies, conquest: null };
  }
  const owners = Object.fromEntries(Object.entries(working.owners).map(([id, owner]) => [id, owner === seat ? null : owner]));
  const cards = working.hands[seat] ?? [];
  working = note({
    ...working,
    owners,
    hands: { ...working.hands, [seat]: [] },
    discard: [...working.discard, ...cards],
    setupLeft: { ...working.setupLeft, [seat]: 0 }
  }, `${nameOf(state, seat)} left: their territories are neutral and their ${plural(cards.length, 'card')} discarded`);

  // Play goes on with two; `finish` ends the game if only one player still holds territory
  if (state.turnHolder === seat) {
    if (working.phase === 'setup') working = afterSetupPlacement(working, seat);
    else working = startTurn(working, nextInGame(working, seat));
  } else {
    working = { ...working, currentPlayer: working.turnHolder };
  }
  return finish(state, working);
}
